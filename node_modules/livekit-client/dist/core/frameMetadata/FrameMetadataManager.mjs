import livekitLogger from'../logger.mjs';import {RoomEvent}from'../room/events.mjs';import {FrameMetadataExtractor}from'../room/track/FrameMetadataExtractor.mjs';import RemoteVideoTrack from'../room/track/RemoteVideoTrack.mjs';import {isFrameMetadataSupported,shouldUseFrameMetadataScriptTransform}from'./utils.mjs';/**
 * Manages packet trailer extraction for received video tracks.
 *
 * When a track's TrackInfo indicates packet trailer features, the manager
 * wires up an encoded frame transform to strip the trailer from encoded frames
 * and cache the metadata for lookup.
 *
 * Packet trailer extraction is worker-only. If no worker is configured, the
 * SDK does not advertise packet trailer support and skips extraction.
 *
 * When E2EE is active, the E2EE FrameCryptor worker handles trailer
 * extraction directly (before decryption), so this manager only creates
 * the extractor/metadata cache — no separate pipeline is installed.
 *
 * @experimental
 */
class FrameMetadataManager {
  constructor(options) {
    this.extractors = new Map();
    /**
     * Tracks the trackId associated with each receiver that has had its
     * encoded streams handed off to the worker. Used to detect receiver
     * reuse (transceiver recycling) so we can remap trackIds instead of
     * re-transferring already-consumed streams.
     */
    this.workerPipelines = new Map();
    this.onWorkerMessage = ev => {
      const msg = ev.data;
      if (msg.kind === 'metadata') {
        const extractor = this.extractors.get(msg.data.trackId);
        if (extractor) {
          extractor.storeMetadata(msg.data.rtpTimestamp, msg.data.ssrc, msg.data.metadata);
        }
      }
    };
    this.onWorkerError = ev => {
      livekitLogger.error('frame metadata worker encountered an error:', {
        error: ev.error
      });
    };
    this.worker = options === null || options === void 0 ? void 0 : options.worker;
  }
  /** @internal */
  setup(room) {
    if (room === this.room) {
      return;
    }
    this.room = room;
    if (this.worker) {
      this.worker.onmessage = this.onWorkerMessage;
      this.worker.onerror = this.onWorkerError;
      this.worker.postMessage({
        kind: 'init'
      });
    }
    room.on(RoomEvent.TrackSubscribed, (track, pub, _participant) => {
      if (track.kind !== 'video') {
        return;
      }
      this.setupReceiver(track, pub.trackInfo);
    }).on(RoomEvent.TrackUnsubscribed, track => {
      this.teardownTrack(track);
    }).on(RoomEvent.Disconnected, () => {
      this.cleanup();
    });
  }
  setupReceiver(track, trackInfo) {
    var _a, _b, _c;
    const receiver = track.receiver;
    if (!receiver) {
      return;
    }
    // Only install a pipeline for tracks that actually advertise packet
    // trailer features. This keeps us out of the way for tracks published by
    // clients on older protocols or that don't opt into the feature.
    const hasFeatures = !!(trackInfo === null || trackInfo === void 0 ? void 0 : trackInfo.packetTrailerFeatures) && trackInfo.packetTrailerFeatures.length > 0;
    if (!hasFeatures) {
      if (!((_a = this.room) === null || _a === void 0 ? void 0 : _a.hasE2EESetup)) {
        this.setupPassthroughReceiver(receiver, track.mediaStreamID);
      }
      return;
    }
    if (!isFrameMetadataSupported(this.worker ? {
      worker: this.worker
    } : undefined) && !((_b = this.room) === null || _b === void 0 ? void 0 : _b.hasE2EESetup)) {
      livekitLogger.warn('frame metadata transform not supported; skipping extraction');
      return;
    }
    const extractor = new FrameMetadataExtractor();
    const trackId = track.mediaStreamID;
    this.extractors.set(trackId, extractor);
    track.frameMetadataExtractor = extractor;
    if ((_c = this.room) === null || _c === void 0 ? void 0 : _c.hasE2EESetup) {
      // E2EE worker strips the trailer and injects metadata directly into
      // the extractor via E2eeManager; no pipeline is needed here.
      return;
    }
    this.setupWorkerReceiver(receiver, trackId, true);
  }
  setupPassthroughReceiver(receiver, trackId) {
    if (shouldUseFrameMetadataScriptTransform()) {
      if ('transform' in receiver) {
        // @ts-ignore
        receiver.transform = null;
      }
      return;
    }
    if (this.worker && isFrameMetadataSupported({
      worker: this.worker
    }) && !this.workerPipelines.has(receiver)) {
      this.setupWorkerReceiver(receiver, trackId, false);
      return;
    }
    if (this.worker && this.workerPipelines.has(receiver)) {
      this.setupWorkerReceiver(receiver, trackId, false);
    }
  }
  setupWorkerReceiver(receiver, newTrackId) {
    let hasPacketTrailer = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    const worker = this.worker;
    if (!worker) {
      return;
    }
    if (shouldUseFrameMetadataScriptTransform()) {
      // @ts-ignore
      receiver.transform = new RTCRtpScriptTransform(worker, {
        kind: 'decode',
        trackId: newTrackId
      });
      return;
    }
    const existingTrackId = this.workerPipelines.get(receiver);
    if (existingTrackId) {
      // Receiver is reused (transceiver recycled). The worker already owns
      // the encoded streams — just remap the trackId so metadata is keyed
      // correctly and re-activate processing.
      const msg = {
        kind: 'updateTrackId',
        data: {
          oldTrackId: existingTrackId,
          newTrackId,
          hasPacketTrailer
        }
      };
      worker.postMessage(msg);
      this.workerPipelines.set(receiver, newTrackId);
      return;
    }
    if (!('createEncodedStreams' in receiver)) {
      livekitLogger.warn('createEncodedStreams not supported');
      return;
    }
    let streams;
    try {
      // @ts-ignore — createEncodedStreams is not in standard typings
      streams = receiver.createEncodedStreams();
    } catch (err) {
      livekitLogger.warn('failed to create encoded streams', {
        error: err
      });
      return;
    }
    const msg = {
      kind: 'decode',
      data: {
        readableStream: streams.readable,
        writableStream: streams.writable,
        trackId: newTrackId,
        hasPacketTrailer
      }
    };
    worker.postMessage(msg, [streams.readable, streams.writable]);
    this.workerPipelines.set(receiver, newTrackId);
  }
  teardownTrack(track) {
    const trackId = track.mediaStreamID;
    const extractor = this.extractors.get(trackId);
    if (extractor) {
      extractor.dispose();
      this.extractors.delete(trackId);
    }
    if (track instanceof RemoteVideoTrack) {
      track.frameMetadataExtractor = undefined;
    }
    // The receiver pipeline is intentionally left running. If the receiver is
    // reused for a new track, `setupReceiver` will remap it. If the room
    // disconnects, `cleanup` drops all state. Any metadata produced in the
    // meantime is harmless — the extractor above has already been disposed and
    // is no longer reachable from any track.
  }
  /** Drops the per-connection state. The worker stays, because the room can connect again. */
  cleanup() {
    for (const extractor of this.extractors.values()) {
      extractor.dispose();
    }
    this.extractors.clear();
    this.workerPipelines.clear();
  }
  /** Terminates the worker. Called from `Room.dispose()`; the room cannot connect afterwards. */
  dispose() {
    var _a;
    this.cleanup();
    (_a = this.worker) === null || _a === void 0 ? void 0 : _a.terminate();
  }
}export{FrameMetadataManager};//# sourceMappingURL=FrameMetadataManager.mjs.map
