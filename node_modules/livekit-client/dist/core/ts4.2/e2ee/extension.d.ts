import type { Disposable, RoomApiProvider, SlotProvider } from '../room/extensions';
import type { BaseE2EEManager } from './E2eeManager';
/**
 * Methods the `e2ee` extension adds to the room.
 * @experimental
 */
export interface E2eeRoomApi {
    /**
     * @experimental
     */
    setE2EEEnabled(enabled: boolean): Promise<void>;
}
/** @experimental */
export declare const e2ee: import("../exports").ConfigurableExtension<RoomApiProvider<E2eeRoomApi> & Partial<SlotProvider<"e2eeManager">> & Disposable & {
    manager: BaseE2EEManager | undefined;
}, import("./types").E2EEManagerOptions | {
    e2eeManager: BaseE2EEManager;
}, readonly [
]>;
