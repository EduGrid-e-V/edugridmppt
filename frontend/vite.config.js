import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@edugrid/pv-sim': fileURLToPath(new URL('../packages/pv-sim/src/index.js', import.meta.url)),
    },
  },
  base: './',
  build: {
    outDir: '../firmware/data',
    emptyOutDir: true,
  },
})
