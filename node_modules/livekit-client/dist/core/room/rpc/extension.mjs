import {slicedToArray as _slicedToArray}from'../../_virtual/_rollupPluginBabelHelpers.mjs';import {__awaiter}from'tslib';import RpcClientManager from'./client/RpcClientManager.mjs';import RpcServerManager from'./server/RpcServerManager.mjs';import {RPC_REQUEST_DATA_STREAM_TOPIC,RPC_RESPONSE_DATA_STREAM_TOPIC,RpcError}from'./utils.mjs';import {CLIENT_PROTOCOL_DEFAULT}from'../../version.mjs';import {DataChannelKind}from'../data-channel/types.mjs';import {dataStreams}from'../data-stream/extension.mjs';import {RoomEvent}from'../events.mjs';/**
 * RPC over the room (`performRpc`, `registerRpcMethod`). Requires {@link dataStreams}.
 * @experimental
 */
const rpc = {
  key: /* @__PURE__ */Symbol('lk.extension.rpc'),
  requires: [dataStreams],
  install(room, ctx) {
    const _ctx$get = ctx.get(dataStreams),
      incoming = _ctx$get.incoming,
      outgoing = _ctx$get.outgoing;
    const clientProtocol = identity => {
      var _a, _b;
      return (_b = (_a = room.remoteParticipants.get(identity)) === null || _a === void 0 ? void 0 : _a.clientProtocol) !== null && _b !== void 0 ? _b : CLIENT_PROTOCOL_DEFAULT;
    };
    const client = new RpcClientManager(ctx.log, outgoing, clientProtocol, () => {
      var _a;
      return (_a = room.engine) === null || _a === void 0 ? void 0 : _a.serverVersion;
    });
    client.on('sendDataPacket', _ref => {
      let packet = _ref.packet;
      var _a;
      (_a = room.engine) === null || _a === void 0 ? void 0 : _a.sendDataPacket(packet, DataChannelKind.RELIABLE);
    });
    const server = new RpcServerManager(ctx.log, outgoing, clientProtocol);
    server.on('sendDataPacket', _ref2 => {
      let packet = _ref2.packet;
      var _a;
      (_a = room.engine) === null || _a === void 0 ? void 0 : _a.sendDataPacket(packet, DataChannelKind.RELIABLE);
    });
    incoming.registerTextStreamHandler(RPC_REQUEST_DATA_STREAM_TOPIC, (reader_1, _a) => __awaiter(this, [reader_1, _a], void 0, function (reader, _ref3) {
      let identity = _ref3.identity;
      return function* () {
        var _b;
        yield server.handleIncomingDataStream(reader, identity, (_b = reader.info.attributes) !== null && _b !== void 0 ? _b : {});
      }();
    }));
    incoming.registerTextStreamHandler(RPC_RESPONSE_DATA_STREAM_TOPIC, (reader_1, _a) => __awaiter(this, [reader_1, _a], void 0, function (reader, _ref4) {
      let identity = _ref4.identity;
      return function* () {
        var _b;
        yield client.handleIncomingDataStream(reader, identity, (_b = reader.info.attributes) !== null && _b !== void 0 ? _b : {});
      }();
    }));
    room.on(RoomEvent.ParticipantDisconnected, participant => client.handleParticipantDisconnected(participant.identity));
    const registerRpcMethod = (method, handler) => server.registerRpcMethod(method, handler);
    const unregisterRpcMethod = method => server.unregisterRpcMethod(method);
    return {
      dataPackets: {
        rpcRequest: (request, packet) => {
          server.handleIncomingRpcRequest(packet.participantIdentity, request);
        },
        rpcResponse: response => {
          switch (response.value.case) {
            case 'payload':
              client.handleIncomingRpcResponseSuccess(response.requestId, response.value.value);
              break;
            case 'error':
              client.handleIncomingRpcResponseFailure(response.requestId, RpcError.fromProto(response.value.value));
              break;
            default:
              ctx.log.warn("Unknown rpcResponse.value.case: ".concat(response.value.case));
              break;
          }
        },
        rpcAck: ack => client.handleIncomingRpcAck(ack.requestId)
      },
      onDisconnect: () => client.handleRoomDisconnected(),
      room: {
        registerRpcMethod,
        unregisterRpcMethod
      },
      localParticipant: {
        performRpc: params => client.performRpc(params).then(_ref5 => {
          let _ref6 = _slicedToArray(_ref5, 2);
            _ref6[0];
            let completionPromise = _ref6[1];
          return completionPromise;
        })
      }
    };
  }
};export{rpc};//# sourceMappingURL=extension.mjs.map
