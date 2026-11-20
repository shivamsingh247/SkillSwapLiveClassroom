import type { FrameMetadata } from '../../frameMetadata/types';
import type { VideoReceiverStats } from '../stats';
import type { LoggerOptions } from '../types';
import RemoteTrack from './RemoteTrack';
import { Track } from './Track';
import type { AdaptiveStreamSettings } from './types';
export default class RemoteVideoTrack extends RemoteTrack<Track.Kind.Video> {
    private prevStats?;
    private elementInfos;
    private adaptiveStreamSettings?;
    private lastVisible?;
    private lastDimensions?;
    constructor(mediaTrack: MediaStreamTrack, sid: string, receiver: RTCRtpReceiver, adaptiveStreamSettings?: AdaptiveStreamSettings, loggerOptions?: LoggerOptions);
    get isAdaptiveStream(): boolean;
    /**
     * Look up frame-level metadata for a given RTP timestamp.
     * Use with the `TrackEvent.TimeSyncUpdate` event to correlate displayed frames
     * with their capture-time metadata.
     *
     * Requires the room to be configured with the `frameMetadata` worker option
     * and the publishing track to have frame metadata features enabled.
     *
     */
    lookupFrameMetadata({ rtpTimestamp }: {
        rtpTimestamp: number;
    }): FrameMetadata | undefined;
    setStreamState(value: Track.StreamState): void;
    get mediaStreamTrack(): MediaStreamTrack;
    attach(): HTMLMediaElement;
    attach(element: HTMLMediaElement): HTMLMediaElement;
    detach(): HTMLMediaElement[];
    detach(element: HTMLMediaElement): HTMLMediaElement;
    protected monitorReceiver: () => Promise<void>;
    getReceiverStats(): Promise<VideoReceiverStats | undefined>;
    private stopObservingElement;
    protected handleAppVisibilityChanged(): Promise<void>;
    private readonly debouncedHandleResize;
    private updateVisibility;
    private updateDimensions;
    private getPixelDensity;
}
export interface ElementInfo {
    element: object;
    width(): number;
    height(): number;
    visible: boolean;
    pictureInPicture: boolean;
    visibilityChangedAt: number | undefined;
    handleResize?: () => void;
    handleVisibilityChanged?: () => void;
    observe(): void;
    stopObserving(): void;
}
