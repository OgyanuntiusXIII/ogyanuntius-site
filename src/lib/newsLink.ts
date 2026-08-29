import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE } from '../data/site';

/**
 * NEWS の1件から「押したときの飛び先」を決める。
 *
 * 表紙（index.astro）と目次（contents.astro）の両方で使う。
 * ここを1つにしておかないと、片方だけ飛べる／片方だけ別の場所へ行く、が起きる。
 *
 * 優先順位:
 *   1. `url` が書いてあればそれ（BOOTHの商品ページなど）
 *   2. `ref` があれば、その作品ページ（/works/<slug> か /scenario/<slug>）
 *   3. どちらも無ければ目次へ
 *
 * ⚠️ `url` が**自分のサイトを指している**ときは外部扱いしない。
 *    キキ？キサキ？の url は自分のゲームページなのに ↗（外部リンクの印）が付いていた。
 *    押す前に「サイトの外へ出る」と誤って伝わる。同一オリジンならパスへ落として内部リンクにする。
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
    if (entry.data.url) {
      const inSite = entry.data.url.startsWith(SITE.origin + '/');
      return inSite
        ? { href: entry.data.url.slice(SITE.origin.length), external: false }
        : { href: entry.data.url, external: true };
    }

    const ref = entry.data.ref;
    if (!ref) return { href: '/contents', external: false };

    const found = index.get(ref);
    if (!found) {
      throw new Error(
        `news/${entry.id}.md の ref: "${ref}" に対応する作品が無い。` +
          `src/content/works/${ref}.md か src/content/scenarios/${ref}.md が要る`
      );
    }
    return { href: found, external: false };
  };
}
