import type { Message } from "#/lib/types/message";

export type EventTypeMap = {
    onMessageChanged: { peer: string; messages: Message[] };

    onConnectionConnected: { peer: string };
    onConnectionReceiveData: { message: Message };
    onConnectionDisconnected: { peer: string };
};
