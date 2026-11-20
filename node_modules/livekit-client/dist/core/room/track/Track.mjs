import {__awaiter}from'tslib';import {TrackType,TrackSource,StreamState}from'@livekit/protocol';import {EventEmitter}from'events';import livekitLogger,{getLogger,LoggerNames}from'../../logger.mjs';import {TrackEvent}from'../events.mjs';import {summarizeStatsReport}from'../statsSummary.mjs';import {isWeb,isSafari,isFireFox,isChromiumBased}from'../utils.mjs';import {getLogContextFromTrack}from'./utils.mjs';const BACKGROUND_REACTION_DELAY = 5000;
// keep old audio elements when detached, we would re-use them since on iOS
// Safari tracks which audio elements have been "blessed" by the user.
const recycledElements = [];
var VideoQuality;
(function (VideoQuality) {
  VideoQuality[VideoQuality["LOW"] = 0] = "LOW";
  VideoQuality[VideoQuality["MEDIUM"] = 1] = "MEDIUM";
  VideoQuality[VideoQuality["HIGH"] = 2] = "HIGH";
})(VideoQuality || (VideoQuality = {}));
class Track extends EventEmitter {
  /**
   * indicates current state of stream, it'll indicate `paused` if the track
   * has been paused by congestion controller
   */
  get streamState() {
    return this._streamState;
  }
  /** @internal */
  setStreamState(value) {
    if (this._streamState !== value) {
      this.log.debug("stream state changed: ".concat(this._streamState, " -> ").concat(value));
    }
    this._streamState = value;
  }
  constructor(mediaTrack, kind) {
    let loggerOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var _a;
    super();
    this.attachedElements = [];
    this.isMuted = false;
    this._streamState = Track.StreamState.Active;
    this.isInBackground = false;
    this._currentBitrate = 0;
    this.finalStatsLogged = false;
    this.log = livekitLogger;
    this.appVisibilityChangedListener = () => {
      if (this.backgroundTimeout) {
        clearTimeout(this.backgroundTimeout);
      }
      // delay app visibility update if it goes to hidden
      // update immediately if it comes back to focus
      if (document.visibilityState === 'hidden') {
        this.backgroundTimeout = setTimeout(() => this.handleAppVisibilityChanged(), BACKGROUND_REACTION_DELAY);
      } else {
        this.handleAppVisibilityChanged();
      }
    };
    this.loggerContextCb = loggerOptions.loggerContextCb;
    this.log = getLogger((_a = loggerOptions.loggerName) !== null && _a !== void 0 ? _a : LoggerNames.Track, () => this.logContext);
    this.setMaxListeners(100);
    this.kind = kind;
    this._mediaStreamTrack = mediaTrack;
    this._mediaStreamID = mediaTrack.id;
    this.source = Track.Source.Unknown;
  }
  get logContext() {
    var _a;
    return Object.assign(Object.assign({}, (_a = this.loggerContextCb) === null || _a === void 0 ? void 0 : _a.call(this)), getLogContextFromTrack(this));
  }
  /** current receive bits per second */
  get currentBitrate() {
    return this._currentBitrate;
  }
  get mediaStreamTrack() {
    return this._mediaStreamTrack;
  }
  /**
   * @internal
   * used for keep mediaStream's first id, since it's id might change
   * if we disable/enable a track
   */
  get mediaStreamID() {
    return this._mediaStreamID;
  }
  attach(element) {
    let elementType = 'audio';
    if (this.kind === Track.Kind.Video) {
      elementType = 'video';
    }
    if (this.attachedElements.length === 0 && this.kind === Track.Kind.Video) {
      this.addAppVisibilityListener();
    }
    if (!element) {
      if (elementType === 'audio') {
        recycledElements.forEach(e => {
          if (e.parentElement === null && !element) {
            element = e;
          }
        });
        if (element) {
          // remove it from pool
          recycledElements.splice(recycledElements.indexOf(element), 1);
        }
      }
      if (!element) {
        element = document.createElement(elementType);
      }
    }
    if (!this.attachedElements.includes(element)) {
      this.attachedElements.push(element);
    }
    // even if we believe it's already attached to the element, it's possible
    // the element's srcObject was set to something else out of band.
    // we'll want to re-attach it in that case
    attachToElement(this.mediaStreamTrack, element);
    // handle auto playback failures
    const allMediaStreamTracks = element.srcObject.getTracks();
    const hasAudio = allMediaStreamTracks.some(tr => tr.kind === 'audio');
    // manually play media to detect auto playback status
    element.play().then(() => {
      this.emit(hasAudio ? TrackEvent.AudioPlaybackStarted : TrackEvent.VideoPlaybackStarted);
    }).catch(e => {
      if (e.name === 'NotAllowedError') {
        this.emit(hasAudio ? TrackEvent.AudioPlaybackFailed : TrackEvent.VideoPlaybackFailed, e);
      } else if (e.name === 'AbortError') {
        // commonly triggered by another `play` request, only log for debugging purposes
        this.log.debug("".concat(hasAudio ? 'audio' : 'video', " playback aborted, likely due to new play request"));
      } else {
        this.log.warn("could not playback ".concat(hasAudio ? 'audio' : 'video'), {
          error: e
        });
      }
      // If audio playback isn't allowed make sure we still play back the video
      if (hasAudio && element && allMediaStreamTracks.some(tr => tr.kind === 'video') && e.name === 'NotAllowedError') {
        element.muted = true;
        element.play().catch(() => {
          // catch for Safari, exceeded options at this point to automatically play the media element
        });
      }
    });
    this.emit(TrackEvent.ElementAttached, element);
    return element;
  }
  detach(element) {
    try {
      // detach from a single element
      if (element) {
        detachTrack(this.mediaStreamTrack, element);
        const idx = this.attachedElements.indexOf(element);
        if (idx >= 0) {
          this.attachedElements.splice(idx, 1);
          this.recycleElement(element);
          this.emit(TrackEvent.ElementDetached, element);
        }
        return element;
      }
      const detached = [];
      this.attachedElements.forEach(elm => {
        detachTrack(this.mediaStreamTrack, elm);
        detached.push(elm);
        this.recycleElement(elm);
        this.emit(TrackEvent.ElementDetached, elm);
      });
      // remove all tracks
      this.attachedElements = [];
      return detached;
    } finally {
      if (this.attachedElements.length === 0) {
        this.removeAppVisibilityListener();
      }
    }
  }
  stop() {
    this.log.debug('stopping track');
    this.stopMonitor();
    this._mediaStreamTrack.stop();
  }
  enable() {
    this._mediaStreamTrack.enabled = true;
  }
  disable() {
    this._mediaStreamTrack.enabled = false;
  }
  /* @internal */
  stopMonitor() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    if (this.timeSyncHandle !== undefined) {
      cancelAnimationFrame(this.timeSyncHandle);
      this.timeSyncHandle = undefined;
    }
    this.logFinalStats();
  }
  /**
   * Dumps the raw stats of the track as it ends, once: a track that stops
   * between two of the room's stats dumps is gone by the time the next one runs.
   */
  logFinalStats() {
    if (this.finalStatsLogged) {
      return;
    }
    this.finalStatsLogged = true;
    this.getRTCStatsReport().then(report => {
      if (report) {
        this.log.info('final track stats', summarizeStatsReport(report));
      }
    }).catch(error => this.log.debug('could not collect final track stats', {
      error
    }));
  }
  /** @internal */
  updateLoggerOptions(loggerOptions) {
    if (loggerOptions.loggerContextCb) {
      this.loggerContextCb = loggerOptions.loggerContextCb;
    }
    if (loggerOptions.loggerName) {
      this.log = getLogger(loggerOptions.loggerName, () => this.logContext);
    }
  }
  recycleElement(element) {
    if (element instanceof HTMLAudioElement) {
      // we only need to re-use a single element
      let shouldCache = true;
      element.pause();
      recycledElements.forEach(e => {
        if (!e.parentElement) {
          shouldCache = false;
        }
      });
      if (shouldCache) {
        recycledElements.push(element);
      }
    }
  }
  handleAppVisibilityChanged() {
    return __awaiter(this, void 0, void 0, function* () {
      this.isInBackground = document.visibilityState === 'hidden';
      if (!this.isInBackground && this.kind === Track.Kind.Video) {
        setTimeout(() => this.attachedElements.forEach(el => el.play().catch(() => {
          /** catch clause necessary for Safari */
        })), 0);
      }
    });
  }
  addAppVisibilityListener() {
    if (isWeb()) {
      this.isInBackground = document.visibilityState === 'hidden';
      document.addEventListener('visibilitychange', this.appVisibilityChangedListener);
    } else {
      this.isInBackground = false;
    }
  }
  removeAppVisibilityListener() {
    if (isWeb()) {
      document.removeEventListener('visibilitychange', this.appVisibilityChangedListener);
    }
  }
}
function attachToElement(track, element) {
  let mediaStream;
  if (element.srcObject instanceof MediaStream) {
    mediaStream = element.srcObject;
  } else {
    mediaStream = new MediaStream();
  }
  // check if track matches existing track
  let existingTracks;
  if (track.kind === 'audio') {
    existingTracks = mediaStream.getAudioTracks();
  } else {
    existingTracks = mediaStream.getVideoTracks();
  }
  if (!existingTracks.includes(track)) {
    existingTracks.forEach(et => {
      mediaStream.removeTrack(et);
    });
    mediaStream.addTrack(track);
  }
  if (!isSafari() || !(element instanceof HTMLVideoElement)) {
    // when in low power mode (applies to both macOS and iOS), Safari will show a play/pause overlay
    // when a video starts that has the `autoplay` attribute is set.
    // we work around this by _not_ setting the autoplay attribute on safari and instead call `setTimeout(() => el.play(),0)` further down
    element.autoplay = true;
  }
  // In case there are no audio tracks present on the mediastream, we set the element as muted to ensure autoplay works
  element.muted = mediaStream.getAudioTracks().length === 0;
  if (element instanceof HTMLVideoElement) {
    element.playsInline = true;
  }
  // avoid flicker
  if (element.srcObject !== mediaStream) {
    element.srcObject = mediaStream;
    if ((isSafari() || isFireFox()) && element instanceof HTMLVideoElement) {
      // Firefox also has a timing issue where video doesn't actually get attached unless
      // performed out-of-band
      // Safari 15 has a bug where in certain layouts, video element renders
      // black until the page is resized or other changes take place.
      // Resetting the src triggers it to render.
      // https://developer.apple.com/forums/thread/690523
      setTimeout(() => {
        element.srcObject = mediaStream;
        // Safari 15 sometimes fails to start a video
        // when the window is backgrounded before the first frame is drawn
        // manually calling play here seems to fix that
        element.play().catch(() => {
          /** do nothing */
        });
      }, 0);
    }
  }
}
/** @internal */
function detachTrack(track, element) {
  if (element.srcObject instanceof MediaStream) {
    const mediaStream = element.srcObject;
    if (track.kind === 'audio' && isChromiumBased()) {
      // Release the stream before removing an audio track from it. When an element stops playing,
      // Chrome silences only the tracks still in its stream, so a removed remote audio track keeps
      // playing while another remote audio element in the page plays. Firefox and Safari stop it.
      // https://issues.chromium.org/issues/41336384
      element.srcObject = null;
    }
    mediaStream.removeTrack(track);
    if (mediaStream.getTracks().length > 0) {
      element.srcObject = mediaStream;
    } else {
      element.srcObject = null;
    }
  }
}
(function (Track) {
  let Kind;
  (function (Kind) {
    Kind["Audio"] = "audio";
    Kind["Video"] = "video";
    Kind["Unknown"] = "unknown";
  })(Kind = Track.Kind || (Track.Kind = {}));
  let Source;
  (function (Source) {
    Source["Camera"] = "camera";
    Source["Microphone"] = "microphone";
    Source["ScreenShare"] = "screen_share";
    Source["ScreenShareAudio"] = "screen_share_audio";
    Source["Unknown"] = "unknown";
  })(Source = Track.Source || (Track.Source = {}));
  let StreamState$1;
  (function (StreamState) {
    StreamState["Active"] = "active";
    StreamState["Paused"] = "paused";
    StreamState["Unknown"] = "unknown";
  })(StreamState$1 = Track.StreamState || (Track.StreamState = {}));
  /** @internal */
  function kindToProto(k) {
    switch (k) {
      case Kind.Audio:
        return TrackType.AUDIO;
      case Kind.Video:
        return TrackType.VIDEO;
      default:
        // FIXME this was UNRECOGNIZED before
        return TrackType.DATA;
    }
  }
  Track.kindToProto = kindToProto;
  /** @internal */
  function kindFromProto(t) {
    switch (t) {
      case TrackType.AUDIO:
        return Kind.Audio;
      case TrackType.VIDEO:
        return Kind.Video;
      default:
        return Kind.Unknown;
    }
  }
  Track.kindFromProto = kindFromProto;
  /** @internal */
  function sourceToProto(s) {
    switch (s) {
      case Source.Camera:
        return TrackSource.CAMERA;
      case Source.Microphone:
        return TrackSource.MICROPHONE;
      case Source.ScreenShare:
        return TrackSource.SCREEN_SHARE;
      case Source.ScreenShareAudio:
        return TrackSource.SCREEN_SHARE_AUDIO;
      default:
        return TrackSource.UNKNOWN;
    }
  }
  Track.sourceToProto = sourceToProto;
  /** @internal */
  function sourceFromProto(s) {
    switch (s) {
      case TrackSource.CAMERA:
        return Source.Camera;
      case TrackSource.MICROPHONE:
        return Source.Microphone;
      case TrackSource.SCREEN_SHARE:
        return Source.ScreenShare;
      case TrackSource.SCREEN_SHARE_AUDIO:
        return Source.ScreenShareAudio;
      default:
        return Source.Unknown;
    }
  }
  Track.sourceFromProto = sourceFromProto;
  /** @internal */
  function streamStateFromProto(s) {
    switch (s) {
      case StreamState.ACTIVE:
        return StreamState$1.Active;
      case StreamState.PAUSED:
        return StreamState$1.Paused;
      default:
        return StreamState$1.Unknown;
    }
  }
  Track.streamStateFromProto = streamStateFromProto;
})(Track || (Track = {}));export{Track,VideoQuality,attachToElement,detachTrack};//# sourceMappingURL=Track.mjs.map
