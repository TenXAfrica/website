// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

import svgr from 'vite-plugin-svgr'; // 1. Import the plugin

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss(), svgr()],
    build: {
      cssMinify: 'lightningcss',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          passes: 2
        }
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor';
              }
              if (id.includes('framer-motion')) {
                return 'motion';
              }
              if (id.includes('three')) {
                return 'three';
              }
              return 'vendor';
            }
          }
        }
      }
    }
  },
  site: 'https://tenxafrica.co.za',
  integrations: [
    react(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      customPages: [
        'https://tenxafrica.co.za',
        'https://tenxafrica.co.za/consulting',
        'https://tenxafrica.co.za/insights',
        'https://tenxafrica.co.za/venture-studio',
      ],
    })
  ],
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
    assets: '_astro'
  },
  experimental: {
    clientPrerender: true
  }
});