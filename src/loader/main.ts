/**
 * Markbit Loader
 *
 * Two ways to use this:
 *
 * 1. `<script src="loader.js" data-hotkey="ctrl+shift+m" data-on-copy="...">` on a
 *    third-party page — this file's own module-eval-time code detects that tag
 *    and self-initializes from its `data-*` attributes (see
 *    autoInitializeFromScriptTag() below).
 * 2. `import { init } from 'loader.js'` for bundler/ESM consumers, who call
 *    init({ ... }) themselves with real callback function references (data
 *    attributes can only carry strings, not functions).
 *
 * Either way, this file only does hotkey detection and config wiring — Vue,
 * Konva, Tailwind and AnnotationEditor itself are not imported here at all,
 * and are only fetched (via embed.ts, dynamically imported) the first time
 * the editor actually opens.
 *
 * Vue+Konva+AnnotationEditor mount inside a `srcdoc` iframe, not this page's
 * own DOM (see embed.ts/frame.ts) — that's a separate concern from this
 * file, which never touches the DOM beyond reading the <script> tag itself.
 */
import type { AnnotationSavePayload } from '@/types/annotations'

export type { AnnotationSavePayload }

export interface MarkbitConfig {
  hotkey?: string
  onOpen?: () => void
  // Result-owning: if supplied, fully replaces Markbit's built-in
  // clipboard-copy/file-download action instead of running alongside it —
  // see embed.ts's open() for why.
  onCopy?: (payload: AnnotationSavePayload) => void
  onDownload?: (payload: AnnotationSavePayload) => void
  // Lifecycle notification only: Markbit always tears down the overlay
  // itself regardless of this callback.
  onClose?: () => void
}

export interface MarkbitAPI {
  open: () => void
  close: () => void
  destroy: () => void
}

// KeyboardEvent.key is layout/input-method dependent: e.g. on macOS with a
// Korean (한글) input source active, the physical M key produces event.key ===
// 'ㅡ' (or whatever jamo that layout maps it to), not 'm' — modifier+letter
// combos don't trigger IME composition, so a normal keydown still fires, it
// just carries a different .key. event.code reflects the physical key
// position and is unaffected by the active input language, so that's what we
// match the letter/digit portion against instead.
const codeForKey = (key: string): string => {
  if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`
  if (/^[0-9]$/.test(key)) return `Digit${key}`
  return key
}

// Exported as a pure function (no `this`, no DOM) so it can be unit-tested directly
// without exercising the rest of the loader (script-tag detection, dynamic import
// of embed.ts, etc.) — see main.test.ts.
export const matchesHotkey = (
  hotkey: string,
  event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>,
): boolean => {
  const keys = hotkey.toLowerCase().split('+')
  const key = keys[keys.length - 1] || 'm'

  return (
    event.code === codeForKey(key) &&
    event.ctrlKey === (keys.includes('ctrl') || keys.includes('control')) &&
    event.shiftKey === keys.includes('shift') &&
    event.altKey === (keys.includes('alt') || keys.includes('option')) &&
    event.metaKey === (keys.includes('meta') || keys.includes('cmd') || keys.includes('command'))
  )
}

export const getCurrentScriptElement = (): HTMLScriptElement | null => {
  const currentScript = document.currentScript
  if (currentScript instanceof HTMLScriptElement) {
    return currentScript
  }

  const moduleHref = new URL(import.meta.url, window.location.href).href
  const scripts = Array.from(document.querySelectorAll('script[src]'))

  for (let index = scripts.length - 1; index >= 0; index -= 1) {
    const script = scripts[index]
    if (!(script instanceof HTMLScriptElement)) {
      continue
    }
    try {
      if (new URL(script.src, window.location.href).href === moduleHref) {
        return script
      }
    } catch {
      continue
    }
  }

  return null
}

export class MarkbitLoader {
  private hotkey: string
  private config: MarkbitConfig
  private isDestroyed = false
  private isBusy = false

  private readonly handleHotkeyBound: (event: KeyboardEvent) => void

  constructor(config: MarkbitConfig) {
    this.config = config
    this.hotkey = config.hotkey ?? 'ctrl+shift+m'
    this.handleHotkeyBound = this.handleHotkey.bind(this)
    document.addEventListener('keydown', this.handleHotkeyBound)
  }

  private handleHotkey(event: KeyboardEvent): void {
    if (this.isDestroyed) return
    if (!matchesHotkey(this.hotkey, event)) return

    event.preventDefault()
    void this.open()
  }

  public async open(): Promise<void> {
    if (this.isDestroyed || this.isBusy) return

    this.isBusy = true
    try {
      // First hotkey press downloads Vue+Konva+Tailwind+AnnotationEditor as a
      // separate chunk; every subsequent press reuses the already-loaded module.
      const embed = await import('./embed')
      if (embed.isOpen()) {
        embed.close()
        return
      }
      await embed.open(this.config)
    } catch (error) {
      console.error('[markbit] failed to open editor', error)
    } finally {
      this.isBusy = false
    }
  }

  public async close(): Promise<void> {
    const embed = await import('./embed')
    embed.close()
  }

  public destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true
    document.removeEventListener('keydown', this.handleHotkeyBound)
  }
}

declare global {
  interface Window {
    Markbit?: MarkbitAPI
  }
}

export function init(config: MarkbitConfig = {}): MarkbitAPI {
  const loader = new MarkbitLoader(config)
  return {
    open: () => void loader.open(),
    close: () => void loader.close(),
    destroy: () => loader.destroy(),
  }
}

// data-on-copy/data-on-download/etc. hold a dot-path to a function already
// attached to `window` (the same pattern reCAPTCHA's data-callback uses) —
// data-* attributes can only carry strings, not function references, so
// script-tag users who want a real callback need one extra level of
// indirection that ESM/import users (who call init() directly) don't.
// This resolves once at init time, not on every open/copy/download.
//
// <script type="module"> is deferred (runs after the document is parsed), so
// a customer's own inline <script> that defines window.myApp = {...} can be
// placed either before or after Markbit's own <script> tag in their HTML.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- adapter for
// an arbitrary global function whose real signature is only known by the
// caller (see the MarkbitConfig-typed usages below)
export const resolveGlobalCallback = (
  path: string | undefined,
): ((...args: any[]) => void) | undefined => {
  if (!path) return undefined

  const value = path
    .split('.')
    .reduce<unknown>(
      (obj, key) =>
        obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined,
      window,
    )

  if (typeof value !== 'function') {
    console.error(`[markbit] "${path}" does not resolve to a function on window`)
    return undefined
  }

  return value as (...args: any[]) => void
}

const autoInitializeFromScriptTag = (): void => {
  const script = getCurrentScriptElement()
  if (!script || window.Markbit) {
    return
  }

  window.Markbit = init({
    hotkey: script.dataset.hotkey,
    onOpen: resolveGlobalCallback(script.dataset.onOpen),
    onCopy: resolveGlobalCallback(script.dataset.onCopy),
    onDownload: resolveGlobalCallback(script.dataset.onDownload),
    onClose: resolveGlobalCallback(script.dataset.onClose),
  })
  console.log('[markbit] loader initialized', window.Markbit)
}

autoInitializeFromScriptTag()
