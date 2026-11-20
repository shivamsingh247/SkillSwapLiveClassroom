import {__awaiter}from'tslib';import livekitLogger,{getLogger,LoggerNames}from'../../logger.mjs';import {Future}from'../utils.mjs';import {DataTrackFrameInternal}from'./frame.mjs';import {DataTrackPushFrameError}from'./outgoing/errors.mjs';import {TrackSymbol,DataTrackSymbol}from'./track-interfaces.mjs';class LocalDataTrack {
  /** @internal */
  constructor(options, manager) {
    this.trackSymbol = TrackSymbol;
    this.isLocal = true;
    this.typeSymbol = DataTrackSymbol;
    /** Represents the currently active {@link DataTrackHandle} for the publication. */
    this.handle = null;
    this.log = livekitLogger;
    /** Resolves once the data track has sent all pending packets the rtc data channel buffer. */
    this.flushedFuture = new Future();
    this.isFlushed = true;
    this.handleManagerReset = () => {
      var _a, _b;
      // When the associated manager resets, mark any in flight flushes as complete
      // There's nothing actionable a user can do to get these to complete so no
      // error is being thrown.
      (_b = (_a = this.flushedFuture).resolve) === null || _b === void 0 ? void 0 : _b.call(_a);
      this.manager.off('packetsFlushedChange', this.handleManagerPacketsFlushedChange);
      this.manager.off('reset', this.handleManagerReset);
    };
    this.handleManagerPacketsFlushedChange = event => {
      var _a, _b;
      this.isFlushed = event.isFlushed;
      if (event.isFlushed) {
        (_b = (_a = this.flushedFuture).resolve) === null || _b === void 0 ? void 0 : _b.call(_a);
        this.flushedFuture = new Future();
      }
    };
    this.options = options;
    this.manager = manager;
    this.log = getLogger(LoggerNames.DataTracks);
    this.manager.on('packetsFlushedChange', this.handleManagerPacketsFlushedChange);
    this.manager.on('reset', this.handleManagerReset);
  }
  /** @internal */
  static withExplicitHandle(options, manager, handle) {
    const track = new LocalDataTrack(options, manager);
    track.handle = handle;
    return track;
  }
  /** Metrics about the data track publication. */
  get info() {
    const descriptor = this.descriptor;
    if ((descriptor === null || descriptor === void 0 ? void 0 : descriptor.type) === 'active') {
      return descriptor.info;
    } else {
      return undefined;
    }
  }
  /** The raw descriptor from the manager containing the internal state for this local track. */
  get descriptor() {
    return this.handle ? this.manager.getDescriptor(this.handle) : null;
  }
  /**
   * Publish the track to the SFU. This must be done before calling {@link tryPush} for the first time.
   * @internal
   * */
  publish(signal) {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        this.handle = yield this.manager.publishRequest(this.options, signal);
      } catch (err) {
        // NOTE: Rethrow errors to break Throws<...> type boundary
        throw err;
      }
    });
  }
  isPublished() {
    var _a;
    // NOTE: a track which is internally in the "resubscribing" state is still considered
    // published from the public API perspective.
    return ((_a = this.descriptor) === null || _a === void 0 ? void 0 : _a.type) === 'active' && this.descriptor.publishState !== 'unpublished';
  }
  /** Try pushing a frame to subscribers of the track.
   *
   * Pushing a frame can fail for several reasons:
   *
   * - The track has been unpublished by the local participant or SFU
   * - The room is no longer connected
   */
  tryPush(frame) {
    if (!this.handle) {
      throw DataTrackPushFrameError.trackUnpublished();
    }
    const internalFrame = DataTrackFrameInternal.from(frame);
    try {
      return this.manager.tryProcessAndSend(this.handle, internalFrame);
    } catch (err) {
      // NOTE: wrapping in the bare try/catch like this means that the Throws<...> type doesn't
      // propagate upwards into the public interface.
      throw err;
    }
  }
  /**
   * When called, waits for all in flight packets to be sent before resolving.
   *
   * Use this to:
   *
   * 1. Send frames exactly in order:
   * ```ts
   * await track.tryPush(/* ... *\/);
   * await track.flush();
   * await track.tryPush(/* ... *\/);
   * await track.flush();
   * // ... etc ...
   * ```
   *
   * 2. Wait for frames to all be delivered before unpublishing a local data track:
   *
   * ```ts
   * await track.tryPush(/* ... *\/);
   * await track.tryPush(/* ... *\/);
   * await track.tryPush(/* ... *\/);
   * // ... etc ...
   * await track.flush();
   * await track.unpublish();
   * ```
   **/
  flush() {
    return __awaiter(this, void 0, void 0, function* () {
      if (this.isFlushed) {
        return;
      }
      return this.flushedFuture.promise;
    });
  }
  /**
   * Unpublish the track from the SFU. Once this is called, any further calls to {@link tryPush}
   * will fail.
   * */
  unpublish() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.handle) {
        livekitLogger.warn("Data track \"".concat(this.options.name, "\" is not published, so unpublishing has no effect."));
        return;
      }
      try {
        yield this.manager.unpublishRequest(this.handle);
      } catch (err) {
        // NOTE: Rethrow errors to break Throws<...> type boundary
        throw err;
      }
    });
  }
}export{LocalDataTrack as default};//# sourceMappingURL=LocalDataTrack.mjs.map
