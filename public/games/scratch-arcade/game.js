'use strict';
/* ==========================================================================
   SCRATCH ARCADE
   ジョグをまわす音ゲー。企画書 §15 の MVP 範囲。
   触るのはこの T ブロックだけで足りるようにしてある。
   ========================================================================== */

const T = {
  /* --- 判定（GAME MODE・秒） --- */
  WIN_PERFECT : 0.070,
  WIN_GOOD    : 0.155,
  CHIRP_CUT   : 0.30,    // 押してから、フェーダーを切るまでの猶予

  /* --- ジョグ --- */
  STROKE_TICKS: 9,       // これだけ回したら「1ストローク」と認める
  STROKE_END  : 0.085,
  JOG_SAMPLES : 1500,    // ジョグ1目盛りで音源が進むサンプル数（＝重さ）

  /* --- クロスフェーダー（0=左端 1=右端） --- */
  FADER_OPEN  : 0.42,
  FADER_CLOSE : 0.58,

  /* --- キーボードの疑似スクラッチ --- */
  KEY_DUR     : 0.17,
  KEY_DIST    : 0.30,

  /* --- 曲 --- */
  BPM         : 150,     // フューチャーベース。ハーフタイムで感じる
  SCROLL      : 1.55,    // ノーツが右端から判定線へ来るまでの秒数

  /* --- TRAINING --- */
  TR_BPM_START: 100,
  TR_BPM_STEP : 8,
  TR_UP_EVERY : 8,
  TR_LIVES    : 3,

  /* --- 音量 --- */
  VOL_MUSIC   : 0.40,
  VOL_SCRATCH : 1.00,
};

/* ---- 配色 ---- */
const C = {
  ink:'#1B0730', plum:'#2A0B45', deep:'#12041F', paper:'#FFF4FA',
  pink:'#FF3D8B', pink2:'#FF8FC4', cyan:'#35E8FF',
  lemon:'#FFE45E', lilac:'#B48CFF', mint:'#7CF5C4',
};
const F_DISP = 'Anton,Impact,"Arial Black",sans-serif';
const F_JP   = '"Zen Maru Gothic","Yu Gothic UI",sans-serif';

/* ---- 技。dir: 1=前 -1=後 0=どちらでも / cut: フェーダーを切るか ---- */
const TECH = {
  BABY    : {name:'BABY',     short:'BABY',  jp:'前と後ろを、交互に',       col:C.cyan,  dir: 0, cut:false, alt:true },
  FORWARD : {name:'FORWARD',  short:'FWD',   jp:'ジョグを前へ押し出す',     col:C.pink,  dir: 1, cut:false, alt:false},
  BACKWARD: {name:'BACKWARD', short:'BACK',  jp:'ジョグを手前へ引く',       col:C.lemon, dir:-1, cut:false, alt:false},
  CHIRP   : {name:'CHIRP',    short:'CHIRP', jp:'前へ押して、途中で切る',   col:C.mint,  dir: 1, cut:true,  alt:false},
};
const CH2TECH = {B:'BABY', F:'FORWARD', K:'BACKWARD', C:'CHIRP'};

/* ---- 曲『まだ、まわしてる』 1小節=16スロット。大文字=左デッキ 小文字=右デッキ ---- */
const ARR = [
  {n:4, kind:'intro', p:'................', label:'INTRO',      sub:'ジョグに手を置く'},
  {n:4, kind:'build', p:'B.......B.......', label:'BUILD',      sub:'まずは前でも後ろでもいい'},
  {n:4, kind:'drop',  p:'B...B...B...B...', label:'BABY',       sub:'前と後ろを、交互に'},
  {n:4, kind:'drop',  p:'B...B...B.B.B...', label:'BABY',       sub:'交互のまま、リズムに乗る'},
  {n:4, kind:'drop',  p:'F...K...F...K...', label:'FWD / BACK', sub:'ここから方向が決まる'},
  {n:4, kind:'drop',  p:'F...K...F.K.F...', label:'FWD / BACK', sub:'切り替えが速くなる'},
  {n:4, kind:'break', p:'C.......C.......', label:'BREAK',      sub:'押して、フェーダーで切る'},
  {n:4, kind:'drop2', p:'C...C...C...C...', label:'CHIRP',      sub:'押して、切る'},
  {n:4, kind:'drop2', p:'C...C...C.C.C...', label:'CHIRP',      sub:'切るのが遅いと GOOD 止まり'},
  {n:4, kind:'drop2', p:'B...C...F...C...', label:'COMBO',      sub:'技が混ざる'},
  {n:4, kind:'drop2', p:'B.C.F...C...K...', label:'COMBO',      sub:'技が混ざる'},
  {n:4, kind:'drop2', p:'B...b...C...c...', label:'DECK 2',     sub:'小さいノーツは右デッキ'},
  {n:8, kind:'final', p:'C.B.F...C...K.B.', label:'FINAL',      sub:'ぜんぶ'},
  {n:2, kind:'out',   p:'................', label:'',           sub:''},
];

/* ---- コード（王道進行 IV-V-iii-vi）。フューチャーベースの土台 ---- */
const CHORDS = [
  {root: 87.31, n:[349.23, 440.00, 523.25, 783.99]},   // F add9
  {root: 98.00, n:[392.00, 493.88, 587.33, 880.00]},   // G add9
  {root:110.00, n:[440.00, 523.25, 659.26, 783.99]},   // Am7
  {root: 82.41, n:[329.63, 392.00, 493.88, 587.33]},   // Em7
];
const KICK_D = [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0];
const CLAP_D = [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0];
const HAT_D  = [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1];
const STAB_D = [[0,3],[3,3],[6,2],[8,3],[11,3],[14,2]];
const CHOP_A = [[0,2],[3,3],[6,1],[8,2],[11,3],[14,0]];
const CHOP_B = [[0,3],[2,2],[5,3],[8,1],[10,2],[12,3],[14,2]];

/* ==========================================================================
   AUDIO
   ========================================================================== */

const WORKLET_SRC = `
class ScratchProc extends AudioWorkletProcessor {
  constructor(){
    super();
    this.buf=null; this.len=0; this.pos=0; this.pend=0; this.idle=0; this.pulse=null;
    this.g=0; this.tick=0;
    this.k  = 1 - Math.exp(-1/(0.007*sampleRate));
    this.gk = 1 - Math.exp(-1/(0.0015*sampleRate));
    this.port.onmessage = (e)=>{
      const d = e.data;
      if(d.t==='buf'){ this.buf=d.b; this.len=d.b.length; this.pos=0; this.pend=0; this.pulse=null; }
      else if(d.t==='jog'){ this.pend += d.d; }
      else if(d.t==='pulse'){
        this.pend=0;
        this.pulse={n:0, N:Math.max(64,Math.round(d.dur*sampleRate)), dist:d.dist, dir:d.dir};
        if(d.dir>0) this.pos = 0;
        else this.pos = Math.min(this.len-2, d.dist);
      }
      else if(d.t==='reset'){ this.pos=0; this.pend=0; this.pulse=null; }
    };
  }
  process(inputs, outputs){
    const o0 = outputs[0];
    if(!o0 || !o0[0]) return true;
    const out = o0[0], n = out.length;
    if(!this.buf){ out.fill(0); return true; }
    let v = 0;
    for(let i=0;i<n;i++){
      if(this.pulse){
        const p = this.pulse;
        v = p.dir * (p.dist*Math.PI/(2*p.N)) * Math.sin(Math.PI*p.n/p.N);
        p.n++; if(p.n>=p.N) this.pulse=null;
      } else {
        v = this.pend*this.k;
        this.pend -= v;
        if(Math.abs(this.pend)<1e-4) this.pend=0;
      }
      this.pos += v;
      let clamp = false;
      if(this.pos < 0){ this.pos=0; clamp=true; }
      else if(this.pos > this.len-2){ this.pos=this.len-2; clamp=true; }
      const a = Math.abs(v);
      const tg = (a>2e-4 && !clamp) ? Math.min(1, a*3.2) : 0;
      this.g += (tg-this.g)*this.gk;
      let s = 0;
      if(this.g > 1e-4){
        const i0 = this.pos|0, fr = this.pos-i0;
        s = (this.buf[i0]*(1-fr) + this.buf[i0+1]*fr) * this.g;
      }
      if(a>2e-4){ this.idle=0; }
      else { this.idle++; if(this.idle > sampleRate*0.16){ this.pos=0; this.idle=0; } }
      out[i] = s;
    }
    this.tick++;
    if((this.tick & 3)===0){
      this.port.postMessage({p: this.len? this.pos/this.len : 0, v: v});
    }
    return true;
  }
}
registerProcessor('scratch', ScratchProc);
`;

