/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Baked in at build time via .env.production; deliberately unset for local
  // dev/preview/e2e builds — see src/loader/embed.ts's frameScriptUrl().
  readonly VITE_ASSET_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
