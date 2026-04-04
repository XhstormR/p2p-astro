import type { FileMessage, Message, MessageStatus, TextMessage } from "#/lib/types/message.d.ts";
import { now } from "#/lib/utils/index.ts";
import { Binary, deserialize, serialize } from "bson";

export const encodeMessage = (msg: Message) => serialize(msg);
export const decodeMessage = (raw: Uint8Array) => deserialize(raw) as Message;

export class MessageMaker {
    static textMessage(
        sender: string,
        receiver: string,
        text: string,
        status: MessageStatus = "Queued",
        timestamp: number = now(),
    ): TextMessage {
        return {
            type: "Text",
            sender: sender,
            receiver: receiver,
            text: text,
            status: status,
            timestamp: timestamp,
        };
    }

    static async fileMessage(
        sender: string,
        receiver: string,
        file: File,
        status: MessageStatus = "Queued",
        timestamp: number = now(),
    ): Promise<FileMessage> {
        return {
            type: "File",
            sender: sender,
            receiver: receiver,
            data: new Binary(await file.bytes()),
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            status: status,
            timestamp: timestamp,
        };
    }
}
