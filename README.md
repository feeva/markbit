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

## Contributing

Pull requests are welcome. Contributors sign a one-time
[Contributor License Agreement](CLA.md) on their first pull request — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

Markbit is dual-licensed.

- **Open source:** [Mozilla Public License 2.0](LICENSE). MPL's copyleft
  applies only at the file level, to Markbit's own source files — you can
  embed or combine Markbit with proprietary code freely.
- **Commercial license:** for teams that want to keep modifications to
  Markbit's own source closed, need terms that fit their company's open source
  policy or procurement process, or want support or custom features.
  Email [license@abcbox.kr](mailto:license@abcbox.kr?subject=Markbit%20commercial%20license)
  to discuss.

Bug reports and feature ideas go to
[GitHub Issues](https://github.com/feeva/markbit/issues); for anything else,
email [support@abcbox.kr](mailto:support@abcbox.kr).
