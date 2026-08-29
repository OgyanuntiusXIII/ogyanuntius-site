import { getCollection } from 'astro:content';

/**
 * 本棚に並ぶ「本」を組み立てる。
 *
 * 本人の指定（2026-08-29）:
 * 「本来だったらただジャンルを選ぶ工程を、本を選ぶ工程にしたらいい」
 * 「**1アプリ一冊、じゃなくて、アプリ、シナリオ、でそれぞれ一冊にする**。
 *   今後ジャンルが増えてくるだろうから、先に作っとこうかってだけ。
 *   **でも今はいいや。今は創刊号と卓の記録だけで作っといて**」
 *
 * ＝ **1冊＝1ジャンル**（作品1件ではない）。カテゴリのメニューを別に持たず、
 *    棚から1冊抜くことが移動になる。
 *
 * ⚠️ **いまは意図的に2冊だけ**（創刊号・卓の記録）。
 *    ジャンル本を足したくなったら下の GENRES に1行足す。**それだけで棚に並ぶ。**
 */
export type Book = {
  title: string;
  href: string;
  kind: string;
  updated: Date;
  note: string;
  thumb?: string;
};

/**
 * ジャンル本の定義。**足すのはここ1行。**
 * `from` のコレクションに中身があるときだけ棚に出る（空の本を並べない）。
 * 更新日はそのジャンルで一番新しい作品の日付を使う。
 *
 * 例）アプリの棚を出したくなったら:
 *   { title: 'アプリ', kind: 'ジャンル', href: '/genre/app', from: 'works', category: 'app',
 *     note: '作って、配って、直しているもの', thumb: '/images/shelf/app.webp' },
 *
 * ⚠️ href の受け皿（ページ）を先に作ること。無いリンクを棚に出さない。
 */
const GENRES: Array<{
  title: string; kind: string; href: string;
  from: 'works' | 'scenarios'; category?: string;
  note: string; thumb?: string;
}> = [
  // 2026-08-29 時点では空。本人の指示で「今は創刊号と卓の記録だけ」
];

export async function getBooks(): Promise<Book[]> {
  const [works, scenarios, issues, sessions] = await Promise.all([
    getCollection('works'),
    getCollection('scenarios'),
    getCollection('issues'),
    getCollection('sessions'),
  ]);
  const pools = { works, scenarios };

  const books: Book[] = [];

  /* 号。バックナンバーが増えるとそのぶん棚に積まれる */
  for (const i of issues) {
    books.push({
      title: `${i.data.vol} ${i.data.label}`,
      href: '/contents',
      kind: '号',
      updated: i.data.published,
      /** theme は |- で改行が入る。帯は1行なので潰す */
      note: i.data.theme.replace(/\s*\n\s*/g, ' '),
      thumb: i.data.mainVisual,
    });
  }

  /* 卓の記録 */
  if (sessions.length) {
    const lastPlayed = sessions
      .map((s) => s.data.date)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1);
    books.push({
      title: '卓の記録',
      href: '/sessions',
      kind: '記録',
      updated: lastPlayed ? new Date(lastPlayed) : new Date(0),
      note: `回した卓と、座った卓 ${sessions.length}卓`,
      /* 本人が「卓報告ブックの表紙が要るときはこれ」と指定した立ち絵
         （『ニャルラトテップの仮面』の料理人） */
      thumb: '/images/shelf/sessions.webp',
    });
  }

  /* ジャンル本（いまは空） */
  for (const g of GENRES) {
    const items = pools[g.from].filter(
      (e) => !g.category || (e.data as { category?: string }).category === g.category
    );
    if (!items.length) continue;
    const newest = items
      .map((e) => +e.data.date)
      .reduce((a, b) => Math.max(a, b), 0);
    books.push({
      title: g.title, href: g.href, kind: g.kind,
      updated: new Date(newest), note: g.note, thumb: g.thumb,
    });
  }

  return books.sort((a, b) => +b.updated - +a.updated);
}
