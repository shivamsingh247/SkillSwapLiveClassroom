class DataPacketBuffer {
  constructor() {
    this.buffer = [];
    this._totalSize = 0;
    this._sentSize = 0;
  }
  push(item) {
    this.buffer.push(item);
    this._totalSize += item.data.byteLength;
    if (item.sent) {
      this._sentSize += item.data.byteLength;
    }
  }
  pop() {
    const item = this.buffer.shift();
    if (item) {
      this._totalSize -= item.data.byteLength;
      if (item.sent) {
        this._sentSize -= item.data.byteLength;
      }
    }
    return item;
  }
  getAll() {
    return this.buffer.slice();
  }
  /** Every queued packet not yet handed to the channel, in sequence order. */
  getUnsent() {
    return this.buffer.filter(item => !item.sent);
  }
  /** Marks a single queued packet as handed to the channel. */
  markSent(item) {
    if (!item.sent) {
      item.sent = true;
      this._sentSize += item.data.byteLength;
    }
  }
  /**
   * Marks every queued packet as not-yet-sent. Used at the start of a resume replay: whatever is
   * still buffered was sent on the previous channel (or deferred) and must be re-handed to the
   * current one, so none of it counts as sent until the replay actually transmits it.
   */
  markAllUnsent() {
    for (const item of this.buffer) {
      item.sent = false;
    }
    this._sentSize = 0;
  }
  popToSequence(sequence) {
    while (this.buffer.length > 0) {
      const first = this.buffer[0];
      if (first.sequence <= sequence) {
        this.pop();
      } else {
        break;
      }
    }
  }
  alignBufferedAmount(bufferedAmount) {
    while (this.buffer.length > 0) {
      const first = this.buffer[0];
      // Unsent packets aren't part of the channel's bufferedAmount and are still awaiting the
      // resume replay — trimming them would silently lose them.
      if (!first.sent) {
        break;
      }
      if (this._sentSize - first.data.byteLength <= bufferedAmount) {
        break;
      }
      this.pop();
    }
  }
  get length() {
    return this.buffer.length;
  }
}export{DataPacketBuffer};//# sourceMappingURL=dataPacketBuffer.mjs.map
