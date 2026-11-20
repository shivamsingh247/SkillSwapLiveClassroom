import {__awaiter}from'tslib';import livekitLogger from'../logger.mjs';import {isSafari}from'./utils.mjs';const defaultId = 'default';
class DeviceManager {
  constructor() {
    this._previousDevices = [];
  }
  static getInstance() {
    if (this.instance === undefined) {
      this.instance = new DeviceManager();
    }
    return this.instance;
  }
  get previousDevices() {
    return this._previousDevices;
  }
  getDevices(kind_1) {
    return __awaiter(this, arguments, void 0, function (kind) {
      var _this = this;
      let requestPermissions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      return function* () {
        var _a;
        if (((_a = DeviceManager.userMediaPromiseMap) === null || _a === void 0 ? void 0 : _a.size) > 0) {
          livekitLogger.debug('awaiting getUserMedia promise');
          try {
            if (kind) {
              yield DeviceManager.userMediaPromiseMap.get(kind);
            } else {
              yield Promise.all(DeviceManager.userMediaPromiseMap.values());
            }
          } catch (e) {
            livekitLogger.warn('error waiting for media permissons');
          }
        }
        let devices = yield navigator.mediaDevices.enumerateDevices();
        if (requestPermissions &&
        // for safari we need to skip this check, as otherwise it will re-acquire user media and fail on iOS https://bugs.webkit.org/show_bug.cgi?id=179363
        !(isSafari() && _this.hasDeviceInUse(kind))) {
          const isDummyDeviceOrEmpty = devices.filter(d => !kind || d.kind === kind).length === 0 || devices.some(device => {
            const noLabel = device.label === '';
            const isRelevant = kind ? device.kind === kind : true;
            return noLabel && isRelevant;
          });
          if (isDummyDeviceOrEmpty) {
            const permissionsToAcquire = {
              video: kind !== 'audioinput' && kind !== 'audiooutput',
              audio: kind !== 'videoinput' && {
                deviceId: {
                  ideal: 'default'
                }
              }
            };
            const stream = yield navigator.mediaDevices.getUserMedia(permissionsToAcquire);
            devices = yield navigator.mediaDevices.enumerateDevices();
            stream.getTracks().forEach(track => {
              track.stop();
            });
          }
        }
        _this._previousDevices = devices;
        if (kind) {
          devices = devices.filter(device => device.kind === kind);
        }
        return devices;
      }();
    });
  }
  normalizeDeviceId(kind, deviceId, groupId) {
    return __awaiter(this, void 0, void 0, function* () {
      if (deviceId !== defaultId) {
        return deviceId;
      }
      // resolve actual device id if it's 'default': Chrome returns it when no
      // device has been chosen
      const devices = yield this.getDevices(kind);
      const defaultDevice = devices.find(d => d.deviceId === defaultId);
      if (!defaultDevice) {
        livekitLogger.warn('could not reliably determine default device');
        return undefined;
      }
      const device = devices.find(d => d.deviceId !== defaultId && d.groupId === (groupId !== null && groupId !== void 0 ? groupId : defaultDevice.groupId));
      if (!device) {
        livekitLogger.warn('could not reliably determine default device');
        return undefined;
      }
      return device === null || device === void 0 ? void 0 : device.deviceId;
    });
  }
  hasDeviceInUse(kind) {
    return kind ? DeviceManager.userMediaPromiseMap.has(kind) : DeviceManager.userMediaPromiseMap.size > 0;
  }
}
DeviceManager.mediaDeviceKinds = ['audioinput', 'audiooutput', 'videoinput'];
DeviceManager.userMediaPromiseMap = new Map();export{DeviceManager as default};//# sourceMappingURL=DeviceManager.mjs.map
