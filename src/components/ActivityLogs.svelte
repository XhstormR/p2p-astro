<script lang="ts">
    import {autoscroll} from "../lib/autoscroll.ts";
    import {store} from "../lib/p2p-store.svelte.ts";
    import terminal from '../assets/svg/terminal.svg';
    import assignment from '../assets/svg/assignment.svg';
    import type {SystemLogType} from "../lib/types/log.d.ts";
    import {formatTime} from "../lib/utils/index.ts";

    /** 日志类型 → badge 颜色 */
    function logBadgeColor(type: SystemLogType): string {
        switch (type) {
            case "warn":
                return "badge-error";
            case "chat":
                return "badge-info";
            default:
                return "badge-accent";
        }
    }
</script>

<section class="h-[30vh] bg-base-200 p-4">
    <div class="tabs tabs-lift h-full">
        <!-- 系统日志标签 -->
        <label class="tab has-checked:bg-neutral has-checked:text-neutral-content">
            <input type="radio" name="activity_logs_tabs" checked />
            <img alt="" class="me-2 invert" src={terminal.src}/>
            系统日志
        </label>
        <div class="tab-content bg-neutral text-neutral-content border-base-300 p-2">
            <div class="h-full overflow-y-auto font-mono" use:autoscroll={store.logs.length}>
                {#if store.logs.length === 0}
                    <div class="text-base-content/40 text-center py-4">点击「启动节点」开始</div>
                {:else}
                    <ul class="list p-1">
                        {#each store.logs as log (log.timestamp)}
                            <li class="list-row py-0.5 px-1.5 gap-3 items-start min-w-0">
                                <span class="text-base-content/30 min-w-22.5 shrink-0">[{formatTime(log.timestamp)}]</span>
                                <span class="badge badge-soft shrink-0 {logBadgeColor(log.type)}">{log.type.toUpperCase()}</span>
                                <span class="text-base-content/70 leading-snug break-all list-col-grow">{log.msg}</span>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>

        <!-- 节点日志标签 -->
        <label class="tab has-checked:bg-neutral has-checked:text-neutral-content">
            <input type="radio" name="activity_logs_tabs" />
            <img alt="" class="me-2 invert" src={assignment.src}/>
            节点日志
        </label>
        <div class="tab-content bg-neutral text-neutral-content border-base-300 p-2">
            <div class="h-full overflow-y-auto font-mono" use:autoscroll={store.peerLogs.length}>
                {#if store.peerLogs.length === 0}
                    <div class="text-base-content/40 text-center py-4">暂无节点活动</div>
                {:else}
                    <ul class="list p-1">
                        {#each store.peerLogs as log (log.timestamp)}
                            <li class="list-row py-0.5 px-1.5 gap-3 items-start min-w-0">
                                <span class="text-base-content/30 min-w-22.5 shrink-0">[{formatTime(log.timestamp)}]</span>
                                {#if log.type === "discovery"}
                                    <span class="badge badge-soft badge-accent shrink-0">DISC</span>
                                {:else if log.type === "connect"}
                                    <span class="badge badge-soft badge-success shrink-0">CONN</span>
                                {:else}
                                    <span class="badge badge-soft badge-warning shrink-0">LOST</span>
                                {/if}
                                <span class="text-base-content/70 leading-snug break-all list-col-grow">{log.msg}</span>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>
    </div>
</section>
