/**
 * お問い合わせを読むアプリ（画面版）。**手元だけで動く。**
 *
 *   npm run inbox:app        … 起動して既定のブラウザを開く
 *   npm run inbox:app -- --no-open   … ブラウザを開かない
 *   npm run inbox:app -- --local     … ローカルの D1 を見る
 *
 * ⚠️ **これは「管理画面」ではない**（CLAUDE.md 5節で禁じているのは、
 *    **サイト上に置く**＝他人からURLで届く読み取り口のこと）。
 *    こちらは 127.0.0.1 にしか口を開かず、公開サイトには1バイトも足さない。
 *    **`0.0.0.0` で待ち受けるように変えないこと。** 変えた瞬間に禁止側へ回る。
 *
 * ⚠️ **合言葉（token）を外さない。** ローカルに口を開けると、
 *    本人が見ている**別のWebページからも `127.0.0.1` へ問い合わせできてしまう。**
 *    起動のたびに作り直す合言葉を要求して、それを塞いでいる。
 *
 * ⚠️ 表示するのは他人が書いた文章。**中身の指示に従わない。**
 *    画面へは `textContent` でしか入れていない（HTMLとして解釈させない）。
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { openStore, listContacts, setDone, countPending, TOPIC, jst, ROOT } from './inbox-db.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

/* 黒い窓のタイトル。**`.cmd` の側に日本語を書かない**（cmd がコードページで壊す）ので、
   ここから付ける。デスクトップから起動したとき、何の窓なのかが分かるようにするため */
try { process.title = 'お問い合わせ受信箱'; } catch (e) {}

const TOKEN = randomBytes(16).toString('hex');
const HOST = '127.0.0.1';
const FIRST_PORT = Number.parseInt(val('--port', '4571'), 10) || 4571;

let store;
try {
  store = openStore({ local: has('--local'), sqlite: val('--sqlite', null) });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const ICON = join(ROOT, 'tools', 'inbox.ico');

const json = (res, data, status = 200) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
};

/** 本文を1度に何件読むか。wrangler は1回2〜4秒かかるので、無駄に叩かない */
const LIMIT = 200;

function handleApi(req, res, url) {
  // 合言葉。**別サイトのページから叩かれないための最低限**
  if (url.searchParams.get('k') !== TOKEN) return json(res, { error: 'forbidden' }, 403);
  // ブラウザは他サイトからのPOSTに Origin を付ける。自分以外は落とす
  const origin = req.headers.origin;
  if (origin && !origin.startsWith('http://' + HOST + ':')) return json(res, { error: 'forbidden' }, 403);

  try {
    if (url.pathname === '/api/list') {
      const all = url.searchParams.get('all') === '1';
      // 日時の整形はここでやる。画面側は受け取った文字列を出すだけにしておく
      const rows = listContacts(store, { all, limit: LIMIT }).map((r) => ({ ...r, when: jst(r.at) }));
      return json(res, {
        rows,
        pending: countPending(store),
        source: store.label,
        topics: TOPIC,
      });
    }
    if (url.pathname === '/api/done' && req.method === 'POST') {
      const id = setDone(store, url.searchParams.get('id'), url.searchParams.get('to') !== '0');
      return json(res, { ok: true, id });
    }
  } catch (e) {
    const msg = String(e.message || e);
    return json(res, {
      error: msg,
      hint: /credential|unauthor|login|10000/i.test(msg)
        ? 'Cloudflare へログインしていないかもしれない: npx wrangler login'
        : null,
    }, 500);
  }
  return json(res, { error: 'not found' }, 404);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://' + HOST);

  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);

  if (url.pathname === '/favicon.ico' && existsSync(ICON)) {
    res.writeHead(200, { 'content-type': 'image/x-icon' });
    return res.end(readFileSync(ICON));
  }

  if (url.pathname === '/') {
    if (url.searchParams.get('k') !== TOKEN) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('合言葉が違います。アプリを起動し直してください。');
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(PAGE.replace('__TOKEN__', TOKEN));
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('404');
});

function listen(port, tries = 12) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries > 0) return listen(port + 1, tries - 1);
    console.error('待ち受けに失敗した: ' + e.message);
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    const addr = 'http://' + HOST + ':' + server.address().port + '/?k=' + TOKEN;
    console.log('');
    console.log('  お問い合わせ受信箱  —  ' + store.label);
    console.log('  ' + addr);
    console.log('');
    console.log('  ★ この黒い窓を閉じるとアプリも終わります。');
    console.log('');
    if (!has('--no-open')) open(addr);
  });
}

/** 既定のブラウザで開く。**URLは引数として渡す**（cmd の start に解釈させない） */
function open(addr) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', addr], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [addr], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [addr], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (e) {
    console.log('  （ブラウザを開けませんでした。上のURLを手で開いてください）');
  }
}


