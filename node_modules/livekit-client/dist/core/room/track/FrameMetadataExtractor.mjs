const MAX_ENTRIES = 300;
/**
 * Caches frame metadata extracted from received video frames,
 * keyed by RTP timestamp so it can be looked up when the frame is displayed.
 *
 * Metadata is populated either by the frame metadata worker managed by
 * `FrameMetadataManager` (non-E2EE) or by the E2EE FrameCryptor worker
 * after decryption (E2EE).
 *
 * @experimental
 */
class FrameMetadataExtractor {
  constructor() {
    this.metadataMap = new Map();
    this.activeSsrc = 0;
  }
  storeMetadata(rtpTimestamp, ssrc, metadata) {
    // Simulcast layer switch: SSRC changed, flush stale entries from old layer.
    if (this.activeSsrc !== 0 && this.activeSsrc !== ssrc) {
      this.metadataMap.clear();
    }
    this.activeSsrc = ssrc;
    while (this.metadataMap.size >= MAX_ENTRIES) {
      const evicted = this.metadataMap.keys().next().value;
      this.metadataMap.delete(evicted);
    }
    this.metadataMap.set(rtpTimestamp, metadata);
  }
  lookupMetadata(rtpTimestamp) {
    return this.metadataMap.get(rtpTimestamp);
  }
  dispose() {
    this.metadataMap.clear();
    this.activeSsrc = 0;
  }
}export{FrameMetadataExtractor};//# sourceMappingURL=FrameMetadataExtractor.mjs.map
