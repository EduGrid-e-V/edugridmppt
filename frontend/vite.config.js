import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(() => {
  const standalone = process.env.EDUGRID_BUILD === 'standalone'
  const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
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
    __EDUGRID_VERSION__: JSON.stringify(`v${version}`),
  },
  base: './',
  build: {
    outDir: standalone ? 'dist' : '../firmware/data',
    emptyOutDir: true,
    assetsInlineLimit: standalone ? 100000000 : 4096,
    cssCodeSplit: !standalone,
    rollupOptions: {
      output: standalone ? {
        inlineDynamicImports: true,
        entryFileNames: 'edugrid-mppt.js',
      } : {
        // Some ESP32 LittleFS image builders reject names over 32 bytes.
        // A chunk such as SimulationWorkerConnector-[hash].js exceeds that.
        chunkFileNames: ({ name }) => `assets/${name.slice(0, 18)}-[hash].js`,
      },
    },
  },
  }
})
