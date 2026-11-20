import {slicedToArray as _slicedToArray}from'../../_virtual/_rollupPluginBabelHelpers.mjs';import livekitLogger from'../../logger.mjs';import {getBrowser}from'../../utils/browserParser.mjs';import'../errors.mjs';import'tslib';import'@livekit/protocol';import'../events.mjs';import {isSVCSimulcast,isSVCCodec,usesLegacySVCEncodings,isSafariSvcApi,isReactNative,getReactNativeOs}from'../utils.mjs';import'@livekit/mutex';import'../DeviceManager.mjs';import'../timers.mjs';import {Track}from'../track/Track.mjs';import {VideoPreset,VideoPresets,VideoPresets43,ScreenSharePresets}from'../track/options.mjs';/* @internal */
const presets169 = /* @__PURE__ */Object.values(VideoPresets);
/* @internal */
const presets43 = /* @__PURE__ */Object.values(VideoPresets43);
/* @internal */
const presetsScreenShare = /* @__PURE__ */Object.values(ScreenSharePresets);
/* @internal */
const defaultSimulcastPresets169 = [VideoPresets.h180, VideoPresets.h360];
/* @internal */
const defaultSimulcastPresets43 = [VideoPresets43.h180, VideoPresets43.h360];
/* @internal */
const computeDefaultScreenShareSimulcastPresets = fromPreset => {
  const layers = [{
    scaleResolutionDownBy: 2,
    fps: fromPreset.encoding.maxFramerate
  }];
  return layers.map(t => {
    var _a, _b;
    return new VideoPreset(Math.floor(fromPreset.width / t.scaleResolutionDownBy), Math.floor(fromPreset.height / t.scaleResolutionDownBy), Math.max(150000, Math.floor(fromPreset.encoding.maxBitrate / (Math.pow(t.scaleResolutionDownBy, 2) * (((_a = fromPreset.encoding.maxFramerate) !== null && _a !== void 0 ? _a : 30) / ((_b = t.fps) !== null && _b !== void 0 ? _b : 30))))), t.fps, fromPreset.encoding.priority);
  });
};
const videoRids = ['q', 'h', 'f'];
/* @internal */
function computeVideoEncodings(isScreenShare, width, height, options) {
  var _a, _b;
  let videoEncoding = options === null || options === void 0 ? void 0 : options.videoEncoding;
  if (isScreenShare) {
    videoEncoding = options === null || options === void 0 ? void 0 : options.screenShareEncoding;
  }
  const useSimulcast = options === null || options === void 0 ? void 0 : options.simulcast;
  const scalabilityMode = options === null || options === void 0 ? void 0 : options.scalabilityMode;
  const videoCodec = options === null || options === void 0 ? void 0 : options.videoCodec;
  // VP9/AV1 published as rid based simulcast rather than SVC, see isSVCSimulcast
  const useSVCSimulcast = isSVCSimulcast(videoCodec, options);
  if (!videoEncoding && !useSimulcast && !scalabilityMode || !width || !height) {
    // when we aren't simulcasting or svc, will need to return a single encoding without
    // capping bandwidth. we always require a encoding for dynacast
    return [{}];
  }
  if (!videoEncoding) {
    // find the right encoding based on width/height
    videoEncoding = determineAppropriateEncoding(isScreenShare, width, height, videoCodec);
    livekitLogger.debug('using video encoding', videoEncoding);
  }
  const sourceFramerate = videoEncoding.maxFramerate;
  const original = new VideoPreset(width, height, videoEncoding.maxBitrate, videoEncoding.maxFramerate, videoEncoding.priority);
  if (scalabilityMode && isSVCCodec(videoCodec) && !useSVCSimulcast) {
    const sm = new ScalabilityMode(scalabilityMode);
    const encodings = [];
    if (sm.spatial > 3) {
      throw new Error("unsupported scalabilityMode: ".concat(scalabilityMode));
    }
    // Browsers that read multiple encodings on an SVC codec as SVC rather than as
    // simulcast, see usesLegacySVCEncodings
    const browser = getBrowser();
    if (usesLegacySVCEncodings()) {
      const bitratesRatio = sm.suffix == 'h' ? 2 : 3;
      // safari 18.4 uses a different svc API that requires scaleResolutionDownBy to be set.
      const requireScale = isSafariSvcApi(browser);
      for (let i = 0; i < sm.spatial; i += 1) {
        // in legacy SVC, scaleResolutionDownBy cannot be set
        encodings.push({
          rid: videoRids[2 - i],
          maxBitrate: videoEncoding.maxBitrate / Math.pow(bitratesRatio, i),
          maxFramerate: original.encoding.maxFramerate,
          scaleResolutionDownBy: requireScale ? Math.pow(2, i) : undefined
        });
      }
      // legacy SVC, scalabilityMode is set only on the first encoding
      /* @ts-ignore */
      encodings[0].scalabilityMode = scalabilityMode;
    } else {
      encodings.push({
        maxBitrate: videoEncoding.maxBitrate,
        maxFramerate: original.encoding.maxFramerate,
        /* @ts-ignore */
        scalabilityMode: scalabilityMode
      });
    }
    if (original.encoding.priority) {
      encodings[0].priority = original.encoding.priority;
      encodings[0].networkPriority = original.encoding.priority;
    }
    livekitLogger.debug("using svc encoding", {
      encodings
    });
    return encodings;
  }
  if (!useSimulcast) {
    return [videoEncoding];
  }
  // Chrome M113+ only treats multiple encodings on an SVC capable codec as real
  // simulcast when every encoding carries an explicit scalabilityMode next to its
  // scaleResolutionDownBy. Without it the encodings are interpreted as legacy SVC.
  const applySVCSimulcastMode = encodings => {
    if (useSVCSimulcast) {
      encodings.forEach(encoding => {
        /* @ts-ignore */
        encoding.scalabilityMode = scalabilityMode;
      });
    }
    return encodings;
  };
  let presets;
  if (isScreenShare) {
    presets = (_a = sortPresets(options === null || options === void 0 ? void 0 : options.screenShareSimulcastLayers)) !== null && _a !== void 0 ? _a : defaultSimulcastLayers(isScreenShare, original);
  } else {
    presets = (_b = sortPresets(options === null || options === void 0 ? void 0 : options.videoSimulcastLayers)) !== null && _b !== void 0 ? _b : defaultSimulcastLayers(isScreenShare, original);
  }
  let midPreset;
  if (presets.length > 0) {
    const lowPreset = presets[0];
    if (presets.length > 1) {
      var _presets = presets;
      var _presets2 = _slicedToArray(_presets, 2);
      midPreset = _presets2[1];
    }
    // NOTE:
    //   1. Ordering of these encodings is important. Chrome seems
    //      to use the index into encodings to decide which layer
    //      to disable when CPU constrained.
    //      So encodings should be ordered in increasing spatial
    //      resolution order.
    //   2. livekit-server translates rids into layers. So, all encodings
    //      should have the base layer `q` and then more added
    //      based on other conditions.
    const size = Math.max(width, height);
    if (size >= 960 && midPreset) {
      return applySVCSimulcastMode(encodingsFromPresets(width, height, [lowPreset, midPreset, original], sourceFramerate));
    }
    if (size >= 480) {
      return applySVCSimulcastMode(encodingsFromPresets(width, height, [lowPreset, original], sourceFramerate));
    }
  }
  return applySVCSimulcastMode(encodingsFromPresets(width, height, [original]));
}
/**
 * Bitrate to hint to the bandwidth estimator through `x-google-start-bitrate`, so that
 * a publish does not spend its first seconds ramping up from a very low rate.
 *
 * It has to be the total the encoder will put on the wire, which means picking the
 * encoding that carries the inclusive bitrate:
 *  - SVC publishes a single stream with the layers built in. `encodings[0]` holds the
 *    full bitrate — the legacy SVC shape orders its encodings `f`..`q`, so that holds
 *    for both SVC shapes.
 *  - Simulcast publishes independent streams ordered `q`..`f`, so the total is the sum.
 *    This includes VP9/AV1 published as rid based simulcast, where `encodings[0]` is
 *    the *smallest* layer even though the codec is SVC capable.
 *
 * @internal
 */
