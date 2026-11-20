import type { LoggerOptions } from '../types';
import LocalAudioTrack from './LocalAudioTrack';
import type LocalTrack from './LocalTrack';
import type LocalVideoTrack from './LocalVideoTrack';
import type { AudioCaptureOptions, CreateLocalTracksOptions, VideoCaptureOptions } from './options';
/**
 * How core creates video tracks. The `video` extension (and the full entry) registers it; without
 * it, requesting a video track throws.
 * @internal
 */
export interface VideoCapture {
    defaults: VideoCaptureOptions;
    createTrack(mediaStreamTrack: MediaStreamTrack, constraints: MediaTrackConstraints | undefined, userProvidedTrack: boolean, loggerOptions?: LoggerOptions): LocalVideoTrack;
}
/** @internal */
export declare function setVideoCapture(capture: VideoCapture): void;
/** @internal */
export declare function getVideoCapture(): VideoCapture;
/**
 * Creates a local video and audio track at the same time. When acquiring both
 * audio and video tracks together, it'll display a single permission prompt to
 * the user instead of two separate ones.
 * @param options
 */
export declare function createLocalTracks(options?: CreateLocalTracksOptions, loggerOptions?: LoggerOptions): Promise<Array<LocalTrack>>;
export declare function createLocalAudioTrack(options?: AudioCaptureOptions): Promise<LocalAudioTrack>;
//# sourceMappingURL=create.d.ts.map
