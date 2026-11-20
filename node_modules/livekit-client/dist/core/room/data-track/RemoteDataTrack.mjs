import {slicedToArray as _slicedToArray}from'../../_virtual/_rollupPluginBabelHelpers.mjs';import'./packet/extensions.mjs';import {TrackSymbol,DataTrackSymbol}from'./track-interfaces.mjs';import'@livekit/protocol';import'./handle.mjs';class RemoteDataTrack {
  /** @internal */
  constructor(info, manager, options) {
    this.trackSymbol = TrackSymbol;
    this.isLocal = false;
    this.typeSymbol = DataTrackSymbol;
    this.info = info;
    this.manager = manager;
    this.publisherIdentity = options.publisherIdentity;
  }
  /** Subscribes to the data track to receive frames.
   *
   * # Returns
   *
   * A stream that yields {@link DataTrackFrame}s as they arrive.
   *
   * # Multiple Subscriptions
   *
   * An application may call `subscribe` more than once to process frames in
   * multiple places. For example, one async task might plot values on a graph
   * while another writes them to a file.
   *
   * Internally, only the first call to `subscribe` communicates with the SFU and
   * allocates the resources required to receive frames. Additional subscriptions
   * reuse the same underlying pipeline and do not trigger additional signaling.
   *
   * Note that newly created subscriptions only receive frames published after
   * the initial subscription is established.
   */
  subscribe(options) {
    try {
      const _this$manager$openSub = this.manager.openSubscriptionStream(this.info.sid, options === null || options === void 0 ? void 0 : options.signal, options === null || options === void 0 ? void 0 : options.bufferSize),
        _this$manager$openSub2 = _slicedToArray(_this$manager$openSub, 2),
        stream = _this$manager$openSub2[0],
        sfuSubscriptionComplete = _this$manager$openSub2[1];
      // Prevent uncaught promise rejections from bubbling up if rejections occur after the
      // readable stream is discarded.
      sfuSubscriptionComplete.catch(() => {});
      return stream;
    } catch (err) {
      // NOTE: Rethrow errors to break Throws<...> type boundary
      throw err;
    }
  }
  /** Configure how incoming frames for this track are processed before they are handed out to
   * subscribers (the "pipeline"). These options apply to all current and future subscriptions
   * of this track, and may be set at any time. */
  setPipelineOptions(options) {
    this.manager.setPipelineOptions(this.info.sid, options);
  }
}export{RemoteDataTrack as default};//# sourceMappingURL=RemoteDataTrack.mjs.map
