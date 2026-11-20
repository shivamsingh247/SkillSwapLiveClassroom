import {__awaiter}from'tslib';import DeviceManager from'../DeviceManager.mjs';import {audioDefaults}from'../defaults.mjs';import {TrackInvalidError}from'../errors.mjs';import {unwrapConstraint,isAudioTrack,isVideoTrack}from'../utils.mjs';import LocalAudioTrack from'./LocalAudioTrack.mjs';import {Track}from'./Track.mjs';import {extractProcessorsFromOptions,mergeDefaultOptions,constraintsForOptions}from'./utils.mjs';let videoCapture;
/** @internal */
function setVideoCapture(capture) {
  videoCapture = capture;
}
/** @internal */
function getVideoCapture() {
  if (!videoCapture) {
    // @throws-transformer ignore - programmer error
    throw new TrackInvalidError('video capture is not available in this build, add the video extension');
  }
  return videoCapture;
}
/**
 * Creates a local video and audio track at the same time. When acquiring both
 * audio and video tracks together, it'll display a single permission prompt to
 * the user instead of two separate ones.
 * @param options
 */
function createLocalTracks(options, loggerOptions) {
  return __awaiter(this, void 0, void 0, function* () {
    options !== null && options !== void 0 ? options : options = {};
    let attemptExactMatch = false;
    const _extractProcessorsFro = extractProcessorsFromOptions(options),
      audioProcessor = _extractProcessorsFro.audioProcessor,
      videoProcessor = _extractProcessorsFro.videoProcessor,
      internalOptions = _extractProcessorsFro.optionsWithoutProcessor;
    let retryAudioOptions = internalOptions.audio;
    let retryVideoOptions = internalOptions.video;
    if (audioProcessor && typeof internalOptions.audio === 'object') {
      internalOptions.audio.processor = audioProcessor;
    }
    if (videoProcessor && typeof internalOptions.video === 'object') {
      internalOptions.video.processor = videoProcessor;
    }
    // if the user passes a device id as a string, we default to exact match
    if (options.audio && typeof internalOptions.audio === 'object' && typeof internalOptions.audio.deviceId === 'string') {
      const deviceId = internalOptions.audio.deviceId;
      internalOptions.audio.deviceId = {
        exact: deviceId
      };
      attemptExactMatch = true;
      retryAudioOptions = Object.assign(Object.assign({}, internalOptions.audio), {
        deviceId: {
          ideal: deviceId
        }
      });
    }
    if (internalOptions.video && typeof internalOptions.video === 'object' && typeof internalOptions.video.deviceId === 'string') {
      const deviceId = internalOptions.video.deviceId;
      internalOptions.video.deviceId = {
        exact: deviceId
      };
      attemptExactMatch = true;
      retryVideoOptions = Object.assign(Object.assign({}, internalOptions.video), {
        deviceId: {
          ideal: deviceId
        }
      });
    }
    if (internalOptions.audio === true) {
      internalOptions.audio = {
        deviceId: 'default'
      };
    } else if (typeof internalOptions.audio === 'object' && internalOptions.audio !== null) {
      internalOptions.audio = Object.assign(Object.assign({}, internalOptions.audio), {
        deviceId: internalOptions.audio.deviceId || 'default'
      });
    }
    if (internalOptions.video === true) {
      internalOptions.video = {
        deviceId: 'default'
      };
    } else if (typeof internalOptions.video === 'object' && !internalOptions.video.deviceId) {
      internalOptions.video.deviceId = 'default';
    }
    const opts = mergeDefaultOptions(internalOptions, audioDefaults, internalOptions.video ? getVideoCapture().defaults : undefined);
    const constraints = constraintsForOptions(opts);
    // Keep a reference to the promise on DeviceManager and await it in getLocalDevices()
    // works around iOS Safari Bug https://bugs.webkit.org/show_bug.cgi?id=179363
    const mediaPromise = navigator.mediaDevices.getUserMedia(constraints);
    if (internalOptions.audio) {
      DeviceManager.userMediaPromiseMap.set('audioinput', mediaPromise);
      mediaPromise.catch(() => DeviceManager.userMediaPromiseMap.delete('audioinput'));
    }
    if (internalOptions.video) {
      DeviceManager.userMediaPromiseMap.set('videoinput', mediaPromise);
      mediaPromise.catch(() => DeviceManager.userMediaPromiseMap.delete('videoinput'));
    }
    try {
      const stream = yield mediaPromise;
      return yield Promise.all(stream.getTracks().map(mediaStreamTrack => __awaiter(this, void 0, void 0, function* () {
        const isAudio = mediaStreamTrack.kind === 'audio';
        let trackConstraints;
        const conOrBool = isAudio ? constraints.audio : constraints.video;
        if (typeof conOrBool !== 'boolean') {
          trackConstraints = conOrBool;
        }
        // update the constraints with the device id the user gave permissions to in the permission prompt
        // otherwise each track restart (e.g. mute - unmute) will try to initialize the device again -> causing additional permission prompts
        const newDeviceId = mediaStreamTrack.getSettings().deviceId;
        if ((trackConstraints === null || trackConstraints === void 0 ? void 0 : trackConstraints.deviceId) && unwrapConstraint(trackConstraints.deviceId) !== newDeviceId) {
          trackConstraints.deviceId = newDeviceId;
        } else if (!trackConstraints) {
          trackConstraints = {
            deviceId: newDeviceId
          };
        }
        const track = mediaStreamTrack.kind === 'audio' ? new LocalAudioTrack(mediaStreamTrack, trackConstraints, false, undefined, loggerOptions) : getVideoCapture().createTrack(mediaStreamTrack, trackConstraints, false, loggerOptions);
        if (track.kind === Track.Kind.Video) {
          track.source = Track.Source.Camera;
        } else if (track.kind === Track.Kind.Audio) {
          track.source = Track.Source.Microphone;
        }
        track.mediaStream = stream;
        if (isAudioTrack(track) && audioProcessor) {
          yield track.setProcessor(audioProcessor);
        } else if (isVideoTrack(track) && videoProcessor) {
          yield track.setProcessor(videoProcessor);
        }
        return track;
      })));
    } catch (e) {
      if (!attemptExactMatch) {
        throw e;
      }
      return createLocalTracks(Object.assign(Object.assign({}, options), {
        audio: retryAudioOptions,
        video: retryVideoOptions
      }), loggerOptions);
    }
  });
}
function createLocalAudioTrack(options) {
  return __awaiter(this, void 0, void 0, function* () {
    const tracks = yield createLocalTracks({
      audio: options !== null && options !== void 0 ? options : true,
      video: false
    });
    return tracks[0];
  });
}export{createLocalAudioTrack,createLocalTracks,getVideoCapture,setVideoCapture};//# sourceMappingURL=create.mjs.map
