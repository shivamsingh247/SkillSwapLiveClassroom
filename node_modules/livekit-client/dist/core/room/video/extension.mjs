import {EngineEvent}from'../events.mjs';import {Track}from'../track/Track.mjs';import {videoDefaults,videoPublishDefaults,registerVideoCapture}from'./create.mjs';import {publishAdditionalCodecForTrack,createScreenTracks,enableCameraAndMicrophone,handleSubscribedQualityUpdate,createVideoPublisher}from'./publisher.mjs';/**
 * Video publishing: camera and screen share capture, simulcast, SVC and backup codecs.
 * Receiving video is part of core and needs no extension.
 * @experimental
 */
const video = {
  key: /* @__PURE__ */Symbol('lk.extension.video'),
  install(room, ctx) {
    registerVideoCapture();
    room.options.videoCaptureDefaults = Object.assign(Object.assign({}, videoDefaults), room.options.videoCaptureDefaults);
    room.options.publishDefaults = Object.assign(Object.assign({}, videoPublishDefaults), room.options.publishDefaults);
    const participant = room.localParticipant;
    return {
      videoPublisher: createVideoPublisher(room, ctx.log),
      onEngineCreated: engine => {
        engine.on(EngineEvent.SubscribedQualityUpdate, update => handleSubscribedQualityUpdate(room, ctx.log, update));
      },
      localParticipant: {
        setCameraEnabled: (enabled, options, publishOptions) => participant.setTrackEnabled(Track.Source.Camera, enabled, options, publishOptions),
        setScreenShareEnabled: (enabled, options, publishOptions) => participant.setTrackEnabled(Track.Source.ScreenShare, enabled, options, publishOptions),
        enableCameraAndMicrophone: () => enableCameraAndMicrophone(room),
        createScreenTracks: options => createScreenTracks(room, options),
        publishAdditionalCodecForTrack: (track, videoCodec, options) => publishAdditionalCodecForTrack(room, ctx.log, track, videoCodec, options)
      }
    };
  }
};export{video};//# sourceMappingURL=extension.mjs.map
