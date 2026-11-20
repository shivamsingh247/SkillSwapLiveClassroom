import'@livekit/protocol';var DataChannelKind;
(function (DataChannelKind) {
  DataChannelKind[DataChannelKind["RELIABLE"] = 0] = "RELIABLE";
  DataChannelKind[DataChannelKind["LOSSY"] = 1] = "LOSSY";
  DataChannelKind[DataChannelKind["DATA_TRACK_LOSSY"] = 2] = "DATA_TRACK_LOSSY";
})(DataChannelKind || (DataChannelKind = {}));
// Two-watermark flow control for the reliable and data-track channels. Senders fill the buffer
// freely up to the high-water mark; once it's exceeded they block until the browser's
// `bufferedamountlow` event (which we arm at the low-water mark) signals the buffer has drained.
// The gap between the marks keeps the SCTP send buffer saturated while we refill, so throughput
// isn't starved, while the high-water mark bounds the buffer well below the level that would abort
// the channel (see livekit/client-sdk-js#1995).
const reliableDataChannelWaterMarkLow = 64 * 1024;
const reliableDataChannelWaterMarkHigh = 1024 * 1024;
const lossyDataChannelWaterMarkLow = 8 * 1024;
const lossyDataChannelWaterMarkHigh = 256 * 1024;
function dataChannelLowWaterMark(kind) {
  return kind === DataChannelKind.RELIABLE ? reliableDataChannelWaterMarkLow : lossyDataChannelWaterMarkLow;
}
function dataChannelHighWaterMark(kind) {
  return kind === DataChannelKind.RELIABLE ? reliableDataChannelWaterMarkHigh : lossyDataChannelWaterMarkHigh;
}export{DataChannelKind,dataChannelHighWaterMark,dataChannelLowWaterMark,lossyDataChannelWaterMarkHigh,lossyDataChannelWaterMarkLow,reliableDataChannelWaterMarkHigh,reliableDataChannelWaterMarkLow};//# sourceMappingURL=types.mjs.map