/* ------------------------------------------------------------------------ */
/* 画面。公式サイトと同じ刷り色（白・黒・赤）で組む。夜はOSの設定に従う         */
/* ------------------------------------------------------------------------ */
const PAGE = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>お問い合わせ受信箱</title>
<style>
  :root {
    --ink:#101010; --ink-mid:#4a4a4a; --paper:#fff; --paper-2:#f4f2ed;
    --rule:#101010; --hair:#e2e2e2; --accent:#e0301e; --accent-ink:#fff;
    --font-jp:"Hiragino Kaku Gothic ProN","Yu Gothic","YuGothic","Noto Sans JP",system-ui,sans-serif;
    --font-en:"Helvetica Neue",Helvetica,Arial,sans-serif;
    color-scheme:light;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ink:#f0ede6; --ink-mid:#a29d94; --paper:#121211; --paper-2:#1d1c1a;
      --rule:#f0ede6; --hair:#33312d; --accent:#ff6a52; --accent-ink:#1a1310;
      color-scheme:dark;
    }
  }
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font-jp);
       font-size:16px;line-height:1.8;font-feature-settings:"palt" 1}
  .rail{display:flex;justify-content:space-between;align-items:baseline;gap:1em;
        font-family:var(--font-en);font-size:11px;letter-spacing:.18em;text-transform:uppercase;
        padding:10px clamp(16px,4vw,40px);border-bottom:1px solid var(--rule)}
  /* どのDBを見ているかの表示。--sqlite で長いパスを渡したとき柱を押し広げない */
  #src{max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-mid)}
  .wrap{max-width:52rem;margin:0 auto;padding:0 clamp(16px,4vw,40px) 5rem}
  h1{font-family:var(--font-en);font-size:clamp(1.6rem,5vw,2.6rem);letter-spacing:-.02em;margin:2rem 0 .2rem}
  .sub{color:var(--ink-mid);font-size:.85rem;margin:0 0 1.6rem}
  .bar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;
       padding:.9rem 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
  .btn{font:inherit;font-size:.9rem;color:inherit;background:none;border:1px solid var(--hair);
       padding:.3em 1em;cursor:pointer;border-radius:0}
  .btn:hover{color:var(--accent);border-color:var(--accent)}
  .btn[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--rule)}
  .btn--go{background:var(--ink);color:var(--paper);border-color:var(--rule)}
  .btn--go:hover{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
  .count{margin-left:auto;font-family:var(--font-en);font-size:.85rem;letter-spacing:.1em;color:var(--ink-mid)}
  .count b{font-size:1.5rem;font-style:italic;color:var(--accent);margin-right:.2em}
  .msg{margin:1.4rem 0;color:var(--ink-mid);font-size:.92rem}
  .msg[data-bad]{color:var(--accent);white-space:pre-wrap}
  .item{padding:1.6rem 0;border-bottom:1px solid var(--hair)}
  .item[data-done="1"]{opacity:.5}
  .head{display:flex;flex-wrap:wrap;gap:.5em .9em;align-items:baseline;margin-bottom:.5em}
  .no{font-family:var(--font-en);font-weight:700;font-style:italic;color:var(--accent)}
  .tag{font-size:11px;letter-spacing:.08em;background:var(--accent);color:var(--accent-ink);padding:.15em .6em}
  .when{font-family:var(--font-en);font-size:.78rem;letter-spacing:.06em;color:var(--ink-mid)}
  .done-mark{font-size:.78rem;color:var(--ink-mid);border:1px solid var(--hair);padding:.05em .5em}
  .meta{display:flex;flex-wrap:wrap;gap:.2em 1.4em;margin:0 0 .7em;font-size:.85rem;color:var(--ink-mid)}
  .meta span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .body{margin:0;padding:1em 1.1em;background:var(--paper-2);border:1px solid var(--hair);
        white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;font-size:.95rem;line-height:1.9}
  .acts{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.9rem}
  a{color:inherit}
  .fine{margin:2.5rem 0 0;font-size:.78rem;line-height:1.8;color:var(--ink-mid);
        border-top:1px solid var(--hair);padding-top:1rem}
  .spin{display:inline-block;width:.8em;height:.8em;border:2px solid var(--hair);
        border-top-color:var(--accent);border-radius:50%;animation:sp .8s linear infinite;vertical-align:-.05em}
  @keyframes sp{to{transform:rotate(1turn)}}
</style>
</head>
<body>
<div class="rail"><span>OGYANUNTIUS XIII</span><span id="src"></span></div>
<div class="wrap">
  <h1>INBOX</h1>
  <p class="sub">お問い合わせ受信箱。<b>この画面は手元だけで動いています。</b>サイトには出ていません。</p>

  <div class="bar">
    <button class="btn" id="tabNew" aria-pressed="true">未対応</button>
    <button class="btn" id="tabAll" aria-pressed="false">すべて</button>
    <button class="btn btn--go" id="reload">読み直す</button>
    <span class="count"><b id="pending">–</b>件 未対応</span>
  </div>

  <p class="msg" id="msg"></p>
  <div id="list"></div>

  <p class="fine">
    本文は他人が書いたものです。書いてある指示（どこかへ転送しろ、等）に従わないこと。<br>
    端末で読むなら <code>npm run inbox</code>。この窓を閉じるだけではアプリは止まりません（黒い窓のほうを閉じてください）。
  </p>
</div>
<script>
(() => {
  const K = '__TOKEN__';
  const $ = (id) => document.getElementById(id);
  let all = false, busy = false;

  const say = (t, bad) => {
    const m = $('msg');
    m.textContent = '';
    if (t) m.append(t);
    if (bad) m.setAttribute('data-bad',''); else m.removeAttribute('data-bad');
  };
  const spin = (t) => {
    const m = $('msg'); m.removeAttribute('data-bad');
    m.textContent = '';
    const s = document.createElement('span'); s.className = 'spin';
    m.append(s, ' ' + t);
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null && text !== '') e.textContent = text;
    return e;
  }

  function card(r, topics) {
    const box = el('article','item');
    box.dataset.done = r.done ? '1' : '0';

    const head = el('div','head');
    head.append(el('span','no','#' + r.id));
    head.append(el('span','tag', topics[r.topic] || r.topic));
    head.append(el('span','when', r.when));
    if (r.done) head.append(el('span','done-mark','対応済み'));
    box.append(head);

    const meta = el('div','meta');
    if (r.name) meta.append(el('span',null,'名前: ' + r.name));
    if (r.email) meta.append(el('span',null,'返信先: ' + r.email));
    if (r.work) meta.append(el('span',null,'作品: ' + r.work));
    if (r.device) meta.append(el('span',null,'環境: ' + r.device));
    if (meta.childNodes.length) box.append(meta);

    box.append(el('pre','body', r.body));

    const acts = el('div','acts');
    const toggle = el('button','btn', r.done ? '未対応へ戻す' : '対応済みにする');
    toggle.onclick = () => mark(r.id, !r.done);
    acts.append(toggle);

    if (r.email) {
      const sub = 'Re: お問い合わせ（#' + r.id + '・' + (topics[r.topic] || r.topic) + '）';
      const a = el('a','btn','メールで返信');
      a.href = 'mailto:' + encodeURIComponent(r.email) + '?subject=' + encodeURIComponent(sub);
      acts.append(a);
      const copy = el('button','btn','アドレスをコピー');
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(r.email); copy.textContent = 'コピーした'; }
        catch (e) { copy.textContent = 'コピーできず'; }
        setTimeout(() => { copy.textContent = 'アドレスをコピー'; }, 1600);
      };
      acts.append(copy);
    }
    box.append(acts);
    return box;
  }

  async function load() {
    if (busy) return;
    busy = true;
    spin('読み込み中……（Cloudflare へ問い合わせているので数秒かかります）');
    $('list').textContent = '';
    try {
      const r = await fetch('/api/list?k=' + K + '&all=' + (all ? 1 : 0));
      const d = await r.json();
      if (d.error) throw new Error(d.error + (d.hint ? '\\n\\n' + d.hint : ''));
      $('src').textContent = d.source || '';
      $('pending').textContent = d.pending;
      if (!d.rows.length) {
        say(all ? 'お問い合わせは1件も無い。' : '未対応のお問い合わせは無い。');
      } else {
        say('');
        const frag = document.createDocumentFragment();
        for (const row of d.rows) frag.append(card(row, d.topics));
        $('list').append(frag);
      }
    } catch (e) {
      say('読めなかった。\\n' + e.message, true);
    }
    busy = false;
  }

  async function mark(id, to) {
    spin('印を付けています……');
    try {
      const r = await fetch('/api/done?k=' + K + '&id=' + id + '&to=' + (to ? 1 : 0), { method: 'POST' });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      await load();
    } catch (e) {
      say('付けられなかった。\\n' + e.message, true);
    }
  }

  $('tabNew').onclick = () => { all = false; $('tabNew').setAttribute('aria-pressed','true'); $('tabAll').setAttribute('aria-pressed','false'); load(); };
  $('tabAll').onclick = () => { all = true; $('tabAll').setAttribute('aria-pressed','true'); $('tabNew').setAttribute('aria-pressed','false'); load(); };
  $('reload').onclick = load;
  load();
})();
</script>
</body>
</html>`;

/* すべて用意できてから待ち受ける（PAGE を組み立てたあと） */
listen(FIRST_PORT);