const VOICES = {
  AH  : {label:'AH',   dur:0.95, f0:112, atk:0.020, rel:0.14, breath:0.10,
         f:[[720,760,7,1.0],[1090,1080,9,0.60],[2450,2450,11,0.30],[3300,3300,12,0.14]]},
  YEAH: {label:'YEAH', dur:1.05, f0:104, atk:0.030, rel:0.16, breath:0.14,
         f:[[330,760,8,1.0],[2200,1120,9,0.70],[2900,2500,11,0.30],[3500,3400,12,0.13]]},
  HEY : {label:'HEY',  dur:0.85, f0:120, atk:0.015, rel:0.12, breath:0.20,
         f:[[520,540,8,1.0],[1820,1780,9,0.62],[2500,2520,11,0.28],[3400,3400,12,0.12]]},
};

const A = {
  ctx:null, master:null, musicG:null, pump:null, chordBus:null, nz:null, clip:null,
  deck:{L:null, R:null},
  buf:null, chopBuf:null, voice:'AH', ready:false, offset:0,
};

function noiseBuffer(oc, n){
  const b = oc.createBuffer(1, n, oc.sampleRate), d = b.getChannelData(0);
  for(let i=0;i<n;i++) d[i] = Math.random()*2-1;
  return b;
}

async function renderVoice(spec){
  const sr = 44100, n = Math.ceil(sr*spec.dur), t = spec.dur;
  const oc = new OfflineAudioContext(1, n, sr);
  const glot = oc.createGain(); glot.gain.value = 0.5;
  [0,-9,9].forEach(det=>{
    const o = oc.createOscillator(); o.type='sawtooth'; o.detune.value=det;
    o.frequency.setValueAtTime(spec.f0*1.05, 0);
    o.frequency.exponentialRampToValueAtTime(spec.f0*0.86, t);
    o.connect(glot); o.start(0); o.stop(t);
  });
  const nz = oc.createBufferSource(); nz.buffer = noiseBuffer(oc, n);
  const ng = oc.createGain();
  ng.gain.setValueAtTime(spec.breath, 0);
  ng.gain.exponentialRampToValueAtTime(0.006, t);
  nz.connect(ng); nz.start(0);

  const sum = oc.createGain(); sum.gain.value = 1;
  spec.f.forEach(f=>{
    const bp = oc.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=f[2];
    bp.frequency.setValueAtTime(f[0], 0);
    bp.frequency.linearRampToValueAtTime(f[1], t);
    const g = oc.createGain(); g.gain.value = f[3];
    glot.connect(bp); ng.connect(bp); bp.connect(g); g.connect(sum);
  });
  const env = oc.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(1, spec.atk);
  env.gain.setValueAtTime(1, Math.max(spec.atk+0.02, t-spec.rel));
  env.gain.linearRampToValueAtTime(0.0001, t);
  sum.connect(env); env.connect(oc.destination);

  const rb = await oc.startRendering();
  const d = rb.getChannelData(0);
  let mx = 0;
  for(let i=0;i<d.length;i++){ const a = Math.abs(d[i]); if(a>mx) mx=a; }
  if(mx>0){ const s = 0.92/mx; for(let i=0;i<d.length;i++) d[i]*=s; }
  return d;
}

function softClipCurve(){
  const n = 1024, c = new Float32Array(n), k = Math.tanh(2);
  for(let i=0;i<n;i++){ const x = i/(n-1)*2-1; c[i] = Math.tanh(x*2)/k; }
  return c;
}

