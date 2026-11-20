import {__awaiter}from'tslib';import {ConnectionError}from'../room/errors.mjs';import {sleep}from'../room/utils.mjs';import TypedPromise from'../utils/TypedPromise.mjs';import {getErrorDescription}from'./utils.mjs';/**
 * [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) with [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
 *
 * @see https://web.dev/websocketstream/
 */
class WebSocketStream {
  get readyState() {
    return this.ws.readyState;
  }
  constructor(url) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var _a, _b;
    if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
      throw new DOMException('This operation was aborted', 'AbortError');
    }
    this.url = url;
    const ws = new WebSocket(url, (_b = options.protocols) !== null && _b !== void 0 ? _b : []);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    // React Native has non spec-compliant behavior on close() before open:
    // iOS sends only `close`, and only once the TCP connect settles.
    // Android ignores the close and will open the socket anyway.
    // To fix this, close() before open rejects `opened` immediately.
    let closeRequested;
    let rejectOpened;
    const closeWithInfo = function () {
      let closeInfo = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      if (ws.readyState === WebSocket.CONNECTING) {
        closeRequested = closeInfo;
        rejectOpened(ConnectionError.websocket('Websocket closed before the connection opened'));
      }
      const code = closeInfo.closeCode,
        reason = closeInfo.reason;
      ws.close(code, reason === undefined ? undefined : truncateCloseReason(reason));
    };
    this.opened = new TypedPromise((resolve, reject) => {
      rejectOpened = reject;
      const rejectHandler = () => {
        reject(ConnectionError.websocket('Encountered websocket error during connection establishment'));
      };
      // Some WebSocket implementations (React Native on iOS, for one) report a handshake that ends
      // before the socket opens as a bare `close` event with no `error` before it. Without this
      // handler `opened` would stay pending forever in that case.
      const closeBeforeOpenHandler = ev => {
        reject(ConnectionError.websocket("Websocket closed during connection establishment with code ".concat(ev.code).concat(ev.reason ? ": ".concat(ev.reason) : '')));
      };
      ws.onopen = () => {
        if (closeRequested) {
          // React Native on Android ignored the close() and opened the socket anyway
          closeWithInfo(closeRequested);
          return;
        }
        resolve({
          readable: new ReadableStream({
            start(controller) {
              ws.onmessage = _ref => {
                let data = _ref.data;
                // workaround for RN behavior, browsers drop these messages already
                if (ws.readyState === WebSocket.OPEN) {
                  controller.enqueue(data);
                }
              };
              ws.onerror = e => controller.error(ConnectionError.websocket(getErrorDescription(e, 'websocket')));
              ws.onclose = ev => {
                if (ev.wasClean || ev.code === 1000) {
                  controller.close();
                } else {
                  controller.error(ConnectionError.websocket("WS closed unexpectedly with code ".concat(ev.code)));
                }
              };
            },
            cancel: closeWithInfo
          }),
          writable: new WritableStream({
            write(chunk) {
              ws.send(chunk);
            },
            abort() {
              ws.close();
            },
            close: closeWithInfo
          }),
          protocol: ws.protocol,
          extensions: ws.extensions
        });
        ws.removeEventListener('error', rejectHandler);
        ws.removeEventListener('close', closeBeforeOpenHandler);
      };
      ws.addEventListener('error', rejectHandler);
      ws.addEventListener('close', closeBeforeOpenHandler);
    });
    this.closed = new TypedPromise((resolve, reject) => {
      const rejectHandler = () => __awaiter(this, void 0, void 0, function* () {
        const closePromise = new TypedPromise(res => {
          if (ws.readyState === WebSocket.CLOSED) return;else {
            ws.addEventListener('close', closeEv => {
              res(closeEv);
            }, {
              once: true
            });
          }
        });
        const reason = yield TypedPromise.race([sleep(250), closePromise]);
        if (!reason) {
          reject(ConnectionError.websocket('Encountered unspecified websocket error without a timely close event'));
        } else {
          // if we can infer the close reason from the close event then resolve the promise, we don't need to throw
          resolve(reason);
        }
      });
      ws.addEventListener('close', _ref2 => {
        let code = _ref2.code,
          reason = _ref2.reason;
        resolve({
          closeCode: code,
          reason
        });
        ws.removeEventListener('error', rejectHandler);
      });
      ws.addEventListener('error', rejectHandler);
    });
    if (options.signal) {
      options.signal.onabort = () => closeWithInfo();
    }
    this.close = closeWithInfo;
  }
}
/** `WebSocket.close` throws a `SyntaxError` for a reason longer than this many UTF-8 bytes. */
const MAX_CLOSE_REASON_BYTES = 123;
function truncateCloseReason(reason) {
  const encoder = new TextEncoder();
  if (encoder.encode(reason).length <= MAX_CLOSE_REASON_BYTES) {
    return reason;
  }
  // cut on code point boundaries, so a multi-byte character is never split
  let truncated = '';
  let bytes = 0;
  for (const char of reason) {
    bytes += encoder.encode(char).length;
    if (bytes > MAX_CLOSE_REASON_BYTES) {
      break;
    }
    truncated += char;
  }
  return truncated;
}export{WebSocketStream,truncateCloseReason};//# sourceMappingURL=WebSocketStream.mjs.map
