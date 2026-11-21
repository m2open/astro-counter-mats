// Blog RSS feed at /rss.xml — read by Zoho Social (Content Library → RSS Feeds) and feed readers.
import type { APIRoute } from 'astro';
import { craftQuery } from '../lib/craft';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://customcountermat.com')).origin;

  const data = await craftQuery(`
    {
      entries(section: "blog") {
        title
        slug
        postDate
        ... on blog_default_Entry {
          summary
          publishedDate
        }
      }
    }
  `);

  const posts = (data.entries as any[])
    .map((post) => ({ ...post, date: new Date(post.publishedDate ?? post.postDate) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const items = posts
    .map((post) => {
      const link = `${origin}/blog/${post.slug}/`;
      const summary = post.summary?.trim() || `${post.title} — article from Custom Counter Mat.`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <description>${escapeXml(summary)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Custom Counter Mat Blog</title>
    <link>${origin}/blog/</link>
    <description>Articles on custom counter mats, bar branding, and hospitality merchandising from an OEM counter mat manufacturer.</description>
    <language>en</language>
    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
