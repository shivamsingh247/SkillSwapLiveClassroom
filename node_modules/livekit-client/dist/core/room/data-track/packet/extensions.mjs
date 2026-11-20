import {coerceToDataView}from'../utils.mjs';import {U8_LENGTH_BYTES,EXT_TAG_PADDING,U64_LENGTH_BYTES}from'./constants.mjs';import {DataTrackDeserializeError}from'./errors.mjs';import Serializable from'./serializable.mjs';var DataTrackExtensionTag;
(function (DataTrackExtensionTag) {
  DataTrackExtensionTag[DataTrackExtensionTag["UserTimestamp"] = 2] = "UserTimestamp";
  DataTrackExtensionTag[DataTrackExtensionTag["E2ee"] = 1] = "E2ee";
})(DataTrackExtensionTag || (DataTrackExtensionTag = {}));
class DataTrackExtension extends Serializable {}
class DataTrackUserTimestampExtension extends DataTrackExtension {
  constructor(timestamp) {
    super();
    this.timestamp = timestamp;
  }
  toBinaryLengthBytes() {
    return U8_LENGTH_BYTES /* tag */ + U8_LENGTH_BYTES /* length */ + DataTrackUserTimestampExtension.lengthBytes;
  }
  toBinaryInto(dataView) {
    let byteIndex = 0;
    dataView.setUint8(byteIndex, DataTrackUserTimestampExtension.tag);
    byteIndex += U8_LENGTH_BYTES;
    dataView.setUint8(byteIndex, DataTrackUserTimestampExtension.lengthBytes);
    byteIndex += U8_LENGTH_BYTES;
    dataView.setBigUint64(byteIndex, this.timestamp);
    byteIndex += U64_LENGTH_BYTES;
    const totalLengthBytes = this.toBinaryLengthBytes();
    if (byteIndex !== totalLengthBytes) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("DataTrackUserTimestampExtension.toBinaryInto: Wrote ".concat(byteIndex, " bytes but expected length was ").concat(totalLengthBytes, " bytes"));
    }
    return byteIndex;
  }
  toJSON() {
    return {
      tag: DataTrackUserTimestampExtension.tag,
      lengthBytes: DataTrackUserTimestampExtension.lengthBytes,
      timestamp: this.timestamp
    };
  }
}
DataTrackUserTimestampExtension.tag = DataTrackExtensionTag.UserTimestamp;
DataTrackUserTimestampExtension.lengthBytes = 8;
class DataTrackE2eeExtension extends DataTrackExtension {
  constructor(keyIndex, iv) {
    super();
    this.keyIndex = keyIndex;
    this.iv = iv;
  }
  toBinaryLengthBytes() {
    return U8_LENGTH_BYTES /* tag */ + U8_LENGTH_BYTES /* length */ + DataTrackE2eeExtension.lengthBytes;
  }
  toBinaryInto(dataView) {
    let byteIndex = 0;
    dataView.setUint8(byteIndex, DataTrackE2eeExtension.tag);
    byteIndex += U8_LENGTH_BYTES;
    dataView.setUint8(byteIndex, DataTrackE2eeExtension.lengthBytes);
    byteIndex += U8_LENGTH_BYTES;
    dataView.setUint8(byteIndex, this.keyIndex);
    byteIndex += U8_LENGTH_BYTES;
    for (let i = 0; i < this.iv.length; i += 1) {
      dataView.setUint8(byteIndex, this.iv[i]);
      byteIndex += U8_LENGTH_BYTES;
    }
    const totalLengthBytes = this.toBinaryLengthBytes();
    if (byteIndex !== totalLengthBytes) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("DataTrackE2eeExtension.toBinaryInto: Wrote ".concat(byteIndex, " bytes but expected length was ").concat(totalLengthBytes, " bytes"));
    }
    return byteIndex;
  }
  toJSON() {
    return {
      tag: DataTrackE2eeExtension.tag,
      lengthBytes: DataTrackE2eeExtension.lengthBytes,
      keyIndex: this.keyIndex,
      iv: this.iv
    };
  }
}
DataTrackE2eeExtension.tag = DataTrackExtensionTag.E2ee;
DataTrackE2eeExtension.lengthBytes = 13;
class DataTrackExtensions extends Serializable {
  constructor() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    super();
    this.userTimestamp = opts.userTimestamp;
    this.e2ee = opts.e2ee;
  }
  toBinaryLengthBytes() {
    let lengthBytes = 0;
    if (this.userTimestamp) {
      lengthBytes += this.userTimestamp.toBinaryLengthBytes();
    }
    if (this.e2ee) {
      lengthBytes += this.e2ee.toBinaryLengthBytes();
    }
    return lengthBytes;
  }
  toBinaryInto(dataView) {
    let byteIndex = 0;
    if (this.e2ee) {
      const e2eeBytes = this.e2ee.toBinaryInto(dataView);
      byteIndex += e2eeBytes;
    }
    if (this.userTimestamp) {
      const userTimestampBytes = this.userTimestamp.toBinaryInto(new DataView(dataView.buffer, dataView.byteOffset + byteIndex));
      byteIndex += userTimestampBytes;
    }
    const totalLengthBytes = this.toBinaryLengthBytes();
    if (byteIndex !== totalLengthBytes) {
      // @throws-transformer ignore - this should be treated as a "panic" and not be caught
      throw new Error("DataTrackExtensions.toBinaryInto: Wrote ".concat(byteIndex, " bytes but expected length was ").concat(totalLengthBytes, " bytes"));
    }
    return byteIndex;
  }
  static fromBinary(input) {
    const dataView = coerceToDataView(input);
    let userTimestamp;
    let e2ee;
    let byteIndex = 0;
    while (dataView.byteLength - byteIndex >= U8_LENGTH_BYTES + U8_LENGTH_BYTES) {
      const tag = dataView.getUint8(byteIndex);
      byteIndex += U8_LENGTH_BYTES;
      const lengthBytes = dataView.getUint8(byteIndex);
      byteIndex += U8_LENGTH_BYTES;
      if (tag === EXT_TAG_PADDING) {
        // Skip padding
        continue;
      }
      switch (tag) {
        case DataTrackExtensionTag.UserTimestamp:
          if (dataView.byteLength - byteIndex < DataTrackUserTimestampExtension.lengthBytes) {
            throw DataTrackDeserializeError.malformedExt(tag);
          }
          userTimestamp = new DataTrackUserTimestampExtension(dataView.getBigUint64(byteIndex));
          byteIndex += lengthBytes;
          break;
        case DataTrackExtensionTag.E2ee:
          if (dataView.byteLength - byteIndex < DataTrackE2eeExtension.lengthBytes) {
            throw DataTrackDeserializeError.malformedExt(tag);
          }
          const keyIndex = dataView.getUint8(byteIndex);
          const iv = new Uint8Array(12);
          for (let i = 0; i < iv.length; i += 1) {
            let byteIndexForIv = byteIndex;
            byteIndexForIv += U8_LENGTH_BYTES; // key index
            byteIndexForIv += i * U8_LENGTH_BYTES; // Index into iv array
            iv[i] = dataView.getUint8(byteIndexForIv);
          }
          e2ee = new DataTrackE2eeExtension(keyIndex, iv);
          byteIndex += lengthBytes;
          break;
        default:
          // Skip over unknown extensions (forward compatible).
          if (dataView.byteLength - byteIndex < lengthBytes) {
            throw DataTrackDeserializeError.malformedExt(tag);
          }
          byteIndex += lengthBytes;
          break;
      }
    }
    // NOTE: padding bytes after extension data is intentionally not being processed
    return [new DataTrackExtensions({
      userTimestamp,
      e2ee
    }), dataView.byteLength];
  }
  toJSON() {
    var _a, _b, _c, _d;
    return {
      userTimestamp: (_b = (_a = this.userTimestamp) === null || _a === void 0 ? void 0 : _a.toJSON()) !== null && _b !== void 0 ? _b : null,
      e2ee: (_d = (_c = this.e2ee) === null || _c === void 0 ? void 0 : _c.toJSON()) !== null && _d !== void 0 ? _d : null
    };
  }
}export{DataTrackE2eeExtension,DataTrackExtensionTag,DataTrackExtensions,DataTrackUserTimestampExtension};//# sourceMappingURL=extensions.mjs.map
