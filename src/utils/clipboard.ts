// Shared by src/loader/embed.ts (the embed widget's default copy/download
// action) and src/App.vue (the standalone product page) — kept out of embed.ts
// itself so App.vue doesn't need a static import into a module otherwise only
// ever reached via main.ts's dynamic import('./embed').

export async function copyToClipboard(dataUrl: string): Promise<void> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
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
