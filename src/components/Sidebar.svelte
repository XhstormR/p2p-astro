<script lang="ts">
    import { store } from "../lib/p2p-store.svelte.ts";
    import PeerTree from "./PeerTree.svelte";
    import autorenew from "../assets/svg/autorenew.svg";
    import link from "../assets/svg/link.svg";
    import lan from "../assets/svg/lan.svg";
    import call from "../assets/svg/call.svg";
    import forum from "../assets/svg/forum.svg";
    import public_ from "../assets/svg/public.svg";

    /** 连接地址输入 */
    let dialAddr = $state("");
    /** 连接中状态 */
    let dialing = $state(false);
    /** 运行时长（秒），每秒刷新 */
    let uptimeSeconds = $state(0);
    const hours = $derived(Math.floor((uptimeSeconds % 86400) / 3600));
    const minutes = $derived(Math.floor((uptimeSeconds % 3600) / 60));
    const seconds = $derived(uptimeSeconds % 60);

    /** 按钮文本 */
    const buttonLabel = $derived(
        store.status === "running" ? "停止节点" : store.status === "starting" ? "启动中..." : "启动节点",
    );

    /** 组件卸载时通过 store 完整清理节点 */
    $effect(() => {
        if (!store.libp2p) return;
        return () => {
            store.stopNode().catch(console.error);
        };
    });

    $effect(() => {
        if (!store.startedAt) {
            uptimeSeconds = 0;
            return;
        }
        // 立即计算一次，避免初始显示 00:00:00 闪烁
        uptimeSeconds = Math.floor((Date.now() - store.startedAt) / 1000);
        const timer = setInterval(() => {
            uptimeSeconds = Math.floor((Date.now() - store.startedAt) / 1000);
        }, 1000);
        return () => clearInterval(timer);
    });

    /** 连接到远程节点 */
    async function dialPeer() {
        if (!dialAddr.trim() || dialing) return;
        dialing = true;
        try {
            await store.dial(dialAddr.trim());
            dialAddr = "";
        } finally {
            dialing = false;
        }
    }

    /** 节点启停控制 */
    function toggleNode() {
        if (store.status === "running") {
            store.stopNode();
        } else if (store.status === "stopped" || store.status === "error") {
            store.startNode();
        }
    }
</script>

