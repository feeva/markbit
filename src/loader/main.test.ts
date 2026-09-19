import { afterEach, describe, expect, it } from 'vitest'
import { getCurrentScriptElement, matchesHotkey } from './main'

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
