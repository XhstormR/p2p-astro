<script lang="ts">
    import encodeQR from 'qr';
    import {Tooltip} from "melt/builders";

    interface Props {
        addr: string;
        onCopy: (text: string, e: MouseEvent) => void;
    }

    let {addr, onCopy}: Props = $props();

    const tooltip = new Tooltip({
        openDelay: 0,
        closeDelay: 0,
        closeOnPointerDown: false,
        floatingConfig: {
            computePosition: {
                strategy: "fixed",
                placement: "right",
            },
        },
    });
</script>

<li>
    <button
        {...tooltip.trigger}
        class="cursor-copy w-full text-left"
        onclick={(e) => onCopy(addr, e)}
    >
        <span class="truncate block text-base-content/60 text-xs">{addr}</span>
    </button>
    <div {...tooltip.content} class="w-48 h-48 p-0 bg-white rounded-lg not-[&:popover-open]:hidden!">
        <div {...tooltip.arrow}></div>
        <img alt="QR Code" class="w-full h-full" src="data:image/svg+xml,{encodeQR(addr, 'svg')}"/>
    </div>
</li>
