import {__asyncGenerator,__await,__asyncDelegator,__asyncValues,__awaiter}from'tslib';import {DataTrackE2eeExtension}from'../packet/extensions.mjs';import'../packet/index.mjs';import DataTrackPacketizer,{DataTrackPacketizerError}from'../packetizer.mjs';import {DataTrackOutgoingPipelineError}from'./errors.mjs';/** Processes outgoing frames into final packets for distribution to the SFU. */
class DataTrackOutgoingPipeline {
  constructor(options) {
    this.e2eeManager = options.e2eeManager;
    this.packetizer = new DataTrackPacketizer(options.info.pubHandle, DataTrackOutgoingPipeline.TRANSPORT_MTU_BYTES);
  }
  updateE2eeManager(e2eeManager) {
    this.e2eeManager = e2eeManager;
  }
  processFrame(frame) {
    return __asyncGenerator(this, arguments, function* processFrame_1() {
      const encryptedFrame = yield __await(this.encryptIfNeeded(frame));
      try {
        yield __await(yield* __asyncDelegator(__asyncValues(this.packetizer.packetize(encryptedFrame))));
      } catch (error) {
        if (error instanceof DataTrackPacketizerError) {
          throw DataTrackOutgoingPipelineError.packetizer(error);
        }
        throw error;
      }
    });
  }
  encryptIfNeeded(frame) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.e2eeManager) {
        return frame;
      }
      let encryptedResult;
      try {
        encryptedResult = yield this.e2eeManager.encryptData(frame.payload);
      } catch (err) {
        throw DataTrackOutgoingPipelineError.encryption(err);
      }
      frame.payload = encryptedResult.payload;
      frame.extensions.e2ee = new DataTrackE2eeExtension(encryptedResult.keyIndex, encryptedResult.iv);
      return frame;
    });
  }
}
/** Maximum transmission unit (MTU) of the transport. */
DataTrackOutgoingPipeline.TRANSPORT_MTU_BYTES = 16000;export{DataTrackOutgoingPipeline as default};//# sourceMappingURL=pipeline.mjs.map
