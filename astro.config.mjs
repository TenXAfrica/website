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
  // Old routes from the previous site. On a static GitHub Pages build these
  // emit meta-refresh pages with canonicals (design contract section 10).
  redirects: {
    '/consulting': '/what-we-build',
    '/consulting/operations-excellence': '/what-we-build#operations-excellence',
    '/consulting/digital-transformation': '/what-we-build#digital-transformation',
    '/consulting/tech-implementation': '/what-we-build#tech-implementation',
    '/venture-studio': '/',
    '/venture-studio/incubation-and-funding': '/',
    '/venture-studio/compliance-and-registration': '/',
    '/impact': '/',
    '/partner-network': '/',
    '/coming-soon': '/',
    '/forms/contact': '/',
    '/forms/consulting': '/',
    '/forms/venture-application': '/',
    '/forms/idc-partner': '/',
  },
  integrations: [
    react(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      // /internal/* is Joash's tooling, not marketing. The pages also carry
      // a noindex meta tag; this keeps them out of the sitemap as well.
      filter: (page) => !page.includes('/internal/'),
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