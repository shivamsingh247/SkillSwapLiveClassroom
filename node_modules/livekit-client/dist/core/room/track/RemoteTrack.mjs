import {__awaiter}from'tslib';import {TrackEvent}from'../events.mjs';import {monitorFrequency}from'../stats.mjs';import {Track}from'./Track.mjs';import {supportsSynchronizationSources}from'./utils.mjs';class RemoteTrack extends Track {
  constructor(mediaTrack, sid, kind, receiver, loggerOptions) {
    super(mediaTrack, kind, loggerOptions);
    this.timeSyncLoop = () => {
      var _a;
      if (this.listenerCount(TrackEvent.TimeSyncUpdate) === 0) {
        // nobody is listening anymore, pause the loop until a new listener subscribes
        this.timeSyncHandle = undefined;
        return;
      }
      this.timeSyncHandle = requestAnimationFrame(this.timeSyncLoop);
      const sources = (_a = this.receiver) === null || _a === void 0 ? void 0 : _a.getSynchronizationSources()[0];
      if (sources) {
        const timestamp = sources.timestamp,
          rtpTimestamp = sources.rtpTimestamp;
        if (rtpTimestamp && this.rtpTimestamp !== rtpTimestamp) {
          this.emit(TrackEvent.TimeSyncUpdate, {
            timestamp,
            rtpTimestamp
          });
          this.rtpTimestamp = rtpTimestamp;
        }
      }
    };
    this.onTimeSyncListenerAdded = event => {
      if (event === TrackEvent.TimeSyncUpdate && this.timeSyncHandle === undefined) {
        // `newListener` fires before the listener is registered, so schedule the
        // next frame instead of entering the loop (which would see a count of 0)
        this.timeSyncHandle = requestAnimationFrame(this.timeSyncLoop);
      }
    };
    this.sid = sid;
    this.receiver = receiver;
  }
  get isLocal() {
    return false;
  }
  /** @internal */
  setMuted(muted) {
    if (this.isMuted !== muted) {
      this.isMuted = muted;
      this._mediaStreamTrack.enabled = !muted;
      this.emit(muted ? TrackEvent.Muted : TrackEvent.Unmuted, this);
    }
  }
  /** @internal */
  setMediaStream(stream) {
    // this is needed to determine when the track is finished
    this.mediaStream = stream;
    const onRemoveTrack = event => {
      if (event.track === this._mediaStreamTrack) {
        stream.removeEventListener('removetrack', onRemoveTrack);
        if (this.receiver && 'playoutDelayHint' in this.receiver) {
          this.receiver.playoutDelayHint = undefined;
        }
        this.receiver = undefined;
        this._currentBitrate = 0;
        this.emit(TrackEvent.Ended, this);
      }
    };
    stream.addEventListener('removetrack', onRemoveTrack);
  }
  start() {
    this.startMonitor();
    // use `enabled` of track to enable re-use of transceiver
    super.enable();
  }
  stop() {
    this.stopMonitor();
    // use `enabled` of track to enable re-use of transceiver
    super.disable();
  }
  /**
   * Gets the RTCStatsReport for the RemoteTrack's underlying RTCRtpReceiver
   * See https://developer.mozilla.org/en-US/docs/Web/API/RTCStatsReport
   *
   * @returns Promise<RTCStatsReport> | undefined
   */
  getRTCStatsReport() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      if (!((_a = this.receiver) === null || _a === void 0 ? void 0 : _a.getStats)) {
        return;
      }
      const statsReport = yield this.receiver.getStats();
      return statsReport;
    });
  }
  /**
   * Allows to set a playout delay (in seconds) for this track.
   * A higher value allows for more buffering of the track in the browser
   * and will result in a delay of media being played back of `delayInSeconds`
   */
  setPlayoutDelay(delayInSeconds) {
    if (this.receiver) {
      if ('playoutDelayHint' in this.receiver) {
        this.receiver.playoutDelayHint = delayInSeconds;
      } else {
        this.log.warn('Playout delay not supported in this browser');
      }
    } else {
      this.log.warn('Cannot set playout delay, track already ended');
    }
  }
  /**
   * Returns the current playout delay (in seconds) of this track.
   */
  getPlayoutDelay() {
    if (this.receiver) {
      if ('playoutDelayHint' in this.receiver) {
        return this.receiver.playoutDelayHint;
      } else {
        this.log.warn('Playout delay not supported in this browser');
      }
    } else {
      this.log.warn('Cannot get playout delay, track already ended');
    }
    return 0;
  }
  /* @internal */
  startMonitor() {
    if (!this.monitorInterval) {
      this.monitorInterval = setInterval(() => this.monitorReceiver(), monitorFrequency);
    }
    if (supportsSynchronizationSources()) {
      this.registerTimeSyncUpdate();
    }
  }
  /* @internal */
  stopMonitor() {
    super.stopMonitor();
    this.off('newListener', this.onTimeSyncListenerAdded);
  }
  registerTimeSyncUpdate() {
    // `newListener` isn't part of the typed event map, hence the cast
    const emitter = this;
    emitter.off('newListener', this.onTimeSyncListenerAdded);
    emitter.on('newListener', this.onTimeSyncListenerAdded);
    if (this.timeSyncHandle === undefined) {
      this.timeSyncLoop();
    }
  }
}export{RemoteTrack as default};//# sourceMappingURL=RemoteTrack.mjs.map
