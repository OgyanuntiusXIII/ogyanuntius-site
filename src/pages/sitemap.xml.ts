import { getCollection } from 'astro:content';
import { SITE } from '../data/site';

const xmlEscape = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export async function GET() {
  const [works, scenarios, blog] = await Promise.all([
    getCollection('works'),
    getCollection('scenarios'),
    getCollection('blog'),
  ]);

  const paths = [
    '/',
    '/about',
    '/contents',
    '/blog',
    ...works.map((entry) => `/works/${entry.id}`),
    ...scenarios.map((entry) => `/scenario/${entry.id}`),
    ...blog.map((entry) => `/blog/${entry.id}`),
  ];

  const urls = [...new Set(paths)]
    .map((path) => new URL(path, SITE.origin).href)
    .map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`)
    .join('\n');

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
