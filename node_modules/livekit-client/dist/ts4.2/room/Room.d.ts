import type { RoomOptions } from '../options';
import { CoreRoom } from './CoreRoom';
export type { RoomEventCallbacks } from './CoreRoom';
export { ConnectionState } from './CoreRoom';
/**
 * In LiveKit, a room is the logical grouping for a list of participants.
 * Participants in a room can publish tracks, and subscribe to others' tracks.
 *
 * a Room fires [[RoomEvent | RoomEvents]].
 *
 * This is the full-featured room: `CoreRoom` with every extension installed.
 */
export declare class Room extends CoreRoom {
    /**
     * Creates a new Room, the primary construct for a LiveKit session.
     * @param options
     */
    constructor(options?: RoomOptions);
}
export default Room;
//# sourceMappingURL=Room.d.ts.map
