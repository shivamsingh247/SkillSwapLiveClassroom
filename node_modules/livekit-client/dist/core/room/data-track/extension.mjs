import {slicedToArray as _slicedToArray}from'../../_virtual/_rollupPluginBabelHelpers.mjs';import {__awaiter}from'tslib';import {PublishDataTrackResponse,Encryption_Type,RequestResponse_Reason}from'@livekit/protocol';import {RoomEvent,EngineEvent}from'../events.mjs';import LocalDataTrack from'./LocalDataTrack.mjs';import RemoteDataTrack from'./RemoteDataTrack.mjs';import IncomingDataTrackManager from'./incoming/IncomingDataTrackManager.mjs';import OutgoingDataTrackManager from'./outgoing/OutgoingDataTrackManager.mjs';import {DataTrackPublishError}from'./outgoing/errors.mjs';import {DataTrackInfo}from'./types.mjs';const toInfos = protos => protos.map(proto => DataTrackInfo.from(proto));
/**
 * Data tracks: continuous unreliable streams for real-time data (`publishDataTrack`,
 * `RemoteParticipant.dataTracks`, `RoomEvent.DataTrackPublished`).
 * @experimental
 */
const dataTracks = {
  key: /* @__PURE__ */Symbol('lk.extension.dataTracks'),
  install(room, ctx) {
    const incoming = new IncomingDataTrackManager();
    const outgoing = new OutgoingDataTrackManager();
    incoming.on('sfuUpdateSubscription', event => {
      room.engine.client.sendUpdateDataSubscription(event.sid, event.subscribe);
    }).on('trackPublished', event => {
      var _a;
      if (event.track.publisherIdentity === room.localParticipant.identity) {
        // Only advertize tracks from other participants
        return;
      }
      room.emit(RoomEvent.DataTrackPublished, event.track);
      (_a = room.remoteParticipants.get(event.track.publisherIdentity)) === null || _a === void 0 ? void 0 : _a.addRemoteDataTrack(event.track);
    }).on('trackUnpublished', event => {
      var _a;
      if (event.publisherIdentity === room.localParticipant.identity) {
        // Only advertize tracks from other participants
        return;
      }
      room.emit(RoomEvent.DataTrackUnpublished, event.sid);
      (_a = room.remoteParticipants.get(event.publisherIdentity)) === null || _a === void 0 ? void 0 : _a.removeRemoteDataTrack(event.sid);
    });
    outgoing.on('sfuPublishRequest', event => {
      room.engine.client.sendPublishDataTrackRequest(event.handle, event.name, event.usesE2ee);
    }).on('sfuUnpublishRequest', event => {
      room.engine.client.sendUnPublishDataTrackRequest(event.handle);
    }).on('trackPublished', event => {
      room.emit(RoomEvent.LocalDataTrackPublished, event.track);
    }).on('trackUnpublished', event => {
      room.emit(RoomEvent.LocalDataTrackUnpublished, event.sid);
    }).on('packetAvailable', _ref => {
      let handle = _ref.handle,
        bytes = _ref.bytes;
      room.engine.sendDataTrackFrame(bytes).finally(() => outgoing.handlePacketSendComplete(handle));
    });
    const onEngineCreated = engine => {
      var _a;
      // the e2ee extension may sit after this one in the list; every slot is filled by now
      const e2eeManager = (_a = ctx.slot('e2eeManager')) !== null && _a !== void 0 ? _a : null;
      incoming.updateE2eeManager(e2eeManager);
      outgoing.updateE2eeManager(e2eeManager);
      engine.on(EngineEvent.PublishDataTrackResponse, event => {
        if (!event.info) {
          ctx.log.warn("received PublishDataTrackResponse, but event.info was ".concat(event.info, ", so skipping."));
          return;
        }
        outgoing.receivedSfuPublishResponse(event.info.pubHandle, {
          type: 'ok',
          data: {
            sid: event.info.sid,
            pubHandle: event.info.pubHandle,
            name: event.info.name,
            usesE2ee: event.info.encryption !== Encryption_Type.NONE
          }
        });
      }).on(EngineEvent.UnPublishDataTrackResponse, event => {
        if (!event.info) {
          ctx.log.warn("received UnPublishDataTrackResponse, but event.info was ".concat(event.info, ", so skipping."));
          return;
        }
        outgoing.receivedSfuUnpublishResponse(event.info.pubHandle);
      }).on(EngineEvent.DataTrackSubscriberHandles, event => {
        const handleToSidMapping = new Map(Object.entries(event.subHandles).map(_ref2 => {
          let _ref3 = _slicedToArray(_ref2, 2),
            key = _ref3[0],
            value = _ref3[1];
          return [parseInt(key, 10), value.trackSid];
        }));
        incoming.receivedSfuSubscriberHandles(handleToSidMapping);
      }).on(EngineEvent.DataTrackPacketReceived, packetBytes => {
        try {
          incoming.packetReceived(packetBytes);
        } catch (err) {
          // NOTE: wrapping in the bare try/catch like this means that the Throws<...> type doesn't
          // propagate upwards into the public interface.
          throw err;
        }
      }).on(EngineEvent.Joined, joinResponse => {
        incoming.receiveSfuPublicationUpdates(new Map(joinResponse.otherParticipants.map(participant => [participant.identity, toInfos(participant.dataTracks)])));
      }).on(EngineEvent.Restarted, () => {
        outgoing.sfuWillRepublishTracks();
        incoming.resendSubscriptionUpdates();
      }).on(EngineEvent.SignalRequestResponse, response => {
        if (response.request.case !== 'publishDataTrack') {
          return;
        }
        let error;
        switch (response.reason) {
          case RequestResponse_Reason.NOT_ALLOWED:
            error = DataTrackPublishError.notAllowed(response.message);
            break;
          case RequestResponse_Reason.DUPLICATE_NAME:
            error = DataTrackPublishError.duplicateName(response.message);
            break;
          case RequestResponse_Reason.INVALID_NAME:
            error = DataTrackPublishError.invalidName(response.message);
            break;
          case RequestResponse_Reason.LIMIT_EXCEEDED:
            error = DataTrackPublishError.limitReached(response.message);
            break;
          default:
            error = DataTrackPublishError.unknown(response.reason, response.message);
            break;
        }
        outgoing.receivedSfuPublishResponse(response.request.value.pubHandle, {
          type: 'error',
          error
        });
      });
    };
    const onDisconnect = () => {
      incoming.reset();
      outgoing.reset();
    };
    const onParticipantCreated = (participant, info) => {
      for (const proto of info.dataTracks) {
        participant.addRemoteDataTrack(new RemoteDataTrack(DataTrackInfo.from(proto), incoming, {
          publisherIdentity: info.identity
        }));
      }
    };
    const onParticipantUpdates = infos => {
      incoming.receiveSfuPublicationUpdates(new Map(infos.filter(info => info.identity !== room.localParticipant.identity).map(info => [info.identity, toInfos(info.dataTracks)])));
    };
    const syncState = () => outgoing.queryPublished().map(info => new PublishDataTrackResponse({
      info: DataTrackInfo.toProtobuf(info)
    }));
    room.on(RoomEvent.ParticipantDisconnected, participant => incoming.handleRemoteParticipantDisconnected(participant.identity));
    return {
      incoming,
      outgoing,
      onEngineCreated,
      onDisconnect,
      onParticipantCreated,
      onParticipantUpdates,
      syncState,
      localParticipant: {
        publishDataTrack: options => __awaiter(this, void 0, void 0, function* () {
          const track = new LocalDataTrack(options, outgoing);
          yield track.publish();
          return track;
        })
      }
    };
  }
};export{dataTracks};//# sourceMappingURL=extension.mjs.map
