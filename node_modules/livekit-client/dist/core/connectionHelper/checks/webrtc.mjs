import {__awaiter}from'tslib';import livekitLogger from'../../logger.mjs';import {RoomEvent}from'../../room/events.mjs';import {Checker}from'./Checker.mjs';class WebRTCCheck extends Checker {
  get description() {
    return 'Establishing WebRTC connection';
  }
  perform() {
    return __awaiter(this, void 0, void 0, function* () {
      let hasTcp = false;
      let hasIpv4Udp = false;
      this.room.on(RoomEvent.SignalConnected, () => {
        var _a;
        const prevTrickle = this.room.engine.client.onTrickle;
        this.room.engine.client.onTrickle = (sd, target) => {
          if (sd.candidate) {
            const candidate = new RTCIceCandidate(sd);
            let str = "".concat(candidate.protocol, " ").concat(candidate.address, ":").concat(candidate.port, " ").concat(candidate.type);
            if (candidate.address) {
              if (isIPPrivate(candidate.address)) {
                str += ' (private)';
              } else {
                if (candidate.protocol === 'tcp' && candidate.tcpType === 'passive') {
                  hasTcp = true;
                  str += ' (passive)';
                } else if (candidate.protocol === 'udp') {
                  hasIpv4Udp = true;
                }
              }
            }
            this.appendMessage(str);
          }
          if (prevTrickle) {
            prevTrickle(sd, target);
          }
        };
        if ((_a = this.room.engine.pcManager) === null || _a === void 0 ? void 0 : _a.subscriber) {
          this.room.engine.pcManager.subscriber.onIceCandidateError = ev => {
            if (ev instanceof RTCPeerConnectionIceErrorEvent) {
              this.appendWarning("error with ICE candidate: ".concat(ev.errorCode, " ").concat(ev.errorText, " ").concat(ev.url));
            }
          };
        }
      });
      try {
        yield this.connect();
        livekitLogger.info('now the room is connected');
      } catch (err) {
        this.appendWarning('ports need to be open on firewall in order to connect.');
        throw err;
      }
      if (!hasTcp) {
        this.appendWarning('Server is not configured for ICE/TCP');
      }
      if (!hasIpv4Udp) {
        this.appendWarning('No public IPv4 UDP candidates were found. Your server is likely not configured correctly');
      }
    });
  }
}
function isIPPrivate(address) {
  const parts = address.split('.');
  if (parts.length === 4) {
    if (parts[0] === '10') {
      return true;
    } else if (parts[0] === '192' && parts[1] === '168') {
      return true;
    } else if (parts[0] === '172') {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) {
        return true;
      }
    }
  }
  return false;
}export{WebRTCCheck};//# sourceMappingURL=webrtc.mjs.map