async function initAudio(){
  if(A.ctx){ if(A.ctx.state==='suspended') await A.ctx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  A.ctx = new Ctx({latencyHint:'interactive'});

  A.master = A.ctx.createGain(); A.master.gain.value = 0.9;
  A.master.connect(A.ctx.destination);
  A.musicG = A.ctx.createGain(); A.musicG.gain.value = T.VOL_MUSIC;
  A.musicG.connect(A.master);

  /* サイドチェイン母線。コード・ベース・チョップはここを通ってキックで潰れる */
  A.pump = A.ctx.createGain(); A.pump.gain.value = 1;
  A.pump.connect(A.musicG);
  const hp = A.ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=170;
  const lp = A.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=3900; lp.Q.value=0.6;
  hp.connect(lp); lp.connect(A.pump);
  A.chordBus = hp;

  A.clip = A.ctx.createWaveShaper(); A.clip.curve = softClipCurve();
  A.clip.connect(A.musicG);
  A.nz = noiseBuffer(A.ctx, Math.floor(A.ctx.sampleRate*2));

  const url = URL.createObjectURL(new Blob([WORKLET_SRC], {type:'application/javascript'}));
  await A.ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  ['L','R'].forEach(side=>{
    const node = new AudioWorkletNode(A.ctx, 'scratch', {numberOfInputs:0, outputChannelCount:[1]});
    const shp = A.ctx.createBiquadFilter(); shp.type='highpass'; shp.frequency.value=28;
    const fader = A.ctx.createGain(); fader.gain.value = 1;
    const out = A.ctx.createGain(); out.gain.value = T.VOL_SCRATCH;
    node.connect(shp); shp.connect(fader); fader.connect(out); out.connect(A.master);
    const d = {node, fader, pos:0, vel:0, hist:new Float32Array(256), hi:0};
    node.port.onmessage = (e)=>{ d.pos=e.data.p; d.vel=e.data.v; d.hist[d.hi=(d.hi+1)&255]=e.data.p; };
    A.deck[side] = d;
  });

  await setVoice(A.voice);
  A.ready = true;
  syncClock();
}

async function setVoice(name){
  A.voice = name;
  const data = await renderVoice(VOICES[name]);
  A.buf = data;
  const b = A.ctx.createBuffer(1, data.length, 44100);
  b.copyToChannel(data, 0);
  A.chopBuf = b;
  ['L','R'].forEach(s=>{ if(A.deck[s]) A.deck[s].node.port.postMessage({t:'buf', b:data.slice(0)}); });
}

function syncClock(){ A.offset = A.ctx.currentTime - performance.now()/1000; }
function atime(ts){ return (ts==null ? A.ctx.currentTime : ts/1000 + A.offset); }

/* ==========================================================================
   SND — フューチャーベース一式。音源ファイルは1つも使わない
   ========================================================================== */

const Snd = {
  _n(t, dur, dest){
    const s = A.ctx.createBufferSource();
    s.buffer = A.nz;
    s.loop = true;
    s.start(t); s.stop(t+dur+0.02);
    return s;
  },
  pump(t){
    const g = A.pump.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.13, t);
    g.setTargetAtTime(1.0, t+0.004, 0.078);
  },
  kick(t, v){
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(192, t);
    o.frequency.exponentialRampToValueAtTime(47, t+0.055);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t+0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.33);
    o.connect(g); g.connect(A.clip); o.start(t); o.stop(t+0.35);
    const n = this._n(t, 0.02), hp = A.ctx.createBiquadFilter(), ng = A.ctx.createGain();
    hp.type='highpass'; hp.frequency.value=2200;
    ng.gain.setValueAtTime(v*0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t+0.02);
    n.connect(hp); hp.connect(ng); ng.connect(A.musicG);
    this.pump(t);
    G.kicks.push(t); if(G.kicks.length>48) G.kicks.shift();
  },
  clap(t, v){
    [0, 0.010, 0.020, 0.032].forEach((off,i)=>{
      const n = this._n(t+off, 0.04);
      const bp = A.ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1550; bp.Q.value=1.1;
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(v*(i===3?1:0.45), t+off);
      g.gain.exponentialRampToValueAtTime(0.0001, t+off+0.035);
      n.connect(bp); bp.connect(g); g.connect(A.musicG);
    });
    const n = this._n(t+0.032, 0.2);
    const bp = A.ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1150; bp.Q.value=0.8;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(v*0.42, t+0.032);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.22);
    n.connect(bp); bp.connect(g); g.connect(A.musicG);
  },
  hat(t, v, open){
    const d = open ? 0.14 : 0.028;
    const n = this._n(t, d);
    const hp = A.ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=8600;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+d);
    n.connect(hp); hp.connect(g); g.connect(A.musicG);
  },
  crash(t, v){
    const n = this._n(t, 1.4);
    const hp = A.ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=4200;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+1.4);
    n.connect(hp); hp.connect(g); g.connect(A.musicG);
  },
  /* スーパーソウのコードスタブ */
  chord(t, notes, dur, v){
    notes.forEach((f,i)=>{
      [-1,1].forEach(d=>{
        const o = A.ctx.createOscillator(); o.type='sawtooth';
        o.frequency.value = f; o.detune.value = d*10 + (i%2?4:-4);
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v*(i===3?0.42:0.62)/2, t+0.009);
        g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
        o.connect(g); g.connect(A.chordBus); o.start(t); o.stop(t+dur+0.03);
      });
    });
  },
  pad(t, notes, dur, v){
    notes.forEach((f,i)=>{
      const o = A.ctx.createOscillator(); o.type='sawtooth';
      o.frequency.value = f; o.detune.value = (i%2?7:-7);
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v*0.4, t+dur*0.25);
      g.gain.linearRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(A.chordBus); o.start(t); o.stop(t+dur+0.03);
    });
  },
  sub(t, f, dur, v){
    const o = A.ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(f, t);
    const o2 = A.ctx.createOscillator(); o2.type='triangle'; o2.frequency.setValueAtTime(f, t);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t+0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    const g2 = A.ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(A.pump);
    o.start(t); o.stop(t+dur+0.02); o2.start(t); o2.stop(t+dur+0.02);
  },
  /* ピッチを上げたボーカルチョップ。スクラッチ音源と同じ声を使う */
  chop(t, f, dur, v){
    if(!A.chopBuf) return;
    const rate = Math.max(0.4, f/(VOICES[A.voice].f0*2));
    const s = A.ctx.createBufferSource();
    s.buffer = A.chopBuf; s.playbackRate.value = rate;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t+0.005);
    g.gain.setValueAtTime(v, t+dur*0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    const lp = A.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=5200;
    s.connect(lp); lp.connect(g); g.connect(A.pump);
    const off = Math.min(0.2, A.chopBuf.duration*0.15);
    s.start(t, off, Math.min(A.chopBuf.duration-off, dur*rate + 0.05));
    s.stop(t+dur+0.05);
  },
  riser(t, dur, v){
    const n = this._n(t, dur);
    const bp = A.ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=2.2;
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(9000, t+dur);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t+dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur+0.12);
    n.connect(bp); bp.connect(g); g.connect(A.musicG);
  },
  impact(t, v){
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(28, t+0.5);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.6);
    o.connect(g); g.connect(A.clip); o.start(t); o.stop(t+0.62);
    this.crash(t, v*0.5);
  },
  roll(t, barDur, v){
    /* だんだん細かくなるスネアロール。ドロップ直前用 */
    let p = 0, step = barDur/8;
    while(p < barDur - 0.001){
      this.clap(t+p, v*(0.4 + 0.6*(p/barDur)));
      p += step;
      if(p > barDur*0.5) step = barDur/16;
      if(p > barDur*0.8) step = barDur/24;
    }
  },
};

/* ==========================================================================
   INPUT
   ========================================================================== */

const Input = {
  faderX:0.5, gate:{L:1,R:1}, open:{L:true,R:true}, cutAt:{L:-9,R:-9},
  st:{L:null,R:null}, kbDeck:'L', kbCut:false, onStroke:null,

  faderGain(side, x){
    const o = T.FADER_OPEN, c = T.FADER_CLOSE;
    const p = (side==='L') ? x : 1-x;
    if(p <= o) return 1;
    if(p >= c) return 0;
    return (c-p)/(c-o);
  },
  setFader(x, t){
    x = Math.max(0, Math.min(1, x));
    this.faderX = x;
    ['L','R'].forEach(side=>{
      const g = this.faderGain(side, x);
      this.gate[side] = g;
      const wasOpen = this.open[side], nowOpen = g > 0.5;
      if(wasOpen && !nowOpen) this.cutAt[side] = t;
      this.open[side] = nowOpen;
      if(A.deck[side]){
        const st = Math.max(A.ctx.currentTime, t);
        const p = A.deck[side].fader.gain;
        p.cancelScheduledValues(st);
        p.setValueAtTime(p.value, st);
        p.linearRampToValueAtTime(g, st+0.004);
      }
    });
  },
  jog(side, ticks, t){
    if(!ticks) return;
    if(A.deck[side]) A.deck[side].node.port.postMessage({t:'jog', d:ticks*T.JOG_SAMPLES});
    const dir = ticks>0 ? 1 : -1;
    let s = this.st[side];
    if(!s || s.dir!==dir || t - s.last > T.STROKE_END){
      s = this.st[side] = {dir, acc:0, start:t, last:t, fired:false, open:this.open[side]};
    }
    s.acc += Math.abs(ticks);
    s.last = t;
    if(!s.fired && s.acc >= T.STROKE_TICKS){
      s.fired = true;
      if(this.onStroke) this.onStroke({deck:side, dir, t:s.start, open:s.open});
    }
  },
  keyStroke(side, dir, t){
    this.kbDeck = side;
    this.applyKbFader(t);
    if(A.deck[side] && A.buf){
      A.deck[side].node.port.postMessage({t:'pulse', dir, dur:T.KEY_DUR, dist:A.buf.length*T.KEY_DIST});
    }
    if(this.onStroke) this.onStroke({deck:side, dir, t, open:this.open[side]});
  },
  applyKbFader(t){
    let x;
    if(this.kbDeck==='L') x = this.kbCut ? 0.88 : 0.28;
    else                  x = this.kbCut ? 0.12 : 0.72;
    this.setFader(x, t);
  },
};

