// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // ドメインは未購入。無料サブドメインで公開してから差し替える（⑦ #118 / 決定パターン3）
  site: 'https://ogyanuntiusxiii.com',
  trailingSlash: 'never',
  // 既定の directory 形式。/works/desk-takko で引ける（仕様書11章）
  image: { responsiveStyles: true },
});
