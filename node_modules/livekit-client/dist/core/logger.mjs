import log from'loglevel';var LogLevel;
(function (LogLevel) {
  LogLevel[LogLevel["trace"] = 0] = "trace";
  LogLevel[LogLevel["debug"] = 1] = "debug";
  LogLevel[LogLevel["info"] = 2] = "info";
  LogLevel[LogLevel["warn"] = 3] = "warn";
  LogLevel[LogLevel["error"] = 4] = "error";
  LogLevel[LogLevel["silent"] = 5] = "silent";
})(LogLevel || (LogLevel = {}));
var LoggerNames;
(function (LoggerNames) {
  LoggerNames["Default"] = "livekit";
  LoggerNames["Room"] = "livekit-room";
  LoggerNames["TokenSource"] = "livekit-token-source";
  LoggerNames["Participant"] = "livekit-participant";
  LoggerNames["Track"] = "livekit-track";
  LoggerNames["Publication"] = "livekit-track-publication";
  LoggerNames["Engine"] = "livekit-engine";
  LoggerNames["Signal"] = "livekit-signal";
  LoggerNames["PCManager"] = "livekit-pc-manager";
  LoggerNames["PCTransport"] = "livekit-pc-transport";
  LoggerNames["E2EE"] = "lk-e2ee";
  LoggerNames["DataTracks"] = "livekit-data-tracks";
  LoggerNames["Region"] = "livekit-region";
  LoggerNames["ICE"] = "livekit-ice";
  LoggerNames["Stats"] = "livekit-stats";
})(LoggerNames || (LoggerNames = {}));
let livekitLogger = log.getLogger(LoggerNames.Default);
const livekitLoggers = Object.values(LoggerNames).map(name => log.getLogger(name));
livekitLogger.setDefaultLevel(LogLevel.info);
/**
 * Get a named logger. When `ctxFn` is supplied, every log call
 * automatically:
 * 1. prepends a `[key=value ...]` prefix derived from `ctxFn()` to the
 *    message string, so identifiers are visible in browser devtools
 *    without expanding the structured context object, and
 * 2. merges `ctxFn()` into the structured context passed to any
 *    `setLogExtension` consumer, so ingestion pipelines continue to
 *    receive the full metadata unchanged.
 */
function getLogger(name, ctxFn) {
  const logger = log.getLogger(name);
  logger.setDefaultLevel(livekitLogger.getLevel());
  if (!ctxFn) {
    return logger;
  }
  return wrapWithContext(logger, ctxFn);
}
function wrapWithContext(base, ctxFn) {
  // Resolve the underlying method on every call so that later
  // setLogExtension installations (which replace the base logger's
  // methods via loglevel's methodFactory) are picked up.
  const wrap = method => (msg, extra) => {
    const ctx = ctxFn();
    const merged = ctx || extra ? Object.assign(Object.assign({}, ctx), extra) : undefined;
    base[method](msg, merged);
  };
  const proxy = Object.create(base);
  proxy.trace = wrap('trace');
  proxy.debug = wrap('debug');
  proxy.info = wrap('info');
  proxy.warn = wrap('warn');
  proxy.error = wrap('error');
  return proxy;
}
function setLogLevel(level, loggerName) {
  if (loggerName) {
    log.getLogger(loggerName).setLevel(level);
  } else {
    for (const logger of livekitLoggers) {
      logger.setLevel(level);
    }
  }
}
/**
 * use this to hook into the logging function to allow sending internal livekit logs to third party services
 * if set, the browser logs will lose their stacktrace information (see https://github.com/pimterry/loglevel#writing-plugins)
 */
function setLogExtension(extension, logger) {
  const loggers = logger ? [logger] : livekitLoggers;
  loggers.forEach(logR => {
    const originalFactory = logR.methodFactory;
    logR.methodFactory = (methodName, configLevel, loggerName) => {
      const rawMethod = originalFactory(methodName, configLevel, loggerName);
      const logLevel = LogLevel[methodName];
      const needLog = logLevel >= configLevel && logLevel < LogLevel.silent;
      return (msg, context) => {
        if (context) rawMethod(msg, context);else rawMethod(msg);
        if (needLog) {
          extension(logLevel, msg, context);
        }
      };
    };
    logR.setLevel(logR.getLevel());
  });
}
const workerLogger = log.getLogger(LoggerNames.E2EE);
const workerLogLevelListeners = new Set();
const originalWorkerSetLevel = workerLogger.setLevel.bind(workerLogger);
workerLogger.setLevel = (level, persist) => {
  originalWorkerSetLevel(level, persist);
  const numeric = workerLogger.getLevel();
  workerLogLevelListeners.forEach(cb => cb(numeric));
};
/** @internal Subscribe to workerLogger level changes (so E2EE workers can be kept in sync). */
function onWorkerLogLevelChanged(cb) {
  workerLogLevelListeners.add(cb);
  return () => {
    workerLogLevelListeners.delete(cb);
  };
}export{LogLevel,LoggerNames,livekitLogger as default,getLogger,onWorkerLogLevelChanged,setLogExtension,setLogLevel,workerLogger};//# sourceMappingURL=logger.mjs.map
