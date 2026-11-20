import {PacketTrailerFeature}from'@livekit/protocol';import {isInsertableStreamSupported}from'../e2ee/utils.mjs';import {isScriptTransformSupportedForWorker}from'../room/utils.mjs';function shouldUseFrameMetadataScriptTransform() {
  return isScriptTransformSupportedForWorker();
}
function isFrameMetadataSupported(options) {
  return !!(options === null || options === void 0 ? void 0 : options.worker) && (isInsertableStreamSupported() || shouldUseFrameMetadataScriptTransform());
}
function hasFrameMetadataPublishOptions(options) {
  return !!((options === null || options === void 0 ? void 0 : options.timestamp) || (options === null || options === void 0 ? void 0 : options.frameId));
}
function getFrameMetadataFeatures(options) {
  const features = [];
  if (options === null || options === void 0 ? void 0 : options.timestamp) {
    features.push(PacketTrailerFeature.PTF_USER_TIMESTAMP);
  }
  if (options === null || options === void 0 ? void 0 : options.frameId) {
    features.push(PacketTrailerFeature.PTF_FRAME_ID);
  }
  return features;
}
function getFrameMetadataPublishOptions(features) {
  if (!features || features.length === 0) {
    return undefined;
  }
  const options = {};
  if (features.includes(PacketTrailerFeature.PTF_USER_TIMESTAMP)) {
    options.timestamp = true;
  }
  if (features.includes(PacketTrailerFeature.PTF_FRAME_ID)) {
    options.frameId = true;
  }
  return options.timestamp || options.frameId ? options : undefined;
}
/** The requested frame metadata: `frameMetadata`, or the deprecated `packetTrailer`. */
function getPublishFrameMetadata(opts) {
  var _a;
  return (_a = opts === null || opts === void 0 ? void 0 : opts.frameMetadata) !== null && _a !== void 0 ? _a : opts === null || opts === void 0 ? void 0 : opts.packetTrailer;
}
/** Sets `frameMetadata` and the deprecated `packetTrailer` alike. */
function setPublishFrameMetadata(opts, value) {
  opts.frameMetadata = value;
  opts.packetTrailer = value;
}export{getFrameMetadataFeatures,getFrameMetadataPublishOptions,getPublishFrameMetadata,hasFrameMetadataPublishOptions,isFrameMetadataSupported,setPublishFrameMetadata,shouldUseFrameMetadataScriptTransform};//# sourceMappingURL=utils.mjs.map
