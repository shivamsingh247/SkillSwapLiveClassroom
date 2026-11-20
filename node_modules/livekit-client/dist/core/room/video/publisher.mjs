import {__awaiter,__asyncValues}from'tslib';import {AddTrackRequest,SimulcastCodec,VideoLayer_Mode,Encryption_Type}from'@livekit/protocol';import {defaultVideoCodec}from'../defaults.mjs';import {TrackInvalidError,UnexpectedConnectionState,DeviceUnsupportedError}from'../errors.mjs';import {ParticipantEvent}from'../events.mjs';import {computeTrackBackupEncodings,computeVideoEncodings,getDefaultDegradationPreference,computeStartTargetBitrate}from'../participant/publishUtils.mjs';import LocalAudioTrack from'../track/LocalAudioTrack.mjs';import LocalVideoTrack,{videoLayersFromEncodings}from'../track/LocalVideoTrack.mjs';import {Track}from'../track/Track.mjs';import {ScreenSharePresets,isBackupVideoCodec,VideoPresets}from'../track/options.mjs';import {getLogContextFromTrack,screenCaptureToDisplayMediaStreamOptions,mimeTypeToVideoCodecString}from'../track/utils.mjs';import {isLocalVideoTrack,isSafari17Based,isVideoCodec,isE2EESimulcastSupported,isFireFox,supportsAV1,supportsVP9,isSVCSimulcast,usesLegacySVCEncodings,isSVCSimulcastSupportedByServer,isSVCCodec}from'../utils.mjs';/** The video publish pipeline that `LocalParticipant.publishTrack` calls for video tracks. */
function createVideoPublisher(room, log) {
  const participant = room.localParticipant;
  const roomOptions = room.options;
  return {
    prepare(track, opts, req) {
      return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        // read at publish time: the e2ee extension can install after video
        if (!isE2EESimulcastSupported() && room.hasE2EESetup) {
          log.info("End-to-end encryption is set up, simulcast publishing will be disabled on Safari versions and iOS browsers running iOS < v17.2");
          opts.simulcast = false;
        }
        if (track.source === Track.Source.ScreenShare && isFireFox()) {
          // Firefox does not work well with simulcasted screen share
          // we frequently get no data on layer 0 when enabled
          opts.simulcast = false;
        }
        // require full AV1/VP9 SVC support prior to using it
        if (opts.videoCodec === 'av1' && !supportsAV1()) {
          opts.videoCodec = undefined;
        }
        if (opts.videoCodec === 'vp9' && !supportsVP9()) {
          opts.videoCodec = undefined;
        }
        if (opts.videoCodec === undefined) {
          opts.videoCodec = defaultVideoCodec;
        }
        if (participant.enabledPublishVideoCodecs.length > 0) {
          // fallback to a supported codec if it is not supported
          if (!participant.enabledPublishVideoCodecs.some(c => opts.videoCodec === mimeTypeToVideoCodecString(c.mime))) {
            opts.videoCodec = mimeTypeToVideoCodecString(participant.enabledPublishVideoCodecs[0].mime);
          }
        }
        const videoCodec = opts.videoCodec;
        let dims;
        try {
          dims = yield track.waitForDimensions();
        } catch (e) {
          // use defaults, it's quite painful for congestion control without simulcast
          // so using default dims according to publish settings
          const defaultRes = (_b = (_a = roomOptions.videoCaptureDefaults) === null || _a === void 0 ? void 0 : _a.resolution) !== null && _b !== void 0 ? _b : VideoPresets.h720.resolution;
          dims = {
            width: defaultRes.width,
            height: defaultRes.height
          };
          // log failure
          log.error('could not determine track dimensions, using defaults', Object.assign(Object.assign({}, getLogContextFromTrack(track)), {
            dims
          }));
        }
        // width and height should be defined for video
        req.width = dims.width;
        req.height = dims.height;
        // for svc codecs, disable simulcast and use vp8 for backup codec
        if (isSVCSimulcast(videoCodec, opts) && (usesLegacySVCEncodings() || !isSVCSimulcastSupportedByServer((_c = room.engine) === null || _c === void 0 ? void 0 : _c.serverVersion))) {
          opts.simulcast = false;
          log.info('SVC simulcast is not supported, disabling simulcast.', getLogContextFromTrack(track));
        }
        const svcSimulcast = isSVCSimulcast(videoCodec, opts);
        if (isSVCCodec(videoCodec) && !svcSimulcast) {
          if (track.source === Track.Source.ScreenShare) {
            // vp9 svc with screenshare cannot encode multiple spatial layers
            // doing so reduces publish resolution to minimal resolution
            opts.scalabilityMode = 'L1T3';
            // Chrome does not allow more than 5 fps with L1T3, and it has encoding bugs with L3T3
            // It has a different path for screenshare handling and it seems to be untested/buggy
            // As a workaround, we are setting contentHint to force it to go through the same
            // path as regular camera video. While this is not optimal, it delivers the performance
            // that we need
            if ('contentHint' in track.mediaStreamTrack) {
              track.mediaStreamTrack.contentHint = 'motion';
              log.debug('forcing contentHint to motion for screenshare with SVC codecs', getLogContextFromTrack(track));
            }
          }
          // set scalabilityMode to 'L3T3_KEY' by default
          opts.scalabilityMode = (_d = opts.scalabilityMode) !== null && _d !== void 0 ? _d : 'L3T3_KEY';
        }
        const primaryCodec = new SimulcastCodec({
          codec: videoCodec,
          cid: track.mediaStreamTrack.id
        });
        if (svcSimulcast) {
          primaryCodec.videoLayerMode = VideoLayer_Mode.ONE_SPATIAL_LAYER_PER_STREAM;
        }
        req.simulcastCodecs = [primaryCodec];
        // set up backup
        if (opts.backupCodec === true) {
          opts.backupCodec = {
            codec: defaultVideoCodec
          };
        }
        if (opts.backupCodec && videoCodec !== opts.backupCodec.codec &&
        // TODO remove this once e2ee is supported for backup codecs
        req.encryption === Encryption_Type.NONE) {
          // multi-codec simulcast requires dynacast
          if (!roomOptions.dynacast) {
            roomOptions.dynacast = true;
          }
          req.simulcastCodecs.push(new SimulcastCodec({
            codec: opts.backupCodec.codec,
            cid: ''
          }));
        }
        const encodings = computeVideoEncodings(track.source === Track.Source.ScreenShare, req.width, req.height, opts);
        req.layers = videoLayersFromEncodings(req.width, req.height, encodings, isSVCCodec(opts.videoCodec) && !isSVCSimulcast(opts.videoCodec, opts));
        return encodings;
      });
    },
    senderCreated(track, opts, encodings, req) {
      var _a, _b;
      (_a = opts.degradationPreference) !== null && _a !== void 0 ? _a : opts.degradationPreference = getDefaultDegradationPreference(track);
      track.setDegradationPreference(opts.degradationPreference);
      if (encodings && track.codec && isVideoCodec(track.codec)) {
        // Apply start bitrate for all video codecs to prevent initial blurriness,
        // see computeStartTargetBitrate
        const targetBitrate = computeStartTargetBitrate(track.codec, opts, encodings);
        if (targetBitrate > 0) {
          (_b = room.engine.pcManager) === null || _b === void 0 ? void 0 : _b.publisher.setTrackCodecBitrate({
            cid: req.cid,
            codec: track.codec,
            maxbr: targetBitrate / 1000,
            isScreenShare: track.source === Track.Source.ScreenShare
          });
        }
      }
    },
    serverCodecChanged(track, opts, info, req) {
      // server might not support the codec the client has requested, in that case, fallback
      // to a supported codec
      let primaryCodecMime;
      info.codecs.forEach(codec => {
        if (primaryCodecMime === undefined) {
          primaryCodecMime = codec.mimeType;
        }
      });
      if (!primaryCodecMime) {
        return undefined;
      }
      const updatedCodec = mimeTypeToVideoCodecString(primaryCodecMime);
      if (updatedCodec === opts.videoCodec) {
        return undefined;
      }
      log.debug('falling back to server selected codec', Object.assign(Object.assign({}, getLogContextFromTrack(track)), {
        codec: updatedCodec
      }));
      opts.videoCodec = updatedCodec;
      // recompute encodings since bitrates/etc could have changed
      return computeVideoEncodings(track.source === Track.Source.ScreenShare, req.width, req.height, opts);
    },
    createScreenTracks: options => createScreenTracks(room, options)
  };
}
/**
 * Creates a screen capture tracks with getDisplayMedia().
 * A LocalVideoTrack is always created and returned.
 * If { audio: true }, and the browser supports audio capture, a LocalAudioTrack is also created.
 */
