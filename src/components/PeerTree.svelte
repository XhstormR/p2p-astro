<script lang="ts">
    import encodeQR from "qr";
    import { Tooltip } from "bits-ui";
    import { copyToClipboard } from "#/lib/utils";
    import { store } from "#/lib/p2p-store.svelte";

    interface Props {
        /** 节点 Peer ID */
        peerId: string;
        /** 关联地址列表 */
        addrs: string[];
    }

    let { peerId, addrs }: Props = $props();

    const tooltipProviderProps: Tooltip.ProviderProps = {
        delayDuration: 0,
        skipDelayDuration: 0,
        disableCloseOnTriggerClick: true,
    };

    /** 复制文本到剪贴板，通过 store 记录日志 */
    async function copyText(text: string, e: MouseEvent) {
        e.stopPropagation();
        const ok = await copyToClipboard(text);
        store.addLog(ok ? "已复制到剪贴板" : "复制失败，请手动复制", ok ? "info" : "warn");
    }
</script>

<li>
    <details class="group" open>
        <summary class="cursor-zoom-in group-open:cursor-zoom-out">
            <span class="inline-grid *:[grid-area:1/1]">
                <span class="status animate-ping status-success"></span>
                <span class="status status-success"></span>
            </span>
            <span class="flex-1 truncate text-left font-bold tracking-tight">{peerId}</span>
        </summary>

        <ul>
            <Tooltip.Provider {...tooltipProviderProps}>
                {#each addrs as addr (addr)}
                    <li>
                        <Tooltip.Root>
                            <Tooltip.Trigger
                                class="w-full cursor-copy text-left"
                                onclick={e => copyText(addr, e)}
                            >
                                <span class="block truncate text-base-content/60">{addr}</span>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content
                                    side="right"
                                    sideOffset={8}
                                    strategy="fixed"
                                    class="z-50 h-48 w-48 rounded-lg bg-white p-0"
                                >
                                    <Tooltip.Arrow />
                                    <img
                                        alt="QR Code"
                                        class="h-full w-full"
                                        src="data:image/svg+xml,{encodeQR(addr, 'svg')}"
                                    />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>
                    </li>
                {/each}
            </Tooltip.Provider>
        </ul>
    </details>
</li>
