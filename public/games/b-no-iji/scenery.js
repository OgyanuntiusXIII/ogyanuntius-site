import {KM_PER_UNIT} from './journey.js';
import {World} from './world.js';
import {newFlight,ROUTE} from './flight.js';
import {DISTRICTS} from './districts.js';
const world=new World(document.getElementById('view'));let selected=0,p=newFlight(),previous=performance.now(),time=0;
const buttons=DISTRICTS.map((d,i)=>{const b=document.createElement('button');b.textContent=d.station;b.onclick=()=>select(i);document.getElementById('stations').append(b);return b;});
function select(i){selected=i;p=newFlight();p.station=i;p.region=ROUTE[i].region;p.km=ROUTE[i].km;p.travel=p.km/KM_PER_UNIT;p.y=6;world.reset();document.getElementById('station').textContent=DISTRICTS[i].station;document.getElementById('landmark').textContent=DISTRICTS[i].landmark;buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));}
function frame(now){const dt=Math.min(.04,(now-previous)/1000);previous=now;time+=dt;world.update(dt,p,'paused',time,true);world.mimi.visible=false;world.blob.visible=false;world.rings.forEach(r=>r.obj.visible=false);world.blocks.forEach(b=>b.obj.visible=false);world.stationGate.visible=false;const x=world.landmarks[selected].x,kind=DISTRICTS[selected].kind;const high=['skytree','tv','glass'].includes(kind);world.camera.position.set(x-Math.sign(x)*30,kind==='star'?42:high?30:19,high?-6:-32);world.camera.lookAt(x,high?24:7,-120);world.camera.fov=54;world.camera.updateProjectionMatrix();world.render();requestAnimationFrame(frame);}
try{await world.ready;select(0);document.getElementById('loading').hidden=true;addEventListener('resize',()=>world.resize());requestAnimationFrame(frame);}catch(e){document.getElementById('sceneError').hidden=false;document.getElementById('sceneError').textContent=e.message;console.error(e);}
