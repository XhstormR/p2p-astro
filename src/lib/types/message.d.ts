import { Binary } from "bson";

interface BaseMessage {
    readonly type: MessageType;
    status: MessageStatus;

    readonly sender: string;
    readonly receiver: string;
    readonly timestamp: number;
}

export interface TextMessage extends BaseMessage {
    readonly type: "Text";

    readonly text: string;
}

export interface FileMessage extends BaseMessage {
    readonly type: "File";

    readonly data: Binary;
    readonly fileName: string;
    readonly fileType: string;
    readonly fileSize: number;
}

export type MessageType = "Text" | "File";
export type MessageStatus = "Success" | "Failure" | "Queued";
export type Message = TextMessage | FileMessage;
