import {RpcError as RpcError$1}from'@livekit/protocol';/**
 * Specialized error handling for RPC methods.
 *
 * Instances of this type, when thrown in a method handler, will have their `message`
 * serialized and sent across the wire. The sender will receive an equivalent error on the other side.
 *
 * Built-in types are included but developers may use any string, with a max length of 256 bytes.
 */
class RpcError extends Error {
  /**
   * Creates an error object with the given code and message, plus an optional data payload.
   *
   * If thrown in an RPC method handler, the error will be sent back to the caller.
   *
   * Error codes 1001-1999 are reserved for built-in errors (see RpcError.ErrorCode for their meanings).
   */
  constructor(code, message, data, options) {
    super(message);
    this.code = code;
    this.message = truncateBytes(message, RpcError.MAX_MESSAGE_BYTES);
    this.data = data ? truncateBytes(data, RpcError.MAX_DATA_BYTES) : undefined;
    if (typeof (options === null || options === void 0 ? void 0 : options.cause) !== 'undefined') {
      this.cause = options === null || options === void 0 ? void 0 : options.cause;
    }
  }
  /**
   * @internal
   */
  static fromProto(proto) {
    return new RpcError(proto.code, proto.message, proto.data);
  }
  /**
   * @internal
   */
  toProto() {
    return new RpcError$1({
      code: this.code,
      message: this.message,
      data: this.data
    });
  }
  /**
   * Creates an error object from the code, with an auto-populated message.
   *
   * @internal
   */
  static builtIn(key, data, options) {
    return new RpcError(RpcError.ErrorCode[key], RpcError.ErrorMessage[key], data, options);
  }
}
RpcError.MAX_MESSAGE_BYTES = 256;
RpcError.MAX_DATA_BYTES = 15360; // 15 KB
RpcError.ErrorCode = {
  APPLICATION_ERROR: 1500,
  CONNECTION_TIMEOUT: 1501,
  RESPONSE_TIMEOUT: 1502,
  RECIPIENT_DISCONNECTED: 1503,
  RESPONSE_PAYLOAD_TOO_LARGE: 1504,
  SEND_FAILED: 1505,
  CONNECTION_CLOSED: 1506,
  UNSUPPORTED_METHOD: 1400,
  RECIPIENT_NOT_FOUND: 1401,
  REQUEST_PAYLOAD_TOO_LARGE: 1402,
  UNSUPPORTED_SERVER: 1403,
  UNSUPPORTED_VERSION: 1404
};
/**
 * @internal
 */
RpcError.ErrorMessage = {
  APPLICATION_ERROR: 'Application error in method handler',
  CONNECTION_TIMEOUT: 'Connection timeout',
  RESPONSE_TIMEOUT: 'Response timeout',
  RECIPIENT_DISCONNECTED: 'Recipient disconnected',
  RESPONSE_PAYLOAD_TOO_LARGE: 'Response payload too large',
  SEND_FAILED: 'Failed to send',
  CONNECTION_CLOSED: 'Connection closed',
  UNSUPPORTED_METHOD: 'Method not supported at destination',
  RECIPIENT_NOT_FOUND: 'Recipient not found',
  REQUEST_PAYLOAD_TOO_LARGE: 'Request payload too large',
  UNSUPPORTED_SERVER: 'RPC not supported by server',
  UNSUPPORTED_VERSION: 'Unsupported RPC version'
};
/*
 * Maximum payload size for RPC requests and responses for clients with a clientProtocol of less
 * than CLIENT_PROTOCOL_DATA_STREAM_RPC.
 *
 * If a payload exceeds this size and the remote client does not support compression,
 * the RPC call will fail with a REQUEST_PAYLOAD_TOO_LARGE(1402) or RESPONSE_PAYLOAD_TOO_LARGE(1504) error.
 */
const MAX_V1_PAYLOAD_BYTES = 15360; // 15 KB
/**
 * Topic used for v2 RPC request data streams.
 * @internal
 */
const RPC_REQUEST_DATA_STREAM_TOPIC = 'lk.rpc_request';
/**
 * Topic used for v2 RPC response data streams.
 * @internal
 */
const RPC_RESPONSE_DATA_STREAM_TOPIC = 'lk.rpc_response';
/** @internal */
var RpcRequestAttrs;
(function (RpcRequestAttrs) {
  RpcRequestAttrs["RPC_REQUEST_ID"] = "lk.rpc_request_id";
  RpcRequestAttrs["RPC_REQUEST_METHOD"] = "lk.rpc_request_method";
  RpcRequestAttrs["RPC_REQUEST_RESPONSE_TIMEOUT_MS"] = "lk.rpc_request_response_timeout_ms";
  RpcRequestAttrs["RPC_REQUEST_VERSION"] = "lk.rpc_request_version";
})(RpcRequestAttrs || (RpcRequestAttrs = {}));
/** Initial version of rpc which uses RpcRequest / RpcResponse messages.
 * @internal
 **/
const RPC_VERSION_V1 = 1;
/** Rpc version backed by data streams instead of RpcRequest / RpcResponse.
 * @internal
 **/
const RPC_VERSION_V2 = 2;
/**
 * @internal
 */
function byteLength(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str).length;
}
/**
 * @internal
 */
function truncateBytes(str, maxBytes) {
  if (byteLength(str) <= maxBytes) {
    return str;
  }
  let low = 0;
  let high = str.length;
  const encoder = new TextEncoder();
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (encoder.encode(str.slice(0, mid)).length <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  // Never end on the first half of a surrogate pair: it would be encoded as a replacement
  // character, and the truncated string would no longer round trip.
  const lastCode = low > 0 ? str.charCodeAt(low - 1) : 0;
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    low -= 1;
  }
  return str.slice(0, low);
}export{MAX_V1_PAYLOAD_BYTES,RPC_REQUEST_DATA_STREAM_TOPIC,RPC_RESPONSE_DATA_STREAM_TOPIC,RPC_VERSION_V1,RPC_VERSION_V2,RpcError,RpcRequestAttrs,byteLength,truncateBytes};//# sourceMappingURL=utils.mjs.map
