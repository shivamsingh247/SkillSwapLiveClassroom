/**
 * Timers that can be overridden with platform specific implementations
 * that ensure that they are fired. These should be used when it is critical
 * that the timer fires on time.
 */
class CriticalTimers {}
CriticalTimers.setTimeout = function () {
  return setTimeout(...arguments);
};
CriticalTimers.setInterval =
// eslint-disable-next-line @typescript-eslint/no-implied-eval
function () {
  return setInterval(...arguments);
};
CriticalTimers.clearTimeout = function () {
  return clearTimeout(...arguments);
};
CriticalTimers.clearInterval = function () {
  return clearInterval(...arguments);
};export{CriticalTimers as default};//# sourceMappingURL=timers.mjs.map
