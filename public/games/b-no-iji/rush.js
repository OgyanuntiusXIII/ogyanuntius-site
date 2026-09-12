export const TRAIN_WARNING=.85, TRAIN_MASH=2.6, TRAIN_IMPACT=.5;
export const TRAIN_MIN_HITS=8, SECONDS_PER_HIT=.15;
export const GUITAR_TAP_SECONDS=.03;
export const OBSTACLE_GRACE_SECONDS=1;
export const guitarSeconds=hits=>Math.round(hits*SECONDS_PER_HIT*100)/100;
export const guitarRemaining=s=>Math.max(0,s.guitarDuration-s.guitarTime);
// Two flashes per second; the body stays visible even when its glow is off.
export const guitarLit=s=>!s.guitar||guitarRemaining(s)>2||Math.floor(guitarRemaining(s)*4)%2===0;
export function startTrain(s){
 if(s.ended||s.guitar||s.train)return false;
 s.train={phase:'warning',time:0,hits:0,lastHit:-10,side:1};
 s.trainPending=false;s.guitarCharge=0;s.vx=0;s.vy=0;return true;
}
export function mashTrain(s,side,strength=1){
 const e=s.train;if(s.ended||!e||e.phase!=='mash'||strength!==1)return false;
 e.hits++;e.lastHit=e.time;e.side=side;return true;
}
export function startGuitar(s,hits){
 s.obstacleGrace=0;s.guitar=true;s.guitarDuration=guitarSeconds(hits);s.guitarTime=0;s.guitarCharge=0;
 s.guitarStrums=0;s.lastGuitarStrum=-10;
 s.speed=Math.max(s.speed,180);s.flow=1;s.vx=0;s.vy=0;
}
export function strumGuitar(s,strength=1){
 if(s.ended||s.train||!s.guitar||guitarRemaining(s)<=0||strength!==1)return false;
 s.guitarDuration=Math.round((s.guitarDuration+GUITAR_TAP_SECONDS)*100)/100;
 s.guitarStrums++;s.lastGuitarStrum=s.guitarTime;return true;
}
export function stepTrain(s,dt){
 const e=s.train;if(!e||s.ended)return;
 e.time+=dt;
 if(e.phase==='warning'&&e.time>=TRAIN_WARNING){e.time-=TRAIN_WARNING;e.phase='mash';}
 if(e.phase==='mash'&&e.time>=TRAIN_MASH){
  if(e.hits<TRAIN_MIN_HITS){s.health=0;s.ended='collision';s.combo=0;return 'failed';}
  e.time-=TRAIN_MASH;e.phase='impact';s.trainHitsTotal+=e.hits;s.destroyed+=3;startGuitar(s,e.hits);return 'smash';
 }
 if(e.phase==='impact'&&e.time>=TRAIN_IMPACT){s.train=null;return 'released';}
}
export function trainZ(e){
 if(e.phase==='warning')return -210+e.time/TRAIN_WARNING*60;
 if(e.phase==='impact')return -10;
 const u=Math.min(1,e.time/(TRAIN_MASH*.72));return -10-140*(1-u)**2;
}
