var KeyProviderEvent;
(function (KeyProviderEvent) {
  KeyProviderEvent["SetKey"] = "setKey";
  /** Event for requesting to ratchet the key used to encrypt the stream */
  KeyProviderEvent["RatchetRequest"] = "ratchetRequest";
  /** Emitted when a key is ratcheted. Could be after auto-ratcheting on decryption failure or
   *  following a `RatchetRequest`, will contain the ratcheted key material */
  KeyProviderEvent["KeyRatcheted"] = "keyRatcheted";
})(KeyProviderEvent || (KeyProviderEvent = {}));
var KeyHandlerEvent;
(function (KeyHandlerEvent) {
  /** Emitted when a key has been ratcheted. Is emitted when any key has been ratcheted
   * i.e. when the FrameCryptor tried to ratchet when decryption is failing  */
  KeyHandlerEvent["KeyRatcheted"] = "keyRatcheted";
})(KeyHandlerEvent || (KeyHandlerEvent = {}));
var EncryptionEvent;
(function (EncryptionEvent) {
  EncryptionEvent["ParticipantEncryptionStatusChanged"] = "participantEncryptionStatusChanged";
  EncryptionEvent["EncryptionError"] = "encryptionError";
})(EncryptionEvent || (EncryptionEvent = {}));
var CryptorEvent;
(function (CryptorEvent) {
  CryptorEvent["Error"] = "cryptorError";
})(CryptorEvent || (CryptorEvent = {}));export{CryptorEvent,EncryptionEvent,KeyHandlerEvent,KeyProviderEvent};//# sourceMappingURL=events.mjs.map
