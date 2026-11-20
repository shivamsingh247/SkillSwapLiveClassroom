import type { CoreRoom } from '../CoreRoom';
import type { ExtensionContext, LocalParticipantApiProvider } from '../extensions';
import type { RpcRoomApi } from './extension';
/**
 * The deprecated rpc methods on the local participant.
 * @experimental
 */
export interface RpcLegacyLocalParticipantApi {
    /**
     * @deprecated use `room.registerRpcMethod` instead
     */
    registerRpcMethod: RpcRoomApi['registerRpcMethod'];
    /**
     * @deprecated use `room.unregisterRpcMethod` instead
     */
    unregisterRpcMethod: RpcRoomApi['unregisterRpcMethod'];
}
/**
 * `localParticipant.registerRpcMethod` and `unregisterRpcMethod`, which forward to the room.
 * Superseded by the room methods; the full `Room` keeps them, the core entry does not offer them.
 */
export declare const rpcLegacy: {
    key: symbol;
    requires: readonly [{
        key: symbol;
        requires: readonly [import("../extensions").ConfigurableExtension<import("../extensions").RoomApiProvider<import("../..").DataStreamRoomApi> & LocalParticipantApiProvider<import("../..").DataStreamLocalParticipantApi> & import("../extensions").SlotProvider<"byteStreamOpener"> & import("../extensions").DataPacketOwner & import("../extensions").EngineHooks & import("../extensions").ConnectionHooks & {
            incoming: import("../data-stream/incoming/IncomingDataStreamManager").default;
            outgoing: import("../data-stream/outgoing/OutgoingDataStreamManager").default;
        }, import("../..").RoomDataStreamOptions, readonly []>];
        install(room: CoreRoom, ctx: ExtensionContext): import("../extensions").RoomApiProvider<RpcRoomApi> & LocalParticipantApiProvider<import("./extension").RpcLocalParticipantApi> & import("../extensions").DataPacketOwner & import("../extensions").ConnectionHooks;
    }];
    install(_room: CoreRoom, ctx: ExtensionContext): LocalParticipantApiProvider<RpcLegacyLocalParticipantApi>;
};
//# sourceMappingURL=legacyExtension.d.ts.map