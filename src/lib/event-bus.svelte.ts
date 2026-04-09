import { untrack } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { EventTypeMap } from "./types/event";

class EventBus {
    #channels = new SvelteMap<string, { data: any }>();

    emitEvent<T extends keyof EventTypeMap, U extends EventTypeMap[T]>(event: T, data: U) {
        this.#channels.set(event, { data });
    }

    onEvent<T extends keyof EventTypeMap, U extends EventTypeMap[T]>(event: T, callback: (data: U) => void) {
        $effect(() => {
            let value = this.#channels.get(event);
            if (value) untrack(() => callback(value.data)); // untrack 避免 $effect 读写被循环依赖
        });
    }

    clear(): void {
        this.#channels.clear();
    }
}

/** 全局单例 */
export const eventBus = new EventBus();
