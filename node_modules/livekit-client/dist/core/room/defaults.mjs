import DefaultReconnectPolicy from'./DefaultReconnectPolicy.mjs';import {AudioPresets}from'./track/options.mjs';const defaultVideoCodec = 'vp8';
const publishDefaults = {
  audioPreset: AudioPresets.music,
  dtx: true,
  red: true,
  forceStereo: false,
  stopMicTrackOnMute: false,
  preConnectBuffer: false
};
const audioDefaults = {
  deviceId: {
    ideal: 'default'
  },
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
  voiceIsolation: true
};
const roomOptionDefaults = {
  adaptiveStream: false,
  dynacast: false,
  stopLocalTrackOnUnpublish: true,
  reconnectPolicy: /* @__PURE__ */new DefaultReconnectPolicy(),
  disconnectOnPageLeave: true,
  webAudioMix: false,
  singlePeerConnection: true
};
const roomConnectOptionDefaults = {
  autoSubscribe: true,
  disableIceLite: false,
  maxRetries: 1,
  peerConnectionTimeout: 15000,
  websocketTimeout: 15000
};export{audioDefaults,defaultVideoCodec,publishDefaults,roomConnectOptionDefaults,roomOptionDefaults};//# sourceMappingURL=defaults.mjs.map
