import {__rest,__awaiter}from'tslib';import {Mutex}from'@livekit/mutex';import {TokenSourceRequest,RoomConfiguration,RoomAgentDispatch,TokenSourceResponse}from'@livekit/protocol';import {TokenSourceFixed,TokenSourceConfigurable}from'./types.mjs';import {areTokenSourceFetchOptionsEqual,isResponseTokenValid,decodeTokenPayload}from'./utils.mjs';/** A TokenSourceCached is a TokenSource which caches the last {@link TokenSourceResponseObject} value and returns it
 * until a) it expires or b) the {@link TokenSourceFetchOptions} provided to .fetch(...) change.
 *
 * Options are compared by value (including the entries of `participantAttributes`), but the cache keeps a
 * reference to the options object passed to the last successful fetch. Treat that object as immutable: to fetch
 * with different options, pass a new object rather than changing the previous one in place. */
class TokenSourceCached extends TokenSourceConfigurable {
  constructor() {
    super(...arguments);
    this.cachedFetchOptions = null;
    this.cachedResponse = null;
    this.fetchMutex = new Mutex();
  }
  isSameAsCachedFetchOptions(options) {
    if (!this.cachedFetchOptions) {
      return false;
    }
    return areTokenSourceFetchOptionsEqual(options, this.cachedFetchOptions);
  }
  shouldReturnCachedValueFromFetch(fetchOptions) {
    if (!this.cachedResponse) {
      return false;
    }
    if (!isResponseTokenValid(this.cachedResponse)) {
      return false;
    }
    if (!this.isSameAsCachedFetchOptions(fetchOptions)) {
      return false;
    }
    return true;
  }
  getCachedResponseJwtPayload() {
    if (!this.cachedResponse) {
      return null;
    }
    return decodeTokenPayload(this.cachedResponse.participantToken);
  }
  fetch(options, force) {
    return __awaiter(this, void 0, void 0, function* () {
      const unlock = yield this.fetchMutex.lock();
      try {
        if (force) {
          this.cachedResponse = null;
        }
        if (this.shouldReturnCachedValueFromFetch(options)) {
          return this.cachedResponse.toJson();
        }
        const tokenResponse = yield this.update(options);
        // recorded only once the update succeeds, so a failed fetch cannot pair its options
        // with the response cached for the previous ones
        this.cachedFetchOptions = options;
        this.cachedResponse = tokenResponse;
        return tokenResponse.toJson();
      } finally {
        unlock();
      }
    });
  }
}
class TokenSourceLiteral extends TokenSourceFixed {
  constructor(literalOrFn) {
    super();
    this.literalOrFn = literalOrFn;
  }
  fetch() {
    return __awaiter(this, void 0, void 0, function* () {
      if (typeof this.literalOrFn === 'function') {
        return this.literalOrFn();
      } else {
        return this.literalOrFn;
      }
    });
  }
}
class TokenSourceCustom extends TokenSourceCached {
  constructor(customFn) {
    super();
    this.customFn = customFn;
  }
  update(options) {
    return __awaiter(this, void 0, void 0, function* () {
      const resultMaybePromise = this.customFn(options);
      let result;
      if (resultMaybePromise instanceof Promise) {
        result = yield resultMaybePromise;
      } else {
        result = resultMaybePromise;
      }
      return TokenSourceResponse.fromJson(result, {
        // NOTE: it could be possible that the response body could contain more fields than just
        // what's in TokenSourceResponse depending on the implementation
        ignoreUnknownFields: true
      });
    });
  }
}
class TokenSourceEndpoint extends TokenSourceCached {
  constructor(url) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    super();
    this.url = url;
    this.endpointOptions = options;
  }
  createRequestFromOptions(options) {
    var _a, _b, _c, _d;
    const request = new TokenSourceRequest();
    for (const key of Object.keys(options)) {
      switch (key) {
        case 'roomName':
        case 'participantName':
        case 'participantIdentity':
        case 'participantMetadata':
          request[key] = options[key];
          break;
        case 'participantAttributes':
          request.participantAttributes = (_a = options.participantAttributes) !== null && _a !== void 0 ? _a : {};
          break;
        case 'agentName':
          request.roomConfig = (_b = request.roomConfig) !== null && _b !== void 0 ? _b : new RoomConfiguration();
          if (request.roomConfig.agents.length === 0) {
            request.roomConfig.agents.push(new RoomAgentDispatch());
          }
          request.roomConfig.agents[0].agentName = options.agentName;
          break;
        case 'agentMetadata':
          request.roomConfig = (_c = request.roomConfig) !== null && _c !== void 0 ? _c : new RoomConfiguration();
          if (request.roomConfig.agents.length === 0) {
            request.roomConfig.agents.push(new RoomAgentDispatch());
          }
          request.roomConfig.agents[0].metadata = options.agentMetadata;
          break;
        case 'deployment':
          request.roomConfig = (_d = request.roomConfig) !== null && _d !== void 0 ? _d : new RoomConfiguration();
          if (request.roomConfig.agents.length === 0) {
            request.roomConfig.agents.push(new RoomAgentDispatch());
          }
          request.roomConfig.agents[0].deployment = options.deployment;
          break;
        default:
          // ref: https://stackoverflow.com/a/58009992
          const exhaustiveCheckedKey = key;
          throw new Error("Options key ".concat(exhaustiveCheckedKey, " not being included in forming request!"));
      }
    }
    return request;
  }
  update(options) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      const request = this.createRequestFromOptions(options);
      const response = yield fetch(this.url, Object.assign(Object.assign({}, this.endpointOptions), {
        method: (_a = this.endpointOptions.method) !== null && _a !== void 0 ? _a : 'POST',
        headers: Object.assign({
          'Content-Type': 'application/json'
        }, this.endpointOptions.headers),
        body: request.toJsonString({
          useProtoFieldName: true
        })
      }));
      if (!response.ok) {
        throw new Error("Error generating token from endpoint ".concat(this.url, ": received ").concat(response.status, " / ").concat(yield response.text()));
      }
      const body = yield response.json();
      return TokenSourceResponse.fromJson(body, {
        // NOTE: it could be possible that the response body could contain more fields than just
        // what's in TokenSourceResponse depending on the implementation (ie, DevelopmentTokenServer)
        ignoreUnknownFields: true
      });
    });
  }
}
class TokenSourceDevelopmentTokenServer extends TokenSourceEndpoint {
  constructor(tokenServerId, options) {
    const _options$baseUrl = options.baseUrl,
      baseUrl = _options$baseUrl === void 0 ? 'https://cloud-api.livekit.io' : _options$baseUrl,
      rest = __rest(options, ["baseUrl"]);
    super("".concat(baseUrl, "/api/v2/sandbox/connection-details"), Object.assign(Object.assign({}, rest), {
      headers: {
        'X-Sandbox-ID': tokenServerId
      }
    }));
  }
}
/** @deprecated Use {@link TokenSourceDevelopmentTokenServer} instead */
class TokenSourceSandboxTokenServer extends TokenSourceDevelopmentTokenServer {}
const TokenSource = {
  /** TokenSource.literal contains a single, literal set of {@link TokenSourceResponseObject}
   * credentials, either provided directly or returned from a provided function. */
  literal(literalOrFn) {
    return new TokenSourceLiteral(literalOrFn);
  },
  /**
   * TokenSource.custom allows a user to define a manual function which generates new
   * {@link TokenSourceResponseObject} values on demand.
   *
   * Use this to get credentials from custom backends / etc.
   */
  custom(customFn) {
    return new TokenSourceCustom(customFn);
  },
  /**
   * TokenSource.endpoint creates a token source that fetches credentials from a given URL using
   * the standard endpoint format:
   * @see https://docs.livekit.io/frontends/build/authentication/endpoint/
   */
  endpoint(url) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return new TokenSourceEndpoint(url, options);
  },
  /**
   * @deprecated Use {@link TokenSource.developmentTokenServer} instead
   */
  sandboxTokenServer(sandboxId) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return new TokenSourceSandboxTokenServer(sandboxId, options);
  },
  /**
   * TokenSource.developmentTokenServer queries a development token server for credentials,
   * which supports quick prototyping / getting started types of use cases.
   *
   * This token provider is INSECURE and should NOT be used in production.
   *
   * For more info:
   * @see https://docs.livekit.io/frontends/build/authentication/sandbox-token-server/
   */
  developmentTokenServer(tokenServerId) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return new TokenSourceDevelopmentTokenServer(tokenServerId, options);
  }
};export{TokenSource,areTokenSourceFetchOptionsEqual,decodeTokenPayload};//# sourceMappingURL=TokenSource.mjs.map