{#snippet statusDot(color: string, ping: boolean)}
    <span class="inline-grid *:[grid-area:1/1]">
        {#if ping}<span class="status status-{color} animate-ping"></span>{/if}
        <span class="status status-{color}"></span>
    </span>
{/snippet}

<aside class="flex h-full flex-col">
    <div class="flex-1 space-y-4 overflow-y-auto p-4">
        <!-- 启停按钮 -->
        <button
            class="btn btn-block {store.status === 'running' ? 'btn-error' : 'btn-primary'}"
            disabled={store.status === "starting"}
            onclick={toggleNode}
        >
            <img alt="" src={autorenew.src} />
            {buttonLabel}
        </button>

        <!-- 错误信息 -->
        {#if store.errorMsg}
            <div role="alert" class="alert rounded-none alert-soft px-3 py-2 alert-error">
                {store.errorMsg}
            </div>
        {/if}

        <!-- 状态 -->
        <div class="glass-card stats w-full stats-horizontal">
            <div class="stat place-items-center">
                <div class="stat-title">运行状态</div>
                <div class="stat-value">
                    {#if store.status === "running"}
                        <span class="badge gap-1.5 badge-soft badge-success">
                            {@render statusDot("success", true)} 运行中
                        </span>
                    {:else if store.status === "starting"}
                        <span class="badge gap-1.5 badge-soft badge-warning">
                            {@render statusDot("warning", true)} 启动中
                        </span>
                    {:else if store.status === "error"}
                        <span class="badge gap-1.5 badge-soft badge-error">
                            {@render statusDot("error", true)} 异常
                        </span>
                    {:else}
                        <span class="badge gap-1.5 badge-soft">
                            {@render statusDot("neutral", false)} 已停止
                        </span>
                    {/if}
                </div>
            </div>
            <div class="stat place-items-center">
                <div class="stat-title">运行时间</div>
                <div class="stat-value">
                    <span class="countdown font-mono text-lg">
                        <span style="--value:{hours}; --digits: 2;">{hours}</span>
                        :
                        <span style="--value:{minutes}; --digits: 2;">{minutes}</span>
                        :
                        <span style="--value:{seconds}; --digits: 2;">{seconds}</span>
                    </span>
                </div>
            </div>
        </div>

        <!-- 统计 -->
        <div class="glass-card stats w-full stats-horizontal">
            <div class="stat place-items-center">
                <div class="stat-title">已监听地址</div>
                <div class="stat-value text-accent">{store.multiaddrs.length}</div>
            </div>
            <div class="stat place-items-center">
                <div class="stat-title">已连接节点</div>
                <div class="stat-value text-success">{store.peerConnTree.length}</div>
            </div>
        </div>

        <!-- 拨号 -->
        <div class="glass-card card">
            <div class="card-body">
                <h2 class="card-title tracking-widest">
                    <img alt="" class="size-4 invert" src={call.src} />
                    拨号
                </h2>
                <div class="join w-full">
                    <input
                        bind:value={dialAddr}
                        class="input join-item min-w-0 flex-1"
                        disabled={store.status !== "running" || dialing}
                        onkeydown={e => e.key === "Enter" && dialPeer()}
                        placeholder="/p2p/Qm..."
                        type="text"
                    />
                    <button
                        class="btn join-item btn-primary"
                        disabled={store.status !== "running" || dialing || !dialAddr.trim()}
                        onclick={dialPeer}
                    >
                        <img alt="" class="invert" src={link.src} />
                    </button>
                </div>
            </div>
        </div>

        <!-- 订阅节点（由 topic peers 驱动） -->
        <div class="glass-card card">
            <div class="card-body">
                <h2 class="card-title tracking-widest">
                    <img alt="" class="size-4 invert" src={forum.src} />
                    订阅节点
                </h2>
                {#if store.topicPeers.length > 0}
                    <ul class="menu w-full p-0">
                        {#each store.topicPeers as tp (tp.peerId)}
                            <li>
                                <button
                                    class="truncate font-mono text-sm tracking-tight"
                                    class:menu-active={store.selectedPeer === tp.peerId}
                                    onclick={() => store.selectChatPeer(tp.peerId)}
                                >
                                    {@render statusDot("success", true)}
                                    <span class="truncate">{tp.peerId}</span>
                                </button>
                            </li>
                        {/each}
                    </ul>
                {:else if store.status === "running"}
                    <p class="text-center">暂无订阅节点</p>
                {:else}
                    <p class="text-center">节点未启动</p>
                {/if}
            </div>
        </div>

        <!-- 本地节点 -->
        <div class="glass-card card">
            <div class="card-body">
                <h2 class="card-title tracking-widest">
                    <img alt="" class="size-4 invert" src={lan.src} />
                    本地节点
                </h2>
                {#if store.multiaddrs.length > 0}
                    <ul class="menu w-full p-0">
                        <PeerTree peerId={store.peerId} addrs={store.multiaddrs} />
                    </ul>
                {:else if store.status === "running"}
                    <p class="text-center">暂无监听的节点</p>
                {:else}
                    <p class="text-center">节点未启动</p>
                {/if}
            </div>
        </div>

        <!-- 远程节点 -->
        <div class="glass-card card">
            <div class="card-body">
                <h2 class="card-title tracking-widest">
                    <img alt="" class="size-4 invert" src={public_.src} />
                    远程节点
                </h2>
                {#if store.peerConnTree.length > 0}
                    <ul class="menu w-full p-0">
                        {#each store.peerConnTree as peer (peer.peerId)}
                            <PeerTree peerId={peer.peerId} addrs={peer.addrs} />
                        {/each}
                    </ul>
                {:else if store.status === "running"}
                    <p class="text-center">暂无连接的节点</p>
                {:else}
                    <p class="text-center">节点未启动</p>
                {/if}
            </div>
        </div>
    </div>
</aside>