/* ==========================================================================
   MIDI
   ========================================================================== */

const DEFAULT_MAP = {
  jogL:{ch:0, cc:0x22, mode:'c64'},
  jogR:{ch:1, cc:0x22, mode:'c64'},
  fader:{ch:6, cc:0x1f, inv:false},
};

const MIDI = {
  access:null, map:null, learn:null, devName:'—', ok:false,

  load(){
    try{
      const s = localStorage.getItem('scratch-arcade.map');
      this.map = s ? JSON.parse(s) : JSON.parse(JSON.stringify(DEFAULT_MAP));
    }catch(e){ this.map = JSON.parse(JSON.stringify(DEFAULT_MAP)); }
    if(!this.map || !this.map.jogL) this.map = JSON.parse(JSON.stringify(DEFAULT_MAP));
  },
  save(){ try{ localStorage.setItem('scratch-arcade.map', JSON.stringify(this.map)); }catch(e){} },

  async start(){
    this.load();
    if(!navigator.requestMIDIAccess){ UI.conn('', 'キーボードで遊べる'); return; }
    try{ this.access = await navigator.requestMIDIAccess({sysex:false}); }
    catch(e){ UI.conn('', 'MIDI は使えない ／ キーボードで遊べる'); return; }
    this.access.onstatechange = ()=>this.bind();
    this.bind();
  },
  bind(){
    if(!this.access) return;
    const names = [];
    this.access.inputs.forEach(i=>{ names.push(i.name); i.onmidimessage = (e)=>this.onMsg(e); });
    this.ok = names.length>0;
    this.devName = names.join(' / ') || '—';
    UI.conn(this.ok?'ok':'', this.ok ? (this.devName+' つながった') : 'キーボードで遊べる');
    UI.setupRefresh();
  },
  decode(v, mode){ return mode==='s7' ? (v<64 ? v : v-128) : v-64; },

  onMsg(e){
    const d = e.data;
    if(!d || d.length<3 || !A.ctx) return;
    const status = d[0] & 0xf0, ch = d[0] & 0x0f, a = d[1], b = d[2];
    const t = atime(e.timeStamp);
    if(status===0xb0){
      UI.mon(ch, a, b);
      if(this.learn){ this.learnFeed(ch+':'+a, b); return; }
      const m = this.map;
      if(m.jogL && ch===m.jogL.ch && a===m.jogL.cc){ Input.jog('L', this.decode(b,m.jogL.mode), t); UI.meter('mJogL',b); return; }
      if(m.jogR && ch===m.jogR.ch && a===m.jogR.cc){ Input.jog('R', this.decode(b,m.jogR.mode), t); UI.meter('mJogR',b); return; }
      if(m.fader && ch===m.fader.ch && a===m.fader.cc){
        Input.setFader(m.fader.inv ? 1-b/127 : b/127, t); UI.meter('mFader',b); return;
      }
    } else if(status===0x90 || status===0x80){ UI.mon(ch, a, b, true); }
  },

  startLearn(what){
    this.learn = {what, hits:new Map()};
    UI.learnMsg(what==='fader' ? 'クロスフェーダーを左右いっぱいに振って' : 'ジョグを2〜3秒まわして');
    setTimeout(()=>this.finishLearn(), 2600);
  },
  learnFeed(key, v){
    const h = this.learn.hits.get(key) || {n:0, min:127, max:0, sum:0};
    h.n++; h.sum += Math.abs(v-64);
    if(v<h.min) h.min=v;
    if(v>h.max) h.max=v;
    this.learn.hits.set(key, h);
  },
  finishLearn(){
    if(!this.learn) return;
    const {what, hits} = this.learn;
    this.learn = null;
    if(hits.size===0){ UI.learnMsg('信号が届かなかった。他のDJソフトが掴んでいないか確認して'); return; }
    let best=null, bs=-1;
    hits.forEach((h,key)=>{
      const s = (what==='fader') ? (h.max-h.min) : h.n;
      if(s>bs){ bs=s; best={key,h}; }
    });
    const [ch, cc] = best.key.split(':').map(Number);
    if(what==='fader'){
      this.map.fader = {ch, cc, inv:false};
      UI.learnMsg('FADER → ch'+(ch+1)+' CC'+cc+' で覚えた');
    }else{
      const mode = (best.h.sum/best.h.n) > 30 ? 's7' : 'c64';
      this.map[what] = {ch, cc, mode};
      UI.learnMsg((what==='jogL'?'JOG L':'JOG R')+' → ch'+(ch+1)+' CC'+cc+' ('+mode+') で覚えた');
    }
    this.save();
    UI.setupRefresh();
  },
};

/* ==========================================================================
   SEQUENCER — 曲と譜面を小節単位で予約する
   ========================================================================== */

const Seq = {
  bar:0, nextT:0, timer:null, bpm:T.BPM, done:false,

  start(t0, bpm){
    this.bar=0; this.nextT=t0; this.bpm=bpm; this.done=false;
    clearInterval(this.timer);
    this.timer = setInterval(()=>this.tick(), 40);
    this.tick();
  },
  stop(){ clearInterval(this.timer); this.timer=null; },

  tick(){
    if(!A.ctx) return;
    const horizon = A.ctx.currentTime + T.SCROLL + 1.4;
    let guard = 0;
    while(this.nextT < horizon && !this.done && guard++ < 16){
      this.genBar(this.bar, this.nextT);
      this.nextT += 16*(60/this.bpm/4);
      this.bar++;
    }
  },

  genBar(bar, t0){
    const sec = G.section(bar);
    if(!sec){ this.done = true; return; }
    const sd = 60/this.bpm/4, barDur = sd*16;
    const k = sec.kind;
    const ch = CHORDS[bar % 4];
    const full = (k==='drop' || k==='drop2' || k==='final');
    const lastOfSec = sec.last;

    /* --- ドラム --- */
    if(full){
      for(let s=0;s<16;s++){
        const t = t0 + s*sd;
        if(KICK_D[s]) Snd.kick(t, 1.0);
        if(CLAP_D[s]) Snd.clap(t, 0.5);
        if(HAT_D[s])  Snd.hat(t, s%4===0?0.14:0.10, s===15);
        if(k==='final' && (s===5||s===13)) Snd.hat(t, 0.09, false);
      }
      if(sec.first) Snd.crash(t0, 0.16);
    } else if(k==='build'){
      for(let s=0;s<16;s++){
        const t = t0 + s*sd;
        if(s===0||s===8) Snd.kick(t, 0.85);
        if(HAT_D[s]) Snd.hat(t, 0.09, false);
      }
      if(lastOfSec){ Snd.roll(t0, barDur, 0.34); Snd.riser(t0, barDur, 0.14); }
    } else if(k==='break'){
      for(let s=0;s<16;s+=4) Snd.hat(t0+s*sd, 0.07, false);
      if(bar%2===0) Snd.kick(t0, 0.6);
      if(lastOfSec){ Snd.riser(t0, barDur, 0.16); Snd.roll(t0, barDur, 0.26); }
    } else if(k==='intro'){
      if(lastOfSec) Snd.riser(t0, barDur, 0.10);
    }

    /* --- コード・ベース・チョップ --- */
    if(full){
      /* 刻むスタブの下に、途切れないパッドを敷いておく */
      Snd.pad(t0, ch.n, barDur*0.99, 0.11);
      STAB_D.forEach(([s,d])=>{ Snd.chord(t0+s*sd, ch.n, d*sd*1.35, 0.30); });
      Snd.sub(t0, ch.root, sd*6, 0.42);
      Snd.sub(t0+sd*8, ch.root, sd*6, 0.36);
      const cp = (bar%2 ? CHOP_B : CHOP_A);
      cp.forEach(([s,i])=>{ Snd.chop(t0+s*sd, ch.n[i], sd*(k==='final'?1.6:2.0), 0.26); });
    } else if(k==='intro' || k==='break' || k==='out'){
      Snd.pad(t0, ch.n, barDur*0.98, 0.26);
      Snd.sub(t0, ch.root, barDur*0.9, 0.22);
      CHOP_A.forEach(([s,i],j)=>{ if(j%2===0) Snd.chop(t0+s*sd, ch.n[i], sd*3, 0.22); });
    } else if(k==='build'){
      STAB_D.forEach(([s,d],j)=>{ if(j%2===0) Snd.chord(t0+s*sd, ch.n, d*sd, 0.24); });
      Snd.sub(t0, ch.root, sd*7, 0.30);
      CHOP_A.forEach(([s,i],j)=>{ if(j%2===1) Snd.chop(t0+s*sd, ch.n[i], sd*2, 0.24); });
    }
    if(sec.first && (k==='drop' || k==='drop2' || k==='final')) Snd.impact(t0, 0.42);

    /* --- 譜面 --- */
    const p = sec.p;
    for(let s=0;s<16;s++){
      const c = p[s];
      if(!c || c==='.') continue;
      const tech = CH2TECH[c.toUpperCase()];
      if(tech) G.pushNote({t:t0+s*sd, tech, deck:(c===c.toUpperCase())?'L':'R'});
    }
    G.onBar(bar, t0, this.bpm, sec);
  },
};

