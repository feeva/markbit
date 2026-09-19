/**
 * The heavy part of the Markbit loader: capture the host page, then open an
 * isolated overlay running frame.ts (Vue+Konva+AnnotationEditor). Only loaded
 * via dynamic import() when the hotkey fires — never on page load.
 *
 * Uses a blank iframe + an injected <script>, not Shadow DOM: an about:blank
 * iframe is same-origin with the page that created it (no postMessage needed —
 * see frame.ts's window.__markbitMount, called directly via contentWindow), but
 * it's a genuinely separate Document. That means Tailwind/DaisyUI's :root-scoped
 * CSS custom properties work completely normally — Shadow DOM shares the host
 * page's Document, so :root there only ever matches the *real* document root,
 * never the shadow root, which broke DaisyUI's theming entirely.
 */
import type { AnnotationSavePayload } from '@/types/annotations'
import type { MarkbitMount } from './frame'

let iframe: HTMLIFrameElement | null = null
let originalOverflow = { html: '', body: '' }

async function captureHostPage(): Promise<string> {
  const viewport = window.visualViewport
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth))
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight))
  const x = Math.max(0, Math.round(viewport?.pageLeft ?? window.scrollX))
  const y = Math.max(0, Math.round(viewport?.pageTop ?? window.scrollY))

  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(document.documentElement, { x, y, width, height, scale: 1 })
  return canvas.toDataURL('image/png')
}

async function copyToClipboard(dataUrl: string): Promise<void> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}

function createBlankIframe(): HTMLIFrameElement {
  const el = document.createElement('iframe')
  el.id = 'markbit-host'
  el.src = 'about:blank'
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    border: 'none',
    zIndex: '2147483647',
  })
  document.body.appendChild(el)
  return el
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

function injectFrameScript(frame: HTMLIFrameElement): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const doc = frame.contentDocument
    if (!doc) {
      reject(new Error('[markbit] iframe contentDocument unavailable'))
      return
    }
    const script = doc.createElement('script')
    script.type = 'module'
    script.src = frameScriptUrl()
    script.addEventListener('load', () => resolvePromise())
    script.addEventListener('error', () => reject(new Error('[markbit] failed to load frame.js')))
    doc.head.appendChild(script)
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

export async function open(): Promise<void> {
  if (iframe) return

  const imageUrl = await captureHostPage()
  if (iframe) return // guard against a second trigger firing while capture was in flight

  const frame = createBlankIframe()
  iframe = frame

  originalOverflow = {
    html: document.documentElement.style.overflow,
    body: document.body.style.overflow,
  }
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'

  await injectFrameScript(frame)
  frame.contentWindow?.focus() // so an immediate Escape reaches frame.ts's own listener

  const win = frame.contentWindow as (Window & { __markbitMount?: MarkbitMount }) | null
  win?.__markbitMount?.(
    imageUrl,
    (payload: AnnotationSavePayload) => {
      void copyToClipboard(payload.previewDataUrl)
        .catch((error) => console.error('[markbit] clipboard copy failed', error))
        .finally(() => close())
    },
    () => close(),
  )
}
