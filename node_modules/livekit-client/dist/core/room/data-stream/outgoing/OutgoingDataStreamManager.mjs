import {__awaiter,__asyncValues}from'tslib';import {Mutex}from'@livekit/mutex';import {Encryption_Type,DataStream_CompressionType,ClientInfo_Capability,DataPacket,DataStream_Chunk,DataStream_Trailer}from'@livekit/protocol';import'../../../logger.mjs';import {CLIENT_PROTOCOL_DATA_STREAM_V2}from'../../../version.mjs';import'../../RTCEngine.mjs';import {DataStreamError,DataStreamErrorReason}from'../../errors.mjs';import {EngineEvent}from'../../events.mjs';import {isDeflateRawCompressionSupported,readableFromBytes,readBytesInChunks,numberToBigInt,splitUtf8}from'../../utils.mjs';import {deflateRawTransform,collect}from'../compression.mjs';import {STREAM_CHUNK_SIZE_BYTES}from'../constants.mjs';import {TextStreamWriter,ByteStreamWriter}from'./StreamWriter.mjs';import {buildTextStreamHeader,createStreamHeaderPacket,buildByteStreamHeader}from'./header-utils.mjs';import {DataChannelKind}from'../../data-channel/types.mjs';const textEncoder = /* @__PURE__ */new TextEncoder();
/**
 * Manages sending custom user data via data channels.
 */
