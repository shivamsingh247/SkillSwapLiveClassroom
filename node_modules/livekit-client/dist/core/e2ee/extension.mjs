import {__awaiter}from'tslib';import {Mutex}from'@livekit/mutex';import {RoomEvent}from'../room/events.mjs';import {defineExtension}from'../room/extensions.mjs';import {isLocalParticipant}from'../room/utils.mjs';import {E2EEManager}from'./E2eeManager.mjs';import {EncryptionEvent}from'./events.mjs';/** @experimental */
const e2ee = /* @__PURE__ */defineExtension('e2ee', [], (room, _ctx, options) => {
  const dcEncryptionEnabled = !room.options.e2ee;
  const e2eeOptions = options !== null && options !== void 0 ? options : room.options.encryption || room.options.e2ee;
  let manager;
  // an app-supplied manager (and its worker) can be shared between rooms; the app owns it
  let dispose = () => {};
  if (e2eeOptions) {
    if ('e2eeManager' in e2eeOptions) {
      manager = e2eeOptions.e2eeManager;
      manager.isDataChannelEncryptionEnabled = dcEncryptionEnabled;
    } else {
      const owned = new E2EEManager(e2eeOptions, dcEncryptionEnabled);
      manager = owned;
      dispose = () => {
        owned.dispose();
        e2eeOptions.worker.terminate();
      };
    }
    const onStatusChanged = (enabled, participant) => {
      if (isLocalParticipant(participant)) {
        room.isE2EEEnabled = enabled;
      }
      room.emit(RoomEvent.ParticipantEncryptionStatusChanged, enabled, participant);
    };
    const onError = (error, participantIdentity) => {
      const participant = participantIdentity ? room.getParticipantByIdentity(participantIdentity) : undefined;
      room.emit(RoomEvent.EncryptionError, error, participant);
    };
    manager.on(EncryptionEvent.ParticipantEncryptionStatusChanged, onStatusChanged);
    manager.on(EncryptionEvent.EncryptionError, onError);
    if ('e2eeManager' in e2eeOptions) {
      // the app's manager outlives this room: take this room's listeners off it
      const shared = manager;
      dispose = () => {
        shared.off(EncryptionEvent.ParticipantEncryptionStatusChanged, onStatusChanged);
        shared.off(EncryptionEvent.EncryptionError, onError);
      };
    }
    manager.setup(room);
    manager.setupEngine(room.engine);
  }
  const stateMutex = new Mutex();
  return {
    manager,
    e2eeManager: manager,
    room: {
      setE2EEEnabled: enabled => __awaiter(void 0, void 0, void 0, function* () {
        const unlock = yield stateMutex.lock();
        try {
          if (manager) {
            if (room.isE2EEEnabled !== enabled) {
              yield room.localParticipant.setE2EEEnabled(enabled);
              if (manager.setLocalParticipantCryptorEnabled) {
                manager.setLocalParticipantCryptorEnabled(enabled);
              } else if (room.localParticipant.identity !== '') {
                manager.setParticipantCryptorEnabled(enabled, room.localParticipant.identity);
              }
            }
          } else {
            throw Error('e2ee not configured, please set e2ee settings within the room options');
          }
        } finally {
          unlock();
        }
      })
    },
    dispose
  };
});export{e2ee};//# sourceMappingURL=extension.mjs.map
