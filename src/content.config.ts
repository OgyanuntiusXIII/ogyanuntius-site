import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ここがこのサイトの「安全弁」。
 * Claude が content/*.md を書き間違えると `npm run build` がここで落ちる。
 * 落ちないと壊れたまま本番へ出る。ルールを緩めるときは意図してやること。
 */

/** public/ 配下に実在するファイルだけを通すパス型 */
const publicPath = z
  .string()
  .startsWith('/', '先頭は "/" で始める（例: /images/works/desk-takko.png）')
  .refine((p) => existsSync(join(process.cwd(), 'public', p)), {
    message: 'public/ 配下にそのファイルが無い。画像を置いてからパスを書くこと',
  });

/** 公開状態。増やすときは CLAUDE.md の語彙表も一緒に直す */
const status = z.enum(['published', 'making', 'ended']);
const priceType = z.enum(['free', 'paid', 'donation', 'unknown']);
const category = z.enum(['app', 'game', 'scenario', 'video', 'blog', 'other']);

const linkItem = z.object({
  label: z.string(),
  url: z.string().url(),
});

/** 作品・シナリオ共通の中身 */
const workSchema = z.object({
  title: z.string(),
  /** 表紙・目次で使う短い煽り。コロコロ側の担当 */
  catch: z.string().max(40, '表紙に載る。40字を超えると誌面が壊れる'),
  category,
  date: z.coerce.date(),
  status,
  priceType: priceType.default('unknown'),
  thumbnail: publicPath,
  heroImage: publicPath,
  /** OGP・meta description に流用する。100字前後 */
  description: z.string().min(10).max(160),
  links: z.array(linkItem).default([]),
  tags: z.array(z.string()).default([]),
  /** OGP画像を個別に持つなら。無ければサイト共通OGPが使われる */
  ogImage: publicPath.optional(),
  /**
   * 紹介ムービーのYouTube ID（`watch?v=` のあとの部分だけ）。
   * **押されるまでYouTubeを読み込まない**作りなので、置いてもページは重くならない。
   */
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'YouTubeのID（11文字）だけを書く').optional(),
});

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: workSchema,
});

const scenarios = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/scenarios' }),
  schema: workSchema,
});

/**
 * 号（issue）。**表紙はここのデータで組む。**
 * これをコンポーネントにベタ書きすると「作品追加＝md1件」が成立しなくなる。
 */
const issues = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/issues' }),
  schema: z.object({
    vol: z.string(),
    label: z.string(),
    /** 号のテーマ。**改行を入れるとその位置で折れる**（YAMLの |- で書く） */
    theme: z.string(),
    published: z.coerce.date(),
    mainVisual: publicPath,
    mainVisualAlt: z.string().min(1, 'alt は必須。仕様書20章'),
    /** 画像のどこを見せるか。縦横比が違う画像を投げても顔が切れないようにする（例 '50% 30%'） */
    mainVisualFocus: z.string().default('50% 50%'),
    /** 中央の一冊に重ねる文字の色。明るい画像なら dark、暗い画像なら light */
    coverInk: z.enum(['dark', 'light']).default('dark'),
    /** 表紙の説明。一冊にカーソルを置くと帯になって出る。空なら帯は出ない */
    coverNote: z.string().max(120, '帯に収まらない。120字まで').optional(),
    /** 誌名。**サイト名（オギャヌンティウス十三世）とは別物。** 一冊の題字になる */
    magTitleJp: z.string().default('月刊'),
    magTitleEn: z.string().default('OGYANUN'),
    /** 表紙に刷る見出し。誌面側の headlines とは別に、一冊の上に印刷される文言 */
    coverLines: z.array(z.string().max(24, '表紙に刷る。24字を超えると読めない')).max(4).default([]),
    current: z.boolean().default(false),
    /** 表紙に載せる見出し。ここへ足すと表紙に出る */
    headlines: z
      .array(
        z.object({
          /** works / scenarios の slug、または任意のURL */
          ref: z.string(),
          collection: z.enum(['works', 'scenarios', 'page']).default('works'),
          /** 表紙での表示文。省略時は作品の catch を使う */
          catch: z.string().optional(),
          /** 誌面での置き場所 */
          slot: z.enum(['lead', 'upper', 'side', 'lower', 'strip']),
          /** NEW などの小さなラベル */
          badge: z.string().max(8).optional(),
          /** 通し番号（コロコロ側の担当） */
          no: z.number().int().positive().optional(),
        })
      )
      .min(1),
    /** 表紙の余白に置く煽り文の帯 */
    strips: z.array(z.string()).default([]),
    /** 奥付 */
    colophon: z.array(z.string()).default([]),
  }),
});

/** 制作の裏側。開発メモ・制作記事（仕様書13章） */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    /** 一覧と meta description に出る。10〜160字 */
    description: z.string().min(10).max(160),
    /** どの作品の裏側か。works / scenarios の slug */
    relatedTo: z.string().optional(),
    tags: z.array(z.string()).default([]),
    /** true の間は一覧にもURLにも出ない */
    draft: z.boolean().default(false),
    heroImage: publicPath.optional(),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    kind: z.enum(['release', 'update', 'video', 'blog', 'other']),
    url: z.string().url().optional(),
    ref: z.string().optional(),
  }),
});

const nowmaking = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/nowmaking' }),
  schema: z.object({
    title: z.string(),
    /** 「この人、また何か作っている」を担当する一行 */
    catch: z.string().max(40),
    updated: z.coerce.date(),
    progress: z.string().optional(),
    /** どの作品の話か。works / scenarios の slug。あればその作品ページへリンクする */
    ref: z.string().optional(),
    order: z.number().int().default(50),
  }),
});

/**
 * 卓の記録（SESSION LOG）。**ここだけ md ではなく JSON 1本。**
 * 1件が「日付＋一言＋スクショ」しかないので、md を25枚置くほうが嵩む。
 *
 * 手で書かない。**正本は Vault の `TRPG/シナリオ記録/*.md`。**
 *   Vault で `卓報告: true` にする
 *   → `python 開発/Vault保守/trpg_sessions_export.py --apply`
 *   → sessions.json と public/images/sessions/ が更新される
 * ここを直接編集すると、次の書き出しで消える。
 */
const sessions = defineCollection({
  loader: file('./src/content/sessions/sessions.json'),
  schema: z.object({
    title: z.string(),
    /** 卓を回した日。Vault側で空のものは null */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD で書く').nullable(),
    role: z.enum(['KP', 'PL']),
    style: z.enum(['オンライン', 'オフライン']).nullable().default(null),
    system: z.string(),
    types: z.array(z.string()).default([]),
    kp: z.string(),
    pl: z.array(z.string()).default([]),
    /**
     * 一言感想。**エンディングに触れる。**
     * 一覧には出さず、ポップを開いた先で **さらに「ネタバレ注意」を押させてから**出す。
     * 本人の指示（2026-08-29）:「いかなる感想も公開時は一回ネタバレ注意ボタンつくって、
     * そのうえで押したら見れるようにしよう。それで対応する」
     */
    comment: z.string(),
    /** 頒布規約の調査結果。既定は安全側の「不明」 */
    spoiler: z.enum(['自作', 'OK', '要配慮', '不明']).default('不明'),
    /** クレジット表記用。『同じ空には昇れない』は作者名・タイトル・URLの明記が必須 */
    author: z.string().nullable().default(null),
    sourceUrl: z.string().url().nullable().default(null),
    images: z.array(publicPath).default([]),
  }),
});

export const collections = { works, scenarios, issues, news, nowmaking, blog, sessions };
