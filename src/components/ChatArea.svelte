<script lang="ts">
    import {autoscroll} from "../lib/autoscroll.ts";
    import {store} from "../lib/p2p-store.svelte.ts";
    import type {Message} from "../lib/types/message.d.ts";
    import {formatTime} from "../lib/utils/index.ts";
    import forum from '../assets/svg/forum.svg';
    import arrow_upward from '../assets/svg/arrow_upward.svg';

    /** 聊天输入 */
    let chatInput = $state("");
    /** 发送中状态 */
    let sending = $state(false);
    /** 待发送文件 */
    let pendingFile: File | null = $state(null);
    /** 文件输入元素引用 */
    let fileInput: HTMLInputElement | undefined = $state(undefined);
    /** 是否可发送：未在发送中、有目标节点、有内容 */
    let canSend = $derived(!sending && !!store.chatPeer && (!!chatInput.trim() || !!pendingFile));

    /** 发送消息：文本和/或文件 */
    async function sendMessage() {
        if (!canSend) return;
        const hasText = chatInput.trim();
        const hasFile = pendingFile;
        sending = true;
        try {
            if (hasText) {
                await store.sendText(store.chatPeer, chatInput.trim());
                chatInput = "";
            }
            if (hasFile) {
                await store.sendFile(store.chatPeer, hasFile);
                pendingFile = null;
                if (fileInput) fileInput.value = "";
            }
        } catch (err) {
            store.addLog(`发送失败: ${err instanceof Error ? err.message : String(err)}`, "warn");
        } finally {
            sending = false;
        }
    }

    /** 处理文件选择：暂存文件，等待点击发送 */
    function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            pendingFile = input.files[0];
        } else {
            pendingFile = null;
        }
    }

    /** 处理键盘事件 */
    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }
</script>

<section class="flex-1 flex flex-col min-h-0">
    {#snippet emptyMsg(text: String)}
        <div class="hero h-full">
            <div class="hero-content text-center">
                <div>
                    <img alt="" class="size-16 mb-4 mx-auto opacity-30 brightness-0 invert"
                         src={forum.src}/>
                    <p class="text-base-content/40">{text}</p>
                </div>
            </div>
        </div>
    {/snippet}

    {#snippet msgContent(msg: Message)}
        {#if msg.type === "Text"}
            <p class="leading-normal">{msg.text}</p>
        {:else}
            <div class="flex items-center gap-2 mt-1">
                <span class="text-sm truncate max-w-50">{msg.fileName}</span>
                <span class="text-xs opacity-60">({(msg.fileSize / 1024).toFixed(1)} KB)</span>
                <a
                    href={URL.createObjectURL(msg.file)}
                    download={msg.fileName}
                    class="btn btn-xs btn-ghost"
                >
                    下载
                </a>
            </div>
        {/if}
    {/snippet}

    <!-- 聊天记录区域 -->
    <div class="flex-1 overflow-y-auto p-5 space-y-4" use:autoscroll={store.chatMessages.length}>
        {#if !store.chatPeer && store.status === "running"}
            {@render emptyMsg("从左侧选择一个已连接的节点开始聊天")}
        {:else if store.status !== "running"}
            {@render emptyMsg("启动节点以开始通信")}
        {:else if store.chatMessages.length === 0}
            {@render emptyMsg("暂无消息，发送一条开始聊天")}
        {:else}
            <!-- 消息列表 -->
            {#each store.chatMessages as msg (msg.timestamp)}
                {@const time = formatTime(msg.timestamp)}
                {#if msg.sender === store.peerId}
                    <div class="chat chat-end">
                        <div class="chat-image avatar avatar-placeholder">
                            <div class="bg-primary text-primary-content w-8 rounded-full">
                                <span class="text-xs">我</span>
                            </div>
                        </div>
                        <div class="chat-header uppercase tracking-widest">
                            本地节点
                            <time class="text-base-content/30 font-mono">{time}</time>
                        </div>
                        <div class="chat-bubble chat-bubble-primary">
                            {@render msgContent(msg)}
                        </div>
                    </div>
                {:else}
                    <div class="chat chat-start">
                        <div class="chat-image avatar avatar-placeholder">
                            <div class="bg-neutral text-neutral-content w-8 rounded-full">
                                <span class="text-xs">{msg.sender[0]}</span>
                            </div>
                        </div>
                        <div class="chat-header uppercase tracking-wider">
                            <span
                                class="truncate max-w-50 inline-block align-bottom">{msg.sender}</span>
                            <time class="text-base-content/30 font-mono">{time}</time>
                        </div>
                        <div class="chat-bubble">
                            {@render msgContent(msg)}
                        </div>
                    </div>
                {/if}
            {/each}
        {/if}
    </div>

    <!-- 聊天输入区域 -->
    <div class="p-4 bg-base-200 border-t border-base-300">
        <div
            class="card bg-base-100 border border-base-content/10 focus-within:border-white">
            <div class="card-body p-0">
                <!-- 上部：文本输入 -->
                <textarea
                    bind:value={chatInput}
                    class="w-full resize-none max-h-48 bg-transparent outline-none border-none text-base-content placeholder:text-base-content/40 px-4 pt-4 pb-2"
                    onkeydown={handleKeyDown}
                    autofocus
                    placeholder="⏎: Send; ⇧ + ⏎: Newline"
                    rows="3"
                ></textarea>
                <!-- 分割线 -->
                <div class="divider my-0"></div>
                <!-- 下部：文件选择 + 发送按钮 -->
                <div class="card-actions items-center justify-between px-2 pb-2">
                    <input
                        accept="*/*"
                        bind:this={fileInput}
                        class="file-input file-input-ghost"
                        onchange={handleFileChange}
                        type="file"
                    />
                    <button
                        class="btn btn-primary btn-circle"
                        disabled={!canSend}
                        onclick={sendMessage}
                    >
                        <img alt="发送" class="invert size-4" src={arrow_upward.src}/>
                    </button>
                </div>
            </div>
        </div>
    </div>
</section>
