/**
 * libp2p 节点共享状态管理
 *
 * 集中管理节点实例、生命周期、节点、聊天协议等响应式状态。
 * 所有 UI 组件通过此 store 单例进行通信，实现低耦合。
 *
 * 聊天消息通过 gossipsub pubsub 协议转发，按 topic 隔离实现一对一通信。
 */
import type { PeerStatus, TopicPeer } from "#/lib/types/index.d.ts";
import type { Message } from "#/lib/types/message.d.ts";
import { decodeMessage, encodeMessage } from "#/lib/utils/message.ts";
import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import { WebRTC } from "@multiformats/multiaddr-matcher";
import { SvelteMap } from "svelte/reactivity";
import { eventBus } from "./event-bus.svelte";
import { logHub } from "./log-hub.svelte";
import { snackBar } from "./snack-bar.svelte";
import { createMyLibp2p, type MyLibp2p } from "./utils/p2p";

class P2pStore {
    // ─── 节点核心状态 ───

    /** 节点实例 */
    libp2p = $state<MyLibp2p | null>(null);
    /** 节点状态 */
    status = $state<PeerStatus>("stopped");
    /** 错误信息 */
    errorMsg = $state("");
    /** 节点启动时间（毫秒）*/
    startedAt = $state<number>(0);

    // ─── 节点 ───

    selectedPeer = $state("");

    localPeer = $state("");
    localPeerAddresses = $state<string[]>([]);

    remotePeers = new SvelteMap<string, string[]>();

    /** 聊天 topic 的订阅者列表（peerId → topic 映射） */
    topicPeers = $state<TopicPeer[]>([]);

    // ─── 内部状态（非响应式） ───

    /** 事件监听器生命周期控制 */
    #abortController: AbortController | null = null;

    /** 选择订阅节点 */
    selectChatPeer(peer: string) {
        this.selectedPeer = peer;
        logHub.addLog(`已选择订阅节点: ${peer}`, "chat");
    }

