import {DataStream_Header,DataStream_TextHeader,DataStream_CompressionType,DataStream_OperationType,DataPacket,DataStream_ByteHeader}from'@livekit/protocol';import {numberToBigInt}from'../../utils.mjs';/** Builds the `DataStream_Header` for a text stream from its info and stream options. */
function buildTextStreamHeader(info, options, v2) {
  var _a;
  return new DataStream_Header({
    streamId: info.id,
    mimeType: info.mimeType,
    topic: info.topic,
    timestamp: numberToBigInt(info.timestamp),
    totalLength: numberToBigInt(info.size),
    attributes: info.attributes,
    compression: (_a = v2 === null || v2 === void 0 ? void 0 : v2.compression) !== null && _a !== void 0 ? _a : DataStream_CompressionType.NONE,
    inlineContent: v2 === null || v2 === void 0 ? void 0 : v2.inlineContent,
    contentHeader: {
      case: 'textHeader',
      value: new DataStream_TextHeader({
        version: options === null || options === void 0 ? void 0 : options.version,
        attachedStreamIds: info.attachedStreamIds,
        replyToStreamId: options === null || options === void 0 ? void 0 : options.replyToStreamId,
        operationType: (options === null || options === void 0 ? void 0 : options.type) === 'update' ? DataStream_OperationType.UPDATE : DataStream_OperationType.CREATE
      })
    }
  });
}
/** Builds the `DataStream_Header` for a byte stream from its info. */
function buildByteStreamHeader(info, v2) {
  var _a;
  return new DataStream_Header({
    streamId: info.id,
    mimeType: info.mimeType,
    topic: info.topic,
    timestamp: numberToBigInt(info.timestamp),
    totalLength: numberToBigInt(info.size),
    attributes: info.attributes,
    compression: (_a = v2 === null || v2 === void 0 ? void 0 : v2.compression) !== null && _a !== void 0 ? _a : DataStream_CompressionType.NONE,
    inlineContent: v2 === null || v2 === void 0 ? void 0 : v2.inlineContent,
    contentHeader: {
      case: 'byteHeader',
      value: new DataStream_ByteHeader({
        name: info.name
      })
    }
  });
}
/** Wraps a `DataStream_Header` in a `DataPacket` ready to be sent over a data channel. */
function createStreamHeaderPacket(header, destinationIdentities) {
  return new DataPacket({
    destinationIdentities,
    value: {
      case: 'streamHeader',
      value: header
    }
  });
}export{buildByteStreamHeader,buildTextStreamHeader,createStreamHeaderPacket};//# sourceMappingURL=header-utils.mjs.map