class OutgoingDataStreamManager {
  constructor(engine, log, getRemoteParticipantClientProtocol, getRemoteParticipantCapabilities, getAllRemoteParticipantIdentities) {
    this.engine = engine;
    this.log = log;
    this.getRemoteParticipantClientProtocol = getRemoteParticipantClientProtocol;
    this.getRemoteParticipantCapabilities = getRemoteParticipantCapabilities;
    this.getAllRemoteParticipantIdentities = getAllRemoteParticipantIdentities;
  }
  setupEngine(engine) {
    this.engine = engine;
  }
  /** {@inheritDoc LocalParticipant.sendText} */
  sendText(text, options) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c, _d, _e;
      const streamId = crypto.randomUUID();
      const textInBytes = textEncoder.encode(text);
      const totalTextLength = textInBytes.byteLength;
      const compress = (_a = options === null || options === void 0 ? void 0 : options.compress) !== null && _a !== void 0 ? _a : true;
      let info = {
        id: streamId,
        mimeType: 'text/plain',
        timestamp: Date.now(),
        topic: (_b = options === null || options === void 0 ? void 0 : options.topic) !== null && _b !== void 0 ? _b : '',
        size: totalTextLength,
        // NOTE: size is always the pre-compression byte length
        attributes: options === null || options === void 0 ? void 0 : options.attributes,
        encryptionType: ((_c = this.engine.e2eeManager) === null || _c === void 0 ? void 0 : _c.isDataChannelEncryptionEnabled) ? Encryption_Type.GCM : Encryption_Type.NONE
      };
      const compressEligible = compress && isDeflateRawCompressionSupported() && this.allRecipientsSupportV2(options === null || options === void 0 ? void 0 : options.destinationIdentities) && this.allRecipientsSupportCompression(options === null || options === void 0 ? void 0 : options.destinationIdentities);
      let compressedStream = compressEligible ? MaybeCollectedStream.fromStream(readableFromBytes(textInBytes).pipeThrough(deflateRawTransform())) : null;
      // Phase 1: Try to send as a single packet data stream
      const noAttachments = !(options === null || options === void 0 ? void 0 : options.attachments) || options.attachments.length === 0;
      if (noAttachments && this.allRecipientsSupportV2(options === null || options === void 0 ? void 0 : options.destinationIdentities)) {
        // The payload rides in the header's `inlineContent` (raw bytes). Keep the compressed form only
        // if it actually shrinks the payload (deflate framing makes tiny strings larger). The
        // compression flag is carried in the header's `compression` field; user attributes are left
        // untouched.
        let inlineContent = textInBytes;
        let compression = DataStream_CompressionType.NONE;
        if (compressedStream) {
          const collectedBytes = yield compressedStream.collect();
          if (collectedBytes.byteLength < textInBytes.byteLength) {
            inlineContent = collectedBytes;
            compression = DataStream_CompressionType.DEFLATE_RAW;
          }
        }
        const header = buildTextStreamHeader(info, undefined, {
          compression,
          inlineContent
        });
        const packet = createStreamHeaderPacket(header, options === null || options === void 0 ? void 0 : options.destinationIdentities);
        if (packet.toBinary().byteLength <= STREAM_CHUNK_SIZE_BYTES) {
          yield this.engine.sendDataPacket(packet, DataChannelKind.RELIABLE);
          (_d = options === null || options === void 0 ? void 0 : options.onProgress) === null || _d === void 0 ? void 0 : _d.call(options, 1);
          return info;
        }
      }
      const fileIds = (_e = options === null || options === void 0 ? void 0 : options.attachments) === null || _e === void 0 ? void 0 : _e.map(() => crypto.randomUUID());
      // Progress is split evenly across the text part (slot 0) and one slot per attachment, then
      // normalized to a [0,1] fraction. Each slot climbs monotonically to 1, so the aggregate ends at
      // exactly 1 once every part has completed.
      const parts = fileIds ? fileIds.length + 1 : 1;
      const progresses = new Array(parts).fill(0);
      const handleProgress = (progress, idx) => {
        var _a;
        progresses[idx] = progress;
        (_a = options === null || options === void 0 ? void 0 : options.onProgress) === null || _a === void 0 ? void 0 : _a.call(options, progresses.reduce((acc, val) => acc + val, 0) / parts);
      };
      // Phase 2: Try to send a multi packet data stream with compressed bytes
      if (compressedStream) {
        info.attachedStreamIds = fileIds;
        const header = buildTextStreamHeader(info, undefined, {
          compression: DataStream_CompressionType.DEFLATE_RAW
        });
        const packet = createStreamHeaderPacket(header, options === null || options === void 0 ? void 0 : options.destinationIdentities);
        yield this.sendChunkedByteStream(packet, streamId, options === null || options === void 0 ? void 0 : options.destinationIdentities, compressedStream.stream().pipeThrough(progressReportingStream(textInBytes.length, progress => handleProgress(progress, 0))));
        // Ensure there's always a 100% progress event fired, even if the string is zero bytes long
        if (textInBytes.length === 0) {
          handleProgress(1, 0);
        }
      } else {
        // Phase 3 / fallback: header + plain uncompressed chunk packets + trailer.
        const writer = yield this.streamText({
          streamId,
          totalSize: totalTextLength,
          destinationIdentities: options === null || options === void 0 ? void 0 : options.destinationIdentities,
          topic: options === null || options === void 0 ? void 0 : options.topic,
          attachedStreamIds: fileIds,
          attributes: options === null || options === void 0 ? void 0 : options.attributes
        });
        yield writer.write(text);
        // set text part of progress to 1
        handleProgress(1, 0);
        yield writer.close();
        info = writer.info;
      }
      if ((options === null || options === void 0 ? void 0 : options.attachments) && fileIds) {
        yield Promise.all(options.attachments.map((file, idx) => __awaiter(this, void 0, void 0, function* () {
          return this._sendFile(fileIds[idx], file, {
            topic: options.topic,
            mimeType: file.type,
            destinationIdentities: options.destinationIdentities,
            compress: options.compress,
            onProgress: progress => {
              handleProgress(progress, idx + 1);
            }
          });
        })));
      }
      return info;
    });
  }
  /**
   * Sends a complete in-memory byte payload. Mirrors {@link sendText}'s semantics: when every
   * recipient supports data streams v2 the payload rides inline in a single header packet
   * (optionally deflate-raw compressed), otherwise it is sent as a (optionally compressed)
   * chunked byte stream. Unlike {@link sendFile}, the whole payload is already in memory, so the
   * inline single-packet fast path applies.
   */
  sendBytes(bytes, options) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c, _d, _e, _f, _g;
      const streamId = crypto.randomUUID();
      const destinationIdentities = options === null || options === void 0 ? void 0 : options.destinationIdentities;
      const compress = (_a = options === null || options === void 0 ? void 0 : options.compress) !== null && _a !== void 0 ? _a : true;
      const info = {
        id: streamId,
        name: (_b = options === null || options === void 0 ? void 0 : options.name) !== null && _b !== void 0 ? _b : 'unknown',
        mimeType: (_c = options === null || options === void 0 ? void 0 : options.mimeType) !== null && _c !== void 0 ? _c : 'application/octet-stream',
        timestamp: Date.now(),
        topic: (_d = options === null || options === void 0 ? void 0 : options.topic) !== null && _d !== void 0 ? _d : '',
        size: bytes.byteLength,
        // NOTE: size is always the pre-compression byte length
        attributes: options === null || options === void 0 ? void 0 : options.attributes,
        encryptionType: ((_e = this.engine.e2eeManager) === null || _e === void 0 ? void 0 : _e.isDataChannelEncryptionEnabled) ? Encryption_Type.GCM : Encryption_Type.NONE
      };
      const progressMonitorTap = progressReportingStream(bytes.length, options === null || options === void 0 ? void 0 : options.onProgress);
      const compressEligible = compress && isDeflateRawCompressionSupported() && this.allRecipientsSupportV2(destinationIdentities) && this.allRecipientsSupportCompression(destinationIdentities);
      let compressedStream = compressEligible ? MaybeCollectedStream.fromStream(readableFromBytes(bytes).pipeThrough(progressMonitorTap).pipeThrough(deflateRawTransform())) : null;
      // Phase 1: Try to send as a single packet data stream
      if (this.allRecipientsSupportV2(destinationIdentities)) {
        // The payload rides in the header's `inlineContent` (raw bytes). Keep the compressed form only
        // if it actually shrinks the payload (deflate framing makes tiny payloads larger). The
        // compression flag is carried in the header's `compression` field; user attributes are left
        // untouched.
        let inlineContent = bytes;
        let compression = DataStream_CompressionType.NONE;
        if (compressedStream) {
          const collectedBytes = yield compressedStream.collect();
          if (collectedBytes.byteLength < bytes.byteLength) {
            inlineContent = collectedBytes;
            compression = DataStream_CompressionType.DEFLATE_RAW;
          }
        }
        const header = buildByteStreamHeader(info, {
          compression,
          inlineContent
        });
        const packet = createStreamHeaderPacket(header, destinationIdentities);
        if (packet.toBinary().byteLength <= STREAM_CHUNK_SIZE_BYTES) {
          yield this.engine.sendDataPacket(packet, DataChannelKind.RELIABLE);
          (_f = options === null || options === void 0 ? void 0 : options.onProgress) === null || _f === void 0 ? void 0 : _f.call(options, 1);
          return info;
        }
      }
      // Phase 2/3: header + (optionally compressed) chunk packets + trailer.
      const header = buildByteStreamHeader(info, {
        compression: compressedStream ? DataStream_CompressionType.DEFLATE_RAW : DataStream_CompressionType.NONE
      });
      const packet = createStreamHeaderPacket(header, destinationIdentities);
      const source = compressedStream ? compressedStream.stream() : readableFromBytes(bytes).pipeThrough(progressMonitorTap);
      yield this.sendChunkedByteStream(packet, streamId, destinationIdentities, source);
      // Ensure there's always a 100% progress event fired, even if the buffer is zero bytes long
      if (bytes.length === 0) {
        (_g = options === null || options === void 0 ? void 0 : options.onProgress) === null || _g === void 0 ? void 0 : _g.call(options, 1);
      }
      return info;
    });
  }
  /**
   * Returns true only if every recipient is known to support data streams v2 (single-packet inline
   * streams and compression). For a targeted send this checks the named destination identities; for
   * a broadcast (no explicit destinations) it checks every remote participant currently in the room.
   * An empty room (nobody to receive) is considered eligible.
   */
  allRecipientsSupportV2(destinationIdentities) {
    const identities = destinationIdentities && destinationIdentities.length > 0 ? destinationIdentities : this.getAllRemoteParticipantIdentities();
    return identities.every(identity => this.getRemoteParticipantClientProtocol(identity) >= CLIENT_PROTOCOL_DATA_STREAM_V2);
  }
  /**
   * Returns true only if every recipient advertises the deflate-raw compression capability (so it
   * can decompress a compressed stream). Resolved the same way as {@link allRecipientsSupportV2}:
   * named destinations, or every remote participant for a broadcast; an empty room is eligible.
   */
  allRecipientsSupportCompression(destinationIdentities) {
    const identities = destinationIdentities && destinationIdentities.length > 0 ? destinationIdentities : this.getAllRemoteParticipantIdentities();
    return identities.every(identity => this.getRemoteParticipantCapabilities(identity).includes(ClientInfo_Capability.CAP_COMPRESSION_DEFLATE_RAW));
  }
  /**
   * Shared chunked-stream send for `sendText`/`sendFile`: sends the prebuilt header packet, then
   * forwards `source` (optionally deflate-raw compressed) as `streamChunk` packets re-chunked to
   * the MTU budget with contiguous indices, then sends the trailer. The source is consumed
   * incrementally, so a `file.stream()` is never buffered in full. The platform compressor can't
   * flush mid-stream, so compression is only used when the whole payload is available as a stream
   * up front (not for incremental writers like `streamText`/`streamBytes`).
   */
  sendChunkedByteStream(headerPacket, streamId, destinationIdentities, source) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, e_1, _b, _c;
      const engine = this.engine;
      yield sendHeaderPacket(engine, headerPacket);
      let chunkId = 0;
      try {
        for (var _d = true, _e = __asyncValues(readBytesInChunks(source, STREAM_CHUNK_SIZE_BYTES)), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
          _c = _f.value;
          _d = false;
          const chunk = _c;
          const chunkPacket = new DataPacket({
            destinationIdentities,
            value: {
              case: 'streamChunk',
              value: new DataStream_Chunk({
                content: chunk,
                streamId,
                chunkIndex: numberToBigInt(chunkId)
              })
            }
          });
          yield engine.sendDataPacket(chunkPacket, DataChannelKind.RELIABLE);
          chunkId += 1;
        }
      } catch (e_1_1) {
        e_1 = {
          error: e_1_1
        };
      } finally {
        try {
          if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      yield sendStreamTrailer(streamId, destinationIdentities, engine);
    });
  }
  /**
   * @internal
   */
  streamText(options) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c;
      const streamId = (_a = options === null || options === void 0 ? void 0 : options.streamId) !== null && _a !== void 0 ? _a : crypto.randomUUID();
      const destinationIdentities = options === null || options === void 0 ? void 0 : options.destinationIdentities;
      const info = {
        id: streamId,
        mimeType: 'text/plain',
        timestamp: Date.now(),
        topic: (_b = options === null || options === void 0 ? void 0 : options.topic) !== null && _b !== void 0 ? _b : '',
        size: options === null || options === void 0 ? void 0 : options.totalSize,
        attributes: options === null || options === void 0 ? void 0 : options.attributes,
        encryptionType: ((_c = this.engine.e2eeManager) === null || _c === void 0 ? void 0 : _c.isDataChannelEncryptionEnabled) ? Encryption_Type.GCM : Encryption_Type.NONE,
        attachedStreamIds: options === null || options === void 0 ? void 0 : options.attachedStreamIds
      };
      const header = buildTextStreamHeader(info, options);
      const packet = createStreamHeaderPacket(header, destinationIdentities);
      yield sendHeaderPacket(this.engine, packet);
      let chunkId = 0;
      const engine = this.engine;
      // Incremental text streams are never compressed (CompressionStream does not support flushing
      // mid-stream); one-shot compression lives in sendText.
      //
      // Note that a future streamText could send a context-takeover style deflate-raw stream with
      // intermedia explicit `Z_SYNC_FLUSH`s - receivers already will handle this properly today.
      const writableStream = new WritableStream({
        write(text) {
          return __awaiter(this, void 0, void 0, function* () {
            for (const textByteChunk of splitUtf8(text, STREAM_CHUNK_SIZE_BYTES)) {
              const chunk = new DataStream_Chunk({
                content: textByteChunk,
                streamId,
                chunkIndex: numberToBigInt(chunkId)
              });
              const chunkPacket = new DataPacket({
                destinationIdentities,
                value: {
                  case: 'streamChunk',
                  value: chunk
                }
              });
              yield engine.sendDataPacket(chunkPacket, DataChannelKind.RELIABLE);
              chunkId += 1;
            }
          });
        },
        close() {
          return __awaiter(this, void 0, void 0, function* () {
            yield sendStreamTrailer(streamId, destinationIdentities, engine);
          });
        },
        abort(err) {
          console.log('Sink error:', err);
          // TODO handle aborts to signal something to receiver side
        }
      });
      let onEngineClose = () => __awaiter(this, void 0, void 0, function* () {
        yield writer.close();
      });
      // FIXME: make this a global event to ensure "max listener" warning won't get logged for lots of
      // in flight data streams.
      engine.once(EngineEvent.Closing, onEngineClose);
      const writer = new TextStreamWriter(writableStream, info, () => this.engine.off(EngineEvent.Closing, onEngineClose));
      return writer;
    });
  }
  sendFile(file, options) {
    return __awaiter(this, void 0, void 0, function* () {
      const streamId = crypto.randomUUID();
      yield this._sendFile(streamId, file, options);
      return {
        id: streamId
      };
    });
  }
  /**
   * Streams a file as a chunked byte stream, compressed (deflate-raw) when the runtime supports it
   * and every recipient is on data streams v2. The file is piped `file.stream()` →
   * (`CompressionStream`) → chunk packets via {@link sendChunkedByteStream}, so it is never fully
   * buffered in memory — unlike {@link sendBytes}, there is no inline single-packet fast path for
   * files (the compressed size can't be known up front without buffering the whole file).
   */
  _sendFile(streamId, file, options) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c, _d, _e;
      const destinationIdentities = options === null || options === void 0 ? void 0 : options.destinationIdentities;
      const compress = ((_a = options === null || options === void 0 ? void 0 : options.compress) !== null && _a !== void 0 ? _a : true) && isDeflateRawCompressionSupported() && this.allRecipientsSupportV2(destinationIdentities) && this.allRecipientsSupportCompression(destinationIdentities);
      const info = {
        id: streamId,
        name: file.name,
        mimeType: (_b = options === null || options === void 0 ? void 0 : options.mimeType) !== null && _b !== void 0 ? _b : file.type,
        topic: (_c = options === null || options === void 0 ? void 0 : options.topic) !== null && _c !== void 0 ? _c : '',
        timestamp: Date.now(),
        size: file.size,
        encryptionType: ((_d = this.engine.e2eeManager) === null || _d === void 0 ? void 0 : _d.isDataChannelEncryptionEnabled) ? Encryption_Type.GCM : Encryption_Type.NONE
      };
      // Phase 1: Try to send as a single packet data stream
      //
      // This is not being done explictly for files, because it's challenging to determine ahead of
      // time how well the file contents will compress (and whether the total output will be under the
      // MTU). Revisit this in the future though.
      // Phase 2 (compressed) / Phase 3 (uncompressed fallback): header + chunk packets + trailer. Both
      // funnel through the shared sendChunkedByteStream primitive, differing only by whether the file
      // stream is wrapped in the deflate-raw compressor; the file is never fully buffered in memory.
      const header = buildByteStreamHeader(info, {
        compression: compress ? DataStream_CompressionType.DEFLATE_RAW : DataStream_CompressionType.NONE
      });
      const packet = createStreamHeaderPacket(header, destinationIdentities);
      const tapped = file.stream().pipeThrough(progressReportingStream(file.size, options === null || options === void 0 ? void 0 : options.onProgress));
      const source = compress ? tapped.pipeThrough(deflateRawTransform()) : tapped;
      yield this.sendChunkedByteStream(packet, streamId, destinationIdentities, source);
      // Ensure there's always a 100% progress event fired, even if the file is zero bytes long
      if (file.size === 0) {
        (_e = options === null || options === void 0 ? void 0 : options.onProgress) === null || _e === void 0 ? void 0 : _e.call(options, 1);
      }
      return info;
    });
  }
  streamBytes(options) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c, _d, _e;
      const streamId = (_a = options === null || options === void 0 ? void 0 : options.streamId) !== null && _a !== void 0 ? _a : crypto.randomUUID();
      const destinationIdentities = options === null || options === void 0 ? void 0 : options.destinationIdentities;
      const info = {
        id: streamId,
        mimeType: (_b = options === null || options === void 0 ? void 0 : options.mimeType) !== null && _b !== void 0 ? _b : 'application/octet-stream',
        topic: (_c = options === null || options === void 0 ? void 0 : options.topic) !== null && _c !== void 0 ? _c : '',
        timestamp: Date.now(),
        attributes: options === null || options === void 0 ? void 0 : options.attributes,
        size: options === null || options === void 0 ? void 0 : options.totalSize,
        name: (_d = options === null || options === void 0 ? void 0 : options.name) !== null && _d !== void 0 ? _d : 'unknown',
        encryptionType: ((_e = this.engine.e2eeManager) === null || _e === void 0 ? void 0 : _e.isDataChannelEncryptionEnabled) ? Encryption_Type.GCM : Encryption_Type.NONE
      };
      const header = buildByteStreamHeader(info);
      const packet = createStreamHeaderPacket(header, destinationIdentities);
      yield sendHeaderPacket(this.engine, packet);
      let chunkId = 0;
      const writeMutex = new Mutex();
      const engine = this.engine;
      const logLocal = this.log;
      // Incremental byte streams are never compressed (CompressionStream does not support flushing
      // mid-stream); one-shot compression lives in sendFile.
      //
      // Note that a future streamBytes could send a context-takeover style deflate-raw stream with
      // intermedia explicit `Z_SYNC_FLUSH`s - receivers already will handle this properly today.
      const writableStream = new WritableStream({
        write(chunk) {
          return __awaiter(this, void 0, void 0, function* () {
            const unlock = yield writeMutex.lock();
            let byteOffset = 0;
            try {
              while (byteOffset < chunk.byteLength) {
                const subChunk = chunk.slice(byteOffset, byteOffset + STREAM_CHUNK_SIZE_BYTES);
                const chunkPacket = new DataPacket({
                  destinationIdentities,
                  value: {
                    case: 'streamChunk',
                    value: new DataStream_Chunk({
                      content: subChunk,
                      streamId,
                      chunkIndex: numberToBigInt(chunkId)
                    })
                  }
                });
                yield engine.sendDataPacket(chunkPacket, DataChannelKind.RELIABLE);
                chunkId += 1;
                byteOffset += subChunk.byteLength;
              }
            } finally {
              unlock();
            }
          });
        },
        close() {
          return __awaiter(this, void 0, void 0, function* () {
            yield sendStreamTrailer(streamId, destinationIdentities, engine);
          });
        },
        abort(err) {
          logLocal.error('Sink error:', err);
        }
      });
      const byteWriter = new ByteStreamWriter(writableStream, info);
      return byteWriter;
    });
  }
}
/**
 * Wraps a stream of compressed bytes and defers buffering it into memory until (and only if) the
 * full length is actually needed.
 *
 * The ideal way to send a compressed stream is incrementally: compress each chunk and send it as
 * soon as it's ready, without ever holding the whole payload in memory. But to decide whether a
 * payload is small enough to fit in a single-packet data stream, we have to know the compressed
 * length — and the only way to learn that is to compress everything and add up the bytes. That
 * forces us to buffer the entire compressed output before we can make the decision.
 *
 * This class lets us have it both ways. It holds the compressed stream unread by default and only
 * collects it into memory ({@link collect}) when a caller needs the length for the single-packet
 * size check. If that check never happens, the stream is instead {@link stream|passed straight
 * through} to the downstream consumer without ever being fully buffered. Once collected, later
 * calls reuse the buffered bytes rather than re-collecting.
 */
