import {__awaiter}from'tslib';import {DataStreamError,DataStreamErrorReason}from'../errors.mjs';/**
 * A `deflate-raw` compression transform (inverse of {@link inflateRawTransform}): pipe a byte stream
 * through it to get the compressed bytes without buffering the whole payload. Used for the chunked
 * `sendText`/`sendBytes`/`sendFile` paths, where the full payload is known up front but is streamed
 * (e.g. from `file.stream()`) rather than held in memory.
 */
function deflateRawTransform() {
  return new CompressionStream('deflate-raw');
}
/**
 * A `deflate-raw` decompression transform (inverse of {@link deflateRawTransform}): pipe a
 * stream of compressed bytes through it to get the decompressed bytes. Inflate emits output greedily,
 * so as long as the sender flushed at write boundaries each write's content is produced as soon as
 * its compressed bytes arrive.
 */
function inflateRawTransform() {
  return new DecompressionStream('deflate-raw');
}
/**
 * Decompresses a raw-deflate byte array in full (inverse of {@link deflateRawCompress}).
 * `maxByteLength` bounds the decompressed output (decompression-bomb guard); exceeding it rejects
 * with a `PayloadTooLarge` error.
 */
function deflateRawDecompress(data, maxByteLength) {
  return __awaiter(this, void 0, void 0, function* () {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    // The writer promises are intentionally not awaited (output is consumed via `collect`), but
    // they reject when the byte cap cancels the readable mid-stream — swallow that so an enforced
    // cap doesn't surface as an unhandled rejection.
    writer.write(data).catch(() => {});
    writer.close().catch(() => {});
    return collect(ds.readable, maxByteLength);
  });
}
/**
 * Drains a byte stream, concatenating all of its chunks into a single array. When
 * `maxByteLength` is given, drops the stream and throws `PayloadTooLarge` as soon as the
 * accumulated output exceeds it.
 */
function collect(stream, maxByteLength) {
  return __awaiter(this, void 0, void 0, function* () {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const _yield$reader$read = yield reader.read(),
        done = _yield$reader$read.done,
        value = _yield$reader$read.value;
      if (done) {
        break;
      }
      chunks.push(value);
      total += value.byteLength;
      if (typeof maxByteLength === 'number' && total > maxByteLength) {
        yield reader.cancel();
        throw new DataStreamError("Decompressed payload exceeds the maximum payload size of ".concat(maxByteLength, " bytes"), DataStreamErrorReason.PayloadTooLarge);
      }
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  });
}export{collect,deflateRawDecompress,deflateRawTransform,inflateRawTransform};//# sourceMappingURL=compression.mjs.map
