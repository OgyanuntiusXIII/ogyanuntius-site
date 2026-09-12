import {buildSpeedometer,displayedSpeed} from './speedometer.js';
import {renderResultMap} from './result-map.js';
import {JourneyEvents} from './celebrations.js';
import {formatKm,formatTime} from './journey.js';
import {Leaderboard} from './leaderboard.js';
import {Effects} from './effects.js';
import {captureFlight,interpolateFlight} from './view-motion.js';
import {startTrain,mashTrain,guitarSeconds,guitarRemaining,guitarLit,TRAIN_WARNING,TRAIN_MASH,TRAIN_MIN_HITS} from './rush.js';
import {StrumAudio} from './strum-audio.js';
import {World} from './world.js';
import {Cinematics} from './cinematics.js';
import {Sequence,SEQUENCES,STAIRS} from './sequence.js';
import {newFlight,tap,step,clamp,ROUTE,GOAL,ringHit,boxHit,damage,collectRing,stopEars,releaseFromCatapult,GUITAR_RING_COUNT,GUITAR_DURATION,MAX_HEALTH,CEILING_Y,SIDE_LIMIT,GROUND_Y,nearMiss,breakChain} from './flight.js';
import {DISTRICTS} from './districts.js';
import {flierZ,flierHit,flierMilestone} from './fliers.js';
import {KM_PER_UNIT} from './journey.js';
import {runResult,shareUrl} from './result.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
buildSpeedometer(document.getElementById("speedDial"));
const board=new Leaderboard();let finalRecord=null,qualifying=null;
let practice=false,unranked=false,flierStage=0;
// ?station=N starts the flight at that station for testing. Such runs never touch the ranking or the best record.
const debugStation=(()=>{const n=Number(new URLSearchParams(location.search).get('station'));return Number.isInteger(n)&&n>0&&n<ROUTE.length-1?n:0;})();
let cinema,sequence=null,sequenceHeld=false,scenePreview=false,resumeMode='playing';
let world,s=newFlight(),mode='title',time=0,previous=performance.now(),accumulator=0,lastUi=0,lastStation=0,best=0,muted=false,toastUntil=0,flash=0;
let lastCharge=0,chargeBonusUntil=0;
let moments=new JourneyEvents(),momentUntil=0,stampUntil=0,regionUntil=0;
const previousFlight={},renderFlight={};captureFlight(previousFlight,s);
try{best=Number(localStorage.getItem('b-no-iji.tour64.best'))||0;muted=localStorage.getItem('mimicopter.3d.muted')==='1';}catch{}
const bgm=$('bgm');bgm.volume=.48;let musicWanted=false;bgm.addEventListener('error',()=>console.warn('BGMの読み込みに失敗しました')); 
function syncMusic(){bgm.volume=(s.guitar||(sequence?.kind==='guitar'&&cinema?.previewFlight.guitar))?.22:.48;const wanted=mode==='playing'||(mode==='cinematic'&&sequence&&['launch','guitar'].includes(sequence.kind)&&!sequenceHeld&&!sequence.done);bgm.muted=muted;if(Boolean(wanted)===musicWanted)return;musicWanted=Boolean(wanted);if(musicWanted)bgm.play().catch(()=>{musicWanted=false;});else bgm.pause();}
const held=[new Set(),new Set()],holdTime=[0,0];let audio;const soundSources=new Set();
function initAudio(){if(audio)return;try{const context=new AudioContext(),master=context.createGain();master.gain.value=muted?0:.25;const limiter=context.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=8;limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter).connect(context.destination);const length=context.sampleRate*2,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*.35;const noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=400;const wind=context.createGain();wind.gain.value=0;noise.connect(filter).connect(wind).connect(master);noise.start();const rotor=context.createOscillator();rotor.type='triangle';rotor.frequency.value=65;const hum=context.createGain();hum.gain.value=0;rotor.connect(hum).connect(master);rotor.start();audio={context,master,wind,filter,rotor,hum};audio.guitar=new StrumAudio(context,master,soundSources);audio.effects=new Effects(context,master,soundSources);}catch{}}
function tone(freq,duration=.1,delay=0,volume=.12){if(!audio||muted)return;const c=audio.context,at=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(freq*.72,at+duration);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.008);g.gain.exponentialRampToValueAtTime(.001,at+duration);o.connect(g).connect(audio.master);soundSources.add(o);o.start(at);o.stop(at+duration+.01);o.onended=()=>{soundSources.delete(o);g.disconnect();o.disconnect();};}
function chord(){[523,659,784].forEach((n,i)=>tone(n,.22,i*.055,.2));}
function clearInput(){held.forEach(set=>set.clear());holdTime.fill(0);$('left').classList.remove('active');$('right').classList.remove('active');}
function stopEffects(){for(const source of soundSources){try{source.stop();}catch{}}soundSources.clear();}
function setMode(next,keepInput=false){
 mode=next;if(!keepInput)clearInput();const flight=mode==='playing';if(flight)captureFlight(previousFlight,s);
 $('mashCallout').hidden=!flight;$('moment').hidden=!flight;$('stationStamp').hidden=!flight;$('regionRibbon').hidden=!flight;
 $('title').hidden=mode!=='title';$('trainPractice').hidden=mode!=='practice';$('trainHud').hidden=mode!=='playing'||!s.train;$('guitarTimer').hidden=!flight||!s.guitar;$('hud').hidden=mode!=='playing';$('controls').hidden=mode!=='playing';$('cinema').hidden=mode!=='cinematic';$('paused').hidden=mode!=='paused';$('result').hidden=mode!=='result';$('ranks').hidden=mode!=='ranks';
 if(mode!=='playing'){$('toast').classList.remove('show');$('toast').textContent='';$('feedback').classList.remove('show');$('feedback').textContent='';}
 if(audio){audio.wind.gain.setTargetAtTime(0,audio.context.currentTime,.04);audio.hum.gain.setTargetAtTime(0,audio.context.currentTime,.04);}
 if(mode==='paused')stopEffects();syncMusic();
}
function pause(){if(['playing','cinematic'].includes(mode)){resumeMode=mode;$('pauseChoices').hidden=false;$('quitChoices').hidden=true;setMode('paused');}}
function resume(){if(mode==='paused'){setMode(resumeMode);audio?.context.resume();}}
function strum(time,hitIndex){if(audio&&!muted)audio.guitar.play(time,hitIndex);}
function effect(kind,options){if(audio&&!muted)audio.effects.play(kind,options);}
function cueSound(cue){if(cue==='strum')strum(sequence?.time||0);else if(cue==='lock')effect('catch',{volume:.6,pitch:.6});else if(cue==='unlock')chord();else if(cue==='launch'){effect('launch',{volume:1.5});tone(72,.5,0,.4);}else effect(cue==='crash'?'smash':cue,{volume:cue==='return'?.8:1,pitch:sequence?.kind==='stairs'&&cue==='return'?.52/STAIRS.phoneDuration:1});}
function beginSequence(kind,preview=false,autoplay=true){if(!preview&&['stairs','goal'].includes(kind))saveBest();if(preview&&kind==='guitar'){world.reset();cinema.previewFlight=newFlight();cinema.previousPreviewTime=0;}stopEffects();sequence=new Sequence(kind);sequenceHeld=!autoplay;scenePreview=preview;if(autoplay){initAudio();audio?.context.resume();}setMode('cinematic');cinema.update(kind,0,reduced);updateCinema();}
function updateCinema(){if(!sequence)return;syncMusic();const k=sequence.kind,t=sequence.time;if(k==='goal'){$('cinemaTag').textContent='NISHI-OYAMA';$('cinemaText').textContent=t<1.2?'到着':'日本縦断';$('cinemaPause').textContent=sequenceHeld||sequence.done?'▶':'Ⅱ';$('cinemaPause').setAttribute('aria-label',sequence.done?'もう一度見る':sequenceHeld?'演出を再生':'演出を一時停止');$('cinemaProgress').style.width=t/SEQUENCES.goal.duration*100+'%';$('cinemaRetry').hidden=true;$('skip').textContent=scenePreview?'戻る':'結果へ';return;}$('cinemaTag').textContent=k==='launch'?'WAKKANAI / CATAPULT 01':k==='guitar'?(scenePreview?'PREVIEW':`${s.rings} RINGS`):'GROUND OUT';$('cinemaText').textContent=k==='launch'?(t<.65?'発進準備':'出撃'):k==='guitar'?(t<GUITAR_DURATION?`ギター ${(GUITAR_DURATION-t).toFixed(1)}秒`:'通常飛行'):t<.65?(scenePreview?'落下':runResult(s).reason):'';$('cinemaPause').textContent=sequenceHeld||sequence.done?'▶':'Ⅱ';$('cinemaPause').setAttribute('aria-label',sequence.done?'もう一度見る':sequenceHeld?'演出を再生':'演出を一時停止');$('cinemaProgress').style.width=t/SEQUENCES[k].duration*100+'%';$('cinemaRetry').hidden=scenePreview||k!=='stairs';$('skip').textContent=scenePreview?'戻る':k==='stairs'?'結果へ':'スキップ';}
function completeSequence(){
 if(!sequence)return;const kind=sequence.kind,preview=scenePreview;if(kind==='launch')cinema.update(kind,SEQUENCES.launch.duration,reduced);sequence=null;stopEffects();
 if(preview){s=newFlight();world.reset();setMode('title');return;}
 if(kind==='stairs'){finish(false);return;}if(kind==='goal'){finish(true);return;}
 if(kind==='launch'){releaseFromCatapult(s);cinema.handoff(s);accumulator=0;setMode('playing');updateUi();}
}
function skipSequence(){if(mode==='cinematic'&&sequence){sequence.skip();completeSequence();}}
function announce(text,seconds=2){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=time+seconds;}
function feedback(text){$('feedback').textContent=text;$('feedback').classList.remove('show');void $('feedback').offsetWidth;$('feedback').classList.add('show');}
$('feedback').addEventListener('animationend',()=>{$('feedback').classList.remove('show');$('feedback').textContent='';});
function celebrate(event){
 const {kind,label}=event;world.celebrations.emit(kind,s,reduced);
 if(kind==='station'){const d=DISTRICTS[event.station],el=$('stationStamp');$('stampNumber').textContent=String(event.station+1).padStart(2,'0')+' / '+ROUTE.length;$('stampName').textContent=label;$('stampLandmark').textContent=d.landmark;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');stampUntil=time+2.7;effect('stamp',{volume:1});return;}
 if(kind==='region'){$('regionRibbon').textContent=label;$('regionRibbon').classList.add('show');regionUntil=time+2.4;effect('region',{volume:.8});return;}
 $('moment').dataset.kind=kind;$('moment').textContent=label;$('moment').classList.remove('show');void $('moment').offsetWidth;$('moment').classList.add('show');momentUntil=time+(kind==='record'||kind==='final'?2.4:1.1);
 if(kind==='perfect')effect('perfect',{volume:.7});else if(kind==='chain')effect('chain',{pitch:1+Math.min(.4,s.combo*.01),volume:1});else if(kind==='demolition')effect('shatter',{volume:1.2});else if(kind==='record')effect('record',{volume:1});else if(kind==='final')effect('fanfare',{volume:.7});
}
function resetMoments(){lastCharge=0;chargeBonusUntil=0;moments=new JourneyEvents(practice?0:best);momentUntil=stampUntil=regionUntil=0;for(const id of['moment','stationStamp','regionRibbon'])$(id).classList.remove('show');}
let lastPlayCount=0;
function countPlay(){const now=Date.now();if(now-lastPlayCount<3000||!/(^|\.)ogyanuntiusxiii\.com$/.test(location.hostname))return;lastPlayCount=now;fetch("/api/plays?g=b-no-iji",{method:"POST",keepalive:true}).catch(()=>{});}
function launch(){if(!world?.mimi)return;countPlay();unranked=debugStation>0;if(!unranked)board.start();finalRecord=null;practice=false;flierStage=0;resetMoments();bgm.currentTime=0;s=newFlight();if(unranked){s.station=debugStation;s.km=ROUTE[debugStation].km;s.travel=s.km/KM_PER_UNIT;moments.station=debugStation;}s.region=ROUTE[s.station].region;s.nextStation=ROUTE[s.station+1];lastStation=s.station;accumulator=0;world.reset(s.travel);flash=0;beginSequence('launch');updateUi();}
function input(side,strength=1){
 if(mode!=='playing'||s.ended)return;
 if(s.train){if(mashTrain(s,side,strength)){tone(150+s.train.hits*12,.055,0,.18);effect('hit',{volume:.6,pitch:1+s.train.hits*.02,pan:side*.3});world.burst(s.x,s.y,-3,5);$('mashCount').classList.remove('tap');void $('mashCount').offsetWidth;$('mashCount').classList.add('tap');updateUi();}return;}
 const before=s.guitarStrums;tap(s,side,strength);
 const el=$(side<0?'left':'right');el.classList.add('active');setTimeout(()=>{if(!held[side<0?0:1].size)el.classList.remove('active');},90);
 if(s.guitar&&s.guitarStrums!==before){
  strum(s.guitarTime,s.guitarStrums-1);world.celebrations.emit('strum',s,reduced);const timer=$('guitarTimer');timer.classList.remove('tapped');void timer.offsetWidth;timer.classList.add('tapped');updateUi();
 }else if(!s.guitar){tone(side<0?340:460,.048,0,.065*strength);effect('flap',{volume:.55*strength,pan:side*.6});}
 if(strength===1&&s.flow>.8)world.burst(s.x,s.y,1,2);
}
function hit(b){const outcome=damage(s);if(outcome==='smash'){world.destroyBlock(b,s);effect('smash',{volume:1.15,pan:clamp(b.x/9,-1,1)});tone(960,.15);feedback('破壊！');for(const e of moments.smash())celebrate(e);return;}if(outcome){tone(90,.3,0,.35);flash=.35;$('flash').style.background='#f68d8b';world.burst(s.x,s.y,0,25);beginSequence('stairs');}}
function hitFlier(f){const outcome=damage(s);if(outcome==='smash'){f.done=true;world.smashFlier(f,s);effect('smash',{volume:1.1,pan:clamp(f.x/9,-1,1)});tone(980,.15);feedback(f.kind==='penguin'?'ペンギン撃退！':'リス撃退！');for(const e of moments.smash())celebrate(e);return;}if(outcome){tone(90,.3,0,.35);flash=.35;$('flash').style.background='#f68d8b';world.burst(s.x,s.y,0,25);beginSequence('stairs');}}
function saveBest(){if(practice||unranked)return;best=Math.max(best,Math.floor(s.km*1000)/1000);try{localStorage.setItem('b-no-iji.tour64.best',String(best));}catch{}}
function finish(clear){if(practice){showPractice('もう一回、ぶっ飛ばそう。');return;}s.km=Math.min(s.km,GOAL);stopEars(s);saveBest();setMode('result');const result=runResult(s);$('resultLabel').textContent=clear?'日本縦断':result.reason;$('result').classList.toggle('cleared',clear);$('clearMedal').hidden=!clear;$('resultKm').textContent=formatKm(s.km);$('resultMessage').textContent=result.place;renderResultMap(s.km);$('resultStats').textContent=`ベスト ${formatKm(best)} km　/　${formatTime(s.elapsed)}\n${s.station+1} / ${ROUTE.length}駅\nリング ${s.rings}個　/　最大 ×${s.maxCombo}\nニアミス ${s.nearMisses}回　/　破壊 ${s.destroyed}個`;$('shareX').href=shareUrl(s);finalRecord={...s};if(unranked){$('rankStatus').textContent='途中から出撃したので、ランキングは対象外';$('rankEntry').hidden=true;$('rankRetry').hidden=true;}else qualifyRank();effect('finish',{volume:.9});if(clear)effect('applause',{volume:1.55});}
async function qualifyRank(){
 if(qualifying===finalRecord||!finalRecord)return;const record=finalRecord;qualifying=record;$('rankEntry').hidden=true;$('rankRetry').hidden=true;$('rankStatus').textContent='ランキングを確認中…';
 try{const data=await board.qualify(record);if(finalRecord!==record)return;renderRanks(data.entries);$('rankStatus').textContent=data.rank?'':'今回は30位圏外';if(data.rank){$('rankPrompt').textContent=`${data.rank}位　名前を残す`;$('rankEntry').hidden=false;try{$('playerName').value=localStorage.getItem('b-no-iji.player')||'';}catch{}}}
 catch(e){if(finalRecord===record){$('rankStatus').textContent=e.message;$('rankRetry').hidden=false;}}
 finally{if(qualifying===record)qualifying=null;}
}
function renderRanks(rows){const body=$('rankRows');body.replaceChildren();rows.forEach((row,index)=>{const tr=document.createElement('tr');for(const value of [index+1,row.name,formatKm(row.metres/1000)+' km',formatTime(row.elapsed)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);});$('ranksStatus').textContent=rows.length?'':'まだ記録はありません';}
$('rankEntry').onsubmit=async e=>{e.preventDefault();const record=finalRecord;if(!record)return;$('saveRank').disabled=true;$('rankStatus').textContent='保存中…';
 try{const data=await board.register($('playerName').value);if(finalRecord!==record)return;renderRanks(data.entries);$('rankEntry').hidden=true;$('rankStatus').textContent=data.rank?`${data.rank}位に登録しました`:'今回は30位圏外';effect('finish',{volume:1.2});try{localStorage.setItem('b-no-iji.player',$('playerName').value);}catch{}}
 catch(error){if(finalRecord===record)$('rankStatus').textContent=error.message;}finally{$('saveRank').disabled=false;}
};
$('rankRetry').onclick=qualifyRank;
$('showRanks').onclick=async()=>{setMode('ranks');$('ranksStatus').textContent='読み込み中…';try{const data=await board.load();renderRanks(data.entries);}catch(e){$('ranksStatus').textContent=e.message;}};
$('closeRanks').onclick=()=>setMode('result');
for(const[id,side]of[['left',-1],['right',1]]){const el=$(id),i=side<0?0:1;el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(!held[i].has(e.pointerId)){held[i].add(e.pointerId);holdTime[i]=0;input(side);}});const release=e=>{held[i].delete(e.pointerId);if(!held[i].size)el.classList.remove('active');};el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);el.addEventListener('click',e=>{if(e.detail===0)input(side);});}
const leftCodes=new Set(['KeyF','KeyD','ArrowLeft']),rightCodes=new Set(['KeyJ','KeyK','ArrowRight']);
addEventListener('keydown',e=>{if(e.target instanceof Element&&e.target.closest('input,textarea,[contenteditable="true"]'))return;const side=leftCodes.has(e.code)?-1:rightCodes.has(e.code)?1:0;if(side){e.preventDefault();if(e.repeat||mode!=='playing')return;const i=side<0?0:1;held[i].add(e.code);holdTime[i]=0;input(side);}else if(e.code==='Escape'||e.code==='KeyP'){if(mode==='paused'){if(!$('quitChoices').hidden)$('quitCancel').click();else resume();}else pause();}else if((e.code==='Space'||e.code==='Enter')&&e.target===document.body){e.preventDefault();if(mode==='title'||mode==='result')launch();else if(mode==='paused')resume();else if(mode==='practice')startPractice();else if(mode==='cinematic'){if(sequence?.kind==='stairs'&&!scenePreview){if(practice)startPractice();else launch();}else skipSequence();}}});
addEventListener('keyup',e=>{const i=leftCodes.has(e.code)?0:rightCodes.has(e.code)?1:-1;if(i>=0){held[i].delete(e.code);if(!held[i].size)$(i===0?'left':'right').classList.remove('active');}});
addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();previous=performance.now();});
$('start').onclick=launch;$('retry').onclick=launch;$('pause').onclick=pause;$('resume').onclick=resume;$('cinemaPause').onclick=()=>{initAudio();audio?.context.resume();if(sequence.done){if(sequence.kind==='guitar'){world.reset();cinema.previewFlight=newFlight();cinema.previousPreviewTime=0;}sequence=new Sequence(sequence.kind);sequenceHeld=false;}else sequenceHeld=!sequenceHeld;if(sequenceHeld)stopEffects();updateCinema();};$('skip').onclick=skipSequence;$('cinemaRetry').onclick=()=>practice?startPractice():launch();document.querySelectorAll('[data-preview]').forEach(el=>el.onclick=()=>beginSequence(el.dataset.preview,true));function title(){finalRecord=null;practice=false;sequence=null;stopEffects();s=newFlight();world.reset();time=0;setMode('title');}
$('resultBack').onclick=title;
$('backTitle').onclick=()=>{$('pauseChoices').hidden=true;$('quitChoices').hidden=false;$('quitCancel').focus();};
$('quitCancel').onclick=()=>{$('pauseChoices').hidden=false;$('quitChoices').hidden=true;$('backTitle').focus();};
$('quitConfirm').onclick=title;
$('mute').onclick=()=>{muted=!muted;if(audio)audio.master.gain.setTargetAtTime(muted?0:.25,audio.context.currentTime,.05);try{localStorage.setItem('mimicopter.3d.muted',muted?'1':'0');}catch{}updateMute();syncMusic();};function updateMute(){$('mute').textContent=muted?'♫̸':'♪';$('mute').setAttribute('aria-label',muted?'音を出す':'音を消す');}updateMute();
function trainWarning(){clearInput();effect('horn',{volume:1.2});tone(440,.17,0,.45);tone(330,.17,.24,.4);tone(440,.17,.48,.45);}
function showPractice(message='F・J か左右のボタンを連打。8打で撃破。'){
 sequence=null;stopEffects();clearInput();$('practiceText').textContent=message;setMode('practice');
}
function startPractice(){
 practice=true;resetMoments();sequence=null;scenePreview=false;stopEffects();bgm.currentTime=0;s=newFlight();world.reset();s.region='北海道';s.nextStation=ROUTE[1];s.y=5.4;lastStation=0;accumulator=0;flash=0;
 initAudio();audio?.context.resume();startTrain(s);setMode('playing');trainWarning();updateUi();
}
$('practiceStart').onclick=startPractice;
$('practiceBack').onclick=()=>{practice=false;s=newFlight();world.reset();setMode('title');};
function simulate(dt){
 captureFlight(previousFlight,s);
 if(!s.train&&!s.guitar&&s.trainPending){startTrain(s);trainWarning();}
 for(let i=0;i<2;i++)if(held[i].size){holdTime[i]+=dt;if(holdTime[i]>=.23){holdTime[i]-=.23;input(i===0?-1:1,.44);}}
 const wasGuitar=s.guitar,encounter=s.train,oldPhase=encounter?.phase;step(s,dt);
 if(encounter&&oldPhase!=='impact'&&encounter.phase==='impact'){
  world.smashTrain(s);effect('smash',{volume:1.7});flash=reduced?.08:.35;$('flash').style.background='#fff2bc';tone(48,.45,0,.85);tone(95,.25,0,.65);chord();strum(0);
 }
 if(oldPhase==='warning'&&encounter?.phase==='mash'){clearInput();tone(900,.15,0,.35);}
 if(encounter&&!s.train)clearInput();
 if(wasGuitar&&!s.guitar&&!s.ended){moments.endRush();stopEffects();clearInput();feedback('演奏終了');if(practice){showPractice('もう一回、ぶっ飛ばそう。');return;}}
 s.region=ROUTE[s.station].region;s.nextStation=ROUTE[Math.min(s.station+1,ROUTE.length-1)];
 if(!s.ended&&s.km>=GOAL){s.ended='clear';stopEars(s);beginSequence('goal');return;}
 if(s.ended){tone(75,.3,0,.35);flash=.2;$('flash').style.background='#f68d8b';world.burst(s.x,.4,0,25);beginSequence('stairs');return;}
 // Flight continues during the confrontation; passed scenery cannot hit the player later.
 if(encounter){for(const r of world.rings)if(r.z+s.travel>=0){r.checked=true;r.obj.visible=false;}for(const b of world.blocks)if(b.z+s.travel>=-1){b.checked=true;b.obj.visible=false;b.destroyed=true;}for(const f of s.fliers)if(!f.checked&&flierZ(f,s)>=-1)f.checked=true;}
 else{
  for(const r of world.rings){const z=r.z+s.travel;if(!r.checked&&z>=0){r.checked=true;if(ringHit(s,r.x,r.y)){collectRing(s,Math.hypot(s.x-r.x,s.y-r.y)<.65);r.obj.visible=false;world.burst(r.x,r.y,0,35);effect('ring',{volume:.9,pitch:1+Math.min(s.combo,12)*.045});feedback(`×${s.combo}`);for(const e of moments.ring(s,r))celebrate(e);}else breakChain(s);}}
  for(const b of world.blocks){if(s.obstacleGrace>0){if(b.z+s.travel>=-1)b.checked=true;continue;}if(b.suppressed)continue;if(!b.checked&&b.z+s.travel>=-1){b.checked=true;if(boxHit(s,b))hit(b);else if(nearMiss(s,b)){feedback('ニアミス');celebrate({kind:'near',label:'紙一重'});effect('near',{volume:.8});tone(690,.07);world.burst(s.x,s.y,0,12);}if(mode!=='playing')return;}}
  for(const f of s.fliers){if(f.done||f.checked||flierZ(f,s)<-1)continue;f.checked=true;if(s.obstacleGrace>0)continue;if(flierHit(s,f)){hitFlier(f);if(mode!=='playing')return;}}
 }
 if(s.station!==lastStation){lastStation=s.station;effect('applause',{volume:1.55});chord();s.boost=Math.max(s.boost,2);world.burst(0,s.y,0,55);}
 for(const event of moments.advance(s))celebrate(event);
 const stage=flierMilestone(s.km);if(stage>flierStage){flierStage=stage;announce(stage===1?'向こうからペンギン！':'リスも飛んでくる！',2.4);}
 syncMusic();
}
function updateUi(){
 const e=s.train,left=guitarRemaining(s),lit=reduced||guitarLit(s),flight=mode==='playing';
 $('mashCallout').hidden=!flight||!(e?.phase==='mash'||(!e&&s.guitar));$('mashCallout').classList.toggle('guitar',s.guitar&&!e);$('mashCallout').textContent=s.guitar&&!e?'かき鳴らせ！':'連打！';$('hud').classList.toggle('train-active',!!e);$('trainHud').hidden=mode!=='playing'||!e;
 if(e){
  $('trainHud').dataset.phase=e.phase;$('trainHeadline').textContent=e.phase==='warning'?'CAUTIAN！':e.phase==='mash'?'ぶっ飛ばせ！':'撃破！';
  $('mashCount').textContent=e.phase==='warning'?'':`×${e.hits}`;
  $('trainDetail').textContent=e.phase==='warning'?'電車が来る':e.phase==='mash'?`${e.hits<TRAIN_MIN_HITS?'あと'+(TRAIN_MIN_HITS-e.hits)+'打':'まだいける！'}　/　ギター ${guitarSeconds(e.hits).toFixed(1)}秒`:`ギター ${s.guitarDuration.toFixed(1)}秒`;
  $('trainClock').style.width=(e.phase==='mash'?1-e.time/TRAIN_MASH:e.phase==='warning'?1-e.time/TRAIN_WARNING:0)*100+'%';
  $('mashHint').textContent=e.phase==='mash'?'F・J / 左右のボタンを連打':'';
 }
 $('guitarTimer').hidden=!flight||!s.guitar;$('guitarTimer').classList.toggle('ending',s.guitar&&left<=2);$('guitarTimer').classList.toggle('dim',s.guitar&&!lit);
 if(s.guitarCharge>lastCharge){$('suicaBonus').textContent=s.chargeBonus||'';chargeBonusUntil=time+1;}lastCharge=s.guitarCharge;$('suicaBonus').hidden=time>chargeBonusUntil;$('suicaFill').style.width=s.guitarCharge*10+'%';$('suicaProgress').setAttribute('aria-valuenow',s.guitarCharge);$('suicaGauge').classList.toggle('charged',s.trainPending);$('suicaGauge').classList.toggle('inactive',s.guitar||!!e);$('guitarSeconds').textContent=left.toFixed(1);$('guitarTimeBar').style.width=left/s.guitarDuration*100+'%';
 $('left').querySelector('span').textContent=e?'連打':s.guitar?'左へ':'左耳';$('right').querySelector('span').textContent=e?'連打':s.guitar?'右へ':'右耳';
 const danger=Math.max(clamp((Math.abs(s.x)-(SIDE_LIMIT-2))/2,0,1),clamp((s.y-(CEILING_Y-1.5))/1.5,0,1));$('boundaryWarning').style.opacity=mode==='playing'?danger*.75:0;$('stationCount').textContent=`${s.station+1} / ${ROUTE.length}駅`;$('multiplier').textContent=s.combo>1?`×${s.combo}`:'';$('flightRule').textContent=s.guitar?'障害物を破壊':s.obstacleGrace>0?`障害物なし ${s.obstacleGrace.toFixed(1)}秒`:'一度当たったら終了';$('windStatus').textContent=Math.abs(s.wind)>.15?'横風 '+(s.wind>0?'→':'←'):s.windWarning>.2?'風が来る '+(s.windDirection>0?'→':'←'):'';const n=s.nextStation||ROUTE[1],a=ROUTE[s.station];$('km').textContent=Math.floor(s.km).toLocaleString('ja-JP');$('region').textContent=a.region+' / '+a.name+'駅 通過';$('next').textContent=n.name+'まで '+Math.max(0,Math.ceil(n.km-s.km))+' km';$('progress').style.width=clamp((s.km-a.km)/Math.max(1,n.km-a.km),0,1)*100+'%';const speed=displayedSpeed(s);$('speed').textContent=speed;$('speedNeedle').setAttribute('transform',`rotate(${-90+Math.min(1,speed/800)*180} 110 105)`);$('combo').textContent=s.guitar?`ギター ${guitarRemaining(s).toFixed(1)}秒`:s.boost>0?(s.combo>1?'ブースト / ×'+s.combo:'ブースト'):s.flow>.75?'加速中':'通常飛行';$('flowLabel').textContent=s.guitar?'ギター':s.boost>0?'ブースト':'リズム';$('flowBar').style.width=(s.guitar?1-s.guitarTime/s.guitarDuration:s.flow)*100+'%';$('hearts').textContent='● '.repeat(Math.max(0,s.health))+'○ '.repeat(Math.max(0,MAX_HEALTH-s.health));$('hearts').setAttribute('aria-label','耐久力'+s.health);$('liftBar').style.height=clamp((s.y-GROUND_Y)/(CEILING_Y-GROUND_Y),0,1)*100+'%';$('left').querySelector('i').style.transform=`scaleX(${clamp(s.rpm[0]/1.8,0,1)})`;$('right').querySelector('i').style.transform=`scaleX(${clamp(s.rpm[1]/1.8,0,1)})`;}
