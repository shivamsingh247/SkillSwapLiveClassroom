import {slicedToArray as _slicedToArray}from'../../_virtual/_rollupPluginBabelHelpers.mjs';import {__awaiter}from'tslib';import {ParticipantInfo_Kind}from'@livekit/protocol';import {DeferrableMap}from'../../utils/deferrable-map.mjs';import {CLIENT_PROTOCOL_DEFAULT}from'../../version.mjs';import {TrackEvent,ParticipantEvent}from'../events.mjs';import RemoteAudioTrack from'../track/RemoteAudioTrack.mjs';import RemoteTrackPublication from'../track/RemoteTrackPublication.mjs';import RemoteVideoTrack from'../track/RemoteVideoTrack.mjs';import {Track}from'../track/Track.mjs';import {getLogContextFromTrack}from'../track/utils.mjs';import {isRemoteTrack,isAudioTrack}from'../utils.mjs';import Participant from'./Participant.mjs';class RemoteParticipant extends Participant {
  /** @internal */
  static fromParticipantInfo(signalClient, pi, loggerOptions) {
    return new RemoteParticipant(signalClient, pi.sid, pi.identity, pi.name, pi.metadata, pi.attributes, loggerOptions, pi.kind, [], pi.clientProtocol, pi.capabilities);
  }
  get logContext() {
    return Object.assign(Object.assign({}, super.logContext), {
      remoteParticipantID: this.sid,
      remoteParticipant: this.identity
    });
  }
  /** @internal */
  constructor(signalClient, sid, identity, name, metadata, attributes, loggerOptions) {
    let kind = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : ParticipantInfo_Kind.STANDARD;
    let remoteDataTracks = arguments.length > 8 && arguments[8] !== undefined ? arguments[8] : [];
    let clientProtocol = arguments.length > 9 && arguments[9] !== undefined ? arguments[9] : CLIENT_PROTOCOL_DEFAULT;
    let capabilities = arguments.length > 10 && arguments[10] !== undefined ? arguments[10] : [];
    super(sid, identity || '', name, metadata, attributes, loggerOptions, kind);
    this.signalClient = signalClient;
    this.trackPublications = new Map();
    this.audioTrackPublications = new Map();
    this.videoTrackPublications = new Map();
    this.dataTracks = new DeferrableMap(remoteDataTracks.map(remoteDataTrack => {
      return [remoteDataTrack.info.name, remoteDataTrack];
    }));
    this.volumeMap = new Map();
    this.clientProtocol = clientProtocol;
    this.capabilities = capabilities;
  }
  addTrackPublication(publication) {
    super.addTrackPublication(publication);
    // register action events
    publication.on(TrackEvent.UpdateSettings, settings => {
      this.log.debug('send update settings', Object.assign(Object.assign(Object.assign({}, this.logContext), getLogContextFromTrack(publication)), {
        settings
      }));
      this.signalClient.sendUpdateTrackSettings(settings);
    });
    publication.on(TrackEvent.UpdateSubscription, sub => {
      sub.participantTracks.forEach(pt => {
        pt.participantSid = this.sid;
      });
      this.signalClient.sendUpdateSubscription(sub);
    });
    publication.on(TrackEvent.SubscriptionPermissionChanged, status => {
      this.emit(ParticipantEvent.TrackSubscriptionPermissionChanged, publication, status);
    });
    publication.on(TrackEvent.SubscriptionStatusChanged, status => {
      this.emit(ParticipantEvent.TrackSubscriptionStatusChanged, publication, status);
    });
    publication.on(TrackEvent.Subscribed, track => {
      this.emit(ParticipantEvent.TrackSubscribed, track, publication);
    });
    publication.on(TrackEvent.Unsubscribed, previousTrack => {
      this.emit(ParticipantEvent.TrackUnsubscribed, previousTrack, publication);
    });
    publication.on(TrackEvent.SubscriptionFailed, error => {
      this.emit(ParticipantEvent.TrackSubscriptionFailed, publication.trackSid, error);
    });
  }
  getTrackPublication(source) {
    const track = super.getTrackPublication(source);
    if (track) {
      return track;
    }
  }
  getTrackPublicationByName(name) {
    const track = super.getTrackPublicationByName(name);
    if (track) {
      return track;
    }
  }
  /**
   * sets the volume on the participant's audio track
   * by default, this affects the microphone publication
   * a different source can be passed in as a second argument
   * if no track exists the volume will be applied when the microphone track is added
   */
  setVolume(volume) {
    let source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Track.Source.Microphone;
    this.volumeMap.set(source, volume);
    const audioPublication = this.getTrackPublication(source);
    if (audioPublication && audioPublication.track) {
      audioPublication.track.setVolume(volume);
    }
  }
  /**
   * gets the volume on the participant's microphone track
   */
  getVolume() {
    let source = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Track.Source.Microphone;
    const audioPublication = this.getTrackPublication(source);
    if (audioPublication && audioPublication.track) {
      return audioPublication.track.getVolume();
    }
    return this.volumeMap.get(source);
  }
  /** @internal */
  addSubscribedMediaTrack(mediaTrack, sid, mediaStream, receiver, adaptiveStreamSettings, triesLeft) {
    // find the track publication
    // it's possible for the media track to arrive before participant info
    let publication = this.getTrackPublicationBySid(sid);
    // it's also possible that the browser didn't honor our original track id
    // FireFox would use its own local uuid instead of server track id
    if (!publication) {
      if (!sid.startsWith('TR')) {
        // find the first track that matches type
        this.trackPublications.forEach(p => {
          if (!publication && mediaTrack.kind === p.kind.toString()) {
            publication = p;
          }
        });
      }
    }
    // when we couldn't locate the track, it's possible that the metadata hasn't
    // yet arrived. Wait a bit longer for it to arrive, or fire an error
    if (!publication) {
      if (triesLeft === 0) {
        this.log.error('could not find published track', Object.assign(Object.assign({}, this.logContext), {
          trackSid: sid
        }));
        this.emit(ParticipantEvent.TrackSubscriptionFailed, sid);
        return;
      }
      if (triesLeft === undefined) triesLeft = 20;
      setTimeout(() => {
        this.addSubscribedMediaTrack(mediaTrack, sid, mediaStream, receiver, adaptiveStreamSettings, triesLeft - 1);
      }, 150);
      return;
    }
    if (mediaTrack.readyState === 'ended') {
      this.log.error('unable to subscribe because MediaStreamTrack is ended. Do not call MediaStreamTrack.stop()', Object.assign(Object.assign({}, this.logContext), getLogContextFromTrack(publication)));
      this.emit(ParticipantEvent.TrackSubscriptionFailed, sid);
      return;
    }
    const isVideo = mediaTrack.kind === 'video';
    let track;
    if (isVideo) {
      track = new RemoteVideoTrack(mediaTrack, sid, receiver, adaptiveStreamSettings);
    } else {
      track = new RemoteAudioTrack(mediaTrack, sid, receiver, this.audioContext, this.audioOutput);
    }
    // set track info
    track.source = publication.source;
    // keep publication's muted status
    track.isMuted = publication.isMuted;
    track.setMediaStream(mediaStream);
    track.start();
    publication.setTrack(track);
    // set participant volumes on new audio tracks
    if (this.volumeMap.has(publication.source) && isRemoteTrack(track) && isAudioTrack(track)) {
      track.setVolume(this.volumeMap.get(publication.source));
    }
    return publication;
  }
  /** @internal */
  get hasMetadata() {
    return !!this.participantInfo;
  }
  /**
   * @internal
   */
  getTrackPublicationBySid(sid) {
    return this.trackPublications.get(sid);
  }
  /** @internal */
  updateInfo(info) {
    if (!super.updateInfo(info)) {
      return false;
    }
    // we are getting a list of all available tracks, reconcile in here
    // and send out events for changes
    // reconcile track publications, publish events only if metadata is already there
    // i.e. changes since the local participant has joined
    const validTracks = new Map();
    const newTracks = new Map();
    info.tracks.forEach(ti => {
      var _a, _b;
      let publication = this.getTrackPublicationBySid(ti.sid);
      if (!publication) {
        // new publication
        const kind = Track.kindFromProto(ti.type);
        if (!kind) {
          return;
        }
        publication = new RemoteTrackPublication(kind, ti, (_a = this.signalClient.connectOptions) === null || _a === void 0 ? void 0 : _a.autoSubscribe, {
          loggerContextCb: () => this.logContext,
          loggerName: (_b = this.loggerOptions) === null || _b === void 0 ? void 0 : _b.loggerName
        });
        publication.updateInfo(ti);
        newTracks.set(ti.sid, publication);
        const existingTrackOfSource = Array.from(this.trackPublications.values()).find(publishedTrack => publishedTrack.source === (publication === null || publication === void 0 ? void 0 : publication.source));
        if (existingTrackOfSource && publication.source !== Track.Source.Unknown) {
          this.log.debug("received a second track publication for ".concat(this.identity, " with the same source: ").concat(publication.source), Object.assign(Object.assign({}, this.logContext), {
            oldTrack: getLogContextFromTrack(existingTrackOfSource),
            newTrack: getLogContextFromTrack(publication)
          }));
        }
        this.addTrackPublication(publication);
      } else {
        publication.updateInfo(ti);
      }
      validTracks.set(ti.sid, publication);
    });
    // detect removed tracks
    this.trackPublications.forEach(publication => {
      if (!validTracks.has(publication.trackSid)) {
        this.log.trace('detected removed track on remote participant, unpublishing', Object.assign(Object.assign({}, this.logContext), getLogContextFromTrack(publication)));
        this.unpublishTrack(publication.trackSid, true);
      }
    });
    // always emit events for new publications, Room will not forward them unless it's ready
    newTracks.forEach(publication => {
      this.emit(ParticipantEvent.TrackPublished, publication);
    });
    return true;
  }
  /** @internal */
  unpublishTrack(sid, sendUnpublish) {
    const publication = this.trackPublications.get(sid);
    if (!publication) {
      return;
    }
    // also send unsubscribe, if track is actively subscribed
    const track = publication.track;
    if (track) {
      track.stop();
      publication.setTrack(undefined);
    }
    // remove track from maps only after unsubscribed has been fired
    this.trackPublications.delete(sid);
    // remove from the right type map
    switch (publication.kind) {
      case Track.Kind.Audio:
        this.audioTrackPublications.delete(sid);
        break;
      case Track.Kind.Video:
        this.videoTrackPublications.delete(sid);
        break;
    }
    if (sendUnpublish) {
      this.emit(ParticipantEvent.TrackUnpublished, publication);
    }
  }
  /**
   * @internal
   */
  setAudioOutput(output) {
    return __awaiter(this, void 0, void 0, function* () {
      this.audioOutput = output;
      const promises = [];
      this.audioTrackPublications.forEach(pub => {
        var _a;
        if (isAudioTrack(pub.track) && isRemoteTrack(pub.track)) {
          promises.push(pub.track.setSinkId((_a = output.deviceId) !== null && _a !== void 0 ? _a : 'default'));
        }
      });
      yield Promise.all(promises);
    });
  }
  /** @internal */
  addRemoteDataTrack(remoteDataTrack) {
    this.dataTracks.set(remoteDataTrack.info.name, remoteDataTrack);
  }
  /** @internal */
  removeRemoteDataTrack(remoteDataTrackSid) {
    for (const _ref of this.dataTracks.entries()) {
      var _ref2 = _slicedToArray(_ref, 2);
      const name = _ref2[0];
      const dataTrack = _ref2[1];
      if (remoteDataTrackSid === dataTrack.info.sid) {
        this.dataTracks.delete(name);
      }
    }
  }
  /** @internal */
  emit(event) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    this.log.trace('participant event', Object.assign(Object.assign({}, this.logContext), {
      event,
      args
    }));
    return super.emit(event, ...args);
  }
}export{RemoteParticipant as default};//# sourceMappingURL=RemoteParticipant.mjs.map
