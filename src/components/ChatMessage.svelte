<script lang="ts">
    import type { Message } from "../lib/types/message.d.ts";
    import { throttleButton } from "../lib/actions/throttle-button.svelte.ts";
    import { copyToClipboard, download, formatTime, isValidUrl } from "../lib/utils/index.ts";

    interface Props {
        msg: Message;
    }

    let { msg }: Props = $props();

    /** 文本消息是否为有效 URL */
    let isUrl = $derived(msg.type === "Text" && isValidUrl(msg.text));

    /** 格式化文件大小 */
    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function onCopy() {
        if (msg.type === "Text") copyToClipboard(msg.text);
    }

    function onDownload() {
        if (msg.type === "File") download(msg.file, msg.fileName, msg.fileType);
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
{:else}
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
        <button class="btn btn-ghost btn-xs" {@attach throttleButton()} onclick={onCopy} title="复制">
            <span class="material-symbols text-lg">content_copy</span>
        </button>
    {:else}
        <button class="btn btn-ghost btn-xs" {@attach throttleButton()} onclick={onDownload} title="下载">
            <span class="material-symbols text-lg">download</span>
        </button>
    {/if}
    <time class="ml-auto text-xs opacity-50">{formatTime(msg.timestamp)}</time>
</div>
