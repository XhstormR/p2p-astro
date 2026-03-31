/**
 * Svelte action：当内容变化时自动滚动到底部
 * 仅当用户已在底部附近时才自动滚动，避免打断历史浏览
 *
 * 用法：<div use:autoscroll={triggerValue}>...</div>
 * triggerValue 变化时触发滚动检测
 */
export function autoscroll(node: HTMLElement, _trigger?: unknown) {
    /** 判断是否在底部附近（阈值 80px） */
    function isNearBottom(): boolean {
        return node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    }

    /** 仅当在底部时滚动到最新内容 */
    function scrollIfNeeded() {
        if (isNearBottom()) {
            node.scrollTop = node.scrollHeight;
        }
    }

    // 使用 MutationObserver 监听子节点变化，自动触发滚动检测
    const observer = new MutationObserver(scrollIfNeeded);
    observer.observe(node, { childList: true, subtree: true });

    return {
        update(_newTrigger?: unknown) {
            // trigger 值变化时也检测一次
            scrollIfNeeded();
        },
        destroy() {
            observer.disconnect();
        },
    };
}
