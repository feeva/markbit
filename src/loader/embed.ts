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
import type { MarkbitMount } from './frame'
import type { MarkbitConfig } from './main'

let iframe: HTMLIFrameElement | null = null
let originalOverflow = { html: '', body: '' }

// Defensive only (the actual fix for the style-loss race is the two-shot
// capture in captureHostPage() below, not this): guards against open() ever
// running while the tab is literally hidden or the window unfocused, e.g. if
// a host triggers it programmatically rather than from a click. A tried,
// unproven fixed delay here (waiting for visibility/focus plus a flat 250ms)
// didn't measurably help the observed race, so it's not worth stacking more
// latency on top of the two-shot capture's own cost.
function waitForVisibleAndSettled(): Promise<void> {
  return new Promise((resolve) => {
    function settle() {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }
    function isReady() {
      return document.visibilityState === 'visible' && document.hasFocus()
    }
    if (isReady()) {
      settle()
      return
    }
    function handler() {
      if (!isReady()) return
      document.removeEventListener('visibilitychange', handler)
      window.removeEventListener('focus', handler)
      settle()
    }
    document.addEventListener('visibilitychange', handler)
    window.addEventListener('focus', handler)
  })
}

// Mirrors html2canvas-pro's own parseDocumentSize() (the source of its
// "Document cloned ... with size WxH" log line) so the real page's height
// can be compared against what it measured for the clone.
function measureDocumentHeight(doc: Document): number {
  const body = doc.body
  const html = doc.documentElement
  return Math.max(
    body.scrollHeight,
    html.scrollHeight,
    body.offsetHeight,
    html.offsetHeight,
    body.clientHeight,
    html.clientHeight,
  )
}

// html2canvas-pro's logger (enabled by `logging`, on by default) writes
// `console.debug(id, "<n>ms", message)` for each step - this taps that one
// line without suppressing it, to read the clone's measured height back out
// without needing changes upstream.
async function renderAndReadClonedHeight(
  render: () => Promise<HTMLCanvasElement>,
): Promise<{ canvas: HTMLCanvasElement; clonedHeight: number | null }> {
  let clonedHeight: number | null = null
  const originalDebug = console.debug
  console.debug = (...args: unknown[]) => {
    const message = typeof args[2] === 'string' ? args[2] : ''
    const match = /with size \d+x(\d+) using computed rendering/.exec(message)
    if (match) clonedHeight = Number(match[1])
    originalDebug.apply(console, args)
  }
  try {
    const canvas = await render()
    return { canvas, clonedHeight }
  } finally {
    console.debug = originalDebug
  }
}

async function captureHostPage(): Promise<string> {
  await waitForVisibleAndSettled()
  const viewport = window.visualViewport
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth))
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight))
  const x = Math.max(0, Math.round(viewport?.pageLeft ?? window.scrollX))
  const y = Math.max(0, Math.round(viewport?.pageTop ?? window.scrollY))

  const { default: html2canvas } = await import('html2canvas-pro')
  // foreignObjectRendering (tried, reverted): rasterizes via an SVG
  // <foreignObject> using the browser's own renderer instead of html2canvas's
  // default manual DOM-clone + computed-style-reparse pass. It did dodge the
  // clone/cache-timing style-loss bugs (e.g. yorickshan/html2canvas-pro#123,
  // #217) but broke any element with a CSS `transform` - service-console's
  // review-app image viewers pan/zoom via `transform: scale()/translate()`ing
  // the <img> itself, and foreignObject's own coordinate system doesn't
  // compose with that correctly, so captured photos came out visibly warped.
  // That regression is worse than the original bug, so back to the default.
  const render = () => html2canvas(document.documentElement, { x, y, width, height, scale: 1 })

  // Retry loop (bounded, not just a single retry): html2canvas-pro's clone
  // step (DocumentCloner.toIFrame) reads each <style> tag's live
  // sheet.cssRules to serialize it into the clone - occasionally (confirmed
  // via its own `logging: true` output) that read races something and comes
  // back empty, finishing suspiciously fast and producing an unstyled,
  // taller-than-normal render (no flex/grid/overflow constraints applied),
  // with no thrown error to catch. A single retry isn't always enough (seen
  // failing twice in a row), so this keeps retrying, up to a bound, as long
  // as the clone's own logged height comes out implausibly taller than the
  // real page's current height - and otherwise stops as soon as one looks
  // sane, rather than always paying for a fixed number of attempts.
  const MAX_ATTEMPTS = 4
  const SUSPECT_HEIGHT_RATIO = 1.2
  const realHeight = measureDocumentHeight(document)
  let canvas: HTMLCanvasElement | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = await renderAndReadClonedHeight(render)
    canvas = result.canvas
    if (result.clonedHeight === null || result.clonedHeight <= realHeight * SUSPECT_HEIGHT_RATIO) {
      break
    }
  }
  return canvas!.toDataURL('image/png')
}

// Re-exported so a host's custom action onClick can compose with the
// built-in behavior instead of reimplementing it, e.g. "copy normally, then
// also log an analytics event". Note this composition itself runs in the
// host's page context (see open() below), so the same cross-frame
// user-activation caveat documented in frame.ts's defaultActions applies if
// the host's own callback calls these from here.
export { copyToClipboard, downloadDataUrl } from '@/utils/clipboard'

// frame.js must load from wherever THIS chunk actually got served from, not
// the host page's origin — a customer embedding our script must not resolve
// frame.js against their-product.com. import.meta.url gives exactly that,
// and works because vite.config.ts's `base: './'` resolves chunk imports the
// same way. frame.js sits one directory up from this chunk (dist/frame.js
// vs dist/assets/embed-*.js).
function frameScriptUrl(): string {
  // @vite-ignore: intentionally NOT statically resolvable at build time —
  // frame.js is a separate Rollup entry point, not an asset next to this
  // source file, and its real served location is only known at runtime.
  return new URL(/* @vite-ignore */ '../frame.js', import.meta.url).toString()
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

  // actions is only passed through when the host actually supplied some —
  // undefined tells frame.ts to run its own built-in default actions, inside
  // the iframe (see frame.ts's defaultActions for why that must happen there
  // and not here). Host-supplied actions are result-owning: they fully
  // replace our built-in defaults (no forced clipboard write on top of
  // theirs) and we don't auto-close — the host now owns the payload's
  // lifecycle and can call the returned MarkbitAPI's close() itself.
  const win = frame.contentWindow as (Window & { __markbitMount?: MarkbitMount }) | null
  win?.__markbitMount?.(imageUrl, {
    actions: config.actions?.map((action) => ({
      ...action,
      onClick: (payload) => {
        try {
          action.onClick(payload)
        } catch (error) {
          console.error(`[markbit] action "${action.id}" onClick threw`, error)
        }
      },
    })),
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
