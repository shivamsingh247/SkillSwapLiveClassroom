import type LocalTrack from '../track/LocalTrack';
import LocalVideoTrack from '../track/LocalVideoTrack';
import type { ScreenShareCaptureOptions, VideoCaptureOptions, VideoEncoding } from '../track/options';
export declare const videoDefaults: VideoCaptureOptions;
/** The video part of `publishDefaults`; the `video` extension merges it under the room options. */
export declare const videoPublishDefaults: {
    readonly simulcast: true;
    readonly screenShareEncoding: VideoEncoding;
    readonly videoCodec: "vp8";
    readonly backupCodec: true;
};
/**
 * Lets `createLocalTracks` and `publishTrack` produce video tracks. Safe to call repeatedly.
 * @experimental
 */
export declare function registerVideoCapture(): void;
/**
 * Creates a [[LocalVideoTrack]] with getUserMedia()
 * @param options
 */
export declare function createLocalVideoTrack(options?: VideoCaptureOptions): Promise<LocalVideoTrack>;
/**
 * Creates a screen capture tracks with getDisplayMedia().
 * A LocalVideoTrack is always created and returned.
 * If { audio: true }, and the browser supports audio capture, a LocalAudioTrack is also created.
 */
export declare function createLocalScreenTracks(options?: ScreenShareCaptureOptions): Promise<Array<LocalTrack>>;
