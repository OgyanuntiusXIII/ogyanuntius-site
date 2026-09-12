import {GOAL,KM_PER_UNIT,MAX_GAME_RATE} from '../../public/games/b-no-iji/journey.js';
import {RULESET} from '../../public/games/b-no-iji/publish-config.js';
import {possibleTrains} from '../../public/games/b-no-iji/suica-charge.js';
import {obstacleCount} from '../../public/games/b-no-iji/course.js';
import {flierCount} from '../../public/games/b-no-iji/fliers.js';
export const SCHEMA=[
 'CREATE TABLE IF NOT EXISTS b_iji_route64_runs (id TEXT PRIMARY KEY, started INTEGER NOT NULL, elapsed REAL, metres INTEGER, name TEXT)',
 'CREATE TABLE IF NOT EXISTS b_iji_route64_board (id TEXT PRIMARY KEY, name TEXT NOT NULL, elapsed REAL NOT NULL, metres INTEGER NOT NULL, created INTEGER NOT NULL)',
 'CREATE INDEX IF NOT EXISTS b_iji_route64_order ON b_iji_route64_board (metres DESC, elapsed ASC, created ASC, id ASC)',
 'CREATE TABLE IF NOT EXISTS b_iji_route64_rate (k TEXT PRIMARY KEY, day INTEGER NOT NULL, n INTEGER NOT NULL)',
 // Everyone's finished flights: a single row, one extra row written per confirmed result.
 'CREATE TABLE IF NOT EXISTS b_iji_route64_totals (k TEXT PRIMARY KEY, runs INTEGER NOT NULL DEFAULT 0, metres INTEGER NOT NULL DEFAULT 0)'
];
const order='metres DESC, elapsed ASC, created ASC, id ASC';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export function validResult(b,wallSeconds){
 if(!integer(b.metres,1,Math.floor(GOAL*1000))||!Number.isFinite(b.elapsed)||b.elapsed<=0||b.elapsed>3600||b.elapsed>wallSeconds+3)return false;
 const metresPerUnit=KM_PER_UNIT*1000;
 if(b.metres>(b.elapsed+.05)*325*MAX_GAME_RATE*metresPerUnit)return false;
 // metres is floored, so allow a couple of units of slack before counting what the flight can have met.
 const units=b.metres/metresPerUnit+2,maxRings=Math.max(0,Math.floor((units-199)/105)+1),maxObstacles=obstacleCount(units),maxFliers=flierCount(units);
 return integer(b.rings,0,maxRings)&&integer(b.nearMisses,0,maxObstacles)&&integer(b.destroyed,0,maxObstacles+maxFliers+possibleTrains(b.rings,b.nearMisses)*3)&&integer(b.trainHits,0,possibleTrains(b.rings,b.nearMisses)*100);
}
export function playerName(value){if(typeof value!=='string')return null;const name=value.normalize('NFKC').trim().replace(/\s+/g,' ');return name&&[...name].length<=12&&!/[\p{Cc}\p{Cf}<>]/u.test(name)?name:null;}
async function entries(db){return (await db.prepare(`SELECT name,elapsed,metres FROM b_iji_route64_board ORDER BY ${order} LIMIT 30`).all()).results;}
async function totals(db){const row=await db.prepare("SELECT runs,metres FROM b_iji_route64_totals WHERE k='all'").first();return{runs:row?.runs??0,metres:row?.metres??0};}
async function rank(db,elapsed,metres){const r=await db.prepare('SELECT COUNT(*) AS n FROM b_iji_route64_board WHERE metres > ? OR (metres = ? AND elapsed <= ?)').bind(metres,metres,elapsed).first();return r.n+1;}
async function hash(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function createHandler(now=()=>Date.now()){
 const ready=new WeakMap();
 return async function onRequest({request,env}){
  const db=env.DB;if(!db)return json({error:'ランキングを準備中です'},503);
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'このページから登録してください'},403);
  try{
   if(!ready.has(db))ready.set(db,db.batch(SCHEMA.map(sql=>db.prepare(sql))).catch(e=>{ready.delete(db);throw e;}));await ready.get(db);
   if(request.method==='GET')return json({entries:await entries(db),totals:await totals(db)});
   if(Number(request.headers.get('content-length'))>4096)return json({error:'送信内容が長すぎます'},413);
   const raw=await request.text();if(raw.length>4096)return json({error:'送信内容が長すぎます'},413);
   let b;try{b=JSON.parse(raw);}catch{return json({error:'記録を読み取れません'},400);}if(!b||typeof b!=='object')return json({error:'記録を読み取れません'},400);
   const at=now();
   if(b.action==='start'){
    if(b.ruleset!==RULESET)return json({error:'ページを読み直してください'},409);
    const day=Math.floor(at/86400000),key=await hash(`${day}/${request.headers.get('cf-connecting-ip')||'local'}`);
    const rate=await db.prepare('INSERT INTO b_iji_route64_rate (k,day,n) VALUES (?,?,1) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n').bind(key,day).first();
    if(rate.n>300)return json({error:'少し待ってから試してください'},429);
    const id=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO b_iji_route64_runs (id,started) VALUES (?,?)').bind(id,at),db.prepare('DELETE FROM b_iji_route64_runs WHERE started < ?').bind(at-86400000),db.prepare('DELETE FROM b_iji_route64_rate WHERE day < ?').bind(day-1)]);return json({id});
   }
   if(typeof b.id!=='string'||!/^[\da-f-]{36}$/.test(b.id))return json({error:'プレイ記録がありません'},400);
   const run=await db.prepare('SELECT * FROM b_iji_route64_runs WHERE id=?').bind(b.id).first();if(!run||at-run.started>86400000)return json({error:'プレイ記録の期限が切れました'},410);
   if(b.action==='qualify'){
    if(!validResult(b,(at-run.started)/1000))return json({error:'記録を確認できませんでした'},422);
    if(run.elapsed!==null&&(run.elapsed!==b.elapsed||run.metres!==b.metres))return json({error:'この記録は確定しています'},409);
    const settled=await db.prepare('UPDATE b_iji_route64_runs SET elapsed=?,metres=? WHERE id=? AND elapsed IS NULL').bind(b.elapsed,b.metres,b.id).run();
    // Only the first confirmation of a run counts toward everyone's totals.
    if(settled.meta?.changes)await db.prepare("INSERT INTO b_iji_route64_totals (k,runs,metres) VALUES ('all',1,?) ON CONFLICT(k) DO UPDATE SET runs=runs+1, metres=metres+excluded.metres").bind(b.metres).run();
    const confirmed=await db.prepare('SELECT elapsed,metres FROM b_iji_route64_runs WHERE id=?').bind(b.id).first();if(confirmed.elapsed!==b.elapsed||confirmed.metres!==b.metres)return json({error:'この記録は確定しています'},409);
    const place=await rank(db,b.elapsed,b.metres);return json({rank:place<=30?place:null,entries:await entries(db),totals:await totals(db)});
   }
   if(b.action==='register'){
    const name=playerName(b.name);if(!name)return json({error:'名前は1〜12文字で入力してください'},400);
    if(run.elapsed===null)return json({error:'先にプレイを終えてください'},409);
    if(run.name!==null&&run.name!==name)return json({error:'この記録は登録済みです'},409);
    if(run.name===null&&await rank(db,run.elapsed,run.metres)>30)return json({error:'今回は30位圏外でした',entries:await entries(db)},409);
    // Insert, consume the run and keep the best thirty in a single D1 transaction.
    await db.batch([
     db.prepare('INSERT OR IGNORE INTO b_iji_route64_board (id,name,elapsed,metres,created) VALUES (?,?,?,?,MAX(?,COALESCE((SELECT MAX(created)+1 FROM b_iji_route64_board),0)))').bind(b.id,name,run.elapsed,run.metres,at),
     db.prepare('UPDATE b_iji_route64_runs SET name=? WHERE id=? AND name IS NULL').bind(name,b.id),
     db.prepare(`DELETE FROM b_iji_route64_board WHERE id NOT IN (SELECT id FROM b_iji_route64_board ORDER BY ${order} LIMIT 30)`)
    ]);
    const all=(await db.prepare(`SELECT id,name,elapsed,metres FROM b_iji_route64_board ORDER BY ${order} LIMIT 30`).all()).results,index=all.findIndex(x=>x.id===b.id);
    return json({rank:index<0?null:index+1,entries:all.map(({id,...row})=>row)});
   }
   return json({error:'記録を読み取れません'},400);
  }catch(e){console.error('leaderboard',e.message);return json({error:'保存できませんでした。もう一度試してください'},503);}
 };
}
export const onRequest=createHandler();
