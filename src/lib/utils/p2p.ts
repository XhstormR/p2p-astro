/**
 * libp2p 浏览器节点工厂
 *
 * 传输层：WebSockets（连接 relay）+ WebRTC（浏览器 P2P）+ Circuit Relay（NAT 穿透 / 信令）
 * 流程：浏览器通过 WS 连接公共 relay 节点，获取 /p2p-circuit/webrtc 地址，
 *       对方浏览器通过该地址完成 SDP 握手后建立直连 WebRTC 数据通道。
 */
import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { identify, identifyPush } from "@libp2p/identify";
import { ping } from "@libp2p/ping";
import { gossipsub } from "@libp2p/gossipsub";
import { delegatedRoutingV1HttpApiClient } from "@helia/delegated-routing-v1-http-api-client";

/** 从 createMyLibp2p 返回类型推导出 Libp2p */
export type MyLibp2p = Awaited<ReturnType<typeof createMyLibp2p>>;

export function createMyLibp2p() {
    return createLibp2p({
        // 禁止自动启动
        start: false,
        addresses: {
            listen: [
                // 通过 relay 获取可被拨号的中继地址
                "/p2p-circuit",
                // 接受入站 WebRTC 连接
                "/webrtc",
            ],
        },
        transports: [webSockets(), webRTC(), circuitRelayTransport()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        connectionGater: {
            // 允许所有地址拨号（浏览器 P2P 场景需要通过 relay 中继）
            denyDialMultiaddr: () => false,
        },
        services: {
            identify: identify(),
            identifyPush: identifyPush(),
            ping: ping(),
            pubsub: gossipsub(),
            // 委托路由：通过 HTTP API 实现 ContentRouting 和 PeerRouting
            delegatedRouting: delegatedRoutingV1HttpApiClient({
                url: "https://delegated-ipfs.dev",
                filterProtocols: ["transport-bitswap", "unknown", "transport-ipfs-gateway-http"],
                filterAddrs: ["webtransport", "webrtc-direct", "wss"],
            }),
        },
    });
}
