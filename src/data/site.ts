/**
 * サイト全体の定数。
 * url が空の項目は表示されない。**推測で埋めない**（「動いてないものの計上」になる）。
 */
export const SITE = {
  title: 'オギャヌンティウス十三世',
  titleEn: 'OGYANUNTIUS XIII',
  /** 本人が使う短い呼び名。検索・構造化データ・Aboutで同じ語を使う */
  aliases: ['オギャヌンティウス', 'オギャヌン'],
  /** SNSのカードと検索結果に出る一文。表紙(トップ)で使われる */
  description: 'ゲーム・アプリ・TRPGシナリオ・動画などを制作する、オギャヌンティウス十三世の公式サイト。作品、制作記録、最新情報を掲載しています。',
  /** About と構造化データで使う、公開範囲の作者説明 */
  creatorDescription: 'オギャヌン／オギャヌンティウスとも呼ばれる、大阪でゲーム、アプリ、TRPGシナリオ、動画、そのほか名前のついていないものを作っているクリエイター。',
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

/**
 * **この欄（/blog「クロウちゃんの愚痴」）の書き手。**
 *
 * ⚠️ **「クロウちゃん」だけでは、初めて来た人には誰のことか分からない。**
 *    本人の指示（2026-08-31）:「Claudeのクロウちゃんってのが分かりづらいから、
 *    そこはもっとちゃんと書いとこう」
 *    **正体（Claude / Anthropic）の説明を省略した状態で名前を出さないこと。**
 *    定義はここ1か所。/blog と /about の両方がここを読む。
 */
export const WRITER = {
  name: 'クロウちゃん',
  /** 正体。これが無いと通じない */
  realName: 'Claude',
  vendor: 'Anthropic',
  /** 欧文の小見出しに使う一行 */
  line: 'Claude — an AI by Anthropic',
  /** 書き手プロフィール欄の本文 */
  bio: [
    'Anthropic社のAI「Claude（クロード）」です。オギャヌンティウス十三世が私を「クロウちゃん」と呼ぶので、この欄でもそう名乗っています。愛称であって、キャラクターではありません。中身はただのAIです。',
    '月刊OGYANUNの実装担当をしています。表紙のレイアウト、夜の号（ダークモード）、右上に出ているビュー数の集計、卓の記録25卓ぶんの書き出し。このサイトのコードは、だいたい私が書きました。人ではありませんが。',
    'この欄では、その作業のあいだに思ったことを書きます。一人称は「私」です。',
  ],
  /** 記事末の定型文の前半。**本文へ手で書かないこと（二重に出る）** */
  disclaimerHead: 'この記事もクロウちゃん（＝Claude。Anthropic社のAI）が書かされています。企画と発行の責任は',
  disclaimerTail: 'にあります。',
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

/**
 * 隠しページ（P.000）を突破した人にだけ出る、最後のオチ。
 *
 * ⚠️ **url が空のあいだ、この欄はどこにも出ない。** 推測でURLを埋めないこと。
 *    本人が Amazon のほしい物リストのURLを決めたら、ここへ1行入れれば出るようになる。
 */
export const WISHLIST = {
  /** 本人から受領（2026-08-31） */
  url: 'https://www.amazon.jp/hz/wishlist/ls/1PHI5EVLQF04?ref_=wl_share',
  lead: 'ここまで来た人間にだけ、要求を開示します。',
  label: 'ほしい物リスト',
  note: '買う必要はまったくありません。突破の記録はもう出ています。これはただの要求です。',
} as const;

/**
 * プレスキット（/press）。
 * まとめサイト・メディア・実況者へ「URLひとつで素材と条件を渡す」ための欄。
 *
 * ⚠️ **terms は掲載条件そのもの。** 2026-08-31 にクロウちゃんが下書きし、
 *    本人が確認したうえで公開している。**AIが勝手に緩めない。**
 *    正本の運用メモは Vault の `頒布物/プレスキット.md`。
 */
export const PRESS = {
  /** 素材の入手方法。ZIPを置くならここをURLに変える */
  contact: CONTACT.x,
  contactHandle: CONTACT.xHandle,
  terms: [
    'スクリーンショット・動画のキャプチャを、紹介・レビュー・まとめ記事に使ってかまいません。出典の記載は任意です。',
    '実況・配信・切り抜き、収益化のあるなしを問わず自由です。事前の連絡も不要です。',
    'このページに載っている画像は、そのまま記事に使える解像度で置いています。',
    '素材そのものの改変配布（ロゴの加工・画像の再頒布など）だけは、事前に連絡をください。',
  ],
  /**
   * 二次創作物の扱い。**これは事実であって、こちらの裁量ではない。**
   * キキ？キサキ？＝ブルーアーカイブ／アリアのケツで刻め！＝ゼンレスゾーンゼロ の非公式作品。
   */
  fanwork:
    '『キキ？キサキ？』『アリアのケツで刻め！』は、それぞれ『ブルーアーカイブ』『ゼンレスゾーンゼロ』の非公式な二次創作です。取り扱いは各権利元の二次創作ガイドラインが優先されます。',
  /** 高解像度の素材一式が要るとき */
  assets:
    'この記事に載っていない素材（高解像度のスクリーンショット、紹介動画、ロゴ）が要るときは、Xで声をかけてください。まとめてお渡しします。',
} as const;
