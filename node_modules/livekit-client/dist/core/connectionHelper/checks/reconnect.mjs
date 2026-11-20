import {__awaiter}from'tslib';import {ConnectionState}from'../../room/CoreRoom.mjs';import {RoomEvent}from'../../room/events.mjs';import {Checker}from'./Checker.mjs';class ReconnectCheck extends Checker {
  get description() {
    return 'Resuming connection after interruption';
  }
  perform() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      const room = yield this.connect();
      let reconnectingTriggered = false;
      let reconnected = false;
      let reconnectResolver;
      const reconnectTimeout = new Promise(resolve => {
        setTimeout(resolve, 5000);
        reconnectResolver = resolve;
      });
      const handleReconnecting = () => {
        reconnectingTriggered = true;
      };
      room.on(RoomEvent.SignalReconnecting, handleReconnecting).on(RoomEvent.Reconnecting, handleReconnecting).on(RoomEvent.Reconnected, () => {
        reconnected = true;
        reconnectResolver(true);
      });
      (_a = room.engine.client.ws) === null || _a === void 0 ? void 0 : _a.close();
      const onClose = room.engine.client.onClose;
      if (onClose) {
        onClose('');
      }
      yield reconnectTimeout;
      if (!reconnectingTriggered) {
        throw new Error('Did not attempt to reconnect');
      } else if (!reconnected || room.state !== ConnectionState.Connected) {
        this.appendWarning('reconnection is only possible in Redis-based configurations');
        throw new Error('Not able to reconnect');
      }
    });
  }
}export{ReconnectCheck};//# sourceMappingURL=reconnect.mjs.map
