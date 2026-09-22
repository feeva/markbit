#!/usr/bin/env node
// Extracts only the Tabler icons Markbit actually uses from the full
// @tabler/icons-sprite sprite (2.2MB / ~250KB gzip for ~5,900 icons) into a small
// local sprite (src/assets/icons-sprite.svg).
//
// Update ICON_NAMES below whenever a new <Icon name="..."> value appears in the
// codebase, then re-run: npm run icons:build

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Every value passed to <Icon name="..."> / :name="..." across the codebase.
// (AnnotationToolbar.vue: toolItems[].icon, handleToolIcon(), and the static uses.)
const ICON_NAMES = [
  'pointer',
  'border-corners',
  'rectangle',
  'chevron-down',
  'letter-case',
  'highlight',
  'writing',
  'ripple',
  'trash',
  'zoom-out',
  'zoom-in',
  'copy',
  'download',
  'x',
  'question-mark',
  'brand-github',
  'star',
  'git-fork',
  'share',
]

const SOURCE = resolve(__dirname, '../node_modules/@tabler/icons-sprite/dist/tabler-sprite.svg')
const DEST = resolve(__dirname, '../src/assets/icons-sprite.svg')

const source = readFileSync(SOURCE, 'utf-8')

const symbols = ICON_NAMES.map((name) => {
  const id = `tabler-${name}`
  const match = source.match(new RegExp(`<symbol id="${id}"[^]*?</symbol>`))
  if (!match) {
    throw new Error(
      `Icon "${name}" (id="${id}") not found in ${SOURCE}. Check the name against ` +
        `https://tabler.io/icons or node_modules/@tabler/icons-sprite/dist/tabler-sprite.svg`,
    )
  }
  return match[0]
})

const output = `<svg xmlns="http://www.w3.org/2000/svg" id="markbit-icons"><defs>${symbols.join('')}</defs></svg>\n`

writeFileSync(DEST, output)

console.log(
  `Wrote ${symbols.length} icon(s) to ${DEST} (${(output.length / 1024).toFixed(1)} KB, ` +
    `vs ${(source.length / 1024).toFixed(0)} KB source sprite)`,
)
