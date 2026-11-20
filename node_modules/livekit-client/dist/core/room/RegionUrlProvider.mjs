import {__awaiter}from'tslib';import {Mutex}from'@livekit/mutex';import {getLogger,LoggerNames}from'../logger.mjs';import {ConnectionError,ConnectionErrorReason}from'./errors.mjs';import {extractMaxAgeFromRequestHeaders,isCloud}from'./utils.mjs';const log = /* @__PURE__ */getLogger(LoggerNames.Region);
const DEFAULT_MAX_AGE_MS = 5000;
const STOP_REFETCH_DELAY_MS = 30000;
class RegionUrlProvider {
  static fetchRegionSettings(serverUrl, token, signal) {
    return __awaiter(this, void 0, void 0, function* () {
      const unlock = yield RegionUrlProvider.fetchLock.lock();
      try {
        const regionSettingsResponse = yield fetch("".concat(getCloudConfigUrl(serverUrl), "/regions"), {
          headers: {
            authorization: "Bearer ".concat(token)
          },
          signal
        });
        if (regionSettingsResponse.ok) {
          const maxAge = extractMaxAgeFromRequestHeaders(regionSettingsResponse.headers);
          const maxAgeInMs = maxAge ? maxAge * 1000 : DEFAULT_MAX_AGE_MS;
          const regionSettings = yield regionSettingsResponse.json();
          return {
            regionSettings,
            updatedAtInMs: Date.now(),
            maxAgeInMs
          };
        } else {
          if (regionSettingsResponse.status === 401) {
            throw ConnectionError.notAllowed("Could not fetch region settings: ".concat(regionSettingsResponse.statusText), regionSettingsResponse.status);
          } else {
            throw ConnectionError.internal("Could not fetch region settings: ".concat(regionSettingsResponse.statusText));
          }
        }
      } catch (e) {
        if (e instanceof ConnectionError) {
          // rethrow connection errors
          throw e;
        } else if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
          throw ConnectionError.cancelled("Region fetching was aborted");
        } else {
          // wrap other errors as connection errors
          throw ConnectionError.serverUnreachable("Could not fetch region settings, ".concat(e instanceof Error ? "".concat(e.name, ": ").concat(e.message) : e));
        }
      } finally {
        unlock();
      }
    });
  }
  static scheduleRefetch(url, token, maxAgeInMs) {
    return __awaiter(this, void 0, void 0, function* () {
      const timeout = RegionUrlProvider.settingsTimeouts.get(url.hostname);
      clearTimeout(timeout);
      RegionUrlProvider.settingsTimeouts.set(url.hostname, setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        try {
          const newSettings = yield RegionUrlProvider.fetchRegionSettings(url, token);
          RegionUrlProvider.updateCachedRegionSettings(url, token, newSettings);
        } catch (error) {
          if (error instanceof ConnectionError && error.reason === ConnectionErrorReason.NotAllowed) {
            log.debug('token is not valid, cancelling auto region refresh');
            return;
          }
          log.debug('auto refetching of region settings failed', {
            error
          });
          // continue retrying with the same max age
          RegionUrlProvider.scheduleRefetch(url, token, maxAgeInMs);
        }
      }), maxAgeInMs));
    });
  }
  static updateCachedRegionSettings(url, token, settings) {
    RegionUrlProvider.cache.set(url.hostname, settings);
    RegionUrlProvider.scheduleRefetch(url, token, settings.maxAgeInMs);
  }
  static stopRefetch(hostname) {
    const timeout = RegionUrlProvider.settingsTimeouts.get(hostname);
    if (timeout) {
      clearTimeout(timeout);
      RegionUrlProvider.settingsTimeouts.delete(hostname);
    }
  }
  static scheduleCleanup(hostname) {
    let tracker = RegionUrlProvider.connectionTrackers.get(hostname);
    if (!tracker) {
      return;
    }
    // Cancel any existing cleanup timeout
    if (tracker.cleanupTimeout) {
      clearTimeout(tracker.cleanupTimeout);
    }
    // Schedule cleanup to stop refetch after delay
    tracker.cleanupTimeout = setTimeout(() => {
      const currentTracker = RegionUrlProvider.connectionTrackers.get(hostname);
      if (currentTracker && currentTracker.connectionCount === 0) {
        log.debug('stopping region refetch after disconnect delay', {
          hostname
        });
        RegionUrlProvider.stopRefetch(hostname);
      }
      if (currentTracker) {
        currentTracker.cleanupTimeout = undefined;
      }
    }, STOP_REFETCH_DELAY_MS);
  }
  static cancelCleanup(hostname) {
    const tracker = RegionUrlProvider.connectionTrackers.get(hostname);
    if (tracker === null || tracker === void 0 ? void 0 : tracker.cleanupTimeout) {
      clearTimeout(tracker.cleanupTimeout);
      tracker.cleanupTimeout = undefined;
    }
  }
  notifyConnected() {
    const hostname = this.serverUrl.hostname;
    let tracker = RegionUrlProvider.connectionTrackers.get(hostname);
    if (!tracker) {
      tracker = {
        connectionCount: 0
      };
      RegionUrlProvider.connectionTrackers.set(hostname, tracker);
    }
    tracker.connectionCount++;
    // Cancel any scheduled cleanup since we have an active connection
    RegionUrlProvider.cancelCleanup(hostname);
  }
  notifyDisconnected() {
    const hostname = this.serverUrl.hostname;
    const tracker = RegionUrlProvider.connectionTrackers.get(hostname);
    if (!tracker) {
      return;
    }
    tracker.connectionCount = Math.max(0, tracker.connectionCount - 1);
    // If no more connections, schedule cleanup
    if (tracker.connectionCount === 0) {
      RegionUrlProvider.scheduleCleanup(hostname);
    }
  }
  constructor(url, token) {
    this.attemptedRegions = [];
    this.serverUrl = new URL(url);
    this.token = token;
  }
  updateToken(token) {
    var _a;
    this.token = token;
    const url = this.getServerUrl();
    const settings = RegionUrlProvider.cache.get(url.hostname);
    RegionUrlProvider.scheduleRefetch(this.serverUrl, this.token, (_a = settings === null || settings === void 0 ? void 0 : settings.maxAgeInMs) !== null && _a !== void 0 ? _a : DEFAULT_MAX_AGE_MS);
  }
  isCloud() {
    return isCloud(this.serverUrl);
  }
  getServerUrl() {
    return this.serverUrl;
  }
  /** @internal */
  fetchRegionSettings(abortSignal) {
    return __awaiter(this, void 0, void 0, function* () {
      return RegionUrlProvider.fetchRegionSettings(this.serverUrl, this.token, abortSignal);
    });
  }
  getNextBestRegionUrl(abortSignal) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.isCloud()) {
        throw Error('region availability is only supported for LiveKit Cloud domains');
      }
      let cachedSettings = RegionUrlProvider.cache.get(this.serverUrl.hostname);
      if (!cachedSettings || Date.now() - cachedSettings.updatedAtInMs > cachedSettings.maxAgeInMs) {
        cachedSettings = yield this.fetchRegionSettings(abortSignal);
        RegionUrlProvider.updateCachedRegionSettings(this.serverUrl, this.token, cachedSettings);
      }
      const regionsLeft = cachedSettings.regionSettings.regions.filter(region => !this.attemptedRegions.find(attempted => attempted.url === region.url));
      if (regionsLeft.length > 0) {
        const nextRegion = regionsLeft[0];
        this.attemptedRegions.push(nextRegion);
        log.info("switching to region: ".concat(nextRegion.region), {
          region: nextRegion.region
        });
        return nextRegion.url;
      } else {
        return null;
      }
    });
  }
  resetAttempts() {
    this.attemptedRegions = [];
  }
  setServerReportedRegions(settings) {
    RegionUrlProvider.updateCachedRegionSettings(this.serverUrl, this.token, settings);
  }
}
RegionUrlProvider.cache = new Map();
RegionUrlProvider.settingsTimeouts = new Map();
RegionUrlProvider.connectionTrackers = new Map();
RegionUrlProvider.fetchLock = new Mutex();
function getCloudConfigUrl(serverUrl) {
  return "".concat(serverUrl.protocol.replace('ws', 'http'), "//").concat(serverUrl.host, "/settings");
}export{DEFAULT_MAX_AGE_MS,RegionUrlProvider,STOP_REFETCH_DELAY_MS};//# sourceMappingURL=RegionUrlProvider.mjs.map
