import {DataTrackExtensions,DataTrackUserTimestampExtension}from'./packet/extensions.mjs';const DataTrackFrameInternal = {
  from(frame) {
    return {
      payload: frame.payload,
      extensions: new DataTrackExtensions({
        userTimestamp: frame.userTimestamp ? new DataTrackUserTimestampExtension(frame.userTimestamp) : undefined
      })
    };
  },
  /** Converts from a DataTrackFrameInternal -> DataTrackFrame. Some internal information is
   * discarded like e2ee encrption extension data. */
  lossyIntoFrame(frame) {
    var _a;
    return {
      payload: frame.payload,
      userTimestamp: (_a = frame.extensions.userTimestamp) === null || _a === void 0 ? void 0 : _a.timestamp
    };
  }
};export{DataTrackFrameInternal};//# sourceMappingURL=frame.mjs.map