class MaybeCollectedStream {
  constructor(state) {
    this.state = state;
  }
  static fromStream(stream) {
    return new MaybeCollectedStream({
      type: 'stream',
      stream
    });
  }
  /** Collect data from the stream into memory and return as a Uint8Array. */
  collect() {
    return __awaiter(this, void 0, void 0, function* () {
      switch (this.state.type) {
        case 'stream':
          const bytes = yield collect(this.state.stream);
          this.state = {
            type: 'collected',
            bytes
          };
          return bytes;
        case 'collected':
          return this.state.bytes;
      }
    });
  }
  /** Pass wrapped stream through to downstream consumer. */
  stream() {
    switch (this.state.type) {
      case 'stream':
        return this.state.stream;
      case 'collected':
        return readableFromBytes(this.state.bytes);
    }
  }
}
/**
 * A pass-through byte transform that reports progress as bytes flow through it, measured against
 * `totalLength`. Used as a "tap" to instrument the source of a chunked send without threading a
 * progress callback through the send primitive.
 *
 * IMPORTANT: This should be upstream of any compression step.
 *
 * Emits nothing when the total is unknown or zero.
 */
function progressReportingStream(totalPreCompressionLength, onProgress) {
  let sent = 0;
  return new TransformStream({
    transform(chunk, controller) {
      sent += chunk.byteLength;
      if (onProgress && typeof totalPreCompressionLength === 'number' && totalPreCompressionLength > 0) {
        onProgress(Math.min(sent / totalPreCompressionLength, 1));
      }
      controller.enqueue(chunk);
    }
  });
}
/**
 * Sends a stream `streamHeader` packet, enforcing that it fits the MTU budget. The header carries
 * the user attributes (plus topic/framing), and a single `DataPacket` larger than the MTU can't be
 * reliably sent — so an oversized header (almost always due to large attributes) is a hard error
 * rather than a malformed packet on the wire. The inline fast path does its own size check and
 * falls back to the chunked path instead of calling this.
 */
function sendHeaderPacket(engine, packet) {
  return __awaiter(this, void 0, void 0, function* () {
    if (packet.toBinary().byteLength > STREAM_CHUNK_SIZE_BYTES) {
      throw new DataStreamError("data stream header exceeds the ".concat(STREAM_CHUNK_SIZE_BYTES, "-byte limit; reduce attribute size"), DataStreamErrorReason.HeaderTooLarge);
    }
    yield engine.sendDataPacket(packet, DataChannelKind.RELIABLE);
  });
}
/** Sends a `streamTrailer` packet, marking the end of a stream. */
function sendStreamTrailer(streamId, destinationIdentities, engine) {
  return __awaiter(this, void 0, void 0, function* () {
    const trailerPacket = new DataPacket({
      destinationIdentities,
      value: {
        case: 'streamTrailer',
        value: new DataStream_Trailer({
          streamId
        })
      }
    });
    yield engine.sendDataPacket(trailerPacket, DataChannelKind.RELIABLE);
  });
}export{OutgoingDataStreamManager as default};//# sourceMappingURL=OutgoingDataStreamManager.mjs.map
