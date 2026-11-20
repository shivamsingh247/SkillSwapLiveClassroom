import {__rest}from'tslib';import {RoomConfiguration}from'@livekit/protocol';import {decodeJwt}from'jose';const ONE_SECOND_IN_MILLISECONDS = 1000;
const ONE_MINUTE_IN_MILLISECONDS = 60 * ONE_SECOND_IN_MILLISECONDS;
function isResponseTokenValid(response) {
  const jwtPayload = decodeTokenPayload(response.participantToken);
  // Missing exp: TokenSourceCached would otherwise return this response forever.
  // nbf is optional (RFC 7519); do not skip the exp check when it is absent.
  if (!(jwtPayload === null || jwtPayload === void 0 ? void 0 : jwtPayload.exp)) {
    return false;
  }
  const now = new Date();
  if (jwtPayload.nbf) {
    const nbfInMilliseconds = jwtPayload.nbf * ONE_SECOND_IN_MILLISECONDS;
    const nbfDate = new Date(nbfInMilliseconds);
    if (nbfDate > now) {
      return false;
    }
  }
  const expInMilliseconds = jwtPayload.exp * ONE_SECOND_IN_MILLISECONDS;
  const expDate = new Date(expInMilliseconds - ONE_MINUTE_IN_MILLISECONDS);
  return expDate > now;
}
/** Given a LiveKit generated participant token, decodes and returns the associated {@link TokenPayload} data. */
function decodeTokenPayload(token) {
  const payload = decodeJwt(token);
  payload.roomConfig;
    const rest = __rest(payload, ["roomConfig"]);
  const mappedPayload = Object.assign(Object.assign({}, rest), {
    roomConfig: payload.roomConfig ? RoomConfiguration.fromJson(payload.roomConfig, {
      ignoreUnknownFields: true
    }) : undefined
  });
  return mappedPayload;
}
/** Given two TokenSourceFetchOptions values, check to see if they are deep equal. */
function areTokenSourceFetchOptionsEqual(a, b) {
  const allKeysSet = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeysSet) {
    switch (key) {
      case 'roomName':
      case 'participantName':
      case 'participantIdentity':
      case 'participantMetadata':
      case 'agentName':
      case 'agentMetadata':
      case 'deployment':
        if (a[key] !== b[key]) {
          return false;
        }
        break;
      case 'participantAttributes':
        if (!areAttributesEqual(a[key], b[key])) {
          return false;
        }
        break;
      default:
        // ref: https://stackoverflow.com/a/58009992
        const exhaustiveCheckedKey = key;
        throw new Error("Options key ".concat(exhaustiveCheckedKey, " not being checked for equality!"));
    }
  }
  return true;
}
function areAttributesEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const aKeys = Object.keys(a);
  const bKeys = new Set(Object.keys(b));
  if (aKeys.length !== bKeys.size) {
    return false;
  }
  return aKeys.every(key => bKeys.has(key) && a[key] === b[key]);
}export{areTokenSourceFetchOptionsEqual,decodeTokenPayload,isResponseTokenValid};//# sourceMappingURL=utils.mjs.map
