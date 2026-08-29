import { getCollection } from 'astro:content';

/**
 * 本棚に並ぶ「本」を組み立てる。
 *
 * 本人の構想（2026-08-29）:
 * 「アプリ、シナリオとかで、**本来だったらただジャンルを選ぶ工程を、本を選ぶ工程にしたらいい**」
 *
 * つまりこの一覧が、このサイトのナビゲーションそのもの。
 * カテゴリのメニューを別に持たない。**棚から1冊抜くことが、移動になる。**
 *
 * 並びは更新の新しい順。作品も号も同じ棚に置く（本人の指定）。
 */
export type Book = {
  title: string;
  href: string;
  kind: string;
  updated: Date;
  note: string;
  thumb?: string;
};

export async function getBooks(): Promise<Book[]> {
  const [works, scenarios, issues, sessions] = await Promise.all([
    getCollection('works'),
    getCollection('scenarios'),
    getCollection('issues'),
    getCollection('sessions'),
  ]);

  const lastPlayed = sessions
    .map((s) => s.data.date)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return [
    ...works.map((w) => ({
      title: w.data.title, href: `/works/${w.id}`, kind: '作品',
      updated: w.data.date, note: w.data.catch, thumb: w.data.thumbnail,
    })),
    ...scenarios.map((s) => ({
      title: s.data.title, href: `/scenario/${s.id}`, kind: 'シナリオ',
      updated: s.data.date, note: s.data.catch, thumb: s.data.thumbnail,
    })),
    ...(sessions.length
      ? [{
          title: '卓の記録', href: '/sessions', kind: '記録',
          updated: lastPlayed ? new Date(lastPlayed) : new Date(0),
          note: `回した卓と、座った卓 ${sessions.length}卓`,
          /* 本人が「卓報告ブックの表紙が要るときはこれ」と指定した立ち絵
             （『ニャルラトテップの仮面』の料理人）。棚で面出しになるのがその場面 */
          thumb: '/images/shelf/sessions.webp',
        }]
      : []),
    ...issues.map((i) => ({
      title: `${i.data.vol} ${i.data.label}`, href: '/contents', kind: '号',
      updated: i.data.published,
      /** theme は |- で改行が入る。帯は1行なので潰す */
      note: i.data.theme.replace(/\s*\n\s*/g, ' '),
      thumb: i.data.mainVisual,
    })),
    {
      title: '制作の裏側', href: '/blog', kind: 'ノート',
      updated: new Date(0), note: '作っている途中の話。開発メモと制作記事',
    },
  ].sort((a, b) => +b.updated - +a.updated);
}
