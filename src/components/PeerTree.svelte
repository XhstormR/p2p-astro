<script lang="ts">
    import {copyToClipboard} from "../lib/utils/index.ts";
    import {store} from "../lib/p2p-store.svelte.ts";
    import AddrItem from "./AddrItem.svelte";

    interface Props {
        /** 节点 Peer ID */
        peerId: string;
        /** 关联地址列表 */
        addrs: string[];
        /** 是否高亮（当前选中） */
        active?: boolean;
        /** 点击 summary 时的回调 */
        onselect?: () => void;
    }

    let {peerId, addrs, active = false, onselect}: Props = $props();

    /** 复制文本到剪贴板，通过 store 记录日志 */
    async function copyText(text: string, e: MouseEvent) {
        e.stopPropagation();
        const ok = await copyToClipboard(text);
        store.addLog(ok ? "已复制到剪贴板" : "复制失败，请手动复制", ok ? "info" : "warn");
    }

</script>

<li>
    <details open>
        <summary
            class:menu-active={active}
            onclick={onselect}
        >
            <span class="inline-grid *:[grid-area:1/1]">
                <span class="status status-success animate-ping"></span>
                <span class="status status-success"></span>
            </span>
            <button class="font-bold truncate tracking-tight flex-1 cursor-copy text-left"
                    onclick={(e) => copyText(peerId, e)}>{peerId}</button>
        </summary>

        <ul>
            {#if addrs.length > 0}
                {#each addrs as addr (addr)}
                    <AddrItem {addr} onCopy={copyText} />
                {/each}
            {:else}
                <li class="disabled"><span class="text-base-content/40 text-sm">暂无监听地址</span>
                </li>
            {/if}
        </ul>
    </details>
</li>
