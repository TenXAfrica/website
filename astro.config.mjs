// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

import svgr from 'vite-plugin-svgr'; // 1. Import the plugin

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss(), svgr()],
  },
  site: 'http://tenxafrica.github.io/website/',
  integrations: [react()]
});