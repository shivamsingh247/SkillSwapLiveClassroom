import {__awaiter}from'tslib';import {DataPacketBuffer}from'../../utils/dataPacketBuffer.mjs';import {UnexpectedConnectionState}from'../errors.mjs';import {FlowControlledDataChannel}from'./FlowControlledDataChannel.mjs';/**
 * The reliable channel: flow control plus delivery-across-resume semantics.
 *
 * Every packet gets a monotonic sequence (stamped into the protobuf by the caller before
 * serialization, via {@link nextSequence}) and is retained in a replay buffer until the channel's
 * `bufferedAmount` confirms it has been handed to the transport. Sends that land in a reconnect
 * window — or whose headroom wait is torn down transiently — are queued unsent and resolve;
 * {@link replay} delivers them (plus any unacked packets) after a resume. Only an engine close
 * rejects, because no replay is coming after that.
 */
class ReliableDataChannel extends FlowControlledDataChannel {
  constructor(opts) {
    super(opts);
    this.messageBuffer = new DataPacketBuffer();
    this.sequence = 1;
    this.isDeferringSends = opts.isDeferringSends;
  }
  /**
   * Claims the next packet sequence. The caller stamps it into the packet before serialization,
   * then passes it back to {@link send} so the replay buffer stays keyed by wire sequence.
   */
  nextSequence() {
    const sequence = this.sequence;
    this.sequence += 1;
    return sequence;
  }
  /**
   * Sends prepared bytes with reliable semantics. Resolves once the packet has either been handed
   * to the channel or queued for the resume replay; throws only when the engine is closed.
   */
  send(msg, sequence) {
    return __awaiter(this, void 0, void 0, function* () {
      if (this.isDeferringSends()) {
        // A reconnect is already underway — queue for the resume replay instead of parking on a
        // channel that is being torn down. The send resolves; delivery is deferred to the replay.
        this.messageBuffer.push({
          data: msg,
          sequence,
          sent: false
        });
        return;
      }
      const dc = this.getChannel();
      if (!dc) {
        return;
      }
      try {
        yield this.waitForHeadroomWithLock(dc);
      } catch (error) {
        if (this.isEngineClosed()) {
          // No replay is coming after an engine close — surface the failure.
          throw error;
        }
        // Transient teardown (the channel closed or was replaced while we waited): the reliable
        // channel promises delivery across resume, so queue the packet for the replay instead of
        // rejecting a send the app can't meaningfully retry. This also keeps the order: a send
        // queued behind one aborted by a replacement fails the same way (the old handle is closed),
        // so it can't reach the replacement ahead of the lower sequence the replay will deliver.
        this.messageBuffer.push({
          data: msg,
          sequence,
          sent: false
        });
        return;
      }
      if (this.isDeferringSends()) {
        // A reconnect began while we waited for headroom — same deal as above.
        this.messageBuffer.push({
          data: msg,
          sequence,
          sent: false
        });
        return;
      }
      this.messageBuffer.push({
        data: msg,
        sequence,
        sent: true
      });
      dc.send(msg);
      this.refreshBufferStatus();
    });
  }
  /**
   * Replays the buffered backlog after a resume: drops everything the server acked
   * (`lastMessageSeq`), then re-sends the rest in order. The headroom lock is held across the
   * whole replay — releasing it between messages would let a concurrent send (whose newer
   * sequence was already assigned before it queued on the lock) hit the wire mid-replay, and
   * receivers would then discard the remaining lower-sequence resent messages as duplicates.
   */
  replay(lastMessageSeq) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.getChannel()) {
        return;
      }
      this.messageBuffer.popToSequence(lastMessageSeq);
      const unlock = yield this.lockHeadroom();
      try {
        // Resolved only once the lock is held: the handle can be replaced while the replay waits
        // for it.
        const dc = this.getChannel();
        if (!dc) {
          throw new UnexpectedConnectionState("DataChannel not found, kind: ".concat(this.kind));
        }
        // Everything left after the ack cutoff must be re-handed to the current channel.
        this.messageBuffer.markAllUnsent();
        // Drain in passes, re-scanning the live buffer each time: a send that arrives (deferred,
        // sent:false) during our own awaits appends after this pass started, so we pick it up on
        // the next one. Mark each packet only once we've actually handed it to the channel — a
        // blanket "mark all sent" would flip such a late arrival to sent without transmitting it,
        // and a later alignBufferedAmount would then drop it for good. If the loop throws
        // mid-drain, unsent entries keep their flag and the next replay picks them up.
        for (let batch = this.messageBuffer.getUnsent(); batch.length > 0; batch = this.messageBuffer.getUnsent()) {
          for (const item of batch) {
            // Respect flow control on resume too, so a large resend doesn't overflow the buffer.
            // Against the handle resolved under the lock: if it is replaced mid-replay (another
            // resume), it has been closed, so this throws and that resume's replay picks up the
            // entries still flagged unsent.
            yield this.waitForHeadroomWithoutLock(dc);
            dc.send(item.data);
            this.messageBuffer.markSent(item);
          }
        }
      } finally {
        unlock();
      }
      this.refreshBufferStatus();
    });
  }
  /**
   * Before recomputing status, trim packets the transport has now delivered — a send or a drain
   * may have acked buffered packets, and the replay buffer is keyed off the channel's buffered
   * bytes.
   */
  refreshBufferStatus() {
    const dc = this.channelHandle;
    if (dc) {
      this.messageBuffer.alignBufferedAmount(dc.bufferedAmount);
    }
    super.refreshBufferStatus();
  }
  /**
   * Drops all replay state and restarts sequencing. Only valid on a full reconnect, where the
   * session (and the receivers' sequence tracking) starts over.
   */
  reset() {
    this.messageBuffer = new DataPacketBuffer();
    this.sequence = 1;
  }
}export{ReliableDataChannel};//# sourceMappingURL=ReliableDataChannel.mjs.map
