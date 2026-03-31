/** 节点状态 */
export type PeerStatus = "stopped" | "starting" | "running" | "error";

/** 节点连接信息 */
export type PeerConnection = {
    peerId: string;
    addrs: string[];
};
