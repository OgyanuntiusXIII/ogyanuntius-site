const lengths={flap:.09,ring:.32,near:.24,hit:.24,smash:.62,horn:.8,launch:1,trip:.30,thud:.26,rattle:.56,rise:.7,return:.52,catch:.16,applause:1.65,finish:.65,perfect:.35,chain:.6,shatter:.65,stamp:.28,region:1,record:1.2,fanfare:1.8,firework:1};
export function effectSamples(kind,rate=44100,random=Math.random){
 const duration=lengths[kind]??.3,a=new Float32Array(Math.ceil(duration*rate));
 if(['perfect','chain','region','record','fanfare'].includes(kind)){
  const notes=kind==='perfect'?[1046,1568,2093]:kind==='chain'?[659,784,1046,1318]:kind==='region'?[392,523,659,784]:kind==='record'?[523,659,784,1046,1318]:[523,523,784,1046,988,1046,1318,1568];
  const spacing=duration/(notes.length+1.4);for(let j=0;j<notes.length;j++){const freq=notes[j],start=Math.floor(j*spacing*rate);for(let i=start;i<a.length;i++){const t=(i-start)/rate,env=Math.min(1,t/.007)*Math.exp(-t/(kind==='fanfare'?.2:.12));a[i]+=env*(Math.sin(t*2*Math.PI*freq)+.23*Math.sin(t*4*Math.PI*freq))*.25;}}
 }else if(kind==='applause'){
  for(let clap=0;clap<45;clap++){
   const at=(clap/45*1.38+random()*.065)*rate,gain=.32+random()*.32;
   let low=0;for(let j=0;j<rate*.16;j++){const n=random()*2-1;low+=.22*(n-low);const index=Math.floor(at+j);if(index<a.length)a[index]+=(n-low)*Math.exp(-j/rate/ .032)*gain;}
  }
 }else{
  let low=0;for(let i=0;i<a.length;i++){
   const t=i/rate,u=t/duration,n=random()*2-1;low+=.10*(n-low);const attack=Math.min(1,t/.003),env=attack*Math.exp(-u*5);
   if(kind==='ring'||kind==='finish')a[i]=env*(Math.sin(t*2*Math.PI*1046)+.6*Math.sin(t*2*Math.PI*1568)+.32*Math.sin(t*2*Math.PI*2093))*.45;
   else if(kind==='horn')a[i]=Math.sin(Math.PI*u)**.6*(Math.sin(t*2*Math.PI*233)+.7*Math.sin(t*2*Math.PI*311)+.15*n)*.4;
   else if(kind==='launch'||kind==='near'||kind==='return'||kind==='rise')a[i]=Math.sin(Math.PI*u)*(low*.8+(n-low)*u*.25+Math.sin(2*Math.PI*(180*t+420*t*t))*.18);
   else if(kind==='trip')a[i]=env*(Math.sin(2*Math.PI*(550*t-700*t*t))*.55+n*.2);
   else if(kind==='rattle'){const pulse=Math.exp(-((t*13)%1)*9);a[i]=env*pulse*(n*.6+Math.sin(t*2*Math.PI*1420)*.25);}
   else if(kind==='stamp')a[i]=env*(Math.sin(t*2*Math.PI*160)*.7+n*.18)+Math.max(0,t-.07)*Math.exp(-Math.max(0,t-.07)*42)*Math.sin(t*2*Math.PI*1760)*12;
   else if(kind==='firework')a[i]=env*(Math.sin(t*2*Math.PI*55)*.5+n*.6)+n*Math.exp(-u*4)*.2;
   else if(kind==='shatter')a[i]=env*(n*.65+Math.sin(t*2*Math.PI*1245)*.25)+Math.sin(t*2*Math.PI*1864)*Math.exp(-u*9)*.18;
   else if(kind==='catch')a[i]=env*(n*.35+Math.sin(t*2*Math.PI*880)*.45);
   else if(kind==='flap')a[i]=Math.sin(Math.PI*u)*low*.55+Math.sin(t*2*Math.PI*2400)*Math.exp(-t/.010)*.45;   // the bright tick is what phone speakers can reproduce
   else {const heavy=kind==='smash',pitch=heavy?63:kind==='thud'?90:150;a[i]=env*(Math.sin(2*Math.PI*(pitch*t-30*t*t))*.65+n*(heavy?.7:.3)+Math.sin(t*2*Math.PI*837)*Math.exp(-t*36)*.13);}
  }
 }
 let peak=0;for(const x of a)peak=Math.max(peak,Math.abs(x));const scale=.9/Math.max(1,peak);for(let i=0;i<a.length;i++)a[i]*=scale;return a;
}
export class Effects{
 constructor(context,output,sources){this.c=context;this.output=output;this.sources=sources;this.counts={};this.buffers=new Map();for(const kind of Object.keys(lengths)){const a=effectSamples(kind,context.sampleRate),b=context.createBuffer(1,a.length,context.sampleRate);b.copyToChannel(a,0);this.buffers.set(kind,b);}}
 play(kind,{volume=1,pitch=1,pan=0}={}){
  if(this.sources.size>72)return;this.counts[kind]=(this.counts[kind]||0)+1;const c=this.c,source=c.createBufferSource(),gain=c.createGain(),stereo=c.createStereoPanner();source.buffer=this.buffers.get(kind);if(!source.buffer)return;source.playbackRate.value=pitch;gain.gain.value=volume;stereo.pan.value=pan;source.connect(gain).connect(stereo).connect(this.output);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();stereo.disconnect();};source.start();
 }
}
