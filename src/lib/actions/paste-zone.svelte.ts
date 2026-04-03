import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";

export function pasteZone(onFilePaste: (files: File[]) => void): Attachment<HTMLElement> {
    return node => {
        let off = on(node, "paste", (event: ClipboardEvent) => {
            let dataTransfer = event.clipboardData;
            if (dataTransfer && dataTransfer.files.length > 0) {
                let files = Array.from(dataTransfer.files);
                onFilePaste(files);
            }
        });
        return () => off();
    };
}