/* ==========================================================================
   GAME
   ========================================================================== */

const G = {
  mode:'rhythm', running:false, t0:0, endAt:0,
  notes:[], score:0, combo:0, maxCombo:0,
  cnt:{p:0,g:0,w:0,m:0},
  pops:[], sparks:[], kicks:[], flash:0, flashCol:C.pink, dropAt:-9,
  label:'', sub:'', kind:'intro', bpm:T.BPM,
  streak:0, lives:T.TR_LIVES, tech:'BABY', bpmUpAt:-9,
  secMap:[], lastDir:{L:0,R:0}, lastHit:0,

  buildSections(){
    this.secMap = [];
    ARR.forEach(s=>{
      for(let i=0;i<s.n;i++){
        this.secMap.push({p:s.p, kind:s.kind, label:s.label, sub:s.sub,
                          first:i===0, last:i===s.n-1});
      }
    });
  },
  section(bar){
    if(this.mode==='training'){
      const c = {BABY:'B', FORWARD:'F', BACKWARD:'K', CHIRP:'C'}[this.tech];
      let p = '';
      for(let s=0;s<16;s++) p += (s%4===0 ? c : '.');
      return {p, kind:'drop', label:'TRAINING', sub:TECH[this.tech].jp, first:false, last:false};
    }
    return this.secMap[bar] || null;
  },

  onBar(bar, t0, bpm, sec){
    this.label = sec.label; this.sub = sec.sub; this.kind = sec.kind;
    if(sec.first && (sec.kind==='drop'||sec.kind==='drop2'||sec.kind==='final')) this.dropAt = t0;
    if(this.mode!=='training') this.endAt = t0 + 16*(60/bpm/4);
  },

  pushNote(n){ n.judged=null; n.pend=null; n.hit=0; n.j=(this.notes.length*37)%11-5; this.notes.push(n); },

  start(mode, tech){
    this.mode = mode; this.tech = tech || 'BABY';
    this.buildSections();
    this.notes=[]; this.pops=[]; this.sparks=[]; this.kicks=[];
    this.score=0; this.combo=0; this.maxCombo=0;
    this.cnt={p:0,g:0,w:0,m:0};
    this.streak=0; this.lives=T.TR_LIVES; this.bpmUpAt=-9; this.dropAt=-9;
    this.lastDir={L:0,R:0};
    this.bpm = (mode==='training') ? T.TR_BPM_START : T.BPM;
    this.label=''; this.sub=''; this.kind='intro'; this.endAt=0;
    this.running = true;
    syncClock();
    this.t0 = A.ctx.currentTime + 0.35;
    Seq.start(this.t0, this.bpm);
    Input.setFader(Input.faderX, A.ctx.currentTime);
  },
  stop(){ this.running=false; Seq.stop(); },

  /* ---- 判定 ---- */
  onStroke(ev){
    if(!this.running) return;
    let best=null, bestD=1e9;
    for(let i=0;i<this.notes.length;i++){
      const n = this.notes[i];
      if(n.judged || n.pend || n.deck!==ev.deck) continue;
      const d = Math.abs(ev.t - n.t);
      if(d<bestD && d<=T.WIN_GOOD){ bestD=d; best=n; }
    }
    const prev = this.lastDir[ev.deck];
    this.lastDir[ev.deck] = ev.dir;
    if(!best) return;

    const spec = TECH[best.tech];
    if(!ev.open){ this.judge(best,'w','フェーダーが閉じてる'); return; }
    if(spec.dir!==0 && spec.dir!==ev.dir){
      this.judge(best,'w', ev.dir>0 ? '逆。手前に引く' : '逆。前に押す');
      return;
    }
    let grade = bestD<=T.WIN_PERFECT ? 'p' : 'g';
    let note = null;
    /* BABY は交互でなければ本物のベイビースクラッチにならない */
    if(spec.alt && prev===ev.dir){ grade='g'; note='交互に！'; }
    if(spec.cut){ best.pend = {grade, note, until:ev.t+T.CHIRP_CUT, from:ev.t}; return; }
    this.judge(best, grade, note);
  },

  resolvePending(now){
    for(let i=0;i<this.notes.length;i++){
      const n = this.notes[i];
      if(!n.pend || n.judged) continue;
      const cut = Input.cutAt[n.deck];
      if(cut > n.pend.from && cut <= n.pend.until){
        const p = n.pend; n.pend=null; this.judge(n, p.grade, p.note);
      }else if(now > n.pend.until){
        n.pend=null; this.judge(n, 'g', '切れてない');
      }
    }
  },

  judge(n, grade, note){
    n.judged = grade; n.hit = A.ctx.currentTime;
    const col = TECH[n.tech].col;
    this.lastHit = n.hit;
    if(grade==='p'){
      this.cnt.p++; this.combo++;
      this.score += 1000 + Math.min(this.combo,60)*12;
      this.pop('PERFECT', C.paper, col, 1.2);
      this.burst(col, 12); this.flash=1; this.flashCol=col; this.streak++;
    }else if(grade==='g'){
      this.cnt.g++; this.combo++;
      this.score += note ? 420 : 580;
      this.pop(note || 'GOOD', note?C.lemon:C.mint, C.ink, 0.95);
      this.burst(col, 5); this.flash=0.6; this.flashCol=col; this.streak++;
    }else if(grade==='w'){
      this.cnt.w++; this.combo=0; this.streak=0;
      this.pop(note || 'WRONG', C.lemon, C.ink, 0.9);
      this.trFail();
    }else{
      this.cnt.m++; this.combo=0; this.streak=0;
      this.pop('MISS', C.pink, C.paper, 0.9);
      this.trFail();
    }
    if(this.combo > this.maxCombo) this.maxCombo = this.combo;
    if(this.mode==='training' && this.streak >= T.TR_UP_EVERY){
      this.streak = 0; this.bpm += T.TR_BPM_STEP; Seq.bpm = this.bpm;
      this.bpmUpAt = A.ctx.currentTime;
      this.pop(this.bpm+' BPM', C.cyan, C.ink, 1.3);
    }
  },

  trFail(){ if(this.mode==='training'){ this.lives--; if(this.lives<=0) this.finish(); } },

  pop(text, col, fg, scale){
    this.pops.push({text, col, fg, scale:scale||1, t:A.ctx.currentTime, r:(Math.random()-0.5)*0.09});
    if(this.pops.length>10) this.pops.shift();
  },
  burst(col, n){
    const now = A.ctx.currentTime;
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2, sp = 90+Math.random()*260;
      this.sparks.push({x:0, y:0, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-70,
        t:now, life:0.42+Math.random()*0.35, col, r:5+Math.random()*11, rot:Math.random()*3});
    }
    if(this.sparks.length>180) this.sparks.splice(0, this.sparks.length-180);
  },

  update(){
    if(!this.running) return;
    const now = A.ctx.currentTime;
    this.resolvePending(now);
    for(let i=0;i<this.notes.length;i++){
      const n = this.notes[i];
      if(n.judged || n.pend) continue;
      if(now > n.t + T.WIN_GOOD) this.judge(n, 'm');
    }
    if(this.notes.length>420) this.notes = this.notes.filter(n=>now < n.t+3);
    if(this.flash>0) this.flash = Math.max(0, this.flash-0.055);
    if(this.mode==='rhythm' && Seq.done && this.endAt && now > this.endAt+1.2) this.finish();
  },

  finish(){ if(!this.running) return; this.stop(); UI.result(); },

  /* いま鳴っているキックからの経過でサイドチェインの見た目を作る */
  pumpAt(now){
    let last = -9;
    for(let i=this.kicks.length-1;i>=0;i--){ if(this.kicks[i]<=now){ last=this.kicks[i]; break; } }
    if(last<0) return 0;
    return Math.exp(-(now-last)*7.5);
  },
};

