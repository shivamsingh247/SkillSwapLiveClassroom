import {slicedToArray as _slicedToArray}from'../../../_virtual/_rollupPluginBabelHelpers.mjs';import {__awaiter}from'tslib';import'@livekit/protocol';import {EventEmitter}from'events';import {getLogger,LoggerNames}from'../../../logger.mjs';import {abortSignalTimeout,abortSignalAny}from'../../../utils/abort-signal-polyfill.mjs';import {Future}from'../../utils.mjs';import RemoteDataTrack from'../RemoteDataTrack.mjs';import'../depacketizer.mjs';import {DataTrackFrameInternal}from'../frame.mjs';import'../handle.mjs';import {DataTrackPacket}from'../packet/index.mjs';import {DataTrackSubscribeError}from'./errors.mjs';import IncomingDataTrackPipeline from'./pipeline.mjs';const log = /* @__PURE__ */getLogger(LoggerNames.DataTracks);
/** How long to wait when attempting to subscribe before timing out. */
const SUBSCRIBE_TIMEOUT_MILLISECONDS = 10000;
/** Maximum number of {@link DataTrackFrame}s that are cached for each ReadableStream subscription.
 * If data comes in too fast and saturates this threshold, backpressure will be applied. */
const READABLE_STREAM_DEFAULT_BUFFER_SIZE = 16;
class IncomingDataTrackManager extends EventEmitter {
  constructor(options) {
    var _a;
    super();
    /** Mapping between track SID and descriptor. */
    this.descriptors = new Map();
    /** Mapping between subscriber handle and track SID.
     *
     * This is an index that allows track descriptors to be looked up
     * by subscriber handle in O(1) time, to make routing incoming packets
     * (a hot code path) faster.
     */
    this.subscriptionHandles = new Map();
    this.e2eeManager = (_a = options === null || options === void 0 ? void 0 : options.e2eeManager) !== null && _a !== void 0 ? _a : null;
  }
  /** @internal */
  updateE2eeManager(e2eeManager) {
    this.e2eeManager = e2eeManager;
    // Propegate downwards to all pre-existing pipelines
    for (const descriptor of this.descriptors.values()) {
      if (descriptor.subscription.type === 'active') {
        descriptor.subscription.pipeline.updateE2eeManager(e2eeManager);
      }
    }
  }
  /** @internal */
  setPipelineOptions(sid, options) {
    const descriptor = this.descriptors.get(sid);
    if (!descriptor) {
      log.warn("Unknown track ".concat(sid, ", cannot set pipeline options."));
      return;
    }
    descriptor.pipelineOptions = options;
    if (descriptor.subscription.type === 'active') {
      descriptor.subscription.pipeline.setOptions(options);
    }
  }
  /** Allocates a ReadableStream which emits when a new {@link DataTrackFrame} is received from the
   * SFU. The SFU subscription is initiated lazily when the stream is created.
   *
   * @returns A tuple of the ReadableStream and a Promise that resolves once the SFU subscription
   * is fully established / the stream is ready to receive frames.
   *
   * @internal
   **/
  openSubscriptionStream(sid, signal) {
    let bufferSize = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : READABLE_STREAM_DEFAULT_BUFFER_SIZE;
    let streamController = null;
    const sfuSubscriptionComplete = new Future();
    // Hold the descriptor by reference: SID reassignment re-keys the map, so lookups
    // with the SID captured at subscribe time would fail.
    const descriptor = this.descriptors.get(sid);
    const detachSignal = () => {
      signal === null || signal === void 0 ? void 0 : signal.removeEventListener('abort', onAbort);
    };
    const cleanup = () => {
      detachSignal();
      if (!streamController) {
        log.warn("ReadableStream subscribed to ".concat(sid, " was not started."));
        return;
      }
      if (!descriptor || this.descriptors.get(descriptor.info.sid) !== descriptor) {
        log.warn("Unknown track ".concat(sid, ", skipping cancel..."));
        return;
      }
      if (descriptor.subscription.type !== 'active') {
        log.warn("Subscription for track ".concat(sid, " is not active, skipping cancel..."));
        return;
      }
      descriptor.subscription.streamControllers.delete(streamController);
      // If no active stream controllers are left, also unsubscribe on the SFU end.
      if (descriptor.subscription.streamControllers.size === 0) {
        this.unSubscribeRequest(descriptor.info.sid);
      }
    };
    const onAbort = () => {
      var _a;
      if (!streamController) {
        return;
      }
      if ((descriptor === null || descriptor === void 0 ? void 0 : descriptor.subscription.type) === 'active') {
        descriptor.subscription.streamControllers.delete(streamController);
      }
      streamController.error(DataTrackSubscribeError.cancelled());
      (_a = sfuSubscriptionComplete.reject) === null || _a === void 0 ? void 0 : _a.call(sfuSubscriptionComplete, DataTrackSubscribeError.cancelled());
      cleanup();
    };
    const stream = new ReadableStream({
      start: controller => {
        streamController = controller;
        this.subscribeRequest(sid, signal).then(() => __awaiter(this, void 0, void 0, function* () {
          var _a, _b, _c;
          if (!descriptor || this.descriptors.get(descriptor.info.sid) !== descriptor) {
            log.error("Unknown track ".concat(sid));
            const err = DataTrackSubscribeError.disconnected();
            controller.error(err);
            (_a = sfuSubscriptionComplete.reject) === null || _a === void 0 ? void 0 : _a.call(sfuSubscriptionComplete, err);
            return;
          }
          if (descriptor.subscription.type !== 'active') {
            log.error("Subscription for track ".concat(sid, " is not active"));
            const err = DataTrackSubscribeError.disconnected();
            controller.error(err);
            (_b = sfuSubscriptionComplete.reject) === null || _b === void 0 ? void 0 : _b.call(sfuSubscriptionComplete, err);
            return;
          }
          // Attach the abort signal, aborting immediately if the abort signal was fired while
          // subscribeRequest was in flight.
          if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            onAbort();
            return;
          }
          signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', onAbort);
          descriptor.subscription.streamControllers.set(controller, detachSignal);
          (_c = sfuSubscriptionComplete.resolve) === null || _c === void 0 ? void 0 : _c.call(sfuSubscriptionComplete);
        })).catch(err => {
          var _a;
          // subscribeRequest rejected (cancelled, timed out, disconnected). The signal
          // listener was never attached in this path, so nothing to detach.
          controller.error(err);
          (_a = sfuSubscriptionComplete.reject) === null || _a === void 0 ? void 0 : _a.call(sfuSubscriptionComplete, err);
        });
      },
      cancel: () => {
        cleanup();
      }
    }, new CountQueuingStrategy({
      highWaterMark: bufferSize
    }));
    return [stream, sfuSubscriptionComplete.promise];
  }
  /** Client requested to subscribe to a data track.
   *
   * This is sent when the user calls {@link RemoteDataTrack.subscribe}.
   *
   * Only the first request to subscribe to a given track incurs meaningful overhead; subsequent
   * requests simply attach an additional receiver to the broadcast channel, allowing them to consume
   * frames from the existing subscription pipeline.
   */
  subscribeRequest(sid, signal) {
    return __awaiter(this, void 0, void 0, function* () {
      const descriptor = this.descriptors.get(sid);
      if (!descriptor) {
        // @throws-transformer ignore - this should be treated as a "panic" and not be caught
        throw new Error('Cannot subscribe to unknown track');
      }
      const waitForCompletionFuture = (currentDescriptor, userProvidedSignal, timeoutSignal) => __awaiter(this, void 0, void 0, function* () {
        if (currentDescriptor.subscription.type === 'active') {
          // Subscription has already become active! So bail out early, there is nothing to wait for.
          return;
        }
        if (currentDescriptor.subscription.type !== 'pending') {
          // @throws-transformer ignore - this should be treated as a "panic" and not be caught
          throw new Error("Descriptor for track ".concat(sid, " is not pending, found ").concat(currentDescriptor.subscription.type));
        }
        const combinedSignal = abortSignalAny([userProvidedSignal, timeoutSignal].filter(s => typeof s !== 'undefined'));
        const proxiedCompletionFuture = new Future();
        currentDescriptor.subscription.completionFuture.promise.then(() => {
          var _a;
          return (_a = proxiedCompletionFuture.resolve) === null || _a === void 0 ? void 0 : _a.call(proxiedCompletionFuture);
        }).catch(err => {
          var _a;
          return (_a = proxiedCompletionFuture.reject) === null || _a === void 0 ? void 0 : _a.call(proxiedCompletionFuture, err);
        });
        const onAbort = () => {
          var _a;
          if (currentDescriptor.subscription.type !== 'pending') {
            return;
          }
          currentDescriptor.subscription.pendingRequestCount -= 1;
          if (timeoutSignal === null || timeoutSignal === void 0 ? void 0 : timeoutSignal.aborted) {
            // A timeout should apply to the underlying SFU subscription and cancel all user
            // subscriptions.
            currentDescriptor.subscription.cancel();
            return;
          }
          if (currentDescriptor.subscription.pendingRequestCount <= 0) {
            // No user subscriptions are still pending, so cancel the underlying pending `sfuUpdateSubscription`
            currentDescriptor.subscription.cancel();
            return;
          }
          // Other subscriptions are still pending for this data track, so just cancel this one
          // active user subscription, and leave the rest of the user subscriptions alone.
          (_a = proxiedCompletionFuture.reject) === null || _a === void 0 ? void 0 : _a.call(proxiedCompletionFuture, DataTrackSubscribeError.cancelled());
        };
        if (combinedSignal.aborted) {
          onAbort();
        }
        combinedSignal.addEventListener('abort', onAbort);
        yield proxiedCompletionFuture.promise;
        combinedSignal.removeEventListener('abort', onAbort);
      });
      switch (descriptor.subscription.type) {
        case 'none':
          {
            descriptor.subscription = {
              type: 'pending',
              completionFuture: new Future(),
              pendingRequestCount: 1,
              cancel: () => {
                var _a, _b;
                const previousDescriptorSubscription = descriptor.subscription;
                descriptor.subscription = {
                  type: 'none'
                };
                // Let the SFU know that the subscribe has been cancelled
                this.emit('sfuUpdateSubscription', {
                  sid: descriptor.info.sid,
                  subscribe: false
                });
                if (previousDescriptorSubscription.type === 'pending') {
                  (_b = (_a = previousDescriptorSubscription.completionFuture).reject) === null || _b === void 0 ? void 0 : _b.call(_a, timeoutSignal.aborted ? DataTrackSubscribeError.timeout() :
                  // NOTE: the below cancelled case was introduced by web / there isn't a corresponding case in the rust version.
                  DataTrackSubscribeError.cancelled());
                }
              }
            };
            this.emit('sfuUpdateSubscription', {
              sid,
              subscribe: true
            });
            const timeoutSignal = abortSignalTimeout(SUBSCRIBE_TIMEOUT_MILLISECONDS);
            // Wait for the subscription to complete, or time out if it takes too long
            yield waitForCompletionFuture(descriptor, signal, timeoutSignal);
            return;
          }
        case 'pending':
          {
            descriptor.subscription.pendingRequestCount += 1;
            // Wait for the subscription to complete
            yield waitForCompletionFuture(descriptor, signal);
            return;
          }
        case 'active':
          {
            return;
          }
      }
    });
  }
  /**
   * Get information about all currently subscribed tracks.
   * @internal */
  querySubscribed() {
    return __awaiter(this, void 0, void 0, function* () {
      const descriptorInfos = Array.from(this.descriptors.values()).filter(descriptor => descriptor.subscription.type === 'active').map(descriptor => [descriptor.info, descriptor.publisherIdentity]);
      return descriptorInfos;
    });
  }
  /** Client requested to unsubscribe from a data track. */
  unSubscribeRequest(sid) {
    var _a;
    const descriptor = this.descriptors.get(sid);
    if (!descriptor) {
      // FIXME: rust implementation returns here, not throws
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error('Cannot subscribe to unknown track');
    }
    if (descriptor.subscription.type !== 'active') {
      log.warn("Unexpected descriptor state in unSubscribeRequest, expected active, found ".concat((_a = descriptor.subscription) === null || _a === void 0 ? void 0 : _a.type));
      return;
    }
    this.closeStreamControllers(descriptor.subscription.streamControllers, sid);
    // FIXME: this might be wrong? Shouldn't this only occur if it is the last subscription to
    // terminate?
    const previousDescriptorSubscription = descriptor.subscription;
    descriptor.subscription = {
      type: 'none'
    };
    this.subscriptionHandles.delete(previousDescriptorSubscription.subcriptionHandle);
    this.emit('sfuUpdateSubscription', {
      sid,
      subscribe: false
    });
  }
  /** Detach abort-signal listeners and close all downstream stream controllers for an active
   * subscription. Used when the subscription is being torn down by the manager (unsubscribe,
   * unpublish, or shutdown). */
  closeStreamControllers(streamControllers, sid) {
    for (const _ref of streamControllers) {
      var _ref2 = _slicedToArray(_ref, 2);
      const controller = _ref2[0];
      const detachSignal = _ref2[1];
      // Detach before close so we don't leak a listener on the user's AbortSignal.
      detachSignal();
      try {
        controller.close();
      } catch (err) {
        // Defensive: if the controller has already been errored (e.g. by a racing abort whose
        // listener removed itself before we got here), close() throws. There's nothing
        // meaningful to do other than log — the stream is already terminal.
        log.warn("Failed to close readable stream for track ".concat(sid, ": ").concat(err));
      }
    }
  }
  /** SFU notification that track publications have changed.
   *
   * This event is produced from both {@link JoinResponse} and {@link ParticipantUpdate}
   * to provide a complete view of remote participants' track publications:
   *
   * - From a `JoinResponse`, it captures the initial set of tracks published when a participant joins.
   * - From a `ParticipantUpdate`, it captures subsequent changes (i.e., new tracks being
   *   published and existing tracks unpublished).
   */
  receiveSfuPublicationUpdates(updates) {
    return __awaiter(this, void 0, void 0, function* () {
      if (updates.size === 0) {
        return;
      }
      // Detect published track
      const publisherParticipantToSidsInUpdate = new Map();
      for (const _ref3 of updates.entries()) {
        var _ref4 = _slicedToArray(_ref3, 2);
        const publisherIdentity = _ref4[0];
        const infos = _ref4[1];
        const sidsInUpdate = new Set();
        for (const info of infos) {
          sidsInUpdate.add(info.sid);
          if (this.descriptors.has(info.sid)) {
            continue;
          }
          if (this.handleSidReassigned(publisherIdentity, info)) {
            continue;
          }
          yield this.handleTrackPublished(publisherIdentity, info);
        }
        publisherParticipantToSidsInUpdate.set(publisherIdentity, sidsInUpdate);
      }
      // Detect unpublished tracks
      for (const _ref5 of publisherParticipantToSidsInUpdate.entries()) {
        var _ref6 = _slicedToArray(_ref5, 2);
        const publisherIdentity = _ref6[0];
        const sidsInUpdate = _ref6[1];
        const descriptorsForPublisher = Array.from(this.descriptors.entries()).filter(_ref7 => {
          let _ref8 = _slicedToArray(_ref7, 2);
            _ref8[0];
            let descriptor = _ref8[1];
          return descriptor.publisherIdentity === publisherIdentity;
        }).map(_ref9 => {
          let _ref0 = _slicedToArray(_ref9, 1),
            sid = _ref0[0];
          return sid;
        });
        let unpublishedSids = descriptorsForPublisher.filter(sid => !sidsInUpdate.has(sid));
        for (const sid of unpublishedSids) {
          this.handleTrackUnpublished(sid);
        }
      }
    });
  }
  /**
   * Get information about all currently remotely published tracks which could be subscribed to.
   * @internal */
  queryPublications() {
    return __awaiter(this, void 0, void 0, function* () {
      return Array.from(this.descriptors.values()).map(descriptor => descriptor.info);
    });
  }
  handleTrackPublished(publisherIdentity, info) {
    return __awaiter(this, void 0, void 0, function* () {
      if (this.descriptors.has(info.sid)) {
        log.error("Existing descriptor for track ".concat(info.sid));
        return;
      }
      let descriptor = {
        info,
        publisherIdentity,
        subscription: {
          type: 'none'
        },
        pipelineOptions: {}
      };
      this.descriptors.set(descriptor.info.sid, descriptor);
      const track = new RemoteDataTrack(descriptor.info, this, {
        publisherIdentity
      });
      this.emit('trackPublished', {
        track
      });
    });
  }
  /**
   * Detects and handles SID reassignment, which occurs when the publisher
   * republishes its tracks after a full reconnect.
   *
   * Returns `true` if an SID reassignment occurred, `false` otherwise.
   */
  handleSidReassigned(publisherIdentity, info) {
    // Publisher identity and pub handle are stable across republications.
    const existingEntry = Array.from(this.descriptors.entries()).find(_ref1 => {
      let _ref10 = _slicedToArray(_ref1, 2);
        _ref10[0];
        let descriptor = _ref10[1];
      return descriptor.publisherIdentity === publisherIdentity && descriptor.info.pubHandle === info.pubHandle;
    });
    if (!existingEntry) {
      return false;
    }
    const _existingEntry = _slicedToArray(existingEntry, 2),
      oldSid = _existingEntry[0],
      descriptor = _existingEntry[1];
    // Invariant: other than SID, info should not have changed.
    // TODO: consider refactoring to move SID out of info to allow for direct comparison.
    const _descriptor$info = descriptor.info,
      name = _descriptor$info.name,
      usesE2ee = _descriptor$info.usesE2ee;
    if (name !== info.name || usesE2ee !== info.usesE2ee) {
      log.warn("Info mismatch for ".concat(oldSid, ", treating as new publication"));
      return false;
    }
    const newSid = info.sid;
    log.debug("SID reassigned: ".concat(oldSid, " -> ").concat(newSid));
    if (!this.descriptors.delete(oldSid)) {
      return false;
    }
    descriptor.info.sid = newSid;
    switch (descriptor.subscription.type) {
      case 'none':
        break;
      case 'pending':
      case 'active':
        // The SFU does not carry subscriptions across a publisher's full
        // reconnect; re-request the subscription under the new SID.
        this.emit('sfuUpdateSubscription', {
          sid: newSid,
          subscribe: true
        });
        break;
    }
    if (descriptor.subscription.type === 'active') {
      // Keep the routing index consistent until the SFU assigns a new handle
      // (see `registerSubscriberHandle`).
      this.subscriptionHandles.set(descriptor.subscription.subcriptionHandle, newSid);
    }
    this.descriptors.set(newSid, descriptor);
    return true;
  }
  handleTrackUnpublished(sid) {
    const descriptor = this.descriptors.get(sid);
    if (!descriptor) {
      log.error("Unknown track ".concat(sid));
      return;
    }
    this.descriptors.delete(sid);
    if (descriptor.subscription.type === 'active') {
      this.closeStreamControllers(descriptor.subscription.streamControllers, sid);
      this.subscriptionHandles.delete(descriptor.subscription.subcriptionHandle);
    }
    this.emit('trackUnpublished', {
      sid,
      publisherIdentity: descriptor.publisherIdentity
    });
  }
  /** SFU notification that handles have been assigned for requested subscriptions. */
  receivedSfuSubscriberHandles(
  /** Mapping between track handles attached to incoming packets to the
   * track SIDs they belong to. */
  mapping) {
    for (const _ref11 of mapping.entries()) {
      var _ref12 = _slicedToArray(_ref11, 2);
      const handle = _ref12[0];
      const sid = _ref12[1];
      this.registerSubscriberHandle(handle, sid);
    }
  }
  registerSubscriberHandle(assignedHandle, sid) {
    var _a, _b;
    const descriptor = this.descriptors.get(sid);
    if (!descriptor) {
      log.error("Unknown track ".concat(sid));
      return;
    }
    switch (descriptor.subscription.type) {
      case 'none':
        {
          // Handle assigned when there is no pending or active subscription is unexpected.
          log.warn("No subscription for ".concat(sid));
          return;
        }
      case 'active':
        {
          // Update handle for an active subscription. This can occur following a full reconnect.
          this.subscriptionHandles.delete(descriptor.subscription.subcriptionHandle);
          descriptor.subscription.subcriptionHandle = assignedHandle;
          this.subscriptionHandles.set(assignedHandle, sid);
          return;
        }
      case 'pending':
        {
          log.debug("data track subscription activated", {
            sid,
            handle: assignedHandle
          });
          const pipeline = new IncomingDataTrackPipeline({
            info: descriptor.info,
            publisherIdentity: descriptor.publisherIdentity,
            e2eeManager: this.e2eeManager,
            pipelineOptions: descriptor.pipelineOptions
          });
          const previousDescriptorSubscription = descriptor.subscription;
          descriptor.subscription = {
            type: 'active',
            subcriptionHandle: assignedHandle,
            pipeline,
            streamControllers: new Map()
          };
          this.subscriptionHandles.set(assignedHandle, sid);
          (_b = (_a = previousDescriptorSubscription.completionFuture).resolve) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
    }
  }
  /** Packet has been received over the transport. */
  packetReceived(bytes) {
    return __awaiter(this, void 0, void 0, function* () {
      let packet;
      try {
        var _DataTrackPacket$from = DataTrackPacket.fromBinary(bytes);
        var _DataTrackPacket$from2 = _slicedToArray(_DataTrackPacket$from, 1);
        packet = _DataTrackPacket$from2[0];
      } catch (err) {
        log.error("Failed to deserialize packet: ".concat(err));
        return;
      }
      const sid = this.subscriptionHandles.get(packet.header.trackHandle);
      if (!sid) {
        log.warn("Unknown subscriber handle ".concat(packet.header.trackHandle));
        return;
      }
      const descriptor = this.descriptors.get(sid);
      if (!descriptor) {
        log.error("Missing descriptor for track ".concat(sid));
        return;
      }
      if (descriptor.subscription.type !== 'active') {
        log.warn("Received packet for track ".concat(sid, " without active subscription"));
        return;
      }
      const internalFrame = yield descriptor.subscription.pipeline.processPacket(packet);
      if (!internalFrame) {
        // Not all packets have been received yet to form a complete frame
        return;
      }
      // Broadcast to all downstream subscribers
      for (const controller of descriptor.subscription.streamControllers.keys()) {
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          log.warn("Cannot send frame to subscribers: readable stream is full (desiredSize is ".concat(controller.desiredSize, "). To increase this threshold, set a higher 'options.highWaterMark' when calling .subscribe()."));
          continue;
        }
        const frame = DataTrackFrameInternal.lossyIntoFrame(internalFrame);
        controller.enqueue(frame);
      }
    });
  }
  /** Resend all subscription updates.
   *
   * This must be sent after a full reconnect to ensure the SFU knows which
   * tracks are subscribed to locally.
   */
  resendSubscriptionUpdates() {
    for (const _ref13 of this.descriptors) {
      var _ref14 = _slicedToArray(_ref13, 2);
      const sid = _ref14[0];
      const descriptor = _ref14[1];
      if (descriptor.subscription.type === 'none') {
        continue;
      }
      this.emit('sfuUpdateSubscription', {
        sid,
        subscribe: true
      });
    }
  }
  /** Called when a remote participant is disconnected so that any pending data tracks can be
   * cancelled. */
  handleRemoteParticipantDisconnected(remoteParticipantIdentity) {
    var _a, _b;
    for (const descriptor of this.descriptors.values()) {
      if (descriptor.publisherIdentity !== remoteParticipantIdentity) {
        continue;
      }
      switch (descriptor.subscription.type) {
        case 'none':
          break;
        case 'pending':
          (_b = (_a = descriptor.subscription.completionFuture).reject) === null || _b === void 0 ? void 0 : _b.call(_a, DataTrackSubscribeError.disconnected());
          break;
        case 'active':
          this.unSubscribeRequest(descriptor.info.sid);
          break;
      }
    }
  }
  /** Resets the manager, ending any subscriptions, and getting it ready for the next room
   * connection.  */
  reset() {
    var _a, _b;
    for (const descriptor of this.descriptors.values()) {
      this.emit('trackUnpublished', {
        sid: descriptor.info.sid,
        publisherIdentity: descriptor.publisherIdentity
      });
      if (descriptor.subscription.type === 'pending') {
        (_b = (_a = descriptor.subscription.completionFuture).reject) === null || _b === void 0 ? void 0 : _b.call(_a, DataTrackSubscribeError.disconnected());
      }
      if (descriptor.subscription.type === 'active') {
        this.closeStreamControllers(descriptor.subscription.streamControllers, descriptor.info.sid);
      }
    }
    this.descriptors.clear();
    this.subscriptionHandles.clear();
  }
}export{IncomingDataTrackManager as default};//# sourceMappingURL=IncomingDataTrackManager.mjs.map
