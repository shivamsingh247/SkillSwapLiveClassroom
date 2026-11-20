import {LivekitReasonedError}from'../../errors.mjs';var DataTrackDeserializeErrorReason;
(function (DataTrackDeserializeErrorReason) {
  DataTrackDeserializeErrorReason[DataTrackDeserializeErrorReason["TooShort"] = 0] = "TooShort";
  DataTrackDeserializeErrorReason[DataTrackDeserializeErrorReason["HeaderOverrun"] = 1] = "HeaderOverrun";
  DataTrackDeserializeErrorReason[DataTrackDeserializeErrorReason["MissingExtWords"] = 2] = "MissingExtWords";
  DataTrackDeserializeErrorReason[DataTrackDeserializeErrorReason["UnsupportedVersion"] = 3] = "UnsupportedVersion";
  DataTrackDeserializeErrorReason[DataTrackDeserializeErrorReason["InvalidHandle"] = 4] = "InvalidHandle";
  DataTrackDeserializeErrorReason[DataTrackDeserializeErrorReason["MalformedExt"] = 5] = "MalformedExt";
})(DataTrackDeserializeErrorReason || (DataTrackDeserializeErrorReason = {}));
class DataTrackDeserializeError extends LivekitReasonedError {
  constructor(message, reason, options) {
    super(19, message, options);
    this.name = 'DataTrackDeserializeError';
    this.reason = reason;
    this.reasonName = DataTrackDeserializeErrorReason[reason];
  }
  static tooShort() {
    return new DataTrackDeserializeError('Too short to contain a valid header', DataTrackDeserializeErrorReason.TooShort);
  }
  static headerOverrun() {
    return new DataTrackDeserializeError('Header exceeds total packet length', DataTrackDeserializeErrorReason.HeaderOverrun);
  }
  static missingExtWords() {
    return new DataTrackDeserializeError('Extension word indicator is missing', DataTrackDeserializeErrorReason.MissingExtWords);
  }
  static unsupportedVersion(version) {
    return new DataTrackDeserializeError("Unsupported version ".concat(version), DataTrackDeserializeErrorReason.UnsupportedVersion);
  }
  static invalidHandle(cause) {
    return new DataTrackDeserializeError("invalid track handle: ".concat(cause.message), DataTrackDeserializeErrorReason.InvalidHandle, {
      cause
    });
  }
  static malformedExt(tag) {
    return new DataTrackDeserializeError("Extension with tag ".concat(tag, " is malformed"), DataTrackDeserializeErrorReason.MalformedExt);
  }
}
var DataTrackSerializeErrorReason;
(function (DataTrackSerializeErrorReason) {
  DataTrackSerializeErrorReason[DataTrackSerializeErrorReason["TooSmallForHeader"] = 0] = "TooSmallForHeader";
  DataTrackSerializeErrorReason[DataTrackSerializeErrorReason["TooSmallForPayload"] = 1] = "TooSmallForPayload";
})(DataTrackSerializeErrorReason || (DataTrackSerializeErrorReason = {}));
class DataTrackSerializeError extends LivekitReasonedError {
  constructor(message, reason, options) {
    super(19, message, options);
    this.name = 'DataTrackSerializeError';
    this.reason = reason;
    this.reasonName = DataTrackSerializeErrorReason[reason];
  }
  static tooSmallForHeader() {
    return new DataTrackSerializeError('Buffer cannot fit header', DataTrackSerializeErrorReason.TooSmallForHeader);
  }
  static tooSmallForPayload() {
    return new DataTrackSerializeError('Buffer cannot fit payload', DataTrackSerializeErrorReason.TooSmallForPayload);
  }
}export{DataTrackDeserializeError,DataTrackDeserializeErrorReason,DataTrackSerializeError,DataTrackSerializeErrorReason};//# sourceMappingURL=errors.mjs.map
