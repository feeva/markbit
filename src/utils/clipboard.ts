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

export function downloadDataUrl(dataUrl: string): void {
  // A data: URL downloads directly via the anchor's `download` attribute —
  // no fetch/blob roundtrip needed (that's only required for
  // clipboard.write(), which needs a Blob, not a URL).
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `markbit-${Date.now()}.png`
  link.click()
}
