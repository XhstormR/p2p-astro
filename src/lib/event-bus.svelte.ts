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
            if (value) callback(value.data);
        });
    }

    clear(): void {
        this.#channels.clear();
    }
}

/** 全局单例 */
export const eventBus = new EventBus();
