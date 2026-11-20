import {NegotiatedDataChannelID}from'@livekit/protocol';import'tslib';import'@livekit/mutex';import'../../utils/TypedPromise.mjs';import'../errors.mjs';import {LossyDataChannel}from'./LossyDataChannel.mjs';import {ReliableDataChannel}from'./ReliableDataChannel.mjs';import {DataChannelKind,dataChannelHighWaterMark,dataChannelLowWaterMark}from'./types.mjs';const lossyDataChannelLabel = '_lossy';
const reliableDataChannelLabel = '_reliable';
const dataTrackDataChannelLabel = '_data_track';
/** Unhooks every handler the manager may have wired onto `dc`, ahead of closing it. */
function clearHandlers(dc) {
  dc.onbufferedamountlow = null;
  dc.onclose = null;
  dc.onclosing = null;
  dc.onerror = null;
  dc.onmessage = null;
  dc.onopen = null;
}
/**
 * Owns the engine's data channels: the three flow-controlled publisher channel wrappers (which
 * live for the engine's lifetime and have RTCDataChannel handles attached/detached as peer
 * connections come and go) plus the subscriber-side receive handles adopted by label.
 *
 * Handle turnover goes through {@link FlowControlledDataChannel.attach}/`detach`, which close the
 * released handle and reject parked headroom waiters as a built-in — there is no separate
 * invalidation step to forget.
 */
