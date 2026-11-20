class VideoPreset {
  constructor(widthOrOptions, height, maxBitrate, maxFramerate, priority) {
    if (typeof widthOrOptions === 'object') {
      this.width = widthOrOptions.width;
      this.height = widthOrOptions.height;
      this.aspectRatio = widthOrOptions.aspectRatio;
      this.encoding = {
        maxBitrate: widthOrOptions.maxBitrate,
        maxFramerate: widthOrOptions.maxFramerate,
        priority: widthOrOptions.priority
      };
    } else if (height !== undefined && maxBitrate !== undefined) {
      this.width = widthOrOptions;
      this.height = height;
      this.aspectRatio = widthOrOptions / height;
      this.encoding = {
        maxBitrate,
        maxFramerate,
        priority
      };
    } else {
      throw new TypeError('Unsupported options: provide at least width, height and maxBitrate');
    }
  }
  get resolution() {
    return {
      width: this.width,
      height: this.height,
      frameRate: this.encoding.maxFramerate,
      aspectRatio: this.aspectRatio
    };
  }
}
// `red` is not technically a codec, but treated as one in signalling protocol
const audioCodecs = ['opus', 'red'];
const backupVideoCodecs = ['vp8', 'h264'];
const videoCodecs = ['vp8', 'h264', 'vp9', 'av1', 'h265'];
function isBackupVideoCodec(codec) {
  return !!backupVideoCodecs.find(backup => backup === codec);
}
var BackupCodecPolicy;
(function (BackupCodecPolicy) {
  // codec regression is preferred, the sfu will try to regress codec if possible but not guaranteed
  BackupCodecPolicy[BackupCodecPolicy["PREFER_REGRESSION"] = 0] = "PREFER_REGRESSION";
  // multi-codec simulcast, publish both primary and backup codec at the same time
  BackupCodecPolicy[BackupCodecPolicy["SIMULCAST"] = 1] = "SIMULCAST";
  // always use backup codec only
  BackupCodecPolicy[BackupCodecPolicy["REGRESSION"] = 2] = "REGRESSION";
})(BackupCodecPolicy || (BackupCodecPolicy = {}));
var AudioPresets;
(function (AudioPresets) {
  AudioPresets.telephone = {
    maxBitrate: 12000
  };
  AudioPresets.speech = {
    maxBitrate: 24000
  };
  AudioPresets.music = {
    maxBitrate: 48000
  };
  AudioPresets.musicStereo = {
    maxBitrate: 64000
  };
  AudioPresets.musicHighQuality = {
    maxBitrate: 96000
  };
  AudioPresets.musicHighQualityStereo = {
    maxBitrate: 128000
  };
})(AudioPresets || (AudioPresets = {}));
/**
 * Sane presets for video resolution/encoding
 */
const VideoPresets = {
  h90: /* @__PURE__ */new VideoPreset(160, 90, 90000, 20),
  h180: /* @__PURE__ */new VideoPreset(320, 180, 160000, 20),
  h216: /* @__PURE__ */new VideoPreset(384, 216, 180000, 20),
  h360: /* @__PURE__ */new VideoPreset(640, 360, 450000, 20),
  h540: /* @__PURE__ */new VideoPreset(960, 540, 800000, 25),
  h720: /* @__PURE__ */new VideoPreset(1280, 720, 1700000, 30),
  h1080: /* @__PURE__ */new VideoPreset(1920, 1080, 3000000, 30),
  h1440: /* @__PURE__ */new VideoPreset(2560, 1440, 5000000, 30),
  h2160: /* @__PURE__ */new VideoPreset(3840, 2160, 8000000, 30)
};
/**
 * Four by three presets
 */
const VideoPresets43 = {
  h120: /* @__PURE__ */new VideoPreset(160, 120, 70000, 20),
  h180: /* @__PURE__ */new VideoPreset(240, 180, 125000, 20),
  h240: /* @__PURE__ */new VideoPreset(320, 240, 140000, 20),
  h360: /* @__PURE__ */new VideoPreset(480, 360, 330000, 20),
  h480: /* @__PURE__ */new VideoPreset(640, 480, 500000, 20),
  h540: /* @__PURE__ */new VideoPreset(720, 540, 600000, 25),
  h720: /* @__PURE__ */new VideoPreset(960, 720, 1300000, 30),
  h1080: /* @__PURE__ */new VideoPreset(1440, 1080, 2300000, 30),
  h1440: /* @__PURE__ */new VideoPreset(1920, 1440, 3800000, 30)
};
const ScreenSharePresets = {
  h360fps3: /* @__PURE__ */new VideoPreset(640, 360, 200000, 3, 'medium'),
  h360fps15: /* @__PURE__ */new VideoPreset(640, 360, 400000, 15, 'medium'),
  h720fps5: /* @__PURE__ */new VideoPreset(1280, 720, 800000, 5, 'medium'),
  h720fps15: /* @__PURE__ */new VideoPreset(1280, 720, 1500000, 15, 'medium'),
  h720fps30: /* @__PURE__ */new VideoPreset(1280, 720, 2000000, 30, 'medium'),
  h1080fps15: /* @__PURE__ */new VideoPreset(1920, 1080, 2500000, 15, 'medium'),
  h1080fps30: /* @__PURE__ */new VideoPreset(1920, 1080, 5000000, 30, 'medium'),
  // original resolution, without resizing
  original: /* @__PURE__ */new VideoPreset(0, 0, 7000000, 30, 'medium')
};export{AudioPresets,BackupCodecPolicy,ScreenSharePresets,VideoPreset,VideoPresets,VideoPresets43,audioCodecs,isBackupVideoCodec,videoCodecs};//# sourceMappingURL=options.mjs.map
