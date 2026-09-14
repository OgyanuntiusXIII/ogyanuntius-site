// 学習機関車の共有ページ：/games/gakushu-kikansha/share/<政策思想>-<守った軸>-<犠牲にした軸>
// カード画像は事前に作った assets/share/<鍵>.jpg（tools/gakushu-kikansha-share-images.mjs が129通りを作る）。
// グラフは同じ診断になった形の代表例で、その人の形そのものではない。何も保存しない。知らない鍵はゲームへ返す。
import {CARDS} from '../../../../public/games/gakushu-kikansha/share-cards.js';
const escape = t => String(t).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export async function onRequestGet({request, params}) {
 const url = new URL(request.url), game = new URL('/games/gakushu-kikansha/', url.origin).href;
 const key = String(params.k || '');
 const c = /^[a-z]+-[a-z]+-[a-z]+$/.test(key) && Object.prototype.hasOwnProperty.call(CARDS, key) ? CARDS[key] : null;
 if (!c) return Response.redirect(game, 302);
 const image = `${url.origin}/games/gakushu-kikansha/assets/share/${key}.jpg`;
 const title = `学習機関車 — ${c.a}`;
 const description = `守ったもの：${c.top}。犠牲にしたもの：${c.bottom}。人口100万人の国で、生成AIと創作の政策を30秒ずつ決める3Dトロッコ問題。`;
 const alt = `8角グラフと診断。政策思想${c.a}、守ったもの${c.top}、犠牲にしたもの${c.bottom}。グラフは同じ診断になった形の代表例。`;
 const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<meta name="description" content="${escape(description)}"><meta name="robots" content="noindex">
<meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="オギャヌンティウス十三世">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url.origin + url.pathname)}">
<meta property="og:image" content="${escape(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escape(alt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}"><meta name="twitter:image:alt" content="${escape(alt)}">
<link rel="icon" href="data:,">
<style>
:root{--ground:#1b1a17;--panel:#1e1d1a;--line:#3b3931;--ink:#ece6d6;--ink-2:#c0b9a6;--muted:#8e8878;--red:#e8564a;--red-deep:#b8261c;--on-red:#fff7ec;
 --font-jp:"Hiragino Kaku Gothic ProN","Yu Gothic","YuGothic","Noto Sans JP",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:var(--ground);color:var(--ink);font-family:var(--font-jp)}
main{width:min(720px,94vw);margin:24px auto;padding:24px 22px 28px;background:var(--panel);border:1px solid var(--line);border-top:4px solid var(--red-deep);text-align:center}
.kicker{font-size:11px;letter-spacing:.25em;color:var(--muted);margin:0 0 8px}
h1{font-family:"Yu Mincho","Hiragino Mincho ProN",serif;font-size:clamp(24px,5vw,34px);line-height:1.3;margin:0 0 10px;text-wrap:balance}
.kept{margin:0 0 16px;font-size:15px;line-height:1.8}.kept b{color:var(--ink)}.kept .lost{color:var(--red)}
img{display:block;width:100%;height:auto;border:1px solid var(--line)}
.play{display:inline-block;margin:22px 0 6px;background:var(--red-deep);color:var(--on-red);text-decoration:none;font-weight:800;font-size:17px;letter-spacing:.2em;padding:15px 40px;border-radius:3px}
.play:hover{background:var(--red)}.site{display:block;font-size:12px;color:var(--ink-2);margin-top:14px}
.note{font-size:11px;color:var(--muted);margin:18px 0 0;line-height:1.7}
</style></head><body><main>
<p class="kicker">TRAINING DATA / 政策思想の診断</p>
<h1>${escape(c.a)}</h1>
<p class="kept">守ったもの：<b>${escape(c.top)}</b><br>犠牲にしたもの：<b class="lost">${escape(c.bottom)}</b></p>
<img src="${escape(image)}" width="1200" height="630" alt="${escape(alt)}">
<a class="play" href="${escape(game)}">自分も乗る</a>
<a class="site" href="/">オギャヌンティウス十三世のページへ</a>
<p class="note">グラフは同じ診断になった形の代表例です。人数・金額は人口100万人の架空の国の試算で、出典のある実測値に仮定を重ねて計算しています。</p>
</main><script>(function(){
 if(!location.hostname.endsWith("ogyanuntiusxiii.com")) return;
 var K="ogyanun.viewed",d=new Date(Date.now()+32400000).toISOString().slice(0,10),s=null;
 try{s=localStorage.getItem(K);}catch(e){}
 var f=s!==d;if(f){try{localStorage.setItem(K,d);}catch(e){}}
 fetch("/api/views"+(f?"?v=1":""),{method:"POST"}).catch(function(){});
})();</script></body></html>`;
 return new Response(html, {headers: {'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=86400', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff'}});
}
