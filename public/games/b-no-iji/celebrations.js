import {ROUTE,GOAL} from './journey.js';

// Events do not award points or alter physics. Every run owns its one-shot milestones.
export class JourneyEvents{
 constructor(best=0){this.best=best;this.beaten=false;this.station=0;this.smashes=0;this.finals=new Set();}
 ring(s,r){const events=[];if(Math.hypot(s.x-r.x,s.y-r.y)<.65)events.push({kind:'perfect',label:'ど真ん中'});if(s.combo>=5&&s.combo%5===0)events.push({kind:'chain',label:`×${s.combo}`,detail:'連続！'});return events;}
 smash(){this.smashes++;return this.smashes%3===0?[{kind:'demolition',label:`${this.smashes}連破壊`}]:[];}
 endRush(){this.smashes=0;}
 advance(s){const out=[];while(this.station<s.station){const from=ROUTE[this.station],i=++this.station,to=ROUTE[i];out.push({kind:'station',station:i,label:to.name+'駅'});if(from.region!==to.region)out.push({kind:'region',label:to.region+'へ',station:i});}
  if(!this.beaten&&this.best>0&&s.km>this.best){this.beaten=true;out.push({kind:'record',label:'自己ベスト更新'});}
  for(const km of[100,50,10])if(!this.finals.has(km)&&s.km>=GOAL-km){this.finals.add(km);out.push({kind:'final',label:`あと${km}km`,remaining:km});}
  return out;
 }
}
