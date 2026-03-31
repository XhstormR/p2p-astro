/** 系统日志类型 */
export type SystemLogType = "info" | "warn" | "chat";

/** 节点日志类型 */
export type PeerLogType = "discovery" | "connect" | "disconnect";

/** 系统日志条目 */
export type SystemLogEntry = {
    timestamp: number;
    msg: string;
    type: SystemLogType;
};

/** 节点日志条目 */
export type PeerLogEntry = {
    timestamp: number;
    msg: string;
    type: PeerLogType;
};
