/** 节点状态 */
export type PeerStatus = "stopped" | "starting" | "running" | "error";

/** 聊天 topic 的订阅者（peerId → topic 映射，含订阅状态） */
export type TopicPeer = {
    peerId: string;
    topic: string;
    subscribed: boolean;
};
