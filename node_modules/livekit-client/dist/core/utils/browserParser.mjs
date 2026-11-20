// tiny, simplified version of https://github.com/lancedikson/bowser/blob/master/src/parser-browsers.js
// reduced to only differentiate Chrome(ium) based browsers / Firefox / Safari
const commonVersionIdentifier = /version\/(\d+(\.?_?\d+)+)/i;
let browserDetails;
function getBrowser(userAgent) {
  let force = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  if (typeof userAgent === 'undefined' && typeof navigator === 'undefined') {
    return;
  }
  const ua = (userAgent !== null && userAgent !== void 0 ? userAgent : navigator.userAgent).toLowerCase();
  if (browserDetails === undefined || force) {
    const browser = browsersList.find(_ref => {
      let test = _ref.test;
      return test.test(ua);
    });
    browserDetails = browser === null || browser === void 0 ? void 0 : browser.describe(ua);
  }
  return browserDetails;
}
const browsersList = [{
  test: /firefox|iceweasel|fxios/i,
  describe(ua) {
    const browser = {
      name: 'Firefox',
      version: getMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, ua),
      os: ua.toLowerCase().includes('fxios') ? 'iOS' : undefined,
      osVersion: getOSVersion(ua)
    };
    return browser;
  }
}, {
  test: /chrom|crios|crmo/i,
  describe(ua) {
    const browser = {
      name: 'Chrome',
      version: getMatch(/(?:chrome|chromium|crios|crmo)\/(\d+(\.?_?\d+)+)/i, ua),
      os: ua.toLowerCase().includes('crios') ? 'iOS' : undefined,
      osVersion: getOSVersion(ua)
    };
    return browser;
  }
}, /* Safari */
{
  test: /safari|applewebkit/i,
  describe(ua) {
    const browser = {
      name: 'Safari',
      version: getMatch(commonVersionIdentifier, ua),
      os: ua.includes('mobile/') ? 'iOS' : 'macOS',
      osVersion: getOSVersion(ua)
    };
    return browser;
  }
}];
function getMatch(exp, ua) {
  let id = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
  const match = ua.match(exp);
  return match && match.length >= id && match[id] || '';
}
function getOSVersion(ua) {
  return ua.includes('mac os') ? getMatch(/\(.+?(\d+_\d+(:?_\d+)?)/, ua, 1).replace(/_/g, '.') : undefined;
}export{getBrowser};//# sourceMappingURL=browserParser.mjs.map
