import {__awaiter}from'tslib';import {EventEmitter}from'events';import {ConnectionState}from'../../room/CoreRoom.mjs';import {createRoom}from'../../room/createRoom.mjs';import {dataStreams}from'../../room/data-stream/extension.mjs';import {RoomEvent}from'../../room/events.mjs';import {sleep}from'../../room/utils.mjs';import {video}from'../../room/video/extension.mjs';// The checks need text streams (cloud region) and video publishing.
const createCheckRoom = options => createRoom(options, [dataStreams, video]);
var CheckStatus;
(function (CheckStatus) {
  CheckStatus[CheckStatus["IDLE"] = 0] = "IDLE";
  CheckStatus[CheckStatus["RUNNING"] = 1] = "RUNNING";
  CheckStatus[CheckStatus["SKIPPED"] = 2] = "SKIPPED";
  CheckStatus[CheckStatus["SUCCESS"] = 3] = "SUCCESS";
  CheckStatus[CheckStatus["FAILED"] = 4] = "FAILED";
})(CheckStatus || (CheckStatus = {}));
class Checker extends EventEmitter {
  constructor(url, token) {
    let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    super();
    this.status = CheckStatus.IDLE;
    this.logs = [];
    this.options = {};
    this.url = url;
    this.token = token;
    this.name = this.constructor.name;
    this.room = createCheckRoom(options.roomOptions);
    this.connectOptions = options.connectOptions;
    this.options = options;
  }
  run(onComplete) {
    return __awaiter(this, void 0, void 0, function* () {
      if (this.status !== CheckStatus.IDLE) {
        throw Error('check is running already');
      }
      this.setStatus(CheckStatus.RUNNING);
      try {
        yield this.perform();
      } catch (err) {
        if (err instanceof Error) {
          if (this.options.errorsAsWarnings) {
            this.appendWarning(err.message);
          } else {
            this.appendError(err.message);
          }
        }
      }
      yield this.disconnect();
      // sleep for a bit to ensure disconnect
      yield new Promise(resolve => setTimeout(resolve, 500));
      // @ts-ignore
      if (this.status !== CheckStatus.SKIPPED) {
        this.setStatus(this.isSuccess() ? CheckStatus.SUCCESS : CheckStatus.FAILED);
      }
      if (onComplete) {
        onComplete();
      }
      return this.getInfo();
    });
  }
  isSuccess() {
    return !this.logs.some(l => l.level === 'error');
  }
  connect(url) {
    return __awaiter(this, void 0, void 0, function* () {
      if (this.room.state === ConnectionState.Connected) {
        return this.room;
      }
      if (!url) {
        url = this.url;
      }
      yield this.room.connect(url, this.token, this.connectOptions);
      return this.room;
    });
  }
  disconnect() {
    return __awaiter(this, void 0, void 0, function* () {
      if (this.room && this.room.state !== ConnectionState.Disconnected) {
        yield this.room.disconnect();
        // wait for it to go through
        yield new Promise(resolve => setTimeout(resolve, 500));
      }
    });
  }
  skip() {
    this.setStatus(CheckStatus.SKIPPED);
  }
  switchProtocol(protocol) {
    return __awaiter(this, void 0, void 0, function* () {
      let hasReconnecting = false;
      let hasReconnected = false;
      this.room.on(RoomEvent.Reconnecting, () => {
        hasReconnecting = true;
      });
      this.room.once(RoomEvent.Reconnected, () => {
        hasReconnected = true;
      });
      this.room.simulateScenario("force-".concat(protocol));
      yield new Promise(resolve => setTimeout(resolve, 1000));
      if (!hasReconnecting) {
        // no need to wait for reconnection
        return;
      }
      // wait for 10 seconds for reconnection
      const timeout = Date.now() + 10000;
      while (Date.now() < timeout) {
        if (hasReconnected) {
          return;
        }
        yield sleep(100);
      }
      throw new Error("Could not reconnect using ".concat(protocol, " protocol after 10 seconds"));
    });
  }
  appendMessage(message) {
    this.logs.push({
      level: 'info',
      message
    });
    this.emit('update', this.getInfo());
  }
  appendWarning(message) {
    this.logs.push({
      level: 'warning',
      message
    });
    this.emit('update', this.getInfo());
  }
  appendError(message) {
    this.logs.push({
      level: 'error',
      message
    });
    this.emit('update', this.getInfo());
  }
  setStatus(status) {
    this.status = status;
    this.emit('update', this.getInfo());
  }
  get engine() {
    var _a;
    return (_a = this.room) === null || _a === void 0 ? void 0 : _a.engine;
  }
  getInfo() {
    return {
      logs: this.logs,
      name: this.name,
      status: this.status,
      description: this.description
    };
  }
}export{CheckStatus,Checker};//# sourceMappingURL=Checker.mjs.map
