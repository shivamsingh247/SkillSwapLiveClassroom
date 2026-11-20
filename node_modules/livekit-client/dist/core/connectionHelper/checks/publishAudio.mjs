import {__awaiter}from'tslib';import {createLocalAudioTrack}from'../../room/track/create.mjs';import {detectSilence}from'../../room/track/utils.mjs';import {Checker}from'./Checker.mjs';class PublishAudioCheck extends Checker {
  get description() {
    return 'Can publish audio';
  }
  perform() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      const room = yield this.connect();
      const track = yield createLocalAudioTrack();
      const trackIsSilent = yield detectSilence(track, 1000);
      if (trackIsSilent) {
        throw new Error('unable to detect audio from microphone');
      }
      this.appendMessage('detected audio from microphone');
      room.localParticipant.publishTrack(track);
      // wait for a few seconds to publish
      yield new Promise(resolve => setTimeout(resolve, 3000));
      // verify RTC stats that it's publishing
      const stats = yield (_a = track.sender) === null || _a === void 0 ? void 0 : _a.getStats();
      if (!stats) {
        throw new Error('Could not get RTCStats');
      }
      let numPackets = 0;
      stats.forEach(stat => {
        if (stat.type === 'outbound-rtp' && (stat.kind === 'audio' || !stat.kind && stat.mediaType === 'audio')) {
          numPackets = stat.packetsSent;
        }
      });
      if (numPackets === 0) {
        throw new Error('Could not determine packets are sent');
      }
      this.appendMessage("published ".concat(numPackets, " audio packets"));
    });
  }
}export{PublishAudioCheck};//# sourceMappingURL=publishAudio.mjs.map
