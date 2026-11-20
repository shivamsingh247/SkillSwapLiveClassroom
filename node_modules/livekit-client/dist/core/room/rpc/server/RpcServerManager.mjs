import {__awaiter}from'tslib';import {DataPacket,RpcAck,DataPacket_Kind,RpcResponse}from'@livekit/protocol';import {EventEmitter}from'events';import'../../../logger.mjs';import {CLIENT_PROTOCOL_DATA_STREAM_RPC}from'../../../version.mjs';import'../../errors.mjs';import {RpcError,RpcRequestAttrs,RPC_VERSION_V2,RPC_RESPONSE_DATA_STREAM_TOPIC,byteLength,MAX_V1_PAYLOAD_BYTES}from'../utils.mjs';/**
 * Manages the server (handler) side of RPC: processing incoming requests,
 * managing registered method handlers, and sending responses.
 * @internal
 */
class RpcServerManager extends EventEmitter {
  constructor(log, outgoingDataStreamManager, getRemoteParticipantClientProtocol) {
    super();
    this.rpcHandlers = new Map();
    this.log = log;
    this.outgoingDataStreamManager = outgoingDataStreamManager;
    this.getRemoteParticipantClientProtocol = getRemoteParticipantClientProtocol;
  }
  registerRpcMethod(method, handler) {
    if (this.rpcHandlers.has(method)) {
      throw Error("RPC handler already registered for method ".concat(method, ", unregisterRpcMethod before trying to register again"));
    }
    this.rpcHandlers.set(method, handler);
  }
  unregisterRpcMethod(method) {
    this.rpcHandlers.delete(method);
  }
  /**
   * Handle an incoming RPCRequest message containing a payload.
   * This handles "version 1" of rpc requests.
   * @internal
   */
  handleIncomingRpcRequest(callerIdentity, rpcRequest) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      this.publishRpcAck(callerIdentity, rpcRequest.id);
      if (rpcRequest.version !== 1) {
        this.publishRpcResponsePacket(callerIdentity, rpcRequest.id, null, RpcError.builtIn('UNSUPPORTED_VERSION'));
        return;
      }
      const handler = this.rpcHandlers.get(rpcRequest.method);
      if (!handler) {
        this.publishRpcResponsePacket(callerIdentity, rpcRequest.id, null, RpcError.builtIn('UNSUPPORTED_METHOD'));
        return;
      }
      let response;
      try {
        response = yield handler({
          requestId: rpcRequest.id,
          callerIdentity,
          payload: rpcRequest.payload,
          responseTimeout: rpcRequest.responseTimeoutMs
        });
      } catch (error) {
        let responseError;
        if (error instanceof RpcError) {
          responseError = error;
        } else {
          this.log.warn("Uncaught error returned by RPC handler for ".concat(rpcRequest.method, ". Returning APPLICATION_ERROR instead."), error);
          responseError = RpcError.builtIn('APPLICATION_ERROR', "Uncaught error: ".concat((_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : error), {
            cause: error
          });
        }
        this.publishRpcResponsePacket(callerIdentity, rpcRequest.id, null, responseError);
        return;
      }
      yield this.publishRpcResponse(callerIdentity, rpcRequest.id, response !== null && response !== void 0 ? response : '');
    });
  }
  /**
   * Handle an incoming data stream containing a RPC request payload.
   * This handles "version 2" of rpc requests.
   * @internal
   */
  handleIncomingDataStream(reader, callerIdentity, dataStreamAttrs) {
    return __awaiter(this, void 0, void 0, function* () {
      const requestId = dataStreamAttrs[RpcRequestAttrs.RPC_REQUEST_ID];
      const method = dataStreamAttrs[RpcRequestAttrs.RPC_REQUEST_METHOD];
      const responseTimeout = parseInt(dataStreamAttrs[RpcRequestAttrs.RPC_REQUEST_RESPONSE_TIMEOUT_MS], 10);
      const version = parseInt(dataStreamAttrs[RpcRequestAttrs.RPC_REQUEST_VERSION], 10);
      if (!requestId || !method || Number.isNaN(responseTimeout) || Number.isNaN(version)) {
        this.log.warn("RPC data stream malformed: ".concat(RpcRequestAttrs.RPC_REQUEST_ID, " / ").concat(RpcRequestAttrs.RPC_REQUEST_METHOD, " / ").concat(RpcRequestAttrs.RPC_REQUEST_RESPONSE_TIMEOUT_MS, " / ").concat(RpcRequestAttrs.RPC_REQUEST_VERSION, " not set."));
        this.publishRpcResponsePacket(callerIdentity, requestId, null, RpcError.builtIn('APPLICATION_ERROR', 'RPC data stream malformed'));
        return;
      }
      this.publishRpcAck(callerIdentity, requestId);
      if (version !== RPC_VERSION_V2) {
        this.publishRpcResponsePacket(callerIdentity, requestId, null, RpcError.builtIn('UNSUPPORTED_VERSION'));
        return;
      }
      let payload;
      try {
        payload = yield reader.readAll();
      } catch (e) {
        this.log.warn("Error reading RPC request payload: ".concat(e));
        this.publishRpcResponsePacket(callerIdentity, requestId, null, RpcError.builtIn('APPLICATION_ERROR', 'Error reading RPC request payload', {
          cause: e
        }));
        return;
      }
      const handler = this.rpcHandlers.get(method);
      if (!handler) {
        this.publishRpcResponsePacket(callerIdentity, requestId, null, RpcError.builtIn('UNSUPPORTED_METHOD'));
        return;
      }
      let response;
      try {
        response = yield handler({
          requestId,
          callerIdentity,
          payload,
          responseTimeout
        });
      } catch (error) {
        let responseError;
        if (error instanceof RpcError) {
          responseError = error;
        } else {
          this.log.warn("Uncaught error returned by RPC handler for ".concat(method, ". Returning APPLICATION_ERROR instead."), error);
          responseError = RpcError.builtIn('APPLICATION_ERROR');
        }
        this.publishRpcResponsePacket(callerIdentity, requestId, null, responseError);
        return;
      }
      yield this.publishRpcResponse(callerIdentity, requestId, response !== null && response !== void 0 ? response : '');
    });
  }
  publishRpcAck(destinationIdentity, requestId) {
    this.emit('sendDataPacket', {
      packet: new DataPacket({
        destinationIdentities: [destinationIdentity],
        kind: DataPacket_Kind.RELIABLE,
        value: {
          case: 'rpcAck',
          value: new RpcAck({
            requestId
          })
        }
      })
    });
  }
  publishRpcResponsePacket(destinationIdentity, requestId, payload, error) {
    this.emit('sendDataPacket', {
      packet: new DataPacket({
        destinationIdentities: [destinationIdentity],
        kind: DataPacket_Kind.RELIABLE,
        value: {
          case: 'rpcResponse',
          value: new RpcResponse({
            requestId,
            value: error ? {
              case: 'error',
              value: error.toProto()
            } : {
              case: 'payload',
              value: payload !== null && payload !== void 0 ? payload : ''
            }
          })
        }
      })
    });
  }
  /**
   * Send a successful RPC response payload, choosing the transport based on
   * the caller's client protocol version.
   */
  publishRpcResponse(destinationIdentity, requestId, payload) {
    return __awaiter(this, void 0, void 0, function* () {
      const callerClientProtocol = this.getRemoteParticipantClientProtocol(destinationIdentity);
      if (callerClientProtocol >= CLIENT_PROTOCOL_DATA_STREAM_RPC) {
        // Send response as a data stream
        yield this.outgoingDataStreamManager.sendText(payload, {
          topic: RPC_RESPONSE_DATA_STREAM_TOPIC,
          destinationIdentities: [destinationIdentity],
          attributes: {
            [RpcRequestAttrs.RPC_REQUEST_ID]: requestId
          }
        });
        return;
      }
      // Legacy client: enforce size limit and send uncompressed payload inline
      const responseBytes = byteLength(payload);
      if (responseBytes > MAX_V1_PAYLOAD_BYTES) {
        this.log.warn("RPC Response payload too large for request ".concat(requestId, ". To send larger responses, consider updating the sending client."));
        this.publishRpcResponsePacket(destinationIdentity, requestId, null, RpcError.builtIn('RESPONSE_PAYLOAD_TOO_LARGE'));
        return;
      }
      this.publishRpcResponsePacket(destinationIdentity, requestId, payload, null);
    });
  }
}export{RpcServerManager as default};//# sourceMappingURL=RpcServerManager.mjs.map
