import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import type { Plugin } from 'vite'
// `defineConfig` from 'vitest/config' re-exports Vite's own, just with the `test`
// field typed — same as starissue's vite.config.ts.
import { defineConfig } from 'vitest/config'

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

// Appends a build stamp comment to the built index.html so the deployed
// version can be identified with `curl https://markbit.abcbox.kr | tail -3`.
// "-dirty" means the working tree had uncommitted changes at build time, so
// the commit alone can't reproduce this build.
function buildStamp(): Plugin {
  return {
    name: 'build-stamp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const commit = git('rev-parse --short HEAD') || 'unknown'
        const dirty = git('status --porcelain') ? '-dirty' : ''
        return `${html.trimEnd()}\n<!-- build: ${new Date().toISOString()} commit: ${commit}${dirty} -->\n`
      },
    },
  }
}

// The build emits the embed entries as /loader.js and /frame.js, which the dev
// server doesn't have — public/embed-test*.html would get a 404 and the hotkey
// would silently do nothing. Serve the entries' source at those URLs. The code
// is returned directly (not redirected to /src/loader/*.ts) so import.meta.url
// stays "/loader.js", which getCurrentScriptElement() matches against <script src>.
function devEmbedEntries(): Plugin {
  const entries: Record<string, string> = {
    '/loader.js': '/src/loader/main.ts',
    '/frame.js': '/src/loader/frame.ts',
  }
  return {
    name: 'dev-embed-entries',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const source = entries[req.url?.split('?')[0] ?? '']
        if (!source) return next()
        try {
          const result = await server.transformRequest(source)
          if (!result) return next()
          res.setHeader('Content-Type', 'text/javascript')
          res.end(result.code)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), buildStamp(), devEmbedEntries()],
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
  // Relative (not '/'): each chunk resolves against its own import.meta.url
  // at runtime, so one dist/ build works whether it's served from the root,
  // a self-hosted subpath (e.g. /markbit/), or a remote <script src> on a
  // third-party page — no --base override needed.
  base: './',
  build: {
    sourcemap: false,
    // icons-sprite.svg (3.7KB) is under Vite's default 4KB inline threshold, so
    // `?url` was resolving it to a data: URI instead of a real file. SVG <use
    // href="..."> can't reference data: URIs (browsers reject it as a
    // cross-origin-like access, regardless of Shadow DOM) — force it to always
    // emit as an actual asset file.
    assetsInlineLimit: (filePath) => (filePath.includes('icons-sprite') ? false : undefined),
    rollupOptions: {
      preserveEntrySignatures: 'strict',
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
