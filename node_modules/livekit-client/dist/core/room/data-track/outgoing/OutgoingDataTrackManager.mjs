import {slicedToArray as _slicedToArray}from'../../../_virtual/_rollupPluginBabelHelpers.mjs';import {__awaiter,__asyncValues}from'tslib';import {EventEmitter}from'events';import {getLogger,LoggerNames}from'../../../logger.mjs';import {abortSignalTimeout,abortSignalAny}from'../../../utils/abort-signal-polyfill.mjs';import {Future}from'../../utils.mjs';import LocalDataTrack from'../LocalDataTrack.mjs';import {DataTrackHandleAllocator}from'../handle.mjs';import'@livekit/protocol';import {DataTrackPushFrameError,DataTrackPublishError}from'./errors.mjs';import DataTrackOutgoingPipeline from'./pipeline.mjs';const log = /* @__PURE__ */getLogger(LoggerNames.DataTracks);
const Descriptor = {
  pending() {
    return {
      type: 'pending',
      completionFuture: new Future()
    };
  },
  active(info, e2eeManager) {
    return {
      type: 'active',
      info,
      publishState: 'published',
      pipeline: new DataTrackOutgoingPipeline({
        info,
        e2eeManager
      }),
      unpublishingFuture: new Future()
    };
  }
};
/** How long to wait when attempting to publish before timing out. */
const PUBLISH_TIMEOUT_MILLISECONDS = 10000;
class OutgoingDataTrackManager extends EventEmitter {
  constructor(options) {
    var _a;
    super();
    this.handleAllocator = new DataTrackHandleAllocator();
    this.descriptors = new Map();
    /** Number of packets for each data track which have been emitted via the `packetAvailable` event
     * and which have not yet been sent via the rtc data channel yet. Once this goes to 0, then
     * all in flight packets have been delivered, and the data tracks is "flushed". */
    this.inFlightPacketCounter = new Map();
    this.e2eeManager = (_a = options === null || options === void 0 ? void 0 : options.e2eeManager) !== null && _a !== void 0 ? _a : null;
  }
  static withDescriptors(descriptors) {
    const manager = new OutgoingDataTrackManager();
    manager.descriptors = descriptors;
    return manager;
  }
  /** @internal */
  updateE2eeManager(e2eeManager) {
    this.e2eeManager = e2eeManager;
    // Propegate downwards to all pre-existing pipelines
    for (const descriptor of this.descriptors.values()) {
      if (descriptor.type === 'active') {
        descriptor.pipeline.updateE2eeManager(e2eeManager);
      }
    }
  }
  /**
   * Used by attached {@link LocalDataTrack} instances to query their associated descriptor info.
   * @internal
   */
  getDescriptor(handle) {
    var _a;
    return (_a = this.descriptors.get(handle)) !== null && _a !== void 0 ? _a : null;
  }
  /** Used by attached {@link LocalDataTrack} instances to broadcast data track packets to other
   * subscribers.
   * @internal
   */
  tryProcessAndSend(handle, frame) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, e_1, _b, _c;
      var _d;
      const descriptor = this.getDescriptor(handle);
      if ((descriptor === null || descriptor === void 0 ? void 0 : descriptor.type) !== 'active') {
        throw DataTrackPushFrameError.trackUnpublished();
      }
      if (descriptor.publishState === 'unpublished') {
        throw DataTrackPushFrameError.trackUnpublished();
      }
      if (descriptor.publishState === 'republishing') {
        throw DataTrackPushFrameError.dropped('Data track republishing');
      }
      try {
        try {
          for (var _e = true, _f = __asyncValues(descriptor.pipeline.processFrame(frame)), _g; _g = yield _f.next(), _a = _g.done, !_a; _e = true) {
            _c = _g.value;
            _e = false;
            const packet = _c;
            const prev = (_d = this.inFlightPacketCounter.get(handle)) !== null && _d !== void 0 ? _d : 0;
            this.inFlightPacketCounter.set(handle, prev + 1);
            if (prev === 0) {
              // A new packet has been sent, so there are now packets in the rtc data channel buffer for
              // this data track frame
              this.emit('packetsFlushedChange', {
                handle,
                isFlushed: false
              });
            }
            this.emit('packetAvailable', {
              handle,
              bytes: packet.toBinary()
            });
          }
        } catch (e_1_1) {
          e_1 = {
            error: e_1_1
          };
        } finally {
          try {
            if (!_e && !_a && (_b = _f.return)) yield _b.call(_f);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
      } catch (err) {
        // NOTE: In the rust implementation this "dropped" error means something different (not enough room
        // in the track mpsc channel)
        throw DataTrackPushFrameError.dropped(err);
      }
    });
  }
  /** The client has sent a packet over the rtc data channel. This signal is used for determining
   * once all packets are sent and a data track has been "flushed".
   *
   * @internal */
  handlePacketSendComplete(handle) {
    var _a;
    const prev = (_a = this.inFlightPacketCounter.get(handle)) !== null && _a !== void 0 ? _a : 0;
    let counter = prev - 1;
    if (counter < 0) {
      log.warn("OutgoingDataTrackManager.handlePacketSendComplete: inFlightPacketCounter was decremented below 0 (got ".concat(this.inFlightPacketCounter, " - resetting to 0. Were more packets send than were emitted?"));
      counter = 0;
    }
    this.inFlightPacketCounter.set(handle, counter);
    if (counter === 0) {
      this.emit('packetsFlushedChange', {
        handle,
        isFlushed: true
      });
    }
  }
  /**
   * Client requested to publish a track.
   *
   * If the LiveKit server is too old and doesn't support data tracks, a
   * {@link DataTrackPublishError#timeout} will be thrown.
   *
   * @internal
   **/
  publishRequest(options, signal) {
    return __awaiter(this, void 0, void 0, function* () {
      const handle = this.handleAllocator.get();
      if (!handle) {
        throw DataTrackPublishError.limitReached();
      }
      const timeoutSignal = abortSignalTimeout(PUBLISH_TIMEOUT_MILLISECONDS);
      const combinedSignal = signal ? abortSignalAny([signal, timeoutSignal]) : timeoutSignal;
      if (this.descriptors.has(handle)) {
        // @throws-transformer ignore - this should be treated as a "panic" and not be caught
        throw new Error('Descriptor for handle already exists');
      }
      const descriptor = Descriptor.pending();
      this.descriptors.set(handle, descriptor);
      const onAbort = () => {
        var _a, _b;
        const existingDescriptor = this.descriptors.get(handle);
        if (!existingDescriptor) {
          log.warn("No descriptor for ".concat(handle));
          return;
        }
        this.descriptors.delete(handle);
        // Let the SFU know that the publish has been cancelled
        this.emit('sfuUnpublishRequest', {
          handle
        });
        if (existingDescriptor.type === 'pending') {
          (_b = (_a = existingDescriptor.completionFuture).reject) === null || _b === void 0 ? void 0 : _b.call(_a, timeoutSignal.aborted ? DataTrackPublishError.timeout() :
          // NOTE: the below cancelled case was introduced by web / there isn't a corresponding case in the rust version.
          DataTrackPublishError.cancelled());
        }
      };
      if (combinedSignal.aborted) {
        onAbort(); // NOTE: this rejects `completionFuture`; the next line just returns the rejection
        return descriptor.completionFuture.promise.then(() => handle /* no-op, makes typescript happy */);
      }
      combinedSignal.addEventListener('abort', onAbort);
      this.emit('sfuPublishRequest', {
        handle,
        name: options.name,
        usesE2ee: this.e2eeManager !== null
      });
      yield descriptor.completionFuture.promise;
      combinedSignal.removeEventListener('abort', onAbort);
      this.emit('trackPublished', {
        track: LocalDataTrack.withExplicitHandle(options, this, handle)
      });
      return handle;
    });
  }
  /**
   * Get information about all currently published tracks.
   * @internal
   **/
  queryPublished() {
    const descriptorInfos = Array.from(this.descriptors.values()).filter(descriptor => descriptor.type === 'active').map(descriptor => descriptor.info);
    return descriptorInfos;
  }
  /**
   * Client request to unpublish a track.
   * @internal
   **/
  unpublishRequest(handle) {
    return __awaiter(this, void 0, void 0, function* () {
      const descriptor = this.descriptors.get(handle);
      if (!descriptor) {
        log.warn("No descriptor for ".concat(handle));
        return;
      }
      if (descriptor.type !== 'active') {
        log.warn("Track ".concat(handle, " not active"));
        return;
      }
      this.emit('sfuUnpublishRequest', {
        handle
      });
      yield descriptor.unpublishingFuture.promise;
      this.inFlightPacketCounter.delete(handle);
      this.emit('trackUnpublished', {
        sid: descriptor.info.sid
      });
    });
  }
  /**
   * SFU responded to a request to publish a data track.
   * @internal
   **/
  receivedSfuPublishResponse(handle, result) {
    var _a, _b, _c, _d;
    const descriptor = this.descriptors.get(handle);
    if (!descriptor) {
      log.warn("No descriptor for ".concat(handle));
      return;
    }
    this.descriptors.delete(handle);
    switch (descriptor.type) {
      case 'pending':
        {
          if (result.type === 'ok') {
            const info = result.data;
            log.debug("SFU accepted publish request for handle ".concat(handle), {
              sid: info.sid
            });
            const e2eeManager = info.usesE2ee ? this.e2eeManager : null;
            this.descriptors.set(info.pubHandle, Descriptor.active(info, e2eeManager));
            (_b = (_a = descriptor.completionFuture).resolve) === null || _b === void 0 ? void 0 : _b.call(_a);
          } else {
            log.debug("SFU rejected publish request for handle ".concat(handle), {
              error: result.error
            });
            (_d = (_c = descriptor.completionFuture).reject) === null || _d === void 0 ? void 0 : _d.call(_c, result.error);
          }
          return;
        }
      case 'active':
        {
          if (descriptor.publishState !== 'republishing') {
            log.warn("Track ".concat(handle, " already active"));
            return;
          }
          if (result.type === 'error') {
            log.warn("Republish failed for track ".concat(handle, ": ").concat(result.error));
            descriptor.publishState = 'unpublished';
            return;
          }
          log.debug("Track ".concat(handle, " republished"));
          descriptor.info.sid = result.data.sid;
          descriptor.publishState = 'published';
          this.descriptors.set(descriptor.info.pubHandle, descriptor);
        }
    }
  }
  /**
   * SFU notification that a track has been unpublished.
   * @internal
   **/
  receivedSfuUnpublishResponse(handle) {
    var _a, _b;
    const descriptor = this.descriptors.get(handle);
    if (!descriptor) {
      log.warn("No descriptor for ".concat(handle));
      return;
    }
    this.descriptors.delete(handle);
    if (descriptor.type !== 'active') {
      log.warn("Track ".concat(handle, " not active"));
      return;
    }
    descriptor.publishState = 'unpublished';
    (_b = (_a = descriptor.unpublishingFuture).resolve) === null || _b === void 0 ? void 0 : _b.call(_a);
  }
  /** Republish all tracks.
   *
   * This must be sent after a full reconnect in order for existing publications
   * to be recognized by the SFU. Each republished track will be assigned a new SID.
   * Tracks the SFU rejects are unpublished.
   * @internal
   */
  sfuWillRepublishTracks() {
    var _a, _b;
    for (const _ref of this.descriptors.entries()) {
      var _ref2 = _slicedToArray(_ref, 2);
      const handle = _ref2[0];
      const descriptor = _ref2[1];
      switch (descriptor.type) {
        case 'pending':
          // TODO: support republish for pending publications
          this.descriptors.delete(handle);
          (_b = (_a = descriptor.completionFuture).reject) === null || _b === void 0 ? void 0 : _b.call(_a, DataTrackPublishError.disconnected());
          break;
        case 'active':
          descriptor.publishState = 'republishing';
          this.emit('sfuPublishRequest', {
            handle: descriptor.info.pubHandle,
            name: descriptor.info.name,
            usesE2ee: descriptor.info.usesE2ee
          });
      }
    }
  }
  /**
   * Reset's the state of the manager and all associated tracks. Run on room disconnect to get
   * the manager ready for the next room connection.
   * @internal
   **/
  reset() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c, _d;
      this.handleAllocator.reset();
      for (const descriptor of this.descriptors.values()) {
        switch (descriptor.type) {
          case 'pending':
            (_b = (_a = descriptor.completionFuture).reject) === null || _b === void 0 ? void 0 : _b.call(_a, DataTrackPublishError.disconnected());
            break;
          case 'active':
            // Abandon any unpublishing descriptors that were in flight and assume they will get
            // cleaned up automatically with the connection shutdown.
            (_d = (_c = descriptor.unpublishingFuture).resolve) === null || _d === void 0 ? void 0 : _d.call(_c);
            yield this.unpublishRequest(descriptor.info.pubHandle);
            break;
        }
      }
      this.descriptors.clear();
      this.inFlightPacketCounter.clear();
      this.emit('reset');
    });
  }
}export{Descriptor,OutgoingDataTrackManager as default};//# sourceMappingURL=OutgoingDataTrackManager.mjs.map
