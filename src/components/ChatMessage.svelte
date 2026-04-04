<script lang="ts">
    import type { Message } from "../lib/types/message.d.ts";
    import { throttleButton } from "../lib/actions/throttle-button.svelte.ts";
    import { copyToClipboard, download, formatFileSize, formatTime, isValidUrl } from "../lib/utils/index.ts";
    import { snackBar } from "#/lib/snack-bar.svelte.ts";

    interface Props {
        msg: Message;
    }

    let { msg }: Props = $props();

    /** 文本消息是否为有效 URL */
    let isUrl = $derived(msg.type === "Text" && isValidUrl(msg.text));

    async function onCopy() {
        if (msg.type === "Text") {
            let ok = await copyToClipboard(msg.text);
            if (ok) snackBar.info("已复制到剪贴板");
            else snackBar.error("复制失败，请手动复制");
        }
    }

    function onDownload() {
        if (msg.type === "File") {
            download(msg.data.value() as BlobPart, msg.fileName, msg.fileType);
            snackBar.info("已开始下载");
        }
    }
</script>

<!-- 消息内容 -->
{#if msg.type === "Text"}
    {#if isUrl}
        <a href={msg.text} target="_blank" rel="noopener noreferrer" class="link break-all link-hover">
            {msg.text}
        </a>
    {:else}
        <p class="leading-relaxed wrap-break-word whitespace-pre-wrap">{msg.text}</p>
    {/if}
{:else if msg.type === "File"}
    <p class="leading-relaxed">
        <span class="max-w-50 truncate">{msg.fileName}</span>
        <span class="opacity-60">({formatFileSize(msg.fileSize)})</span>
    </p>
{/if}

<!-- 分割线 -->
<div class="divider m-0"></div>

<!-- 操作按钮 + 时间 -->
<div class="flex items-center gap-1">
    {#if msg.type === "Text"}
        <div class="has-enabled:tooltip has-enabled:tooltip-bottom" data-tip="复制文本">
            <button class="btn btn-circle btn-ghost btn-info" onclick={onCopy} {@attach throttleButton()}>
                <span class="material-symbols">content_copy</span>
            </button>
        </div>
    {:else if msg.type === "File"}
        <div class="has-enabled:tooltip has-enabled:tooltip-bottom" data-tip="下载文件">
            <button class="btn btn-circle btn-ghost btn-info" onclick={onDownload} {@attach throttleButton()}>
                <span class="material-symbols">download</span>
            </button>
        </div>
    {/if}
    <time class="ml-auto opacity-50">{formatTime(msg.timestamp)}</time>
</div>
