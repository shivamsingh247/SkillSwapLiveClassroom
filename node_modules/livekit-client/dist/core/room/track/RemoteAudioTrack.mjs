import {__awaiter}from'tslib';import {TrackEvent}from'../events.mjs';import {computeBitrate}from'../stats.mjs';import {isReactNative,supportsSetSinkId}from'../utils.mjs';import RemoteTrack from'./RemoteTrack.mjs';import {Track}from'./Track.mjs';class RemoteAudioTrack extends RemoteTrack {
  constructor(mediaTrack, sid, receiver, audioContext, audioOutput, loggerOptions) {
    super(mediaTrack, sid, Track.Kind.Audio, receiver, loggerOptions);
    /**
     * the nodes of the graph currently wired up, in order, so teardown can undo exactly the edges
     * `connectWebAudio` created. Reading `webAudioPluginNodes` instead would miss the old plugins
     * once `setWebAudioPlugins` has replaced them.
     */
    this.connectedNodes = [];
    this.monitorReceiver = () => __awaiter(this, void 0, void 0, function* () {
      if (!this.receiver) {
        this._currentBitrate = 0;
        return;
      }
      const stats = yield this.getReceiverStats();
      if (stats && this.prevStats && this.receiver) {
        this._currentBitrate = computeBitrate(stats, this.prevStats);
      }
      this.prevStats = stats;
    });
    this.audioContext = audioContext;
    this.webAudioPluginNodes = [];
    if (audioOutput) {
      this.sinkId = audioOutput.deviceId;
    }
  }
  /**
   * sets the volume for all attached audio elements
   */
  setVolume(volume) {
    var _a;
    if (this.audioContext) {
      // playback goes through the web audio graph, the attached elements themselves stay silent
      (_a = this.gainNode) === null || _a === void 0 ? void 0 : _a.gain.setTargetAtTime(volume, 0, 0.1);
    } else {
      for (const el of this.attachedElements) {
        el.volume = volume;
      }
    }
    if (isReactNative()) {
      // @ts-ignore
      this._mediaStreamTrack._setVolume(volume);
    }
    this.elementVolume = volume;
  }
  /**
   * gets the volume of attached audio elements (loudest)
   */
  getVolume() {
    if (this.elementVolume !== undefined) {
      return this.elementVolume;
    }
    if (isReactNative()) {
      // RN volume value defaults to 1.0 if hasn't been changed.
      return 1.0;
    }
    let highestVolume = 0;
    this.attachedElements.forEach(element => {
      if (element.volume > highestVolume) {
        highestVolume = element.volume;
      }
    });
    return highestVolume;
  }
  /**
   * calls setSinkId on all attached elements, if supported
   * @param deviceId audio output device
   */
  setSinkId(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      this.sinkId = deviceId;
      yield Promise.all(this.attachedElements.map(elm => {
        if (!supportsSetSinkId(elm)) {
          return;
        }
        /* @ts-ignore */
        return elm.setSinkId(deviceId);
      }));
    });
  }
  attach(element) {
    // the graph is fed by the track rather than by a specific element, so one connection covers
    // all attached elements
    const needsNewWebAudioConnection = !this.sourceNode;
    if (!element) {
      element = super.attach();
    } else {
      super.attach(element);
    }
    if (this.sinkId && supportsSetSinkId(element)) {
      element.setSinkId(this.sinkId).catch(e => {
        this.log.error('Failed to set sink id on remote audio track', e, this.logContext);
      });
    }
    if (this.audioContext) {
      // audio is routed through the web audio graph, so every attached element has to stay
      // silent, no matter whether it is the one the graph was built from
      element.volume = 0;
      element.muted = true;
      if (needsNewWebAudioConnection) {
        this.log.debug('using audio context mapping', this.logContext);
        this.connectWebAudio(this.audioContext, element);
      }
    }
    if (this.elementVolume !== undefined) {
      // make sure volume setting is being applied to the newly attached element
      this.setVolume(this.elementVolume);
    }
    return element;
  }
  detach(element) {
    let detached;
    if (!element) {
      detached = super.detach();
      this.disconnectWebAudio();
    } else {
      detached = super.detach(element);
      // if there are still any attached elements after detaching, connect webaudio to the first element that's left
      // disconnect webaudio otherwise
      if (this.audioContext) {
        if (this.attachedElements.length > 0) {
          this.connectWebAudio(this.audioContext, this.attachedElements[0]);
        } else {
          this.disconnectWebAudio();
        }
      }
    }
    return detached;
  }
  /**
   * @internal
   * @experimental
   */
  setAudioContext(audioContext) {
    var _a;
    if (this.audioContext === audioContext) {
      return;
    }
    this.audioContext = audioContext;
    if (audioContext) {
      // playback moves into the web audio graph, mute the elements to avoid double playback
      for (const element of this.attachedElements) {
        element.volume = 0;
        element.muted = true;
      }
      if (this.attachedElements.length > 0) {
        this.connectWebAudio(audioContext, this.attachedElements[0]);
      }
    } else {
      this.disconnectWebAudio();
      // playback moves back into the elements, which `attach` had muted in favour of the graph
      for (const element of this.attachedElements) {
        element.muted = false;
        element.volume = (_a = this.elementVolume) !== null && _a !== void 0 ? _a : 1;
      }
    }
  }
  /**
   * @internal
   * @experimental
   * @param {AudioNode[]} nodes - An array of WebAudio nodes. These nodes should not be connected to each other when passed, as the sdk will take care of connecting them in the order of the array.
   */
  setWebAudioPlugins(nodes) {
    this.webAudioPluginNodes = nodes;
    if (this.attachedElements.length > 0 && this.audioContext) {
      this.connectWebAudio(this.audioContext, this.attachedElements[0]);
    }
  }
  connectWebAudio(context, element) {
    this.disconnectWebAudio();
    // @ts-ignore attached elements always have a srcObject set
    this.sourceNode = context.createMediaStreamSource(element.srcObject);
    let lastNode = this.sourceNode;
    this.connectedNodes = [this.sourceNode];
    this.webAudioPluginNodes.forEach(node => {
      lastNode.connect(node);
      lastNode = node;
      this.connectedNodes.push(node);
    });
    this.gainNode = context.createGain();
    lastNode.connect(this.gainNode);
    this.connectedNodes.push(this.gainNode);
    this.gainNode.connect(context.destination);
    if (this.elementVolume !== undefined) {
      this.gainNode.gain.setTargetAtTime(this.elementVolume, 0, 0.1);
    }
    // try to resume the context if it isn't running already
    if (context.state !== 'running') {
      context.resume().then(() => {
        if (context.state !== 'running') {
          this.emit(TrackEvent.AudioPlaybackFailed, new Error("Audio Context couldn't be started automatically"));
        }
      }).catch(e => {
        this.emit(TrackEvent.AudioPlaybackFailed, e);
      });
    }
  }
  disconnectWebAudio() {
    var _a, _b;
    // the plugin nodes belong to whoever passed them in and may feed graphs of their own, so only
    // the edges this track created come down. A bare `node.disconnect()` would drop the
    // application's own routing with them
    for (let i = 0; i < this.connectedNodes.length - 1; i += 1) {
      try {
        this.connectedNodes[i].disconnect(this.connectedNodes[i + 1]);
      } catch (_c) {
        // a plugin node the application already disconnected itself, the rest of the chain still
        // has to come apart
      }
    }
    this.connectedNodes = [];
    // the source and gain nodes are ours alone, so every remaining edge of theirs is ours to drop
    (_a = this.gainNode) === null || _a === void 0 ? void 0 : _a.disconnect();
    (_b = this.sourceNode) === null || _b === void 0 ? void 0 : _b.disconnect();
    this.gainNode = undefined;
    this.sourceNode = undefined;
  }
  getReceiverStats() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.receiver || !this.receiver.getStats) {
        return;
      }
      const stats = yield this.receiver.getStats();
      let receiverStats;
      stats.forEach(v => {
        if (v.type === 'inbound-rtp') {
          receiverStats = {
            type: 'audio',
            streamId: v.id,
            timestamp: v.timestamp,
            jitter: v.jitter,
            bytesReceived: v.bytesReceived,
            concealedSamples: v.concealedSamples,
            concealmentEvents: v.concealmentEvents,
            silentConcealedSamples: v.silentConcealedSamples,
            silentConcealmentEvents: v.silentConcealmentEvents,
            totalAudioEnergy: v.totalAudioEnergy,
            totalSamplesDuration: v.totalSamplesDuration
          };
        }
      });
      return receiverStats;
    });
  }
}export{RemoteAudioTrack as default};//# sourceMappingURL=RemoteAudioTrack.mjs.map
