import'./errors.mjs';/** An abstract class implementing common behavior related to data track binary serialization. */
class Serializable {
  /** Encodes the instance as binary and returns the data as a Uint8Array. */
  toBinary() {
    const lengthBytes = this.toBinaryLengthBytes();
    const output = new ArrayBuffer(lengthBytes);
    const view = new DataView(output);
    const writtenBytes = this.toBinaryInto(view);
    if (lengthBytes !== writtenBytes) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("".concat(this.constructor.name, ".toBinary: written bytes (").concat(writtenBytes, " bytes) not equal to allocated array buffer length (").concat(lengthBytes, " bytes)."));
    }
    return new Uint8Array(output);
  }
}export{Serializable as default};//# sourceMappingURL=serializable.mjs.map
