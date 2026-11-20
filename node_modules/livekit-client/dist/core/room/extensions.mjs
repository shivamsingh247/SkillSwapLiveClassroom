/** @internal the keys core copies off an install result */
const SLOT_KEYS = ['e2eeManager', 'frameMetadataOptions', 'byteStreamOpener', 'videoPublisher'];
/**
 * Builds a {@link ConfigurableExtension}. The option type comes from the `options` parameter.
 * @experimental
 */
function defineExtension(name, requires, install) {
  const key = Symbol("lk.extension.".concat(name));
  const configure = options => ({
    key,
    requires,
    install: (room, ctx) => install(room, ctx, typeof options === 'function' ? options() : options)
  });
  return Object.assign(options => configure(options), configure());
}
/**
 * Installs extensions on a room: dependencies first, each key once. An extension the caller
 * lists explicitly wins over the default a dependency would pull in, whatever the order.
 * @experimental
 */
function installExtensions(room, extensions) {
  const explicit = new Map();
  for (const ext of extensions) {
    if (explicit.has(ext.key)) {
      // @throws-transformer ignore - programmer error
      throw new Error("extension '".concat(String(ext.key), "' is listed twice"));
    }
    explicit.set(ext.key, ext);
  }
  const resolved = [];
  const resolvedKeys = new Set();
  const add = (ext, stack) => {
    var _a, _b;
    const chosen = (_a = explicit.get(ext.key)) !== null && _a !== void 0 ? _a : ext;
    if (stack.includes(chosen.key)) {
      // @throws-transformer ignore - programmer error
      throw new Error("extension '".concat(String(chosen.key), "' depends on itself"));
    }
    if (resolvedKeys.has(chosen.key)) {
      return;
    }
    resolvedKeys.add(chosen.key);
    (_b = chosen.requires) === null || _b === void 0 ? void 0 : _b.forEach(dep => add(dep, [...stack, chosen.key]));
    resolved.push(chosen);
  };
  extensions.forEach(ext => add(ext, []));
  room.installExtensions(resolved);
}export{SLOT_KEYS,defineExtension,installExtensions};//# sourceMappingURL=extensions.mjs.map
