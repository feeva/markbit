// GET /api/stats?key=<STATS_SECRET> — view the aggregate counters written by
// track.ts. Gated by a shared secret (not because the numbers are sensitive
// — they're just counts, no PII — but there's no reason to broadcast usage
// volume publicly for free). Set the secret with:
//   npx wrangler pages secret put STATS_SECRET --project-name markbit

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const key = url.searchParams.get('key')
  if (!context.env.STATS_SECRET || key !== context.env.STATS_SECRET) {
    return new Response('Not found', { status: 404 })
  }

  const { results } = await context.env.DB.prepare(
    'SELECT day, event, count FROM events ORDER BY day DESC, event ASC',
  ).all()

  return Response.json(results)
}
