<script lang="ts">
    import {store} from "../lib/p2p-store.svelte.ts";
    import PeerTree from "./PeerTree.svelte";
    import autorenew from '../assets/svg/autorenew.svg';

    /** 组件卸载时通过 store 完整清理节点 */
    $effect(() => {
        if (!store.libp2p) return;
        return () => {
            store.stopNode().catch(console.error);
        };
    });

    /** 连接地址输入 */
    let dialAddr = $state("");
    /** 连接中状态 */
    let dialing = $state(false);

    /** 连接到远程节点 */
    async function dialPeer() {
        if (!dialAddr.trim() || dialing) return;
        dialing = true;
        try {
            await store.dial(dialAddr.trim());
            dialAddr = "";
        } catch {
            /* store.dial 已记录日志 */
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

    /** 按钮文本 */
    const buttonLabel = $derived(
        store.status === "running" ? "停止节点" :
            store.status === "starting" ? "启动中..." : "启动节点"
    );
</script>

{#snippet statusDot(color: String, ping: Boolean)}
    <span class="inline-grid *:[grid-area:1/1]">
        {#if ping}<span class="status status-{color} animate-ping"></span>{/if}
        <span class="status status-{color}"></span>
    </span>
{/snippet}

<aside class="flex flex-col h-full">
    <!-- 导航栏：品牌 + 状态 -->
    <div class="navbar">
        <div class="navbar-start">
            <span class="text-lg font-bold tracking-widest">P2P</span>
        </div>
        <div class="navbar-end">
            {#if store.status === "running"}
                <span class="badge badge-soft badge-success gap-1.5">
                    {@render statusDot("success", true)} 运行中
                </span>
            {:else if store.status === "starting"}
                <span class="badge badge-soft badge-warning gap-1.5">
                    {@render statusDot("warning", true)} 启动中
                </span>
            {:else if store.status === "error"}
                <span class="badge badge-soft badge-error gap-1.5">
                    {@render statusDot("error", true)} 异常
                </span>
            {:else}
                <span class="badge badge-soft gap-1.5">
                    {@render statusDot("neutral", false)} 已停止
                </span>
            {/if}
        </div>
    </div>

    <!-- 启停按钮 -->
    <div class="px-4 py-3">
        <button
            class="btn btn-block {store.status === 'running' ? 'btn-error' : 'btn-primary'}"
            disabled={store.status === "starting"}
            onclick={toggleNode}
        >
            <img alt="" class="invert" src={autorenew.src}/>
            {buttonLabel}
        </button>
    </div>

    <!-- 错误信息 -->
    {#if store.errorMsg}
        <div role="alert" class="alert alert-error alert-soft py-2 px-3 rounded-none">
            {store.errorMsg}
        </div>
    {/if}

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- 统计 -->
        <div class="stats stats-horizontal w-full bg-neutral text-neutral-content">
            <div class="stat place-items-center">
                <div class="stat-title">已监听地址</div>
                <div class="stat-value">{store.multiaddrs.length}</div>
            </div>
            <div class="stat place-items-center">
                <div class="stat-title">已连接节点</div>
                <div class="stat-value">{store.peerConnTree.length}</div>
            </div>
        </div>

        <!-- 拨号 -->
        <div class="card bg-neutral text-neutral-content">
            <div class="card-body">
                <h2 class="card-title tracking-widest">拨号</h2>
                <div class="join w-full">
                    <input
                        bind:value={dialAddr}
                        class="input join-item flex-1 min-w-0"
                        disabled={store.status !== "running" || dialing}
                        onkeydown={(e) => e.key === "Enter" && dialPeer()}
                        placeholder="远程节点地址"
                        type="text"
                    />
                    <button
                        class="btn btn-primary join-item"
                        disabled={store.status !== "running" || dialing || !dialAddr.trim()}
                        onclick={dialPeer}
                    >
                        {dialing ? "..." : "连接"}
                    </button>
                </div>
            </div>
        </div>

        <!-- 本地节点 -->
        <div class="card bg-neutral text-neutral-content">
            <div class="card-body">
                <h2 class="card-title tracking-widest">本地节点</h2>
                {#if store.peerId}
                    <ul class="menu w-full p-0">
                        <PeerTree peerId={store.peerId} addrs={store.multiaddrs}/>
                    </ul>
                {:else}
                    <p class="text-base-content/40 text-center">节点未启动</p>
                {/if}
            </div>
        </div>

        <!-- 远程节点 -->
        <div class="card bg-neutral text-neutral-content">
            <div class="card-body">
                <h2 class="card-title tracking-widest">远程节点</h2>
                {#if store.peerConnTree.length > 0}
                    <ul class="menu w-full p-0">
                        {#each store.peerConnTree as peer (peer.peerId)}
                            <PeerTree
                                peerId={peer.peerId}
                                addrs={peer.addrs}
                                active={store.chatPeer === peer.peerId}
                                onselect={() => store.selectChatPeer(peer.peerId)}
                            />
                        {/each}
                    </ul>
                {:else if store.status === "running"}
                    <p class="text-base-content/40 text-center">暂无已连接的节点</p>
                {:else}
                    <p class="text-base-content/40 text-center">节点未启动</p>
                {/if}
            </div>
        </div>
    </div>
</aside>
