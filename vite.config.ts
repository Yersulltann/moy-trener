import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — работает и на GitHub Pages (подпапка), и на Vercel.
// Офлайн-режим — public/sw.js, манифест — public/manifest.webmanifest.
export default defineConfig({
  base: './',
  plugins: [react()],
});
