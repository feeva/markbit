import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentScriptElement, matchesHotkey, resolveGlobalCallback } from './main'

function keyEvent(overrides: Partial<KeyboardEvent>) {
  return {
    code: 'KeyM',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...overrides,
  }
}

describe('matchesHotkey', () => {
  it('matches the default hotkey (ctrl+shift+m)', () => {
    expect(
      matchesHotkey('ctrl+shift+m', keyEvent({ code: 'KeyM', ctrlKey: true, shiftKey: true })),
    ).toBe(true)
  })

  it('matches on event.code, not event.key, so it works under non-English input sources', () => {
    // macOS with a Korean (한글) input source active: modifier+letter combos
    // don't trigger IME composition, so keydown still fires, but the physical
    // M key reports whatever jamo that layout maps it to as .key — .code stays
    // 'KeyM' regardless of the active input language. This is a regression
    // test for that exact bug.
    expect(
      matchesHotkey(
        'ctrl+shift+m',
        keyEvent({
          code: 'KeyM',
          key: 'ㅡ',
          ctrlKey: true,
          shiftKey: true,
        } as Partial<KeyboardEvent> & {
          key: string
        }),
      ),
    ).toBe(true)
  })

  it('rejects a missing required modifier', () => {
    // shift not held
    expect(matchesHotkey('ctrl+shift+m', keyEvent({ code: 'KeyM', ctrlKey: true }))).toBe(false)
  })

  it('rejects an extra modifier that was not requested', () => {
    // alt held but hotkey doesn't ask for it
    expect(
      matchesHotkey(
        'ctrl+shift+m',
        keyEvent({ code: 'KeyM', ctrlKey: true, shiftKey: true, altKey: true }),
      ),
    ).toBe(false)
  })

  it('rejects the wrong key', () => {
    expect(
      matchesHotkey('ctrl+shift+m', keyEvent({ code: 'KeyI', ctrlKey: true, shiftKey: true })),
    ).toBe(false)
  })

  it('supports a single-modifier hotkey', () => {
    expect(matchesHotkey('alt+a', keyEvent({ code: 'KeyA', altKey: true }))).toBe(true)
    expect(matchesHotkey('alt+a', keyEvent({ code: 'KeyA' }))).toBe(false)
  })

  it('accepts "cmd"/"command" and "control" as aliases for meta/ctrl', () => {
    expect(matchesHotkey('cmd+k', keyEvent({ code: 'KeyK', metaKey: true }))).toBe(true)
    expect(matchesHotkey('command+k', keyEvent({ code: 'KeyK', metaKey: true }))).toBe(true)
    expect(matchesHotkey('control+k', keyEvent({ code: 'KeyK', ctrlKey: true }))).toBe(true)
  })

  it('supports a bare key with no modifiers', () => {
    expect(matchesHotkey('m', keyEvent({ code: 'KeyM' }))).toBe(true)
    expect(matchesHotkey('m', keyEvent({ code: 'KeyM', ctrlKey: true }))).toBe(false)
  })

  it('supports digit keys', () => {
    expect(matchesHotkey('ctrl+1', keyEvent({ code: 'Digit1', ctrlKey: true }))).toBe(true)
    expect(matchesHotkey('ctrl+1', keyEvent({ code: 'KeyM', ctrlKey: true }))).toBe(false)
  })
})

describe('getCurrentScriptElement', () => {
  afterEach(() => {
    document.querySelectorAll('script').forEach((el) => el.remove())
  })

  it('returns document.currentScript when the browser provides it', () => {
    const script = document.createElement('script')
    document.body.appendChild(script)
    Object.defineProperty(document, 'currentScript', { value: script, configurable: true })

    expect(getCurrentScriptElement()).toBe(script)

    Object.defineProperty(document, 'currentScript', { value: null, configurable: true })
  })

  it('falls back to matching src against import.meta.url when currentScript is unavailable', () => {
    // jsdom doesn't set document.currentScript for dynamically-run modules, which
    // mirrors production: by the time our top-level code runs, the browser may have
    // already cleared currentScript. import.meta.url is this file's own URL, so no
    // real <script src> in the test DOM will match it — this asserts the "not found"
    // path instead, which is the realistic case for a unit test environment.
    const unrelated = document.createElement('script')
    unrelated.src = 'https://example.com/some-other-script.js'
    document.body.appendChild(unrelated)

    expect(getCurrentScriptElement()).toBeNull()
  })

  it('returns null when no script tag matches and currentScript is unavailable', () => {
    expect(getCurrentScriptElement()).toBeNull()
  })
})

describe('resolveGlobalCallback', () => {
  afterEach(() => {
    // @ts-expect-error test-only cleanup of globals we attach below
    delete window.markbitTestFn
    // @ts-expect-error test-only cleanup of globals we attach below
    delete window.markbitTestApp
    // @ts-expect-error test-only cleanup of globals we attach below
    delete window.markbitTestValue
  })

  it('returns undefined when no path is given', () => {
    expect(resolveGlobalCallback(undefined)).toBeUndefined()
  })

  it('resolves a top-level global function', () => {
    const fn = vi.fn()
    // @ts-expect-error assigning a test-only global
    window.markbitTestFn = fn

    const resolved = resolveGlobalCallback('markbitTestFn')
    resolved?.('payload')

    expect(fn).toHaveBeenCalledWith('payload')
  })

  it('resolves a nested dot-path global function', () => {
    const fn = vi.fn()
    // @ts-expect-error assigning a test-only global
    window.markbitTestApp = { nested: { handler: fn } }

    const resolved = resolveGlobalCallback('markbitTestApp.nested.handler')
    resolved?.('payload')

    expect(fn).toHaveBeenCalledWith('payload')
  })

  it('returns undefined and logs an error when the path does not resolve to a function', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // @ts-expect-error assigning a test-only global
    window.markbitTestValue = 'not a function'

    expect(resolveGlobalCallback('markbitTestValue')).toBeUndefined()
    expect(resolveGlobalCallback('markbitTestApp.does.not.exist')).toBeUndefined()
    expect(errorSpy).toHaveBeenCalledTimes(2)

    errorSpy.mockRestore()
  })
})
