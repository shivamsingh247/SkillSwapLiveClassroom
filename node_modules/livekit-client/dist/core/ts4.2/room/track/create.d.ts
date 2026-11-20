import type { LoggerOptions } from '../types';
import LocalAudioTrack from './LocalAudioTrack';
import type LocalTrack from './LocalTrack';
import type { AudioCaptureOptions, CreateLocalTracksOptions } from './options';
/**
 * Creates a local video and audio track at the same time. When acquiring both
 * audio and video tracks together, it'll display a single permission prompt to
 * the user instead of two separate ones.
 * @param options
 */
export declare function createLocalTracks(options?: CreateLocalTracksOptions, loggerOptions?: LoggerOptions): Promise<Array<LocalTrack>>;
export declare function createLocalAudioTrack(options?: AudioCaptureOptions): Promise<LocalAudioTrack>;
