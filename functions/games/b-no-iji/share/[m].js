// Share landing page for one flight: /games/b-no-iji/share/<metres>?e=<ending>
// The card image is the pre-rendered map for the station reached (assets/share/NN.jpg, made by tools/b-no-iji-share-images.mjs).
// Nothing is stored. A bad address just goes to the game.
import {ROUTE,GOAL,formatKm} from '../../../../public/games/b-no-iji/journey.js';
import {journeyLocation} from '../../../../public/games/b-no-iji/geography.js';
const ENDINGS={fall:'落下',collision:'衝突',ceiling:'高度オーバー',side:'コースアウト',clear:'完全クリア'};
const escape=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function onRequestGet({request,params}){
 const url=new URL(request.url),game=new URL('/games/b-no-iji/',url.origin).href;
 const metres=Number(params.m),end=url.searchParams.get('e')||'fall';
 if(!/^\d{1,8}$/.test(String(params.m))||!Number.isInteger(metres)||metres>Math.ceil(GOAL*1000)||!ENDINGS[end])return Response.redirect(game,302);
 const km=metres/1000,place=journeyLocation(km),cleared=end==='clear',where=place.prefecture.name,index=cleared?ROUTE.length-1:place.index;
 const line=cleared?`${formatKm(km)}km進み、${where}に到達　完全クリア！`:`${formatKm(km)}km進み、${where}に到達したが、${ENDINGS[end]}`;
 const image=`${url.origin}/games/b-no-iji/assets/share/${String(index).padStart(2,'0')}.jpg`;
 const title=cleared?'Bの意地 — 日本縦断 完全クリア':`Bの意地 — ${where}まで ${formatKm(km)}km`;
 const description=`${line}。稚内から西大山まで、2ボタンで日本縦断。`;
 const alt=`稚内から${where}までの飛行ルートを描いた日本地図。日本縦断${cleared?'100.0':place.percent.toFixed(1)}%、${index+1}駅を通過。`;
 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<meta name="description" content="${escape(description)}"><meta name="robots" content="noindex">
<meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="オギャヌンティウス十三世">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url.origin+url.pathname+url.search)}">
<meta property="og:image" content="${escape(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escape(alt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}"><meta name="twitter:image:alt" content="${escape(alt)}">
<link rel="icon" href="data:,">
<style>
:root{font-family:'Yu Gothic','Hiragino Kaku Gothic ProN',system-ui,sans-serif;color:#1c243b;background:#b4e3ed}
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:linear-gradient(180deg,#c4eaf4,#eaf4ee)}
main{width:min(720px,94vw);margin:24px auto;padding:26px 24px 30px;background:#ffffffe6;border-radius:12px;box-shadow:0 12px 40px #1c243b1f;text-align:center}
.kicker{font-size:10px;letter-spacing:.25em;font-weight:800;color:#647779;margin:0 0 6px}
h1{font-size:clamp(36px,8vw,64px);letter-spacing:-.06em;margin:0;line-height:1.1}h1 small{font-size:.4em;letter-spacing:0;margin-left:.2em}
.where{font-size:clamp(20px,3.6vw,28px);font-weight:850;color:#872be4;margin:6px 0 2px}.line{font-size:14px;margin:0 0 16px}
img{display:block;width:100%;height:auto;border-radius:8px;border:1px solid #bdd1c8}
.play{display:inline-block;margin:20px 0 6px;background:#872be4;color:#fff;text-decoration:none;font-weight:800;font-size:17px;letter-spacing:.2em;padding:16px 42px;border-radius:7px;box-shadow:0 5px 0 #56258b}
.play:hover{background:#983aea}.site{display:block;font-size:12px;color:#586a73;margin-top:14px}
.note{font-size:10px;color:#6f7f84;margin:18px 0 0;line-height:1.7}
</style></head><body><main>
<p class="kicker">B NO IJI / FLIGHT LOG</p>
<h1>${escape(formatKm(km))}<small>km</small></h1>
<p class="where">${escape(where)}</p>
<p class="line">${escape(line)}</p>
<img src="${escape(image)}" width="1200" height="630" alt="${escape(alt)}">
<a class="play" href="${escape(game)}">自分も飛ぶ</a>
<a class="site" href="/">オギャヌンティウス十三世のページへ</a>
<p class="note">JR東日本および関係各社とは関係のない、非公式ファンメイド作品です。飛行ルートは駅を結ぶゲーム上のコースで、実際の鉄道営業距離とは異なります。</p>
</main><script>(function(){
 if(!location.hostname.endsWith("ogyanuntiusxiii.com")) return;
 var K="ogyanun.viewed",d=new Date(Date.now()+32400000).toISOString().slice(0,10),s=null;
 try{s=localStorage.getItem(K);}catch(e){}
 var f=s!==d;if(f){try{localStorage.setItem(K,d);}catch(e){}}
 fetch("/api/views"+(f?"?v=1":""),{method:"POST"}).catch(function(){});
})();</script></body></html>`;
 return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=86400','x-robots-tag':'noindex','x-content-type-options':'nosniff'}});
}
