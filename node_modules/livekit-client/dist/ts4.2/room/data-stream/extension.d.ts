import type { RoomDataStreamOptions } from '../../options';
import type { ConnectionHooks, DataPacketOwner, EngineHooks, LocalParticipantApiProvider, RoomApiProvider, SlotProvider } from '../extensions';
import type { ByteStreamInfo, SendBytesOptions, SendFileOptions, SendTextOptions, StreamBytesOptions, StreamTextOptions, TextStreamInfo } from '../types';
import IncomingDataStreamManager from './incoming/IncomingDataStreamManager';
import type { ByteStreamHandler, TextStreamHandler } from './incoming/StreamReader';
import OutgoingDataStreamManager from './outgoing/OutgoingDataStreamManager';
import type { ByteStreamWriter, TextStreamWriter } from './outgoing/StreamWriter';
/**
 * Methods the `dataStreams` extension adds to the room.
 * @experimental
 */
export interface DataStreamRoomApi {
    registerTextStreamHandler(topic: string, callback: TextStreamHandler): void;
    unregisterTextStreamHandler(topic: string): void;
    registerByteStreamHandler(topic: string, callback: ByteStreamHandler): void;
    unregisterByteStreamHandler(topic: string): void;
}
/**
 * Methods the `dataStreams` extension adds to the local participant.
 * @experimental
 */
export interface DataStreamLocalParticipantApi {
    /**
     * Sends the given string to participants in the room via the data channel.
     * For longer messages, consider using {@link streamText} instead.
     *
     * @param text The text payload
     * @param options.topic Topic identifier used to route the stream to appropriate handlers.
     */
    sendText(text: string, options?: SendTextOptions): Promise<TextStreamInfo>;
    /**
     * Creates a new TextStreamWriter which can be used to stream text incrementally
     * to participants in the room via the data channel.
     *
     * @param options.topic Topic identifier used to route the stream to appropriate handlers.
     *
     * @internal
     * @experimental CAUTION, might get removed in a minor release
     */
    streamText(options?: StreamTextOptions): Promise<TextStreamWriter>;
    /** Send a File to all participants in the room via the data channel.
     * @param file The File object payload
     * @param options.topic Topic identifier used to route the stream to appropriate handlers.
     * @param options.onProgress A callback function used to monitor the upload progress percentage.
     */
    sendFile(file: File, options?: SendFileOptions): Promise<{
        id: string;
    }>;
    /**
     * Sends the given bytes to participants in the room via the data channel.
     * For files, consider using {@link sendFile}; for longer/incremental payloads, {@link streamBytes}.
     *
     * @param bytes The byte payload
     * @param options.topic Topic identifier used to route the stream to appropriate handlers.
     */
    sendBytes(bytes: Uint8Array, options?: SendBytesOptions): Promise<ByteStreamInfo>;
    /**
     * Stream bytes incrementally to participants in the room via the data channel.
     * For sending files, consider using {@link sendFile} instead.
     *
     * @param options.topic Topic identifier used to route the stream to appropriate handlers.
     */
    streamBytes(options?: StreamBytesOptions): Promise<ByteStreamWriter>;
}
/**
 * Text and byte streams (`sendText`, `sendFile`, `registerTextStreamHandler`, ...).
 * @experimental
 */
export declare const dataStreams: import("../extensions").ConfigurableExtension<RoomApiProvider<DataStreamRoomApi> & LocalParticipantApiProvider<DataStreamLocalParticipantApi> & SlotProvider<"byteStreamOpener"> & DataPacketOwner & EngineHooks & ConnectionHooks & {
    incoming: IncomingDataStreamManager;
    outgoing: OutgoingDataStreamManager;
}, RoomDataStreamOptions, readonly [
]>;
//# sourceMappingURL=extension.d.ts.map
