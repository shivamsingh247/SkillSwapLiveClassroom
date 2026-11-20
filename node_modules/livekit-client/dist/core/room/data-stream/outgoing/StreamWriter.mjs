import {__awaiter}from'tslib';class BaseStreamWriter {
  constructor(writableStream, info, onClose) {
    this.writableStream = writableStream;
    this.defaultWriter = writableStream.getWriter();
    this.onClose = onClose;
    this.info = info;
  }
  write(chunk) {
    return this.defaultWriter.write(chunk);
  }
  close() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      yield this.defaultWriter.close();
      this.defaultWriter.releaseLock();
      (_a = this.onClose) === null || _a === void 0 ? void 0 : _a.call(this);
    });
  }
}
class TextStreamWriter extends BaseStreamWriter {}
class ByteStreamWriter extends BaseStreamWriter {}export{ByteStreamWriter,TextStreamWriter};//# sourceMappingURL=StreamWriter.mjs.map
