import {UpdateSubscription,ParticipantTracks,UpdateTrackSettings}from'@livekit/protocol';import {TrackEvent}from'../events.mjs';import {isRemoteVideoTrack}from'../utils.mjs';import {VideoQuality,Track}from'./Track.mjs';import {TrackPublication}from'./TrackPublication.mjs';import {areDimensionsSmaller,layerDimensionsFor}from'./utils.mjs';class RemoteTrackPublication extends TrackPublication {
  constructor(kind, ti, autoSubscribe, loggerOptions) {
    super(kind, ti.sid, ti.name, loggerOptions);
    this.track = undefined;
    /** @internal */
    this.allowed = true;
    this.requestedDisabled = undefined;
    this.visible = true;
    this.handleEnded = track => {
      this.setTrack(undefined);
      this.emit(TrackEvent.Ended, track);
    };
    this.handleVisibilityChange = visible => {
      this.log.debug("adaptivestream video visibility ".concat(this.trackSid, ", visible=").concat(visible), this.logContext);
      this.visible = visible;
      this.emitTrackUpdate();
    };
    this.handleVideoDimensionsChange = dimensions => {
      this.log.debug("adaptivestream video dimensions ".concat(dimensions.width, "x").concat(dimensions.height), this.logContext);
      this.videoDimensionsAdaptiveStream = dimensions;
      this.emitTrackUpdate();
    };
    this.subscribed = autoSubscribe;
    this.updateInfo(ti);
  }
  /**
   * Subscribe or unsubscribe to this remote track
   * @param subscribed true to subscribe to a track, false to unsubscribe
   */
  setSubscribed(subscribed) {
    const prevStatus = this.subscriptionStatus;
    const prevPermission = this.permissionStatus;
    this.subscribed = subscribed;
    // reset allowed status when desired subscription state changes
    // server will notify client via signal message if it's not allowed
    if (subscribed) {
      this.allowed = true;
    }
    const sub = new UpdateSubscription({
      trackSids: [this.trackSid],
      subscribe: this.subscribed,
      participantTracks: [new ParticipantTracks({
        // sending an empty participant id since TrackPublication doesn't keep it
        // this is filled in by the participant that receives this message
        participantSid: '',
        trackSids: [this.trackSid]
      })]
    });
    this.emit(TrackEvent.UpdateSubscription, sub);
    this.emitSubscriptionUpdateIfChanged(prevStatus);
    this.emitPermissionUpdateIfChanged(prevPermission);
  }
  get subscriptionStatus() {
    if (this.subscribed === false) {
      return TrackPublication.SubscriptionStatus.Unsubscribed;
    }
    if (!super.isSubscribed) {
      return TrackPublication.SubscriptionStatus.Desired;
    }
    return TrackPublication.SubscriptionStatus.Subscribed;
  }
  get permissionStatus() {
    return this.allowed ? TrackPublication.PermissionStatus.Allowed : TrackPublication.PermissionStatus.NotAllowed;
  }
  /**
   * Returns true if track is subscribed, and ready for playback
   */
  get isSubscribed() {
    if (this.subscribed === false) {
      return false;
    }
    return super.isSubscribed;
  }
  // returns client's desire to subscribe to a track, also true if autoSubscribe is enabled
  get isDesired() {
    return this.subscribed !== false;
  }
  get isEnabled() {
    return this.requestedDisabled !== undefined ? !this.requestedDisabled : this.isAdaptiveStream ? this.visible : true;
  }
  get isLocal() {
    return false;
  }
  /**
   * disable server from sending down data for this track. this is useful when
   * the participant is off screen, you may disable streaming down their video
   * to reduce bandwidth requirements
   * @param enabled
   */
  setEnabled(enabled) {
    if (!this.isManualOperationAllowed() || this.requestedDisabled === !enabled) {
      return;
    }
    this.requestedDisabled = !enabled;
    this.emitTrackUpdate();
  }
  /**
   * for tracks that support simulcasting, adjust subscribed quality
   *
   * This indicates the highest quality the client can accept. if network
   * bandwidth does not allow, server will automatically reduce quality to
   * optimize for uninterrupted video
   */
  setVideoQuality(quality) {
    if (!this.isManualOperationAllowed() || this.requestedMaxQuality === quality) {
      return;
    }
    this.requestedMaxQuality = quality;
    this.requestedVideoDimensions = undefined;
    this.emitTrackUpdate();
  }
  /**
   * Explicitly set the video dimensions for this track.
   *
   * With adaptive stream, the SDK requests the smaller of these and the adaptive stream dimensions
   * (by pixel count).
   * It clears a quality that was requested with `setVideoQuality()`.
   *
   * @param dimensions The video dimensions to set.
   */
  setVideoDimensions(dimensions) {
    var _a, _b;
    if (!this.isManualOperationAllowed()) {
      return;
    }
    if (((_a = this.requestedVideoDimensions) === null || _a === void 0 ? void 0 : _a.width) === dimensions.width && ((_b = this.requestedVideoDimensions) === null || _b === void 0 ? void 0 : _b.height) === dimensions.height) {
      return;
    }
    if (isRemoteVideoTrack(this.track)) {
      this.requestedVideoDimensions = dimensions;
    }
    this.requestedMaxQuality = undefined;
    this.emitTrackUpdate();
  }
  setVideoFPS(fps) {
    if (!this.isManualOperationAllowed()) {
      return;
    }
    if (!isRemoteVideoTrack(this.track)) {
      return;
    }
    if (this.fps === fps) {
      return;
    }
    this.fps = fps;
    this.emitTrackUpdate();
  }
  /**
   * The maximum video quality that was requested with `setVideoQuality()`.
   * When no quality was requested, it is `VideoQuality.HIGH`. `setVideoDimensions()` clears the
   * requested quality, so it is `VideoQuality.HIGH` after that call too.
   *
   * This value does not show the layer that the server sends. Adaptive stream and network
   * bandwidth can make the server send a lower layer, and this value does not change.
   *
   * @see `RemoteVideoTrack.getReceiverStats()` (`frameWidth` and `frameHeight`) for the size of
   * the video that the client receives.
   */
  get videoQuality() {
    var _a;
    return (_a = this.requestedMaxQuality) !== null && _a !== void 0 ? _a : VideoQuality.HIGH;
  }
  /** @internal */
  setTrack(track) {
    const prevStatus = this.subscriptionStatus;
    const prevPermission = this.permissionStatus;
    const prevTrack = this.track;
    if (prevTrack === track) {
      return;
    }
    if (prevTrack) {
      // unregister listener
      prevTrack.off(TrackEvent.VideoDimensionsChanged, this.handleVideoDimensionsChange);
      prevTrack.off(TrackEvent.VisibilityChanged, this.handleVisibilityChange);
      prevTrack.off(TrackEvent.Ended, this.handleEnded);
      prevTrack.detach();
      prevTrack.stopMonitor();
      this.emit(TrackEvent.Unsubscribed, prevTrack);
    }
    super.setTrack(track);
    if (track) {
      track.sid = this.trackSid;
      track.on(TrackEvent.VideoDimensionsChanged, this.handleVideoDimensionsChange);
      track.on(TrackEvent.VisibilityChanged, this.handleVisibilityChange);
      track.on(TrackEvent.Ended, this.handleEnded);
      this.emit(TrackEvent.Subscribed, track);
    }
    this.emitPermissionUpdateIfChanged(prevPermission);
    this.emitSubscriptionUpdateIfChanged(prevStatus);
  }
  /** @internal */
  setAllowed(allowed) {
    const prevStatus = this.subscriptionStatus;
    const prevPermission = this.permissionStatus;
    this.allowed = allowed;
    this.emitPermissionUpdateIfChanged(prevPermission);
    this.emitSubscriptionUpdateIfChanged(prevStatus);
  }
  /** @internal */
  setSubscriptionError(error) {
    this.emit(TrackEvent.SubscriptionFailed, error);
  }
  /** @internal */
  updateInfo(info) {
    super.updateInfo(info);
    const prevMetadataMuted = this.metadataMuted;
    this.metadataMuted = info.muted;
    if (this.track) {
      this.track.setMuted(info.muted);
    } else if (prevMetadataMuted !== info.muted) {
      this.emit(info.muted ? TrackEvent.Muted : TrackEvent.Unmuted);
    }
  }
  emitSubscriptionUpdateIfChanged(previousStatus) {
    const currentStatus = this.subscriptionStatus;
    if (previousStatus === currentStatus) {
      return;
    }
    this.emit(TrackEvent.SubscriptionStatusChanged, currentStatus, previousStatus);
  }
  emitPermissionUpdateIfChanged(previousPermissionStatus) {
    const currentPermissionStatus = this.permissionStatus;
    if (currentPermissionStatus !== previousPermissionStatus) {
      this.emit(TrackEvent.SubscriptionPermissionChanged, this.permissionStatus, previousPermissionStatus);
    }
  }
  isManualOperationAllowed() {
    if (!this.isDesired) {
      this.log.warn('cannot update track settings when not subscribed', this.logContext);
      return false;
    }
    return true;
  }
  get isAdaptiveStream() {
    return isRemoteVideoTrack(this.track) && this.track.isAdaptiveStream;
  }
  /* @internal */
  emitTrackUpdate() {
    const settings = new UpdateTrackSettings({
      trackSids: [this.trackSid],
      disabled: !this.isEnabled,
      fps: this.fps
    });
    if (this.kind === Track.Kind.Video) {
      let minDimensions = this.requestedVideoDimensions;
      if (this.videoDimensionsAdaptiveStream !== undefined) {
        if (minDimensions) {
          // check whether the adaptive stream dimensions are smaller than the requested dimensions and use smaller one
          const smallerAdaptive = areDimensionsSmaller(this.videoDimensionsAdaptiveStream, minDimensions);
          if (smallerAdaptive) {
            this.log.debug('using adaptive stream dimensions instead of requested', Object.assign(Object.assign({}, this.logContext), this.videoDimensionsAdaptiveStream));
            minDimensions = this.videoDimensionsAdaptiveStream;
          }
        } else if (this.requestedMaxQuality !== undefined && this.trackInfo) {
          // check whether adaptive stream dimensions are smaller than the max quality layer and use smaller one
          const maxQualityLayer = layerDimensionsFor(this.trackInfo, this.requestedMaxQuality);
          if (maxQualityLayer && areDimensionsSmaller(this.videoDimensionsAdaptiveStream, maxQualityLayer)) {
            this.log.debug('using adaptive stream dimensions instead of max quality layer', Object.assign(Object.assign({}, this.logContext), this.videoDimensionsAdaptiveStream));
            minDimensions = this.videoDimensionsAdaptiveStream;
          }
        } else {
          this.log.debug('using adaptive stream dimensions', Object.assign(Object.assign({}, this.logContext), this.videoDimensionsAdaptiveStream));
          minDimensions = this.videoDimensionsAdaptiveStream;
        }
      }
      if (minDimensions) {
        settings.width = Math.ceil(minDimensions.width);
        settings.height = Math.ceil(minDimensions.height);
      } else if (this.requestedMaxQuality !== undefined) {
        this.log.debug('using requested max quality', Object.assign(Object.assign({}, this.logContext), {
          quality: this.requestedMaxQuality
        }));
        settings.quality = this.requestedMaxQuality;
      } else {
        this.log.debug('using default quality', Object.assign(Object.assign({}, this.logContext), {
          quality: VideoQuality.HIGH
        }));
        // defaults to high quality
        settings.quality = VideoQuality.HIGH;
      }
    }
    this.emit(TrackEvent.UpdateSettings, settings);
  }
}export{RemoteTrackPublication as default};//# sourceMappingURL=RemoteTrackPublication.mjs.map
