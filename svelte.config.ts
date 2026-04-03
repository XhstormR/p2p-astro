import { vitePreprocess } from "@astrojs/svelte";
import type { SvelteConfig } from "@sveltejs/vite-plugin-svelte";

const config: SvelteConfig = {
    preprocess: vitePreprocess(),
};

export default config;
