import {slicedToArray as _slicedToArray}from'../_virtual/_rollupPluginBabelHelpers.mjs';function compact(summary) {
  const compacted = {};
  for (const _ref of Object.entries(summary)) {
    var _ref2 = _slicedToArray(_ref, 2);
    const key = _ref2[0];
    const value = _ref2[1];
    if (value !== undefined) {
      compacted[key] = value;
    }
  }
  return compacted;
}
function resolution(width, height) {
  return width && height ? "".concat(width, "x").concat(height) : undefined;
}
/** keeps the derived durations readable; reported values are logged as they are */
function round(seconds) {
  return Math.round(seconds * 10000) / 10000;
}
/**
 * Average time media spent in the jitter buffer, in s. Both counters are
 * cumulative, so this is the average over the lifetime of the stream.
 */
function jitterBuffer(stat) {
  const delay = stat.jitterBufferDelay;
  const emitted = stat.jitterBufferEmittedCount;
  return delay !== undefined && emitted ? round(delay / emitted) : undefined;
}
/**
 * Playout delay in s. Video receive reports it directly, the audio path keeps it
 * in the linked `media-playout` stats summed over the samples played out. Pairs
 * with `RemoteTrack.setPlayoutDelay`.
 */
function playoutDelay(stat, playout) {
  if (stat.playoutDelay !== undefined) {
    return round(stat.playoutDelay);
  }
  const total = playout === null || playout === void 0 ? void 0 : playout.totalPlayoutDelay;
  const samples = playout === null || playout === void 0 ? void 0 : playout.totalSamplesCount;
  return total !== undefined && samples ? round(total / samples) : undefined;
}
/**
 * Picks the interesting fields out of a `getStats()` report and groups them by
 * RTP stream, so a stats dump can be read without unfolding the raw report.
 */
