import {defineExtension}from'../room/extensions.mjs';import {FrameMetadataManager}from'./FrameMetadataManager.mjs';/**
 * Frame metadata extraction on subscribed video tracks (`frameMetadata` room option).
 * Publishing frame metadata is part of the core publish path and needs no extension.
 * @experimental
 */
const frameMetadata = /* @__PURE__ */defineExtension('frameMetadata', [], (room, _ctx, options) => {
  var _a;
  const resolved = (_a = options !== null && options !== void 0 ? options : room.options.frameMetadata) !== null && _a !== void 0 ? _a : room.options.packetTrailer;
  const manager = new FrameMetadataManager(resolved);
  manager.setup(room);
  // the engine (sender transform), the join request capability and publishTrack read the slot
  return {
    manager,
    frameMetadataOptions: resolved,
    dispose: () => manager.dispose()
  };
});export{frameMetadata};//# sourceMappingURL=extension.mjs.map
