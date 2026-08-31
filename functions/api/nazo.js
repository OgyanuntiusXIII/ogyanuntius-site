/**
 * 隠しページ（P.000）の採番と照合。
 *
 * Cloudflare Pages Functions。`functions/` の中身は Pages が勝手に拾うので、
 * Astro 側の設定は要らない（サイトは静的のまま）。D1 は plays / views と同じ `DB`。
 *
 *   POST /api/nazo   body { a: 解答, id: 端末の匿名ID }
 *        正解      → { ok:true, no, code, at }            （初回。番号を採る）
 *        既取得    → { ok:true, no, code, at, again:true } （同じ端末。前の番号を返す）
 *        連発      → { ok:true, wait: 残り秒 }             （同一回線から短時間に複数）
 *        不正解    → { ok:false }
 *   GET  /api/nazo?no=37&code=8F3A2C19
 *        → { valid:true, no, at } / { valid:false }
 *
 * ⚠️ **正解の平文をこのファイルへ書かない。このリポジトリは public。**
 *    持っているのは SHA-256 だけ。判定はハッシュ同士で行う。
 *
 * ⚠️ **判定をブラウザ側でやらない。** 番号を配るのはサーバの仕事で、
 *    クライアントに答えを渡した時点で CLEAR No.000001 の価値が消える。
 *
 * 重複対策は「善意ベース＋軽い重複防止」。同じ端末は何度解いても番号が増えず、
 * 前回の認定証が返る。シークレットウィンドウ・別端末までは追わない
 * （追うにはログインが要る。隠し謎解きの軽さが死ぬ）。
 */

/** 正解（大文字化・英数字のみ）の SHA-256。**平文はここにも履歴にも残さない** */
const ANSWER = "5eec0e063c727af4050065efae082ec1a016d3d7f11808205897e3a8b4ee517d";

/** 同一回線から次の番号を出すまでの間隔（秒）。家庭・学校の共有回線を考えて長くしすぎない */
const COOL = 300;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

/** 大文字化し、英数字だけ残す。デスク_タッコ の ArgAnswers.Norm と同じ規則 */
function norm(s) {
  return String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 日本時間の YYYY-MM-DD。レート制限の鍵を日ごとに変えるのに使う */
function jstDay() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 照合コードの後半。8桁の16進＝約43億通り。総当たりで当てにいけない程度にはある */
function newCode() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * 表を用意する。`schema.sql` にも同じものがあるが、**手で流し忘れても動くように**
 * ここでも撃つ。既にあれば何も書かないので無料枠を食わない。
 *
 * ⚠️ `AUTOINCREMENT` は外さないこと。付けないと行を消したとき rowid が再利用され、
 *    **同じ CLEAR No. が二人に出る。**
 */
async function ensure(db) {
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS nazo_clears (" +
        "no INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "aid TEXT NOT NULL UNIQUE, " +
        "code TEXT NOT NULL, " +
        "at TEXT NOT NULL)"
    ),
    db.prepare("CREATE TABLE IF NOT EXISTS nazo_rate (k TEXT PRIMARY KEY, at INTEGER NOT NULL)"),
  ]);
}

async function post(request, env) {
  const body = await request.json().catch(() => ({}));

  // 先に答え合わせ。**外れならDBに一切触らない**（間違いは何回でもタダ）
  if ((await sha256(norm(body.a))) !== ANSWER) return json({ ok: false });

  const id = String(body.id == null ? "" : body.id);
  if (id.length < 16) return json({ ok: true, error: "id" });
  if (!env.DB) return json({ ok: true, offline: true });   // D1未接続。正解は正解

  await ensure(env.DB);

  // 端末の匿名IDは**そのまま持たない**。ハッシュだけ入れる
  const aid = await sha256("nazo/aid/" + id);

  const seen = await env.DB.prepare("SELECT no, code, at FROM nazo_clears WHERE aid = ?")
    .bind(aid).first();
  if (seen) return json({ ok: true, no: seen.no, code: seen.code, at: seen.at, again: true });

  // 同一回線の連発だけ止める。**IPは保存しない。** 日付を混ぜたハッシュなので日をまたげば消える鍵になる
  const ip = request.headers.get("cf-connecting-ip") || "";
  const rk = (await sha256("nazo/ip/" + jstDay() + "/" + ip)).slice(0, 32);
  const now = Math.floor(Date.now() / 1000);
  const hot = await env.DB.prepare("SELECT at FROM nazo_rate WHERE k = ?").bind(rk).first();
  if (hot && now - hot.at < COOL) return json({ ok: true, wait: COOL - (now - hot.at) });

  const code = newCode();
  const at = new Date().toISOString();
  let row;
  try {
    row = await env.DB.prepare(
      "INSERT INTO nazo_clears (aid, code, at) VALUES (?, ?, ?) RETURNING no"
    ).bind(aid, code, at).first();
  } catch (e) {
    // 同じ端末から同時に2発送られた。片方が UNIQUE で落ちるので、勝った方の番号を返す
    const again = await env.DB.prepare("SELECT no, code, at FROM nazo_clears WHERE aid = ?")
      .bind(aid).first();
    if (again) return json({ ok: true, no: again.no, code: again.code, at: again.at, again: true });
    throw e;
  }

  await env.DB.prepare(
    "INSERT INTO nazo_rate (k, at) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET at = ?"
  ).bind(rk, now, now).run();

  return json({ ok: true, no: row.no, code, at });
}

async function get(request, env) {
  const url = new URL(request.url);
  const no = Number.parseInt(url.searchParams.get("no") || "", 10);
  const code = norm(url.searchParams.get("code"));

  // 形が違うものはDBを見ずに落とす
  if (!Number.isInteger(no) || no <= 0 || !/^[0-9A-F]{8}$/.test(code)) return json({ valid: false });
  if (!env.DB) return new Response(null, { status: 204 });

  await ensure(env.DB);
  const row = await env.DB.prepare("SELECT no, code, at FROM nazo_clears WHERE no = ?")
    .bind(no).first();
  // 番号があるかどうかも漏らさない。**返すのは valid の真偽だけ**
  if (!row || row.code !== code) return json({ valid: false });
  return json({ valid: true, no: row.no, at: row.at });
}

export async function onRequest({ request, env }) {
  try {
    if (request.method === "POST") return await post(request, env);
    if (request.method === "GET") return await get(request, env);
  } catch (e) {
    // 無料枠切れ・D1の一時障害など。**正解を不正解にしない**ため 503 で返す
    return json({ error: "unavailable" }, 503);
  }
  return json({ error: "method not allowed" }, 405);
}
