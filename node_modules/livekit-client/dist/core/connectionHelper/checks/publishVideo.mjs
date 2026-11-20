import {__awaiter}from'tslib';import {createLocalVideoTrack}from'../../room/video/create.mjs';import {Checker}from'./Checker.mjs';class PublishVideoCheck extends Checker {
  get description() {
    return 'Can publish video';
  }
  perform() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      const room = yield this.connect();
      const track = yield createLocalVideoTrack();
      // check if we have video from camera
      yield this.checkForVideo(track.mediaStreamTrack);
      room.localParticipant.publishTrack(track);
      // wait for a few seconds to publish
      yield new Promise(resolve => setTimeout(resolve, 5000));
      // verify RTC stats that it's publishing
      const stats = yield (_a = track.sender) === null || _a === void 0 ? void 0 : _a.getStats();
      if (!stats) {
        throw new Error('Could not get RTCStats');
      }
      let numPackets = 0;
      stats.forEach(stat => {
        if (stat.type === 'outbound-rtp' && (stat.kind === 'video' || !stat.kind && stat.mediaType === 'video')) {
          numPackets += stat.packetsSent;
        }
      });
      if (numPackets === 0) {
        throw new Error('Could not determine packets are sent');
      }
      this.appendMessage("published ".concat(numPackets, " video packets"));
    });
  }
  checkForVideo(track) {
    return __awaiter(this, void 0, void 0, function* () {
      const stream = new MediaStream();
      stream.addTrack(track.clone());
      // Create video element to check frames
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      // For iOS Safari
      video.setAttribute('playsinline', 'true');
      document.body.appendChild(video);
      yield new Promise(resolve => {
        video.onplay = () => {
          setTimeout(() => {
            var _a, _b, _c, _d;
            const canvas = document.createElement('canvas');
            const settings = track.getSettings();
            const width = (_b = (_a = settings.width) !== null && _a !== void 0 ? _a : video.videoWidth) !== null && _b !== void 0 ? _b : 1280;
            const height = (_d = (_c = settings.height) !== null && _c !== void 0 ? _c : video.videoHeight) !== null && _d !== void 0 ? _d : 720;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0);
            // Get image data and check if all pixels are black
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let isAllBlack = true;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) {
                isAllBlack = false;
                break;
              }
            }
            if (isAllBlack) {
              this.appendError('camera appears to be producing only black frames');
            } else {
              this.appendMessage('received video frames');
            }
            resolve();
          }, 1000);
        };
        video.play();
      });
      stream.getTracks().forEach(t => t.stop());
      video.remove();
    });
  }
}export{PublishVideoCheck};//# sourceMappingURL=publishVideo.mjs.map
