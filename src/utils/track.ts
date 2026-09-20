// Fire-and-forget usage counter for the standalone landing page only — never
// called from the embed widget (src/loader/*), which runs on third-party
// sites and would break the "no upload unless you share" promise if it
// phoned home. sendBeacon so it never blocks navigation/unload; silently
// no-ops on any failure since this must never affect the actual product.
export type TrackEvent = 'pageview' | 'image_loaded' | 'copy' | 'download' | 'share'

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
