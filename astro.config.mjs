// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 本番URL。Cloudflare Pages の custom domain（2026-08-27 有効化）。
  // ここがズレると canonical と OGP が間違ったURLで配信される
  site: 'https://ogyanuntiusxiii.com',
  trailingSlash: 'never',
  // 既定の directory 形式。/works/desk-takko で引ける（仕様書11章）
  image: { responsiveStyles: true },
});
