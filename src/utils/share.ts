// Sample "Share" action for the demo/test surfaces (App.vue, embed-test.html)
// — a small, fully client-side use of the native OS share sheet. This is NOT
// PLAN.md's Phase 3 "Share Experiment" (hosted, shareable URL) — see the
// 2026-09-20 Decision Log entry.
import { dataUrlToBlob } from './clipboard'

export function canShareFile(): boolean {
  try {
    if (!navigator.share || !navigator.canShare) return false
    return navigator.canShare({ files: [new File([''], 'probe.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

// dataUrlToBlob is synchronous (no fetch/await), so this whole function's
// work up to the navigator.share() call stays inside the same synchronous
// task as the click that triggered it — required for the browser to honor
// the call as a user-gesture-gated action. See clipboard.ts's copyToClipboard/
// downloadDataUrl for the same discipline.
export async function shareDataUrl(dataUrl: string): Promise<void> {
  const file = new File([dataUrlToBlob(dataUrl)], `markbit-${Date.now()}.png`, {
    type: 'image/png',
  })
  await navigator.share({ files: [file], title: 'Markbit' })
}
