import type { CoreRoom } from '../CoreRoom';
import type { DataPacketOwner, ExtensionContext, LocalParticipantApiProvider } from '../extensions';
import type { ChatMessage, SendTextOptions } from '../types';
/**
 * Methods the legacy `chat` extension adds to the local participant.
 * @experimental
 */
export interface ChatLocalParticipantApi {
    /** @deprecated Consider migrating to {@link sendText} */
    sendChatMessage(text: string, options?: SendTextOptions): Promise<ChatMessage>;
    /** @deprecated Consider migrating to {@link sendText} */
    editChatMessage(editText: string, originalMessage: ChatMessage): Promise<ChatMessage>;
}
/**
 * The legacy chat message packets (`sendChatMessage`, `RoomEvent.ChatMessage`). Superseded by
 * text streams; the full `Room` keeps it, the core entry does not offer it.
 */
export declare const chat: {
    key: symbol;
    install(room: CoreRoom, _ctx: ExtensionContext): LocalParticipantApiProvider<ChatLocalParticipantApi> & DataPacketOwner;
};
//# sourceMappingURL=extension.d.ts.map
