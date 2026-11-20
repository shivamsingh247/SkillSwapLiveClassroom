const U16_MAX_SIZE = 0xffff;
const U32_MAX_SIZE = 0xffffffff;
/**
 * A number of fields within the data tracks packet specification assume wrap around behavior when
 * an unsigned type is incremented beyond its max size (ie, the packet `sequence` field). This
 * wrapper type manually reimplements this wrap around behavior given javascript's lack of fixed
 * size integer types.
 */
class WrapAroundUnsignedInt {
  static u16(raw) {
    return new WrapAroundUnsignedInt(raw, U16_MAX_SIZE);
  }
  static u32(raw) {
    return new WrapAroundUnsignedInt(raw, U32_MAX_SIZE);
  }
  constructor(raw, maxSize) {
    this.value = raw;
    if (raw < 0) {
      throw new Error('WrapAroundUnsignedInt: cannot faithfully represent an integer smaller than 0');
    }
    if (maxSize > Number.MAX_SAFE_INTEGER) {
      throw new Error('WrapAroundUnsignedInt: cannot faithfully represent an integer bigger than MAX_SAFE_INTEGER.');
    }
    this.maxSize = maxSize;
    this.clamp();
  }
  /** Manually clamp the given containing value according to the wrap around max size bounds. Use
   * this after out of bounds modification to the contained value by external code. */
  clamp() {
    while (this.value > this.maxSize) {
      this.value -= this.maxSize + 1;
    }
    while (this.value < 0) {
      this.value += this.maxSize + 1;
    }
  }
  clone() {
    return new WrapAroundUnsignedInt(this.value, this.maxSize);
  }
  /** When called, maps the containing value to a new containing value. After mapping, the wrap
   * around external max size bounds are applied. Note that this is a mutative operation. */
  update(updateFn) {
    this.value = updateFn(this.value);
    this.clamp();
  }
  /** Increments the given `n` to the inner value. Note that this is a mutative operation. */
  increment() {
    let n = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    this.update(value => value + n);
  }
  /** Decrements the given `n` from the inner value. Note that this is a mutative operation. */
  decrement() {
    let n = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    this.update(value => value - n);
  }
  getThenIncrement() {
    const previousValue = this.value;
    this.increment();
    return new WrapAroundUnsignedInt(previousValue, this.maxSize);
  }
  /** Returns true if {@link this} is before the passed other {@link WrapAroundUnsignedInt}. */
  isBefore(other) {
    const a = this.value >>> 0;
    const b = other.value >>> 0;
    const diff = b - a >>> 0;
    return diff !== 0 && diff < this.maxSize + 1;
  }
}
class DataTrackTimestamp {
  static fromRtpTicks(rtpTicks) {
    return new DataTrackTimestamp(rtpTicks, 90000);
  }
  /** Generates a timestamp initialized to a non cryptographically secure random value, so that
   * different streams are more difficult to correlate in packet capture. */
  static rtpRandom() {
    const randomValue = Math.round(Math.random() * U32_MAX_SIZE);
    return DataTrackTimestamp.fromRtpTicks(randomValue);
  }
  constructor(raw, rateInHz) {
    this.timestamp = WrapAroundUnsignedInt.u32(raw);
    this.rateInHz = rateInHz;
  }
  asTicks() {
    return this.timestamp.value;
  }
  clone() {
    return new DataTrackTimestamp(this.timestamp.value, this.rateInHz);
  }
  wrappingAdd(n) {
    this.timestamp.increment(n);
  }
  /** Returns true if {@link this} is before the passed other {@link DataTrackTimestamp}. */
  isBefore(other) {
    return this.timestamp.isBefore(other.timestamp);
  }
}
class DataTrackClock {
  constructor(rateInHz, epoch, base) {
    this.epoch = epoch;
    this.base = base;
    this.previous = base.clone();
    this.rateInHz = rateInHz;
  }
  static startingNow(base, rateInHz) {
    return new DataTrackClock(rateInHz, new Date(), base);
  }
  static startingAtTime(epoch, base, rateInHz) {
    return new DataTrackClock(rateInHz, epoch, base);
  }
  static rtpStartingNow(base) {
    return DataTrackClock.startingNow(base, 90000);
  }
  static rtpStartingAtTime(epoch, base) {
    return DataTrackClock.startingAtTime(epoch, base, 90000);
  }
  now() {
    return this.at(new Date());
  }
  at(timestamp) {
    let elapsedMs = timestamp.getTime() - this.epoch.getTime();
    let durationTicks = DataTrackClock.durationInMsToTicks(elapsedMs, this.rateInHz);
    let result = this.base.clone();
    result.wrappingAdd(durationTicks);
    // Enforce monotonicity in RTP wraparound space
    if (result.isBefore(this.previous)) {
      result = this.previous;
    }
    this.previous = result.clone();
    return result.clone();
  }
  /** Convert a duration since the epoch into clock ticks. */
  static durationInMsToTicks(durationMilliseconds, rateInHz) {
    // round(nanos * rate_hz / 1e9)
    let durationNanoseconds = durationMilliseconds * 1e6;
    let ticks = (durationNanoseconds * rateInHz + 500000000) / 1000000000;
    return Math.round(ticks);
  }
}
function coerceToDataView(input) {
  if (input instanceof DataView) {
    return input;
  } else if (input instanceof ArrayBuffer) {
    return new DataView(input);
  } else if (input instanceof Uint8Array) {
    return new DataView(input.buffer, input.byteOffset, input.byteLength);
  } else {
    throw new Error("Error coercing ".concat(input, " to DataView - input was not DataView, ArrayBuffer, or Uint8Array."));
  }
}export{DataTrackClock,DataTrackTimestamp,U16_MAX_SIZE,U32_MAX_SIZE,WrapAroundUnsignedInt,coerceToDataView};//# sourceMappingURL=utils.mjs.map
