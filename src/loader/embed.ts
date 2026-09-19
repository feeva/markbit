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

// Exported (not just used internally as the no-onCopy/no-onDownload default)
// so a host's custom onCopy/onDownload callback can compose with the built-in
// behavior instead of reimplementing it, e.g. "copy normally, then also log
// an analytics event".
export async function copyToClipboard(dataUrl: string): Promise<void> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}

export function downloadDataUrl(dataUrl: string): void {
  // A data: URL downloads directly via the anchor's `download` attribute —
  // no fetch/blob roundtrip needed (that's only required for
  // clipboard.write(), which needs a Blob, not a URL).
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `markbit-${Date.now()}.png`
  link.click()
}

// frame.js must be fetched from Markbit's own origin, not the host page's — a
// customer embedding <script src="https://markbit.example/loader.js"> on
// https://their-product.com must not resolve this to their-product.com/frame.js.
// import.meta.url, inside this dynamically-imported chunk, is this chunk's own
// served URL (e.g. https://markbit.example/assets/embed-XXXX.js), so its origin
// is always Markbit's, regardless of what page loader.js was embedded on.
function frameScriptUrl(): string {
  // frame.js is a separate top-level build entry, not something Vite can
  // statically verify from this chunk — it does exist at the site root at
  // runtime (see vite.config.ts's entryFileNames).
  return new URL(/* @vite-ignore */ '/frame.js', import.meta.url).toString()
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

  const win = frame.contentWindow as (Window & { __markbitMount?: MarkbitMount }) | null
  win?.__markbitMount?.(
    imageUrl,
    // onCopy/onDownload are result-owning: if the host supplied one, it fully
    // replaces our built-in action (no forced clipboard write on top of
    // theirs) and we don't auto-close — the host now owns the payload's
    // lifecycle and can call the returned MarkbitAPI's close() itself.
    (payload: AnnotationSavePayload) => {
      if (config.onCopy) {
        try {
          config.onCopy(payload)
        } catch (error) {
          console.error('[markbit] onCopy callback threw', error)
        }
        return
      }
      void copyToClipboard(payload.previewDataUrl)
        .catch((error) => console.error('[markbit] clipboard copy failed', error))
        .finally(() => close())
    },
    // Unlike copy, downloading doesn't close the overlay by default either —
    // a user may want to download and keep annotating (or copy afterwards too).
    (payload: AnnotationSavePayload) => {
      if (config.onDownload) {
        try {
          config.onDownload(payload)
        } catch (error) {
          console.error('[markbit] onDownload callback threw', error)
        }
        return
      }
      downloadDataUrl(payload.previewDataUrl)
    },
    // onClose is a lifecycle notification, not result-owning: Markbit always
    // tears down the overlay itself, and config.onClose (if any) just runs
    // afterward so the host can react (e.g. resume their own paused UI).
    () => {
      close()
      config.onClose?.()
    },
  )
  config.onOpen?.()
}