let debug;if(new URLSearchParams(location.search).has('inspect')){debug=document.createElement('output');debug.style.cssText='position:fixed;left:10px;top:100px;background:#fffd;padding:10px;font:11px monospace;z-index:30;white-space:pre';document.body.append(debug);}
// With ?inspect the internals are reachable from the console for testing (never in normal play).
if(debug)window.__b={get world(){return world;},get flight(){return s;},get mode(){return mode;}};
function frame(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(mode!=='paused')time+=dt;if(mode==='playing'){accumulator+=dt;while(accumulator>=1/120&&mode==='playing'){simulate(1/120);accumulator-=1/120;}if(audio&&mode==='playing'){const at=audio.context.currentTime;audio.wind.gain.setTargetAtTime(.12+s.flow*.26+(s.guitar?.35:s.boost>0?.15:0),at,.15);audio.filter.frequency.setTargetAtTime(450+s.speed*14,at,.15);audio.rotor.frequency.setTargetAtTime(55+Math.max(...s.rpm)*45,at,.025);audio.hum.gain.setTargetAtTime(Math.max(...s.rpm)*.06,at,.025);}}else accumulator=0;
 if(mode==='cinematic'&&sequence){for(const cue of sequence.advance(dt,sequenceHeld))cueSound(cue);if(sequence.done&&!scenePreview)completeSequence();else updateCinema();}
 const showCinema=sequence&&(mode==='cinematic'||(mode==='paused'&&resumeMode==='cinematic'));if(showCinema){cinema.update(sequence.kind,sequence.time,reduced);cinema.render();}else{world.update(mode==='paused'?0:dt,mode==='playing'?interpolateFlight(renderFlight,previousFlight,s,accumulator*120):s,mode,time,reduced);world.render();}flash*=Math.exp(-7*dt);$('flash').style.opacity=flash;$('vignette').style.opacity=mode==='playing'&&(s.guitar||s.boost>0)&&!reduced?1:0;for(const [id,until]of[['moment',momentUntil],['stationStamp',stampUntil],['regionRibbon',regionUntil]])if(time>until)$(id).classList.remove('show');if(time>toastUntil){$('toast').classList.remove('show');$('toast').textContent='';}if(now-lastUi>90){updateUi();lastUi=now;if(debug)debug.textContent=`${mode}${sequence?' / '+sequence.kind+' '+sequence.time.toFixed(2)+'s':''} · ${Math.round(1/Math.max(dt,.001))} FPS\nx ${s.x.toFixed(2)} / altitude ${s.y.toFixed(2)}\nF ${s.earTurns[0].toFixed(2)} turns / J ${s.earTurns[1].toFixed(2)} turns\n${s.rings} rings / ${s.combo} chain / ${formatKm(s.km)} km ×${s.rate.toFixed(3)}\ntrain ${s.train?.phase??'-'} ${s.train?.hits??0} hits / guitar ${s.guitar} ${guitarRemaining(s).toFixed(2)}s\nguitar taps ${s.guitarStrums} / strums ${audio?.guitar.tapCount??0} / total ${s.guitarDuration.toFixed(2)}s\nSE applause ${audio?.effects.counts.applause??0} / phone ${audio?.effects.counts.catch??0}\nAudio ${audio?.context.state??'off'} / BGM ${bgm.paused?'paused':'playing'} ${bgm.currentTime.toFixed(1)}s\n${world.renderer.info.render.calls} draw calls · ${world.renderer.info.render.triangles} triangles`;}
 requestAnimationFrame(frame);
}
try{world=new World($('world'));await world.ready;cinema=new Cinematics(world);$('start').disabled=false;$('start').textContent='出撃';setMode('title');const preview=new URLSearchParams(location.search).get('preview');if(preview==='train')showPractice();else if(['launch','guitar','stairs','goal'].includes(preview))beginSequence(preview,true,false);addEventListener('resize',()=>world.resize());requestAnimationFrame(frame);}catch(e){console.error(e);$('loadError').hidden=false;$('errorMessage').textContent='3Dの読み込みに失敗しました。'+e.message;}

