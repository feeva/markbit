// Shared by src/loader/embed.ts (the embed widget's default copy/download
// action) and src/App.vue (the standalone product page) — kept out of embed.ts
// itself so App.vue doesn't need a static import into a module otherwise only
// ever reached via main.ts's dynamic import('./embed').

export async function copyToClipboard(dataUrl: string): Promise<void> {
  // Safari requires clipboard.write() to run synchronously within the click's
  // "user activation" window — awaiting fetch()/blob() first (as a naive
  // implementation would) means clipboard.write() runs after that window has
  // expired, and Safari silently rejects it with NotAllowedError. Passing a
  // Promise<Blob> straight into ClipboardItem instead defers the async work
  // while clipboard.write() itself is still called synchronously; this is
  // the documented cross-browser-safe pattern (Chrome/Firefox accept it too).
  // The MIME type must be known up front for the same reason, hence the
  // hardcoded 'image/png' — every previewDataUrl in this codebase comes from
  // canvas.toDataURL('image/png').
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': fetch(dataUrl).then((response) => response.blob()) }),
  ])
}

// Synchronous data: URL -> Blob conversion (no fetch/await): Safari has a
// history of not reliably honoring the `download` attribute on a raw
// `data:` href — it's been known to just navigate to/open the image instead
// of saving a file — whereas a `blob:` object URL is respected consistently.
// This must stay synchronous, not go through fetch().then(...): an `await`
// here before link.click() would reintroduce the exact user-activation
// problem worked around in copyToClipboard above (Safari requires
// gesture-gated actions to run within the same synchronous task as the
// click, not after a microtask/await boundary).
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

export function downloadDataUrl(dataUrl: string): void {
  const objectUrl = URL.createObjectURL(dataUrlToBlob(dataUrl))
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `markbit-${Date.now()}.png`
  link.click()
  URL.revokeObjectURL(objectUrl)
}
