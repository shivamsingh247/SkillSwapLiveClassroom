import {__awaiter}from'tslib';import livekitLogger from'../../logger.mjs';import CriticalTimers from'../timers.mjs';import {FlowControlledDataChannel}from'./FlowControlledDataChannel.mjs';/**
 * A lossy channel: flow control plus a per-instance full-buffer policy.
 *
 * Each instance owns its own byterate stat, drop counter, and (when tuning is started) the
 * dynamic `bufferedAmountLowThreshold` adjustment that keeps the drop gate at roughly 100ms of
 * buffered latency. Keeping these per instance is what prevents one channel's traffic from
 * steering another channel's policy.
 */
class LossyDataChannel extends FlowControlledDataChannel {
  constructor(opts) {
    super(opts);
    this.statCurrentBytes = 0;
    this.statByterate = 0;
    this.dropCount = 0;
    this.bufferFullBehavior = opts.bufferFullBehavior;
    this.shouldSkipSends = opts.shouldSkipSends;
  }
  /** Sends prepared bytes with this channel's full-buffer policy (drop or wait). */
  send(msg) {
    return __awaiter(this, void 0, void 0, function* () {
      const dc = this.getChannel();
      if (!dc) {
        return;
      }
      // Depending on the channel's policy, either drop or wait for the buffer to drain below the
      // high-water mark before continuing.
      switch (this.bufferFullBehavior) {
        case 'wait':
          if (!this.isBelowHighWaterMark(dc)) {
            try {
              yield this.waitForHeadroomWithLock(dc);
            } catch (error) {
              if (this.isEngineClosed()) {
                throw error;
              }
              // The channel closed or was replaced while this send waited. The replacement may
              // still be connecting, so drop the packet, as sends during a reconnect are.
              return;
            }
          }
          break;
        case 'drop':
          // We check against the actual threshold on the DC here, as it is tuned dynamically.
          if (!this.isBelowLowWaterMark(dc)) {
            // Drop messages to reduce latency
            this.dropCount += 1;
            if (this.dropCount % 100 === 0) {
              livekitLogger.warn("dropping lossy data channel messages, total dropped: ".concat(this.dropCount));
            }
            return;
          }
      }
      this.statCurrentBytes += msg.byteLength;
      if (this.shouldSkipSends()) {
        return;
      }
      try {
        dc.send(msg);
        this.refreshBufferStatus();
      } catch (error) {
        // Preserve prior surface behaviour: a send that fails because the channel is closing is
        // logged, not thrown, so lossy/data-track sends don't reject during teardown windows.
        if (error instanceof TypeError) {
          livekitLogger.error(error);
        } else {
          throw error;
        }
      }
    });
  }
  /**
   * Starts the once-per-second adjustment of the channel's `bufferedAmountLowThreshold` to the
   * observed byterate, keeping the drop gate at roughly 100ms of buffered latency (clamped to
   * the watermarks). Restarts cleanly if already running.
   */
  startThresholdTuning() {
    this.stopThresholdTuning();
    this.statInterval = CriticalTimers.setInterval(() => {
      this.statByterate = this.statCurrentBytes;
      this.statCurrentBytes = 0;
      const dc = this.getChannel();
      if (dc) {
        // control buffered latency to ~100ms
        const threshold = this.statByterate / 10;
        dc.bufferedAmountLowThreshold = Math.min(Math.max(threshold, this.lowWaterMark), this.highWaterMark);
      }
    }, 1000);
  }
  /** Stops the threshold tuning and resets the stats and drop counter. */
  stopThresholdTuning() {
    this.statByterate = 0;
    this.statCurrentBytes = 0;
    if (this.statInterval) {
      CriticalTimers.clearInterval(this.statInterval);
      this.statInterval = undefined;
    }
    this.dropCount = 0;
  }
}export{LossyDataChannel};//# sourceMappingURL=LossyDataChannel.mjs.map
