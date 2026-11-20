import CriticalTimers from'./timers.mjs';/**
 * Originally from ts-debounce (https://github.com/chodorowicz/ts-debounce)
 * with the following license:
 *
 * MIT License
 *
 * Copyright (c) 2017 Jakub Chodorowicz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Modified to use CriticalTimers for reliable timer execution.
 */
/* eslint-disable @typescript-eslint/no-this-alias, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-shadow */
function debounce(func) {
  let waitMilliseconds = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 50;
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var _a, _b;
  let timeoutId;
  const isImmediate = (_a = options.isImmediate) !== null && _a !== void 0 ? _a : false;
  const callback = (_b = options.callback) !== null && _b !== void 0 ? _b : false;
  const maxWait = options.maxWait;
  let lastInvokeTime = Date.now();
  let promises = [];
  function nextInvokeTimeout() {
    if (maxWait !== undefined) {
      const timeSinceLastInvocation = Date.now() - lastInvokeTime;
      if (timeSinceLastInvocation + waitMilliseconds >= maxWait) {
        return maxWait - timeSinceLastInvocation;
      }
    }
    return waitMilliseconds;
  }
  const debouncedFunction = function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    const context = this;
    return new Promise((resolve, reject) => {
      const invokeFunction = function () {
        timeoutId = undefined;
        lastInvokeTime = Date.now();
        if (!isImmediate) {
          const result = func.apply(context, args);
          callback && callback(result);
          // biome-ignore lint/suspicious/useIterableCallbackReturn: vendored code
          promises.forEach(_ref => {
            let resolve = _ref.resolve;
            return resolve(result);
          });
          promises = [];
        }
      };
      const shouldCallNow = isImmediate && timeoutId === undefined;
      if (timeoutId !== undefined) {
        CriticalTimers.clearTimeout(timeoutId);
      }
      timeoutId = CriticalTimers.setTimeout(invokeFunction, nextInvokeTimeout());
      if (shouldCallNow) {
        const result = func.apply(context, args);
        callback && callback(result);
        return resolve(result);
      }
      promises.push({
        resolve,
        reject
      });
    });
  };
  debouncedFunction.cancel = function (reason) {
    if (timeoutId !== undefined) {
      CriticalTimers.clearTimeout(timeoutId);
    }
    // biome-ignore lint/suspicious/useIterableCallbackReturn: vendored code
    promises.forEach(_ref2 => {
      let reject = _ref2.reject;
      return reject(reason);
    });
    promises = [];
  };
  return debouncedFunction;
}export{debounce};//# sourceMappingURL=debounce.mjs.map
