import {GOAL,KM_PER_UNIT} from './journey.js';
// Small fliers cross the course from the far end: penguins after a third of the route, squirrels after two thirds.
// This module owns no rendering, so the leaderboard can import the same limits.
export const FLIER_START=1/3, SQUIRREL_START=2/3;
export const FLIER_SPAWN_DISTANCE=430;   // units ahead of the player where a flier appears
export const FLIER_FIRST_DELAY=260;      // units after the milestone until the first one
export const FLIER_SPEED={penguin:60,squirrel:95};   // own speed toward the player, units per game second
export const FLIER_SIZE={penguin:{w:1.7,h:1.9},squirrel:{w:2.2,h:2.4}};   // hit box; smaller than the player, readable from afar
export const flierInterval=km=>km>=GOAL*SQUIRREL_START?400:640;
export const flierKind=(index,km)=>km>=GOAL*SQUIRREL_START?(index%2?'penguin':'squirrel'):'penguin';
// Position relative to the player: 0 is the player, negative is ahead.
export const flierZ=(f,s)=>f.z0+FLIER_SPEED[f.kind]*(s.time-f.t0)+s.travel;
export const flierMilestone=km=>km>=GOAL*SQUIRREL_START?2:km>=GOAL*FLIER_START?1:0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const noise=(n,k)=>{const v=Math.sin(n*12.9898+k*78.233)*43758.5453;return v-Math.floor(v);};
// Returns the flier spawned this step, if any. Each one is aimed near the player's position at spawn time.
export function stepFliers(s,bounds){
 for(const f of s.fliers)if(!f.done&&flierZ(f,s)>14)f.done=true;
 if(s.fliers.length>6)s.fliers=s.fliers.filter(f=>!f.done);
 if(s.km<GOAL*FLIER_START||s.train)return null;
 if(s.nextFlier===null)s.nextFlier=s.travel+FLIER_FIRST_DELAY;
 if(s.travel<s.nextFlier)return null;
 const n=s.flierSerial++,kind=flierKind(n,s.km);
 const f={kind,serial:n,x:clamp(s.x+(noise(n,1)-.5)*3.2,-(bounds.side-2.2),bounds.side-2.2),y:clamp(s.y+(noise(n,2)-.5)*2.6,bounds.ground+1.5,bounds.ceiling-1.7),z0:-s.travel-FLIER_SPAWN_DISTANCE,t0:s.time,done:false};
 s.fliers.push(f);s.nextFlier=s.travel+flierInterval(s.km);return f;
}
export function flierHit(s,f){const size=FLIER_SIZE[f.kind];return Math.abs(s.x-f.x)<size.w/2+.4&&Math.abs(s.y-f.y)<size.h/2+.4;}
// Upper bound for the leaderboard: fliers that can have reached the player within the travelled distance.
export function flierCount(units){const start=GOAL*FLIER_START/KM_PER_UNIT;if(units<start)return 0;let t=start+FLIER_FIRST_DELAY,n=0;while(t<=units&&n<10000){n++;t+=flierInterval(t*KM_PER_UNIT);}return n;}
