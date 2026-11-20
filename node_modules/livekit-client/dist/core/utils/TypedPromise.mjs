var _a, _b;
class TypedPromise extends (_b = Promise) {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(executor) {
    super(executor);
  }
  catch(onrejected) {
    return super.catch(onrejected);
  }
  static reject(reason) {
    return super.reject(reason);
  }
  static all(values) {
    return super.all(values);
  }
  static race(values) {
    return super.race(values);
  }
}
_a = TypedPromise;
TypedPromise.resolve = value => {
  return Reflect.get(_b, "resolve", _a).call(_a, value);
};export{TypedPromise as default};//# sourceMappingURL=TypedPromise.mjs.map
