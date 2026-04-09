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
import { now } from "#/lib/utils/index.ts";
import { decodeMessage, encodeMessage } from "#/lib/utils/message.ts";
import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import { WebRTC } from "@multiformats/multiaddr-matcher";
import { eventBus } from "./event-bus.svelte";
import { snackBar } from "./snack-bar.svelte";
import { createMyLibp2p, type MyLibp2p } from "./utils/p2p";

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

    // ─── 日志 ───

    /** 系统操作日志 */
    systemLogs: LogEntry[] = $state([]);
    /** 节点活动日志（发现、连接、断开） */
    peerLogs: LogEntry[] = $state([]);

    // ─── Topic Peer 追踪 ───

    /** 聊天 topic 的订阅者列表（peerId → topic 映射） */
    topicPeers = $state.raw<TopicPeer[]>([]);

    // ─── 内部状态（非响应式） ───

    /** 已订阅的 gossipsub topic 集合 */
    #subscribedTopics = new Set<string>();
    /** 事件监听器生命周期控制 */
    #abortController: AbortController | null = null;
    // ─── 日志方法 ───

    addLog(msg: string, type: LogType = "info") {
        this.systemLogs.push({ timestamp: now(), msg, type });
    }

    /** 添加节点活动日志 */
    addPeerLog(msg: string, type: LogType) {
        this.peerLogs.push({ timestamp: now(), msg, type });
    }

    // ─── 节点辅助方法 ───

    /** 更新节点-连接树（唯一数据源，参考 index.js 的 updatePeerList 模式） */
    #updateConnList() {
        if (!this.libp2p) return;
        this.peerConnTree = this.libp2p.getPeers().map(peerId => ({
            peerId: peerId.toString(),
            addrs: this.libp2p!.getConnections(peerId).map(c => c.remoteAddr.toString()),
        }));
    }

    /** 更新监听地址列表 */
    #updateListeningAddrs() {
        if (!this.libp2p) return;
        this.multiaddrs = this.libp2p
            .getMultiaddrs()
            .filter(ma => WebRTC.matches(ma))
            .map(ma => ma.toString());
    }

    #updateTopicPeers() {
        const known = new Map(this.topicPeers.map(tp => [tp.peerId, { ...tp, subscribed: false }]));
        for (const t of this.libp2p!.services.pubsub.getTopics()) {
            for (const p of this.libp2p!.services.pubsub.getSubscribers(t)) {
                const id = p.toString();
                known.set(id, { peerId: id, topic: t, subscribed: true });
            }
        }
        this.topicPeers = [...known.values()];
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

    /** 发布消息到指定 peer 的聊天 topic（供 messageService 调用） */
    async publishToChatTopic(peer: string, message: Message) {
        if (!this.libp2p) throw new Error("节点未启动");
        this.#subscribeChatTopic(peer);
        await this.libp2p.services.pubsub.publish(this.#chatTopicFor(peer), encodeMessage(message));
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
                const rtt = await this.libp2p.services.ping.ping(conn.remotePeer, { signal });
                this.addLog(`已连接: ${remoteId} via ${transport} (RTT: ${rtt}ms)`);
            } catch {
                this.addLog(`已连接: ${remoteId} via ${transport} (ping 失败)`, "warn");
            }
            snackBar.info(`拨号成功: ${remoteId}`);
        } catch (err) {
            const msg = signal.aborted
                ? `连接超时: ${input}`
                : `连接失败: ${err instanceof Error ? err.message : String(err)}`;
            this.addLog(msg, "warn");
            snackBar.error(msg);
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

        try {
            this.libp2p = await createMyLibp2p();

            this.peerId = this.libp2p.peerId.toString();
            this.addLog(`节点已创建，Peer ID: ${this.peerId}`);

            // 使用 AbortController 统一管理所有事件监听器的生命周期
            this.#abortController = new AbortController();
            const signal = this.#abortController?.signal;

            // 监听 pubsub 消息：通过 eventBus 广播，由 messageService 响应式处理
            this.libp2p.services.pubsub.addEventListener(
                "gossipsub:message",
                evt => {
                    const msg = decodeMessage(evt.detail.msg.data);
                    eventBus.emitEvent("onConnectionReceiveData", { message: msg });
                },
                { signal },
            );
            this.libp2p.services.pubsub.addEventListener(
                "subscription-change",
                () => this.#updateTopicPeers(),
                { signal },
            );
            this.addLog("GossipSub 消息监听已注册");

            // 监听节点发现事件
            this.libp2p.addEventListener(
                "peer:discovery",
                evt => {
                    const peerId = evt.detail.id.toString();
                    this.addPeerLog(`发现节点: ${peerId}`, "discovery");
                },
                { signal },
            );

            // 监听连接事件：日志 + 订阅聊天 topic + eventBus 广播
            this.libp2p.addEventListener(
                "peer:connect",
                evt => {
                    const peerId = evt.detail.toString();
                    this.addPeerLog(`已连接: ${peerId}`, "connect");
                    this.#subscribeChatTopic(peerId);
                    snackBar.info(`节点已连接: ${peerId}`);
                },
                { signal },
            );

            // 监听断开事件
            this.libp2p.addEventListener(
                "peer:disconnect",
                evt => {
                    const peerId = evt.detail.toString();
                    this.addPeerLog(`已断开: ${peerId}`, "disconnect");
                    snackBar.error(`节点已断开: ${peerId}`);
                },
                { signal },
            );

            this.libp2p.addEventListener("connection:open", () => this.#updateConnList(), { signal });
            this.libp2p.addEventListener(
                "connection:close",
                () => {
                    this.#updateConnList();
                    this.#updateTopicPeers();
                },
                { signal },
            );
            this.libp2p.addEventListener("self:peer:update", () => this.#updateListeningAddrs(), { signal });

            // 启动节点
            await this.libp2p.start();
            this.status = "running";
            this.startedAt = Date.now();
            this.addLog("libp2p 节点已启动");
        } catch (err) {
            this.errorMsg = err instanceof Error ? err.message : String(err);
            this.addLog(`启动失败: ${this.errorMsg}`, "warn");
            snackBar.error(`节点启动失败: ${this.errorMsg}`);
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
            // 清理事件监听器
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
            this.startedAt = 0;
            this.addLog("节点已停止");
        } catch (err) {
            this.addLog(`停止失败: ${err instanceof Error ? err.message : String(err)}`, "warn");
        }
    }
}

/** 全局单例 */
export const store = new Libp2pStore();
