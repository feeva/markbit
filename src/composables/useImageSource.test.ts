import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useImageSource } from './useImageSource'

function imageFile(name = 'photo.png', type = 'image/png') {
  return new File(['fake-bytes'], name, { type })
}

function textFile(name = 'notes.txt') {
  return new File(['hello'], name, { type: 'text/plain' })
}

function dispatchPaste(item: { type: string; getAsFile: () => File | null }) {
  window.dispatchEvent(Object.assign(new Event('paste'), { clipboardData: { items: [item] } }))
}

// jsdom doesn't implement createObjectURL/revokeObjectURL.
let nextUrl = 0
let source: ReturnType<typeof useImageSource>

beforeEach(() => {
  nextUrl = 0
  URL.createObjectURL = vi.fn(() => `blob:mock-${nextUrl++}`)
  URL.revokeObjectURL = vi.fn()
  source = useImageSource()
})

afterEach(() => {
  source.dispose()
  vi.restoreAllMocks()
})

describe('useImageSource', () => {
  it('loadFromFile accepts an image file', () => {
    source.loadFromFile(imageFile())

    expect(source.imageUrl.value).toBe('blob:mock-0')
    expect(source.error.value).toBeNull()
  })

  it('loadFromFile rejects a non-image file and leaves imageUrl unchanged', () => {
    source.loadFromFile(textFile())

    expect(source.imageUrl.value).toBeNull()
    expect(source.error.value).toContain('notes.txt')
  })

  it('handleFileInputChange extracts the picked file and resets the input value', () => {
    // A real <input type="file"> only allows jsdom/the browser to set .value
    // to '' programmatically (spec-enforced), so a plain mock object stands
    // in for it here rather than fighting that restriction.
    const input = { files: [imageFile()], value: 'C:\\fakepath\\photo.png' }

    source.handleFileInputChange({ target: input } as unknown as Event)

    expect(source.imageUrl.value).toBe('blob:mock-0')
    expect(input.value).toBe('')
  })

  it('handleDrop extracts a file from dataTransfer, prevents default, and resets dragging state', () => {
    source.isDraggingOver.value = true
    const preventDefault = vi.fn()

    source.handleDrop({
      preventDefault,
      dataTransfer: { files: [imageFile()] },
    } as unknown as DragEvent)

    expect(preventDefault).toHaveBeenCalled()
    expect(source.isDraggingOver.value).toBe(false)
    expect(source.imageUrl.value).toBe('blob:mock-0')
  })

  it('handleDragOver/handleDragLeave toggle isDraggingOver', () => {
    source.handleDragOver({ preventDefault: vi.fn() } as unknown as DragEvent)
    expect(source.isDraggingOver.value).toBe(true)

    source.handleDragLeave()
    expect(source.isDraggingOver.value).toBe(false)
  })

  it('pasting an image sets imageUrl', () => {
    dispatchPaste({ type: 'image/png', getAsFile: () => imageFile() })

    expect(source.imageUrl.value).toBe('blob:mock-0')
  })

  it('pasting non-image clipboard data is a silent no-op (no error)', () => {
    dispatchPaste({ type: 'text/plain', getAsFile: () => null })

    expect(source.imageUrl.value).toBeNull()
    expect(source.error.value).toBeNull()
  })

  it('pasting while an image is already loaded is a no-op (does not discard in-progress work)', () => {
    source.loadFromFile(imageFile('first.png'))
    expect(source.imageUrl.value).toBe('blob:mock-0')

    dispatchPaste({ type: 'image/png', getAsFile: () => imageFile('second.png') })

    expect(source.imageUrl.value).toBe('blob:mock-0')
  })

  it('reset revokes the object URL and clears state', () => {
    source.loadFromFile(imageFile())
    expect(source.imageUrl.value).toBe('blob:mock-0')

    source.reset()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-0')
    expect(source.imageUrl.value).toBeNull()
    expect(source.error.value).toBeNull()
  })
})
