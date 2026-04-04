<script lang="ts">
    import { store } from "../lib/p2p-store.svelte.ts";
    import ChatMessage from "./ChatMessage.svelte";
    import { dropZone } from "../lib/actions/drop-zone.svelte.ts";

    /** 聊天输入 */
    let chatInput = $state("");
    /** 发送中状态 */
    let sending = $state(false);
    /** 待发送文件 */
    let pendingFile: File | null = $state(null);
    /** 文件输入元素引用 */
    let fileInput: HTMLInputElement | undefined = $state(undefined);
    /** 是否可发送：未在发送中、有目标节点、有内容 */
    let canSend = $derived(!sending && !!store.selectedPeer && (!!chatInput.trim() || !!pendingFile));

    /** 发送消息：文本和/或文件 */
    async function sendMessage() {
        if (!canSend) return;
        const text = chatInput.trim();
        const file = pendingFile;
        sending = true;
        try {
            if (text) {
                await store.sendText(store.selectedPeer, text);
                chatInput = "";
            }
            if (file) {
                await store.sendFile(store.selectedPeer, file);
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

{#snippet emptyMsg(text: String)}
    <div class="hero h-full">
        <div class="hero-content text-center">
            <div>
                <span class="material-symbols mx-auto mb-4 text-6xl opacity-15">forum</span>
                <p class="text-base-content/25">{text}</p>
            </div>
        </div>
    </div>
{/snippet}

<section class="flex min-h-0 flex-1 flex-col" {@attach dropZone(files => console.log(files))}>
    <!-- 聊天头部 -->
    {#if store.selectedPeer}
        <div class="glass-card mx-5 mt-4 flex items-center gap-3 rounded-xl p-3">
            <div class="avatar avatar-placeholder shrink-0">
                <div
                    class="w-9 rounded-full bg-linear-to-br from-accent to-primary text-primary-content shadow-lg"
                >
                    <span class="font-bold">P</span>
                </div>
            </div>
            <div class="min-w-0">
                <h3 class="truncate font-bold tracking-wide">{store.selectedPeer}</h3>
            </div>
        </div>
    {/if}

    <!-- 聊天记录区域 -->
    <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {#if !store.selectedPeer && store.status === "running"}
            {@render emptyMsg("从左侧选择一个订阅节点开始聊天")}
        {:else if store.status !== "running"}
            {@render emptyMsg("启动节点以开始通信")}
        {:else if store.chatMessages.length === 0}
            {@render emptyMsg("暂无消息，发送一条开始聊天")}
        {:else}
            <!-- 消息列表 -->
            {#each store.chatMessages as msg (msg.timestamp)}
                {@const isLocal = msg.sender === store.peerId}
                <div class="chat {isLocal ? 'chat-end' : 'chat-start'}">
                    <div class="chat-header">
                        {#if isLocal}
                            本地节点
                        {:else}
                            <span class="inline-block max-w-50 truncate align-bottom">{msg.sender}</span>
                        {/if}
                    </div>
                    <div class="chat-bubble {isLocal ? 'chat-bubble-primary' : ''}">
                        <ChatMessage {msg} />
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <!-- 聊天输入区域 -->
    <div class="p-4">
        <div class="glass-card flex flex-col rounded-2xl focus-within:border-white">
            <textarea
                autofocus
                bind:value={chatInput}
                class="field-sizing-content max-h-[4lh] w-full resize-none border-none bg-transparent px-4 py-3 outline-none"
                onkeydown={handleKeyDown}
                placeholder="⏎: Send; ⇧ + ⏎: Newline"
                rows="1"
            ></textarea>
            <div class="divider m-0"></div>
            <div class="flex items-center justify-between px-3 pb-3">
                <input
                    accept="*/*"
                    bind:this={fileInput}
                    class="file-input file-input-ghost bg-transparent"
                    onchange={handleFileChange}
                    type="file"
                />
                <button
                    class="btn btn-circle shrink-0 shadow-none btn-primary active:scale-90"
                    disabled={!canSend}
                    onclick={sendMessage}
                >
                    <span class="material-symbols">arrow_upward</span>
                </button>
            </div>
        </div>
    </div>
</section>
