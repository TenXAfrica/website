/** @type {import('tailwindcss').Config} */
// Tailwind 4 reads its tokens from the @theme block in src/styles/global.css.
// This file mirrors the core colours only in case a plugin needs them.
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                'obsidian-void': '#0a0f14',
                'tenx-gold': '#d68614',
                'vapor-white': '#F4F4F9',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Outfit', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
