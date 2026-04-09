import type { Message } from "#/lib/types/message.d.ts";
import { MessageMaker } from "#/lib/utils/message.ts";
import { SvelteMap } from "svelte/reactivity";
import { eventBus } from "./event-bus.svelte";
import { logHub } from "./log-hub.svelte";
import { p2pStore } from "./p2p-store.svelte";

class MessageHub {
    #messageMap = new SvelteMap<string, Message[]>();

    #blop = new Audio("assets/sounds/blop.mp3");

    destroy = $effect.root(() => {
        eventBus.onEvent("onConnectionReceiveData", event => {
            this.#addPeerMessage(event.message.sender, event.message);
            this.#log(event.message);
            this.#blop.play();
        });
    });

    getPeerMessages(peer: string) {
        return this.#messageMap.get(peer) || [];
    }

    async sendText(peer: string, text: string) {
        let message = MessageMaker.textMessage(p2pStore.localPeer, peer, text);
        await this.#sendPeerMessage(peer, message);
    }

    async sendFile(peer: string, file: File) {
        let message = await MessageMaker.fileMessage(p2pStore.localPeer, peer, file);
        await this.#sendPeerMessage(peer, message);
    }

    async #sendPeerMessage(peer: string, message: Message) {
        await p2pStore.publishToChatTopic(peer, message);
        this.#addPeerMessage(peer, message);
    }

    #addPeerMessage(peer: string, message: Message) {
        let messages = this.getPeerMessages(peer);
        this.#messageMap.set(peer, [...messages, message]);
    }

    #log(message: Message) {
        switch (message.type) {
            case "Text":
                logHub.addLog(`收到来自 ${message.sender} 的文本消息`, "chat");
                break;
            case "File":
                logHub.addLog(
                    `收到来自 ${message.sender} 的文件消息: ${message.fileName} (${message.fileSize} bytes)`,
                    "chat",
                );
                break;
        }
    }
}

export const messageHub = new MessageHub();
