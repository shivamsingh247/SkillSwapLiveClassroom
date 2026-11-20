const SerializerSymbol = /* @__PURE__ */Symbol.for('lk.serializer');
function isSerializer(v) {
  return typeof v === 'object' && v !== null && 'symbol' in v && v.symbol === SerializerSymbol;
}
/** @internal */
function base(params) {
  return Object.assign(Object.assign({}, params), {
    symbol: SerializerSymbol
  });
}
/**
 * JSON serializer — `JSON.parse` on the way in, `JSON.stringify` on the way out.
 * Defaults to `any` so individual handlers can annotate their own payload types.
 */
function json() {
  return base({
    parse: rawString => JSON.parse(rawString),
    serialize: val => JSON.stringify(val)
  });
}
/** Raw string serializer — passes payloads through as plain strings with no encoding. */
function raw() {
  return base({
    parse: rawString => rawString,
    serialize: val => val
  });
}
/** Custom serializer - allows custom defined parse and serialize functions */
function custom(params) {
  return base(params);
}
/**
 * Serializer helpers for message payload encoding.
 *
 * @example
 * ```ts
 * const a = serializers.raw(); // Serializer<string, string>
 * const b = serializer.json<{ foo: string }, { bar: string }>(); // Serializer<{ foo: string }, { bar: string }>
 * ```
 *
 * @beta
 */
const serializers = {
  json,
  raw,
  custom
};export{isSerializer,serializers};//# sourceMappingURL=serializer.mjs.map
