import type { RpcInvocationData } from '.';
import { RpcError } from '.';
import type TypedPromise from '../../utils/TypedPromise';
import type { CoreRoom } from '../CoreRoom';
import type { ConnectionHooks, DataPacketOwner, ExtensionContext, LocalParticipantApiProvider, RoomApiProvider } from '../extensions';
import type { PerformRpcParams } from './utils';
/**
 * Methods the `rpc` extension adds to the room.
 * @experimental
 */
export interface RpcRoomApi {
    /**
     * Establishes the participant as a receiver for calls of the specified RPC method.
     *
     * @param method - The name of the indicated RPC method
     * @param handler - Will be invoked when an RPC request for this method is received
     * @returns A promise that resolves when the method is successfully registered
     * @throws {Error} If a handler for this method is already registered (must call unregisterRpcMethod first)
     *
     * @example
     * ```typescript
     * room.localParticipant?.registerRpcMethod(
     *   'greet',
     *   async (data: RpcInvocationData) => {
     *     console.log(`Received greeting from ${data.callerIdentity}: ${data.payload}`);
     *     return `Hello, ${data.callerIdentity}!`;
     *   }
     * );
     * ```
     *
     * The handler should return a Promise that resolves to a string.
     * If unable to respond within `responseTimeout`, the request will result in an error on the caller's side.
     *
     * You may throw errors of type `RpcError` with a string `message` in the handler,
     * and they will be received on the caller's side with the message intact.
     * Other errors thrown in your handler will not be transmitted as-is, and will instead arrive to the caller as `1500` ("Application Error").
     */
    registerRpcMethod(method: string, handler: (data: RpcInvocationData) => Promise<string>): void;
    /**
     * Unregisters a previously registered RPC method.
     *
     * @param method - The name of the RPC method to unregister
     */
    unregisterRpcMethod(method: string): void;
}
/**
 * Methods the `rpc` extension adds to the local participant.
 * @experimental
 */
export interface RpcLocalParticipantApi {
    /**
     * Initiate an RPC call to a remote participant
     * @param params - Parameters for initiating the RPC call, see {@link PerformRpcParams}
     * @returns A promise that resolves with the response payload or rejects with an error.
     * @throws Error on failure. Details in `message`.
     */
    performRpc(params: PerformRpcParams): TypedPromise<string, RpcError>;
}
/**
 * RPC over the room (`performRpc`, `registerRpcMethod`). Requires {@link dataStreams}.
 * @experimental
 */
export declare const rpc: {
    key: symbol;
    requires: readonly [
        import("../extensions").ConfigurableExtension<RoomApiProvider<import("../data-stream/extension").DataStreamRoomApi> & LocalParticipantApiProvider<import("../data-stream/extension").DataStreamLocalParticipantApi> & import("../extensions").SlotProvider<"byteStreamOpener"> & DataPacketOwner & import("../extensions").EngineHooks & ConnectionHooks & {
            incoming: import("../data-stream/incoming/IncomingDataStreamManager").default;
            outgoing: import("../data-stream/outgoing/OutgoingDataStreamManager").default;
        }, import("../../options").RoomDataStreamOptions, readonly [
        ]>
    ];
    install(room: CoreRoom, ctx: ExtensionContext): RoomApiProvider<RpcRoomApi> & LocalParticipantApiProvider<RpcLocalParticipantApi> & DataPacketOwner & ConnectionHooks;
};
