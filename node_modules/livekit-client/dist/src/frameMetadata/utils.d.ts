import { PacketTrailerFeature } from '@livekit/protocol';
import type { TrackPublishDefaults } from '../room/track/options';
import type { FrameMetadataOptions } from './FrameMetadataManager';
import type { FrameMetadataPublishOptions } from './types';
export declare function shouldUseFrameMetadataScriptTransform(): boolean;
export declare function isFrameMetadataSupported(options?: FrameMetadataOptions): boolean;
export declare function hasFrameMetadataPublishOptions(options?: FrameMetadataPublishOptions): boolean;
export declare function getFrameMetadataFeatures(options?: FrameMetadataPublishOptions): PacketTrailerFeature[];
export declare function getFrameMetadataPublishOptions(features?: PacketTrailerFeature[]): FrameMetadataPublishOptions | undefined;
/** The requested frame metadata: `frameMetadata`, or the deprecated `packetTrailer`. */
export declare function getPublishFrameMetadata(opts?: TrackPublishDefaults): FrameMetadataPublishOptions | undefined;
/** Sets `frameMetadata` and the deprecated `packetTrailer` alike. */
export declare function setPublishFrameMetadata(opts: TrackPublishDefaults, value: FrameMetadataPublishOptions | undefined): void;
//# sourceMappingURL=utils.d.ts.map