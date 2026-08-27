/**
 * サイト全体の定数。
 * TODO(本人確認): YouTube の実URLを入れる。
 *   推測で埋めると「動いてないものの計上」になるので、空のまま置いてある。
 *   空の項目は表示されないので、埋まるまでは出ない。
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
  { label: 'X', url: 'https://x.com/ogyanuntiusxiii' },
  { label: 'BOOTH', url: 'https://tiiinnstudio.booth.pm/' },
  { label: 'GitHub', url: 'https://github.com/OgyanuntiusXIII/ogyanuntius-site' },
  { label: 'YouTube', url: '' },  // TODO(本人確認)
];

/**
 * 制作クレジット。奥付と About に小さく出す。
 * **号ごとではなくサイト全体の事実**なので issues 側ではなくここに置く。
 */
export const CREDITS = {
  label: '制作',
  text: 'このサイトの制作には AI支援・SDXL・GPT Image-2 を使用し、加筆しています。',
} as const;

/**
 * 連絡先。**Xのみ**（本人・2026-08-27）。
 * メールアドレスは平文で載せるとスパムに拾われるため、載せない判断をした。
 */
export const CONTACT = {
  x: 'https://x.com/ogyanuntiusxiii',
  xHandle: '@ogyanuntiusxiii',
} as const;
