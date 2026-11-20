import {__awaiter}from'tslib';import {SignalClient}from'../../api/SignalClient.mjs';import {RegionUrlProvider}from'../../room/RegionUrlProvider.mjs';import {isCloud}from'../../room/utils.mjs';import {Checker}from'./Checker.mjs';class TURNCheck extends Checker {
  get description() {
    return 'Can connect via TURN';
  }
  perform() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c;
      if (isCloud(new URL(this.url))) {
        this.appendMessage('Using region specific url');
        this.url = (_a = yield new RegionUrlProvider(this.url, this.token).getNextBestRegionUrl()) !== null && _a !== void 0 ? _a : this.url;
      }
      const signalClient = new SignalClient();
      const joinRes = yield signalClient.join(this.url, this.token, {
        autoSubscribe: true,
        maxRetries: 0,
        e2eeEnabled: false,
        websocketTimeout: 15000
      }, undefined, true);
      let hasTLS = false;
      let hasTURN = false;
      let hasSTUN = false;
      for (let iceServer of joinRes.iceServers) {
        for (let url of iceServer.urls) {
          if (url.startsWith('turn:')) {
            hasTURN = true;
            hasSTUN = true;
          } else if (url.startsWith('turns:')) {
            hasTURN = true;
            hasSTUN = true;
            hasTLS = true;
          }
          if (url.startsWith('stun:')) {
            hasSTUN = true;
          }
        }
      }
      if (!hasSTUN) {
        this.appendWarning('No STUN servers configured on server side.');
      } else if (hasTURN && !hasTLS) {
        this.appendWarning('TURN is configured server side, but TURN/TLS is unavailable.');
      }
      yield signalClient.close();
      if (((_c = (_b = this.connectOptions) === null || _b === void 0 ? void 0 : _b.rtcConfig) === null || _c === void 0 ? void 0 : _c.iceServers) || hasTURN) {
        yield this.room.connect(this.url, this.token, {
          rtcConfig: {
            iceTransportPolicy: 'relay'
          }
        });
      } else {
        this.appendWarning('No TURN servers configured.');
        this.skip();
        yield new Promise(resolve => setTimeout(resolve, 0));
      }
    });
  }
}export{TURNCheck};//# sourceMappingURL=turn.mjs.map
