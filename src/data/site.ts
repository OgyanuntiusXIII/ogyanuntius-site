/**
 * サイト全体の定数。
 * url が空の項目は表示されない。**推測で埋めない**（「動いてないものの計上」になる）。
 */
export const SITE = {
  title: 'オギャヌンティウス十三世',
  titleEn: 'OGYANUNTIUS XIII',
  /** SNSのカードと検索結果に出る一文。表紙(トップ)で使われる */
  description: 'ゲーム・アプリ・TRPGシナリオ・動画などを制作する、オギャヌンティウス十三世の公式サイト。作品、制作記録、最新情報を掲載しています。',
  /** About と構造化データで使う、公開範囲の作者説明 */
  creatorDescription: '大阪でゲーム、アプリ、TRPGシナリオ、動画、そのほか名前のついていないものを作っているクリエイター。',
  /** 本番URL。Cloudflare Pages の custom domain（2026-08-27 有効化） */
  origin: 'https://ogyanuntiusxiii.com',
  /** SNS共通のOGP。**SVGは X も Facebook も描画しない**ので JPEG にする */
  ogImage: '/images/ogp/default.jpg',
  /** Person 構造化データで「同じ作者」として結ぶ公式アカウント */
  sameAs: [
    'https://x.com/ogyanuntiusxiii',
    'https://www.youtube.com/@ogyanuntiusxiii',
    'https://github.com/OgyanuntiusXIII',
    'https://tiiinnstudio.booth.pm/',
  ],
} as const;

export type SiteLink = { label: string; url: string; note?: string };

/** LINKS 欄。url が空の項目は表示されない */
export const LINKS: SiteLink[] = [
  { label: 'X', url: 'https://x.com/ogyanuntiusxiii' },
  { label: 'BOOTH', url: 'https://tiiinnstudio.booth.pm/' },
  { label: 'GitHub', url: 'https://github.com/OgyanuntiusXIII/ogyanuntius-site' },
  { label: 'YouTube', url: 'https://www.youtube.com/@ogyanuntiusxiii' },
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
