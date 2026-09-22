import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { existsSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(() => {
  const standalone = process.env.EDUGRID_BUILD === 'standalone'
  const standaloneFilename = {
    name: 'standalone-html-filename',
    closeBundle() {
      if (!standalone) return
      const source = resolve('dist/index.html')
      const destination = resolve('dist/edugrid-mppt.html')
      if (existsSync(source)) renameSync(source, destination)
    },
  }

  return {
  plugins: [vue(), ...(standalone ? [viteSingleFile(), standaloneFilename] : [])],
  define: {
    __EDUGRID_STANDALONE__: JSON.stringify(standalone),
  },
  resolve: {
    alias: {
      '@edugrid/pv-sim': fileURLToPath(new URL('../packages/pv-sim/src/index.js', import.meta.url)),
    },
  },
  base: './',
  build: {
    outDir: standalone ? 'dist' : '../firmware/data',
    emptyOutDir: true,
    assetsInlineLimit: standalone ? 100000000 : 4096,
    cssCodeSplit: !standalone,
    rollupOptions: standalone ? {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'edugrid-mppt.js',
      },
    } : undefined,
  },
  }
})
