import {journeyLocation} from './geography.js';
import {formatKm} from './journey.js';
import {PUBLIC_GAME_URL} from './publish-config.js';
import {ROUTE,GOAL,clamp} from './flight.js';

export function runResult(s){
 const km=clamp(Number(s.km)||0,0,GOAL),metres=Math.floor(km*1000);
 let index=0;while(index<ROUTE.length-1&&km>=ROUTE[index+1].km)index++;
 const here=ROUTE[index],next=ROUTE[index+1],offset=Math.floor((km-here.km)*1000);
 const place=next?`${here.name}駅 → ${next.name}駅（${here.name}から${formatKm(offset/1000)}km）`:'西大山駅';
 const reason={fall:'落下',collision:'衝突',ceiling:'高度オーバー',side:'コースアウト'}[s.ended]||'到着';
 const prefecture=journeyLocation(km).prefecture.name;
 const text=`「Bの意地」\n稚内から ${formatKm(km)}km\n${prefecture}・${place}で${reason}。`;
 return{metres,place,reason,text};
}
export function shareUrl(s,pageUrl=''){
 const url=new URL('https://x.com/intent/tweet');url.searchParams.set('text',runResult(s).text);
 url.searchParams.set('url',PUBLIC_GAME_URL);
 return url.href;
}
