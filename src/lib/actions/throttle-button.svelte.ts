import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";

export function throttleButton(throttleTime = 4_000): Attachment<HTMLButtonElement> {
    return node => {
        let throttled = $state(false);

        let off = on(node, "click", () => {
            throttled = true;
            setTimeout(() => (throttled = false), throttleTime);
        });

        $effect(() => {
            if (throttled) {
                node.disabled = true;
                return () => (node.disabled = false);
            }
        });

        return () => off();
    };
}