function computeStartTargetBitrate(codec, options, encodings) {
  var _a, _b;
  if (isSVCCodec(codec) && !isSVCSimulcast(codec, options)) {
    return (_b = (_a = encodings[0]) === null || _a === void 0 ? void 0 : _a.maxBitrate) !== null && _b !== void 0 ? _b : 0;
  }
  return encodings.reduce((sum, enc) => {
    var _a;
    return sum + ((_a = enc.maxBitrate) !== null && _a !== void 0 ? _a : 0);
  }, 0);
}
function computeTrackBackupEncodings(track, videoCodec, opts) {
  var _a, _b, _c, _d;
  // backupCodec should not be true anymore, default codec is set in LocalParticipant.publish
  if (!opts.backupCodec || opts.backupCodec === true || opts.backupCodec.codec === opts.videoCodec) {
    // backup codec publishing is disabled
    return;
  }
  if (videoCodec !== opts.backupCodec.codec) {
    livekitLogger.warn('requested a different codec than specified as backup', {
      serverRequested: videoCodec,
      backup: opts.backupCodec.codec
    });
  }
  opts.videoCodec = videoCodec;
  // use backup encoding setting as videoEncoding for backup codec publishing
  opts.videoEncoding = opts.backupCodec.encoding;
  const settings = track.mediaStreamTrack.getSettings();
  const width = (_a = settings.width) !== null && _a !== void 0 ? _a : (_b = track.dimensions) === null || _b === void 0 ? void 0 : _b.width;
  const height = (_c = settings.height) !== null && _c !== void 0 ? _c : (_d = track.dimensions) === null || _d === void 0 ? void 0 : _d.height;
  // disable simulcast for screenshare backup codec since L1Tx is used by primary codec
  if (track.source === Track.Source.ScreenShare && opts.simulcast) {
    opts.simulcast = false;
  }
  const encodings = computeVideoEncodings(track.source === Track.Source.ScreenShare, width, height, opts);
  return encodings;
}
/* @internal */
function determineAppropriateEncoding(isScreenShare, width, height, codec) {
  const presets = presetsForResolution(isScreenShare, width, height);
  let encoding = presets[0].encoding;
  // handle portrait by swapping dimensions
  const size = Math.max(width, height);
  for (let i = 0; i < presets.length; i += 1) {
    const preset = presets[i];
    encoding = preset.encoding;
    if (preset.width >= size) {
      break;
    }
  }
  // presets are based on the assumption of vp8 as a codec
  // for other codecs we adjust the maxBitrate if no specific videoEncoding has been provided
  // users should override these with ones that are optimized for their use case
  // NOTE: SVC codec bitrates are inclusive of all scalability layers. while
  // bitrate for non-SVC codecs does not include other simulcast layers.
  if (codec) {
    switch (codec) {
      case 'av1':
      case 'h265':
        encoding = Object.assign({}, encoding);
        encoding.maxBitrate = encoding.maxBitrate * 0.7;
        break;
      case 'vp9':
        encoding = Object.assign({}, encoding);
        encoding.maxBitrate = encoding.maxBitrate * 0.85;
        break;
    }
  }
  return encoding;
}
/* @internal */
function presetsForResolution(isScreenShare, width, height) {
  if (isScreenShare) {
    return presetsScreenShare;
  }
  const aspect = width > height ? width / height : height / width;
  if (Math.abs(aspect - 16.0 / 9) < Math.abs(aspect - 4.0 / 3)) {
    return presets169;
  }
  return presets43;
}
/* @internal */
function defaultSimulcastLayers(isScreenShare, original) {
  if (isScreenShare) {
    return computeDefaultScreenShareSimulcastPresets(original);
  }
  const width = original.width,
    height = original.height;
  const aspect = width > height ? width / height : height / width;
  if (Math.abs(aspect - 16.0 / 9) < Math.abs(aspect - 4.0 / 3)) {
    return defaultSimulcastPresets169;
  }
  return defaultSimulcastPresets43;
}
// presets should be ordered by low, medium, high
function encodingsFromPresets(width, height, presets, sourceFramerate) {
  const encodings = [];
  presets.forEach((preset, idx) => {
    if (idx >= videoRids.length) {
      return;
    }
    const size = Math.min(width, height);
    const rid = videoRids[idx];
    const encoding = {
      rid,
      scaleResolutionDownBy: Math.max(1, size / Math.min(preset.width, preset.height)),
      maxBitrate: preset.encoding.maxBitrate
    };
    // ensure that the sourceFramerate is the highest framerate applied across all layers so that the
    // original encoding doesn't get bumped unintentionally by any of the other layers
    const maxFramerate = sourceFramerate && preset.encoding.maxFramerate ? Math.min(sourceFramerate, preset.encoding.maxFramerate) : preset.encoding.maxFramerate;
    if (maxFramerate) {
      encoding.maxFramerate = maxFramerate;
    }
    const browser = getBrowser();
    const canSetPriority = (browser === null || browser === void 0 ? void 0 : browser.name) === 'Firefox' && browser.os !== 'iOS' || idx === 0;
    if (preset.encoding.priority && canSetPriority) {
      encoding.priority = preset.encoding.priority;
      encoding.networkPriority = preset.encoding.priority;
    }
    encodings.push(encoding);
  });
  // RN ios simulcast requires all same framerates.
  if (isReactNative() && getReactNativeOs() === 'ios') {
    let topFramerate = undefined;
    encodings.forEach(encoding => {
      if (!topFramerate) {
        topFramerate = encoding.maxFramerate;
      } else if (encoding.maxFramerate && encoding.maxFramerate > topFramerate) {
        topFramerate = encoding.maxFramerate;
      }
    });
    let notifyOnce = true;
    encodings.forEach(encoding => {
      var _a;
      if (encoding.maxFramerate != topFramerate) {
        if (notifyOnce) {
          notifyOnce = false;
          livekitLogger.info("Simulcast on iOS React-Native requires all encodings to share the same framerate.");
        }
        livekitLogger.info("Setting framerate of encoding \"".concat((_a = encoding.rid) !== null && _a !== void 0 ? _a : '', "\" to ").concat(topFramerate));
        encoding.maxFramerate = topFramerate;
      }
    });
  }
  return encodings;
}
/** @internal */
function sortPresets(presets) {
  if (!presets) return;
  // Sort a copy so we don't mutate the caller's array in place. Mutating the
  // passed-in simulcast layers can cause consumers that compare options by value
  // (e.g. components-react's useLiveKitRoom) to detect a spurious change.
  return presets.slice().sort((a, b) => {
    const aEnc = a.encoding;
    const bEnc = b.encoding;
    if (aEnc.maxBitrate > bEnc.maxBitrate) {
      return 1;
    }
    if (aEnc.maxBitrate < bEnc.maxBitrate) return -1;
    if (aEnc.maxBitrate === bEnc.maxBitrate && aEnc.maxFramerate && bEnc.maxFramerate) {
      return aEnc.maxFramerate > bEnc.maxFramerate ? 1 : -1;
    }
    return 0;
  });
}
/** @internal */
class ScalabilityMode {
  constructor(scalabilityMode) {
    const results = scalabilityMode.match(/^L(\d)T(\d)(h|_KEY|_KEY_SHIFT){0,1}$/);
    if (!results) {
      throw new Error('invalid scalability mode');
    }
    this.spatial = parseInt(results[1]);
    this.temporal = parseInt(results[2]);
    if (results.length > 3) {
      switch (results[3]) {
        case 'h':
        case '_KEY':
        case '_KEY_SHIFT':
          this.suffix = results[3];
      }
    }
  }
  toString() {
    var _a;
    return "L".concat(this.spatial, "T").concat(this.temporal).concat((_a = this.suffix) !== null && _a !== void 0 ? _a : '');
  }
}
/**
 * Returns the appropriate degradation preference for a video track based on its source.
 *
 * - Camera: 'maintain-framerate' (smoother video for real-time communication)
 * - Screen share: 'maintain-resolution' (clarity is critical for reading text/UI)
 * - Other/unknown: 'balanced'
 */
function getDefaultDegradationPreference(track) {
  switch (track.source) {
    case Track.Source.Camera:
      return 'maintain-framerate';
    case Track.Source.ScreenShare:
      return 'maintain-resolution';
    default:
      return 'balanced';
  }
}export{ScalabilityMode,computeDefaultScreenShareSimulcastPresets,computeStartTargetBitrate,computeTrackBackupEncodings,computeVideoEncodings,defaultSimulcastLayers,defaultSimulcastPresets169,defaultSimulcastPresets43,determineAppropriateEncoding,getDefaultDegradationPreference,presets169,presets43,presetsForResolution,presetsScreenShare,sortPresets};//# sourceMappingURL=publishUtils.mjs.map
