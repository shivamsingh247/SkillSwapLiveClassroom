import {LivekitReasonedError}from'../../errors.mjs';import'../packetizer.mjs';var DataTrackPublishErrorReason;
(function (DataTrackPublishErrorReason) {
  /**
   * Local participant does not have permission to publish data tracks.
   *
   * Ensure the participant's token contains the `canPublishData` grant.
   */
  DataTrackPublishErrorReason[DataTrackPublishErrorReason["NotAllowed"] = 0] = "NotAllowed";
  /** A track with the same name is already published by the local participant. */
  DataTrackPublishErrorReason[DataTrackPublishErrorReason["DuplicateName"] = 1] = "DuplicateName";
  /** Request to publish the track took long to complete. */
  DataTrackPublishErrorReason[DataTrackPublishErrorReason["Timeout"] = 2] = "Timeout";
  /** No additional data tracks can be published by the local participant. */
  DataTrackPublishErrorReason[DataTrackPublishErrorReason["LimitReached"] = 3] = "LimitReached";
  /** Cannot publish data track when the room is disconnected. */
  DataTrackPublishErrorReason[DataTrackPublishErrorReason["Disconnected"] = 4] = "Disconnected";
  // NOTE: this was introduced by web / there isn't a corresponding case in the rust version.
  DataTrackPublishErrorReason[DataTrackPublishErrorReason["Cancelled"] = 5] = "Cancelled";
  /** The name requested is not able to be used when creating the data track. */
  DataTrackPublishErrorReason[DataTrackPublishErrorReason["InvalidName"] = 6] = "InvalidName";
  /** There was an error publishing, but it was not something that could be sorted into a known
   * category. */
  DataTrackPublishErrorReason[DataTrackPublishErrorReason["Unknown"] = 7] = "Unknown";
})(DataTrackPublishErrorReason || (DataTrackPublishErrorReason = {}));
class DataTrackPublishError extends LivekitReasonedError {
  constructor(message, reason, options) {
    super(21, message, options);
    this.name = 'DataTrackPublishError';
    this.reason = reason;
    this.reasonName = DataTrackPublishErrorReason[reason];
    this.rawMessage = options === null || options === void 0 ? void 0 : options.rawMessage;
  }
  static notAllowed(rawMessage) {
    return new DataTrackPublishError('Data track publishing unauthorized', DataTrackPublishErrorReason.NotAllowed, {
      rawMessage
    });
  }
  static duplicateName(rawMessage) {
    return new DataTrackPublishError('Track name already taken', DataTrackPublishErrorReason.DuplicateName, {
      rawMessage
    });
  }
  static invalidName(rawMessage) {
    return new DataTrackPublishError('Track name is invalid', DataTrackPublishErrorReason.InvalidName, {
      rawMessage
    });
  }
  static timeout() {
    return new DataTrackPublishError('Publish data track timed-out. Does the LiveKit server support data tracks?', DataTrackPublishErrorReason.Timeout);
  }
  static limitReached(rawMessage) {
    return new DataTrackPublishError('Data track publication limit reached', DataTrackPublishErrorReason.LimitReached, {
      rawMessage
    });
  }
  static unknown(reason, message) {
    return new DataTrackPublishError("Received RequestResponse for publishDataTrack, but reason was unrecognised (".concat(reason, ", ").concat(message, ")"), DataTrackPublishErrorReason.Unknown);
  }
  static disconnected() {
    return new DataTrackPublishError('Room disconnected', DataTrackPublishErrorReason.Disconnected);
  }
  // NOTE: this was introduced by web / there isn't a corresponding case in the rust version.
  static cancelled() {
    return new DataTrackPublishError('Publish data track cancelled by caller', DataTrackPublishErrorReason.Cancelled);
  }
}
var DataTrackPushFrameErrorReason;
(function (DataTrackPushFrameErrorReason) {
  /** Track is no longer published. */
  DataTrackPushFrameErrorReason[DataTrackPushFrameErrorReason["TrackUnpublished"] = 0] = "TrackUnpublished";
  /** Frame was dropped. */
  // NOTE: this should become a web specific error, the rust version of this "dropped" error means
  // something different and will be renamed to "QueueFull".
  DataTrackPushFrameErrorReason[DataTrackPushFrameErrorReason["Dropped"] = 1] = "Dropped";
})(DataTrackPushFrameErrorReason || (DataTrackPushFrameErrorReason = {}));
class DataTrackPushFrameError extends LivekitReasonedError {
  constructor(message, reason, options) {
    super(22, message, options);
    this.name = 'DataTrackPushFrameError';
    this.reason = reason;
    this.reasonName = DataTrackPushFrameErrorReason[reason];
  }
  static trackUnpublished() {
    return new DataTrackPushFrameError('Track is no longer published', DataTrackPushFrameErrorReason.TrackUnpublished);
  }
  static dropped(cause) {
    return new DataTrackPushFrameError('Frame was dropped', DataTrackPushFrameErrorReason.Dropped, {
      cause
    });
  }
}
var DataTrackOutgoingPipelineErrorReason;
(function (DataTrackOutgoingPipelineErrorReason) {
  DataTrackOutgoingPipelineErrorReason[DataTrackOutgoingPipelineErrorReason["Packetizer"] = 0] = "Packetizer";
  DataTrackOutgoingPipelineErrorReason[DataTrackOutgoingPipelineErrorReason["Encryption"] = 1] = "Encryption";
})(DataTrackOutgoingPipelineErrorReason || (DataTrackOutgoingPipelineErrorReason = {}));
class DataTrackOutgoingPipelineError extends LivekitReasonedError {
  constructor(message, reason, options) {
    super(21, message, options);
    this.name = 'DataTrackOutgoingPipelineError';
    this.reason = reason;
    this.reasonName = DataTrackOutgoingPipelineErrorReason[reason];
  }
  static packetizer(cause) {
    return new DataTrackOutgoingPipelineError('Error packetizing frame', DataTrackOutgoingPipelineErrorReason.Packetizer, {
      cause
    });
  }
  static encryption(cause) {
    return new DataTrackOutgoingPipelineError('Error encrypting frame', DataTrackOutgoingPipelineErrorReason.Encryption, {
      cause
    });
  }
}export{DataTrackOutgoingPipelineError,DataTrackOutgoingPipelineErrorReason,DataTrackPublishError,DataTrackPublishErrorReason,DataTrackPushFrameError,DataTrackPushFrameErrorReason};//# sourceMappingURL=errors.mjs.map
