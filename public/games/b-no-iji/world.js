import {CelebrationView} from './celebration-view.js';
import {GOAL} from './journey.js';
import {KM_PER_UNIT} from './journey.js';
import {makeWires} from './wires.js';
import {FlightCamera} from './view-motion.js';
import {makeExpress} from './train-model.js';
import {trainZ,guitarLit} from './rush.js';
import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {ringAt,obstacleAt,obstacleSpacing,FIRST_OBSTACLE} from './course.js';
import {makeFlier,animateFlier} from './flier-models.js';
import {flierZ,FLIER_SIZE} from './fliers.js';
import {RING_RADIUS,ROUTE,GROUND_Y,CEILING_Y,SIDE_LIMIT} from './flight.js';
import {DISTRICTS,districtIndex} from './districts.js';
import {makeLandmark} from './landmarks.js';
import {guitarRig,strumPose} from './guitar.js';
import {setupSlidePose,applySlidePose} from './rig.js';
export const THEMES={北海道:['#c4eaf4','#eaf4ee','#7ca5a9'],東北:['#c2e9ee','#b0cf97','#4f8974'],関東:['#d7e6ef','#c4d1bb','#7b9d96'],中部:['#b6e1ef','#a8cba6','#467e70'],関西:['#e1eaf0','#d5d9ba','#8b9f84'],中国:['#b4e6f0','#c5dacb','#5b9491'],九州:['#bee4ed','#bad18c','#74906e']};
const boxGeo=new T.BoxGeometry(1,1,1),coneGeo=new T.ConeGeometry(1,1,7),sphereGeo=new T.SphereGeometry(1,12,8);
const mat=(color,roughness=.85)=>new T.MeshStandardMaterial({color,roughness});
const snow=mat('#eff6f0'),leaf=mat('#83a7a3'),bark=mat('#a38c78'),roof=mat('#6b959e'),wall=mat('#f4ebe0'),trackMat=mat('#637b81'),gravel=mat('#b8cecb'),gold=mat('#ffcf4e',.3),suica=mat('#80c342',.28),red=mat('#80c342'),white=mat('#f4f5ee');
// Barrier outline (reddish but not loud), watermelon seeds, and the dark rind of the rings.
const outline=new T.MeshBasicMaterial({color:'#b5494c',side:T.BackSide}),seed=mat('#1d1b1c',.5),rindDark=mat('#1f4d24',.5);
// Real watermelon rind: light green with jagged dark stripes wrapped around the ring.
function watermelonMaterial(){const c=document.createElement('canvas');c.width=1024;c.height=128;const g=c.getContext('2d');g.fillStyle='#5cb050';g.fillRect(0,0,1024,128);g.fillStyle='#8fd07a';for(let i=0;i<1024;i+=64)g.fillRect(i+44,0,6,128);g.fillStyle='#1c4a22';for(let i=0;i<16;i++){const x0=i*64+8;g.beginPath();g.moveTo(x0,0);for(let y=0;y<=128;y+=8){const w=Math.sin(y*.21+i*1.7)*5+Math.sin(y*.53+i)*3;g.lineTo(x0+w,y);}for(let y=128;y>=0;y-=8){const w=Math.sin(y*.21+i*1.7)*5+Math.sin(y*.53+i)*3;g.lineTo(x0+24+w*.8,y);}g.closePath();g.fill();}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=T.RepeatWrapping;t.wrapT=T.RepeatWrapping;t.repeat.set(2,1);return new T.MeshStandardMaterial({map:t,roughness:.45});}
const dummy=new T.Object3D();
function mesh(geo,material,x,y,z,sx=1,sy=sx,sz=sx){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;}
function instance(geo,material,items){const obj=new T.InstancedMesh(geo,material,items.length);for(let i=0;i<items.length;i++){const a=items[i];dummy.position.set(a[0],a[1],a[2]);dummy.scale.set(a[3],a[4],a[5]);dummy.rotation.set(0,a[6]||0,0);dummy.updateMatrix();obj.setMatrixAt(i,dummy.matrix);}obj.instanceMatrix.needsUpdate=true;return obj;}
function seeded(seed){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export class World{
 constructor(canvas){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  this.scene=new T.Scene();this.scene.background=new T.Color('#c4eaf4');this.scene.fog=new T.Fog('#c4eaf4',95,450);this.camera=new T.PerspectiveCamera(58,innerWidth/innerHeight,.1,750);
  this.scene.add(new T.HemisphereLight('#fffbea','#789aa8',2.1));this.sun=new T.DirectionalLight('#fff6de',2.4);this.sun.position.set(-35,70,35);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-22,right:22,top:25,bottom:-22,near:1,far:160});this.sun.shadow.normalBias=.055;this.scene.add(this.sun);this.scene.add(this.sun.target);
  const rim=new T.DirectionalLight('#c8dfff',1.15);rim.position.set(12,6,-20);this.scene.add(rim);
  const sunDisc=mesh(sphereGeo,new T.MeshBasicMaterial({color:'#fff3c5'}),-120,150,-430,19);this.scene.add(sunDisc);
  this.sea=mesh(boxGeo,mat('#84c5d6',.25),-85,-.6,-300,100,1,1000);this.scene.add(this.sea);
  this.tiles=[];for(let i=0;i<7;i++)this.tiles.push(this.makeTile(i));// Landmarks sit beside the track. Anything taller than the ground is kept at least 16 units clear of the centre line, so scenery never looks like a barrier; flat water and fields may still run under the course.
  this.landmarks=DISTRICTS.map((d,i)=>{const g=makeLandmark(i),mountain=['volcano','kaimon','fuji','lake'].includes(d.kind);if(mountain)g.scale.setScalar(d.kind==='volcano'?.72:.85);g.updateMatrixWorld(true);const tall=new T.Box3(),piece=new T.Box3();g.traverse(o=>{if(!o.isMesh)return;piece.setFromObject(o);if(piece.max.y>1.5)tall.union(piece);});const side=i%2?1:-1,inner=tall.isEmpty()?0:(side>0?-tall.min.x:tall.max.x);this.scene.add(g);return{g,distance:ROUTE[i].km/KM_PER_UNIT+120,x:side*Math.max(mountain?35:28,16+inner)};});
  this.mountains=new T.Group();const mountainMat=mat('#a3c7cf');for(let i=0;i<14;i++){const side=i%2?1:-1,x=side*(115+(i%3)*33),z=-i*45;this.mountains.add(mesh(coneGeo,mountainMat,x,17,z,35,48,27));this.mountains.add(mesh(coneGeo,snow,x,35,z,11,13,9));}this.scene.add(this.mountains);
  const clouds=[];const r=seeded(23);for(let i=0;i<24;i++){const x=(r()<.5?-1:1)*(26+r()*100),y=30+r()*44,z=-r()*600;for(let j=0;j<3;j++)clouds.push([x+j*7,y+(j===1?2:0),z,7+r()*5,4+r()*2,5+r()*4]);}this.clouds=instance(sphereGeo,mat('#f9fcf6'),clouds);this.scene.add(this.clouds);
  this.rings=[];const rind=watermelonMaterial(),ringGeo=new T.TorusGeometry(RING_RADIUS,.16,12,64),outerGeo=new T.TorusGeometry(RING_RADIUS+.25,.03,4,48),seedGeo=new T.SphereGeometry(.12,8,6);for(let i=0;i<10;i++){const g=new T.Group();g.add(new T.Mesh(ringGeo,rind));g.add(new T.Mesh(outerGeo,rindDark));for(let j=0;j<6;j++){const a=j*Math.PI/3+.3;const pip=mesh(seedGeo,seed,Math.cos(a)*(RING_RADIUS-.02),Math.sin(a)*(RING_RADIUS-.02),.17,.8,1.4,.6);pip.rotation.z=a-Math.PI/2;g.add(pip);}this.scene.add(g);this.rings.push({obj:g,z:0,x:0,y:5,checked:false});}
  this.blocks=[];for(let i=0;i<6;i++){const g=new T.Group();const hull=mesh(boxGeo,outline,0,0,0,3,5,2);g.add(hull);g.add(mesh(boxGeo,red,0,0,0,3,5,2));for(let y=-1.9;y<2.5;y+=1.25){const stripe=mesh(boxGeo,white,0,y,1.015,3.01,.32,.02);stripe.rotation.z=.12;g.add(stripe);}this.scene.add(g);this.blocks.push({obj:g,hull,z:0,x:0,w:3,h:5,checked:false});}
  this.stationGate=new T.Group();this.stationGate.add(mesh(boxGeo,leaf,-8,5,0,.45,10,.45));this.stationGate.add(mesh(boxGeo,leaf,8,5,0,.45,10,.45));this.stationGate.add(mesh(boxGeo,leaf,0,10.1,0,17,.5,.5));this.signCanvas=document.createElement('canvas');this.signCanvas.width=1024;this.signCanvas.height=256;this.signTexture=new T.CanvasTexture(this.signCanvas);this.signTexture.colorSpace=T.SRGBColorSpace;this.sign=new T.Mesh(new T.PlaneGeometry(10,2.5),new T.MeshBasicMaterial({map:this.signTexture}));this.sign.position.set(0,10.6,.3);this.stationGate.add(this.sign);this.scene.add(this.stationGate);
  // A real platform, canopy, benches and vending machines at every station gate.
  for(const side of[-1,1]){const x=side*14;this.stationGate.add(mesh(boxGeo,wall,x,.6,-8,8,1.2,55));this.stationGate.add(mesh(boxGeo,gold,side*10.4,1.23,-8,.25,.04,55));this.stationGate.add(mesh(boxGeo,roof,x,6,-10,8,.4,44));for(const z of[-28,-14,0,10]){this.stationGate.add(mesh(boxGeo,trackMat,side*16,3.5,z,.3,5,.3));this.stationGate.add(mesh(boxGeo,bark,x,1.8,z,3,.25,1));for(const dx of[-1,1])this.stationGate.add(mesh(boxGeo,trackMat,x+dx,1.5,z,.1,.6,.8));}this.stationGate.add(mesh(boxGeo,red,side*16,2.5,-6,1.4,2.6,1.1));this.stationGate.add(mesh(boxGeo,white,side*16,2.8,-5.43,1.1,1.3,.05));}
  this.celebrations=new CelebrationView(this.scene);
  this.finalLights=instance(sphereGeo,new T.MeshBasicMaterial({color:'#fff0ad'}),Array.from({length:56},(_,i)=>[(i%2?1:-1)*10,.35,-Math.floor(i/2)*7,.18,.12,.18]));this.scene.add(this.finalLights);
  const train=new T.Group();for(let i=0;i<3;i++){train.add(mesh(boxGeo,wall,0,.9,-i*9,2.3,1.9,8));train.add(mesh(boxGeo,leaf,0,1.15,4.02-i*9,2.31,.45,.02));for(let s of[-1,1]){for(let j=0;j<5;j++)train.add(mesh(boxGeo,trackMat,s*1.16,1.1,2.6-j*1.3-i*9,.02,.6,.85));}}train.position.set(0,.8,-180);this.train=train;this.scene.add(train);this.express=makeExpress();this.scene.add(this.express);
  const lineGeo=new T.BufferGeometry();this.linePositions=new Float32Array(90*6);lineGeo.setAttribute('position',new T.BufferAttribute(this.linePositions,3));this.streaks=new T.LineSegments(lineGeo,new T.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false}));this.streakData=Array.from({length:90},()=>({x:(r()<.5?-1:1)*(7+r()*22),y:2+r()*18,z:-r()*160}));this.scene.add(this.streaks);
  this.particleCount=110;this.particles=new T.InstancedMesh(new T.OctahedronGeometry(.10),new T.MeshBasicMaterial({color:'#fff2aa',transparent:true,opacity:.8}),this.particleCount);this.particles.frustumCulled=false;this.particleData=Array.from({length:this.particleCount},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));this.scene.add(this.particles);this.cursor=0;
  this.blob=mesh(new T.CircleGeometry(1,32),new T.MeshBasicMaterial({color:'#627590',transparent:true,opacity:.13,depthWrite:false}),0,.22,0,1.2,1.2,1.2);this.blob.rotation.x=-Math.PI/2;this.scene.add(this.blob);
  this.debris=[];this.rainbowHalo=new T.Group();for(let i=0;i<7;i++){const color=new T.Color().setHSL(i/7,.95,.58),arc=new T.Mesh(new T.TorusGeometry(2.45,.075,6,28,Math.PI*2/7-.09),new T.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false}));arc.rotation.z=i*Math.PI*2/7;this.rainbowHalo.add(arc);}this.scene.add(this.rainbowHalo);
  this.wires=makeWires();this.scene.add(this.wires.group);
  this.flierPool={penguin:[],squirrel:[]};for(const kind of['penguin','squirrel'])for(let i=0;i<3;i++){const g=makeFlier(kind);g.visible=false;this.scene.add(g);this.flierPool[kind].push(g);}
  this.camera.position.set(0,10,18);this.camera.lookAt(0,6,-12);this.flightCamera=new FlightCamera(this.camera);this.camTarget=new T.Vector3();this.look=new T.Vector3();this.lastRegion='';this.lastGate='';this.ready=this.loadModel();this.reset();
 }
 async loadModel(){const gltf=await new GLTFLoader().loadAsync('assets/mimi.glb');this.mimi=gltf.scene;this.mimi.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;if(o.material.name==='Reference violet')o.material.roughness=.60;}});
  // The sculpt's names describe the front view; flight is seen from behind.
  this.left=this.mimi.getObjectByName('RightEar');this.right=this.mimi.getObjectByName('LeftEar');
  this.spinCues=[this.left,this.right].map(ear=>{ear.material=ear.material.clone();ear.material.emissive.set('#ffd879');const cue=new T.Mesh(new T.TorusGeometry(.97,.026,5,32,Math.PI*1.3),new T.MeshBasicMaterial({color:'#fff4ad',transparent:true,opacity:.8,depthWrite:false}));cue.rotation.x=Math.PI/2;cue.position.y=.43;cue.visible=false;ear.add(cue);return cue;});
  this.arms=[this.mimi.getObjectByName('LeftArm'),this.mimi.getObjectByName('RightArm')];setupSlidePose(this.mimi);this.guitar=guitarRig(this.mimi);this.scene.add(this.mimi);const materials=new Set();this.mimi.traverse(o=>{if(o.isMesh&&o.material.name==='Reference violet')materials.add(o.material);});this.rainbowMaterials=[...materials].map(material=>({material,color:material.color.clone(),emissive:material.emissive.clone()}));}
 makeTile(i){const r=seeded(i*83+41),g=new T.Group();g.add(mesh(boxGeo,snow,0,-.3,0,220,.6,160));g.add(mesh(boxGeo,gravel,0,.04,0,5,.15,160));for(const side of[-1,1])g.add(mesh(boxGeo,trackMat,side*.88,.21,0,.10,.13,160));const ties=[];for(let z=-78;z<80;z+=3)ties.push([0,.12,z,2.8,.12,.27]);g.add(instance(boxGeo,bark,ties));
  const trunks=[],leaves=[],caps=[],houses=[],roofs=[];for(let j=0;j<36;j++){const x=(j%2?1:-1)*(62+r()*38),z=(r()-.5)*160,h=2+r()*5;trunks.push([x,h*.18,z,.38,h*.36,.38]);leaves.push([x,h*.56,z,h*.32,h,h*.32]);caps.push([x,h*.76,z,h*.23,h*.58,h*.23]);}g.add(instance(boxGeo,bark,trunks));g.add(instance(coneGeo,leaf,leaves));g.add(instance(coneGeo,snow,caps));
  for(let j=0;j<6;j++){const x=(j%2?1:-1)*(64+r()*22),z=(r()-.5)*155,h=2+r()*2;houses.push([x,h*.5,z,3+r()*2,h,4]);roofs.push([x,h+.8,z,3.8,2,3.8,Math.PI*.25]);}g.add(instance(boxGeo,wall,houses));g.add(instance(new T.ConeGeometry(1,1,4),roof,roofs));g.children[0].receiveShadow=true;g.position.z=-i*160;this.scene.add(g);const city=new T.Group(),buildings=[],windows=[],towers=[];for(let j=0;j<32;j++){const x=(j%2?1:-1)*(62+r()*35),z=(r()-.5)*150,h=7+r()*27,w=4+r()*5,d=5+r()*7;buildings.push([x,h/2,z,w,h,d]);if(j%5===0)towers.push([x,h+1,z,w*.55,2,d*.55]);for(let y=2;y<h-1;y+=2.1)for(let k=0;k<3;k++)windows.push([x+(k-1)*w*.25,y,z+d/2+.02,w*.12,.75,.035]);}city.add(instance(boxGeo,mat('#8ea3af',.5),buildings));city.add(instance(boxGeo,mat('#566c7c'),towers));city.add(instance(boxGeo,new T.MeshBasicMaterial({color:'#f5deb1'}),windows));g.add(city);g.children[0].material=g.children[0].material.clone();return{g,base:-i*160,city,forest:g.children.slice(5,8),village:g.children.slice(8,10),district:-1};
 }
 reset(travel=0){this.celebrations.reset();this.express.visible=false;this.flightCamera.reset();for(const d of this.debris??[])this.scene.remove(d.obj);this.debris=[];this.tiles.forEach((t,i)=>{t.base=-i*160;t.district=-1;});const firstRing=Math.max(0,Math.ceil((travel-100)/105));this.rings.forEach((r,i)=>this.placeRing(r,firstRing+i));this.ringSerial=firstRing+10;this.nextBlockZ=FIRST_OBSTACLE-travel;this.blocks.forEach((b,i)=>this.placeBlock(b,i));this.lastGate='';this.blockSerial=6;this.graceMarked=false;for(const p of this.particleData)p.life=0;for(const kind in this.flierPool)for(const g of this.flierPool[kind])g.visible=false;}
 placeRing(r,i){Object.assign(r,ringAt(i));r.checked=false;r.obj.visible=true;r.obj.position.set(r.x,r.y,r.z);}
 placeBlock(b,i){const z=this.nextBlockZ;this.nextBlockZ-=obstacleSpacing(-z*KM_PER_UNIT);Object.assign(b,obstacleAt(i,z));b.checked=false;b.destroyed=false;b.suppressed=false;b.obj.visible=true;b.obj.position.set(b.x,b.baseY+b.h/2,b.z);b.obj.scale.set(b.w/3,b.h/5,1);const t=.24;b.hull.scale.set(3*(1+2*t/b.w),5*(1+2*t/b.h),2*(1+t));}
 smashFlier(f,s){const pool=this.flierPool[f.kind],src=pool.find(g=>g.visible&&Math.abs(g.position.x-f.x)<.001)||pool[0];const obj=src.clone(true);obj.visible=true;obj.position.set(f.x,f.y-FLIER_SIZE[f.kind].h/2,0);obj.rotation.set(0,0,0);this.scene.add(obj);this.debris.push({obj,life:1.2,vx:(Math.sign(s.vx)||1)*10,vy:9,spin:(Math.sign(s.vx)||1)*3,scale:obj.scale.clone(),vz:-70,gravity:14});this.burst(f.x,f.y,-1,45);}
 destroyBlock(b,s){if(b.destroyed)return;b.destroyed=true;const obj=b.obj.clone(true);obj.position.set(b.x,b.baseY+b.h/2,b.z+s.travel);this.scene.add(obj);this.debris.push({obj,life:1.1,vx:(Math.sign(s.vx)||1)*8,vy:8,spin:(Math.sign(s.vx)||1)*1.6,scale:obj.scale.clone()});b.obj.visible=false;this.burst(s.x,s.y,-1,50);}
 smashTrain(s){
  this.express.position.set(0,0,-10);this.express.updateMatrixWorld(true);
  this.express.children.forEach((car,i)=>{const obj=car.clone(true);obj.position.add(this.express.position);this.scene.add(obj);this.debris.push({obj,life:2.5,vx:(i%2?-1:1)*(22+i*6),vy:23+i*6,spin:(i%2?-1:1)*2,scale:obj.scale.clone(),vz:-80,gravity:13});});
  this.express.visible=false;this.burst(0,5,-6,100);
 }
 burst(x,y,z,count=22){for(let i=0;i<count;i++){const p=this.particleData[this.cursor++%this.particleCount],a=Math.random()*Math.PI*2;p.life=.8;p.x=x;p.y=y;p.z=z;p.vx=Math.cos(a)*(3+Math.random()*6);p.vy=Math.sin(a)*6;p.vz=10+Math.random()*16;}}
 update(dt,s,mode,time,reduced=false){
  this.celebrations.update(mode==='playing'?dt:0);this.celebrations.group.visible=mode==='playing'&&this.celebrations.group.visible;
  const playing=mode==='playing'||mode==='paused',travel=playing||mode==='result'?s.travel:time*9;
  this.finalLights.visible=playing&&GOAL-s.km<=100;this.finalLights.position.z=travel%7;
  for(const t of this.tiles){while(t.base+travel>190)t.base-=this.tiles.length*160;t.g.position.z=t.base+travel;const idx=districtIndex(Math.max(0,-t.base*KM_PER_UNIT),ROUTE);if(t.district!==idx){const d=DISTRICTS[idx];t.district=idx;t.g.children[0].material.color.set(d.ground);t.city.visible=d.urban>.25;t.city.scale.y=.25+d.urban*.9;t.forest.forEach(o=>o.visible=d.urban<.75);t.village.forEach(o=>o.visible=d.urban<.65);}}
  for(const landmark of this.landmarks){const z=travel-landmark.distance;landmark.g.visible=z>-620&&z<85;landmark.g.position.set(landmark.x,0,z);}this.rainbowHalo.visible=playing&&s.guitar&&(reduced||guitarLit(s));this.rainbowHalo.position.set(s.x,s.y+.3,-.7);this.rainbowHalo.rotation.z=time*(reduced?.2:1.6);
  const danger=Math.max((Math.abs(s.x)-(SIDE_LIMIT-2))/2,(s.y-(CEILING_Y-1.5))/1.5,0);this.wires.update(travel,Math.min(1,danger),playing);
  for(let i=this.debris.length-1;i>=0;i--){const d=this.debris[i];d.life-=dt;if(d.life<=0){this.scene.remove(d.obj);this.debris.splice(i,1);continue;}d.vy-=(d.gravity??16)*dt;d.obj.position.x+=d.vx*dt;d.obj.position.y+=d.vy*dt;d.obj.position.z+=(d.vz??-55)*dt;d.obj.rotation.x+=dt*4;d.obj.rotation.z+=d.spin*dt;d.obj.scale.copy(d.scale).multiplyScalar(Math.min(1,d.life/.25));}
  this.train.visible=!s.train;this.train.position.z=-280+((travel*.3)%550);this.express.visible=playing&&!!s.train&&s.train.phase!=='impact';if(this.express.visible){const e=s.train;this.express.position.set(Math.sin(time*90)*.09*Math.exp(-Math.max(0,e.time-e.lastHit)*18),0,trainZ(e));this.express.rotation.z=Math.sin(time*65)*.015*Math.exp(-Math.max(0,e.time-e.lastHit)*18);}this.mountains.position.z=(travel*.10)%45;
  for(const r of this.rings){r.obj.position.set(r.x,r.y,r.z+travel);r.obj.rotation.z=time*.17;if(r.z+travel>28){this.placeRing(r,this.ringSerial++);}}
  // When a rush ends, hide only the barriers the player would reach during the grace (the speed decays toward the cruise target);
  // everything further stays in view and arrives naturally, so nothing pops in afterwards. Hidden ones stay hidden until recycled.
  if(s.obstacleGrace>0&&!this.graceMarked){this.graceMarked=true;const r=s.rate??1,g=s.obstacleGrace,target=55+s.flow*40+(s.boost>0?34:0),reach=r*target*g+(s.speed-target)*(1-Math.exp(-3*r*g))/3+70;for(const b of this.blocks)if(b.z+travel>-reach){b.suppressed=true;b.obj.visible=false;}}
  if(s.obstacleGrace<=0)this.graceMarked=false;
  for(const b of this.blocks){
   if(b.z+travel>35)this.placeBlock(b,this.blockSerial++);
   const z=b.z+travel;b.obj.position.z=z;
  }
  for(const kind in this.flierPool)for(const g of this.flierPool[kind])g.visible=false;
  if(s.fliers){const used={penguin:0,squirrel:0};for(const f of s.fliers){if(f.done)continue;const g=this.flierPool[f.kind][used[f.kind]++];if(!g)continue;g.visible=true;g.position.set(f.x,f.y-FLIER_SIZE[f.kind].h/2,flierZ(f,s));animateFlier(g,f,time);}}
  const district=DISTRICTS[s.station??0],theme=THEMES[s.region||'北海道'];if(this.lastDistrict!==s.station){this.lastDistrict=s.station;this.scene.background.set(district.sky);this.scene.fog.color.set(district.sky);this.mountains.visible=district.urban<.7;this.mountains.children.forEach((o,i)=>{if(i%2)o.visible=s.station<3;else o.material.color.set(s.station<3?'#a3c7cf':'#8ba590');});this.sea.visible=['dome','star','triangle','torii','glass','volcano','kaimon'].includes(district.kind);leaf.color.set(theme[2]);}if(this.lastRegion!==s.region){snow.color.set(theme[1]);leaf.color.set(theme[2]);this.lastRegion=s.region;}
  const next=s.nextStation;this.stationGate.visible=playing&&!!next;if(next){this.stationGate.position.z=-(next.km/KM_PER_UNIT-travel);if(next.name!==this.lastGate){const c=this.signCanvas.getContext('2d');c.fillStyle='#fffdf4';c.fillRect(0,0,1024,256);c.fillStyle='#47915b';c.fillRect(0,0,1024,24);c.textAlign='center';c.fillStyle='#234346';c.font='bold 94px "Yu Gothic", sans-serif';c.fillText(next.name+'駅',512,145);c.font='25px sans-serif';c.fillText('B NO IJI / JAPAN FLIGHT',512,212);this.signTexture.needsUpdate=true;this.lastGate=next.name;}}
  if(this.mimi){
   const powered=playing&&s.guitar;this.rainbowMaterials.forEach((r,i)=>{if(powered&&(reduced||guitarLit(s))){r.material.color.setHSL((time*(reduced?.12:.45)+i*.18)%1,.88,.56);r.material.emissive.copy(r.material.color);r.material.emissiveIntensity=.48;}else if(this.wasPowered){r.material.color.copy(r.color);r.material.emissive.copy(r.emissive);r.material.emissiveIntensity=0;}});this.wasPowered=powered;
   applySlidePose(this.mimi,0);this.guitar.guitar.visible=playing&&s.guitar;this.arms.forEach(a=>{a.scale.setScalar(1);a.rotation.set(0,0,0);});
   if(playing||mode==='result'){
    this.mimi.position.set(s.x,s.y-1.3,0);this.mimi.rotation.set(-.16-(s.boost>0?.14:0),(s.guitar?.28:Math.PI)+s.vx*.035,-s.vx*.055);this.mimi.scale.setScalar(.80);
    [this.left,this.right].forEach((ear,index)=>{const i=s.guitar?1-index:index,active=s.earVelocity[i]>.12;ear.rotation.set(0,(i?1:-1)*s.earPhase[i]*Math.PI*2,0);ear.material.emissiveIntensity=powered?(reduced||guitarLit(s)?.48:0):active?Math.min(.35,s.rpm[i]*.16):0;this.spinCues[index].visible=active;this.spinCues[index].material.opacity=Math.min(.8,s.rpm[i]*.6);});
    this.arms[0].rotation.z=.15+s.vx*.025;this.arms[1].rotation.z=-.15+s.vx*.025;if(s.guitar)strumPose(this.guitar,s.guitarTime,s.lastGuitarStrum,s.guitarStrums);else if(s.train){const kick=Math.exp(-Math.max(0,s.train.time-s.train.lastHit)*18);this.arms[0].rotation.x=-1.4-kick*.45;this.arms[1].rotation.x=-1.4-kick*.45;this.arms[0].rotation.z=.5;this.arms[1].rotation.z=-.5;this.mimi.position.z=-kick*.65;}
    const pulse=1+Math.max(...s.rpm)*.015;this.mimi.scale.y=.80*pulse;this.mimi.visible=true;
    this.flightCamera.update(dt,s,reduced);
   }else{
    const mobile=innerWidth<721||innerWidth/innerHeight<1;this.mimi.position.set(mobile?0:3.3,1.2+Math.sin(time*1.8)*.09,0);this.mimi.scale.setScalar(1);this.mimi.rotation.set(0,-.18+Math.sin(time*.45)*.24,Math.sin(time)*.025);this.left.rotation.set(0,0,0);this.right.rotation.set(0,0,0);this.left.material.emissiveIntensity=0;this.right.material.emissiveIntensity=0;this.spinCues.forEach(c=>c.visible=false);this.arms[0].rotation.z=.08;this.arms[1].rotation.z=-.08;this.mimi.visible=true;
    this.camTarget.set(mobile?0:3.2,mobile?5.8:5.8,mobile?11.8:11.8);this.look.set(mobile?0:0,mobile?1.8:3.5,0);this.camera.fov=mobile?42:43;this.flightCamera.reset();this.camera.position.lerp(this.camTarget,1-Math.exp(-5*dt));this.camera.lookAt(this.look);
   }
   this.camera.updateProjectionMatrix();this.blob.position.set(this.mimi.position.x,.25,0);this.blob.scale.setScalar(1.4+s.y*.08);
  }
  const intensity=playing?(s.guitar?1.65:Math.max(s.flow*.45,s.boost>0?1:0)):0;this.streaks.material.color.set(s.guitar&&playing?'#ffe5a0':'#ffffff');this.streaks.material.opacity=reduced?0:intensity*.32;for(let i=0;i<this.streakData.length;i++){const p=this.streakData[i];p.z+=dt*s.speed*(s.rate??1)*1.7;if(p.z>16)p.z=-150;const k=i*6;this.linePositions.set([p.x+s.x*.4,p.y,p.z,p.x+s.x*.4,p.y,p.z-2-intensity*(s.guitar?16:7)],k);}this.streaks.geometry.attributes.position.needsUpdate=true;
  for(let i=0;i<this.particleCount;i++){const p=this.particleData[i];p.life-=dt;if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;dummy.position.set(p.x,p.y,p.z);dummy.scale.setScalar(p.life*1.6);}else dummy.scale.setScalar(0);dummy.rotation.set(time+i,time*.5,0);dummy.updateMatrix();this.particles.setMatrixAt(i,dummy.matrix);}this.particles.instanceMatrix.needsUpdate=true;
 }
 render(){this.renderer.render(this.scene,this.camera);}
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
}

