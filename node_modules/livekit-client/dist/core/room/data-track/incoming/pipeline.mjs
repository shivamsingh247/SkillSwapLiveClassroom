import {__awaiter}from'tslib';import {getLogger,LoggerNames}from'../../../logger.mjs';import DataTrackDepacketizer from'../depacketizer.mjs';import'../packet/index.mjs';import'@livekit/protocol';import'../handle.mjs';const log = /* @__PURE__ */getLogger(LoggerNames.DataTracks);
/**
 * Pipeline for an individual data track subscription.
 */
class IncomingDataTrackPipeline {
  /**
   * Creates a new pipeline with the given options.
   */
  constructor(options) {
    var _a, _b;
    const hasProvider = options.e2eeManager !== null;
    if (options.info.usesE2ee !== hasProvider) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error('IncomingDataTrackPipeline: DataTrackInfo.usesE2ee must match presence of decryptionProvider');
    }
    const depacketizer = new DataTrackDepacketizer();
    this.publisherIdentity = options.publisherIdentity;
    this.e2eeManager = (_a = options.e2eeManager) !== null && _a !== void 0 ? _a : null;
    this.depacketizer = depacketizer;
    this.options = (_b = options.pipelineOptions) !== null && _b !== void 0 ? _b : {};
  }
  updateE2eeManager(e2eeManager) {
    this.e2eeManager = e2eeManager;
  }
  setOptions(options) {
    this.options = options;
  }
  processPacket(packet) {
    return __awaiter(this, void 0, void 0, function* () {
      const frame = this.depacketize(packet);
      if (!frame) {
        return null;
      }
      const decrypted = yield this.decryptIfNeeded(frame);
      if (!decrypted) {
        return null;
      }
      return decrypted;
    });
  }
  /**
   * Depacketize the given frame, log if a drop occurs.
   */
  depacketize(packet) {
    let frame;
    try {
      frame = this.depacketizer.push(packet, {
        throwOnInterruption: false,
        maxPartialFrames: this.options.maxPartialFrames
      });
    } catch (err) {
      // In a future version, use this to maintain drop statistics.
      // FIXME: is this a good idea?
      log.warn("Data frame depacketize error: ".concat(err));
      return null;
    }
    return frame;
  }
  /**
   * Decrypt the frame's payload if E2EE is enabled for this track.
   */
  decryptIfNeeded(frame) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b;
      const e2eeManager = this.e2eeManager;
      if (!e2eeManager) {
        return frame;
      }
      const e2ee = (_b = (_a = frame.extensions) === null || _a === void 0 ? void 0 : _a.e2ee) !== null && _b !== void 0 ? _b : null;
      if (!e2ee) {
        log.error('Missing E2EE meta');
        return null;
      }
      let result;
      try {
        result = yield e2eeManager.handleEncryptedData(frame.payload, e2ee.iv, this.publisherIdentity, e2ee.keyIndex);
      } catch (err) {
        log.error("Error decrypting packet: ".concat(err));
        return null;
      }
      frame.payload = result.payload;
      return frame;
    });
  }
}export{IncomingDataTrackPipeline as default};//# sourceMappingURL=pipeline.mjs.map
