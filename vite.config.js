import { defineConfig } from 'vite';

// Served from a custom domain at the site root (see public/CNAME), so the
// base path is always '/' regardless of environment.
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    include: ['tests/**/*.test.js'],
    // Everything under src/ assumes a browser DOM (getElementById at module
    // scope, localStorage, etc.) even for logic that's otherwise pure.
    environment: 'jsdom',
  },
});