function summarizeStatsReport(report) {
  var _a, _b;
  const byId = new Map();
  const candidatePairs = [];
  const inbound = [];
  const outbound = [];
  let transport;
  report.forEach(stat => byId.set(stat.id, stat));
  const codecOf = stat => {
    var _a;
    return stat.codecId ? (_a = byId.get(stat.codecId)) === null || _a === void 0 ? void 0 : _a.mimeType : undefined;
  };
  const relatedOf = (stat, key) => stat[key] ? byId.get(stat[key]) : undefined;
  report.forEach(stat => {
    switch (stat.type) {
      case 'inbound-rtp':
        {
          const playout = relatedOf(stat, 'playoutId');
          inbound.push(compact({
            kind: stat.kind,
            ssrc: stat.ssrc,
            mid: stat.mid,
            // matches `streamTrackID` in the track's own log context
            trackId: stat.trackIdentifier,
            codec: codecOf(stat),
            decoder: stat.decoderImplementation,
            resolution: resolution(stat.frameWidth, stat.frameHeight),
            fps: stat.framesPerSecond,
            bytesReceived: stat.bytesReceived,
            packetsReceived: stat.packetsReceived,
            packetsLost: stat.packetsLost,
            packetsDiscarded: stat.packetsDiscarded,
            // frames received without frames decoded is a decode failure
            framesReceived: stat.framesReceived,
            framesDecoded: stat.framesDecoded,
            framesDropped: stat.framesDropped,
            keyFramesDecoded: stat.keyFramesDecoded,
            freezeCount: stat.freezeCount,
            totalFreezesDuration: stat.totalFreezesDuration,
            pauseCount: stat.pauseCount,
            nackCount: stat.nackCount,
            pliCount: stat.pliCount,
            firCount: stat.firCount,
            jitter: stat.jitter,
            jitterBuffer: jitterBuffer(stat),
            playoutDelay: playoutDelay(stat, playout),
            audioLevel: stat.audioLevel,
            totalSamplesReceived: stat.totalSamplesReceived,
            concealedSamples: stat.concealedSamples
          }));
          break;
        }
      case 'outbound-rtp':
        {
          const remote = relatedOf(stat, 'remoteId');
          const source = relatedOf(stat, 'mediaSourceId');
          outbound.push(compact({
            kind: stat.kind,
            ssrc: stat.ssrc,
            mid: stat.mid,
            rid: stat.rid,
            trackId: source === null || source === void 0 ? void 0 : source.trackIdentifier,
            active: stat.active,
            codec: codecOf(stat),
            encoder: stat.encoderImplementation,
            resolution: resolution(stat.frameWidth, stat.frameHeight),
            fps: stat.framesPerSecond,
            // what the source produces, to tell a stalled capture from a stalled encoder
            captureResolution: resolution(source === null || source === void 0 ? void 0 : source.width, source === null || source === void 0 ? void 0 : source.height),
            captureFps: source === null || source === void 0 ? void 0 : source.framesPerSecond,
            audioLevel: source === null || source === void 0 ? void 0 : source.audioLevel,
            targetBitrate: stat.targetBitrate,
            bytesSent: stat.bytesSent,
            packetsSent: stat.packetsSent,
            retransmittedPacketsSent: stat.retransmittedPacketsSent,
            framesEncoded: stat.framesEncoded,
            keyFramesEncoded: stat.keyFramesEncoded,
            limitedBy: stat.qualityLimitationReason === 'none' ? undefined : stat.qualityLimitationReason,
            nackCount: stat.nackCount,
            pliCount: stat.pliCount,
            firCount: stat.firCount,
            // loss, jitter and RTT are only known from what the remote reports
            remotePacketsLost: remote === null || remote === void 0 ? void 0 : remote.packetsLost,
            remoteFractionLost: remote === null || remote === void 0 ? void 0 : remote.fractionLost,
            remoteJitter: remote === null || remote === void 0 ? void 0 : remote.jitter,
            remoteRoundTripTime: remote === null || remote === void 0 ? void 0 : remote.roundTripTime
          }));
          break;
        }
      case 'transport':
        transport = stat;
        break;
      case 'candidate-pair':
        candidatePairs.push(stat);
        break;
    }
  });
  const selectedPairId = transport === null || transport === void 0 ? void 0 : transport.selectedCandidatePairId;
  const pair = (_b = (_a = selectedPairId ? byId.get(selectedPairId) : undefined) !== null && _a !== void 0 ? _a : candidatePairs.find(candidate => candidate.selected)) !== null && _b !== void 0 ? _b : candidatePairs.find(candidate => candidate.nominated);
  const local = (pair === null || pair === void 0 ? void 0 : pair.localCandidateId) ? byId.get(pair.localCandidateId) : undefined;
  const remote = (pair === null || pair === void 0 ? void 0 : pair.remoteCandidateId) ? byId.get(pair.remoteCandidateId) : undefined;
  const connection = compact({
    ice: transport === null || transport === void 0 ? void 0 : transport.iceState,
    dtls: transport === null || transport === void 0 ? void 0 : transport.dtlsState,
    route: local && remote ? "".concat(local.candidateType, "/").concat(local.protocol, " -> ").concat(remote.candidateType) : undefined,
    network: local === null || local === void 0 ? void 0 : local.networkType,
    currentRoundTripTime: pair === null || pair === void 0 ? void 0 : pair.currentRoundTripTime,
    // the send bandwidth estimate; no RTP stream reports it
    availableOutgoingBitrate: pair === null || pair === void 0 ? void 0 : pair.availableOutgoingBitrate,
    availableIncomingBitrate: pair === null || pair === void 0 ? void 0 : pair.availableIncomingBitrate,
    bytesSent: pair === null || pair === void 0 ? void 0 : pair.bytesSent,
    bytesReceived: pair === null || pair === void 0 ? void 0 : pair.bytesReceived,
    candidatePairChanges: transport === null || transport === void 0 ? void 0 : transport.selectedCandidatePairChanges
  });
  return {
    connection: Object.keys(connection).length > 0 ? connection : undefined,
    outbound: outbound.length > 0 ? outbound : undefined,
    inbound: inbound.length > 0 ? inbound : undefined
  };
}export{summarizeStatsReport};//# sourceMappingURL=statsSummary.mjs.map
