/**
 * サイト全体の定数。**URLはまだ埋まっていない。**
 * TODO(本人確認): X / GitHub / YouTube の実URLを入れる。
 *   推測で埋めると「動いてないものの計上」になるので、空のまま置いてある。
 */
export const SITE = {
  title: 'オギャヌンティウス十三世',
  titleEn: 'OGYANUNTIUS XIII',
  description:
    'オギャヌンティウス十三世が発行する一冊の雑誌。ゲーム、アプリ、TRPGシナリオ、動画、そのほか。',
  /** 未購入。無料サブドメインで公開してから差し替える */
  origin: 'https://ogyanuntiusxiii.com',
  ogImage: '/images/ogp/default.svg',
} as const;

export type SiteLink = { label: string; url: string; note?: string };

/** LINKS 欄。url が空の項目は表示されない */
export const LINKS: SiteLink[] = [
  { label: 'X', url: '' },        // TODO(本人確認)
  { label: 'GitHub', url: '' },   // TODO(本人確認)
  { label: 'YouTube', url: '' },  // TODO(本人確認)
  { label: 'BOOTH', url: 'https://tiiinnstudio.booth.pm/' },
];
