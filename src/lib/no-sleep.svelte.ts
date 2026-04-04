class NoSleep {
    #wakeLock?: WakeLockSentinel;

    #handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
            this.on();
        }
    };

    public async on() {
        if (this.#wakeLock) return;

        console.log("request wakeLock");
        this.#wakeLock = await navigator.wakeLock.request("screen");
        this.#wakeLock.onrelease = () => {
            console.log("release wakeLock");
            this.#wakeLock = undefined;
        };
        document.addEventListener("visibilitychange", this.#handleVisibilityChange);
    }

    public async off() {
        if (this.#wakeLock) {
            await this.#wakeLock.release();
            this.#wakeLock = undefined;
        }
        document.removeEventListener("visibilitychange", this.#handleVisibilityChange);
    }
}

export const noSleep = new NoSleep();
