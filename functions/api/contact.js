/**
 * お問い合わせの受け口。
 *
 * Cloudflare Pages Functions。`functions/` は Pages が勝手に拾うので Astro 側の設定は要らない。
 * D1 は plays / views / nazo と同じ `DB`。表は自分で作る（`schema.sql` にも同じDDLがある）。
 *
 *   POST /api/contact   body { topic, body, name?, email?, work?, device?, t?, fax? }
 *        受理      → { ok:true }
 *        D1未接続  → { ok:true, offline:true }   ← **受け取れていない。** 画面はXへ誘導する
 *        連発      → { ok:false, wait: 残り秒 }
 *        不備      → { ok:false, error:"empty"|"long"|"email" }
 *
 * ⚠️ **`offline` を「送れた」と表示しないこと。** D1が無い＝本文はどこにも残らない。
 *    「動いてないものの計上」そのものになる（ユーザーメモリ5節）。
 *
 * ⚠️ **IPは保存しない。** 連発を止める鍵は「日付＋IP」のハッシュで、日をまたげば
 *    元の回線とは結びつかなくなる（nazo.js と同じ考え方）。
 *
 * ⚠️ **返信はここではしない。** 溜めるだけ。読むのは `npm run inbox`（tools/inbox.mjs）。
 *    管理画面は作らない（CLAUDE.md 5節）。
 *
 * 迷惑メール対策は「静かに捨てる」で統一している。**捨てたことを相手に教えない。**
 * 教えると、当てにいく側は条件を1つずつ外して通るまで試せる。
 */

/** 種別。**`src/data/site.ts` の CONTACT_TOPICS と対にする。** ここに無い値は other へ倒す */
const TOPICS = new Set(["feedback", "bug", "rights", "work", "other"]);

/** 同一回線から次を受けるまでの間隔（秒）。書き足しての再送を邪魔しない程度 */
const COOL = 30;
/** 同一回線から1日に受ける上限。超えたぶんは静かに捨てる */
const PER_DAY = 12;
/** フォームを開いてから送信までの最短（ミリ秒）。これより速いのは人ではない */
const MIN_FILL = 3000;

const LIMIT = { body: 4000, name: 80, email: 120, work: 120, device: 300 };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

/**
 * 前後の空白を落とし、制御文字を抜き、長さで切る。
 * **改行(10)とタブ(9)だけは本文なので残す。** 正規表現で書くと、ソースに
 * 制御文字そのものが混ざって編集事故のもとになるので、コードポイントで見ている。
 */
function clean(v, max) {
  const s = String(v == null ? "" : v);
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c === 127 || (c < 32 && c !== 10 && c !== 9)) continue;
    out += ch;
  }
  return out.trim().slice(0, max);
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 日本時間の YYYY-MM-DD。レート制限の鍵を日ごとに変えるのに使う */
function jstDay() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 表を用意する。手でSQLを流し忘れても動くように、ここでも撃つ。
 * 既にあれば何も書かないので無料枠を食わない（nazo.js と同じ）。
 */
async function ensure(db) {
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS contacts (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "at TEXT NOT NULL, " +
        "topic TEXT NOT NULL, " +
        "name TEXT, " +
        "email TEXT, " +
        "work TEXT, " +
        "device TEXT, " +
        "body TEXT NOT NULL, " +
        "done INTEGER NOT NULL DEFAULT 0)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS contact_rate (" +
        "k TEXT PRIMARY KEY, at INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0)"
    ),
  ]);
}

/**
 * 届いたことだけを知らせる。**本文は送らない**（外部サービスへ本文を預けない）。
 * `CONTACT_WEBHOOK` が設定されていなければ何も起きない。Discord のWebhook形式。
 */
async function notify(env, rec) {
  if (!env.CONTACT_WEBHOOK) return;
  const line =
    "お問い合わせが1件届いています。" +
    "\n種別: " + rec.topic + (rec.work ? " / 作品: " + rec.work : "") +
    "\n返信先: " + (rec.email ? "あり" : "なし") +
    "\n本文は `npm run inbox` で読んでください。";
  await fetch(env.CONTACT_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: line }),
  }).catch(() => {});
}

async function post(request, env, waitUntil) {
  const raw = await request.json().catch(() => ({}));

  // --- 人ではないものを静かに落とす -------------------------------------
  // 蜜壺。画面に出ていない欄なので、人が埋めることはない
  if (clean(raw.fax, 40)) return json({ ok: true });
  // フォームを開いた瞬間に送ってきたもの。t は画面側が測った滞在ミリ秒
  const t = Number(raw.t);
  if (Number.isFinite(t) && t >= 0 && t < MIN_FILL) return json({ ok: true });

  // --- 形を見る ---------------------------------------------------------
  const body = clean(raw.body, LIMIT.body + 1);
  if (!body) return json({ ok: false, error: "empty" });
  if (body.length > LIMIT.body) return json({ ok: false, error: "long" });

  const email = clean(raw.email, LIMIT.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "email" });
  }

  const rec = {
    // 知らない種別は捨てずに other へ倒す。**取りこぼすより誤ラベルのほうが軽い**
    topic: TOPICS.has(String(raw.topic)) ? String(raw.topic) : "other",
    name: clean(raw.name, LIMIT.name),
    email,
    work: clean(raw.work, LIMIT.work),
    device: clean(raw.device, LIMIT.device),
    body,
  };

  // **D1が無いときは受け取れていない。** ok:true だが offline を必ず立てる
  if (!env.DB) return json({ ok: true, offline: true });

  await ensure(env.DB);

  // --- 同一回線の連発だけ止める。IPは保存しない -------------------------
  const ip = request.headers.get("cf-connecting-ip") || "";
  const rk = (await sha256("contact/ip/" + jstDay() + "/" + ip)).slice(0, 32);
  const now = Math.floor(Date.now() / 1000);
  const hot = await env.DB.prepare("SELECT at, n FROM contact_rate WHERE k = ?").bind(rk).first();
  if (hot) {
    if (now - hot.at < COOL) return json({ ok: false, wait: COOL - (now - hot.at) });
    if (hot.n >= PER_DAY) return json({ ok: true });   // 上限。静かに捨てる
  }

  await env.DB.prepare(
    "INSERT INTO contacts (at, topic, name, email, work, device, body) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(new Date().toISOString(), rec.topic, rec.name, rec.email, rec.work, rec.device, rec.body).run();

  await env.DB.prepare(
    "INSERT INTO contact_rate (k, at, n) VALUES (?, ?, 1) " +
      "ON CONFLICT(k) DO UPDATE SET at = ?, n = n + 1"
  ).bind(rk, now, now).run();

  // 通知は返事を待たせない。失敗しても受理は受理
  if (waitUntil) waitUntil(notify(env, rec));

  return json({ ok: true });
}

export async function onRequest({ request, env, waitUntil }) {
  try {
    if (request.method === "POST") return await post(request, env, waitUntil);
  } catch (e) {
    // 無料枠切れ・D1の一時障害など。**受理したふりをしない**
    return json({ error: "unavailable" }, 503);
  }
  return json({ error: "method not allowed" }, 405);
}
