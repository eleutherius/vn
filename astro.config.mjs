// @ts-check
import { defineConfig } from 'astro/config';
import pwa from './src/pwa/integration.mjs';

// GitHub Pages: https://eleutherius.github.io/vn/
export default defineConfig({
  site: 'https://eleutherius.github.io',
  base: '/vn',
  devToolbar: { enabled: false },
  // Офлайн-режим: після білду генерує dist/sw.js (див. src/pwa/)
  integrations: [pwa()],
});
