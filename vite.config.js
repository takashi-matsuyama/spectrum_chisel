/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// Vite serves index.html at the project root and bundles src/main.js (an ES
// module). p5 stays in global mode: main.js imports the p5 UMD build, which
// sets window.p5 and registers the global init, so the p5 API is attached to
// window before setup()/draw() run.
export default defineConfig({
  // Relative base so the built app works when served from a subpath or opened
  // through a static host (the Phase 3 PWA/Cloudflare Pages target).
  base: './',
  plugins: [
    // Installable, offline-capable PWA. The service worker precaches the build
    // output (both HTML entries below and their chunks) so the instrument runs
    // with no network; autoUpdate swaps in a new worker on the next launch.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'maskable-icon.svg'],
      manifest: {
        name: 'Spectrum Chisel',
        short_name: 'Spectrum',
        description: 'See sound as a rainbow: a real-time, audio-reactive drawing instrument.',
        lang: 'en',
        start_url: '.',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Multi-page: precache the atelier (index.html), the viewer (view.html),
        // and their JS/CSS/SVG assets.
        globPatterns: ['**/*.{js,css,html,svg}'],
        // The p5 bundle is ~1 MB; raise the precache size ceiling to fit it.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      // Multi-page: the atelier (index.html) and the UI-less viewer (view.html).
      // Paths are relative to the Vite root (this directory).
      input: {
        main: 'index.html',
        view: 'view.html',
      },
    },
  },
  test: {
    // The pure core (src/core) is environment-agnostic; canvas drawing is not
    // unit-tested, so a plain Node environment is enough.
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
