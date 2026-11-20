import { DeferrableMap } from '../../utils/deferrable-map';
import type RemoteDataTrack from '../data-track/RemoteDataTrack';
import RemoteTrackPublication from '../track/RemoteTrackPublication';
import { Track } from '../track/Track';
import Participant from './Participant';
export default class RemoteParticipant extends Participant {
    audioTrackPublications: Map<string, RemoteTrackPublication>;
    videoTrackPublications: Map<string, RemoteTrackPublication>;
    trackPublications: Map<string, RemoteTrackPublication>;
    /** A map of data track name to the corresponding {@link RemoteDataTrack}.
     * @example
     * // An already existing data track:
     * const track = remoteParticipant.dataTracks.get("data track name");
     * // Wait for a data track which will be published soon:
     * const track = await remoteParticipant.dataTracks.getDeferred("data track name"); */
    dataTracks: DeferrableMap<RemoteDataTrack['info']['name'], RemoteDataTrack>;
    private volumeMap;
    private audioOutput?;
    protected get logContext(): {
        remoteParticipantID: string;
        remoteParticipant: string;
    };
    protected addTrackPublication(publication: RemoteTrackPublication): void;
    getTrackPublication(source: Track.Source): RemoteTrackPublication | undefined;
    getTrackPublicationByName(name: string): RemoteTrackPublication | undefined;
    /**
     * sets the volume on the participant's audio track
     * by default, this affects the microphone publication
     * a different source can be passed in as a second argument
     * if no track exists the volume will be applied when the microphone track is added
     */
    setVolume(volume: number, source?: Track.Source.Microphone | Track.Source.ScreenShareAudio): void;
    /**
     * gets the volume on the participant's microphone track
     */
    getVolume(source?: Track.Source.Microphone | Track.Source.ScreenShareAudio): number | undefined;
}
