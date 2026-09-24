# Markbit

> Paste. Mark. Share.

Markbit is a fast, local-first screenshot annotation tool you can use standalone
or embed on your own site with a single `<script>` tag.

**Try it:** [markbit.abcbox.kr](https://markbit.abcbox.kr)

No account, no server upload unless you explicitly share — Your screenshots never leave your browser.

## Embed it on your own site

```html
<script type="module" src="https://markbit.abcbox.kr/loader.js" data-hotkey="ctrl+shift+m"></script>
```

Press the hotkey to capture the current page, mark it up, and copy or download
the result. You can also hook into the copy/download/open/close lifecycle
with `data-on-*` attributes or, for bundler/ESM users, `import { init } from
'https://markbit.abcbox.kr/loader.js'`. See [`public/embed-test.html`](public/embed-test.html)
for a full working example.

## Features

- Rectangle, freehand, highlighter, text, blur/redact, crop
- Select / move / resize / delete, zoom & pan
- Copy to clipboard or download as PNG
- Paste, drag-and-drop, or file picker to load an image
- Embeddable via a single script tag, or as an ESM import for bundler users

## Development

```bash
npm install
npm run dev          # dev server
npm run build         # production build (dist/)
npm run preview       # serve the production build locally

npm run type-check
npm run test:unit      # Vitest
npm run cypress:open   # Cypress component tests
npm run test:e2e       # build + Cypress e2e against the built dist/
```

`npm run build` picks up `.env.production` and points the embed widget at the
live `markbit.abcbox.kr` CDN. For local testing against `npm run preview`, use
`npm run build:test` instead (see `src/loader/embed.ts`'s `frameScriptUrl()`
for why).

## License

Markbit is licensed under the [Mozilla Public License 2.0](LICENSE). MPL's
copyleft applies only at the file level, to Markbit's own source files — you
can embed or combine Markbit with proprietary code freely. If you modify
Markbit's own source and want to keep those changes closed, or you'd rather
not deal with MPL's terms at all, a commercial license is available — open an
issue to discuss.
