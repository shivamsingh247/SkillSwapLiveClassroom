import {createFsm}from'machina';/**
 * Declares a handler for one input, restoring the payload typing that machina's `...unknown[]`
 * handler arguments give up.
 */
function on(handler) {
  return handler;
}
/**
 * Whether a transport-originated input belongs to the attempt that currently owns the session.
 * Inputs from a superseded attempt are dropped: its transport is already being replaced, so it can
 * neither declare the session live nor take it down.
 */
function isCurrentAttempt(ctx, event) {
  return event.attemptId === ctx.attemptId;
}
const attemptEstablished = on((_ref, event) => {
  let ctx = _ref.ctx;
  if (!isCurrentAttempt(ctx, event)) {
    return;
  }
  return 'connected';
});
const startConnect = on(_ref2 => {
  let ctx = _ref2.ctx;
  ctx.attemptId += 1;
  ctx.lastError = undefined;
  return 'connecting';
});
const startReconnect = on(_ref3 => {
  let ctx = _ref3.ctx;
  ctx.attemptId += 1;
  ctx.lastError = undefined;
  return 'reconnecting';
});
const requestClose = on((_ref4, event) => {
  let ctx = _ref4.ctx;
  ctx.closeReason = event.reason;
  return 'disconnecting';
});
const signalStates = {
  new: {
    connect: startConnect,
    close: requestClose
  },
  connecting: {
    connectComplete: attemptEstablished,
    // An initial connect has no session to fall back on, so failure is terminal.
    connectFailed: on((_ref5, event) => {
      let ctx = _ref5.ctx;
      ctx.lastError = event.error;
      return 'closed';
    }),
    close: requestClose
  },
  connected: {
    reconnect: startReconnect,
    transportFailed: on((_ref6, event) => {
      let ctx = _ref6.ctx;
      if (!isCurrentAttempt(ctx, event)) {
        // a transport that has already been replaced, reporting its close late
        return;
      }
      ctx.lastError = event.reason;
      return 'offline';
    }),
    close: requestClose
  },
  offline: {
    connect: startConnect,
    reconnect: startReconnect,
    close: requestClose
  },
  reconnecting: {
    reconnectComplete: attemptEstablished,
    reconnectFailed: on((_ref7, event) => {
      let ctx = _ref7.ctx;
      ctx.lastError = event.error;
      return event.recoverable ? 'offline' : 'closed';
    }),
    close: requestClose
  },
  // Owns the transport until the close handshake settles. Every path into this state is followed
  // by a `closeComplete`, so it cannot become a trap.
  disconnecting: {
    closeComplete: 'closed'
  },
  // No transport, but the session may still be resumable: the engine resumes after an unexpected
  // close just as it does from `offline`.
  closed: {
    connect: startConnect,
    reconnect: startReconnect
  }
};
/**
 * Lifecycle model of the signal connection.
 *
 * The machine deliberately does not own connection attempts: `SignalClient` performs the
 * asynchronous work and reports the outcome. It also does not decide *whether* to reconnect —
 * that policy (backoff, resume vs. full reconnect, region failover, giving up) belongs to
 * `RTCEngine`, so transport loss lands in `offline` rather than starting a reconnect on its own.
 *
 * Each client gets its own instance: the context is mutable and per-connection.
 */
function createSignalMachine() {
  let initialState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'new';
  const context = {
    attemptId: 0
  };
  return createFsm({
    id: 'signal',
    initialState: initialState,
    context,
    states: signalStates
  });
}export{createSignalMachine};//# sourceMappingURL=SignalClientStateMachine.mjs.map
