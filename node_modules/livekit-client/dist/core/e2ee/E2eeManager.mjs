import {__awaiter}from'tslib';import {Encryption_Type}from'@livekit/protocol';import {EventEmitter}from'events';import {getPublishFrameMetadata,hasFrameMetadataPublishOptions}from'../frameMetadata/utils.mjs';import {getLogger,LoggerNames,workerLogger,onWorkerLogLevelChanged}from'../logger.mjs';import {ConnectionState}from'../room/CoreRoom.mjs';import {DeviceUnsupportedError}from'../room/errors.mjs';import {EngineEvent,RoomEvent,ParticipantEvent}from'../room/events.mjs';import RemoteVideoTrack from'../room/track/RemoteVideoTrack.mjs';import {mimeTypeToVideoCodecString}from'../room/track/utils.mjs';import {isVideoTrack,isSafariBased,Future,isLocalTrack,isScriptTransformSupportedForWorker}from'../room/utils.mjs';import {E2EE_FLAG,E2EE_TRACK_ID}from'./constants.mjs';import {CryptorError,CryptorErrorReason}from'./errors.mjs';import {KeyProviderEvent,EncryptionEvent}from'./events.mjs';import {isE2EESupported}from'./utils.mjs';/**
 * @experimental
 */
class E2EEManager extends EventEmitter {
  get logContext() {
    var _a, _b;
    return {
      room: (_a = this.room) === null || _a === void 0 ? void 0 : _a.name,
      participant: (_b = this.room) === null || _b === void 0 ? void 0 : _b.localParticipant.identity
    };
  }
  constructor(options, dcEncryptionEnabled) {
    super();
    this.keysPostedToWorker = new WeakSet();
    this.decryptDataRequests = new Map();
    this.encryptDataRequests = new Map();
    this.log = getLogger(LoggerNames.E2EE, () => this.logContext);
    this.onWorkerMessage = ev => {
      var _a;
      const _ev$data = ev.data,
        kind = _ev$data.kind,
        data = _ev$data.data;
      switch (kind) {
        case 'error':
          // If error has uuid, it's from an async operation (encrypt/decrypt).
          // Reject the corresponding future and let the caller decide how to log/handle;
          // logging here would duplicate whatever the caller does.
          if (data.uuid) {
            const decryptFuture = this.decryptDataRequests.get(data.uuid);
            if (decryptFuture === null || decryptFuture === void 0 ? void 0 : decryptFuture.reject) {
              decryptFuture.reject(data.error);
              break;
            }
            const encryptFuture = this.encryptDataRequests.get(data.uuid);
            if (encryptFuture === null || encryptFuture === void 0 ? void 0 : encryptFuture.reject) {
              encryptFuture.reject(data.error);
              break;
            }
          }
          this.log.error(data.error.message);
          this.emit(EncryptionEvent.EncryptionError, data.error, data.participantIdentity);
          break;
        case 'initAck':
          if (data.enabled) {
            this.keyProvider.getKeys().forEach(keyInfo => {
              this.postKey(keyInfo, false);
            });
          }
          break;
        case 'enable':
          if (data.local) {
            if (this.encryptionEnabled !== data.enabled) {
              this.emit(EncryptionEvent.ParticipantEncryptionStatusChanged, data.enabled, this.room.localParticipant);
              this.encryptionEnabled = data.enabled;
            }
          } else if (data.participantIdentity) {
            const participant = (_a = this.room) === null || _a === void 0 ? void 0 : _a.getParticipantByIdentity(data.participantIdentity);
            if (!participant) {
              throw TypeError("couldn't set encryption status, participant not found".concat(data.participantIdentity));
            }
            this.emit(EncryptionEvent.ParticipantEncryptionStatusChanged, data.enabled, participant);
          }
          break;
        case 'ratchetKey':
          this.keyProvider.emit(KeyProviderEvent.KeyRatcheted, data.ratchetResult, data.participantIdentity, data.keyIndex);
          break;
        case 'decryptDataResponse':
          const decryptFuture = this.decryptDataRequests.get(data.uuid);
          if (decryptFuture === null || decryptFuture === void 0 ? void 0 : decryptFuture.resolve) {
            decryptFuture.resolve(data);
          }
          break;
        case 'encryptDataResponse':
          const encryptFuture = this.encryptDataRequests.get(data.uuid);
          if (encryptFuture === null || encryptFuture === void 0 ? void 0 : encryptFuture.resolve) {
            encryptFuture.resolve(data);
          }
          break;
        case 'packetTrailerMetadata':
          this.handleFrameMetadata(data.trackId, data.rtpTimestamp, data.ssrc, data.metadata);
          break;
        case 'log':
          workerLogger[data.level](data.msg, data.context);
          break;
      }
    };
    this.onWorkerError = ev => {
      this.log.error('e2ee worker encountered an error:', {
        error: ev.error
      });
      this.emit(EncryptionEvent.EncryptionError, ev.error, undefined);
    };
    this.keyProvider = options.keyProvider;
    this.worker = options.worker;
    this.encryptionEnabled = false;
    this.dataChannelEncryptionEnabled = dcEncryptionEnabled;
  }
  get isEnabled() {
    return this.encryptionEnabled;
  }
  get isDataChannelEncryptionEnabled() {
    return this.isEnabled && this.dataChannelEncryptionEnabled;
  }
  /**
   * @internal
   */
  setup(room) {
    if (!isE2EESupported()) {
      throw new DeviceUnsupportedError('tried to setup end-to-end encryption on an unsupported browser');
    }
    this.log.info('setting up e2ee');
    if (room !== this.room) {
      this.room = room;
      this.setupEventListeners(room, this.keyProvider);
      // this.worker = new Worker('');
      const msg = {
        kind: 'init',
        data: {
          keyProviderOptions: this.keyProvider.getOptions(),
          loglevel: workerLogger.getLevel()
        }
      };
      if (this.worker) {
        this.log.info("initializing worker", {
          worker: this.worker
        });
        this.worker.onmessage = this.onWorkerMessage;
        this.worker.onerror = this.onWorkerError;
        this.worker.postMessage(msg);
        this.subscribeToLogLevelChanges();
      }
    }
  }
  /**
   * Subscribe the current worker to main-thread `workerLogger` level changes,
   * without strongly retaining `this` or `this.worker` from the module-global
   * listener Set on the logger. See {@link disposeRegistry}.
   */
  subscribeToLogLevelChanges() {
    var _a;
    // Guard against duplicate registration on re-setup.
    (_a = this.unsubscribeLogLevel) === null || _a === void 0 ? void 0 : _a.call(this);
    let unsub;
    if (E2EEManager.disposeRegistry) {
      // Modern engines: hold the worker weakly so the module-global listener Set
      // on the logger can't retain this manager, and clean up the entry on GC.
      const workerRef = new WeakRef(this.worker);
      unsub = onWorkerLogLevelChanged(level => {
        const worker = workerRef.deref();
        if (!worker) {
          unsub === null || unsub === void 0 ? void 0 : unsub();
          return;
        }
        worker.postMessage({
          kind: 'setLogLevel',
          data: {
            level
          }
        });
      });
      E2EEManager.disposeRegistry.register(this, unsub, this);
    } else {
      // Safari <14.1 and similar: no WeakRef. Fall back to a strong reference;
      // the leak lives until the consumer calls `dispose()`.
      const worker = this.worker;
      unsub = onWorkerLogLevelChanged(level => {
        worker.postMessage({
          kind: 'setLogLevel',
          data: {
            level
          }
        });
      });
    }
    this.unsubscribeLogLevel = unsub;
  }
  /**
   * @internal
   * Release the log-level subscription, reject any pending encrypt/decrypt
   * futures, and detach the worker message handlers. The worker itself is
   * caller-owned and is not terminated. Idempotent.
   */
  dispose() {
    var _a, _b, _c;
    (_a = this.unsubscribeLogLevel) === null || _a === void 0 ? void 0 : _a.call(this);
    this.unsubscribeLogLevel = undefined;
    if (E2EEManager.disposeRegistry) {
      E2EEManager.disposeRegistry.unregister(this);
    }
    // Reject pending futures BEFORE detaching worker handlers, so any late
    // response can't resolve one after we've cut the pipe. Each future's
    // `onFinally` deletes its own map entry, so both maps drain themselves.
    // Snapshot before iterating in case a rejection handler mutates the map.
    const disposalError = new CryptorError('E2EEManager disposed', CryptorErrorReason.InternalError);
    for (const future of [...this.encryptDataRequests.values()]) {
      (_b = future.reject) === null || _b === void 0 ? void 0 : _b.call(future, disposalError);
    }
    for (const future of [...this.decryptDataRequests.values()]) {
      (_c = future.reject) === null || _c === void 0 ? void 0 : _c.call(future, disposalError);
    }
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
    }
    this.removeAllListeners();
  }
  /**
   * Sets whether the local participant encrypts.
   * @internal
   */
  setLocalParticipantCryptorEnabled(enabled) {
    var _a, _b;
    this.log.debug("set e2ee to ".concat(enabled, " for the local participant"));
    this.postEnable(enabled, (_b = (_a = this.room) === null || _a === void 0 ? void 0 : _a.localParticipant.identity) !== null && _b !== void 0 ? _b : '', true);
  }
  /**
   * @internal
   * @deprecated use `setLocalParticipantCryptorEnabled`. The identity is ignored: this always
   * sets the state of the local participant.
   */
  setParticipantCryptorEnabled(enabled, _participantIdentity) {
    this.setLocalParticipantCryptorEnabled(enabled);
  }
  /**
   * @internal
   */
  setSifTrailer(trailer) {
    if (!trailer || trailer.length === 0) {
      this.log.warn("ignoring server sent trailer as it's empty");
    } else {
      this.postSifTrailer(trailer);
    }
  }
  handleFrameMetadata(trackId, rtpTimestamp, ssrc, metadata) {
    if (!this.room) {
      return;
    }
    for (const participant of [this.room.localParticipant, ...this.room.remoteParticipants.values()]) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.track && pub.track.mediaStreamID === trackId && pub.track instanceof RemoteVideoTrack && pub.track.frameMetadataExtractor) {
          pub.track.frameMetadataExtractor.storeMetadata(rtpTimestamp, ssrc, metadata);
          return;
        }
      }
    }
  }
  setupEngine(engine) {
    engine.on(EngineEvent.RTPVideoMapUpdate, rtpMap => {
      this.postRTPMap(rtpMap);
    });
  }
  setupEventListeners(room, keyProvider) {
    room.on(RoomEvent.TrackPublished, (pub, participant) => this.setParticipantCryptorEnabledForPublication(pub, participant.identity));
    room.on(RoomEvent.ConnectionStateChanged, state => {
      if (state === ConnectionState.Connected) {
        room.remoteParticipants.forEach(participant => {
          participant.trackPublications.forEach(pub => {
            this.setParticipantCryptorEnabledForPublication(pub, participant.identity);
          });
        });
      }
    }).on(RoomEvent.TrackUnsubscribed, (track, _, participant) => {
      var _a;
      const msg = {
        kind: 'removeTransform',
        data: {
          participantIdentity: participant.identity,
          trackId: track.mediaStreamID
        }
      };
      (_a = this.worker) === null || _a === void 0 ? void 0 : _a.postMessage(msg);
    }).on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      this.setupE2EEReceiver(track, participant.identity, pub.trackInfo);
    }).on(RoomEvent.SignalConnected, () => {
      if (!this.room) {
        throw new TypeError("expected room to be present on signal connect");
      }
      const latestKeyIndex = keyProvider.getLatestManuallySetKeyIndex();
      keyProvider.getKeys().filter(keyInfo => !this.keysPostedToWorker.has(keyInfo)).forEach(keyInfo => {
        var _a;
        this.postKey(keyInfo, latestKeyIndex === ((_a = keyInfo.keyIndex) !== null && _a !== void 0 ? _a : 0));
      });
      this.setLocalParticipantCryptorEnabled(this.room.localParticipant.isE2EEEnabled);
    });
    room.localParticipant.on(ParticipantEvent.LocalSenderCreated, (sender, track) => __awaiter(this, void 0, void 0, function* () {
      this.setupE2EESender(track, sender);
    }));
    room.localParticipant.on(ParticipantEvent.LocalTrackPublished, publication => {
      // Safari doesn't support retrieving payload information on RTCEncodedVideoFrame, so we need to update the codec manually once we have the trackInfo from the server
      if (!isVideoTrack(publication.track) || !isSafariBased()) {
        return;
      }
      const msg = {
        kind: 'updateCodec',
        data: {
          trackId: publication.track.mediaStreamID,
          codec: mimeTypeToVideoCodecString(publication.trackInfo.codecs[0].mimeType),
          participantIdentity: this.room.localParticipant.identity,
          hasPacketTrailer: false,
          operation: 'encode'
        }
      };
      this.worker.postMessage(msg);
    });
    keyProvider.on(KeyProviderEvent.SetKey, (keyInfo, updateCurrentKeyIndex) => this.postKey(keyInfo, updateCurrentKeyIndex !== null && updateCurrentKeyIndex !== void 0 ? updateCurrentKeyIndex : true)).on(KeyProviderEvent.RatchetRequest, (participantId, keyIndex) => this.postRatchetRequest(participantId, keyIndex));
  }
  encryptData(data) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.worker) {
        throw Error('could not encrypt data, worker is missing');
      }
      const uuid = crypto.randomUUID();
      const msg = {
        kind: 'encryptDataRequest',
        data: {
          uuid,
          payload: data,
          participantIdentity: this.room.localParticipant.identity
        }
      };
      const future = new Future();
      future.onFinally = () => {
        this.encryptDataRequests.delete(uuid);
      };
      this.encryptDataRequests.set(uuid, future);
      this.worker.postMessage(msg);
      return future.promise;
    });
  }
  handleEncryptedData(payload, iv, participantIdentity, keyIndex) {
    if (!this.worker) {
      throw Error('could not handle encrypted data, worker is missing');
    }
    const uuid = crypto.randomUUID();
    const msg = {
      kind: 'decryptDataRequest',
      data: {
        uuid,
        payload,
        iv,
        participantIdentity,
        keyIndex
      }
    };
    const future = new Future();
    future.onFinally = () => {
      this.decryptDataRequests.delete(uuid);
    };
    this.decryptDataRequests.set(uuid, future);
    this.worker.postMessage(msg);
    return future.promise;
  }
  postRatchetRequest(participantIdentity, keyIndex) {
    if (!this.worker) {
      throw Error('could not ratchet key, worker is missing');
    }
    const msg = {
      kind: 'ratchetRequest',
      data: {
        participantIdentity: participantIdentity,
        keyIndex
      }
    };
    this.worker.postMessage(msg);
  }
  postKey(keyInfo, updateCurrentKeyIndex) {
    var _a;
    if (!this.worker) {
      throw Error('could not set key, worker is missing');
    }
    const key = keyInfo.key,
      participantIdentity = keyInfo.participantIdentity,
      keyIndex = keyInfo.keyIndex;
    const msg = {
      kind: 'setKey',
      data: {
        participantIdentity: participantIdentity,
        isPublisher: participantIdentity === ((_a = this.room) === null || _a === void 0 ? void 0 : _a.localParticipant.identity),
        key,
        keyIndex,
        updateCurrentKeyIndex
      }
    };
    this.worker.postMessage(msg);
    this.keysPostedToWorker.add(keyInfo);
  }
  postEnable(enabled, participantIdentity) {
    let local = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    if (this.worker) {
      const enableMsg = {
        kind: 'enable',
        data: {
          enabled,
          participantIdentity,
          local
        }
      };
      this.worker.postMessage(enableMsg);
    } else {
      throw new ReferenceError('failed to enable e2ee, worker is not ready');
    }
  }
  postRTPMap(map) {
    var _a;
    if (!this.worker) {
      throw TypeError('could not post rtp map, worker is missing');
    }
    if (!((_a = this.room) === null || _a === void 0 ? void 0 : _a.localParticipant.identity)) {
      throw TypeError('could not post rtp map, local participant identity is missing');
    }
    const msg = {
      kind: 'setRTPMap',
      data: {
        map,
        participantIdentity: this.room.localParticipant.identity
      }
    };
    this.worker.postMessage(msg);
  }
  postSifTrailer(trailer) {
    if (!this.worker) {
      throw Error('could not post SIF trailer, worker is missing');
    }
    const msg = {
      kind: 'setSifTrailer',
      data: {
        trailer
      }
    };
    this.worker.postMessage(msg);
  }
  /**
   * Derive the participant's encryption state from one of its publications.
   * Publications without trackInfo are skipped rather than thrown on: throwing
   * inside the forEach above would leave every remaining participant without an
   * encryption state, and a cryptor with unknown state can no longer decrypt.
   */
  setParticipantCryptorEnabledForPublication(pub, participantIdentity) {
    if (!pub.trackInfo) {
      this.log.warn('skipping e2ee enabled update for publication without trackInfo', {
        trackSid: pub.trackSid
      });
      return;
    }
    this.postEnable(pub.trackInfo.encryption !== Encryption_Type.NONE, participantIdentity);
  }
  setupE2EEReceiver(track, remoteId, trackInfo) {
    if (!track.receiver) {
      return;
    }
    if (!(trackInfo === null || trackInfo === void 0 ? void 0 : trackInfo.mimeType) || trackInfo.mimeType === '') {
      throw new TypeError('MimeType missing from trackInfo, cannot set up E2EE cryptor');
    }
    const hasPacketTrailer = track.kind === 'video' && !!trackInfo.packetTrailerFeatures && trackInfo.packetTrailerFeatures.length > 0;
    this.handleReceiver(track.receiver, track.mediaStreamID, remoteId, track.kind === 'video' ? mimeTypeToVideoCodecString(trackInfo.mimeType) : undefined, hasPacketTrailer, trackInfo.encryption !== Encryption_Type.NONE);
  }
  setupE2EESender(track, sender) {
    var _a;
    if (!isLocalTrack(track) || !sender) {
      if (!sender) this.log.warn('early return because sender is not ready');
      return;
    }
    const isVideo = isVideoTrack(track);
    // Safari exposes no per-frame codec info until trackInfo arrives. Seed only h264/h265:
    // a wrong vp8 seed would skip the NALU path, a wrong NALU seed only costs a logged fallback.
    const publishedCodec = isVideo ? (_a = track.publishOptions) === null || _a === void 0 ? void 0 : _a.videoCodec : undefined;
    this.handleSender(sender, track.mediaStreamID, publishedCodec === 'h264' || publishedCodec === 'h265' ? publishedCodec : undefined, isVideo ? getPublishFrameMetadata(track.publishOptions) : undefined);
  }
  /**
   * Handles the given {@code RTCRtpReceiver} by creating a {@code TransformStream} which will inject
   * a frame decoder.
   *
   */
  handleReceiver(receiver, trackId, participantIdentity, codec, hasPacketTrailer, encrypted) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.worker) {
        return;
      }
      if (isScriptTransformSupportedForWorker()) {
        const options = {
          kind: 'decode',
          participantIdentity,
          trackId,
          codec,
          hasPacketTrailer,
          encrypted
        };
        receiver.transform = new RTCRtpScriptTransform(this.worker, options);
      } else {
        if (E2EE_FLAG in receiver && E2EE_TRACK_ID in receiver) {
          // The transceiver is being reused for a new track. We cannot set up a new
          // pipeline from here: this receiver's encoded streams were transferred to
          // the worker on first setup and a transferred stream can't be transferred
          // again, while createEncodedStreams() may only be called once per receiver.
          // So hand the worker the new track/participant and let it re-point (and if
          // necessary rebuild) the cryptor that still owns those streams.
          const msg = {
            kind: 'updateCodec',
            data: {
              trackId,
              previousTrackId: receiver[E2EE_TRACK_ID],
              codec,
              participantIdentity,
              hasPacketTrailer,
              encrypted
            }
          };
          this.worker.postMessage(msg);
          receiver[E2EE_TRACK_ID] = trackId;
          return;
        }
        // @ts-ignore
        let writable = receiver.writableStream;
        // @ts-ignore
        let readable = receiver.readableStream;
        if (!writable || !readable) {
          // @ts-ignore
          const receiverStreams = receiver.createEncodedStreams();
          // @ts-ignore
          receiver.writableStream = receiverStreams.writable;
          writable = receiverStreams.writable;
          // @ts-ignore
          receiver.readableStream = receiverStreams.readable;
          readable = receiverStreams.readable;
        }
        const msg = {
          kind: 'decode',
          data: {
            readableStream: readable,
            writableStream: writable,
            trackId: trackId,
            codec,
            participantIdentity: participantIdentity,
            hasPacketTrailer,
            encrypted
          }
        };
        this.worker.postMessage(msg, [readable, writable]);
      }
      // @ts-ignore
      receiver[E2EE_FLAG] = true;
      // @ts-ignore
      receiver[E2EE_TRACK_ID] = trackId;
    });
  }
  /**
   * Handles the given {@code RTCRtpSender} by creating a {@code TransformStream} which will inject
   * a frame encoder.
   *
   */
  handleSender(sender, trackId, codec, frameMetadata) {
    var _a;
    if (E2EE_FLAG in sender || !this.worker) {
      return;
    }
    if (!((_a = this.room) === null || _a === void 0 ? void 0 : _a.localParticipant.identity) || this.room.localParticipant.identity === '') {
      throw TypeError('local identity needs to be known in order to set up encrypted sender');
    }
    if (isScriptTransformSupportedForWorker()) {
      this.log.info('initialize script transform');
      const options = {
        kind: 'encode',
        participantIdentity: this.room.localParticipant.identity,
        trackId,
        codec,
        hasPacketTrailer: hasFrameMetadataPublishOptions(frameMetadata),
        packetTrailer: frameMetadata
      };
      // @ts-ignore
      sender.transform = new RTCRtpScriptTransform(this.worker, options);
    } else {
      this.log.info('initialize encoded streams');
      // @ts-ignore
      const senderStreams = sender.createEncodedStreams();
      const msg = {
        kind: 'encode',
        data: {
          readableStream: senderStreams.readable,
          writableStream: senderStreams.writable,
          codec,
          trackId,
          participantIdentity: this.room.localParticipant.identity,
          hasPacketTrailer: hasFrameMetadataPublishOptions(frameMetadata),
          packetTrailer: frameMetadata
        }
      };
      this.worker.postMessage(msg, [senderStreams.readable, senderStreams.writable]);
    }
    // @ts-ignore
    sender[E2EE_FLAG] = true;
  }
}
/**
 * Runs a cleanup callback once this manager is garbage collected. Lets the
 * log-level listener (held in a module-global Set on the main-thread logger)
 * fall out of scope even when the consumer forgets to call `dispose()`.
 */
E2EEManager.disposeRegistry = typeof FinalizationRegistry !== 'undefined' && typeof WeakRef !== 'undefined' && new FinalizationRegistry(cleanup => {
  cleanup();
});export{E2EEManager};//# sourceMappingURL=E2eeManager.mjs.map
