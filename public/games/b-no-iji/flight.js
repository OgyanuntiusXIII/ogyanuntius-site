import {OBSTACLE_GRACE_SECONDS,stepTrain,strumGuitar} from './rush.js';
import {windAt} from './districts.js';
import {addSuicaCharge,RING_CHARGE,SKILL_CHARGE} from './suica-charge.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
import {ROUTE,GOAL,KM_PER_UNIT,journeyRate} from './journey.js';
export {STATIONS,ROUTE,GOAL} from './journey.js';
export const GROUND_Y=1.55;
export const FALL_SPEED_MULTIPLIER=15, GUITAR_RING_COUNT=10, GUITAR_DURATION=6, CATAPULT_SPEED=120;
export const GRAVITY=10.5, TAP_LIFT=1.55, TAP_SIDE=4.5, MAX_HEALTH=1, RING_RADIUS=1.9, RING_CAPTURE_RADIUS=1.7;
export const CEILING_Y=10.5, SIDE_LIMIT=9;
// Integral of the decaying speed is exactly five turns for one isolated tap.
export const EAR_DRAG=5.5, EAR_CUTOFF=.12, EAR_IMPULSE=5*EAR_DRAG+EAR_CUTOFF;
export function newFlight(){return{time:0,elapsed:0,rate:1,travel:0,km:0,x:0,y:5.4,vx:0,vy:0,speed:55,rpm:[0,0],earPhase:[0,0],earVelocity:[0,0],earTurns:[0,0],flow:0,boost:0,invuln:0,health:MAX_HEALTH,combo:0,rings:0,maxCombo:0,obstacleGrace:0,guitar:false,guitarTime:0,guitarDuration:GUITAR_DURATION,guitarCharge:0,guitarStrums:0,lastGuitarStrum:null,trainHitsTotal:0,train:null,trainPending:false,launchAge:99,nearMisses:0,destroyed:0,wind:0,windWarning:0,windDirection:1,lastSide:0,lastTap:-10,station:0,peak:0,ended:null};}
export function releaseFromCatapult(s){s.speed=CATAPULT_SPEED;s.y=6.4;s.vy=4.5;s.flow=.35;s.launchAge=0;}
export function stepEars(s,dt){for(let i=0;i<2;i++){const v=s.earVelocity[i];if(v<=EAR_CUTOFF){s.earVelocity[i]=0;s.rpm[i]=0;continue;}const elapsed=Math.min(dt,Math.log(v/EAR_CUTOFF)/EAR_DRAG),next=v*Math.exp(-EAR_DRAG*elapsed),turns=(v-next)/EAR_DRAG;s.earTurns[i]+=turns;s.earPhase[i]=(s.earPhase[i]+turns)%1;s.earVelocity[i]=elapsed<dt?0:next;s.rpm[i]=s.earVelocity[i]/EAR_IMPULSE*1.8;}}
export function stopEars(s){s.earVelocity.fill(0);s.rpm.fill(0);}
export function tap(s,side,strength=1){
 if(s.ended||s.train)return false;
 const i=side<0?0:1;s.earVelocity[i]=Math.min(EAR_IMPULSE*1.6,s.earVelocity[i]+EAR_IMPULSE*strength);s.rpm[i]=s.earVelocity[i]/EAR_IMPULSE*1.8;
 s.vx=clamp(s.vx+side*(s.guitar?3.8:TAP_SIDE)*strength,-14,14);s.vy=clamp(s.vy+(s.guitar?.35:TAP_LIFT)*strength,-8,s.guitar?1.8:5.5);
 const alternating=side!==s.lastSide&&s.time-s.lastTap<.65;
 s.flow=clamp(s.flow+(alternating?.16:.045)*strength,0,1);
 if(strength===1){s.lastSide=side;s.lastTap=s.time;strumGuitar(s,strength);}
 return alternating;
}
export function step(s,dt){
 if(s.ended)return;
 const realDt=dt;s.elapsed+=realDt;s.obstacleGrace=Math.max(0,s.obstacleGrace-realDt);s.rate=journeyRate(s.km);dt*=s.rate;
 s.time+=dt;s.launchAge+=dt;
 if(s.train){
  stepEars(s,dt);stepTrain(s,realDt);if(s.ended){stopEars(s);return;}
  s.x*=Math.exp(-6*dt);s.y+=(5.4-s.y)*(1-Math.exp(-6*dt));s.vx=0;s.vy=0;s.wind=0;s.windWarning=0;
  s.speed+=((s.guitar?300:90)-s.speed)*(1-Math.exp(-6*dt));advanceRoute(s,dt);return;
 }
 if(s.guitar){s.guitarTime=Math.min(s.guitarDuration,s.guitarTime+realDt);if(s.guitarTime>=s.guitarDuration-1e-9){s.guitarTime=s.guitarDuration;s.guitar=false;s.guitarCharge=0;s.obstacleGrace=OBSTACLE_GRACE_SECONDS;}}
 s.invuln=Math.max(0,s.invuln-dt);s.boost=Math.max(0,s.boost-dt);s.flow=Math.max(0,s.flow-dt*.12);stepEars(s,dt);
 const gust=windAt(s.time,s.station);s.wind=s.guitar?0:gust.force;s.windWarning=s.guitar?0:gust.warning;s.windDirection=gust.direction;s.vx+=s.wind*dt;
 s.vx*=Math.exp(-(s.guitar?6.5:2.6)*dt);
 if(s.guitar){s.vy+=((5.8-s.y)*12-s.vy*6)*dt;s.y+=s.vy*dt;}
 else{s.vy-=GRAVITY*dt;s.vy*=Math.exp(-.8*dt);s.y+=s.vy*dt*(s.vy<0?FALL_SPEED_MULTIPLIER:1);}
 s.x+=s.vx*dt;
 if(s.y<=GROUND_Y){s.y=GROUND_Y;s.ended='fall';stopEars(s);return;}
 if(s.y>=CEILING_Y){s.y=CEILING_Y;s.ended='ceiling';stopEars(s);return;}
 if(Math.abs(s.x)>=SIDE_LIMIT){s.x=Math.sign(s.x)*SIDE_LIMIT;s.ended='side';stopEars(s);return;}
 const target=s.guitar?240+s.flow*50+(s.boost>0?35:0):55+s.flow*40+(s.boost>0?34:0);s.speed+=(target-s.speed)*(1-Math.exp(-(s.guitar?9:s.launchAge<1.2?.85:3)*dt));
 advanceRoute(s,dt);
}
function advanceRoute(s,dt){
 s.travel+=s.speed*dt;s.km=Math.min(GOAL,s.travel*KM_PER_UNIT);s.peak=Math.max(s.peak,s.speed*s.rate*1.8);
 while(s.station<ROUTE.length-1&&s.km>=ROUTE[s.station+1].km)s.station++;
}
export function ringHit(s,x,y,r=RING_CAPTURE_RADIUS){return Math.hypot(s.x-x,s.y-y)<r;}
export function boxHit(s,b){return Math.abs(s.x-b.x)<b.w/2+.45&&s.y>(b.baseY??0)-.65&&s.y<(b.baseY??0)+b.h+.65;}
export function damage(s){if(s.ended||s.obstacleGrace>0)return false;if(s.guitar){s.destroyed++;return 'smash';}s.health=0;s.ended='collision';breakChain(s);stopEars(s);return true;}
export function collectRing(s,perfect=false){if(s.ended)return false;s.rings++;s.combo++;s.maxCombo=Math.max(s.maxCombo,s.combo);s.boost=Math.min(5,s.boost+2.1);s.flow=clamp(s.flow+.22,0,1);return addSuicaCharge(s,RING_CHARGE+(perfect?SKILL_CHARGE:0),perfect?'ど真ん中 +0.2':'');}

export function nearMiss(s,b){
 if(s.ended||s.obstacleGrace>0||s.invuln>0||boxHit(s,b))return false;
 const dx=Math.max(0,Math.abs(s.x-b.x)-(b.w/2+.45)),dy=Math.max((b.baseY??0)-.65-s.y,s.y-((b.baseY??0)+b.h+.65),0);
 if(Math.hypot(dx,dy)>.85)return false;
 s.nearMisses++;s.flow=clamp(s.flow+.1,0,1);addSuicaCharge(s,SKILL_CHARGE,'ニアミス +0.2');return true;
}
export function breakChain(s){s.combo=0;}
