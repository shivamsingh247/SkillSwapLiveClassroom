import {SignalResponse}from'@livekit/protocol';import {toHttpUrl,toWebsocketUrl}from'../room/utils.mjs';function createRtcUrl(url, searchParams) {
  let useV0Path = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  const v0Url = createV0RtcUrl(url, searchParams);
  if (useV0Path) {
    return v0Url;
  } else {
    return appendUrlPath(v0Url, 'v1');
  }
}
function createV0RtcUrl(url, searchParams) {
  const urlObj = new URL(toWebsocketUrl(url));
  searchParams.forEach((value, key) => {
    urlObj.searchParams.set(key, value);
  });
  return appendUrlPath(urlObj, 'rtc');
}
function createValidateUrl(rtcWsUrl) {
  const urlObj = new URL(toHttpUrl(rtcWsUrl));
  return appendUrlPath(urlObj, 'validate');
}
function ensureTrailingSlash(path) {
  return path.endsWith('/') ? path : "".concat(path, "/");
}
function appendUrlPath(urlObj, path) {
  urlObj.pathname = "".concat(ensureTrailingSlash(urlObj.pathname)).concat(path);
  return urlObj;
}
function parseSignalResponse(value) {
  if (typeof value === 'string') {
    return SignalResponse.fromJson(JSON.parse(value), {
      ignoreUnknownFields: true
    });
  } else if (value instanceof ArrayBuffer) {
    return SignalResponse.fromBinary(new Uint8Array(value));
  }
  throw new Error("could not decode websocket message: ".concat(typeof value));
}
function getAbortReasonAsString(signal) {
  let defaultMessage = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'Unknown reason';
  // the connect timeout hands this an Error rather than a signal, and its message is the only
  // description of what went wrong — without this a timeout reports itself as a generic abort
  if (signal instanceof Error) {
    return signal.message;
  }
  if (!(signal instanceof AbortSignal)) {
    return defaultMessage;
  }
  const reason = signal.reason;
  switch (typeof reason) {
    case 'string':
      return reason;
    case 'object':
      return reason instanceof Error ? reason.message : defaultMessage;
    default:
      return 'toString' in reason ? reason.toString() : defaultMessage;
  }
}
function getErrorDescription(error, errorCategory) {
  if (error instanceof Error) {
    if (error.name && error.message) {
      return "".concat(error.name, ": ").concat(error.message);
    }
    return error.name;
  }
  return "Encountered unknown ".concat(errorCategory, " error: ").concat(String(error));
}export{createRtcUrl,createV0RtcUrl,createValidateUrl,ensureTrailingSlash,getAbortReasonAsString,getErrorDescription,parseSignalResponse};//# sourceMappingURL=utils.mjs.map
