import { copyOf } from "#/lib/utils/index.ts";
import { type ExternalToast, toast } from "svelte-sonner";

class SnackBar {
    #alert = new Audio("assets/sounds/alert.m4a");

    #options: ExternalToast = {
        duration: 10_000,
        position: "bottom-center",
        richColors: true,
        closeButton: true,
    };

    #playAlert() {
        this.#alert
            .play()
            .then(() => (this.#alert.muted = false))
            .catch(() => (this.#alert.muted = true)); // fix play() can only be initiated by a user gesture error
    }

    public info(message: string, options?: Partial<ExternalToast>) {
        this.#playAlert();
        toast.info(message, copyOf(this.#options, options));
    }

    public error(message: string, options?: Partial<ExternalToast>) {
        this.#playAlert();
        toast.error(message, copyOf(this.#options, options));
    }
}

export const snackBar = new SnackBar();