function createScreenTracks(room, options) {
  return __awaiter(this, void 0, void 0, function* () {
    const participant = room.localParticipant;
    if (options === undefined) {
      options = {};
    }
    if (navigator.mediaDevices.getDisplayMedia === undefined) {
      throw new DeviceUnsupportedError('getDisplayMedia not supported');
    }
    if (options.resolution === undefined && !isSafari17Based()) {
      // we need to constrain the dimensions, otherwise it could lead to low bitrate
      // due to encoding a huge video. Encoding such large surfaces is really expensive
      // unfortunately Safari 17 has a but and cannot be constrained by default
      options.resolution = ScreenSharePresets.h1080fps30.resolution;
    }
    const constraints = screenCaptureToDisplayMediaStreamOptions(options);
    const stream = yield navigator.mediaDevices.getDisplayMedia(constraints);
    const tracks = stream.getVideoTracks();
    if (tracks.length === 0) {
      throw new TrackInvalidError('no video track found');
    }
    const screenVideo = new LocalVideoTrack(tracks[0], undefined, false, participant.trackLoggerOptions);
    screenVideo.source = Track.Source.ScreenShare;
    if (options.contentHint) {
      screenVideo.mediaStreamTrack.contentHint = options.contentHint;
    }
    const localTracks = [screenVideo];
    if (stream.getAudioTracks().length > 0) {
      participant.emit(ParticipantEvent.AudioStreamAcquired);
      const screenAudio = new LocalAudioTrack(stream.getAudioTracks()[0], undefined, false, participant.audioContext, participant.trackLoggerOptions);
      screenAudio.source = Track.Source.ScreenShareAudio;
      localTracks.push(screenAudio);
    }
    return localTracks;
  });
}
/**
 * Publish both camera and microphone at the same time. This is useful for
 * displaying a single Permission Dialog box to the end user.
 */
