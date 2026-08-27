// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 本番URL。Cloudflare Pages の custom domain（2026-08-27 有効化）。
  // ここがズレると canonical と OGP が間違ったURLで配信される
  site: 'https://ogyanuntiusxiii.com',
  trailingSlash: 'never',
  // /about/index.html だと Cloudflare Pages が /about -> /about/ へ308を返し、
  // trailingSlash:'never' で出している canonical と食い違う（2026-08-27 実測）。
  // file 形式なら /about.html が生成され、Pages はそれを /about で直接返す。
  build: { format: 'file' },
  image: { responsiveStyles: true },
});
