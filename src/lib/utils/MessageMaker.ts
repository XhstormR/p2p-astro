import type { FileMessage, MessageStatus, TextMessage } from "#/lib/types/message.d.ts";
import { now } from "#/lib/utils/index.ts";

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

    static fileMessage(
        sender: string,
        receiver: string,
        file: File,
        status: MessageStatus = "Queued",
        timestamp: number = now(),
    ): FileMessage {
        return {
            type: "File",
            sender: sender,
            receiver: receiver,
            file: file,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            status: status,
            timestamp: timestamp,
        };
    }
}
