import {getLogger,LoggerNames}from'../../logger.mjs';import {LivekitReasonedError}from'../errors.mjs';import'./packet/extensions.mjs';import {FrameMarker}from'./packet/index.mjs';const log = /* @__PURE__ */getLogger(LoggerNames.DataTracks);
/** An error indicating a frame was dropped. */
class DataTrackDepacketizerDropError extends LivekitReasonedError {
  constructor(message, reason, frameNumber, options) {
    super(19, "Frame ".concat(frameNumber, " dropped: ").concat(message), options);
    this.name = 'DataTrackDepacketizerDropError';
    this.reason = reason;
    this.reasonName = DataTrackDepacketizerDropReason[reason];
    this.frameNumber = frameNumber;
  }
  static interrupted(frameNumber, newFrameNumber) {
    return new DataTrackDepacketizerDropError("Interrupted by the start of a new frame ".concat(newFrameNumber), DataTrackDepacketizerDropReason.Interrupted, frameNumber);
  }
  static unknownFrame(frameNumber) {
    return new DataTrackDepacketizerDropError('Initial packet was never received.', DataTrackDepacketizerDropReason.UnknownFrame, frameNumber);
  }
  static bufferFull(frameNumber) {
    return new DataTrackDepacketizerDropError('Reorder buffer is full.', DataTrackDepacketizerDropReason.BufferFull, frameNumber);
  }
  static incomplete(frameNumber, receivedPackets, expectedPackets) {
    return new DataTrackDepacketizerDropError("Not all packets received before final packet. Received ".concat(receivedPackets, " packets, expected ").concat(expectedPackets, " packets."), DataTrackDepacketizerDropReason.Incomplete, frameNumber);
  }
}
/** Reason why a frame was dropped. */
var DataTrackDepacketizerDropReason;
(function (DataTrackDepacketizerDropReason) {
  DataTrackDepacketizerDropReason[DataTrackDepacketizerDropReason["Interrupted"] = 0] = "Interrupted";
  DataTrackDepacketizerDropReason[DataTrackDepacketizerDropReason["UnknownFrame"] = 1] = "UnknownFrame";
  DataTrackDepacketizerDropReason[DataTrackDepacketizerDropReason["BufferFull"] = 2] = "BufferFull";
  DataTrackDepacketizerDropReason[DataTrackDepacketizerDropReason["Incomplete"] = 3] = "Incomplete";
})(DataTrackDepacketizerDropReason || (DataTrackDepacketizerDropReason = {}));
class DataTrackDepacketizer {
  constructor() {
    /** Partial frames currently being assembled, keyed by frame number. `Map` preserves insertion
     * order, so the oldest entry is the first key. */
    this.partials = new Map();
  }
  /** Should be repeatedly called with received {@link DataTrackPacket}s - intermediate calls
   * aggregate the packet's state internally, and return null.
   *
   * Once this method is called with the final packet to form a frame, a new {@link DataTrackFrameInternal}
   * is returned.*/
  push(packet, options) {
    switch (packet.header.marker) {
      case FrameMarker.Single:
        return this.frameFromSingle(packet, options);
      case FrameMarker.Start:
        return this.beginPartial(packet, options);
      case FrameMarker.Inter:
      case FrameMarker.Final:
        return this.pushToPartial(packet);
    }
  }
  reset() {
    this.partials.clear();
  }
  peekOldestPartialFrameNumber() {
    const first = this.partials.keys().next();
    return first.done ? null : first.value;
  }
  frameFromSingle(packet, options) {
    var _a;
    if (packet.header.marker !== FrameMarker.Single) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("Depacketizer.frameFromSingle: packet.header.marker was not FrameMarker.Single, found ".concat(packet.header.marker, "."));
    }
    // A `Single` packet is a self-contained frame and doesn't reserve a partials slot, but if
    // the partials map is at capacity, treat it as a signal that the oldest in-flight partial
    // is stale and evict it (matches `main`'s behavior when `maxPartialFrames`
    // defaults to 1).
    const maxPartialFrames = (_a = options === null || options === void 0 ? void 0 : options.maxPartialFrames) !== null && _a !== void 0 ? _a : 1;
    if (this.partials.size >= maxPartialFrames) {
      const oldestPartialFrameNumber = this.peekOldestPartialFrameNumber();
      if (typeof oldestPartialFrameNumber !== 'number') {
        // @throws-transformer ignore - this should be treated as a "panic" and not be caught
        throw new Error("Depacketizer.frameFromSingle: no oldest frame number found, but partials.size is ".concat(this.partials.size, "."));
      }
      this.partials.delete(oldestPartialFrameNumber);
      if (options === null || options === void 0 ? void 0 : options.throwOnInterruption) {
        throw DataTrackDepacketizerDropError.interrupted(oldestPartialFrameNumber, packet.header.frameNumber.value);
      }
      log.warn("Data track frame ".concat(oldestPartialFrameNumber, " was interrupted by single-packet frame ").concat(packet.header.frameNumber.value, ", dropping."));
    }
    return {
      payload: packet.payload,
      extensions: packet.header.extensions
    };
  }
  /** Begin assembling a new packet. */
  beginPartial(packet, options) {
    var _a;
    if (packet.header.marker !== FrameMarker.Start) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("Depacketizer.beginPartial: packet.header.marker was not FrameMarker.Start, found ".concat(packet.header.marker, "."));
    }
    const startSequence = packet.header.sequence;
    const frameNumber = packet.header.frameNumber.value;
    const partial = {
      startSequence,
      extensions: packet.header.extensions,
      payloads: new Map([[startSequence.value, packet.payload]])
    };
    // Loop in case `maxPartialFrames` shrunk relative to a previous push call - evict the
    // oldest partials until there is room for the new one. With `throwOnInterruption` set the
    // throw inside the loop short-circuits on the first eviction, matching the single-eviction
    // behavior callers expect when they ask to be told about interruptions.
    const maxPartialFrames = (_a = options === null || options === void 0 ? void 0 : options.maxPartialFrames) !== null && _a !== void 0 ? _a : 1;
    while (this.partials.size >= maxPartialFrames) {
      const oldestPartialFrameNumber = this.peekOldestPartialFrameNumber();
      if (typeof oldestPartialFrameNumber !== 'number') {
        // partials map is empty - nothing more to evict
        break;
      }
      this.partials.delete(oldestPartialFrameNumber);
      if (options === null || options === void 0 ? void 0 : options.throwOnInterruption) {
        throw DataTrackDepacketizerDropError.interrupted(oldestPartialFrameNumber, frameNumber);
      }
      log.warn("Data track partials full (max ".concat(maxPartialFrames, "), evicted oldest frame ").concat(oldestPartialFrameNumber, " to make room for new frame ").concat(frameNumber, "."));
    }
    this.partials.set(frameNumber, partial);
    return null;
  }
  /** Push to the existing partial frame. */
  pushToPartial(packet) {
    if (packet.header.marker !== FrameMarker.Inter && packet.header.marker !== FrameMarker.Final) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("Depacketizer.pushToPartial: packet.header.marker was not FrameMarker.Inter or FrameMarker.Final, found ".concat(packet.header.marker, "."));
    }
    const packetFrameNumber = packet.header.frameNumber.value;
    const matchingPartial = this.partials.get(packetFrameNumber);
    if (!matchingPartial) {
      this.partials.delete(packetFrameNumber);
      throw DataTrackDepacketizerDropError.unknownFrame(packetFrameNumber);
    }
    // NOTE: this check will block reprocessing packets with duplicate sequence values if the
    // buffer is full already, which could maybe be problematic for very large frames.
    if (matchingPartial.payloads.size >= DataTrackDepacketizer.MAX_BUFFER_PACKETS) {
      this.partials.delete(packetFrameNumber);
      throw DataTrackDepacketizerDropError.bufferFull(packetFrameNumber);
    }
    // Note: receiving a packet with a duplicate `sequence` value is something that likely won't
    // happen in actual use, but even if it does (maybe a low level network retransmission?) the
    // last packet with a given sequence received should always win.
    if (matchingPartial.payloads.has(packet.header.sequence.value)) {
      log.warn("Data track frame ".concat(packetFrameNumber, " received duplicate packet for sequence ").concat(packet.header.sequence.value, ", so replacing with newly received packet."));
    }
    matchingPartial.payloads.set(packet.header.sequence.value, packet.payload);
    if (packet.header.marker === FrameMarker.Final) {
      return this.finalize(packetFrameNumber, matchingPartial, packet.header.sequence.value);
    }
    return null;
  }
  /** Try to reassemble the complete frame. */
  finalize(partialFrameNumber, partial, endSequence) {
    const received = partial.payloads.size;
    let payloadLengthBytes = 0;
    for (const p of partial.payloads.values()) {
      payloadLengthBytes += p.length;
    }
    const payload = new Uint8Array(payloadLengthBytes);
    let sequencePointer = partial.startSequence.clone();
    let payloadOffsetPointerBytes = 0;
    while (true) {
      const partialPayload = partial.payloads.get(sequencePointer.value);
      if (!partialPayload) {
        break;
      }
      partial.payloads.delete(sequencePointer.value);
      const payloadRemainingBytes = payload.length - payloadOffsetPointerBytes;
      if (partialPayload.length > payloadRemainingBytes) {
        // @throws-transformer ignore - this should be treated as a "panic" and not be caught
        throw new Error("Depacketizer.finalize: Expected at least ".concat(partialPayload.length, " more bytes left in the payload buffer, only got ").concat(payloadRemainingBytes, " bytes."));
      }
      payload.set(partialPayload, payloadOffsetPointerBytes);
      payloadOffsetPointerBytes += partialPayload.length;
      // NOTE: sequencePointer could wrap around, which is why this isn't a "<"
      if (sequencePointer.value != endSequence) {
        sequencePointer.increment();
        continue;
      }
      // The packet is done processing, reset the state so another frame can be processed next.
      this.partials.delete(partialFrameNumber);
      return {
        payload,
        extensions: partial.extensions
      };
    }
    this.partials.delete(partialFrameNumber);
    throw DataTrackDepacketizerDropError.incomplete(partialFrameNumber, received, endSequence - partial.startSequence.value + 1);
  }
}
/** Maximum number of packets to buffer per frame before dropping. */
DataTrackDepacketizer.MAX_BUFFER_PACKETS = 128;export{DataTrackDepacketizerDropError,DataTrackDepacketizerDropReason,DataTrackDepacketizer as default};//# sourceMappingURL=depacketizer.mjs.map
