import {__awaiter}from'tslib';import {RegionUrlProvider}from'../../room/RegionUrlProvider.mjs';import {Checker}from'./Checker.mjs';/**
 * Checks for connections quality to closests Cloud regions and determining the best quality
 */
class CloudRegionCheck extends Checker {
  get description() {
    return 'Cloud regions';
  }
  perform() {
    return __awaiter(this, void 0, void 0, function* () {
      const regionProvider = new RegionUrlProvider(this.url, this.token);
      if (!regionProvider.isCloud()) {
        this.skip();
        return;
      }
      const regionStats = [];
      const seenUrls = new Set();
      for (let i = 0; i < 3; i++) {
        const regionUrl = yield regionProvider.getNextBestRegionUrl();
        if (!regionUrl) {
          break;
        }
        if (seenUrls.has(regionUrl)) {
          continue;
        }
        seenUrls.add(regionUrl);
        const stats = yield this.checkCloudRegion(regionUrl);
        this.appendMessage("".concat(stats.region, " RTT: ").concat(stats.rtt, "ms, duration: ").concat(stats.duration, "ms"));
        regionStats.push(stats);
      }
      regionStats.sort((a, b) => {
        return (a.duration - b.duration) * 0.5 + (a.rtt - b.rtt) * 0.5;
      });
      const bestRegion = regionStats[0];
      this.bestStats = bestRegion;
      this.appendMessage("best Cloud region: ".concat(bestRegion.region));
    });
  }
  getInfo() {
    const info = super.getInfo();
    info.data = this.bestStats;
    return info;
  }
  checkCloudRegion(url) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b;
      yield this.connect(url);
      if (this.options.protocol === 'tcp') {
        yield this.switchProtocol('tcp');
      }
      const region = (_a = this.room.serverInfo) === null || _a === void 0 ? void 0 : _a.region;
      if (!region) {
        throw new Error('Region not found');
      }
      const writer = yield this.room.localParticipant.streamText({
        topic: 'test'
      });
      const chunkSize = 1000; // each chunk is about 1000 bytes
      const totalSize = 1000000; // approximately 1MB of data
      const numChunks = totalSize / chunkSize; // will yield 1000 chunks
      const chunkData = 'A'.repeat(chunkSize); // create a string of 1000 'A' characters
      const startTime = Date.now();
      for (let i = 0; i < numChunks; i++) {
        yield writer.write(chunkData);
      }
      yield writer.close();
      const endTime = Date.now();
      const stats = yield (_b = this.room.engine.pcManager) === null || _b === void 0 ? void 0 : _b.publisher.getStats();
      const regionStats = {
        region: region,
        rtt: 10000,
        duration: endTime - startTime
      };
      stats === null || stats === void 0 ? void 0 : stats.forEach(stat => {
        if (stat.type === 'candidate-pair' && stat.nominated) {
          regionStats.rtt = stat.currentRoundTripTime * 1000;
        }
      });
      yield this.disconnect();
      return regionStats;
    });
  }
}export{CloudRegionCheck};//# sourceMappingURL=cloudRegion.mjs.map
