/** 系统日志类型 */
export type SystemLogType = "info" | "warn" | "chat";

/** 节点日志类型 */
export type PeerLogType = "discovery" | "connect" | "disconnect";

/** 所有日志类型（UI 渲染用） */
export type LogType = SystemLogType | PeerLogType;

/** 日志条目 */
export type LogEntry = {
    timestamp: number;
    msg: string;
    type: LogType;
};
