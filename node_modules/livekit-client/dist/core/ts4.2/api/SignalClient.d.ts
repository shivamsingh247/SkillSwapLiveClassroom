import { ClientInfo_Capability, SessionDescription } from '@livekit/protocol';
export interface SignalOptions {
    autoSubscribe: boolean;
    adaptiveStream?: boolean;
    disableIceLite?: boolean;
    subscriberAllowPause?: boolean;
    clientInfoCapabilities?: ClientInfo_Capability[];
    maxRetries: number;
    e2eeEnabled: boolean;
    websocketTimeout: number;
}
export declare enum SignalConnectionState {
    CONNECTING = 0,
    CONNECTED = 1,
    RECONNECTING = 2,
    DISCONNECTING = 3,
    DISCONNECTED = 4
}
export declare function toProtoSessionDescription(rsd: RTCSessionDescription | RTCSessionDescriptionInit, id?: number): SessionDescription;
