'use strict';
/* ==========================================================================
   SCRATCH ARCADE — 画面・チュートリアル・キーボード
   ========================================================================== */

const $ = (id)=>document.getElementById(id);
const SCREENS = ['title','setup','tut','modes','res'];

const TICKER = [
  'SCRATCH ARCADE',
  'ジョグをまわす音ゲー',
  'TRACK 01 ／ まだ、まわしてる ／ 150 BPM',
  '遊んでいたら、スクラッチできるようになっていた',
  'BABY ／ FORWARD ／ BACKWARD ／ CHIRP',
  '音源ファイルは1つも使っていない',
  'YOUR CONTROLLER IS NOT DEAD',
];

const UI = {
  cur:'title', last:{mode:'rhythm', tech:'BABY'},

  show(id){
    SCREENS.forEach(s=>$(s).classList.toggle('on', s===id));
    this.cur = id;
    document.body.classList.remove('playing');
    if(id!=='tut') Tut.stop();
    if(id==='setup') this.setupRefresh();
  },
  hideAll(){
    SCREENS.forEach(s=>$(s).classList.remove('on'));
    this.cur = 'game';
    document.body.classList.add('playing');
  },

  conn(cls, txt){
    const e = $('connTxt');
    e.textContent = txt;
    e.className = 'stick ' + (cls==='ok' ? 'p' : 'c');
  },
  learnMsg(t){ $('learnMsg').textContent = t; },

  meter(id, v){
    const el = $(id); if(!el) return;
    const p = id==='mFader' ? v/127 : Math.min(1, Math.abs(v-64)/24);
    el.style.width = Math.round(p*100)+'%';
  },

  monLines:[],
  mon(ch, a, b, isNote){
    if(this.cur!=='setup') return;
    const s = (isNote?'NOTE ':'CC   ') + 'ch'+String(ch+1).padStart(2,'0') +
              '  <span class="n">'+String(a).padStart(3,' ')+'</span>  val '+String(b).padStart(3,' ');
    this.monLines.unshift(s);
    if(this.monLines.length>6) this.monLines.pop();
    $('mon').innerHTML = this.monLines.join('<br>');
  },

  setupRefresh(){
    $('sDev').textContent = MIDI.devName;
    const f = (m)=> m ? ('ch'+(m.ch+1)+' / CC'+m.cc+(m.mode?' / '+m.mode:'')) : '未割当';
    $('sJogL').innerHTML  = '<b>'+f(MIDI.map && MIDI.map.jogL)+'</b>';
    $('sJogR').innerHTML  = '<b>'+f(MIDI.map && MIDI.map.jogR)+'</b>';
    $('sFader').innerHTML = '<b>'+f(MIDI.map && MIDI.map.fader)+'</b>';
  },

  async play(mode, tech){
    await initAudio();
    this.last = {mode, tech};
    Input.onStroke = (ev)=>G.onStroke(ev);
    this.hideAll();
    G.start(mode, tech);
  },

  result(){
    const c = G.cnt, total = c.p+c.g+c.w+c.m;
    const acc = total ? (c.p + c.g*0.55)/total : 0;
    $('rScore').textContent = G.score.toLocaleString();
    $('rCombo').textContent = G.maxCombo;
    $('rAcc').textContent   = Math.round(acc*100)+'%';
    $('rBpm').textContent   = G.bpm;
    $('rP').textContent = c.p; $('rG').textContent = c.g;
    $('rL').textContent = c.w; $('rM').textContent = c.m;

    let rank='D', col=getComputedStyle(document.documentElement).getPropertyValue('--lilac');
    if(total===0) rank='—';
    else if(acc>=0.97){ rank='S+'; col='#FF3D8B'; }
    else if(acc>=0.93){ rank='S';  col='#35E8FF'; }
    else if(acc>=0.86){ rank='A';  col='#7CF5C4'; }
    else if(acc>=0.74){ rank='B';  col='#FFE45E'; }
    else if(acc>=0.58){ rank='C';  col='#B48CFF'; }
    $('resRank').textContent = rank;
    $('resRank').style.color = col;
    $('resTag').textContent = G.mode==='training'
      ? ('TRAINING ／ '+G.tech+' ／ '+G.bpm+' BPM まで')
      : 'TRACK 01 ／ まだ、まわしてる';
    $('rVerdict').innerHTML =
      'ここの合否は、このスコアじゃない。<br>' +
      '<b>「明日もう一度、机にコントローラーを出すか」</b>で決める。<br>' +
      '出したくならなかったら、音か判定か演出か譜面か操作感の、どれかが悪い。';
    this.show('res');
  },
};

/* ==========================================================================
   TUTORIAL — 接続して30秒でスクラッチできる
   ========================================================================== */

