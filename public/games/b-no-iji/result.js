import {journeyLocation} from './geography.js';
import {formatKm} from './journey.js';
import {PUBLIC_GAME_URL} from './publish-config.js';
import {ROUTE,GOAL,clamp} from './flight.js';

export function runResult(s){
 const km=clamp(Number(s.km)||0,0,GOAL),metres=Math.floor(km*1000);
 let index=0;while(index<ROUTE.length-1&&km>=ROUTE[index+1].km)index++;
 const here=ROUTE[index],next=ROUTE[index+1],offset=Math.floor((km-here.km)*1000);
 const place=next?`${here.name}駅 → ${next.name}駅（${here.name}から${formatKm(offset/1000)}km）`:'西大山駅';
 const cleared=s.ended==='clear'||!next;
 const reason={fall:'落下',collision:'衝突',ceiling:'高度オーバー',side:'コースアウト'}[s.ended]||'到着';
 const prefecture=journeyLocation(km).prefecture.name;
 return{km,metres,place,reason,index,cleared,prefecture};
}
// The shared link is a small page whose card image is the map at the station reached.
export function sharePageUrl(s){const r=runResult(s);const url=new URL(`share/${r.metres}`,PUBLIC_GAME_URL);url.searchParams.set('e',r.cleared?'clear':s.ended||'fall');return url.href;}
// The post itself (2026-09-12 wording). The link is part of the text so it lands on its own line under the arrow.
export function shareText(s){
 const r=runResult(s),reached=r.cleared?`${formatKm(r.km)}km飛行し、西大山駅に到達　完全クリア！`:`${formatKm(r.km)}km飛行し、${r.prefecture}に到達！`;
 return `${reached}\nあなたはBをどこまで飛ばせる？\n#皆もBを応援しよう\n\n↓スマホ・PCで今すぐプレイ↓\n${sharePageUrl(s)}`;
}
export function shareUrl(s){
 const url=new URL('https://x.com/intent/tweet');url.searchParams.set('text',shareText(s));
 return url.href;
}
