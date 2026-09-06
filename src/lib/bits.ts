import { getCollection } from 'astro:content';
import { SITE } from '../data/site';

/**
 * 小物（SMALL WORKS）の共通処理。棚（`/bits`）と目次の両方が使う。
 *
 * ⚠️ **配布元の名前を md へ手で書かせない。** URL から出す。
 *    「BOOTH」と書き忘れた行だけラベルが消える、という揺れを作らないため。
 */
export function hostLabel(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith(SITE.origin)) return 'サイト内';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('booth.pm')) return 'BOOTH';
    if (host === 'github.com') return 'GitHub';
    if (host === 'x.com' || host === 'twitter.com') return 'X';
    if (host.endsWith('youtube.com') || host === 'youtu.be') return 'YouTube';
    if (host.endsWith('itch.io')) return 'itch.io';
    if (host === 'note.com') return 'note';
    if (host.endsWith('obsidian.md')) return 'Obsidian';
    // 知らない配布元は**ホスト名をそのまま出す**。推測でサービス名を当てない
    return host;
  } catch {
    return null;
  }
}

/** サイト外へ出るか。同一オリジンなら ↗ を付けない */
export const isExternal = (url?: string) => !!url && !url.startsWith(SITE.origin);

/** 新しい順。棚は「最近こんなの出した」を見せる場所なので降順 */
export async function getBits() {
  return (await getCollection('bits')).sort((a, b) => +b.data.date - +a.data.date);
}