const Tut = {
  step:0, got:0, lastDir:0, alive:false, timer:null,

  STEPS:[
    {tag:'STEP 1 / 3', big:'TOUCH THE JOG',
     sub:'左のジョグホイールを、<b>前へ</b>擦る。<br>キーボードなら <b>F</b>。',
     need:1, test:(ev)=> ev.deck==='L' && ev.dir>0},
    {tag:'STEP 2 / 3', big:'BABY SCRATCH',
     sub:'前と後ろを、<b>交互に</b>。<br>これが BABY SCRATCH。全部の技の土台。<br>キーボードなら <b>F</b> と <b>D</b>。',
     need:4, test:(ev)=> ev.deck==='L', alt:true},
    {tag:'STEP 3 / 3', big:'CHIRP',
     sub:'前へ押して、<b>音が出ている途中でクロスフェーダーを切る</b>。<br>これが CHIRP。<br>キーボードなら <b>F</b> → すぐ <b>SPACE</b>。',
     need:2, test:(ev)=> ev.deck==='L' && ev.dir>0, cut:true},
  ],

  async begin(){
    await initAudio();
    this.alive = true; this.step = 0; this.got = 0; this.lastDir = 0;
    Input.onStroke = (ev)=>this.feed(ev);
    UI.show('tut');
    this.render();
  },
  stop(){
    if(!this.alive) return;
    this.alive = false;
    Input.onStroke = (ev)=>G.onStroke(ev);
    if(this.timer) clearTimeout(this.timer);
  },

  render(){
    const s = this.STEPS[this.step];
    $('tutTag').textContent = s.tag;
    $('tutBig').textContent = s.big;
    $('tutSub').innerHTML = s.sub;
    $('tutCnt').textContent = s.need>1 ? (this.got+' / '+s.need) : '';
    for(let i=0;i<3;i++) $('p'+(i+1)).classList.toggle('on', i<=this.step);
  },

  feed(ev){
    if(!this.alive) return;
    const s = this.STEPS[this.step];
    if(!s.test(ev)) return;
    if(s.alt){
      if(this.lastDir === ev.dir) return;
      this.lastDir = ev.dir;
    }
    if(s.cut){
      const from = ev.t;
      this.timer = setTimeout(()=>{
        if(!this.alive) return;
        if(Input.cutAt.L > from && Input.cutAt.L <= from + T.CHIRP_CUT) this.count();
        else $('tutCnt').textContent = 'まだ切れてない。押した直後に切る';
      }, T.CHIRP_CUT*1000 + 40);
      return;
    }
    this.count();
  },

  count(){
    const s = this.STEPS[this.step];
    this.got++;
    if(this.got >= s.need){
      this.step++; this.got = 0; this.lastDir = 0;
      if(this.step >= this.STEPS.length){
        this.stop();
        $('tutBig').textContent = 'READY';
        $('tutSub').innerHTML = '';
        $('tutCnt').textContent = 'もう BABY と CHIRP ができる';
        setTimeout(()=>UI.show('modes'), 1200);
        return;
      }
    }
    this.render();
  },
};

/* ==========================================================================
   キーボード
   ========================================================================== */

const KEYMAP = {KeyF:['L',1], KeyD:['L',-1], KeyJ:['R',1], KeyK:['R',-1]};

window.addEventListener('keydown', (e)=>{
  if(e.repeat) return;
  if(e.code==='Escape'){
    if(G.running){ G.stop(); UI.show('modes'); }
    else if(UI.cur!=='title'){ Tut.stop(); UI.show('title'); }
    return;
  }
  if(e.code==='Space'){
    e.preventDefault();
    if(!A.ctx) return;
    Input.kbCut = true; Input.applyKbFader(A.ctx.currentTime);
    return;
  }
  const k = KEYMAP[e.code];
  if(!k) return;
  e.preventDefault();
  if(!A.ctx) return;
  Input.keyStroke(k[0], k[1], A.ctx.currentTime);
});

window.addEventListener('keyup', (e)=>{
  if(e.code==='Space' && A.ctx){
    Input.kbCut = false; Input.applyKbFader(A.ctx.currentTime);
  }
});

/* ==========================================================================
   クリック
   ========================================================================== */

document.addEventListener('click', async (e)=>{
  const b = e.target.closest('[data-go],[data-mode],[data-learn],[data-train],[data-retry],[data-voice]');
  if(!b || b.classList.contains('dis')) return;

  if(b.dataset.go){
    await initAudio().catch(()=>{});
    if(b.dataset.go==='tut') Tut.begin(); else UI.show(b.dataset.go);
    return;
  }
  if(b.dataset.mode){
    if(b.dataset.mode==='training'){
      const p = $('trainPick');
      p.style.display = (p.style.display==='none' ? 'flex' : 'none');
      return;
    }
    UI.play('rhythm');
    return;
  }
  if(b.dataset.voice){
    await initAudio().catch(()=>{});
    document.querySelectorAll('#voicePick .btn').forEach(x=>x.classList.toggle('on', x===b));
    await setVoice(b.dataset.voice);
    Input.kbCut = false; Input.kbDeck = 'L';
    Input.applyKbFader(A.ctx.currentTime);
    Input.keyStroke('L', 1, A.ctx.currentTime);
    return;
  }
  if(b.dataset.train){ UI.play('training', b.dataset.train); return; }
  if(b.dataset.retry){ UI.play(UI.last.mode, UI.last.tech); return; }
  if(b.dataset.learn){ await initAudio().catch(()=>{}); MIDI.startLearn(b.dataset.learn); return; }
});

/* ==========================================================================
   起動
   ========================================================================== */

(function boot(){
  const line = TICKER.map(s=>'<span>'+s+' <b>✦</b></span>').join('');
  $('tickR').innerHTML = line + line;

  MIDI.load();
  UI.setupRefresh();
  MIDI.start();

  /* 判定は描画フレームに依存させない。rAF はタブが隠れると止まる */
  setInterval(()=>{ if(A.ctx) G.update(); }, 16);
  setInterval(()=>{ if(A.ctx) syncClock(); }, 2000);
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden && G.running){ G.stop(); UI.show('modes'); }
  });
})();
