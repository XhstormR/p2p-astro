import type { FileMessage, MessageStatus, TextMessage } from "#/lib/types/message.d.ts";

export function now(): number {
    return Date.now() + Math.random() + Math.random();
}

/** 将时间戳格式化为本地时间字符串 */
export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
}

/** 复制文本到剪贴板，返回是否成功 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

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
