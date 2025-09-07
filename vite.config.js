import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  base: './', // Important for Electron
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  }
});