Input.onStroke = (ev)=>G.onStroke(ev);

/* ==========================================================================
   RENDER
   ========================================================================== */

const cv = document.getElementById('cv');
const cx = cv.getContext('2d');
let W=0, H=0, DPR=1, dotsLight=null, dotsDark=null;

function resize(){
  DPR = Math.min(2, window.devicePixelRatio||1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  cv.style.width = W+'px'; cv.style.height = H+'px';
  cx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

function makeDots(col, size, r){
  const c = document.createElement('canvas'); c.width=c.height=size;
  const g = c.getContext('2d');
  g.fillStyle = col; g.beginPath(); g.arc(size/2, size/2, r, 0, 7); g.fill();
  return cx.createPattern(c, 'repeat');
}
dotsLight = makeDots('rgba(255,255,255,.30)', 10, 1.2);
dotsDark  = makeDots('rgba(27,7,48,.16)', 9, 1.15);

function rr(x,y,w,h,r){
  cx.beginPath();
  cx.moveTo(x+r,y); cx.arcTo(x+w,y,x+w,y+h,r); cx.arcTo(x+w,y+h,x,y+h,r);
  cx.arcTo(x,y+h,x,y,r); cx.arcTo(x,y,x+w,y,r); cx.closePath();
}
function star(x,y,r,rot,col,alpha){
  cx.save(); cx.translate(x,y); cx.rotate(rot); cx.globalAlpha=alpha; cx.fillStyle=col;
  const k = r*0.26;
  cx.beginPath();
  cx.moveTo(0,-r);
  cx.quadraticCurveTo(k,-k, r,0);
  cx.quadraticCurveTo(k,k, 0,r);
  cx.quadraticCurveTo(-k,k, -r,0);
  cx.quadraticCurveTo(-k,-k, 0,-r);
  cx.fill(); cx.restore();
}
function blob(x,y,r,col,a){
  const g = cx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0, hexa(col,a));
  g.addColorStop(0.6, hexa(col,a*0.35));
  g.addColorStop(1, hexa(col,0));
  cx.fillStyle = g; cx.beginPath(); cx.arc(x,y,r,0,7); cx.fill();
}
function hexa(h, a){
  const n = parseInt(h.slice(1),16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}

/* ---- 曲中の背景色 ---- */
const KIND_COL = {
  intro:[C.lilac, C.cyan], build:[C.lilac, C.pink], drop:[C.pink, C.cyan],
  break:[C.cyan, C.mint], drop2:[C.pink, C.lilac], final:[C.pink, C.lemon], out:[C.lilac, C.cyan],
};

function draw(){
  requestAnimationFrame(draw);
  const now = A.ctx ? A.ctx.currentTime : 0;
  cx.clearRect(0,0,W,H);
  if(!G.running || !A.ctx){ drawJacket(); return; }
  drawPlay(now);
}

/* ============ 遊んでいないとき：ジャケット ============ */
function drawJacket(){
  const t = performance.now()/1000;
  const g = cx.createLinearGradient(0,0,W*0.7,H);
  g.addColorStop(0,'#FFE7F3'); g.addColorStop(0.5,'#EADEFF'); g.addColorStop(1,'#D6F6FF');
  cx.fillStyle=g; cx.fillRect(0,0,W,H);

  blob(W*0.22+Math.sin(t*0.31)*W*0.06, H*0.30+Math.cos(t*0.27)*H*0.07, Math.max(W,H)*0.42, C.pink, 0.34);
  blob(W*0.80+Math.cos(t*0.23)*W*0.05, H*0.66+Math.sin(t*0.19)*H*0.06, Math.max(W,H)*0.38, C.cyan, 0.36);
  blob(W*0.55+Math.sin(t*0.17)*W*0.08, H*0.14+Math.cos(t*0.21)*H*0.05, Math.max(W,H)*0.30, C.lilac, 0.30);

  cx.save(); cx.globalAlpha=.55; cx.fillStyle=dotsDark; cx.fillRect(0,0,W,H); cx.restore();

  /* まわっているレコード */
  const r = Math.min(W,H)*0.31;
  cx.save();
  cx.translate(W*0.5, H*0.53); cx.rotate(t*0.42); cx.globalAlpha=0.13;
  cx.strokeStyle=C.ink;
  for(let k=0;k<12;k++){ cx.lineWidth=k%3?1:2; cx.beginPath(); cx.arc(0,0,r-k*(r/14),0,7); cx.stroke(); }
  cx.fillStyle=C.ink; cx.beginPath(); cx.arc(0,0,r*0.20,0,7); cx.fill();
  cx.globalAlpha=0.5; cx.fillStyle=C.paper; cx.beginPath(); cx.arc(0,0,r*0.035,0,7); cx.fill();
  cx.restore();

  /* きらきら */
  for(let i=0;i<9;i++){
    const p = (t*0.22 + i*0.111) % 1;
    const x = ((i*97)%100)/100*W, y = H*(1.05-p*1.2);
    star(x, y, 7+((i*13)%9), t*1.1+i, i%2?C.paper:C.pink, 0.55*Math.sin(Math.PI*p));
  }
}

/* ============ 遊んでいるとき ============ */
function drawPlay(now){
  const pump = G.pumpAt(now);
  const kc = KIND_COL[G.kind] || KIND_COL.drop;
  const dropAge = now - G.dropAt;

  cx.save();
  cx.translate(W/2, H/2); cx.scale(1+pump*0.012, 1+pump*0.014); cx.translate(-W/2,-H/2);

  /* 背景 */
  cx.fillStyle = C.deep; cx.fillRect(0,0,W,H);
  const t = now*0.6;
  blob(W*0.18+Math.sin(t*0.5)*W*0.05, H*0.32, Math.max(W,H)*0.60, kc[0], 0.52+pump*0.24);
  blob(W*0.86+Math.cos(t*0.4)*W*0.04, H*0.70, Math.max(W,H)*0.54, kc[1], 0.44+pump*0.22);
  blob(W*0.50, H*0.52, Math.max(W,H)*(0.16+pump*0.12), C.paper, 0.06+pump*0.10);
  cx.save(); cx.globalAlpha=.34; cx.fillStyle=dotsLight; cx.fillRect(0,0,W,H); cx.restore();

  /* ドロップの瞬間の白フラッシュ */
  if(dropAge>=0 && dropAge<0.22){
    cx.fillStyle = hexa(C.paper, (1-dropAge/0.22)*0.55);
    cx.fillRect(0,0,W,H);
  }

  const jx = Math.round(W*0.225);
  const laneY = Math.round(H*0.575);
  const laneH = 138;
  const beat = 60/G.bpm;
  const pps = (W-jx)/T.SCROLL;

  /* レーンの帯 */
  cx.save();
  cx.fillStyle = hexa(C.ink, 0.55);
  cx.fillRect(0, laneY-laneH/2, W, laneH);
  cx.strokeStyle = hexa(C.paper, 0.85); cx.lineWidth = 3;
  cx.beginPath();
  cx.moveTo(0, laneY-laneH/2); cx.lineTo(W, laneY-laneH/2);
  cx.moveTo(0, laneY+laneH/2); cx.lineTo(W, laneY+laneH/2);
  cx.stroke();
  cx.restore();

  /* 拍のめもり */
  const fb = Math.ceil((now-G.t0)/beat);
  for(let k=0;k<40;k++){
    const bt = G.t0 + (fb+k)*beat;
    const x = jx + (bt-now)*pps;
    if(x>W) break;
    const strong = (((fb+k)%4)+4)%4===0;
    cx.fillStyle = hexa(C.paper, strong?0.34:0.13);
    cx.fillRect(x-1, laneY-laneH/2+(strong?0:16), strong?2.5:1.5, laneH-(strong?0:32));
  }

  /* 判定線 */
  cx.save();
  const jf = G.flash;
  cx.fillStyle = jf>0 ? G.flashCol : C.paper;
  cx.fillRect(jx-4, laneY-laneH/2-16, 8, laneH+32);
  cx.fillStyle = hexa(C.paper, 0.10+jf*0.26);
  cx.fillRect(jx-46, laneY-laneH/2, 92, laneH);
  star(jx, laneY-laneH/2-24, 11+jf*10, 0, jf>0?G.flashCol:C.paper, 0.9);
  star(jx, laneY+laneH/2+24, 9+jf*8, 0.4, jf>0?G.flashCol:C.paper, 0.7);
  cx.restore();

  /* ノーツ（ステッカー） */
  let next=null, nextD=1e9;
  for(let i=0;i<G.notes.length;i++){
    const n = G.notes[i];
    const dt = n.t - now;
    const x = jx + dt*pps;
    if(x<-160 || x>W+160) continue;
    const spec = TECH[n.tech];
    if(!n.judged && dt>=-0.06 && dt<nextD){ nextD=dt; next=n; }
    const big = n.deck==='L';
    const s = big ? 92 : 64;
    const y = laneY - s/2 + (big ? -6 : 20);
    let al=1, sc=1;
    if(n.judged){
      const e = (now-n.hit)/0.3;
      if(e>1) continue;
      al = 1-e; sc = 1+e*0.55;
    }
    cx.save();
    cx.globalAlpha = al;
    cx.translate(x, y+s/2);
    cx.rotate(n.j*0.011); cx.scale(sc,sc);
    /* 影 */
    cx.fillStyle = hexa(C.ink, 0.75);
    rr(-s/2+6, -s/2+7, s, s, big?20:15); cx.fill();
    /* 本体 */
    cx.fillStyle = spec.col;
    rr(-s/2, -s/2, s, s, big?20:15); cx.fill();
    cx.strokeStyle = C.paper; cx.lineWidth = 3; cx.stroke();
    /* 文字 */
    cx.fillStyle = C.ink; cx.textAlign='center'; cx.textBaseline='middle';
    cx.font = '400 '+(big?23:17)+'px '+F_DISP;
    cx.fillText(spec.short, 0, big?-6:0);
    if(big){
      cx.font = '900 11px '+F_JP;
      cx.fillText(spec.cut ? 'おして、きる' : (n.tech==='BABY' ? 'こうご' : (spec.dir>0?'まえ':'うしろ')), 0, 17);
    }else{
      cx.fillStyle = hexa(C.ink,0.7); cx.font='900 9px '+F_JP;
      cx.fillText('R', 0, 17);
    }
    cx.restore();
  }

  /* きらきら（判定線から出る） */
  for(let i=G.sparks.length-1;i>=0;i--){
    const s = G.sparks[i];
    const e = (now-s.t)/s.life;
    if(e>1){ G.sparks.splice(i,1); continue; }
    const x = jx + s.vx*(now-s.t), y = laneY + s.vy*(now-s.t) + 420*Math.pow(now-s.t,2);
    star(x, y, s.r*(1-e*0.55), s.rot + e*4, s.col, (1-e));
  }

  /* 次の技（大きく・色ズレ） */
  if(next){
    const spec = TECH[next.tech];
    let title = spec.name;
    if(next.tech==='BABY'){
      const want = -(G.lastDir[next.deck]||-1);
      title = want>0 ? 'BABY →' : 'BABY ←';
    }
    const size = Math.round(Math.min(112, W*0.095));
    cx.save();
    cx.textAlign='center'; cx.textBaseline='middle';
    cx.font = '400 '+size+'px '+F_DISP;
    const y = H*0.255;
    cx.globalCompositeOperation='lighter';
    cx.fillStyle = hexa(C.pink,0.85);  cx.fillText(title, W/2-3.5, y);
    cx.fillStyle = hexa(C.cyan,0.85);  cx.fillText(title, W/2+3.5, y);
    cx.globalCompositeOperation='source-over';
    cx.fillStyle = C.paper; cx.fillText(title, W/2, y);
    cx.font = '900 14px '+F_JP;
    cx.fillStyle = hexa(C.paper, 0.72);
    cx.fillText(spec.jp + (next.deck==='R' ? '　／　右デッキ' : ''), W/2, y+size*0.62);
    cx.restore();
  }

  /* 判定の文字 */
  for(let i=G.pops.length-1;i>=0;i--){
    const p = G.pops[i];
    const e = (now-p.t)/0.60;
    if(e>1){ G.pops.splice(i,1); continue; }
    cx.save();
    cx.globalAlpha = Math.min(1,(1-e)*2.4);
    cx.translate(W/2, H*0.415 - e*22);
    cx.rotate(p.r); cx.scale(1+e*0.16, 1+e*0.16);
    cx.textAlign='center'; cx.textBaseline='middle';
    const isJp = /[^\x00-\x7F]/.test(p.text);
    cx.font = isJp ? ('900 '+Math.round(30+p.scale*16)+'px '+F_JP)
                   : ('400 '+Math.round(38+p.scale*30)+'px '+F_DISP);
    cx.fillStyle = C.ink;   cx.fillText(p.text, 5, 6);
    cx.fillStyle = p.col;   cx.fillText(p.text, 0, 0);
    cx.restore();
    break;
  }

  drawHud(now, pump);
  drawGear(now);
  cx.restore();
}

function drawHud(now, pump){
  /* スコア */
  cx.textAlign='left'; cx.textBaseline='top';
  cx.fillStyle = hexa(C.paper,0.5); cx.font='900 10px '+F_JP;
  cx.fillText('SCORE', 22, 46);
  cx.fillStyle = C.paper; cx.font='400 '+Math.round(40+pump*3)+'px '+F_DISP;
  cx.fillText(String(G.score).padStart(6,'0'), 20, 58);

  /* セクション */
  if(G.label){
    cx.save();
    cx.translate(W/2, 40); cx.rotate(-0.035);
    cx.textAlign='center'; cx.textBaseline='middle';
    cx.font='400 17px '+F_DISP;
    const w = cx.measureText(G.label).width + 26;
    cx.fillStyle = C.paper; rr(-w/2, -14, w, 28, 6); cx.fill();
    cx.fillStyle = C.ink; cx.fillText(G.label, 0, 1);
    cx.restore();
    cx.textAlign='center'; cx.textBaseline='top';
    cx.fillStyle = hexa(C.paper,0.62); cx.font='900 11.5px '+F_JP;
    cx.fillText(G.sub, W/2, 60);
  }

  /* コンボ */
  if(G.combo>1){
    const age = Math.min(1,(now-G.lastHit)/0.22);
    cx.save();
    cx.translate(W-26, 52); cx.rotate(0.045);
    cx.textAlign='right'; cx.textBaseline='middle';
    cx.font='400 '+Math.round(74-age*8)+'px '+F_DISP;
    cx.fillStyle = C.ink;  cx.fillText(G.combo, 5, 6);
    cx.fillStyle = C.paper; cx.fillText(G.combo, 0, 0);
    cx.restore();
    cx.save();
    cx.translate(W-26, 96); cx.rotate(0.045);
    cx.textAlign='right'; cx.textBaseline='middle';
    cx.font='400 15px '+F_DISP; cx.fillStyle=C.pink2;
    cx.fillText('COMBO', 0, 0);
    cx.restore();
  }

  /* TRAINING のライフ */
  if(G.mode==='training'){
    cx.textAlign='right'; cx.textBaseline='top';
    cx.fillStyle=hexa(C.paper,.5); cx.font='900 10px '+F_JP;
    cx.fillText('のこり', W-26, 118);
    for(let i=0;i<3;i++){
      star(W-34-i*24, 140, i<G.lives?10:6, 0.3, i<G.lives?C.pink:hexa(C.paper,.22), 1);
    }
    if(now-G.bpmUpAt < 1.1){
      cx.save(); cx.translate(W/2, H*0.50); cx.rotate(-0.05);
      cx.textAlign='center'; cx.font='400 30px '+F_DISP;
      cx.fillStyle=C.ink; cx.fillText('SPEED UP', 4, 4);
      cx.fillStyle=C.cyan; cx.fillText('SPEED UP', 0, 0);
      cx.restore();
    }
  }
}

function drawGear(now){
  const by = H - 104;
  ['L','R'].forEach((side,i)=>{
    const d = A.deck[side]; if(!d) return;
    const px = i===0 ? 92 : W-92;
    const r = 56, on = Input.gate[side]>0.5;
    cx.save(); cx.translate(px, by);
    cx.fillStyle = hexa(C.ink,0.9); cx.beginPath(); cx.arc(0,0,r,0,7); cx.fill();
    cx.strokeStyle = on ? C.paper : hexa(C.paper,0.24); cx.lineWidth=3;
    cx.beginPath(); cx.arc(0,0,r,0,7); cx.stroke();
    cx.save(); cx.rotate(d.pos*Math.PI*6);
    cx.globalAlpha=.5; cx.strokeStyle=hexa(C.paper,.35); cx.lineWidth=1;
    for(let k=1;k<=3;k++){ cx.beginPath(); cx.arc(0,0,r-k*12,0,7); cx.stroke(); }
    cx.globalAlpha=1;
    cx.fillStyle = i===0 ? C.pink : C.cyan;
    cx.beginPath(); cx.arc(0,0,r*0.38,0,7); cx.fill();
    cx.fillStyle = C.ink; cx.beginPath(); cx.arc(0,0,3.5,0,7); cx.fill();
    cx.fillStyle = hexa(C.ink,.75); cx.fillRect(-1.6,-r*0.38,3.2,r*0.16);
    cx.restore();
    cx.restore();
    cx.textAlign='center'; cx.textBaseline='top';
    cx.fillStyle = hexa(C.paper, on?0.75:0.3); cx.font='400 12px '+F_DISP;
    cx.fillText(i===0?'DECK 1':'DECK 2', px, by+r+9);
  });

  /* クロスフェーダー */
  const fw = Math.min(300, W*0.26), fx = W/2-fw/2, fy = by+18;
  cx.fillStyle = hexa(C.ink,0.85); rr(fx, fy, fw, 16, 8); cx.fill();
  cx.strokeStyle = hexa(C.paper,0.4); cx.lineWidth=2; cx.stroke();
  const kx = fx + Input.faderX*fw;
  cx.fillStyle = C.ink; rr(kx-9, fy-7, 18, 30, 6); cx.fill();
  cx.fillStyle = C.paper; rr(kx-8, fy-8, 16, 30, 6); cx.fill();
  cx.textAlign='center'; cx.textBaseline='top';
  cx.fillStyle = hexa(C.paper,0.45); cx.font='900 9.5px '+F_JP;
  cx.fillText('クロスフェーダー', W/2, fy+28);

  /* スクラッチの軌跡 */
  const sw = Math.min(330, W*0.26), sx = W/2-sw/2, sy = by-56, sh = 50;
  cx.fillStyle = hexa(C.ink,0.55); rr(sx, sy, sw, sh, 10); cx.fill();
  ['L','R'].forEach((side,i)=>{
    const d = A.deck[side]; if(!d) return;
    cx.beginPath();
    for(let k=0;k<256;k++){
      const v = d.hist[(d.hi+1+k)&255];
      const x = sx + (k/255)*sw, y = sy+sh-4 - v*(sh-8);
      k? cx.lineTo(x,y) : cx.moveTo(x,y);
    }
    cx.strokeStyle = i===0 ? C.pink2 : C.cyan;
    cx.lineWidth = 2; cx.lineJoin='round'; cx.stroke();
  });
}

requestAnimationFrame(draw);
