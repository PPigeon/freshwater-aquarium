import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // serve files from project root so 'assets/sprites/...' paths resolve correctly
  publicDir: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    open: false,
  },
});
