#!/usr/bin/env node
// Freezes a major-version-pinned build for third-party <script> embeds.
//
// This is deliberately separate from package.json's own "version" field —
// that's an internal bump-per-change number with no public meaning; the
// argument here is the PUBLIC major-version line (v1, v2, ...) that a host
// page can pin its embed to and expect never to break, per PLAN.md's
// versioned-loader Decision Log entry. They move independently: package.json
// can bump many times between two calls to this script.
//
// What this does NOT do: commit the result, or deploy anything. It only
// builds and stages public/v<N>/ — `git add public/v<N> && git commit` and
// the normal `wrangler pages deploy dist` (after a normal `npm run build`)
// are separate, deliberate steps.
//
// Usage: npm run release -- 1

import { execSync } from 'node:child_process'
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const version = process.argv[2]
if (!version || !/^\d+$/.test(version)) {
  console.error('Usage: npm run release -- <major-version-number>  (e.g. npm run release -- 1)')
  process.exit(1)
}

const distDir = resolve(root, 'dist')
const versionDir = resolve(root, 'public', `v${version}`)

if (existsSync(versionDir)) {
  console.log(
    `public/v${version}/ already exists — this will overwrite it in place (the "rolling ` +
      `major pin" behavior: compatible fixes within v${version} replace the old snapshot, ` +
      `only a new major number gets its own new folder).`,
  )
}

// No env vars needed: vite.config.ts's base: './' makes dist/ relocatable to
// any path, so a plain build is correct wherever it's served from.
console.log(`Building...`)
rmSync(distDir, { recursive: true, force: true })
execSync('npm run build', { cwd: root, stdio: 'inherit' })

rmSync(versionDir, { recursive: true, force: true })
mkdirSync(versionDir, { recursive: true })
cpSync(distDir, versionDir, { recursive: true })

console.log(`\nStaged into public/v${version}/.`)
console.log(`Next steps:`)
console.log(`  1. git add public/v${version} && git commit`)
console.log(`  2. npm run build  (rebuilds the normal, unversioned /loader.js)`)
console.log(`  3. wrangler pages deploy dist`)
