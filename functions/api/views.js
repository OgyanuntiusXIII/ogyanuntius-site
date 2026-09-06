/**
 * 公式サイトの閲覧数。**「人」と「総PV」を別々に持つ。**
 *
 *   GET  /api/views        → 読むだけ
 *   POST /api/views        → **総PV** を1増やす（ページを移るたびに撃たれる）
 *   POST /api/views?v=1    → **人**（本日ぶん）と総PVを、同時に1ずつ増やす
 *
 * 返す形（2026-09-06 から）:
 *   { people: { today, total }, pv: { today, total }, today, total }
 *   末尾の today / total は **people の別名**。表紙のHTMLが古いまま残っていても
 *   「人」の数だけは正しく出る（デプロイ直後のキャッシュ対策）。新しい書き方は people を見る。
 *
 * ⚠️ **人とPVを混ぜて出さないこと。** PVを訪問者数として見せるのは誇張になる。
 *    表紙は「本日 12人 34PV／累計 340人 1,204PV」の形で、必ず並べて出す。
 *
 * ⚠️ **鍵は外から受け取らない。** 使うのは下の4種類だけで、全部サーバ側で作る。
 *
 *      site               … 人・累計（延べ。1人1日1回）
 *      day:YYYY-MM-DD     … 人・その日
 *      pv                 … 総PV・累計
 *      pv:day:YYYY-MM-DD  … 総PV・その日
 *
 *    好きな鍵を投げられるようにすると、ゴミ行を無限に積める。
 *    **ページ別PVが要るようになったら、先に「許可するパスの一覧」を持つこと。**
 *    （パスを鍵に混ぜた瞬間、上の制約が壊れる）
 *
 * 「今日」は**日本時間**で切る。サイトを見るのがほぼ日本なので、
 * UTCで切ると日付が変わる時刻が朝9時になって直感と合わない。
 *
 * 書き込み量：PVだけなら1回2行、人も数える回は4行。D1の無料枠は1日10万行なので
 * **1日およそ2.5万PVまで無料**（人の加算を含めても実質そのくらい）。
 * 超えてもエラーになるだけで課金は起きない。**Workers Paid へ切り替えないこと。**
 *
 * bot は数えない。完璧には弾けないが、素直に名乗るクローラは落ちる。
 * D1未接続なら204。表示側は黙って何も出さない（無い数字を作らない）。
 *
 * ⚠️ **数えていない場所がある。** `public/games/*` と `public/tools/*` は Astro を通らない
 *    素のHTMLなので、各 index.html に置いた1行のビーコンが撃つ。**その1行が無いものは
 *    総PVに乗らない。** ゲームを増やしたら同じ1行を入れること。
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

/** 4つの鍵をまとめて読む。無い鍵は0 */
async function read(db, day){
  const dayK = "day:" + day;
  const pvDayK = "pv:day:" + day;
  const r = await db
    .prepare("SELECT k, n FROM views WHERE k IN ('site', 'pv', ?, ?)")
    .bind(dayK, pvDayK)
    .all();

  const m = {};
  for (const row of (r.results || [])) m[row.k] = row.n;

  const people = { today: m[dayK] || 0, total: m["site"] || 0 };
  const pv     = { today: m[pvDayK] || 0, total: m["pv"] || 0 };

  // today / total は people の別名（古いHTML向け）。people / pv が本体
  return { people, pv, today: people.today, total: people.total };
}

const UP = "INSERT INTO views (k, n) VALUES (?, 1) " +
           "ON CONFLICT(k) DO UPDATE SET n = n + 1";

export async function onRequest({ request, env }) {
  if (!env.DB) return new Response(null, { status: 204 });
  const day = jstDay();

  try {
    if (request.method === "GET") return json(await read(env.DB, day));

    if (request.method === "POST") {
      const ua = request.headers.get("user-agent") || "";
      if (BOT.test(ua)) return json(await read(env.DB, day));   // 数えず、今の数だけ返す

      // ?v=1 のときだけ「人」も足す。判定はブラウザ側（今日まだ来ていない人か）
      const countPerson = new URL(request.url).searchParams.get("v") === "1";

      const stmts = [
        env.DB.prepare(UP).bind("pv"),
        env.DB.prepare(UP).bind("pv:day:" + day),
      ];
      if (countPerson) {
        stmts.push(env.DB.prepare(UP).bind("site"));
        stmts.push(env.DB.prepare(UP).bind("day:" + day));
      }
      await env.DB.batch(stmts);

      // 足した直後の4つを読み直す。RETURNING を継ぎ足すより、
      // 「読む形は read() ひとつ」に寄せたほうが後で壊れない
      return json(await read(env.DB, day));
    }
  } catch (e) {
    return new Response(null, { status: 204 });
  }

  return json({ error: "method not allowed" }, 405);
}
