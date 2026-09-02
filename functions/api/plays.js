/**
 * ブラウザゲームのプレイ回数。
 *
 * Cloudflare Pages Functions。`functions/` の中身は Pages が勝手に拾うので、
 * Astro 側の設定は何も要らない（サイトは静的のまま）。
 *
 * ⚠️ **D1 を紐づけるまでは何も起きない。**
 *    バインド前は 204 を返すので、表示側は黙って何も出さない。
 *
 * なぜ KV ではなく D1 か（2026-08-30 に無料枠を確認して決めた）：
 *   ・書き込み  KV 1,000/日  →  D1 100,000/日（100倍）
 *   ・KV は「読む→足す→書く」なので、**同時に遊ばれると数え落とす**。
 *     D1 は `n = n + 1` を1文で撃てるので取りこぼさない。
 *
 *   GET  /api/plays?g=<slug>   → { count: 数 }
 *   POST /api/plays?g=<slug>   → 1増やして { count: 数 }
 */

// 勝手なキーで書き込まれないよう、数える対象は先に決めておく
const GAMES = new Set(["parry-aria-bpm", "kiki-kisaki", "kokoro-misoshiru", "777-combo", "30-traps"]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const g = url.searchParams.get("g") || "";

  if (!GAMES.has(g)) return json({ error: "unknown game" }, 400);
  if (!env.DB) return new Response(null, { status: 204 });   // D1未接続

  try {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT n FROM plays WHERE g = ?")
        .bind(g).first();
      return json({ count: row ? row.n : 0 });
    }

    if (request.method === "POST") {
      // 1文で「無ければ作る／有れば増やす」。途中に他の人が入っても崩れない
      const row = await env.DB.prepare(
        "INSERT INTO plays (g, n) VALUES (?, 1) " +
        "ON CONFLICT(g) DO UPDATE SET n = n + 1 RETURNING n"
      ).bind(g).first();
      return json({ count: row ? row.n : 1 });
    }
  } catch (e) {
    // 枠を使い切った・テーブルが無い等。数字が出ないだけで、ゲームは動く
    return new Response(null, { status: 204 });
  }

  return json({ error: "method not allowed" }, 405);
}
