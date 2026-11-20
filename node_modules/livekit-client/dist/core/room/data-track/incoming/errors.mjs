import {LivekitReasonedError}from'../../errors.mjs';var DataTrackSubscribeErrorReason;
(function (DataTrackSubscribeErrorReason) {
  /** The track has been unpublished and is no longer available */
  DataTrackSubscribeErrorReason[DataTrackSubscribeErrorReason["Unpublished"] = 0] = "Unpublished";
  /** Request to subscribe to data track timed-out */
  DataTrackSubscribeErrorReason[DataTrackSubscribeErrorReason["Timeout"] = 1] = "Timeout";
  /** Cannot subscribe to data track when disconnected */
  DataTrackSubscribeErrorReason[DataTrackSubscribeErrorReason["Disconnected"] = 2] = "Disconnected";
  /** Subscription to data track cancelled by caller */
  DataTrackSubscribeErrorReason[DataTrackSubscribeErrorReason["Cancelled"] = 4] = "Cancelled";
})(DataTrackSubscribeErrorReason || (DataTrackSubscribeErrorReason = {}));
class DataTrackSubscribeError extends LivekitReasonedError {
  constructor(message, reason, options) {
    super(22, message, options);
    this.name = 'DataTrackSubscribeError';
    this.reason = reason;
    this.reasonName = DataTrackSubscribeErrorReason[reason];
  }
  static unpublished() {
    return new DataTrackSubscribeError('The track has been unpublished and is no longer available', DataTrackSubscribeErrorReason.Unpublished);
  }
  static timeout() {
    return new DataTrackSubscribeError('Request to subscribe to data track timed-out', DataTrackSubscribeErrorReason.Timeout);
  }
  static disconnected() {
    return new DataTrackSubscribeError('Cannot subscribe to data track when disconnected', DataTrackSubscribeErrorReason.Disconnected);
  }
  // NOTE: this was introduced by web / there isn't a corresponding case in the rust version.
  static cancelled() {
    return new DataTrackSubscribeError('Subscription to data track cancelled by caller', DataTrackSubscribeErrorReason.Cancelled);
  }
}export{DataTrackSubscribeError,DataTrackSubscribeErrorReason};//# sourceMappingURL=errors.mjs.map
