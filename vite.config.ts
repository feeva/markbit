import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
// `defineConfig` from 'vitest/config' re-exports Vite's own, just with the `test`
// field typed — same as starissue's vite.config.ts.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: true,
    // icons-sprite.svg (3.7KB) is under Vite's default 4KB inline threshold, so
    // `?url` was resolving it to a data: URI instead of a real file. SVG <use
    // href="..."> can't reference data: URIs (browsers reject it as a
    // cross-origin-like access, regardless of Shadow DOM) — force it to always
    // emit as an actual asset file.
    assetsInlineLimit: (filePath) => (filePath.includes('icons-sprite') ? false : undefined),
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        loader: resolve(import.meta.dirname, 'src/loader/main.ts'),
        frame: resolve(import.meta.dirname, 'src/loader/frame.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Stable, predictable names: loader.js is the <script src="...">
          // customers embed; frame.js is injected into the blank iframe at
          // runtime by embed.ts (frameScriptUrl()), which needs to know its URL
          // without a content hash.
          if (chunkInfo.name === 'loader') {
            return 'loader.js'
          }
          if (chunkInfo.name === 'frame') {
            return 'frame.js'
          }
          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
})
