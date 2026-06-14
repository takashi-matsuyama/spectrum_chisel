/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// Vite serves index.html at the project root and bundles src/main.js (an ES
// module). p5 stays in global mode: main.js imports the p5 UMD build, which
// sets window.p5 and registers the global init, so the p5 API is attached to
// window before setup()/draw() run.
export default defineConfig({
  // Relative base so the built app works when served from a subpath or opened
  // through a static host (the Phase 3 PWA/Cloudflare Pages target).
  base: './',
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
