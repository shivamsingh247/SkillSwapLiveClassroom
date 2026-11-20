import {__awaiter}from'tslib';import {TrackPublishedResponse,TrackSource}from'@livekit/protocol';import livekitLogger from'../../logger.mjs';import {cloneDeep}from'../../utils/cloneDeep.mjs';import {sleep,isSafari}from'../utils.mjs';import {Track}from'./Track.mjs';import'./options.mjs';function mergeDefaultOptions(options, audioDefaults, videoDefaults) {
  var _a, _b;
  var _c, _d;
  const _extractProcessorsFro = extractProcessorsFromOptions(options !== null && options !== void 0 ? options : {}),
    optionsWithoutProcessor = _extractProcessorsFro.optionsWithoutProcessor,
    audioProcessor = _extractProcessorsFro.audioProcessor,
    videoProcessor = _extractProcessorsFro.videoProcessor;
  const defaultAudioProcessor = audioDefaults === null || audioDefaults === void 0 ? void 0 : audioDefaults.processor;
  const defaultVideoProcessor = videoDefaults === null || videoDefaults === void 0 ? void 0 : videoDefaults.processor;
  const clonedOptions = optionsWithoutProcessor !== null && optionsWithoutProcessor !== void 0 ? optionsWithoutProcessor : {};
  if (clonedOptions.audio === true) clonedOptions.audio = {};
  if (clonedOptions.video === true) clonedOptions.video = {};
  // use defaults
  if (clonedOptions.audio) {
    mergeObjectWithoutOverwriting(clonedOptions.audio, audioDefaults);
    (_a = (_c = clonedOptions.audio).deviceId) !== null && _a !== void 0 ? _a : _c.deviceId = {
      ideal: 'default'
    };
    if (audioProcessor || defaultAudioProcessor) {
      clonedOptions.audio.processor = audioProcessor !== null && audioProcessor !== void 0 ? audioProcessor : defaultAudioProcessor;
    }
  }
  if (clonedOptions.video) {
    mergeObjectWithoutOverwriting(clonedOptions.video, videoDefaults);
    (_b = (_d = clonedOptions.video).deviceId) !== null && _b !== void 0 ? _b : _d.deviceId = {
      ideal: 'default'
    };
    if (videoProcessor || defaultVideoProcessor) {
      clonedOptions.video.processor = videoProcessor !== null && videoProcessor !== void 0 ? videoProcessor : defaultVideoProcessor;
    }
  }
  return clonedOptions;
}
function mergeObjectWithoutOverwriting(mainObject, objectToMerge) {
  Object.keys(objectToMerge).forEach(key => {
    if (mainObject[key] === undefined) mainObject[key] = objectToMerge[key];
  });
  return mainObject;
}
function constraintsForOptions(options) {
  var _a, _b;
  var _c, _d;
  const constraints = {};
  if (options.video) {
    // default video options
    if (typeof options.video === 'object') {
      const videoOptions = {};
      const target = videoOptions;
      const source = options.video;
      Object.keys(source).forEach(key => {
        switch (key) {
          case 'resolution':
            // flatten VideoResolution fields
            mergeObjectWithoutOverwriting(target, source.resolution);
            break;
          default:
            target[key] = source[key];
        }
      });
      constraints.video = videoOptions;
      (_a = (_c = constraints.video).deviceId) !== null && _a !== void 0 ? _a : _c.deviceId = {
        ideal: 'default'
      };
    } else {
      constraints.video = options.video ? {
        deviceId: {
          ideal: 'default'
        }
      } : false;
    }
  } else {
    constraints.video = false;
  }
  if (options.audio) {
    if (typeof options.audio === 'object') {
      constraints.audio = options.audio;
      (_b = (_d = constraints.audio).deviceId) !== null && _b !== void 0 ? _b : _d.deviceId = {
        ideal: 'default'
      };
    } else {
      constraints.audio = {
        deviceId: {
          ideal: 'default'
        }
      };
    }
  } else {
    constraints.audio = false;
  }
  return constraints;
}
/**
 * This function detects silence on a given [[Track]] instance.
 * Returns true if the track seems to be entirely silent.
 */
