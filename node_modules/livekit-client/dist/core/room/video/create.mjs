import {__awaiter}from'tslib';import {defaultVideoCodec}from'../defaults.mjs';import {DeviceUnsupportedError,TrackInvalidError}from'../errors.mjs';import LocalAudioTrack from'../track/LocalAudioTrack.mjs';import LocalVideoTrack from'../track/LocalVideoTrack.mjs';import {Track}from'../track/Track.mjs';import {createLocalTracks,setVideoCapture}from'../track/create.mjs';import {VideoPresets,ScreenSharePresets}from'../track/options.mjs';import {screenCaptureToDisplayMediaStreamOptions}from'../track/utils.mjs';import {isSafari17Based}from'../utils.mjs';const videoDefaults = {
  deviceId: {
    ideal: 'default'
  },
  resolution: VideoPresets.h720.resolution
};
/** The video part of `publishDefaults`; the `video` extension merges it under the room options. */
const videoPublishDefaults = {
  simulcast: true,
  screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
  videoCodec: defaultVideoCodec,
  backupCodec: true
};
const videoCapture = {
  defaults: videoDefaults,
  createTrack: (mediaStreamTrack, constraints, userProvidedTrack, loggerOptions) => new LocalVideoTrack(mediaStreamTrack, constraints, userProvidedTrack, loggerOptions)
};
/**
 * Lets `createLocalTracks` and `publishTrack` produce video tracks. Safe to call repeatedly.
 * @experimental
 */
function registerVideoCapture() {
  setVideoCapture(videoCapture);
}
/**
 * Creates a [[LocalVideoTrack]] with getUserMedia()
 * @param options
 */
function createLocalVideoTrack(options) {
  return __awaiter(this, void 0, void 0, function* () {
    registerVideoCapture();
    const tracks = yield createLocalTracks({
      audio: false,
      video: options !== null && options !== void 0 ? options : true
    });
    return tracks[0];
  });
}
/**
 * Creates a screen capture tracks with getDisplayMedia().
 * A LocalVideoTrack is always created and returned.
 * If { audio: true }, and the browser supports audio capture, a LocalAudioTrack is also created.
 */
function createLocalScreenTracks(options) {
  return __awaiter(this, void 0, void 0, function* () {
    if (options === undefined) {
      options = {};
    }
    if (options.resolution === undefined && !isSafari17Based()) {
      options.resolution = ScreenSharePresets.h1080fps30.resolution;
    }
    if (navigator.mediaDevices.getDisplayMedia === undefined) {
      throw new DeviceUnsupportedError('getDisplayMedia not supported');
    }
    const constraints = screenCaptureToDisplayMediaStreamOptions(options);
    const stream = yield navigator.mediaDevices.getDisplayMedia(constraints);
    const tracks = stream.getVideoTracks();
    if (tracks.length === 0) {
      throw new TrackInvalidError('no video track found');
    }
    const screenVideo = new LocalVideoTrack(tracks[0], undefined, false);
    screenVideo.source = Track.Source.ScreenShare;
    const localTracks = [screenVideo];
    if (stream.getAudioTracks().length > 0) {
      const screenAudio = new LocalAudioTrack(stream.getAudioTracks()[0], undefined, false);
      screenAudio.source = Track.Source.ScreenShareAudio;
      localTracks.push(screenAudio);
    }
    return localTracks;
  });
}export{createLocalScreenTracks,createLocalVideoTrack,registerVideoCapture,videoDefaults,videoPublishDefaults};//# sourceMappingURL=create.mjs.map
