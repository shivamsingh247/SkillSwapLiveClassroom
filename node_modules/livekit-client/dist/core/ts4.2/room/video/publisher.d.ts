import type { SubscribedQualityUpdate } from '@livekit/protocol';
import type { StructuredLogger } from '../../logger';
import type { CoreRoom } from '../CoreRoom';
import type { VideoPublisher } from '../participant/LocalParticipant';
import type LocalTrack from '../track/LocalTrack';
import type { BackupVideoCodec, ScreenShareCaptureOptions, TrackPublishOptions } from '../track/options';
/** The video publish pipeline that `LocalParticipant.publishTrack` calls for video tracks. */
export declare function createVideoPublisher(room: CoreRoom, log: StructuredLogger): VideoPublisher;
/**
 * Creates a screen capture tracks with getDisplayMedia().
 * A LocalVideoTrack is always created and returned.
 * If { audio: true }, and the browser supports audio capture, a LocalAudioTrack is also created.
 */
export declare function createScreenTracks(room: CoreRoom, options?: ScreenShareCaptureOptions): Promise<Array<LocalTrack>>;
/**
 * Publish both camera and microphone at the same time. This is useful for
 * displaying a single Permission Dialog box to the end user.
 */
export declare function enableCameraAndMicrophone(room: CoreRoom): Promise<void>;
/** publish additional codec to existing track */
export declare function publishAdditionalCodecForTrack(room: CoreRoom, log: StructuredLogger, track: LocalTrack | MediaStreamTrack, videoCodec: BackupVideoCodec, options?: TrackPublishOptions): Promise<void>;
/** Dynacast: the server tells us which codecs subscribers need; publish the backup codec on demand. */
export declare function handleSubscribedQualityUpdate(room: CoreRoom, log: StructuredLogger, update: SubscribedQualityUpdate): Promise<void>;