function detectSilence(track_1) {
  return __awaiter(this, arguments, void 0, function (track) {
    let timeOffset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 200;
    return function* () {
      const ctx = getNewAudioContext();
      if (!ctx) {
        return false;
      }
      let source;
      let analyser;
      try {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source = ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
        source.connect(analyser);
        // read through a function so that `state` isn't narrowed to its value from before `resume`
        const isRunning = () => ctx.state === 'running';
        if (!isRunning()) {
          try {
            // `resume` can stay pending indefinitely on a blocked page rather than rejecting, which
            // would keep the context and its nodes alive past the `finally` below
            yield Promise.race([ctx.resume(), sleep(200)]);
          } catch (_a) {
            // autoplay policies can keep us from resuming the context
          }
          if (!isRunning()) {
            // a context that isn't running doesn't process any audio, so the analyser would only ever
            // read silence. Report the track as not silent rather than raising a false positive.
            return false;
          }
        }
        yield sleep(timeOffset);
        analyser.getByteTimeDomainData(dataArray);
        const someNoise = dataArray.some(sample => sample !== 128 && sample !== 0);
        return !someNoise;
      } finally {
        source === null || source === void 0 ? void 0 : source.disconnect();
        analyser === null || analyser === void 0 ? void 0 : analyser.disconnect();
        // don't let a failing teardown mask the detection result
        yield ctx.close().catch(() => {});
      }
    }();
  });
}
/**
 * @internal
 */
function getNewAudioContext() {
  var _a;
  const AudioContext =
  // @ts-ignore
  typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (AudioContext) {
    const audioContext = new AudioContext({
      latencyHint: 'interactive'
    });
    // If the audio context is suspended, we need to resume it when the user clicks on the page
    if (audioContext.state === 'suspended' && typeof window !== 'undefined' && ((_a = window.document) === null || _a === void 0 ? void 0 : _a.body)) {
      const handleResume = () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
          if (audioContext.state === 'suspended') {
            yield audioContext.resume();
          }
        } catch (e) {
          console.warn('Error trying to auto-resume audio context', e);
        } finally {
          (_a = window.document.body) === null || _a === void 0 ? void 0 : _a.removeEventListener('click', handleResume);
        }
      });
      // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/statechange_event
      audioContext.addEventListener('statechange', () => {
        var _a;
        if (audioContext.state === 'closed') {
          (_a = window.document.body) === null || _a === void 0 ? void 0 : _a.removeEventListener('click', handleResume);
        }
      });
      window.document.body.addEventListener('click', handleResume);
    }
    return audioContext;
  }
}
/**
 * @internal
 */
function kindToSource(kind) {
  if (kind === 'audioinput') {
    return Track.Source.Microphone;
  } else if (kind === 'videoinput') {
    return Track.Source.Camera;
  } else {
    return Track.Source.Unknown;
  }
}
/**
 * @internal
 */
function sourceToKind(source) {
  if (source === Track.Source.Microphone) {
    return 'audioinput';
  } else if (source === Track.Source.Camera) {
    return 'videoinput';
  } else {
    return undefined;
  }
}
/**
 * @internal
 */
