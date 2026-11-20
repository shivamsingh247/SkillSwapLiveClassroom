import type { CoreRoom } from '../CoreRoom';
import type { ConnectionHooks, EngineHooks, ExtensionContext, LocalParticipantApiProvider, ParticipantHooks, SyncStateProvider } from '../extensions';
import LocalDataTrack from './LocalDataTrack';
import IncomingDataTrackManager from './incoming/IncomingDataTrackManager';
import OutgoingDataTrackManager from './outgoing/OutgoingDataTrackManager';
import type { DataTrackOptions } from './outgoing/types';
/**
 * Methods the `dataTracks` extension adds to the local participant.
 * @experimental
 */
export interface DataTrackLocalParticipantApi {
    /** Publishes a data track.
     *
     * Returns the published data track if successful. Use {@link LocalDataTrack#tryPush}
     * to send data frames on the track.
     */
    publishDataTrack(options: DataTrackOptions): Promise<LocalDataTrack>;
}
/**
 * Data tracks: continuous unreliable streams for real-time data (`publishDataTrack`,
 * `RemoteParticipant.dataTracks`, `RoomEvent.DataTrackPublished`).
 * @experimental
 */
export declare const dataTracks: {
    key: symbol;
    install(room: CoreRoom, ctx: ExtensionContext): LocalParticipantApiProvider<DataTrackLocalParticipantApi> & EngineHooks & ConnectionHooks & ParticipantHooks & SyncStateProvider & {
        incoming: IncomingDataTrackManager;
        outgoing: OutgoingDataTrackManager;
    };
};
//# sourceMappingURL=extension.d.ts.map