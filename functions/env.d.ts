// Augments the ambient Env interface generated into worker-configuration.d.ts
// (which only knows about wrangler.jsonc bindings) with secrets set
// out-of-band via `wrangler pages secret put`, which aren't declared there.
interface Env {
  STATS_SECRET?: string
}
