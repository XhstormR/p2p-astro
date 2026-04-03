/**
 * libp2p 节点共享状态管理
 *
 * 集中管理节点实例、生命周期、节点、聊天协议等响应式状态。
 * 所有 UI 组件通过此 store 单例进行通信，实现低耦合。
 *
 * 聊天消息通过 gossipsub pubsub 协议转发，按 topic 隔离实现一对一通信。
 */
import type { PeerConnection, PeerStatus, TopicPeer } from "#/lib/types/index.d.ts";
import type { LogEntry, LogType } from "#/lib/types/log.d.ts";
import type { Message } from "#/lib/types/message.d.ts";
import { MessageMaker } from "#/lib/utils/MessageMaker.ts";
import { now } from "#/lib/utils/index.ts";
import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import { WebRTC } from "@multiformats/multiaddr-matcher";
import { createMyLibp2p, type MyLibp2p } from "./utils/p2p";

/** 二进制帧类型标记 */
const MSG_TEXT = 0x01;
const MSG_FILE = 0x02;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

class Libp2pStore {
    // ─── 节点核心状态 ───

    /** 节点实例 */
    libp2p: MyLibp2p | null = $state(null);
    /** 节点状态 */
    status: PeerStatus = $state("stopped");
    /** Peer ID */
    peerId = $state("");
    /** 监听地址（只重新赋值，不变异，使用 raw 避免深度代理开销） */
    multiaddrs = $state.raw<string[]>([]);
    /** 错误信息 */
    errorMsg = $state("");
    /** 节点启动时间（毫秒）*/
    startedAt: number = $state(0);

    // ─── 节点 ───

    /** 节点-连接树：每个已连接 peer 及其关联的远程地址（唯一数据源） */
    peerConnTree = $state.raw<PeerConnection[]>([]);

    // ─── 聊天 ───

    /** 当前订阅节点 Peer ID */
    selectedPeer = $state("");
    /** 消息变更版本号（触发 derived 重新计算） */
    #messageVersion = $state(0);
    /** 聊天消息列表（由 selectedPeer 和 messageVersion 自动派生） */
    chatMessages: Message[] = $derived.by(() => {
        this.#messageVersion;
        const messages = this.#messageMap.get(this.selectedPeer);
        return messages ? [...messages] : [];
    });

    // ─── 日志 ───

    /** 系统操作日志 */
    systemLogs = $state.raw<LogEntry[]>([]);
    /** 节点活动日志（发现、连接、断开） */
    peerLogs = $state.raw<LogEntry[]>([]);

    // ─── Topic Peer 追踪 ───

    /** 聊天 topic 的订阅者列表（peerId → topic 映射） */
    topicPeers = $state.raw<TopicPeer[]>([]);

    // ─── 内部状态（非响应式） ───

    /** 每个 peer 的消息存储（peer ID → 消息列表） */
    #messageMap = new Map<string, Message[]>();
    /** 已订阅的 gossipsub topic 集合 */
    #subscribedTopics = new Set<string>();
    /** 事件监听器生命周期控制 */
    #abortController: AbortController | null = null;
    /** topic peer 轮询定时器 */
    #topicPeerInterval: ReturnType<typeof setInterval> | null = null;

    // ─── 日志方法 ───

    addLog(msg: string, type: LogType = "info") {
        this.systemLogs = [...this.systemLogs, { timestamp: now(), msg, type }];
    }

    /** 添加节点活动日志 */
    addPeerLog(msg: string, type: LogType) {
        this.peerLogs = [...this.peerLogs, { timestamp: now(), msg, type }];
    }

    // ─── 节点辅助方法 ───

    /** 更新节点-连接树（唯一数据源，参考 index.js 的 updatePeerList 模式） */
    updateConnList() {
        if (!this.libp2p) return;
        this.peerConnTree = this.libp2p.getPeers().map(peerId => ({
            peerId: peerId.toString(),
            addrs: this.libp2p!.getConnections(peerId).map(c => c.remoteAddr.toString()),
        }));
    }

    /** 更新监听地址列表 */
    updateListeningAddrs() {
        if (!this.libp2p) return;
        this.multiaddrs = this.libp2p
            .getMultiaddrs()
            .filter(ma => WebRTC.matches(ma))
            .map(ma => ma.toString());
    }