    /** 发布消息到指定 peer 的聊天 topic */
    async publishToChatTopic(peer: string, message: Message) {
        if (!this.libp2p) throw new Error("节点未启动");
        await this.libp2p.services.pubsub.publish(this.#chatTopicFor(peer), encodeMessage(message));
    }

    /** 连接到远程节点（支持 multiaddr 或 Peer ID） */
    async dial(addr: string) {
        if (!this.libp2p) return;
        const input = addr.trim();
        logHub.addLog(`正在连接: ${input}`);
        const signal = AbortSignal.timeout(10000);

        try {
            const target = input.startsWith("/") ? multiaddr(input) : peerIdFromString(input);
            const conn = await this.libp2p.dial(target, { signal });
            const remoteId = conn.remotePeer.toString();
            const transport = conn.remoteAddr.toString();

            try {
                const rtt = await this.libp2p.services.ping.ping(conn.remotePeer, { signal });
                logHub.addLog(`已连接: ${remoteId} via ${transport} (RTT: ${rtt}ms)`);
            } catch {
                logHub.addLog(`已连接: ${remoteId} via ${transport} (ping 失败)`, "warn");
            }
            snackBar.info(`拨号成功: ${remoteId}`);
        } catch (err) {
            const msg = signal.aborted
                ? `连接超时: ${input}`
                : `连接失败: ${err instanceof Error ? err.message : String(err)}`;
            logHub.addLog(msg, "warn");
            snackBar.error(msg);
            throw err;
        }
    }

    async startNode() {
        if (this.libp2p) return;
        this.status = "starting";
        this.errorMsg = "";
        logHub.addLog("正在创建 libp2p 节点...");

        try {
            this.libp2p = await createMyLibp2p();
            logHub.addLog(`节点已创建，Peer ID: ${this.libp2p.peerId.toString()}`);

            this.#abortController = new AbortController();
            let signal = this.#abortController.signal;

            this.libp2p.addEventListener(
                "start",
                evt => {
                    this.status = "running";
                    this.startedAt = Date.now();
                    logHub.addLog("libp2p 节点已启动");
                },
                { signal },
            );
            this.libp2p.addEventListener(
                "stop",
                evt => {
                    this.topicPeers = [];
                    this.localPeerAddresses = [];
                    this.status = "stopped";
                    this.selectedPeer = "";
                    this.startedAt = 0;
                    this.remotePeers.clear();
                    this.#abortController?.abort();
                    this.#abortController = null;
                    this.libp2p = null;
                    logHub.addLog("节点已停止");
                },
                { signal },
            );
            this.libp2p.addEventListener(
                "peer:connect",
                evt => {
                    const peerId = evt.detail.toString();
                    this.remotePeers.getOrInsert(peerId, []);
                    this.#subscribeChatTopic(peerId);
                    logHub.addPeerLog(`已连接: ${peerId}`, "connect");
                    snackBar.info(`节点已连接: ${peerId}`);
                },
                { signal },
            );
            this.libp2p.addEventListener(
                "peer:disconnect",
                evt => {
                    const peerId = evt.detail.toString();
                    this.remotePeers.delete(peerId);
                    logHub.addPeerLog(`已断开: ${peerId}`, "disconnect");
                    snackBar.error(`节点已断开: ${peerId}`);
                },
                { signal },
            );
            this.libp2p.addEventListener(
                "peer:discovery",
                evt => {
                    let peerId = evt.detail.id.toString();
                    logHub.addPeerLog(`发现节点: ${peerId}`, "discovery");
                },
                { signal },
            );
            this.libp2p.addEventListener(
                "self:peer:update",
                evt => {
                    this.localPeer = evt.detail.peer.id.toString();
                    this.localPeerAddresses = evt.detail.peer.addresses // Alternative: Libp2p.getMultiaddrs
                        .map(o => o.multiaddr)
                        .filter(o => WebRTC.matches(o))
                        .map(o => `${o.toString()}/p2p/${this.localPeer}`);
                },
                { signal },
            );
            this.libp2p.addEventListener(
                "connection:open",
                evt => {
                    let remotePeer = evt.detail.remotePeer.toString();
                    let remoteAddr = evt.detail.remoteAddr.toString();
                    let addresses = this.remotePeers.getOrInsert(remotePeer, []);
                    this.remotePeers.set(remotePeer, [...addresses, remoteAddr]);
                },
                { signal },
            );
            this.libp2p.addEventListener(
                "connection:close",
                evt => {
                    this.#updateTopicPeers();
                },
                { signal },
            );
            this.libp2p.services.pubsub.addEventListener(
                "subscription-change",
                evt => {
                    this.#updateTopicPeers();
                },
                { signal },
            );
            this.libp2p.services.pubsub.addEventListener(
                "gossipsub:message",
                evt => {
                    eventBus.emitEvent("onConnectionReceiveData", {
                        message: decodeMessage(evt.detail.msg.data),
                    });
                },
                { signal },
            );

            await this.libp2p.start();
        } catch (err) {
            this.errorMsg = err instanceof Error ? err.message : String(err);
            logHub.addLog(`启动失败: ${this.errorMsg}`, "warn");
            snackBar.error(`节点启动失败: ${this.errorMsg}`);
            console.error("libp2p 启动失败:", err);
            await this.stopNode();
            this.status = "error";
        }
    }

    async stopNode() {
        if (!this.libp2p) return;
        try {
            logHub.addLog("正在停止节点...");
            await this.libp2p.stop();
        } catch (err) {
            logHub.addLog(`停止失败: ${err instanceof Error ? err.message : String(err)}`, "warn");
        }
    }

    #updateTopicPeers() {
        if (!this.libp2p) return;
        const known = new Map(this.topicPeers.map(tp => [tp.peerId, { ...tp, subscribed: false }]));
        for (const topic of this.libp2p.services.pubsub.getTopics()) {
            for (const p of this.libp2p.services.pubsub.getSubscribers(topic)) {
                const id = p.toString();
                known.set(id, { peerId: id, topic, subscribed: true });
            }
        }
        this.topicPeers = [...known.values()];
    }

    /** 订阅指定 peer 的聊天 topic */
    #subscribeChatTopic(remotePeer: string) {
        if (!this.libp2p) return;
        const topic = this.#chatTopicFor(remotePeer);
        this.libp2p.services.pubsub.subscribe(topic);
        logHub.addLog(`已订阅 topic: ${topic}`);
    }

    /**
     * 生成两个 peer 之间的聊天 topic
     * 将双方 Peer ID 排序后拼接，确保双方使用同一 topic
     */
    #chatTopicFor(remotePeer: string): string {
        const ids = [this.localPeer, remotePeer].sort();
        return `chat/${ids[0]}/${ids[1]}`;
    }
}

export const p2pStore = new P2pStore();