class DataChannelManager {
  constructor(opts) {
    this.negotiated = false;
    this.opts = opts;
    const flowControlOptions = kind => ({
      kind,
      lowWaterMark: dataChannelLowWaterMark(kind),
      highWaterMark: dataChannelHighWaterMark(kind),
      isEngineClosed: opts.isEngineClosed,
      onBufferStatusChanged: isLow => opts.onBufferStatusChanged(kind, isLow)
    });
    this.reliable = new ReliableDataChannel(Object.assign(Object.assign({}, flowControlOptions(DataChannelKind.RELIABLE)), {
      isDeferringSends: opts.isReconnecting
    }));
    this.lossy = new LossyDataChannel(Object.assign(Object.assign({}, flowControlOptions(DataChannelKind.LOSSY)), {
      // Classic lossy user data: a stale packet is worthless, so drop instead of queueing.
      bufferFullBehavior: 'drop',
      shouldSkipSends: opts.isReconnecting
    }));
    this.dataTrack = new LossyDataChannel(Object.assign(Object.assign({}, flowControlOptions(DataChannelKind.DATA_TRACK_LOSSY)), {
      // Data tracks backpressure the producer instead — it decides what to skip at frame
      // granularity rather than the engine dropping arbitrary chunks out of frames.
      bufferFullBehavior: 'wait',
      shouldSkipSends: opts.isReconnecting
    }));
  }
  /** The flow-control wrapper for `kind`. */
  channelFor(kind) {
    switch (kind) {
      case DataChannelKind.RELIABLE:
        return this.reliable;
      case DataChannelKind.LOSSY:
        return this.lossy;
      case DataChannelKind.DATA_TRACK_LOSSY:
        return this.dataTrack;
    }
  }
  /** The raw RTCDataChannel handle for `kind`, publisher side by default. */
  getHandle(kind) {
    let subscriber = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    if (!subscriber) {
      return this.channelFor(kind).channelHandle;
    }
    switch (kind) {
      case DataChannelKind.RELIABLE:
        return this.reliableSub;
      case DataChannelKind.LOSSY:
        return this.lossySub;
      case DataChannelKind.DATA_TRACK_LOSSY:
        return this.dataTrackSub;
    }
  }
  get hasPublisherChannels() {
    return Boolean(this.reliable.channelHandle || this.lossy.channelHandle || this.dataTrack.channelHandle);
  }
  /** Whether the current publisher channels were created as negotiated (fixed IDs). */
  get publisherChannelsNegotiated() {
    return this.hasPublisherChannels && this.negotiated;
  }
  /**
   * Creates the three publisher data channels on the given transport, wires their handlers, and
   * attaches them to the wrappers — attaching closes any replaced channel objects and rejects the
   * waiters still parked on them.
   *
   * With `negotiated`, the channels use fixed SCTP stream IDs agreed with the server instead of
   * the in-band DCEP open handshake, so the server can send on them right away.
   */
  createPublisherChannels(pcManager) {
    let negotiated = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    // Recreating (the Safari null-id path, or the in-band fallback after join): attaching the new
    // handles below closes the old ones, so unhook them first — the old channel's close must not
    // report an unexpected close.
    for (const channel of [this.lossy, this.reliable, this.dataTrack]) {
      const old = channel.channelHandle;
      if (old) {
        clearHandlers(old);
      }
    }
    const wire = (channel, dc, onMessage) => {
      // also handle messages over the pub channel, for backwards compatibility
      dc.onmessage = onMessage;
      // handle datachannel errors
      dc.onerror = this.opts.onDataError;
      // detect unexpected publisher data channel closes
      dc.onclose = () => this.opts.onChannelClose(channel.kind);
      // set up dc buffer threshold - if this is not set, it will default to 0
      dc.bufferedAmountLowThreshold = channel.lowWaterMark;
      // handle buffer amount low events
      dc.onbufferedamountlow = () => channel.refreshBufferStatus();
      channel.attach(dc);
    };
    const idFor = id => negotiated ? {
      negotiated,
      id
    } : {};
    wire(this.lossy, pcManager.createPublisherDataChannel(lossyDataChannelLabel, Object.assign({
      ordered: false,
      maxRetransmits: 0
    }, idFor(NegotiatedDataChannelID.NDCI_LOSSY))), this.opts.onDataMessage);
    wire(this.reliable, pcManager.createPublisherDataChannel(reliableDataChannelLabel, Object.assign({
      ordered: true
    }, idFor(NegotiatedDataChannelID.NDCI_RELIABLE))), this.opts.onDataMessage);
    wire(this.dataTrack, pcManager.createPublisherDataChannel(dataTrackDataChannelLabel, Object.assign({
      ordered: false,
      maxRetransmits: 0
    }, idFor(NegotiatedDataChannelID.NDCI_DATA_TRACK))), this.opts.onDataTrackMessage);
    this.negotiated = negotiated;
    this.lossy.startThresholdTuning();
  }
  /**
   * Adopts a subscriber-side data channel by label, wiring the matching receive handler.
   * Returns false for labels this manager doesn't own.
   */
  adoptSubscriberChannel(channel) {
    let handler;
    if (channel.label === reliableDataChannelLabel) {
      this.reliableSub = channel;
      handler = this.opts.onDataMessage;
    } else if (channel.label === lossyDataChannelLabel) {
      this.lossySub = channel;
      handler = this.opts.onDataMessage;
    } else if (channel.label === dataTrackDataChannelLabel) {
      this.dataTrackSub = channel;
      handler = this.opts.onDataTrackMessage;
    } else {
      return false;
    }
    channel.onmessage = handler;
    return true;
  }
  /**
   * Tears down all channels for a peer-connection cleanup: strips handlers, closes the handles,
   * and resets the reliable session state. Detaching the publisher handles closes them and
   * rejects parked waiters (the spec allows `pc.close()` to transition channels to 'closed'
   * without firing events, so waiting for browser close events is not an option).
   */
  teardown() {
    // Detach the data channel handlers before closing anything. Closing a peer connection tears
    // down the SCTP transport, which can dispatch `error`/`close` events on the still-open data
    // channels; if our handlers are still attached at that point, handleDataError logs a spurious
    // "Unknown DataChannel error" during an otherwise graceful disconnect. Removing the handlers
    // before dc.close()/pcManager.close() makes this deterministic regardless of how/when the
    // browser dispatches those teardown events. See livekit/client-sdk-js#1953.
    const publisherDataChannels = [this.lossy, this.reliable, this.dataTrack];
    const subscriberDataChannels = [this.lossySub, this.reliableSub, this.dataTrackSub];
    // Publisher handles are closed by detach, which also rejects parked waiters.
    for (const channel of publisherDataChannels) {
      const dc = channel.channelHandle;
      if (dc) {
        clearHandlers(dc);
      }
      channel.detach('peer connections cleaned up');
    }
    // Subscriber handles have no wrapper, so close them directly.
    for (const dc of subscriberDataChannels) {
      if (dc) {
        clearHandlers(dc);
        dc.close();
      }
    }
    this.lossySub = undefined;
    this.reliableSub = undefined;
    this.dataTrackSub = undefined;
    // Full teardown starts the session over: drop replay state and restart sequencing.
    this.reliable.reset();
  }
}export{DataChannelManager};//# sourceMappingURL=DataChannelManager.mjs.map
