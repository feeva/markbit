/**
 * The heavy part of the Markbit loader: capture the host page, then open an
 * isolated overlay running frame.ts (Vue+Konva+AnnotationEditor). Only loaded
 * via dynamic import() when the hotkey fires — never on page load.
 *
 * Uses an iframe with `srcdoc`, not Shadow DOM: a srcdoc iframe is same-origin
 * with the page that created it (no postMessage needed — see frame.ts's
 * window.__markbitMount, called directly via contentWindow), but it's a
 * genuinely separate Document. That means Tailwind/DaisyUI's :root-scoped CSS
 * custom properties work completely normally — Shadow DOM shares the host
 * page's Document, so :root there only ever matches the *real* document root,
 * never the shadow root, which broke DaisyUI's theming entirely. `srcdoc`
 * (rather than `src: 'about:blank'` + an injected <script>) also lets this
 * iframe have its own <meta viewport> from its very first parse — see
 * createFrameIframe() below.
 */
import type { AnnotationSavePayload } from '@/types/annotations'
import type { MarkbitMount } from './frame'
import type { MarkbitConfig } from './main'

let iframe: HTMLIFrameElement | null = null
let originalOverflow = { html: '', body: '' }

async function captureHostPage(): Promise<string> {
  const viewport = window.visualViewport
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth))
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight))
  const x = Math.max(0, Math.round(viewport?.pageLeft ?? window.scrollX))
  const y = Math.max(0, Math.round(viewport?.pageTop ?? window.scrollY))

  const { default: html2canvas } = await import('html2canvas-pro')
  const canvas = await html2canvas(document.documentElement, { x, y, width, height, scale: 1 })
  return canvas.toDataURL('image/png')
}

// Re-exported so a host's custom onCopy/onDownload callback can compose with
// the built-in behavior instead of reimplementing it, e.g. "copy normally,
// then also log an analytics event". Note this composition itself runs in
// the host's page context (see open() below), so the same cross-frame
// user-activation caveat documented in frame.ts's handleCopy applies if the
// host's own callback calls these from here.
export { copyToClipboard, downloadDataUrl } from '@/utils/clipboard'

// frame.js must be fetched from Markbit's own CDN origin, not the host page's
// — a customer embedding <script src="https://markbit.abcbox.kr/loader.js"> on
// https://their-product.com must not resolve this to their-product.com/frame.js.
// VITE_ASSET_BASE_URL is baked in at build time (see .env.production) and
// always points at Markbit's own deployed domain; it's deliberately NOT
// derived from import.meta.url (this chunk's own served URL), because that
// would break the moment loader.js is ever consumed as a bundled dependency
// (e.g. a future npm package) rather than loaded via a real <script src> —
// import.meta.url there would resolve to the *consumer's* own bundle output,
// not Markbit's domain. The window.location.origin fallback only matters for
// local dev/preview/e2e builds, which intentionally don't set the env var
// (see package.json's test:e2e using `--mode test`) and stay same-origin.
function frameScriptUrl(): string {
  const base = import.meta.env.VITE_ASSET_BASE_URL || window.location.origin
  return new URL('/frame.js', base).toString()
}

// `srcdoc` (not `src: 'about:blank'` + a script injected afterwards): the
// iframe needs its own <meta viewport>, since it's a separate Document that
// doesn't inherit the host page's — without it, mobile browsers fall back to
// a ~980px default layout viewport and scale the whole overlay down to fit
// the screen. A <meta> tag only reliably affects layout when it's present
// during the browser's *initial* parse of the document; appending one via JS
// after the document already exists (which is what an about:blank iframe +
// injected <script> requires) is ignored by some browsers, especially mobile
// Safari. `srcdoc` gives the iframe a real initial HTML document — same-origin
// with the parent, exactly like about:blank was — so the viewport meta tag
// (and the overflow:hidden reset) are in effect from the very first paint.
function createFrameIframe(): Promise<HTMLIFrameElement> {
  return new Promise((resolvePromise, reject) => {
    const el = document.createElement('iframe')
    el.id = 'markbit-host'
    // Permissions Policy gates clipboard-write per iframe, independent of
    // same-origin-ness — Safari enforces this even for a same-origin srcdoc
    // iframe (Chrome/Firefox are more lenient and work without it). Without
    // this, frame.ts's navigator.clipboard.write() is silently blocked in
    // Safari with no console output at all, which is easy to mistake for the
    // user-activation issue this iframe already works around.
    el.setAttribute('allow', 'clipboard-write')
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      border: 'none',
      zIndex: '2147483647',
    })
    el.addEventListener('load', () => resolvePromise(el))
    el.addEventListener('error', () => reject(new Error('[markbit] failed to load frame.js')))
    el.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html, body { margin: 0; overflow: hidden; }</style>
  </head>
  <body>
    <script type="module" src="${frameScriptUrl()}"><\/script>
  </body>
</html>`
    document.body.appendChild(el)
  })
}

export function close(): void {
  if (!iframe) return

  iframe.remove()
  iframe = null

  document.documentElement.style.overflow = originalOverflow.html
  document.body.style.overflow = originalOverflow.body
}

export function isOpen(): boolean {
  return iframe !== null
}

export async function open(config: MarkbitConfig = {}): Promise<void> {
  if (iframe) return

  const imageUrl = await captureHostPage()
  if (iframe) return // guard against a second trigger firing while capture was in flight

  const frame = await createFrameIframe()
  iframe = frame

  originalOverflow = {
    html: document.documentElement.style.overflow,
    body: document.body.style.overflow,
  }
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'

  frame.contentWindow?.focus() // so an immediate Escape reaches frame.ts's own listener

  // onCopy/onDownload are only passed through when the host actually
  // supplied one — undefined tells frame.ts to run the built-in default
  // action itself, inside the iframe (see frame.ts's handleCopy for why that
  // must happen there and not here). onCopy/onDownload are result-owning: a
  // host override fully replaces our built-in action (no forced clipboard
  // write on top of theirs) and we don't auto-close — the host now owns the
  // payload's lifecycle and can call the returned MarkbitAPI's close() itself.
  const win = frame.contentWindow as (Window & { __markbitMount?: MarkbitMount }) | null
  win?.__markbitMount?.(imageUrl, {
    onCopy: config.onCopy
      ? (payload: AnnotationSavePayload) => {
          try {
            config.onCopy?.(payload)
          } catch (error) {
            console.error('[markbit] onCopy callback threw', error)
          }
        }
      : undefined,
    onDownload: config.onDownload
      ? (payload: AnnotationSavePayload) => {
          try {
            config.onDownload?.(payload)
          } catch (error) {
            console.error('[markbit] onDownload callback threw', error)
          }
        }
      : undefined,
    closeOverlay: close,
    // onClose is a lifecycle notification, not result-owning: Markbit always
    // tears down the overlay itself, and config.onClose (if any) just runs
    // afterward so the host can react (e.g. resume their own paused UI).
    onClose: () => {
      close()
      config.onClose?.()
    },
  })
  config.onOpen?.()
}
