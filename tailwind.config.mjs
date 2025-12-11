/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                'obsidian-void': '#0a0f14',
                'tenx-gold': '#d68614',
                'vapor-white': '#F4F4F9',
                'slate-teal': '#2F4858',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Outfit', 'sans-serif'],
            },
            backgroundImage: {
                'glass-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.00) 100%)',
            }
        },
    },
    plugins: [],
};
