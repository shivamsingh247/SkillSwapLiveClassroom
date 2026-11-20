import type { CoreRoom } from '../CoreRoom';
import type { ExtensionContext, RoomApiProvider } from '../extensions';
import type { SimulationOptions } from '../types';
/**
 * Methods the `simulatedParticipants` extension adds to the room.
 * @experimental
 */
export interface SimulatedParticipantsRoomApi {
    /**
     * Allows to populate a room with simulated participants.
     * No actual connection to a server will be established, all state is
     * @experimental
     */
    simulateParticipants(options: SimulationOptions): Promise<void>;
}
/**
 * Fills a room with fake participants and dummy media without a server. A development tool;
 * the `video` extension must be installed when simulated participants publish video.
 * @experimental
 */
export declare const simulatedParticipants: {
    key: symbol;
    install(room: CoreRoom, ctx: ExtensionContext): RoomApiProvider<SimulatedParticipantsRoomApi>;
};
