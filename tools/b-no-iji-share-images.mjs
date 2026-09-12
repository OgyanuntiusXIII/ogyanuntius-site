/* 『Bの意地』の共有カード画像を作る（X のカード用 1200x630）。
 *
 *   node tools/b-no-iji-share-images.mjs [--character <透過PNG>]
 *
 * 出力：
 *   public/games/b-no-iji/assets/share/00.jpg … 63.jpg  駅ごと。「稚内からどこまで飛んだか」の地図
 *   public/games/b-no-iji/assets/ogp-route.jpg          ゲームページと作品ページの OGP（全ルート）
 *
 * 地図の描き方はゲーム内の result-map.js と同じ投影・同じ色。データも同じファイルを読む。
 * キャラクター（tools/assets/b-no-iji-character.png・ゲームの mimi.glb を描画した透過PNG）を OGP の左下と、
 * 駅ごとのカードでは県名の右隣に乗せる。--character で別の透過PNGに差し替えられる。
 * 依存は sharp だけ（Astro が持っている）。
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {STATIONS,ROUTE,GOAL,formatKm} from '../public/games/b-no-iji/journey.js';
import {journeyLocation,routeCoordinates} from '../public/games/b-no-iji/geography.js';
import {PREFECTURES} from '../public/games/b-no-iji/japan-map-data.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'public/games/b-no-iji/assets');
const W=1200,H=630;
const characterArg=process.argv.indexOf('--character');
const DEFAULT_CHARACTER=path.join(ROOT,'tools/assets/b-no-iji-character.png');
const character=characterArg>0?process.argv[characterArg+1]:(fs.existsSync(DEFAULT_CHARACTER)?DEFAULT_CHARACTER:null);

// Same projection as result-map.js: a 560x460 map space.
const project=({lon,lat})=>[58+(lon-128)*Math.cos(38*Math.PI/180)*25.7,30+(46-lat)*25.7];
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pathOf=points=>points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
const land=PREFECTURES.map(f=>({code:f.code,d:f.polygons.flatMap(p=>p.map(r=>pathOf(r.map(([lon,lat])=>project({lon,lat})))+'Z')).join('')}));
const FONT="'Yu Gothic UI','Yu Gothic','Meiryo','Hiragino Kaku Gothic ProN',sans-serif";
const text=(x,y,size,fill,body,extra='')=>`<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}" ${extra}>${esc(body)}</text>`;

function mapSvg(km,current){
 const parts=[`<g transform="translate(548 24) scale(1.16)" clip-path="url(#clip)">`,`<rect x="0" y="0" width="560" height="455" fill="#eef7f5"/>`];
 for(const f of land)parts.push(`<path d="${f.d}" fill="${current===f.code?'#e2c9f5':'#dce8e3'}" stroke="${current===f.code?'#a278ba':'#a3bcb3'}" stroke-width="${current===f.code?1:.6}" stroke-linejoin="round" fill-rule="evenodd"/>`);
 parts.push(`<path d="${pathOf(routeCoordinates().map(project))}" fill="none" stroke="#9eafa7" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>`);
 if(km!==null){const d=pathOf(routeCoordinates(km).map(project));parts.push(`<path d="${d}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#872be4" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);}
 for(let i=0;i<STATIONS.length;i++){const[x,y]=project({lat:STATIONS[i][1],lon:STATIONS[i][2]}),passed=km!==null&&ROUTE[i].km<=km+1e-9;parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${passed?'#872be4':'#f5faf7'}" stroke="${passed?'#fff':'#82988b'}" stroke-width="1"/>`);}
 for(const[name,dx,dy,anchor]of[['稚内',-10,-8,'end'],['札幌',-10,1,'end'],['東京',12,5,'start'],['名古屋',12,23,'start'],['博多',-8,-8,'end'],['西大山',10,20,'start']]){const i=STATIONS.findIndex(s=>s[0]===name),[x,y]=project({lat:STATIONS[i][1],lon:STATIONS[i][2]});parts.push(text((x+dx).toFixed(1),(y+dy).toFixed(1),13,'#36473e',name,`text-anchor="${anchor}" stroke="#f1f8f1" stroke-width="4" paint-order="stroke" stroke-linejoin="round"`));}
 if(km!==null){const[x,y]=project(journeyLocation(km));parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="#fff" stroke="#872be4" stroke-width="2"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="#f5b933"/>`);}
 parts.push('</g>');return parts.join('');
}
function frame(inner,km,current){
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4eaf4"/><stop offset="1" stop-color="#eef7f0"/></linearGradient><clipPath id="clip"><rect x="0" y="0" width="560" height="455"/></clipPath></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/><rect x="520" y="0" width="${W-520}" height="${H}" fill="#ffffff" opacity=".38"/>
${mapSvg(km,current)}
${text(52,170,86,'#2a1546','Bの意地','font-weight="900" letter-spacing="-4"')}
${text(56,214,26,'#1c243b','2ボタンで、日本縦断。','font-weight="800" letter-spacing="2"')}
${inner}
${text(56,608,14,'#6f7f84','ogyanuntiusxiii.com/games/b-no-iji')}
</svg>`;
}
// Where the character stands on a station card: right of the prefecture name, or beside the map on the final card.
export function characterSpot(i){const last=i===ROUTE.length-1,where=last?'':journeyLocation(ROUTE[i].km).prefecture.name;return last?{left:505,top:330,height:200}:{left:Math.max(340,60+[...where].length*60+16),top:296,height:240};}
function stationCard(i){
 const km=ROUTE[i].km,place=journeyLocation(km),last=i===ROUTE.length-1,where=last?'西大山駅':place.prefecture.name;
 const inner=[
  text(56,76,20,'#647779','B NO IJI / FLIGHT LOG','font-weight="700" letter-spacing="6"'),
  text(56,300,46,'#1c243b',`日本縦断 ${place.percent.toFixed(1)}%`,'font-weight="900"'),
  text(56,348,28,'#3a4a56',`${i+1} / ${ROUTE.length}駅　${formatKm(km)}km`,'font-weight="700"'),
  text(54,440,last?56:60,'#872be4',last?'日本縦断 完全クリア':where,'font-weight="900" letter-spacing="-2"'),
  text(56,482,22,'#3a4a56',last?'稚内 → 西大山　64駅':`稚内 → ${ROUTE[i].name}駅`,'font-weight="700"'),
  text(56,578,22,'#872be4','#皆もBを応援しよう','font-weight="800"'),
 ].join('\n');
 return frame(inner,km,place.prefecture.code);
}
function baseCard(){
 const inner=[
  text(56,76,20,'#647779','2-BUTTON FLIGHT ACROSS JAPAN','font-weight="700" letter-spacing="6"'),
  text(56,292,30,'#1c243b','稚内 → 西大山　64駅','font-weight="900"'),
  text(56,330,17,'#3a4a56','毒スイカが耳で飛ぶ、2ボタンの3Dブラウザゲーム','font-weight="700"'),
  text(56,578,22,'#872be4','#皆もBを応援しよう','font-weight="800"'),
 ].join('\n');
 return frame(inner,null,null);
}
async function main(){
 fs.mkdirSync(path.join(OUT,'share'),{recursive:true});
 const figures=new Map();
 for(let i=0;i<ROUTE.length;i++){
  const file=path.join(OUT,'share',String(i).padStart(2,'0')+'.jpg');
  let card=sharp(Buffer.from(stationCard(i)));
  if(character){const spot=characterSpot(i);if(!figures.has(spot.height))figures.set(spot.height,await sharp(character).resize({height:spot.height,withoutEnlargement:true}).png().toBuffer());card=sharp(await card.png().toBuffer()).composite([{input:figures.get(spot.height),left:spot.left,top:spot.top}]);}
  await card.jpeg({quality:82,mozjpeg:true}).toFile(file);
 }
 let base=sharp(Buffer.from(baseCard()));
 if(character){
  const png=await sharp(character).resize({height:280,withoutEnlargement:true}).png().toBuffer();
  const meta=await sharp(png).metadata();
  base=sharp(await base.png().toBuffer()).composite([{input:png,left:Math.round(440-meta.width/2),top:345}]);
 }
 await base.jpeg({quality:84,mozjpeg:true}).toFile(path.join(OUT,'ogp-route.jpg'));
 const total=fs.readdirSync(path.join(OUT,'share')).reduce((n,f)=>n+fs.statSync(path.join(OUT,'share',f)).size,0);
 console.log(`share/00-63.jpg: ${(total/1024).toFixed(0)} KB total, ogp-route.jpg: ${(fs.statSync(path.join(OUT,'ogp-route.jpg')).size/1024).toFixed(0)} KB`);
}
main().catch(e=>{console.error(e);process.exit(1);});
