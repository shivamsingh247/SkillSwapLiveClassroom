import {CoreRoom}from'./CoreRoom.mjs';import {installExtensions}from'./extensions.mjs';/**
 * Creates a light room with exactly the given extensions. Dependencies install on their own
 * (`rpc` brings `dataStreams`); an extension you list, configured or not, wins over the default a
 * dependency would pull in. The result carries the extension methods under the names the full
 * `Room` uses, so code moves between the two builds unchanged.
 *
 * @example
 * ```typescript
 * const room = createRoom({ adaptiveStream: true }, [rpc, e2ee({ keyProvider, worker })]);
 * room.registerRpcMethod('greet', handler);
 * await room.connect(url, token);
 * ```
 * @experimental
 */
function createRoom(options, extensions) {
  const room = new CoreRoom(options);
  installExtensions(room, extensions !== null && extensions !== void 0 ? extensions : []);
  return room;
}export{createRoom};//# sourceMappingURL=createRoom.mjs.map
