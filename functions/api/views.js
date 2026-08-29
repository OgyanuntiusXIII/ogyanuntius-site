/**
 * 公式サイトTOPの閲覧数。**表紙（/）に来た人だけを数える。**
 *
 *   GET  /api/views   → { total: 累計, today: 今日 }
 *   POST /api/views   → 1増やして同じ形を返す
 *
 * ⚠️ **鍵は外から受け取らない。** `site` と、サーバ側で作る `day:YYYY-MM-DD` だけ。
 *    好きな鍵を投げられるようにすると、ゴミ行を無限に積める。
 *    ページ別が要るようになったら、**先に許可するパスの一覧を持つこと。**
 *
 * 「今日」は**日本時間**で切る。サイトを見るのがほぼ日本なので、
 * UTCで切ると日付が変わる時刻が朝9時になって直感と合わない。
 *
 * 1回の閲覧で2行書く（累計と当日）。D1の無料枠は1日10万行なので、
 * 1日5万閲覧までは無料。超えてもエラーになるだけで課金は起きない。
 *
 * bot は数えない。完璧には弾けないが、素直に名乗るクローラは落ちる。
 * D1未接続なら204。表示側は黙って何も出さない。
 */

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|monitor|curl|wget|python-requests|headless/i;

/** 日本時間の YYYY-MM-DD */
function jstDay(){
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

async function read(db, dayKey){
  const r = await db.prepare("SELECT k, n FROM views WHERE k IN ('site', ?)").bind(dayKey).all();
  const m = {};
  for (const row of (r.results || [])) m[row.k] = row.n;
  return { total: m["site"] || 0, today: m[dayKey] || 0 };
}

export async function onRequest({ request, env }) {
  if (!env.DB) return new Response(null, { status: 204 });
  const dayKey = "day:" + jstDay();

  try {
    if (request.method === "GET") return json(await read(env.DB, dayKey));

    if (request.method === "POST") {
      const ua = request.headers.get("user-agent") || "";
      if (BOT.test(ua)) return json(await read(env.DB, dayKey));   // 数えず、今の数だけ返す

      const up = "INSERT INTO views (k, n) VALUES (?, 1) " +
                 "ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n";
      const res = await env.DB.batch([
        env.DB.prepare(up).bind("site"),
        env.DB.prepare(up).bind(dayKey),
      ]);
      const pick = (i) => (res[i] && res[i].results && res[i].results[0]) ? res[i].results[0].n : 0;
      return json({ total: pick(0), today: pick(1) });
    }
  } catch (e) {
    return new Response(null, { status: 204 });
  }

  return json({ error: "method not allowed" }, 405);
}
