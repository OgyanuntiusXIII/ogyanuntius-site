/**
 * 30 TRAPS に釣られた人の**合計時間**。
 *
 * Cloudflare Pages Functions。`functions/` は Pages が勝手に拾う。D1 は plays / views と同じ `DB`。
 *
 *   GET  /api/traptime            → { ms: 合計ミリ秒, runs: 到達した回数 }
 *   POST /api/traptime  {ms:数}   → 足してから同じものを返す
 *
 * ⚠️ **D1 を紐づけるまでは 204。** 表示側は黙って何も出さない（無い数字を作らない）。
 *
 * ⚠️ **この数字は自己申告。** タイムはブラウザが測ってブラウザが送ってくるので、
 *    その気になれば水増しできる。だから
 *      ・1回に足せる長さに上限を置く（MAX_MS）
 *      ・短すぎるものは数えない（MIN_MS）
 *      ・同一回線から1日に足せる回数を絞る（PER_DAY）
 *    ここまでやっても「正確な統計」にはならない。**そういう数字として出すこと。**
 *
 * ⚠️ **IPは保存しない。** 連発を止める鍵は「日付＋IP」のハッシュで、
 *    日をまたげば元の回線とは結びつかなくなる（nazo.js / contact.js と同じ考え方）。
 */

const KEY = "okoraretarakesu";

/** 1回で足せる上限。3時間。タブを放置した人の分はここで頭打ちにする */
const MAX_MS = 3 * 60 * 60 * 1000;
/** これより短いものは数えない。30枚どかすのに5秒は無い */
const MIN_MS = 5000;
/** 同一回線から1日に足せる回数 */
const PER_DAY = 20;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 日本時間の YYYY-MM-DD。鍵を日ごとに変えるのに使う */
function jstDay() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 表を用意する。**普段は呼ばない。**
 * 毎リクエストで CREATE TABLE を撃つと、1回の到達で D1 の書き込みを余計に2回使う。
 * 表は `schema.sql` で作ってあるので、**落ちたときだけ**1回試して撃ち直す。
 */
async function ensure(db) {
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS trap_time (" +
        "k TEXT PRIMARY KEY, ms INTEGER NOT NULL DEFAULT 0, runs INTEGER NOT NULL DEFAULT 0)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS trap_rate (k TEXT PRIMARY KEY, at INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0)"
    ),
  ]);
}

/**
 * 古い連投記録を掃除する。**放っておくと1日1IPにつき1行、無限に増える。**
 * 鍵に日付が入っているので、昨日より前のものは二度と当たらない＝消してよい。
 * 毎回やると無駄なので、たまにだけ撃つ。
 */
async function sweep(db) {
  if (Math.random() > 0.02) return;                       // 50回に1回くらい
  const cutoff = Math.floor(Date.now() / 1000) - 2 * 86400;
  try { await db.prepare("DELETE FROM trap_rate WHERE at < ?").bind(cutoff).run(); } catch (e) {}
}

async function read(db) {
  const row = await db.prepare("SELECT ms, runs FROM trap_time WHERE k = ?").bind(KEY).first();
  return json({ ms: row ? row.ms : 0, runs: row ? row.runs : 0 });
}

export async function onRequest({ request, env }) {
  if (!env.DB) return new Response(null, { status: 204 });   // D1未接続

  try {
    if (request.method === "GET") return await read(env.DB);

    if (request.method === "POST") {
      // よそのサイトから数字を増やされないようにする。
      // Origin が付いていて、それがこのサイトでないなら黙って読むだけにする。
      // （完全な防御ではない。curl には Origin が無い。**水増しは止め切れない**）
      const origin = request.headers.get("origin");
      if (origin && new URL(origin).host !== new URL(request.url).host) {
        return await read(env.DB);
      }

      const body = await request.json().catch(() => ({}));
      let ms = Number(body && body.ms);
      // 数でないもの・短すぎるものは静かに捨てる。**捨てたことは相手に教えない**
      if (!Number.isFinite(ms) || ms < MIN_MS) return await read(env.DB);
      ms = Math.min(Math.round(ms), MAX_MS);

      // 同一回線の連発だけ止める。IPは保存しない
      const ip = request.headers.get("cf-connecting-ip") || "";
      const rk = (await sha256("traptime/ip/" + jstDay() + "/" + ip)).slice(0, 32);
      const now = Math.floor(Date.now() / 1000);
      const hot = await env.DB.prepare("SELECT n FROM trap_rate WHERE k = ?").bind(rk).first();
      if (hot && hot.n >= PER_DAY) return await read(env.DB);   // 上限。静かに捨てる

      const row = await env.DB.prepare(
        "INSERT INTO trap_time (k, ms, runs) VALUES (?, ?, 1) " +
          "ON CONFLICT(k) DO UPDATE SET ms = ms + ?, runs = runs + 1 RETURNING ms, runs"
      ).bind(KEY, ms, ms).first();

      await env.DB.prepare(
        "INSERT INTO trap_rate (k, at, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET at = ?, n = n + 1"
      ).bind(rk, now, now).run();

      await sweep(env.DB);
      return json({ ms: row ? row.ms : ms, runs: row ? row.runs : 1 });
    }
  } catch (e) {
    // 表がまだ無いだけかもしれない。1回だけ作り直して読み直す
    try {
      await ensure(env.DB);
      return await read(env.DB);
    } catch (e2) {
      // 無料枠切れ・D1の一時障害など。数字が出ないだけで、ゲームは動く
      return new Response(null, { status: 204 });
    }
  }

  return json({ error: "method not allowed" }, 405);
}
