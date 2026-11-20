import {slicedToArray as _slicedToArray}from'../../../_virtual/_rollupPluginBabelHelpers.mjs';import {__awaiter}from'tslib';import {DataPacket,RpcRequest,DataPacket_Kind}from'@livekit/protocol';import {EventEmitter}from'events';import'../../../logger.mjs';import {CLIENT_PROTOCOL_DATA_STREAM_RPC}from'../../../version.mjs';import'../../errors.mjs';import {compareVersions,Future}from'../../utils.mjs';import {byteLength,MAX_V1_PAYLOAD_BYTES,RpcError,RPC_REQUEST_DATA_STREAM_TOPIC,RpcRequestAttrs,RPC_VERSION_V2,RPC_VERSION_V1}from'../utils.mjs';/**
 * Manages the client (caller) side of RPC: sending requests, tracking pending
 * ack/response state, and handling incoming ack/response packets.
 * @internal
 */
class RpcClientManager extends EventEmitter {
  constructor(log, outgoingDataStreamManager, getRemoteParticipantClientProtocol, getServerVersion) {
    super();
    this.pendingAcks = new Map();
    this.pendingResponses = new Map();
    this.log = log;
    this.outgoingDataStreamManager = outgoingDataStreamManager;
    this.getRemoteParticipantClientProtocol = getRemoteParticipantClientProtocol;
    this.getServerVersion = getServerVersion;
  }
  performRpc(_a) {
    return __awaiter(this, arguments, void 0, function (_ref) {
      var _this = this;
      let destinationIdentity = _ref.destinationIdentity,
        method = _ref.method,
        payload = _ref.payload,
        _ref$responseTimeout = _ref.responseTimeout,
        responseTimeoutMs = _ref$responseTimeout === void 0 ? 15000 : _ref$responseTimeout;
      return function* () {
        const maxRoundTripLatencyMs = 7000;
        const minEffectiveTimeoutMs = maxRoundTripLatencyMs + 1000;
        const remoteClientProtocol = _this.getRemoteParticipantClientProtocol(destinationIdentity);
        const payloadBytes = byteLength(payload);
        // Only enforce the legacy size limit when on rpc v1
        if (payloadBytes > MAX_V1_PAYLOAD_BYTES && remoteClientProtocol < CLIENT_PROTOCOL_DATA_STREAM_RPC) {
          throw RpcError.builtIn('REQUEST_PAYLOAD_TOO_LARGE');
        }
        const serverVersion = _this.getServerVersion();
        if (serverVersion && compareVersions(serverVersion, '1.8.0') < 0) {
          throw RpcError.builtIn('UNSUPPORTED_SERVER');
        }
        const effectiveTimeoutMs = Math.max(responseTimeoutMs, minEffectiveTimeoutMs);
        const id = crypto.randomUUID();
        const completionFuture = new Future();
        let responseTimeoutId = null;
        const ackTimeoutId = setTimeout(() => {
          var _a;
          _this.pendingAcks.delete(id);
          (_a = completionFuture.reject) === null || _a === void 0 ? void 0 : _a.call(completionFuture, RpcError.builtIn('CONNECTION_TIMEOUT'));
          _this.pendingResponses.delete(id);
          if (responseTimeoutId !== null) {
            clearTimeout(responseTimeoutId);
          }
        }, maxRoundTripLatencyMs);
        _this.pendingAcks.set(id, {
          resolve: () => {
            clearTimeout(ackTimeoutId);
          },
          participantIdentity: destinationIdentity
        });
        _this.pendingResponses.set(id, {
          completionFuture,
          participantIdentity: destinationIdentity
        });
        // Observe the future before publishing: a slow send can outlast the ack timer.
        // Keep the returned promise rejected for callers, while marking its rejection
        // handled until performRpc has finished publishing and can return it.
        const completionPromise = completionFuture.promise.finally(() => {
          if (responseTimeoutId !== null) {
            clearTimeout(responseTimeoutId);
          }
          if (_this.pendingAcks.has(id)) {
            _this.log.warn('RPC response received before ack', id);
            _this.pendingAcks.delete(id);
            clearTimeout(ackTimeoutId);
          }
        });
        completionPromise.catch(() => {});
        try {
          yield _this.publishRpcRequest(destinationIdentity, id, method, payload, effectiveTimeoutMs, remoteClientProtocol);
        } catch (e) {
          // The caller receives the publish error. Do not leave an ack timer that
          // later rejects a future the caller never received.
          clearTimeout(ackTimeoutId);
          _this.pendingAcks.delete(id);
          _this.pendingResponses.delete(id);
          throw e;
        }
        if (_this.pendingResponses.has(id)) {
          responseTimeoutId = setTimeout(() => {
            var _a;
            _this.pendingResponses.delete(id);
            (_a = completionFuture.reject) === null || _a === void 0 ? void 0 : _a.call(completionFuture, RpcError.builtIn('RESPONSE_TIMEOUT'));
          }, responseTimeoutMs);
        }
        return [id, completionPromise];
      }();
    });
  }
  publishRpcRequest(destinationIdentity, requestId, method, payload, responseTimeout, remoteClientProtocol) {
    return __awaiter(this, void 0, void 0, function* () {
      if (remoteClientProtocol >= CLIENT_PROTOCOL_DATA_STREAM_RPC) {
        // Send payload as a data stream - a "version 2" rpc request.
        yield this.outgoingDataStreamManager.sendText(payload, {
          topic: RPC_REQUEST_DATA_STREAM_TOPIC,
          destinationIdentities: [destinationIdentity],
          attributes: {
            [RpcRequestAttrs.RPC_REQUEST_ID]: requestId,
            [RpcRequestAttrs.RPC_REQUEST_METHOD]: method,
            [RpcRequestAttrs.RPC_REQUEST_RESPONSE_TIMEOUT_MS]: "".concat(responseTimeout),
            [RpcRequestAttrs.RPC_REQUEST_VERSION]: "".concat(RPC_VERSION_V2)
          }
        });
        return;
      }
      // Fallback to sending a literal RpcRequest - a "version 1" rpc request.
      this.emit('sendDataPacket', {
        packet: new DataPacket({
          destinationIdentities: [destinationIdentity],
          kind: DataPacket_Kind.RELIABLE,
          value: {
            case: 'rpcRequest',
            value: new RpcRequest({
              id: requestId,
              method,
              payload,
              responseTimeoutMs: responseTimeout,
              version: RPC_VERSION_V1
            })
          }
        })
      });
    });
  }
  /**
   * Handle an incoming data stream containing an RPC response payload.
   * @internal
   */
  handleIncomingDataStream(reader, senderIdentity, attributes) {
    return __awaiter(this, void 0, void 0, function* () {
      const associatedRequestId = attributes[RpcRequestAttrs.RPC_REQUEST_ID];
      if (!associatedRequestId) {
        this.log.warn("RPC data stream malformed: ".concat(RpcRequestAttrs.RPC_REQUEST_ID, " not set."));
        // NOTE: no response can be sent here, because there's no request id so associate
        // so logging is the best we can do here.
        return;
      }
      const pending = this.pendingResponses.get(associatedRequestId);
      if (pending && pending.participantIdentity !== senderIdentity) {
        this.log.warn("RPC response stream for ".concat(associatedRequestId, " arrived from unexpected sender ").concat(senderIdentity, ", expected ").concat(pending.participantIdentity, ". Ignoring."));
        return;
      }
      let payload;
      try {
        payload = yield reader.readAll();
      } catch (e) {
        this.log.warn("Error reading RPC response payload: ".concat(e));
        this.handleIncomingRpcResponseFailure(associatedRequestId, RpcError.builtIn('APPLICATION_ERROR', 'Error reading RPC response payload', {
          cause: e
        }));
        return;
      }
      this.handleIncomingRpcResponseSuccess(associatedRequestId, payload);
    });
  }
  /** @internal */
  handleIncomingRpcResponseSuccess(requestId, payload) {
    var _a, _b;
    const handler = this.pendingResponses.get(requestId);
    if (handler) {
      (_b = (_a = handler.completionFuture).resolve) === null || _b === void 0 ? void 0 : _b.call(_a, payload);
      this.pendingResponses.delete(requestId);
    } else {
      this.log.error('Response received for unexpected RPC request', requestId);
    }
  }
  /** @internal */
  handleIncomingRpcResponseFailure(requestId, error) {
    var _a, _b;
    const handler = this.pendingResponses.get(requestId);
    if (handler) {
      (_b = (_a = handler.completionFuture).reject) === null || _b === void 0 ? void 0 : _b.call(_a, error);
      this.pendingResponses.delete(requestId);
    } else {
      this.log.error('Response received for unexpected RPC request', requestId);
    }
  }
  /** @internal */
  handleIncomingRpcAck(requestId) {
    const handler = this.pendingAcks.get(requestId);
    if (handler) {
      handler.resolve();
      this.pendingAcks.delete(requestId);
    } else {
      this.log.error("Ack received for unexpected RPC request: ".concat(requestId));
    }
  }
  /** @internal */
  handleParticipantDisconnected(participantIdentity) {
    var _a;
    for (const _ref2 of this.pendingAcks) {
      var _ref3 = _slicedToArray(_ref2, 2);
      const id = _ref3[0];
      const pendingIdentity = _ref3[1].participantIdentity;
      if (pendingIdentity === participantIdentity) {
        this.pendingAcks.delete(id);
      }
    }
    for (const _ref4 of this.pendingResponses) {
      var _ref5 = _slicedToArray(_ref4, 2);
      const id = _ref5[0];
      var _ref5$ = _ref5[1];
      const pendingIdentity = _ref5$.participantIdentity;
      const completionFuture = _ref5$.completionFuture;
      if (pendingIdentity === participantIdentity) {
        (_a = completionFuture.reject) === null || _a === void 0 ? void 0 : _a.call(completionFuture, RpcError.builtIn('RECIPIENT_DISCONNECTED'));
        this.pendingResponses.delete(id);
      }
    }
  }
  /**
   * No ack or response can arrive once the local participant has left the room.
   * @internal
   */
  handleRoomDisconnected() {
    var _a;
    for (const _ref6 of this.pendingAcks.values()) {
      const resolve = _ref6.resolve;
      // clears the ack timer
      resolve();
    }
    this.pendingAcks.clear();
    for (const _ref7 of this.pendingResponses.values()) {
      const completionFuture = _ref7.completionFuture;
      (_a = completionFuture.reject) === null || _a === void 0 ? void 0 : _a.call(completionFuture, RpcError.builtIn('CONNECTION_CLOSED'));
    }
    this.pendingResponses.clear();
  }
}export{RpcClientManager as default};//# sourceMappingURL=RpcClientManager.mjs.map
