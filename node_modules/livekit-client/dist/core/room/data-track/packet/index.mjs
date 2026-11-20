import {slicedToArray as _slicedToArray}from'../../../_virtual/_rollupPluginBabelHelpers.mjs';import {DataTrackHandle,DataTrackHandleError,DataTrackHandleErrorReason}from'../handle.mjs';import {coerceToDataView,WrapAroundUnsignedInt,DataTrackTimestamp}from'../utils.mjs';import {U8_LENGTH_BYTES,BASE_HEADER_LEN,U16_LENGTH_BYTES,U32_LENGTH_BYTES,SUPPORTED_VERSION,FRAME_MARKER_SHIFT,FRAME_MARKER_MASK,FRAME_MARKER_INTER,FRAME_MARKER_SINGLE,FRAME_MARKER_FINAL,FRAME_MARKER_START,EXT_WORDS_INDICATOR_SIZE,VERSION_SHIFT,EXT_FLAG_SHIFT,VERSION_MASK,EXT_FLAG_MASK}from'./constants.mjs';import {DataTrackSerializeError,DataTrackDeserializeError}from'./errors.mjs';import {DataTrackExtensions}from'./extensions.mjs';import Serializable from'./serializable.mjs';/** A class for serializing / deserializing data track packet header sections. */
class DataTrackPacketHeader extends Serializable {
  constructor(opts) {
    var _a;
    super();
    this.marker = opts.marker;
    this.trackHandle = opts.trackHandle;
    this.sequence = opts.sequence;
    this.frameNumber = opts.frameNumber;
    this.timestamp = opts.timestamp;
    this.extensions = (_a = opts.extensions) !== null && _a !== void 0 ? _a : new DataTrackExtensions();
  }
  extensionsMetrics() {
    const lengthBytes = this.extensions.toBinaryLengthBytes();
    const lengthWords = Math.ceil((EXT_WORDS_INDICATOR_SIZE + lengthBytes) / 4);
    const paddingLengthBytes = lengthWords * 4 - EXT_WORDS_INDICATOR_SIZE - lengthBytes;
    return {
      lengthBytes,
      lengthWords,
      paddingLengthBytes
    };
  }
  toBinaryLengthBytes() {
    const _this$extensionsMetri = this.extensionsMetrics(),
      extLengthBytes = _this$extensionsMetri.lengthBytes,
      extPaddingLengthBytes = _this$extensionsMetri.paddingLengthBytes;
    let totalLengthBytes = BASE_HEADER_LEN;
    if (extLengthBytes > 0) {
      totalLengthBytes += EXT_WORDS_INDICATOR_SIZE + extLengthBytes + extPaddingLengthBytes;
    }
    return totalLengthBytes;
  }
  toBinaryInto(dataView) {
    if (dataView.byteLength < this.toBinaryLengthBytes()) {
      throw DataTrackSerializeError.tooSmallForHeader();
    }
    let initial = SUPPORTED_VERSION << VERSION_SHIFT;
    let marker;
    switch (this.marker) {
      case FrameMarker.Inter:
        marker = FRAME_MARKER_INTER;
        break;
      case FrameMarker.Final:
        marker = FRAME_MARKER_FINAL;
        break;
      case FrameMarker.Start:
        marker = FRAME_MARKER_START;
        break;
      case FrameMarker.Single:
        marker = FRAME_MARKER_SINGLE;
        break;
    }
    initial |= marker << FRAME_MARKER_SHIFT;
    const _this$extensionsMetri2 = this.extensionsMetrics(),
      extensionsLengthBytes = _this$extensionsMetri2.lengthBytes,
      extensionsLengthWords = _this$extensionsMetri2.lengthWords,
      extensionsPaddingLengthBytes = _this$extensionsMetri2.paddingLengthBytes;
    if (extensionsLengthBytes > 0) {
      initial |= 1 << EXT_FLAG_SHIFT;
    }
    let byteIndex = 0;
    dataView.setUint8(byteIndex, initial);
    byteIndex += U8_LENGTH_BYTES;
    dataView.setUint8(byteIndex, 0); // Reserved
    byteIndex += U8_LENGTH_BYTES;
    dataView.setUint16(byteIndex, this.trackHandle);
    byteIndex += U16_LENGTH_BYTES;
    dataView.setUint16(byteIndex, this.sequence.value);
    byteIndex += U16_LENGTH_BYTES;
    dataView.setUint16(byteIndex, this.frameNumber.value);
    byteIndex += U16_LENGTH_BYTES;
    dataView.setUint32(byteIndex, this.timestamp.asTicks());
    byteIndex += U32_LENGTH_BYTES;
    if (extensionsLengthBytes > 0) {
      // NOTE: The protocol is implemented in a way where if the extension bit is set, any
      // deserializer assumes the extensions section is at least one byte long, and the "length"
      // field represents the "number of additional bytes" long the extensions section is. This is
      // potentially unintuitive so I wanted to call it out.
      const rtpOrientedExtensionLengthWords = extensionsLengthWords - 1;
      dataView.setUint16(byteIndex, rtpOrientedExtensionLengthWords);
      byteIndex += U16_LENGTH_BYTES;
      const extensionBytes = this.extensions.toBinaryInto(new DataView(dataView.buffer, dataView.byteOffset + byteIndex));
      byteIndex += extensionBytes;
      for (let i = 0; i < extensionsPaddingLengthBytes; i += 1) {
        dataView.setUint8(byteIndex, 0);
        byteIndex += U8_LENGTH_BYTES;
      }
    }
    const totalLengthBytes = this.toBinaryLengthBytes();
    if (byteIndex !== totalLengthBytes) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("DataTrackPacketHeader.toBinaryInto: Wrote ".concat(byteIndex, " bytes but expected length was ").concat(totalLengthBytes, " bytes"));
    }
    return totalLengthBytes;
  }
  static fromBinary(input) {
    const dataView = coerceToDataView(input);
    if (dataView.byteLength < BASE_HEADER_LEN) {
      throw DataTrackDeserializeError.tooShort();
    }
    let byteIndex = 0;
    const initial = dataView.getUint8(byteIndex);
    byteIndex += U8_LENGTH_BYTES;
    const version = initial >> VERSION_SHIFT & VERSION_MASK;
    if (version > SUPPORTED_VERSION) {
      throw DataTrackDeserializeError.unsupportedVersion(version);
    }
    let marker;
    switch (initial >> FRAME_MARKER_SHIFT & FRAME_MARKER_MASK) {
      case FRAME_MARKER_START:
        marker = FrameMarker.Start;
        break;
      case FRAME_MARKER_FINAL:
        marker = FrameMarker.Final;
        break;
      case FRAME_MARKER_SINGLE:
        marker = FrameMarker.Single;
        break;
      case FRAME_MARKER_INTER:
      default:
        marker = FrameMarker.Inter;
        break;
    }
    const extensionsFlag = (initial >> EXT_FLAG_SHIFT & EXT_FLAG_MASK) > 0;
    byteIndex += U8_LENGTH_BYTES; // Reserved
    let trackHandle;
    try {
      trackHandle = DataTrackHandle.fromNumber(dataView.getUint16(byteIndex));
    } catch (e) {
      if (e instanceof DataTrackHandleError && (e.isReason(DataTrackHandleErrorReason.Reserved) || e.isReason(DataTrackHandleErrorReason.TooLarge))) {
        throw DataTrackDeserializeError.invalidHandle(e);
      } else {
        throw e;
      }
    }
    byteIndex += U16_LENGTH_BYTES;
    const sequence = WrapAroundUnsignedInt.u16(dataView.getUint16(byteIndex));
    byteIndex += U16_LENGTH_BYTES;
    const frameNumber = WrapAroundUnsignedInt.u16(dataView.getUint16(byteIndex));
    byteIndex += U16_LENGTH_BYTES;
    const timestamp = DataTrackTimestamp.fromRtpTicks(dataView.getUint32(byteIndex));
    byteIndex += U32_LENGTH_BYTES;
    let extensions = new DataTrackExtensions();
    if (extensionsFlag) {
      if (dataView.byteLength - byteIndex < U16_LENGTH_BYTES) {
        throw DataTrackDeserializeError.missingExtWords();
      }
      let rtpOrientedExtensionWords = dataView.getUint16(byteIndex);
      byteIndex += U16_LENGTH_BYTES;
      // NOTE: The protocol is implemented in a way where if the extension bit is set, any
      // deserializer assumes the extensions section is at least one byte long, and the "length"
      // field represents the "number of additional bytes" long the extensions section is. This is
      // potentially unintuitive so I wanted to call it out.
      const extensionWords = rtpOrientedExtensionWords + 1;
      let extensionLengthBytes = 4 * extensionWords - EXT_WORDS_INDICATOR_SIZE;
      if (byteIndex + extensionLengthBytes > dataView.byteLength) {
        throw DataTrackDeserializeError.headerOverrun();
      }
      let extensionDataView = new DataView(dataView.buffer, dataView.byteOffset + byteIndex, extensionLengthBytes);
      const _DataTrackExtensions$ = DataTrackExtensions.fromBinary(extensionDataView),
        _DataTrackExtensions$2 = _slicedToArray(_DataTrackExtensions$, 2),
        result = _DataTrackExtensions$2[0],
        readBytes = _DataTrackExtensions$2[1];
      extensions = result;
      byteIndex += readBytes;
    }
    return [new DataTrackPacketHeader({
      marker,
      trackHandle: trackHandle,
      sequence,
      frameNumber,
      timestamp,
      extensions
    }), byteIndex];
  }
  toJSON() {
    return {
      marker: this.marker,
      trackHandle: this.trackHandle,
      sequence: this.sequence.value,
      frameNumber: this.frameNumber.value,
      timestamp: this.timestamp.asTicks(),
      extensions: this.extensions.toJSON()
    };
  }
}
/** Marker indicating a packet's position in relation to a frame. */
var FrameMarker;
(function (FrameMarker) {
  /** Packet is the first in a frame. */
  FrameMarker[FrameMarker["Start"] = 0] = "Start";
  /** Packet is within a frame. */
  FrameMarker[FrameMarker["Inter"] = 1] = "Inter";
  /** Packet is the last in a frame. */
  FrameMarker[FrameMarker["Final"] = 2] = "Final";
  /** Packet is the only one in a frame. */
  FrameMarker[FrameMarker["Single"] = 3] = "Single";
})(FrameMarker || (FrameMarker = {}));
/** A class for serializing / deserializing data track packets. */
class DataTrackPacket extends Serializable {
  constructor(header, payload) {
    super();
    this.header = header;
    this.payload = payload;
  }
  toBinaryLengthBytes() {
    return this.header.toBinaryLengthBytes() + this.payload.byteLength;
  }
  toBinaryInto(dataView) {
    let byteIndex = 0;
    const headerLengthBytes = this.header.toBinaryInto(dataView);
    byteIndex += headerLengthBytes;
    if (dataView.byteLength - byteIndex < this.payload.byteLength) {
      throw DataTrackSerializeError.tooSmallForPayload();
    }
    for (let index = 0; index < this.payload.length; index += 1) {
      dataView.setUint8(byteIndex, this.payload[index]);
      byteIndex += U8_LENGTH_BYTES;
    }
    const totalLengthBytes = this.toBinaryLengthBytes();
    if (byteIndex !== totalLengthBytes) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("DataTrackPacket.toBinaryInto: Wrote ".concat(byteIndex, " bytes but expected length was ").concat(totalLengthBytes, " bytes"));
    }
    return totalLengthBytes;
  }
  static fromBinary(input) {
    const dataView = coerceToDataView(input);
    const _DataTrackPacketHeade = DataTrackPacketHeader.fromBinary(dataView),
      _DataTrackPacketHeade2 = _slicedToArray(_DataTrackPacketHeade, 2),
      header = _DataTrackPacketHeade2[0],
      headerByteLength = _DataTrackPacketHeade2[1];
    const payload = dataView.buffer.slice(dataView.byteOffset + headerByteLength, dataView.byteOffset + dataView.byteLength);
    return [new DataTrackPacket(header, new Uint8Array(payload)), dataView.byteLength];
  }
  toJSON() {
    return {
      header: this.header.toJSON(),
      payload: this.payload
    };
  }
}export{DataTrackPacket,DataTrackPacketHeader,FrameMarker};//# sourceMappingURL=index.mjs.map