function screenCaptureToDisplayMediaStreamOptions(options) {
  var _a, _b;
  let videoConstraints = (_a = options.video) !== null && _a !== void 0 ? _a : true;
  // treat 0 as uncapped
  if (options.resolution && options.resolution.width > 0 && options.resolution.height > 0) {
    videoConstraints = typeof videoConstraints === 'boolean' ? {} : videoConstraints;
    if (isSafari()) {
      videoConstraints = Object.assign(Object.assign({}, videoConstraints), {
        width: {
          max: options.resolution.width
        },
        height: {
          max: options.resolution.height
        },
        frameRate: options.resolution.frameRate
      });
    } else {
      videoConstraints = Object.assign(Object.assign({}, videoConstraints), {
        width: {
          ideal: options.resolution.width
        },
        height: {
          ideal: options.resolution.height
        },
        frameRate: options.resolution.frameRate
      });
    }
  }
  return {
    audio: (_b = options.audio) !== null && _b !== void 0 ? _b : false,
    video: videoConstraints,
    // @ts-expect-error support for experimental display media features
    controller: options.controller,
    selfBrowserSurface: options.selfBrowserSurface,
    surfaceSwitching: options.surfaceSwitching,
    systemAudio: options.systemAudio,
    preferCurrentTab: options.preferCurrentTab
  };
}
function mimeTypeToVideoCodecString(mimeType) {
  return mimeType.split('/')[1].toLowerCase();
}
function getTrackPublicationInfo(tracks) {
  const infos = [];
  tracks.forEach(track => {
    if (track.track !== undefined) {
      infos.push(new TrackPublishedResponse({
        cid: track.track.mediaStreamID,
        track: track.trackInfo
      }));
    }
  });
  return infos;
}
function getLogContextFromTrack(track) {
  if ('mediaStreamTrack' in track) {
    return {
      trackID: track.sid,
      source: track.source,
      muted: track.isMuted,
      enabled: track.mediaStreamTrack.enabled,
      kind: track.kind,
      streamID: track.mediaStreamID,
      streamTrackID: track.mediaStreamTrack.id
    };
  } else {
    return {
      trackID: track.trackSid,
      enabled: track.isEnabled,
      muted: track.isMuted,
      trackInfo: Object.assign({
        mimeType: track.mimeType,
        name: track.trackName,
        encrypted: track.isEncrypted,
        kind: track.kind,
        source: track.source
      }, track.track ? getLogContextFromTrack(track.track) : {})
    };
  }
}
function supportsSynchronizationSources() {
  return typeof RTCRtpReceiver !== 'undefined' && typeof RTCRtpReceiver.prototype.getSynchronizationSources === 'function';
}
function diffAttributes(oldValues, newValues) {
  var _a;
  if (oldValues === undefined) {
    oldValues = {};
  }
  if (newValues === undefined) {
    newValues = {};
  }
  const allKeys = [...Object.keys(newValues), ...Object.keys(oldValues)];
  const diff = {};
  for (const key of allKeys) {
    if (oldValues[key] !== newValues[key]) {
      diff[key] = (_a = newValues[key]) !== null && _a !== void 0 ? _a : '';
    }
  }
  return diff;
}
/** @internal */
function extractProcessorsFromOptions(options) {
  const newOptions = Object.assign({}, options);
  let audioProcessor;
  let videoProcessor;
  if (typeof newOptions.audio === 'object' && newOptions.audio.processor) {
    audioProcessor = newOptions.audio.processor;
    newOptions.audio = Object.assign(Object.assign({}, newOptions.audio), {
      processor: undefined
    });
  }
  if (typeof newOptions.video === 'object' && newOptions.video.processor) {
    videoProcessor = newOptions.video.processor;
    newOptions.video = Object.assign(Object.assign({}, newOptions.video), {
      processor: undefined
    });
  }
  return {
    audioProcessor,
    videoProcessor,
    optionsWithoutProcessor: cloneDeep(newOptions)
  };
}
function getTrackSourceFromProto(source) {
  switch (source) {
    case TrackSource.CAMERA:
      return Track.Source.Camera;
    case TrackSource.MICROPHONE:
      return Track.Source.Microphone;
    case TrackSource.SCREEN_SHARE:
      return Track.Source.ScreenShare;
    case TrackSource.SCREEN_SHARE_AUDIO:
      return Track.Source.ScreenShareAudio;
    default:
      return Track.Source.Unknown;
  }
}
function areDimensionsSmaller(a, b) {
  return a.width * a.height < b.width * b.height;
}
function layerDimensionsFor(trackInfo, quality) {
  var _a;
  return (_a = trackInfo.layers) === null || _a === void 0 ? void 0 : _a.find(l => l.quality === quality);
}
/**
 * Waits until `track` has actually produced a video frame.
 *
 * iOS keeps reporting the camera's sensor frame from `getSettings()` until the camera has
 * delivered its first picture, so a portrait capture initially reads as landscape. The arrival
 * of that first frame is the only reliable signal that the reported settings describe reality.
 *
 * Best effort, never throws. Resolves `true` when a frame was observed, `false` when no frame
 * can be observed (the track is already ended, muted or disabled) or `timeoutMs` elapsed first.
 *
 * @internal
 */
