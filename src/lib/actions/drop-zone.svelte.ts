import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";

export function dropZone(onFileDrop: (files: File[]) => void): Attachment<HTMLElement> {
    return node => {
        let enabled = $state(false);

        $effect(() => {
            if (enabled) {
                node.classList.add("drop-zone");
                return () => node.classList.remove("drop-zone");
            }
        });

        const offDrop = on(node, "drop", (event: DragEvent) => {
            event.preventDefault();
            enabled = false;

            let dataTransfer = event.dataTransfer;
            if (dataTransfer && dataTransfer.files.length > 0) {
                let files = Array.from(dataTransfer.files);
                onFileDrop(files);
            }
        });

        const offDragOver = on(node, "dragover", (event: DragEvent) => {
            event.preventDefault();
            enabled = true;
        });

        const offDragLeave = on(node, "dragleave", (event: DragEvent) => {
            event.preventDefault();
            enabled = false;
        });

        return () => {
            offDrop();
            offDragOver();
            offDragLeave();
        };
    };
}
