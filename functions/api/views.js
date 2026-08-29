/**
 * 公式サイトTOPの閲覧数。**表紙（/）に来た人だけを数える。**
 *
 *   GET  /api/views   → { count: 数 }
 *   POST /api/views   → 1増やして { count: 数 }
 *
 * ⚠️ **数える判断は表示側（Base.astro）でやっている。** ここは1行を増やすだけ。
 *    鍵を外から指定できるようにすると、好きなパスを投げてゴミ行を無限に積めるので、
 *    鍵は 'site' 固定にしてある。ページ別が要るようになったら、
 *    **先に許可するパスの一覧を持つこと。**
 *
 * bot は数えない。完璧には弾けないが、素直に名乗るクローラは落ちる。
 *
 * D1未接続なら204。表示側は黙って何も出さない。
 */

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|monitor|curl|wget|python-requests|headless/i;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export async function onRequest({ request, env }) {
  if (!env.DB) return new Response(null, { status: 204 });

  try {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT n FROM views WHERE k = ?")
        .bind("site").first();
      return json({ count: row ? row.n : 0 });
    }

    if (request.method === "POST") {
      const ua = request.headers.get("user-agent") || "";
      if (BOT.test(ua)) {                       // 数えないが、今の数は返す
        const row = await env.DB.prepare("SELECT n FROM views WHERE k = ?")
          .bind("site").first();
        return json({ count: row ? row.n : 0 });
      }
      const row = await env.DB.prepare(
        "INSERT INTO views (k, n) VALUES (?, 1) " +
        "ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n"
      ).bind("site").first();
      return json({ count: row ? row.n : 1 });
    }
  } catch (e) {
    return new Response(null, { status: 204 });
  }

  return json({ error: "method not allowed" }, 405);
}
