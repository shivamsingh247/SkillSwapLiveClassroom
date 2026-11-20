import {slicedToArray as _slicedToArray}from'../../_virtual/_rollupPluginBabelHelpers.mjs';import livekitLogger from'../../logger.mjs';import {isLocalTrack}from'../utils.mjs';import'tslib';import'@livekit/mutex';import'../DeviceManager.mjs';import'../timers.mjs';import'../errors.mjs';import'../events.mjs';import'./Track.mjs';import'@livekit/protocol';import'./options.mjs';/**
 * Try to analyze the local track to determine the facing mode of a track.
 *
 * @remarks
 * There is no property supported by all browsers to detect whether a video track originated from a user- or environment-facing camera device.
 * For this reason, we use the `facingMode` property when available, but will fall back on a string-based analysis of the device label to determine the facing mode.
 * If both methods fail, the default facing mode will be used.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/facingMode | MDN docs on facingMode}
 * @experimental
 */
function facingModeFromLocalTrack(localTrack) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var _a;
  const track = isLocalTrack(localTrack) ? localTrack.mediaStreamTrack : localTrack;
  const trackSettings = track.getSettings();
  let result = {
    facingMode: (_a = options.defaultFacingMode) !== null && _a !== void 0 ? _a : 'user',
    confidence: 'low'
  };
  // 1. Try to get facingMode from track settings.
  if ('facingMode' in trackSettings) {
    const rawFacingMode = trackSettings.facingMode;
    livekitLogger.trace('rawFacingMode', {
      rawFacingMode
    });
    if (rawFacingMode && typeof rawFacingMode === 'string' && isFacingModeValue(rawFacingMode)) {
      result = {
        facingMode: rawFacingMode,
        confidence: 'high'
      };
    }
  }
  // 2. If we don't have a high confidence we try to get the facing mode from the device label.
  if (['low', 'medium'].includes(result.confidence)) {
    livekitLogger.trace("Try to get facing mode from device label: (".concat(track.label, ")"));
    const labelAnalysisResult = facingModeFromDeviceLabel(track.label);
    if (labelAnalysisResult !== undefined) {
      result = labelAnalysisResult;
    }
  }
  return result;
}
const knownDeviceLabels = /* @__PURE__ */new Map([['obs virtual camera', {
  facingMode: 'environment',
  confidence: 'medium'
}]]);
const knownDeviceLabelSections = /* @__PURE__ */new Map([['iphone', {
  facingMode: 'environment',
  confidence: 'medium'
}], ['ipad', {
  facingMode: 'environment',
  confidence: 'medium'
}]]);
/**
 * Attempt to analyze the device label to determine the facing mode.
 *
 * @experimental
 */
function facingModeFromDeviceLabel(deviceLabel) {
  var _a;
  const label = deviceLabel.trim().toLowerCase();
  // Empty string is a valid device label but we can't infer anything from it.
  if (label === '') {
    return undefined;
  }
  // Can we match against widely known device labels.
  if (knownDeviceLabels.has(label)) {
    return knownDeviceLabels.get(label);
  }
  // Can we match against sections of the device label.
  return (_a = Array.from(knownDeviceLabelSections.entries()).find(_ref => {
    let _ref2 = _slicedToArray(_ref, 1),
      section = _ref2[0];
    return label.includes(section);
  })) === null || _a === void 0 ? void 0 : _a[1];
}
function isFacingModeValue(item) {
  const allowedValues = ['user', 'environment', 'left', 'right'];
  return item === undefined || allowedValues.includes(item);
}export{facingModeFromDeviceLabel,facingModeFromLocalTrack};//# sourceMappingURL=facingMode.mjs.map
