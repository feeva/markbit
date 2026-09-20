// Aggregate-only usage counter for markbit.abcbox.kr's own landing page —
// never wired into the embed widget itself (that runs on third-party sites,
// and calling home from there would break the "no upload unless you share"
// promise; see PLAN.md's 2026-09-20 Decision Log). No per-visitor
// identifiers, cookies, or IPs are stored or logged — just a count per
// (day, event) pair, queryable via /api/stats.
//
// Env.DB comes from wrangler.jsonc's d1_databases binding; types are in the
// generated worker-configuration.d.ts (see `npm run cf:types`).

const ALLOWED_EVENTS = new Set(['pageview', 'image_loaded', 'copy', 'download', 'share'])

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: unknown
  try {
    // navigator.sendBeacon posts a Blob/string body, not necessarily with a
    // JSON content-type, so parse leniently rather than checking headers.
    body = await context.request.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const event = (body as { event?: unknown })?.event
  if (typeof event !== 'string' || !ALLOWED_EVENTS.has(event)) {
    return new Response('Unknown event', { status: 400 })
  }

  const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

  await context.env.DB.prepare(
    `INSERT INTO events (day, event, count) VALUES (?1, ?2, 1)
     ON CONFLICT(day, event) DO UPDATE SET count = count + 1`,
  )
    .bind(day, event)
    .run()

  return new Response(null, { status: 204 })
}
