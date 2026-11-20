import LocalVideoTrack from '../track/LocalVideoTrack';
import type { BackupVideoCodec, TrackPublishOptions } from '../track/options';
export declare function computeTrackBackupEncodings(track: LocalVideoTrack, videoCodec: BackupVideoCodec, opts: TrackPublishOptions): RTCRtpEncodingParameters[] | undefined;
/**
 * Returns the appropriate degradation preference for a video track based on its source.
 *
 * - Camera: 'maintain-framerate' (smoother video for real-time communication)
 * - Screen share: 'maintain-resolution' (clarity is critical for reading text/UI)
 * - Other/unknown: 'balanced'
 */
export declare function getDefaultDegradationPreference(track: LocalVideoTrack): RTCDegradationPreference;
