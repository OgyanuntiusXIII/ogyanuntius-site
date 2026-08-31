import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE } from '../data/site';

/**
 * NEWS の1件から「押したときの飛び先」を決める。
 *
 * 表紙（index.astro）と目次（contents.astro）の両方で使う。
 * ここを1つにしておかないと、片方だけ飛べる／片方だけ別の場所へ行く、が起きる。
 *
 * 優先順位:
 *   1. `ref` があれば、その**作品ページ**（/works/<slug> か /scenario/<slug>）
 *   2. `url` だけがあればそれ（作品ページを持たないお知らせ用）
 *   3. どちらも無ければ目次へ
 *
 * > [!IMPORTANT] **作品ページがあるものは、必ず作品ページを経由させる**（本人・2026-08-31）
 * > 「今月の制作物から飛ぶ場合は、プロダクトページあるものについてはちゃんと
 * > プロダクトページに飛んでほしい（直接ではなく）」
 * >
 * > 以前は `url` が `ref` より強かったので、`/games/kiki-kisaki` のように
 * > **中身へ直行して作品ページを素通り**していた。何の作品なのか・誰が作ったのか・
 * > ほかに何があるのかを見せる場所が作品ページなので、順番を入れ替えた。
 * > **`url` を `ref` より優先へ戻さないこと。**
 *
 * ⚠️ `ref` と `url` を**両方書いたらビルドを落とす**（`src/content.config.ts`）。
 *    `ref` があるとき `url` は絶対に使われないので、残っていると「効いている」と誤読される。
 *
 * ⚠️ `url` が**自分のサイトを指している**ときは外部扱いしない。
 *    ↗（外部リンクの印）が付くと、押す前に「サイトの外へ出る」と誤って伝わる。
 *    同一オリジンならパスへ落として内部リンクにする。
 *
 * ⚠️ `ref` が works にも scenarios にも無いときは**ビルドを落とす。**
 *    黙って「ただの文字」に落とすと、押せないことに誰も気づかないまま公開される。
 *    表紙の headlines を解決する resolve() と同じ方針。
 */
export type NewsLink = { href: string; external: boolean };

export async function buildNewsLinker(): Promise<
  (entry: CollectionEntry<'news'>) => NewsLink
> {
  const works = await getCollection('works');
  const scenarios = await getCollection('scenarios');

  const index = new Map<string, string>();
  for (const w of works) index.set(w.id, `/works/${w.id}`);
  for (const s of scenarios) index.set(s.id, `/scenario/${s.id}`);

  return (entry) => {
    // 1. 作品ページがあるなら、必ずそこを通す
    const ref = entry.data.ref;
    if (ref) {
      const found = index.get(ref);
      if (!found) {
        throw new Error(
          `news/${entry.id}.md の ref: "${ref}" に対応する作品が無い。` +
            `src/content/works/${ref}.md か src/content/scenarios/${ref}.md が要る`
        );
      }
      return { href: found, external: false };
    }

    // 2. 作品ページを持たないお知らせ
    if (entry.data.url) {
      const inSite = entry.data.url.startsWith(SITE.origin + '/');
      return inSite
        ? { href: entry.data.url.slice(SITE.origin.length), external: false }
        : { href: entry.data.url, external: true };
    }

    return { href: '/contents', external: false };
  };
}
