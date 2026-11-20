import {__awaiter}from'tslib';import {Room,protoInt64,ParticipantInfo,TrackInfo,TrackType,TrackSource,ParticipantInfo_State}from'@livekit/protocol';import {ParticipantEvent}from'../events.mjs';import LocalAudioTrack from'../track/LocalAudioTrack.mjs';import LocalTrackPublication from'../track/LocalTrackPublication.mjs';import {Track}from'../track/Track.mjs';import {getVideoCapture}from'../track/create.mjs';import {createDummyVideoStreamTrack}from'../utils.mjs';/**
 * Fills a room with fake participants and dummy media without a server. A development tool;
 * the `video` extension must be installed when simulated participants publish video.
 * @experimental
 */
const simulatedParticipants = {
  key: /* @__PURE__ */Symbol('lk.extension.simulatedParticipants'),
  install(room, ctx) {
    return {
      room: {
        simulateParticipants: options => simulateParticipants(room, ctx, options)
      }
    };
  }
};
function simulateParticipants(room, ctx, options) {
  return __awaiter(this, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const publishOptions = Object.assign({
      audio: true,
      video: true,
      useRealTracks: false
    }, options.publish);
    const participantOptions = Object.assign({
      count: 9,
      audio: false,
      video: true,
      aspectRatios: [1.66, 1.7, 1.3]
    }, options.participants);
    const participant = room.localParticipant;
    const loggerOptions = participant.trackLoggerOptions;
    ctx.simulateConnected(new Room({
      sid: 'RM_SIMULATED',
      name: 'simulated-room',
      emptyTimeout: 0,
      maxParticipants: 0,
      creationTime: protoInt64.parse(new Date().getTime()),
      metadata: '',
      numParticipants: 1,
      numPublishers: 1,
      turnPassword: '',
      enabledCodecs: [],
      activeRecording: false
    }), new ParticipantInfo({
      identity: 'simulated-local',
      name: 'local-name'
    }));
    if (publishOptions.video) {
      const camPub = new LocalTrackPublication(Track.Kind.Video, new TrackInfo({
        source: TrackSource.CAMERA,
        sid: Math.floor(Math.random() * 10000).toString(),
        type: TrackType.AUDIO,
        name: 'video-dummy'
      }), getVideoCapture().createTrack(publishOptions.useRealTracks && ((_a = window.navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia) ? (yield window.navigator.mediaDevices.getUserMedia({
        video: true
      })).getVideoTracks()[0] : createDummyVideoStreamTrack(160 * ((_b = participantOptions.aspectRatios[0]) !== null && _b !== void 0 ? _b : 1), 160, true, true), undefined, false, loggerOptions), loggerOptions);
      // @ts-ignore
      participant.addTrackPublication(camPub);
      participant.emit(ParticipantEvent.LocalTrackPublished, camPub);
    }
    if (publishOptions.audio) {
      const audioPub = new LocalTrackPublication(Track.Kind.Audio, new TrackInfo({
        source: TrackSource.MICROPHONE,
        sid: Math.floor(Math.random() * 10000).toString(),
        type: TrackType.AUDIO
      }), new LocalAudioTrack(publishOptions.useRealTracks && ((_c = navigator.mediaDevices) === null || _c === void 0 ? void 0 : _c.getUserMedia) ? (yield navigator.mediaDevices.getUserMedia({
        audio: true
      })).getAudioTracks()[0] : ctx.acquireEmptyAudioStreamTrack(), undefined, false, participant.audioContext, loggerOptions), loggerOptions);
      // @ts-ignore
      participant.addTrackPublication(audioPub);
      participant.emit(ParticipantEvent.LocalTrackPublished, audioPub);
    }
    for (let i = 0; i < participantOptions.count - 1; i += 1) {
      let info = new ParticipantInfo({
        sid: Math.floor(Math.random() * 10000).toString(),
        identity: "simulated-".concat(i),
        state: ParticipantInfo_State.ACTIVE,
        tracks: [],
        joinedAt: protoInt64.parse(Date.now())
      });
      const p = ctx.getOrCreateParticipant(info.identity, info);
      if (participantOptions.video) {
        const dummyVideo = createDummyVideoStreamTrack(160 * ((_d = participantOptions.aspectRatios[i % participantOptions.aspectRatios.length]) !== null && _d !== void 0 ? _d : 1), 160, false, true);
        const videoTrack = new TrackInfo({
          source: TrackSource.CAMERA,
          sid: Math.floor(Math.random() * 10000).toString(),
          type: TrackType.AUDIO
        });
        p.addSubscribedMediaTrack(dummyVideo, videoTrack.sid, new MediaStream([dummyVideo]), new RTCRtpReceiver());
        info.tracks = [...info.tracks, videoTrack];
      }
      if (participantOptions.audio) {
        const dummyTrack = ctx.acquireEmptyAudioStreamTrack();
        const audioTrack = new TrackInfo({
          source: TrackSource.MICROPHONE,
          sid: Math.floor(Math.random() * 10000).toString(),
          type: TrackType.AUDIO
        });
        p.addSubscribedMediaTrack(dummyTrack, audioTrack.sid, new MediaStream([dummyTrack]), new RTCRtpReceiver());
        info.tracks = [...info.tracks, audioTrack];
      }
      p.updateInfo(info);
    }
  });
}export{simulatedParticipants};//# sourceMappingURL=extension.mjs.map
