/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly CRAFT_GRAPHQL_URL: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
