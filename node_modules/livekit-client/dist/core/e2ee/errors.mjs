import {LivekitError}from'../room/errors.mjs';var CryptorErrorReason;
(function (CryptorErrorReason) {
  CryptorErrorReason[CryptorErrorReason["InvalidKey"] = 0] = "InvalidKey";
  CryptorErrorReason[CryptorErrorReason["MissingKey"] = 1] = "MissingKey";
  CryptorErrorReason[CryptorErrorReason["InternalError"] = 2] = "InternalError";
})(CryptorErrorReason || (CryptorErrorReason = {}));
class CryptorError extends LivekitError {
  constructor(message) {
    let reason = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : CryptorErrorReason.InternalError;
    let participantIdentity = arguments.length > 2 ? arguments[2] : undefined;
    super(40, message);
    this.reason = reason;
    this.participantIdentity = participantIdentity;
  }
}export{CryptorError,CryptorErrorReason};//# sourceMappingURL=errors.mjs.map
