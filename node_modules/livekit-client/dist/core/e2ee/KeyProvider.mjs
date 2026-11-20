import {__awaiter}from'tslib';import {EventEmitter}from'events';import livekitLogger from'../logger.mjs';import {KEY_PROVIDER_DEFAULTS}from'./constants.mjs';import {KeyProviderEvent}from'./events.mjs';import {createKeyMaterialFromString,createKeyMaterialFromBuffer}from'./utils.mjs';/**
 * @experimental
 */
class BaseKeyProvider extends EventEmitter {
  constructor() {
    let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    super();
    this.latestManuallySetKeyIndex = 0;
    /**
     * Callback being invoked after a key has been ratcheted.
     * Can happen when:
     * - A decryption failure occurs and the key is auto-ratcheted
     * - A ratchet request is sent (see {@link ratchetKey()})
     * @param ratchetResult Contains the ratcheted chain key (exportable to other participants) and the derived new key material.
     * @param participantId
     * @param keyIndex
     */
    this.onKeyRatcheted = (ratchetResult, participantId, keyIndex) => {
      // ratchetResult holds key material, so it stays out of the log.
      livekitLogger.debug('key ratcheted event received', {
        participantId,
        keyIndex
      });
    };
    this.keyInfoMap = new Map();
    this.options = Object.assign(Object.assign({}, KEY_PROVIDER_DEFAULTS), options);
    this.on(KeyProviderEvent.KeyRatcheted, this.onKeyRatcheted);
  }
  /**
   * callback to invoke once a key has been set for a participant
   * @param key
   * @param participantIdentity
   * @param keyIndex
   */
  onSetEncryptionKey(key, participantIdentity, keyIndex) {
    const keyInfo = {
      key,
      participantIdentity,
      keyIndex
    };
    if (!this.options.sharedKey && !participantIdentity) {
      throw new Error('participant identity needs to be passed for encryption key if sharedKey option is false');
    }
    this.keyInfoMap.set("".concat(participantIdentity !== null && participantIdentity !== void 0 ? participantIdentity : 'shared', "-").concat(keyIndex !== null && keyIndex !== void 0 ? keyIndex : 0), keyInfo);
    if (keyIndex !== undefined) {
      this.latestManuallySetKeyIndex = keyIndex;
    }
    this.emit(KeyProviderEvent.SetKey, keyInfo, keyIndex !== undefined);
  }
  getKeys() {
    return Array.from(this.keyInfoMap.values());
  }
  getLatestManuallySetKeyIndex() {
    return this.latestManuallySetKeyIndex;
  }
  getOptions() {
    return this.options;
  }
  ratchetKey(participantIdentity, keyIndex) {
    this.emit(KeyProviderEvent.RatchetRequest, participantIdentity, keyIndex);
  }
}
/**
 * A basic KeyProvider implementation intended for a single shared
 * passphrase between all participants
 * @experimental
 */
class ExternalE2EEKeyProvider extends BaseKeyProvider {
  constructor() {
    let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    const opts = Object.assign(Object.assign({}, options), {
      sharedKey: true,
      // for a shared key provider failing to decrypt for a specific participant
      // should not mark the key as invalid, so we accept wrong keys forever
      // and won't try to auto-ratchet
      ratchetWindowSize: 0,
      failureTolerance: -1
    });
    super(opts);
  }
  /**
   * Accepts a passphrase that's used to create the crypto keys.
   * When passing in a string, PBKDF2 is used. (recommended for maximum compatibility across SDKs)
   * When passing in an ArrayBuffer of cryptographically random numbers, HKDF is used.
   *
   * Note: Not all client SDKS support HKDF.
   * @param key
   */
  setKey(key) {
    return __awaiter(this, void 0, void 0, function* () {
      const derivedKey = typeof key === 'string' ? yield createKeyMaterialFromString(key) : yield createKeyMaterialFromBuffer(key);
      this.onSetEncryptionKey(derivedKey);
    });
  }
}export{BaseKeyProvider,ExternalE2EEKeyProvider};//# sourceMappingURL=KeyProvider.mjs.map
