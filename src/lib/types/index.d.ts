/** 节点状态 */
export type PeerStatus = "stopped" | "starting" | "running" | "error";

/** 节点连接信息 */
export type PeerConnection = {
    peerId: string;
    addrs: string[];
};

/** 聊天 topic 的订阅者（peerId → topic 映射） */
export type TopicPeer = {
    peerId: string;
    topic: string;
};
