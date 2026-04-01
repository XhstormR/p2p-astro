/** 日志类型 */
export type LogType = "info" | "warn" | "chat" | "discovery" | "connect" | "disconnect";

/** 日志条目 */
export type LogEntry = {
    timestamp: number;
    msg: string;
    type: LogType;
};