function waitForFirstVideoFrame(track_1, timeoutMs_1) {
  return __awaiter(this, arguments, void 0, function (track, timeoutMs) {
    let candidateElements = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    return function* () {
      var _a;
      if (typeof document === 'undefined') {
        return false;
      }
      if (track.readyState === 'ended' || track.muted || !track.enabled) {
        // no frame is ever going to arrive, don't hold the caller up for the full timeout
        return false;
      }
      // requestVideoFrameCallback (Safari 15.4 and up) is a platform capability, so the answer is the
      // same for every element
      const supportsFrameCallback = typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function';
      // prefer an element that is already rendering this track (a local preview, typically) over
      // spinning up a second decode just to observe a frame
      const existingElement = candidateElements.find(el => el instanceof HTMLVideoElement && el.srcObject instanceof MediaStream && el.srcObject.getVideoTracks().includes(track) && (
      // without requestVideoFrameCallback we depend on `loadeddata`, which is one-shot: an element
      // that already decoded a frame (readyState >= HAVE_CURRENT_DATA) never fires it again.
      // Leave those alone and set up our own element, which starts out empty.
      supportsFrameCallback || el.readyState < 2));
      const element = existingElement !== null && existingElement !== void 0 ? existingElement : document.createElement('video');
      if (!existingElement) {
        element.playsInline = true;
        element.muted = true;
        element.srcObject = new MediaStream([track]);
        // the element is deliberately never added to the DOM, it only exists to pull frames.
        // WebKit delivers frames to a paused element too, so a rejected play() (Safari's low power
        // mode, for instance) is not a reason to stop waiting
        element.play().catch(error => {
          livekitLogger.debug('could not play element while waiting for the first video frame', {
            error
          });
        });
      }
      let timer;
      let frameHandle;
      let onLoadedData;
      try {
        return yield new Promise(resolve => {
          timer = setTimeout(() => resolve(false), timeoutMs);
          if (supportsFrameCallback) {
            frameHandle = element.requestVideoFrameCallback(() => resolve(true));
          } else {
            // Safari below 15.4 has no requestVideoFrameCallback. `loadeddata` fires once the first
            // frame has been decoded, which is the same signal a few milliseconds earlier.
            onLoadedData = () => resolve(true);
            element.addEventListener('loadeddata', onLoadedData);
          }
        });
      } finally {
        clearTimeout(timer);
        if (frameHandle !== undefined) {
          (_a = element.cancelVideoFrameCallback) === null || _a === void 0 ? void 0 : _a.call(element, frameHandle);
        }
        if (onLoadedData) {
          element.removeEventListener('loadeddata', onLoadedData);
        }
        if (!existingElement) {
          element.pause();
          element.srcObject = null;
        }
      }
    }();
  });
}export{areDimensionsSmaller,constraintsForOptions,detectSilence,diffAttributes,extractProcessorsFromOptions,getLogContextFromTrack,getNewAudioContext,getTrackPublicationInfo,getTrackSourceFromProto,kindToSource,layerDimensionsFor,mergeDefaultOptions,mimeTypeToVideoCodecString,screenCaptureToDisplayMediaStreamOptions,sourceToKind,supportsSynchronizationSources,waitForFirstVideoFrame};//# sourceMappingURL=utils.mjs.map
