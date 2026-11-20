import {LivekitReasonedError}from'../errors.mjs';import'./packet/extensions.mjs';import'./handle.mjs';import {FrameMarker,DataTrackPacketHeader,DataTrackPacket}from'./packet/index.mjs';import {WrapAroundUnsignedInt,DataTrackClock,DataTrackTimestamp}from'./utils.mjs';class DataTrackPacketizerError extends LivekitReasonedError {
  constructor(message, reason, options) {
    super(19, message, options);
    this.name = 'DataTrackPacketizerError';
    this.reason = reason;
    this.reasonName = DataTrackPacketizerReason[reason];
  }
  static mtuTooShort() {
    return new DataTrackPacketizerError('MTU is too short to send frame', DataTrackPacketizerReason.MtuTooShort);
  }
}
var DataTrackPacketizerReason;
(function (DataTrackPacketizerReason) {
  DataTrackPacketizerReason[DataTrackPacketizerReason["MtuTooShort"] = 0] = "MtuTooShort";
})(DataTrackPacketizerReason || (DataTrackPacketizerReason = {}));
/** A packetizer takes a {@link DataTrackFrameInternal} as input and generates a series
 * of {@link DataTrackPacket}s for transmission to other clients over webrtc. */
class DataTrackPacketizer {
  constructor(trackHandle, mtuSizeBytes) {
    this.sequence = WrapAroundUnsignedInt.u16(0);
    this.frameNumber = WrapAroundUnsignedInt.u16(0);
    this.clock = DataTrackClock.rtpStartingNow(DataTrackTimestamp.rtpRandom());
    this.handle = trackHandle;
    this.mtuSizeBytes = mtuSizeBytes;
  }
  /** @internal */
  static computeFrameMarker(index, packetCount) {
    if (packetCount <= 1) {
      return FrameMarker.Single;
    }
    if (index === 0) {
      return FrameMarker.Start;
    } else if (index === packetCount - 1) {
      return FrameMarker.Final;
    } else {
      return FrameMarker.Inter;
    }
  }
  /** Generates a series of packets for the specified {@link DataTrackFrameInternal}.
   *
   * NOTE: The return value of this function is a generator, so it can be lazily ran if desired,
   * or converted to an array with {@link Array.from}.
   */
  *packetize(frame, options) {
    var _a;
    const frameNumber = this.frameNumber.getThenIncrement();
    const headerParams = {
      marker: FrameMarker.Inter,
      trackHandle: this.handle,
      sequence: WrapAroundUnsignedInt.u16(0),
      frameNumber,
      timestamp: (_a = options === null || options === void 0 ? void 0 : options.now) !== null && _a !== void 0 ? _a : this.clock.now(),
      extensions: frame.extensions
    };
    const headerSerializedLengthBytes = new DataTrackPacketHeader(headerParams).toBinaryLengthBytes();
    if (headerSerializedLengthBytes >= this.mtuSizeBytes) {
      throw DataTrackPacketizerError.mtuTooShort();
    }
    const maxPayloadSizeBytes = this.mtuSizeBytes - headerSerializedLengthBytes;
    const packetCount = Math.ceil(frame.payload.byteLength / maxPayloadSizeBytes);
    for (let index = 0, indexBytes = 0; indexBytes < frame.payload.byteLength; _ref = [index + 1, indexBytes + maxPayloadSizeBytes], index = _ref[0], indexBytes = _ref[1], _ref) {
      var _ref;
      const sequence = this.sequence.getThenIncrement();
      const packetHeader = new DataTrackPacketHeader(Object.assign(Object.assign({}, headerParams), {
        marker: DataTrackPacketizer.computeFrameMarker(index, packetCount),
        sequence
      }));
      const packetPayloadLengthBytes = Math.min(
      // All but the last packet will be max length ...
      maxPayloadSizeBytes,
      // ... and the last packet will be as long as it needs to be to finish out the buffer.
      frame.payload.byteLength - indexBytes);
      const packetPayload = new Uint8Array(frame.payload.buffer, frame.payload.byteOffset + indexBytes, packetPayloadLengthBytes);
      yield new DataTrackPacket(packetHeader, packetPayload);
    }
  }
}export{DataTrackPacketizerError,DataTrackPacketizerReason,DataTrackPacketizer as default};//# sourceMappingURL=packetizer.mjs.map
