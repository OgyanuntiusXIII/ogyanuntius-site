import {LEADERBOARD_API,RULESET} from './publish-config.js';
export class Leaderboard{
 constructor(){this.id=null;this.serial=0;this.pending=null;}
 async request(body){
  const response=await fetch(LEADERBOARD_API,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(6000)});
  const result=await response.json().catch(()=>({error:'ランキングに接続できません'}));if(!response.ok)throw new Error(result.error||'ランキングに接続できません');return result;
 }
 start(){const serial=++this.serial;this.id=null;this.pending=this.request({action:'start',ruleset:RULESET}).then(r=>{if(this.serial===serial)this.id=r.id;return r.id;}).catch(()=>null);}
 async qualify(s){const id=await this.pending;if(!id)throw new Error('ランキングに接続できません');return this.request({action:'qualify',id,metres:Math.floor(s.km*1000),rings:s.rings,destroyed:s.destroyed,nearMisses:s.nearMisses,trainHits:s.trainHitsTotal,elapsed:Math.round(s.elapsed*1000)/1000});}
 register(name){return this.request({action:'register',id:this.id,name});}
 load(){return this.request();}
}
