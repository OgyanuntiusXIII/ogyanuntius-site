import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * **特集（works + scenarios）の並びと通し番号の正本。**
 *
 * 表紙・目次・作品ページ・プレスキットが、それぞれ勝手に並べ替えていた。
 * その結果 **同じ作品が目次では 01、作品ページでは FEATURE 02** になっていた
 * （目次は公開日順、作品ページはファイル名順だったため）。ここに1本化する。
 *
 * | | 何で決まるか |
 * |---|---|
 * | **番号**（FEATURE 01…） | **出した順**＝公開日の古い順。**新作が最大の番号を取る。既存は動かない** |
 * | **表示の並び** | ジャンル順（`CATEGORY_ORDER`）→ ジャンル内は公開日の**新しい順** |
 *
 * **番号と並びは別物。** 並びは編集の都合で変えてよいが、番号は物に付いていて動かない。
 *
 * ⚠️ **番号は手で書かない。** `issues/*.md` の `headlines` で `no:` を省くと、
 *    ここで振った番号がそのまま表紙に出る。作品を1本足すたびに `no: 1〜8` を
 *    手で振り直す作業は要らない（実際、その振り直しを一度やっている）。
 *
 * ⚠️ **`resolve()` は解決できないとビルドを落とす。** 黙って `/contents` へ
 *    逃がすと「押しても作品ページに着かない」ことに誰も気づかないまま公開される。
 *    表紙 headlines と NEWS の `ref` は全部ここを通す。
 */

/** works と scenarios は同じスキーマ（`workSchema`）なので、片方の型で足りる */
export type FeatureData = CollectionEntry<'works'>['data'];
export type FeatureCategory = FeatureData['category'];

/** ジャンルの並び。**`src/content.config.ts` の `category` と同じ順に保つ** */
export const CATEGORY_ORDER: readonly FeatureCategory[] = [
  'app',
  'game',
  'scenario',
  'video',
  'blog',
  'other',
];

/**
 * 目次の欄名。欧文＋和文は誌面のほかの見出し（`NEWS ／ 今月の制作物`）と同じ組み。
 * `short` は**表紙の小さなタグ用**。`jp` をそのまま入れると枠が広がって行が折れる。
 */
export const CATEGORY_LABEL: Record<FeatureCategory, { jp: string; en: string; short: string }> = {
  app: { jp: 'ツール・アプリ', en: 'TOOLS', short: 'アプリ' },
  game: { jp: 'ゲーム', en: 'GAMES', short: 'ゲーム' },
  scenario: { jp: 'TRPGシナリオ', en: 'SCENARIOS', short: 'シナリオ' },
  video: { jp: '動画', en: 'VIDEO', short: '動画' },
  blog: { jp: '読みもの', en: 'READS', short: '読み物' },
  other: { jp: 'そのほか', en: 'OTHERS', short: 'その他' },
};

/** 目次のジャンル見出しに振るアンカー。作品ページの「戻る」がここへ着地する */
export const categoryAnchor = (category: FeatureCategory) => `cat-${category}`;

export type Feature = {
  /** slug。`works/<id>.md` のファイル名 */
  id: string;
  /** 作品ページのURL。`/works/<id>` か `/scenario/<id>` */
  href: string;
  /** 誌面の通し番号。**出した順**（1＝いちばん最初に出したもの）。表紙・目次・作品ページで共通 */
  no: number;
  category: FeatureCategory;
  data: FeatureData;
};

export type FeatureGroup = {
  category: FeatureCategory;
  jp: string;
  en: string;
  short: string;
  /** 目次の見出しに付くアンカー */
  anchor: string;
  items: Feature[];
};

export type Features = {
  /** ジャンルごとの束。**中身が0件のジャンルは入らない** */
  groups: FeatureGroup[];
  /** 番号順（＝出した順）に並んだ全件 */
  all: Feature[];
  /**
   * **ジャンルを無視して、公開日の新しい順**に並べた全件。
   * 表紙の「NEW WORKS」欄がこれの先頭3件を出す。番号は `all` と同じものが付いている。
   */
  latest: Feature[];
  /** slug から引く。無ければ undefined */
  get(ref: string): Feature | undefined;
  /**
   * slug から引く。**無ければビルドを落とす。**
   * @param where エラー文に出す呼び出し元（例 `vol01.md の headlines`）
   */
  resolve(ref: string, where: string): Feature;
};

export async function buildFeatures(): Promise<Features> {
  const works = await getCollection('works');
  const scenarios = await getCollection('scenarios');

  const entries = [
    ...works.map((e) => ({ id: e.id, href: `/works/${e.id}`, data: e.data })),
    ...scenarios.map((e) => ({ id: e.id, href: `/scenario/${e.id}`, data: e.data })),
  ];

  /* ① **番号は「出した順」。** 公開日の古い順に 01 から振る（本人・2026-09-05
        「それぞれの製品ページの番号がばらばらだから、ちゃんと出した順にしてほしい」）。

        ⚠️ **並び順から番号を作らない。** 以前は「ジャンル順に並べて上から連番」だったので、
           01 が最新・03 が最古のように**公開日と噛み合っていなかった。**
           出した順にしておくと、**新しく1本出すたびに次の番号が付き、既存の番号は動かない。**
        日付が同じときは id で決める（振り直しのたびに番号が入れ替わらないように）。 */
  const numbered = [...entries].sort(
    (a, b) => +a.data.date - +b.data.date || a.id.localeCompare(b.id)
  );
  const noOf = new Map(numbered.map((e, i) => [e.id, i + 1]));
  const toFeature = (e: (typeof entries)[number]): Feature => ({
    ...e,
    category: e.data.category,
    no: noOf.get(e.id)!,
  });

  const all: Feature[] = numbered.map(toFeature);

  /* ② **表示の並びは番号と別物。** ジャンルごとに束ね、中は公開日の新しい順
        （本人・2026-09-04）。番号は①で決まっているので、ここで並べ替えても動かない。 */
  const groups: FeatureGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = entries
      .filter((e) => e.data.category === category)
      .sort((a, b) => +b.data.date - +a.data.date)
      .map(toFeature);
    if (items.length === 0) continue;
    groups.push({
      category,
      ...CATEGORY_LABEL[category],
      anchor: categoryAnchor(category),
      items,
    });
  }

  const byId = new Map(all.map((f) => [f.id, f]));

  const latest = [...all].sort((a, b) => +b.data.date - +a.data.date);

  return {
    groups,
    all,
    latest,
    get: (ref) => byId.get(ref),
    resolve(ref, where) {
      const found = byId.get(ref);
      if (!found) {
        throw new Error(
          `${where} の ref: "${ref}" に対応する作品が無い。` +
            `src/content/works/${ref}.md か src/content/scenarios/${ref}.md が要る`
        );
      }
      return found;
    },
  };
}
