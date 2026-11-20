import {DataTrackInfo as DataTrackInfo$1,Encryption_Type}from'@livekit/protocol';import'./handle.mjs';const DataTrackInfo = {
  from(protocolInfo) {
    return {
      sid: protocolInfo.sid,
      pubHandle: protocolInfo.pubHandle,
      name: protocolInfo.name,
      usesE2ee: protocolInfo.encryption !== Encryption_Type.NONE
    };
  },
  toProtobuf(info) {
    return new DataTrackInfo$1({
      sid: info.sid,
      pubHandle: info.pubHandle,
      name: info.name,
      encryption: info.usesE2ee ? Encryption_Type.GCM : Encryption_Type.NONE
    });
  }
};export{DataTrackInfo};//# sourceMappingURL=types.mjs.map
