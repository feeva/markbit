#!/usr/bin/env node
// Generates public/THIRD-PARTY-NOTICES.txt: the copyright notices and license
// texts of third-party code that ships in dist/ (loader.js, frame.js, the CSS
// and the icon sprite). MIT/BSD/ISC require the notice to travel with
// distributed copies, and Vite strips license comments from the bundle, so this
// file is what keeps embeds compliant. Vite copies public/ into dist/, so it is
// served at /THIRD-PARTY-NOTICES.txt.
//
// Only packages whose code actually ends up in dist/ are listed (BUNDLED below);
// build tooling (vite, lightningcss, @tailwindcss/vite, ...) is not distributed.
// Packages sharing the same license text are grouped so each text appears once.
//
// Guards: every package.json "dependencies" entry must be classified as BUNDLED or
// BUILD_ONLY, and every license must be in ALLOWED — otherwise the script fails,
// so a new dependency can't slip in without a decision.
//
// Usage: npm run licenses:build   (run `npm install` first; re-run after dep changes)
//        npm run licenses:check   (verify only; fails if the file is stale)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outFile = resolve(root, 'public', 'THIRD-PARTY-NOTICES.txt')
const checkOnly = process.argv.includes('--check')

// Code (or generated output derived from it) that ships in dist/. Verified by
// building with sourcemaps: the JS bundles contain only konva, html2canvas-pro
// and Vue's runtime packages; the CSS carries tailwindcss/daisyUI output; the
// icon sprite is extracted from @tabler/icons-sprite (see scripts/build-icon-sprite.mjs).
// Vue is listed package by package — walking "vue"'s own dependencies would pull in
// the compiler and SSR packages, which are not bundled.
const BUNDLED = [
  'vue',
  '@vue/runtime-dom',
  '@vue/runtime-core',
  '@vue/reactivity',
  '@vue/shared',
  'konva',
  'html2canvas-pro',
  'tailwindcss',
  'daisyui',
  '@tabler/icons-sprite',
]
// Bundled packages whose own dependencies are also inlined into their dist file.
const WALK_DEPENDENCIES = new Set(['html2canvas-pro', '@tabler/icons-sprite'])
// Declared under "dependencies" but only used at build time.
const BUILD_ONLY = new Set(['@tailwindcss/vite'])

// SPDX ids compatible with distributing under MPL-2.0.
const ALLOWED = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Apache-2.0',
  'MPL-2.0',
])

const readPkg = (name) => {
  const dir = resolve(root, 'node_modules', name)
  if (!existsSync(dir)) {
    console.error(`Missing node_modules/${name} — run npm install first.`)
    process.exit(1)
  }
  return { dir, pkg: JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) }
}

const ownPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const unclassified = Object.keys(ownPkg.dependencies ?? {}).filter(
  (name) => !BUNDLED.includes(name) && !BUILD_ONLY.has(name),
)
if (unclassified.length) {
  console.error(
    `New dependencies need a decision — add to BUNDLED or BUILD_ONLY in this script: ${unclassified.join(', ')}`,
  )
  process.exit(1)
}

const names = new Set()
const collect = (name) => {
  if (names.has(name)) return
  names.add(name)
  if (WALK_DEPENDENCIES.has(name)) {
    for (const dep of Object.keys(readPkg(name).pkg.dependencies ?? {})) collect(dep)
  }
}
BUNDLED.forEach(collect)

// Per-package lines: copyright holders (konva prefixes its with "Original work" /
// "Modified work") and the title line ("MIT License", "The MIT License (MIT)").
// Anchored at line start so "The above copyright notice..." stays in the body.
const isCopyrightLine = (line) =>
  /^\s*((original|modified) work\s+)?(copyright\b|\(c\)|©)/i.test(line)
const isTitleLine = (line) => /^\s*(the\s+)?mit license(\s+\(mit\))?\s*$/i.test(line)

const packages = [...names].sort().map((name) => {
  const { dir, pkg } = readPkg(name)
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f))
  const lines = file ? readFileSync(resolve(dir, file), 'utf8').trim().split(/\r?\n/) : []
  return {
    id: `${pkg.name}@${pkg.version}`,
    license: pkg.license ?? 'UNKNOWN',
    copyrights: lines.filter(isCopyrightLine).map((l) => l.trim()),
    // Copyright lines are listed per package; the shared body is printed once.
    body: lines
      .filter((l) => !isCopyrightLine(l) && !isTitleLine(l))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  }
})

const disallowed = packages.filter((p) => !ALLOWED.has(p.license))
if (disallowed.length) {
  console.error('Licenses outside the allowed list — review before shipping:')
  for (const p of disallowed) console.error(`  ${p.id}  ${p.license}`)
  process.exit(1)
}

const missingText = packages.filter((p) => !p.body)
if (missingText.length) {
  console.warn(
    `No license file found (only the SPDX id is listed) for: ${missingText.map((p) => p.id).join(', ')}`,
  )
}

// Group by license + whitespace-normalized text so line-wrapping differences don't split a group.
const groups = new Map()
for (const p of packages) {
  const key = `${p.license}\0${p.body.replace(/\s+/g, ' ')}`
  if (!groups.has(key)) groups.set(key, { license: p.license, body: p.body, members: [] })
  groups.get(key).members.push(p)
}

const rule = '-'.repeat(72)
const sections = [...groups.values()]
  .sort(
    (a, b) => a.license.localeCompare(b.license) || a.members[0].id.localeCompare(b.members[0].id),
  )
  .map((g) => {
    const members = g.members
      .map((p) => [`* ${p.id}`, ...p.copyrights.map((c) => `    ${c}`)].join('\n'))
      .join('\n')
    return [
      rule,
      `License: ${g.license}`,
      '',
      'Packages:',
      members,
      '',
      g.body || '(no license file shipped in the packages)',
    ].join('\n')
  })

const output =
  `Markbit third-party notices\n\n` +
  `Markbit itself is licensed under the Mozilla Public License 2.0 (see LICENSE).\n` +
  `The distributed files (loader.js, frame.js, CSS, icons) include the following\n` +
  `third-party packages. Generated by scripts/build-third-party-notices.mjs — do not edit by hand.\n\n` +
  `${sections.join('\n\n')}\n`

if (checkOnly) {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : ''
  if (current !== output) {
    console.error('public/THIRD-PARTY-NOTICES.txt is out of date — run: npm run licenses:build')
    process.exit(1)
  }
  console.log(`THIRD-PARTY-NOTICES.txt is up to date (${packages.length} packages).`)
} else {
  writeFileSync(outFile, output)
  console.log(
    `Wrote public/THIRD-PARTY-NOTICES.txt (${packages.length} packages, ${groups.size} license texts).`,
  )
}
