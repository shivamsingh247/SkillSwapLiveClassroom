import 'webrtc-adapter';
import type { E2eeRoomApi } from './e2ee/extension';
import type { FrameMetadataPublishOptions } from './frameMetadata/types';
import type { ChatLocalParticipantApi } from './room/chat/extension';
import type { DataStreamLocalParticipantApi, DataStreamRoomApi } from './room/data-stream/extension';
import type { DataTrackLocalParticipantApi } from './room/data-track/extension';
import type { RpcLocalParticipantApi, RpcRoomApi } from './room/rpc/extension';
import type { RpcLegacyLocalParticipantApi } from './room/rpc/legacyExtension';
import type { SimulatedParticipantsRoomApi } from './room/simulated-participants/extension';
import { isBackupVideoCodec } from './room/track/options';
import type { VideoLocalParticipantApi } from './room/video/extension';
export * from './exports';
export { Room } from './room/Room';
export type { CoreRoom } from './room/CoreRoom';
export type { 
/** @deprecated Use {@link FrameMetadata} instead. */
PacketTrailerMetadata, 
/** @deprecated Use {@link FrameMetadataPublishOptions} instead. */
PacketTrailerPublishOptions, } from './frameMetadata/types';
export { 
/** @deprecated Use {@link FrameMetadataManager} instead. */
PacketTrailerManager, 
/** @deprecated Use {@link FrameMetadataOptions} instead. */
type PacketTrailerOptions, } from './frameMetadata/FrameMetadataManager';
/** @deprecated Use {@link isBackupVideoCodec} instead */
export declare const isBackupCodec: typeof isBackupVideoCodec;
declare module './room/CoreRoom' {
    interface CoreRoom extends DataStreamRoomApi, RpcRoomApi, E2eeRoomApi, SimulatedParticipantsRoomApi {
    }
}
declare module './room/participant/LocalParticipant' {
    interface LocalParticipant extends DataStreamLocalParticipantApi, RpcLocalParticipantApi, RpcLegacyLocalParticipantApi, DataTrackLocalParticipantApi, VideoLocalParticipantApi, ChatLocalParticipantApi {
    }
}
declare module './room/track/options' {
    interface TrackPublishDefaults {
        /**
         * @deprecated Use {@link TrackPublishDefaults.frameMetadata} instead.
         */
        packetTrailer?: FrameMetadataPublishOptions;
    }
}
//# sourceMappingURL=index.d.ts.map