function enableCameraAndMicrophone(room) {
  return __awaiter(this, void 0, void 0, function* () {
    const participant = room.localParticipant;
    if (participant.pendingPublishing.has(Track.Source.Camera) || participant.pendingPublishing.has(Track.Source.Microphone)) {
      // no-op it's already been requested
      return;
    }
    participant.pendingPublishing.add(Track.Source.Camera);
    participant.pendingPublishing.add(Track.Source.Microphone);
    try {
      const tracks = yield participant.createTracks({
        audio: true,
        video: true
      });
      yield Promise.all(tracks.map(track => participant.publishTrack(track)));
    } finally {
      participant.pendingPublishing.delete(Track.Source.Camera);
      participant.pendingPublishing.delete(Track.Source.Microphone);
    }
  });
}
/** publish additional codec to existing track */
function publishAdditionalCodecForTrack(room, log, track, videoCodec, options) {
  return __awaiter(this, void 0, void 0, function* () {
    var _a;
    const participant = room.localParticipant;
    // TODO remove once e2ee is supported for backup tracks
    if (participant.isE2EEEnabled) {
      return;
    }
    // is it not published? if so skip
    let existingPublication;
    participant.trackPublications.forEach(publication => {
      if (!publication.track) {
        return;
      }
      if (publication.track === track) {
        existingPublication = publication;
      }
    });
    if (!existingPublication) {
      throw new TrackInvalidError('track is not published');
    }
    if (!isLocalVideoTrack(track)) {
      throw new TrackInvalidError('track is not a video track');
    }
    const opts = Object.assign(Object.assign({}, (_a = room.options) === null || _a === void 0 ? void 0 : _a.publishDefaults), options);
    const encodings = computeTrackBackupEncodings(track, videoCodec, opts);
    if (!encodings) {
      log.info("backup codec has been disabled, ignoring request to add additional codec for track", getLogContextFromTrack(track));
      return;
    }
    const simulcastTrack = track.addSimulcastTrack(videoCodec, encodings);
    if (!simulcastTrack) {
      return;
    }
    const packetTrailerFeatures = participant.normalizeRequestedFrameMetadataOptions(track, opts);
    // the backup sender encodes the processed track, not the raw capture track.dimensions reports
    const _track$mediaStreamTra = track.mediaStreamTrack.getSettings(),
      width = _track$mediaStreamTra.width,
      height = _track$mediaStreamTra.height;
    const dims = width && height ? {
      width,
      height
    } : undefined;
    if (!dims) {
      log.warn('could not determine track dimensions, publishing backup codec without layers', getLogContextFromTrack(track));
    }
    // the server reads the layers off the codec entry for a request that carries a sid, and
    // falls back to the top level ones when it predates per codec layers
    const layers = dims ? videoLayersFromEncodings(dims.width, dims.height, encodings) : [];
    const req = new AddTrackRequest({
      cid: simulcastTrack.mediaStreamTrack.id,
      type: Track.kindToProto(track.kind),
      muted: track.isMuted,
      source: Track.sourceToProto(track.source),
      sid: track.sid,
      width: dims === null || dims === void 0 ? void 0 : dims.width,
      height: dims === null || dims === void 0 ? void 0 : dims.height,
      packetTrailerFeatures,
      layers,
      simulcastCodecs: [{
        codec: opts.videoCodec,
        cid: simulcastTrack.mediaStreamTrack.id,
        layers
      }]
    });
    const engine = room.engine;
    if (!engine || engine.isClosed) {
      throw new UnexpectedConnectionState('cannot publish track when not connected');
    }
    const negotiate = () => __awaiter(this, void 0, void 0, function* () {
      yield engine.createSimulcastSender(track, simulcastTrack, opts, encodings);
      yield engine.negotiate();
    });
    const rets = yield Promise.all([engine.addTrack(req), negotiate()]);
    const ti = rets[0];
    log.debug("published ".concat(videoCodec, " for track ").concat(track.sid), {
      encodings,
      trackInfo: ti
    });
  });
}
/** Dynacast: the server tells us which codecs subscribers need; publish the backup codec on demand. */
function handleSubscribedQualityUpdate(room, log, update) {
  return __awaiter(this, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    var _d;
    if (!((_d = room.options) === null || _d === void 0 ? void 0 : _d.dynacast)) {
      return;
    }
    const pub = room.localParticipant.videoTrackPublications.get(update.trackSid);
    if (!pub) {
      log.warn('received subscribed quality update for unknown track', {
        trackSid: update.trackSid
      });
      return;
    }
    if (!pub.videoTrack) {
      return;
    }
    const newCodecs = yield pub.videoTrack.setPublishingCodecs(update.subscribedCodecs);
    try {
      for (var _e = true, newCodecs_1 = __asyncValues(newCodecs), newCodecs_1_1; newCodecs_1_1 = yield newCodecs_1.next(), _a = newCodecs_1_1.done, !_a; _e = true) {
        _c = newCodecs_1_1.value;
        _e = false;
        const codec = _c;
        if (isBackupVideoCodec(codec)) {
          log.debug("publish ".concat(codec, " for ").concat(pub.videoTrack.sid), getLogContextFromTrack(pub));
          yield publishAdditionalCodecForTrack(room, log, pub.videoTrack, codec, pub.options);
        }
      }
    } catch (e_1_1) {
      e_1 = {
        error: e_1_1
      };
    } finally {
      try {
        if (!_e && !_a && (_b = newCodecs_1.return)) yield _b.call(newCodecs_1);
      } finally {
        if (e_1) throw e_1.error;
      }
    }
  });
}export{createScreenTracks,createVideoPublisher,enableCameraAndMicrophone,handleSubscribedQualityUpdate,publishAdditionalCodecForTrack};//# sourceMappingURL=publisher.mjs.map
