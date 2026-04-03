import type { Config } from "prettier";

const config: Config = {
    printWidth: 110,
    tabWidth: 4,
    trailingComma: "all",
    quoteProps: "preserve",
    arrowParens: "avoid",
    tailwindStylesheet: "./src/styles/global.css",
    plugins: [
        "prettier-plugin-organize-imports",
        "prettier-plugin-astro",
        "prettier-plugin-svelte",
        "prettier-plugin-tailwindcss",
    ],
    overrides: [
        { files: "*.astro", options: { parser: "astro" } },
        { files: "*.svelte", options: { parser: "svelte" } },
    ],
};

export default config;
