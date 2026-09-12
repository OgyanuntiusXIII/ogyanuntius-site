export const STRUM_BPM=172, STRUM_INTERVAL=60/STRUM_BPM/4;
const CHORDS=[[82.41,123.47,164.81,196,246.94,329.63],[98,123.47,146.83,196,293.66,392],[110,164.81,220,261.63,329.63,440],[146.83,220,293.66,369.99,440,587.33]];
const ACCENTS=[1,.55,.78,.62,.92,.53,.8,.67];
// Six strings swept in opposite directions, with a short palm mute and pick scrape.
export function strumSamples(rate,chord=0,up=false,random=Math.random){
 const data=new Float32Array(Math.ceil(rate*.34)),notes=up?[...CHORDS[chord]].reverse():CHORDS[chord];
 for(let k=0;k<notes.length;k++){
  const delay=Math.floor(k*(up?.0028:.0042)*rate),period=Math.round(rate/notes[k]),line=new Float32Array(period);
  for(let j=0;j<period;j++)line[j]=random()*2-1;
  for(let i=0;i<data.length-delay;i++){
   const p=i%period,raw=line[p];line[p]=.498*(line[p]+line[(p+1)%period]);
   const t=i/rate,envelope=Math.min(1,t/.0015)*Math.exp(-t/(up?.060:.115));
   data[i+delay]+=raw*envelope*(up?.30:.38);
  }
 }
 let low=0;
 for(let i=0;i<data.length;i++){
  const t=i/rate,noise=(random()*2-1)*Math.exp(-t/.011)*.23;
  low+=.018*(data[i]-low);data[i]=Math.tanh((data[i]-low+noise)*1.5)*.8;
 }
 return data;
}
export class StrumAudio{
 constructor(context,output,sources){this.context=context;this.output=output;this.sources=sources;this.buffers=CHORDS.map((_,c)=>[false,true].map(up=>{const samples=strumSamples(context.sampleRate,c,up),b=context.createBuffer(1,samples.length,context.sampleRate);b.copyToChannel(samples,0);return b;}));}
 play(time,hitIndex){
  const c=this.context,beat=Math.floor((time+1e-6)/STRUM_INTERVAL),stroke=hitIndex??beat,source=c.createBufferSource(),gain=c.createGain();
  if(hitIndex!==undefined)this.tapCount=(this.tapCount??0)+1;
  source.buffer=this.buffers[Math.floor(beat/16)%4][stroke%2];gain.gain.value=ACCENTS[stroke%8]*(hitIndex===undefined?1.7:2.1);
  source.connect(gain).connect(this.output);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};source.start();
 }
}
