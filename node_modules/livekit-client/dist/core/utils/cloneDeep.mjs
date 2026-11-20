function cloneDeep(value) {
  if (typeof value === 'undefined') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    if (typeof value === 'object' && value !== null) {
      // ensure that the value is not a proxy by spreading it
      return structuredClone(Object.assign({}, value));
    }
    return structuredClone(value);
  } else {
    return JSON.parse(JSON.stringify(value));
  }
}export{cloneDeep};//# sourceMappingURL=cloneDeep.mjs.map
