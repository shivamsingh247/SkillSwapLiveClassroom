const ENCRYPTION_ALGORITHM = 'AES-GCM';
// How many consecutive frames can fail decrypting before a particular key gets marked as invalid
const DECRYPTION_FAILURE_TOLERANCE = 10;
// flag set to indicate that e2ee has been setup for sender/receiver;
const E2EE_FLAG = 'lk_e2ee';
/**
 * trackId a receiver's/sender's encoded stream pipeline was last set up for.
 * Needed to recover the right cryptor when a transceiver gets reused.
 */
const E2EE_TRACK_ID = 'lk_e2ee_track_id';
const SALT = 'LKFrameEncryptionKey';
const KEY_PROVIDER_DEFAULTS = {
  sharedKey: false,
  ratchetSalt: SALT,
  ratchetWindowSize: 8,
  failureTolerance: DECRYPTION_FAILURE_TOLERANCE,
  keyringSize: 16,
  keySize: 128
};export{DECRYPTION_FAILURE_TOLERANCE,E2EE_FLAG,E2EE_TRACK_ID,ENCRYPTION_ALGORITHM,KEY_PROVIDER_DEFAULTS,SALT};//# sourceMappingURL=constants.mjs.map
