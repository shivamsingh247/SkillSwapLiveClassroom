import {LivekitReasonedError}from'../errors.mjs';import {U16_MAX_SIZE}from'./utils.mjs';var DataTrackHandleErrorReason;
(function (DataTrackHandleErrorReason) {
  DataTrackHandleErrorReason[DataTrackHandleErrorReason["Reserved"] = 0] = "Reserved";
  DataTrackHandleErrorReason[DataTrackHandleErrorReason["TooLarge"] = 1] = "TooLarge";
})(DataTrackHandleErrorReason || (DataTrackHandleErrorReason = {}));
class DataTrackHandleError extends LivekitReasonedError {
  constructor(message, reason) {
    super(19, message);
    this.name = 'DataTrackHandleError';
    this.reason = reason;
    this.reasonName = DataTrackHandleErrorReason[reason];
  }
  isReason(reason) {
    return this.reason === reason;
  }
  static tooLarge() {
    return new DataTrackHandleError('Value too large to be a valid track handle', DataTrackHandleErrorReason.TooLarge);
  }
  static reserved(value) {
    return new DataTrackHandleError("0x".concat(value.toString(16), " is a reserved value."), DataTrackHandleErrorReason.Reserved);
  }
}
const DataTrackHandle = {
  fromNumber(raw) {
    if (raw === 0) {
      throw DataTrackHandleError.reserved(raw);
    }
    if (raw > U16_MAX_SIZE) {
      throw DataTrackHandleError.tooLarge();
    }
    return raw;
  }
};
/** Manage allocating new handles which don't conflict over the lifetime of the client. */
class DataTrackHandleAllocator {
  constructor() {
    this.value = 0;
  }
  /** Returns a unique track handle for the next publication, if one can be obtained. */
  get() {
    this.value += 1;
    if (this.value > U16_MAX_SIZE) {
      return null;
    }
    return this.value;
  }
  reset() {
    this.value = 0;
  }
}export{DataTrackHandle,DataTrackHandleAllocator,DataTrackHandleError,DataTrackHandleErrorReason};//# sourceMappingURL=handle.mjs.map
