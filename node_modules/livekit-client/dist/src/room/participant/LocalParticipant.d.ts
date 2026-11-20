import { AddTrackRequest, Codec, PacketTrailerFeature, ParticipantInfo, TrackInfo } from '@livekit/protocol';
import type { InternalRoomOptions } from '../../options';
import type { NonSharedUint8Array } from '../../type-polyfills/non-shared-typed-arrays';
import type RTCEngine from '../RTCEngine';
import type { CoreSlots } from '../extensions';
import LocalTrack from '../track/LocalTrack';
import LocalTrackPublication from '../track/LocalTrackPublication';
import type LocalVideoTrack from '../track/LocalVideoTrack';
import { Track } from '../track/Track';
import type { AudioCaptureOptions, CreateLocalTracksOptions, ScreenShareCaptureOptions, TrackPublishOptions, VideoCaptureOptions } from '../track/options';
import type { DataPublishOptions } from '../types';
import Participant from './Participant';
import type { ParticipantTrackPermission } from './ParticipantTrackPermission';
import type RemoteParticipant from './RemoteParticipant';
/**
 * The video publish pipeline. The `video` extension sets it on the local participant; without it,
 * publishing a video track throws.
 * @experimental
 */
export interface VideoPublisher {
    /**
     * Chooses the codec, settles simulcast and SVC and fills `req` (dimensions, layers, codecs).
     * Returns the encodings for the sender.
     */
    prepare(track: LocalVideoTrack, opts: TrackPublishOptions, req: AddTrackRequest): Promise<RTCRtpEncodingParameters[]>;
    /** Runs once the sender exists: degradation preference and start bitrate. */
    senderCreated(track: LocalVideoTrack, opts: TrackPublishOptions, encodings: RTCRtpEncodingParameters[] | undefined, req: AddTrackRequest): void;
    /** The server may answer with another primary codec. Returns recomputed encodings when it did. */
    serverCodecChanged(track: LocalVideoTrack, opts: TrackPublishOptions, info: TrackInfo, req: AddTrackRequest): RTCRtpEncodingParameters[] | undefined;
    createScreenTracks(options?: ScreenShareCaptureOptions): Promise<LocalTrack[]>;
}
export declare class LocalParticipant extends Participant {
    audioTrackPublications: Map<string, LocalTrackPublication>;
    videoTrackPublications: Map<string, LocalTrackPublication>;
    /** map of track sid => all published tracks */
    trackPublications: Map<string, LocalTrackPublication>;
    /** @internal */
    engine: RTCEngine;
    /** @internal */
    activeDeviceMap: Map<MediaDeviceKind, string>;
    /** @internal */
    pendingPublishing: Set<Track.Source>;
    private pendingPublishPromises;
    private republishPromise;
    private cameraError;
    private microphoneError;
    private participantTrackPermissions;
    private allParticipantsAllowedToSubscribe;
    private roomOptions;
    private encryptionType;
    private e2eeStateMutex;
    private reconnectFuture?;
    private signalConnectedFuture?;
    private activeAgentFuture?;
    private firstActiveAgent?;
    private pendingSignalRequests;
    /** @internal */
    enabledPublishVideoCodecs: Codec[];
    /** The room's extension slots; the install result of an extension fills them. */
    private readonly slots;
    /** @internal */
    constructor(sid: string, identity: string, engine: RTCEngine, options: InternalRoomOptions, slots?: Partial<CoreSlots>);
    get lastCameraError(): Error | undefined;
    get lastMicrophoneError(): Error | undefined;
    get isE2EEEnabled(): boolean;
    getTrackPublication(source: Track.Source): LocalTrackPublication | undefined;
    getTrackPublicationByName(name: string): LocalTrackPublication | undefined;
    /**
     * @internal
     */
    setupEngine(engine: RTCEngine): void;
    private handleReconnecting;
    private handleReconnected;
    private handleClosing;
    private handleSignalConnected;
    private handleSignalRequestResponse;
    /**
     * Sets and updates the metadata of the local participant.
     * Note: this requires `canUpdateOwnMetadata` permission.
     * method will throw if the user doesn't have the required permissions
     * @param metadata
     */
    setMetadata(metadata: string): Promise<void>;
    /**
     * Sets and updates the name of the local participant.
     * Note: this requires `canUpdateOwnMetadata` permission.
     * method will throw if the user doesn't have the required permissions
     * @param metadata
     */
    setName(name: string): Promise<void>;
    /**
     * Set or update participant attributes. It will make updates only to keys that
     * are present in `attributes`, and will not override others.
     * Note: this requires `canUpdateOwnMetadata` permission.
     * @param attributes attributes to update
     */
    setAttributes(attributes: Record<string, string>): Promise<void>;
    private requestMetadataUpdate;
    /**
     * Enable or disable a participant's microphone track.
     *
     * If a track has already published, it'll mute or unmute the track.
     * Resolves with a `LocalTrackPublication` instance if successful and `undefined` otherwise
     */
    setMicrophoneEnabled(enabled: boolean, options?: AudioCaptureOptions, publishOptions?: TrackPublishOptions): Promise<LocalTrackPublication | undefined>;
    /** @internal */
    setE2EEEnabled(enabled: boolean): Promise<void>;
    /**
     * Enable or disable publishing for a track by source. This serves as a simple
     * way to manage the common tracks (camera, mic, or screen share).
     * Resolves with LocalTrackPublication if successful and void otherwise
     * @internal
     */
    setTrackEnabled(source: Extract<Track.Source, Track.Source.Camera>, enabled: boolean, options?: VideoCaptureOptions, publishOptions?: TrackPublishOptions): Promise<LocalTrackPublication | undefined>;
    setTrackEnabled(source: Extract<Track.Source, Track.Source.Microphone>, enabled: boolean, options?: AudioCaptureOptions, publishOptions?: TrackPublishOptions): Promise<LocalTrackPublication | undefined>;
    setTrackEnabled(source: Extract<Track.Source, Track.Source.ScreenShare>, enabled: boolean, options?: ScreenShareCaptureOptions, publishOptions?: TrackPublishOptions): Promise<LocalTrackPublication | undefined>;
    /**
     * Create local camera and/or microphone tracks
     * @param options
     * @returns
     */
    createTracks(options?: CreateLocalTracksOptions): Promise<LocalTrack[]>;
    /** @internal logger options for tracks this participant creates */
    get trackLoggerOptions(): {
        loggerName: string | undefined;
        loggerContextCb: () => {
            [x: string]: unknown;
        };
    };
    private requireVideoPublisher;
    /**
     * Publish a new track to the room
     * @param track
     * @param options
     */
    publishTrack(track: LocalTrack | MediaStreamTrack, options?: TrackPublishOptions): Promise<LocalTrackPublication>;
    /**
     * Waits for the engine's next `Restarted` event. Unlike `engine.waitForRestarted`, this does
     * not short-circuit when `pcState === Connected` — at the point this is called (right after a
     * `NegotiationError`) the PC transport is still connected, but `fullReconnectOnNext` has been
     * set and `attemptReconnect` is queued via setTimeout. We need to wait for that restart to
     * actually complete (which clears `pendingTrackResolvers` via `cleanupClient`) before retrying.
     */
    private waitForNextEngineRestart;
    private publishOrRepublishTrack;
    private waitUntilEngineConnected;
    private hasPermissionsToPublish;
    private publish;
    private canPublishFrameMetadata;
    /** @internal */
    normalizeRequestedFrameMetadataOptions(track: LocalTrack, opts: TrackPublishOptions): PacketTrailerFeature[];
    get isLocal(): boolean;
    unpublishTrack(track: LocalTrack | MediaStreamTrack, stopOnUnpublish?: boolean): Promise<LocalTrackPublication | undefined>;
    unpublishTracks(tracks: LocalTrack[] | MediaStreamTrack[]): Promise<LocalTrackPublication[]>;
    republishAllTracks(options?: TrackPublishOptions, restartTracks?: boolean): Promise<void>;
    /**
     * Publish a new data payload to the room. Data will be forwarded to each
     * participant in the room if the destination field in publishOptions is empty
     *
     * @param data Uint8Array of the payload. To send string data, use TextEncoder.encode
     * @param options optionally specify a `reliable`, `topic` and `destination`
     */
    publishData(data: NonSharedUint8Array, options?: DataPublishOptions): Promise<void>;
    /**
     * Publish SIP DTMF message to the room.
     *
     * @param code DTMF code
     * @param digit DTMF digit
     */
    publishDtmf(code: number, digit: string): Promise<void>;
    /**
     * Control who can subscribe to LocalParticipant's published tracks.
     *
     * By default, all participants can subscribe. This allows fine-grained control over
     * who is able to subscribe at a participant and track level.
     *
     * Note: if access is given at a track-level (i.e. both [allParticipantsAllowed] and
     * [ParticipantTrackPermission.allTracksAllowed] are false), any newer published tracks
     * will not grant permissions to any participants and will require a subsequent
     * permissions update to allow subscription.
     *
     * @param allParticipantsAllowed Allows all participants to subscribe all tracks.
     *  Takes precedence over [[participantTrackPermissions]] if set to true.
     *  By default this is set to true.
     * @param participantTrackPermissions Full list of individual permissions per
     *  participant/track. Any omitted participants will not receive any permissions.
     */
    setTrackSubscriptionPermissions(allParticipantsAllowed: boolean, participantTrackPermissions?: ParticipantTrackPermission[]): void;
    /** @internal */
    setEnabledPublishCodecs(codecs: Codec[]): void;
    /** @internal */
    updateInfo(info: ParticipantInfo): boolean;
    private updateTrackSubscriptionPermissions;
    /** @internal */
    setActiveAgent(agent: RemoteParticipant | undefined): void;
    private waitUntilActiveAgentPresent;
    /** @internal */
    private onTrackUnmuted;
    /** @internal */
    private onTrackMuted;
    private onTrackUpstreamPaused;
    private onTrackUpstreamResumed;
    private onTrackFeatureUpdate;
    private onTrackCpuConstrained;
    private handleLocalTrackUnpublished;
    private handleTrackEnded;
    /**
     * @internal
     */
    private restartOnDefaultAudioDevice;
    private getPublicationForTrack;
    private waitForPendingPublicationOfSource;
}
export default LocalParticipant;
//# sourceMappingURL=LocalParticipant.d.ts.map