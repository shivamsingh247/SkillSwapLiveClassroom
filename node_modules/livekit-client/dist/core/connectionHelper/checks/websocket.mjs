import {__awaiter}from'tslib';import {ServerInfo_Edition}from'@livekit/protocol';import {SignalClient}from'../../api/SignalClient.mjs';import {RegionUrlProvider}from'../../room/RegionUrlProvider.mjs';import {isCloud}from'../../room/utils.mjs';import {Checker}from'./Checker.mjs';class WebSocketCheck extends Checker {
  get description() {
    return 'Connecting to signal connection via WebSocket';
  }
  perform() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c;
      if (this.url.startsWith('ws:') || this.url.startsWith('http:')) {
        this.appendWarning('Server is insecure, clients may block connections to it');
      }
      let signalClient = new SignalClient();
      let joinRes;
      try {
        joinRes = yield signalClient.join(this.url, this.token, {
          autoSubscribe: true,
          maxRetries: 0,
          e2eeEnabled: false,
          websocketTimeout: 15000
        }, undefined, true);
      } catch (e) {
        if (isCloud(new URL(this.url))) {
          this.appendMessage("Initial connection failed with error ".concat(e.message, ". Retrying with region fallback"));
          const regionProvider = new RegionUrlProvider(this.url, this.token);
          const regionUrl = yield regionProvider.getNextBestRegionUrl();
          if (regionUrl) {
            joinRes = yield signalClient.join(regionUrl, this.token, {
              autoSubscribe: true,
              maxRetries: 0,
              e2eeEnabled: false,
              websocketTimeout: 15000
            }, undefined, true);
            this.appendMessage("Fallback to region worked. To avoid initial connections failing, ensure you're calling room.prepareConnection() ahead of time");
          }
        }
      }
      if (joinRes) {
        this.appendMessage("Connected to server, version ".concat(joinRes.serverVersion, "."));
        if (((_a = joinRes.serverInfo) === null || _a === void 0 ? void 0 : _a.edition) === ServerInfo_Edition.Cloud && ((_b = joinRes.serverInfo) === null || _b === void 0 ? void 0 : _b.region)) {
          this.appendMessage("LiveKit Cloud: ".concat((_c = joinRes.serverInfo) === null || _c === void 0 ? void 0 : _c.region));
        }
      } else {
        this.appendError("Websocket connection could not be established");
      }
      yield signalClient.close();
    });
  }
}export{WebSocketCheck};//# sourceMappingURL=websocket.mjs.map
