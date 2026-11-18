// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';

// Read CRAFT_GRAPHQL_URL from the shell/Cloudflare env first, then from .env files.
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const CRAFT_GRAPHQL_URL = process.env.CRAFT_GRAPHQL_URL ?? env.CRAFT_GRAPHQL_URL;

// Product pages with "Hide from listing" switched on in Craft are left out of the sitemap.
async function getHiddenProductPaths() {
  const res = await fetch(CRAFT_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '{ entries(section: "products") { slug ... on products_default_Entry { hideFromListing } } }',
    }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Craft GraphQL error (sitemap): ${json.errors[0].message}`);
  }
  return json.data.entries
    .filter((/** @type {any} */ e) => e.hideFromListing)
    .map((/** @type {any} */ e) => `/products/${e.slug}/`);
}

const hiddenPaths = await getHiddenProductPaths();

// https://astro.build/config
export default defineConfig({
  site: 'https://customcountermat.com',
  integrations: [
    sitemap({
      filter: (page) => !hiddenPaths.includes(new URL(page).pathname),
    }),
  ],
});
