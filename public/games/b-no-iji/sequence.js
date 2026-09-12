export const LAUNCH_PREP=.65, LAUNCH_RUN=1.2;
export const STAIRS={duration:2.3,fallStart:.1,fallDuration:.75,riseStart:.9,riseDuration:.65,phoneStart:1.6,phoneDuration:.3};
export function stairsMotion(t){const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};return{fall:smooth((t-STAIRS.fallStart)/STAIRS.fallDuration),rise:smooth((t-STAIRS.riseStart)/STAIRS.riseDuration),returning:smooth((t-STAIRS.phoneStart)/STAIRS.phoneDuration)};}
export function launchMotion(t){const u=Math.max(0,Math.min(1,(t-LAUNCH_PREP)/LAUNCH_RUN));return{u,z:-72*u*u,speed:120*u};}
export const SEQUENCES={
 goal:{duration:5.2,cues:[[.65,'finish'],[1.2,'fanfare'],[1.3,'applause'],[2.2,'firework'],[3.1,'firework'],[4,'applause']]},
 launch:{duration:LAUNCH_PREP+LAUNCH_RUN,cues:[[.04,'lock'],[.33,'unlock'],[LAUNCH_PREP,'launch']]},
 guitar:{duration:8,cues:Array.from({length:69},(_,i)=>[i*60/172/4,'strum'])},
 stairs:{duration:STAIRS.duration,cues:[[0,'crash'],[STAIRS.fallStart,'trip'],[.28,'thud'],[.46,'thud'],[.66,'thud'],[.83,'rattle'],[STAIRS.riseStart,'rise'],[STAIRS.phoneStart,'return'],[STAIRS.phoneStart+STAIRS.phoneDuration,'catch']]}
};
// Timeline owns no game state. Pausing, previewing and skipping cannot advance a flight.
export class Sequence {
 constructor(kind){if(!SEQUENCES[kind])throw new Error('Unknown sequence');this.kind=kind;this.time=0;this.done=false;this.cueIndex=0;}
 advance(dt,paused=false){if(paused||this.done)return[];this.time=Math.min(SEQUENCES[this.kind].duration,this.time+Math.max(0,dt));const cues=[];const def=SEQUENCES[this.kind];while(this.cueIndex<def.cues.length&&def.cues[this.cueIndex][0]<=this.time)cues.push(def.cues[this.cueIndex++][1]);this.done=this.time>=def.duration;return cues;}
 skip(){this.time=SEQUENCES[this.kind].duration;this.cueIndex=SEQUENCES[this.kind].cues.length;this.done=true;}
}
