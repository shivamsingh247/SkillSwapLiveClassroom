import {slicedToArray as _slicedToArray}from'../_virtual/_rollupPluginBabelHelpers.mjs';class TTLMap {
  /**
   * @param ttl ttl of the key (ms)
   */
  constructor(ttl) {
    this._map = new Map();
    this._lastCleanup = 0;
    this.ttl = ttl;
  }
  set(key, value) {
    const now = Date.now();
    if (now - this._lastCleanup > this.ttl / 2) {
      this.cleanup();
    }
    const expiresAt = now + this.ttl;
    this._map.set(key, {
      value,
      expiresAt
    });
    return this;
  }
  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this._map.delete(key);
      return undefined;
    }
    return entry.value;
  }
  has(key) {
    const entry = this._map.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this._map.delete(key);
      return false;
    }
    return true;
  }
  delete(key) {
    return this._map.delete(key);
  }
  clear() {
    this._map.clear();
  }
  cleanup() {
    const now = Date.now();
    for (const _ref of this._map.entries()) {
      var _ref2 = _slicedToArray(_ref, 2);
      const key = _ref2[0];
      const entry = _ref2[1];
      if (entry.expiresAt < now) {
        this._map.delete(key);
      }
    }
    this._lastCleanup = now;
  }
  get size() {
    this.cleanup();
    return this._map.size;
  }
  forEach(callback) {
    this.cleanup();
    for (const _ref3 of this._map.entries()) {
      var _ref4 = _slicedToArray(_ref3, 2);
      const key = _ref4[0];
      const entry = _ref4[1];
      if (entry.expiresAt >= Date.now()) {
        callback(entry.value, key, this.asValueMap());
      }
    }
  }
  map(callback) {
    this.cleanup();
    const result = [];
    const valueMap = this.asValueMap();
    for (const _ref5 of valueMap.entries()) {
      var _ref6 = _slicedToArray(_ref5, 2);
      const key = _ref6[0];
      const value = _ref6[1];
      result.push(callback(value, key, valueMap));
    }
    return result;
  }
  asValueMap() {
    const result = new Map();
    for (const _ref7 of this._map.entries()) {
      var _ref8 = _slicedToArray(_ref7, 2);
      const key = _ref8[0];
      const entry = _ref8[1];
      if (entry.expiresAt >= Date.now()) {
        result.set(key, entry.value);
      }
    }
    return result;
  }
}export{TTLMap};//# sourceMappingURL=ttlmap.mjs.map
