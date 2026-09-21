// Fire-and-forget usage counter for the standalone landing page only — never
// called from the embed widget (src/loader/*), which runs on third-party
// sites and would break the "no upload unless you share" promise if it
// phoned home. sendBeacon so it never blocks navigation/unload; silently
// no-ops on any failure since this must never affect the actual product.
export type TrackEvent =
  'pageview' | 'image_loaded' | 'copy' | 'download' | 'share' | 'returning_visit'

export function track(event: TrackEvent): void {
  try {
    const body = JSON.stringify({ event })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
    } else {
      void fetch('/api/track', { method: 'POST', body, keepalive: true })
    }
  } catch {
    // Never let usage tracking break the actual product.
  }
}

// No per-visitor ID is ever sent to the server — this flag only ever leaves
// the browser as the aggregate 'returning_visit' count (see track.ts's own
// module comment and functions/api/track.ts's schema, which has no column
// for it). Set only once someone actually loads an image (not on every bare
// pageview), so "returning" means "has used Markbit before," not just
// "loaded this page once already."
const HAS_USED_STORAGE_KEY = 'has_used_markbit'

export function hasUsedMarkbitBefore(): boolean {
  try {
    return localStorage.getItem(HAS_USED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function markHasUsedMarkbit(): void {
  try {
    localStorage.setItem(HAS_USED_STORAGE_KEY, 'true')
  } catch {
    // Best-effort only — worst case, a returning user's next visit doesn't
    // count as 'returning_visit'.
  }
}
