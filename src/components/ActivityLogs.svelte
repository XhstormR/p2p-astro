<script lang="ts">
    import { autoscroll } from "../lib/autoscroll.ts";
    import { store } from "../lib/p2p-store.svelte.ts";
    import terminal from "../assets/svg/terminal.svg";
    import assignment from "../assets/svg/assignment.svg";
    import type { LogEntry, LogType } from "../lib/types/log.d.ts";
    import { formatTime } from "../lib/utils/index.ts";

    const colorMap: Record<LogType, string> = {
        warn: "text-secondary",
        chat: "text-info",
        info: "text-primary",
        discovery: "text-accent",
        connect: "text-success",
        disconnect: "text-warning",
    };

    const labelMap: Record<LogType, string> = {
        warn: "WARN",
        chat: "CHAT",
        info: "INFO",
        discovery: "DISC",
        connect: "CONN",
        disconnect: "LOST",
    };
</script>

{#snippet logList(logs: LogEntry[], emptyText: String)}
    <div class="h-full overflow-y-auto font-mono leading-relaxed" use:autoscroll={logs.length}>
        {#if logs.length === 0}
            <div class="py-4 text-center text-base-content/20">{emptyText}</div>
        {:else}
            <div class="space-y-0.5 px-2">
                {#each logs as log (log.timestamp)}
                    <div class="flex items-start gap-3">
                        <span class="shrink-0 text-accent/50">[{formatTime(log.timestamp)}]</span>
                        <span class="{colorMap[log.type]} shrink-0 font-bold">{labelMap[log.type]}</span>
                        <span class="break-all text-base-content/50">{log.msg}</span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{/snippet}

<section class="glass-panel h-[30vh] border-t border-white/20">
    <div class="tabs-border tabs h-full">
        <!-- 系统日志标签 -->
        <label class="tab tracking-wider has-checked:text-primary">
            <input type="radio" name="activity_logs_tabs" checked />
            <img alt="" class="me-1 size-3.5 opacity-60 invert" src={terminal.src} />
            系统日志
        </label>
        <div class="tab-content bg-transparent p-2">
            {@render logList(store.logs, "点击「启动节点」开始")}
        </div>

        <!-- 节点日志标签 -->
        <label class="tab tracking-wider has-checked:text-primary">
            <input type="radio" name="activity_logs_tabs" />
            <img alt="" class="me-1 size-3.5 opacity-60 invert" src={assignment.src} />
            节点日志
        </label>
        <div class="tab-content bg-transparent p-2">
            {@render logList(store.peerLogs, "暂无节点活动")}
        </div>
    </div>
</section>