    #refreshTopicPeers() {
        const entries: TopicPeer[] = [];
        for (const topic of this.libp2p!.services.pubsub.getTopics()) {
            const subscribers = this.libp2p!.services.pubsub.getSubscribers(topic);
            if (subscribers.length !== 0) {
                entries.push({ peerId: subscribers[0].toString(), topic });
            }
        }
        this.topicPeers = entries;
    }

    // ─── GossipSub Topic 管理 ───

    /**
     * 生成两个 peer 之间的聊天 topic
     * 将双方 Peer ID 排序后拼接，确保双方使用同一 topic
     */
    #chatTopicFor(remotePeer: string): string {
        const ids = [this.peerId, remotePeer].sort();
        return `chat/${ids[0]}/${ids[1]}`;
    }

    /** 订阅指定 peer 的聊天 topic */
    #subscribeChatTopic(remotePeer: string) {
        if (!this.libp2p) return;
        const topic = this.#chatTopicFor(remotePeer);
        if (this.#subscribedTopics.has(topic)) return;
        this.libp2p.services.pubsub.subscribe(topic);
        this.#subscribedTopics.add(topic);
        this.addLog(`已订阅 topic: ${topic}`);
    }

    /** 取消所有聊天 topic 订阅 */
    #unsubscribeAll() {
        if (!this.libp2p) return;
        for (const topic of this.#subscribedTopics) {
            this.libp2p.services.pubsub.unsubscribe(topic);
        }
        this.#subscribedTopics.clear();
    }

    // ─── 聊天消息处理 ───

    /** 向指定 peer 的消息列表追加一条消息 */
    #addPeerMessage(peer: string, message: Message) {
        const messages = this.#messageMap.get(peer);
        if (messages) {
            messages.push(message);
        } else {
            this.#messageMap.set(peer, [message]);
        }
        this.#messageVersion++;
    }

    /** 处理收到的 pubsub 消息 */
    #handlePubsubMessage(fromPeerId: string, raw: Uint8Array) {
        if (raw.length === 0) return;
        const type = raw[0];
        const payload = raw.subarray(1);

        let msg: Message;
        if (type === MSG_TEXT) {
            msg = MessageMaker.textMessage(fromPeerId, this.peerId, textDecoder.decode(payload));
            this.addLog(`收到来自 ${fromPeerId} 的文本消息`, "chat");
        } else if (type === MSG_FILE) {
            const blob = new Blob([payload.slice()]);
            const file = new File([blob], "received_file", {
                type: "application/octet-stream",
            });
            msg = MessageMaker.fileMessage(fromPeerId, this.peerId, file);
            this.addLog(`收到来自 ${fromPeerId} 的文件消息`, "chat");
        } else {
            this.addLog(`收到未知类型消息: type=0x${type.toString(16)}`, "warn");
            return;
        }

        this.#addPeerMessage(fromPeerId, msg);
        if (!this.selectedPeer) {
            this.selectedPeer = fromPeerId;
        }
    }

    /** 发送文本消息 */
    async sendText(peer: string, text: string) {
        if (!this.libp2p) throw new Error("节点未启动");
        this.#subscribeChatTopic(peer);
        const topic = this.#chatTopicFor(peer);
        const encoded = textEncoder.encode(text);
        const payload = new Uint8Array(1 + encoded.length);
        payload[0] = MSG_TEXT;
        payload.set(encoded, 1);
        await this.libp2p.services.pubsub.publish(topic, payload);
        this.#addPeerMessage(peer, MessageMaker.textMessage(this.peerId, peer, text));
    }

    /** 发送文件消息（直接传输原始二进制） */
    async sendFile(peer: string, file: File) {
        if (!this.libp2p) throw new Error("节点未启动");
        this.#subscribeChatTopic(peer);
        const topic = this.#chatTopicFor(peer);
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const payload = new Uint8Array(1 + fileBytes.length);
        payload[0] = MSG_FILE;
        payload.set(fileBytes, 1);
        await this.libp2p.services.pubsub.publish(topic, payload);
        this.#addPeerMessage(peer, MessageMaker.fileMessage(this.peerId, peer, file));
    }

    /** 选择订阅节点 */
    selectChatPeer(peer: string) {
        this.selectedPeer = peer;
        this.#subscribeChatTopic(peer);
        this.addLog(`已选择订阅节点: ${peer}`, "chat");
    }

    // ─── 连接 ───

    /** 连接到远程节点（支持 multiaddr 或 Peer ID） */
    async dial(addr: string) {
        if (!this.libp2p) return;
        const input = addr.trim();
        this.addLog(`正在连接: ${input}`);
        const signal = AbortSignal.timeout(10000);

        try {
            const target = input.startsWith("/") ? multiaddr(input) : peerIdFromString(input);
            const conn = await this.libp2p.dial(target, { signal });
            const remoteId = conn.remotePeer.toString();
            const transport = conn.remoteAddr.toString();

            try {
                const rtt = await this.libp2p.services.ping.ping(conn.remotePeer, {
                    signal,
                });
                this.addLog(`已连接: ${remoteId} via ${transport} (RTT: ${rtt}ms)`);
            } catch {
                this.addLog(`已连接: ${remoteId} via ${transport} (ping 失败)`, "warn");
            }
        } catch (err) {
            if (signal.aborted) {
                this.addLog(`连接超时: ${input}`, "warn");
            } else {
                this.addLog(`连接失败: ${err instanceof Error ? err.message : String(err)}`, "warn");
            }
            throw err;
        }
    }

    // ─── 节点生命周期 ───

    /** 启动 libp2p 节点 */
    async startNode() {
        if (this.libp2p) return;
        this.status = "starting";
        this.errorMsg = "";
        this.addLog("正在创建 libp2p 节点...");
        //localStorage.setItem("debug", "libp2p:*");

        try {
            this.libp2p = await createMyLibp2p();

            this.peerId = this.libp2p.peerId.toString();
            this.addLog(`节点已创建，Peer ID: ${this.peerId}`);

            // 使用 AbortController 统一管理所有事件监听器的生命周期
            this.#abortController = new AbortController();
            const { signal } = this.#abortController;

            // 监听 pubsub 消息
            this.libp2p.services.pubsub.addEventListener(
                "gossipsub:message",
                evt => {
                    const fromPeer = evt.detail.propagationSource.toString();
                    this.#handlePubsubMessage(fromPeer, evt.detail.msg.data);
                },
                { signal },
            );
            this.libp2p.services.pubsub.addEventListener(
                "subscription-change",
                _ => this.#refreshTopicPeers(),
                { signal },
            );
            this.addLog("GossipSub 消息监听已注册");

            // 监听节点发现事件
            this.libp2p.addEventListener(
                "peer:discovery",
                evt => {
                    const id = evt.detail.id.toString();
                    this.addPeerLog(`发现节点: ${id}`, "discovery");
                },
                { signal },
            );

            // 监听连接事件：仅日志 + 订阅聊天 topic（节点列表由 connection:open/close → updateConnList 维护）
            this.libp2p.addEventListener(
                "peer:connect",
                evt => {
                    const id = evt.detail.toString();
                    this.addPeerLog(`已连接: ${id}`, "connect");
                    this.#subscribeChatTopic(id);
                },
                { signal },
            );

            // 监听断开事件：仅日志
            this.libp2p.addEventListener(
                "peer:disconnect",
                evt => {
                    this.#refreshTopicPeers();
                    this.addPeerLog(`已断开: ${evt.detail.toString()}`, "disconnect");
                },
                { signal },
            );

            // 连接打开/关闭时更新活跃连接列表（参考 index.js 的 connection:open/close 模式）
            this.libp2p.addEventListener("connection:open", () => this.updateConnList(), {
                signal,
            });
            this.libp2p.addEventListener("connection:close", () => this.updateConnList(), {
                signal,
            });

            // 监听地址变更事件（参考 index.js 的 self:peer:update → 过滤 WebRTC 地址模式）
            this.libp2p.addEventListener("self:peer:update", () => this.updateListeningAddrs(), {
                signal,
            });

            // 启动节点
            await this.libp2p.start();
            this.status = "running";
            this.startedAt = Date.now();
            this.addLog("libp2p 节点已启动");
        } catch (err) {
            this.errorMsg = err instanceof Error ? err.message : String(err);
            this.addLog(`启动失败: ${this.errorMsg}`, "warn");
            console.error("libp2p 启动失败:", err);
            await this.stopNode();
            this.status = "error";
        }
    }

    /** 停止 libp2p 节点 */
    async stopNode() {
        if (!this.libp2p) return;
        this.addLog("正在停止节点...");
        try {
            // 清理定时器和事件监听器
            if (this.#topicPeerInterval) {
                clearInterval(this.#topicPeerInterval);
                this.#topicPeerInterval = null;
            }
            this.#abortController?.abort();
            this.#abortController = null;
            this.#unsubscribeAll();
            this.topicPeers = [];
            await this.libp2p.stop();
            this.libp2p = null;
            this.status = "stopped";
            this.peerId = "";
            this.selectedPeer = "";
            this.multiaddrs = [];
            this.peerConnTree = [];
            this.#messageMap.clear();
            this.startedAt = 0;
            this.addLog("节点已停止");
        } catch (err) {
            this.addLog(`停止失败: ${err instanceof Error ? err.message : String(err)}`, "warn");
        }
    }
}

/** 全局单例 */
export const store = new Libp2pStore();
