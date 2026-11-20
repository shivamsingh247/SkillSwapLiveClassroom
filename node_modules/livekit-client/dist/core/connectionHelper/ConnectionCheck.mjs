import {__awaiter}from'tslib';import {EventEmitter}from'events';import {CheckStatus}from'./checks/Checker.mjs';import {CloudRegionCheck}from'./checks/cloudRegion.mjs';import {ConnectionProtocolCheck}from'./checks/connectionProtocol.mjs';import {PublishAudioCheck}from'./checks/publishAudio.mjs';import {PublishVideoCheck}from'./checks/publishVideo.mjs';import {ReconnectCheck}from'./checks/reconnect.mjs';import {TURNCheck}from'./checks/turn.mjs';import {WebRTCCheck}from'./checks/webrtc.mjs';import {WebSocketCheck}from'./checks/websocket.mjs';class ConnectionCheck extends EventEmitter {
  constructor(url, token) {
    let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    super();
    this.options = {};
    this.checkResults = new Map();
    this.url = url;
    this.token = token;
    this.options = options;
  }
  getNextCheckId() {
    const nextId = this.checkResults.size;
    this.checkResults.set(nextId, {
      logs: [],
      status: CheckStatus.IDLE,
      name: '',
      description: ''
    });
    return nextId;
  }
  updateCheck(checkId, info) {
    this.checkResults.set(checkId, info);
    this.emit('checkUpdate', checkId, info);
  }
  isSuccess() {
    return Array.from(this.checkResults.values()).every(r => r.status !== CheckStatus.FAILED);
  }
  getResults() {
    return Array.from(this.checkResults.values());
  }
  createAndRunCheck(check) {
    return __awaiter(this, void 0, void 0, function* () {
      const checkId = this.getNextCheckId();
      const test = new check(this.url, this.token, this.options);
      const handleUpdate = info => {
        this.updateCheck(checkId, info);
      };
      test.on('update', handleUpdate);
      const result = yield test.run();
      test.off('update', handleUpdate);
      return result;
    });
  }
  checkWebsocket() {
    return __awaiter(this, void 0, void 0, function* () {
      return this.createAndRunCheck(WebSocketCheck);
    });
  }
  checkWebRTC() {
    return __awaiter(this, void 0, void 0, function* () {
      return this.createAndRunCheck(WebRTCCheck);
    });
  }
  checkTURN() {
    return __awaiter(this, void 0, void 0, function* () {
      return this.createAndRunCheck(TURNCheck);
    });
  }
  checkReconnect() {
    return __awaiter(this, void 0, void 0, function* () {
      return this.createAndRunCheck(ReconnectCheck);
    });
  }
  checkPublishAudio() {
    return __awaiter(this, void 0, void 0, function* () {
      return this.createAndRunCheck(PublishAudioCheck);
    });
  }
  checkPublishVideo() {
    return __awaiter(this, void 0, void 0, function* () {
      return this.createAndRunCheck(PublishVideoCheck);
    });
  }
  checkConnectionProtocol() {
    return __awaiter(this, void 0, void 0, function* () {
      const info = yield this.createAndRunCheck(ConnectionProtocolCheck);
      if (info.data && 'protocol' in info.data) {
        const stats = info.data;
        this.options.protocol = stats.protocol;
      }
      return info;
    });
  }
  checkCloudRegion() {
    return __awaiter(this, void 0, void 0, function* () {
      return this.createAndRunCheck(CloudRegionCheck);
    });
  }
}export{CheckStatus,ConnectionCheck};//# sourceMappingURL=ConnectionCheck.mjs.map
