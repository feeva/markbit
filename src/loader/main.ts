/**
 * Markbit Loader
 *
 * Meant to be included as a single <script src="loader.js" data-hotkey="ctrl+shift+m">
 * tag on a third-party page. This file only does hotkey detection — Vue, Konva,
 * Tailwind and AnnotationEditor itself are not imported here at all, and are only
 * fetched (via embed.ts, dynamically imported) the first time the hotkey fires.
 *
 * No iframe, no postMessage: the editor overlay mounts into a Shadow DOM host
 * attached directly to the page, in the same JS realm, so capturing the host page
 * (html2canvas) and mounting the editor can talk to each other as plain function
 * calls.
 */

export interface MarkbitConfig {
  hotkey?: string
}

export interface MarkbitAPI {
  open: () => void
  close: () => void
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
  private isDestroyed = false
  private isBusy = false

  private readonly handleHotkeyBound: (event: KeyboardEvent) => void

  constructor(config: MarkbitConfig) {
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
      await embed.open()
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

const autoInitializeFromScriptTag = (): void => {
  const script = getCurrentScriptElement()
  if (!script || window.Markbit) {
    return
  }

  const loader = new MarkbitLoader({ hotkey: script.dataset.hotkey })
  window.Markbit = {
    open: () => void loader.open(),
    close: () => void loader.close(),
  }
  console.log('[markbit] loader initialized', window.Markbit)
}

autoInitializeFromScriptTag()
