import { ref } from 'vue'

// Page-level image loading (paste / drag-drop / file-picker) for the
// standalone product page (src/App.vue). Kept out of AnnotationEditor.vue
// (which only ever takes a ready imageUrl prop) and out of
// components/AnnotationEditor/composables/ (that directory is Konva/editor
// internals, not a page concern).
//
// No onMounted/onUnmounted: this is only ever instantiated once, at the app
// root, which lives for the page's whole lifetime — so the paste listener is
// registered immediately (not deferred to mount) and never explicitly torn
// down. That also keeps this plain-function testable with Vitest alone,
// without needing @vue/test-utils to fake a component instance.
export function useImageSource() {
  const imageUrl = ref<string | null>(null)
  const isDraggingOver = ref(false)
  const error = ref<string | null>(null)

  const setImageFromFile = (file: File) => {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
    }
    imageUrl.value = URL.createObjectURL(file)
    error.value = null
  }

  const loadFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      error.value = `"${file.name}" is not an image file.`
      return
    }
    setImageFromFile(file)
  }

  const handleFileInputChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    // Reset so re-picking the identical file still fires `change`.
    input.value = ''
    if (file) {
      loadFromFile(file)
    }
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    isDraggingOver.value = false
    const file = event.dataTransfer?.files?.[0]
    if (file) {
      loadFromFile(file)
    }
  }

  const handleDragOver = (event: DragEvent) => {
    // Required so `drop` fires instead of the browser navigating to the file.
    event.preventDefault()
    isDraggingOver.value = true
  }

  const handleDragLeave = () => {
    isDraggingOver.value = false
  }

  // Global, not tied to a focused drop target — paste should work anywhere on
  // the page. Guarded against overwriting an in-progress annotation: without
  // this, an accidental paste while the editor is already open would silently
  // discard whatever the user was working on with no confirmation.
  const handlePaste = (event: ClipboardEvent) => {
    if (imageUrl.value) return

    const item = Array.from(event.clipboardData?.items ?? []).find((candidate) =>
      candidate.type.startsWith('image/'),
    )
    // No image in the clipboard (e.g. an incidental text paste elsewhere on
    // the page) is a silent no-op, not an error — `error` is reserved for
    // explicit actions (drop/file-picker) that supplied a non-image file.
    const file = item?.getAsFile()
    if (file) {
      setImageFromFile(file)
    }
  }

  window.addEventListener('paste', handlePaste)

  const reset = () => {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
    }
    imageUrl.value = null
    error.value = null
  }

  // Not needed by App.vue (the root singleton lives for the page's whole
  // lifetime) — exposed so tests can remove the listener between cases
  // instead of leaking one `window` listener per instantiated instance.
  const dispose = () => window.removeEventListener('paste', handlePaste)

  return {
    imageUrl,
    isDraggingOver,
    error,
    loadFromFile,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    reset,
    dispose,
  }
}
