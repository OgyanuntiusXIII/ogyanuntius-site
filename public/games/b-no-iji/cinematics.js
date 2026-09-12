import {Finale} from './finale.js';
import * as T from './vendor/three.module.js';
import {clamp,newFlight,GUITAR_DURATION,boxHit,damage} from './flight.js';
import {launchMotion,LAUNCH_PREP,stairsMotion} from './sequence.js';
import {applySlidePose,setupSwapPose,applySwapPose,swapPoint} from './rig.js';
const box=new T.BoxGeometry(1,1,1),ball=new T.SphereGeometry(1,24,16);
const material=(color,metalness=0,roughness=.6)=>new T.MeshStandardMaterial({color,metalness,roughness});
const glow=color=>new T.MeshBasicMaterial({color});
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function part(parent,geo,mat,pos,scale=[1,1,1]){const obj=new T.Mesh(geo,mat);obj.position.set(...pos);obj.scale.set(...scale);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;}
function beam(parent,a,b,r,mat){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);const m=part(parent,new T.CylinderGeometry(r,r,delta.length(),8),mat,[...start.add(end).multiplyScalar(.5)]);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;}
function label(parent,text,x,y,z,w=5,h=1,color='#d8f8ff') {const c=document.createElement('canvas');c.width=1024;c.height=192;const ctx=c.getContext('2d');ctx.clearRect(0,0,1024,192);ctx.fillStyle=color;ctx.font='bold 105px sans-serif';ctx.textAlign='center';ctx.fillText(text,512,130);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return part(parent,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,transparent:true,side:T.DoubleSide}),[x,y,z]);}
function scene(bg,ambient=1.6){const s=new T.Scene();s.background=new T.Color(bg);s.add(new T.HemisphereLight('#e9f5ff','#74717b',ambient));const key=new T.DirectionalLight('#fff3e1',3);key.position.set(-5,12,9);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.1,far:70});key.shadow.normalBias=.04;s.add(key);return s;}
function actor(source){const pivot=new T.Group(),model=source.clone(true);model.position.set(0,-2,0);model.rotation.set(0,0,0);model.scale.setScalar(1);model.visible=true;model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.emissive)o.material.emissiveIntensity=0;if(o.geometry.type==='TorusGeometry')o.visible=false;}});pivot.add(model);return{pivot,model,left:model.getObjectByName('LeftArm'),right:model.getObjectByName('RightArm'),ears:[model.getObjectByName('LeftEar'),model.getObjectByName('RightEar')]};}
export class Cinematics {
 constructor(world){this.world=world;this.renderer=world.renderer;this.previewFlight=newFlight();this.camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.1,250);this.buildHangar(world.mimi);this.buildStairs(world.mimi);}
 buildHangar(source){
  const s=this.hangar=scene('#0c1520',1.8),metal=material('#344555',.45,.4),edge=material('#647786',.55,.3),dark=material('#152332',.25),white=material('#bfccd0',.4),yellow=material('#e1af45');
  const fill=new T.DirectionalLight('#b1dfff',2.4);fill.position.set(2,5,12);s.add(fill);for(const z of[-3,-17,-31]){const light=new T.PointLight('#b6e9ff',45,18);light.position.set(0,6,z);s.add(light);}
  part(s,box,metal,[0,-.4,-15],[24,.8,75]);
  for(const x of[-9,9]){part(s,box,dark,[x,5,-16],[2,10,70]);for(let z=12;z>-47;z-=8){part(s,box,edge,[x*.89,4.3,z],[.6,8.6,.6]);part(s,box,edge,[0,8.8,z],[17,.5,.7]);part(s,box,glow('#c8f3ff'),[x*.85,6.8,z],[.1,.28,4]);}}
  for(const x of[-1.8,1.8]){part(s,box,edge,[x,.05,-15],[.24,.25,70]);part(s,box,glow('#75dcf4'),[x,.2,-15],[.05,.03,70]);}
  for(let z=12;z>-45;z-=3){for(const x of[-3.1,3.1]){const stripe=part(s,box,yellow,[x,.04,z],[.9,.06,.42]);stripe.rotation.y=-.6;}}
  this.sled=new T.Group();s.add(this.sled);part(this.sled,box,metal,[0,.3,0],[4,.5,5]);for(const x of[-2,2])part(this.sled,box,yellow,[x,.6,0],[.18,.3,5]);
  this.clamps=[-1,1].map(side=>{const g=new T.Group();g.position.set(side*1.9,0,0);part(g,box,edge,[0,.65,0],[.4,1.3,.5]);part(g,box,white,[-side*.5,1.18,0],[1.2,.25,.7]);this.sled.add(g);return g;});
  this.launchActor=actor(source);s.add(this.launchActor.pivot);
  this.shutters=[-1,1].map(side=>part(s,box,metal,[side*4,4.5,-39],[8,9,.5]));
  s.background.set('#c4eaf4');part(s,box,material('#eaf4ee'),[0,-.6,-150],[110,1,230]);for(const x of[-.88,.88])part(s,box,edge,[x,.03,-150],[.1,.12,230]);for(let i=0;i<32;i++){const x=(i%2?1:-1)*(12+i%5*4),z=-45-Math.floor(i/2)*10;part(s,new T.ConeGeometry(2,7,7),material('#7ca5a9'),[x,3,z]);part(s,new T.ConeGeometry(1.5,4.5,7),material('#eef8f5'),[x,4.5,z]);}label(s,'01  /  WAKKANAI',0,7.6,-37,10,1.1);label(s,'CATAPULT',-7,3,2,3,.6);
  this.signals=[-1,0,1].map((n)=>part(s,ball,glow('#ff695b'),[n*.55,6.4,-37],[.17,.17,.17]));
  this.steam=new T.Group();s.add(this.steam);const mist=new T.MeshBasicMaterial({color:'#def5ff',transparent:true,opacity:.15,depthWrite:false});for(let i=0;i<24;i++)part(this.steam,ball,mist,[(i%2?1:-1)*(1.5+i%3*.3),.4,-i*.24],[.3,.13,.8]);
 }
 buildStairs(source){
  const s=this.stairs=scene('#263b39',1.5),steel=material('#656c6a',.6,.45),stepMat=material('#90958b'),dark=material('#35433d');
  part(s,box,dark,[0,-1,-3],[22,.3,28]);part(s,box,material('#c1c3b8'),[-2.15,4,0],[.3,12,18]);
  // Camera looks down the same narrow outdoor stairwell as the supplied clip.
  for(let i=0;i<10;i++){const z=4-i*.85,y=4.5-i*.45;part(s,box,stepMat,[0,y-.16,z],[3.5,.32,.85]);part(s,box,steel,[0,y+.012,z+.35],[3.45,.025,.055]);for(let j=0;j<7;j++)part(s,box,steel,[(j-3)*.45,y+.015,z],[.022,.02,.65]);for(const side of[-1,1]){beam(s,[side*1.75,y,z],[side*1.75,y+2,z],.034,steel);}}
  for(const side of[-1,1]){beam(s,[side*1.75,6.5,4.3],[side*1.75,2.0,-4.2],.065,steel);beam(s,[side*1.75,5.1,4.3],[side*1.75,.6,-4.2],.035,steel);}
  part(s,box,stepMat,[0,4.35,5.8],[3.5,.3,3]);part(s,box,stepMat,[0,-.2,-6],[6,.3,4]);for(let i=0;i<6;i++){part(s,box,steel,[2.15,6-i*.17,4-i*1.5],[.12,7,.12]);part(s,box,steel,[0,8.5-i*.17,4-i*1.5],[6,.12,.12]);}
  part(s,box,steel,[0,9.2,5.4],[5,.22,3]);for(let i=0;i<5;i++)part(s,box,steel,[0,8.9,4.2+i*.5],[4,.35,.1]);
  const leaves=material('#425f43');for(let i=0;i<14;i++)part(s,ball,leaves,[5+Math.sin(i)*2,2+(i%4),-i],[1.3,1.8,1.5]);part(s,box,material('#955c46'),[4,1,-5],[5,.2,5]);
  this.stairActor=actor(source);setupSwapPose(this.stairActor.model);s.add(this.stairActor.pivot);this.phone=new T.Group();part(this.phone,box,material('#202c39',.6),[0,0,0],[.28,.50,.045]);part(this.phone,box,glow('#cfeaff'),[0,0,.027],[.23,.41,.01]);s.add(this.phone);
 }
 pose(a){a.model.rotation.set(0,0,0);a.pivot.rotation.set(0,0,0);a.left.scale.setScalar(1);a.right.scale.setScalar(1);a.left.rotation.set(0,0,0);a.right.rotation.set(0,0,0);for(const e of a.ears)e.rotation.set(0,0,0);}
 update(kind,t,reduced=false){
  const mobile=innerWidth<721||innerWidth/innerHeight<1;this.camera.aspect=innerWidth/innerHeight;
  this.usingWorld=false;
  if(kind==='goal'){this.finale??=new Finale(this.world.mimi);this.finale.update(t,this.camera,reduced);this.active=this.finale.scene;
  }else if(kind==='launch'){
   const a=this.launchActor;this.pose(a);const {u:run,z}=launchMotion(t),open=smooth((t-.15)/.45),release=smooth((t-.38)/.22),unfold=smooth((run-.55)/.45);
   applySlidePose(a.model,1-unfold);a.model.scale.setScalar(.8);
   this.shutters.forEach((p,i)=>p.position.x=(i?1:-1)*(4+open*8));this.clamps.forEach((p,i)=>p.position.x=(i?1:-1)*(1.9+release*1.8));this.signals.forEach((p,i)=>p.material.color.set(t>.38?'#88ffc1':t>i*.10?'#ffc755':'#df6866'));
   this.sled.position.z=z;a.pivot.position.set(-.35*(1-unfold),1.6+run*5.475,z);a.pivot.rotation.set(-.05-.11*unfold,-.3+(Math.PI+.3)*unfold,-.07*(1-unfold));a.left.rotation.z=-.92*(1-unfold)+.15*unfold;a.right.rotation.z=-1.94*(1-unfold)-.15*unfold;a.left.rotation.x=-.18*(1-unfold);a.right.rotation.x=-.28*(1-unfold);
   for(let i=0;i<2;i++)a.ears[i].rotation.y=(i?1:-1)*run*run*75*(1-unfold);
   this.steam.position.z=z;this.steam.visible=t>LAUNCH_PREP;this.steam.scale.set(1+run*2,1+run*4,1+run*6);
   if(t<LAUNCH_PREP){this.camera.position.set(mobile?4.8:5.2,3.7,mobile?9:7.5);this.camera.lookAt(0,2,-.5);this.camera.fov=mobile?57:46;}else{this.camera.position.set((mobile?4.8:5.2)*(1-run),3.7+run*6,z+10+run*3);this.camera.lookAt(0,2.6+run*4.7,z-3-unfold*18);this.camera.fov=(mobile?57:46)+(reduced?0:run*19);}
   this.active=this.hangar;
  }else if(kind==='guitar'){
   const p=this.previewFlight,dt=Math.max(0,Math.min(.05,t-(this.previousPreviewTime??t)));this.previousPreviewTime=t;p.guitar=t<GUITAR_DURATION;p.guitarTime=Math.min(t,GUITAR_DURATION);p.speed=p.guitar?310:95+215*Math.exp(-3*(t-GUITAR_DURATION));p.flow=1;p.boost=2;p.travel=t<=GUITAR_DURATION?t*310:GUITAR_DURATION*310+95*(t-GUITAR_DURATION)+215/3*(1-Math.exp(-3*(t-GUITAR_DURATION)));p.x=Math.sin(t*.7)*.7;p.y=5.8;p.earPhase=[(t*5)%1,(-t*5)%1];p.earVelocity=[4,4];p.rpm=[.7,.7];this.world.update(dt,p,'playing',t,reduced);for(const b of this.world.blocks){if(!b.checked&&b.z+p.travel>=-1){b.checked=true;if(p.guitar&&boxHit(p,b)){damage(p);this.world.destroyBlock(b,p);}}}this.usingWorld=true;
  }else{
   const a=this.stairActor;this.pose(a);applySlidePose(a.model,0);
   const {fall,rise,returning}=stairsMotion(t),bounce=Math.sin(fall*Math.PI*6)*.24*(1-rise),z=3.7-fall*7.5;
   // Keep the old head downstairs. Only a quarter turn lifts the inverted body.
   // The ears/feet and face exchange geometry during the rise, not by a full flip.
   a.pivot.position.set(Math.sin(fall*10)*.15*(1-rise),6.5-fall*4.2+Math.abs(bounce)-rise*.12,z);
   a.pivot.rotation.set(fall*Math.PI*1.5-rise*Math.PI*.5,Math.PI,Math.sin(fall*11)*.24*(1-rise));
   applySwapPose(a.model,rise);
   // Arms keep their resting pose; the body and its ear/foot morph carry them.
   a.ears.forEach((e,i)=>e.rotation.z=(i?1:-1)*Math.sin(fall*25)*.25*(1-rise));
   this.phone.position.set(.9-fall*1.3,6.95-fall*5.75,3.05-fall*6);this.phone.rotation.set(-.4+fall*11,Math.PI+fall*8,fall*9);
   // The phone flies to the resting hand; the hand does not reach for it.
   const arm=a.left,original=arm.position.clone().add(new T.Vector3(-.63,-1.21,.1)),swapped=new T.Vector3(...swapPoint(arm.name,...original.toArray()));
   const rest=original.lerp(swapped,rise).sub(arm.position);
   a.pivot.updateMatrixWorld(true);const grip=arm.localToWorld(rest).add(new T.Vector3(0,.16,.32));
   const holding=Math.max(1-smooth(fall/.12),returning);this.phone.position.lerp(grip,holding);
   const held=new T.Quaternion().setFromEuler(new T.Euler(-.18,.22,.06));this.phone.quaternion.slerp(held,holding);
   this.camera.aspect=9/16;this.camera.position.set(-1.3,8.1,6.9);this.camera.lookAt(.1,3.9,-2.1);this.camera.rotateZ(.035);this.camera.fov=66;this.active=this.stairs;
  }
  this.camera.updateProjectionMatrix();
 }
 handoff(s){const origin=this.launchActor.model.getWorldPosition(new T.Vector3());this.world.camera.position.copy(this.camera.position).sub(origin).add(new T.Vector3(s.x,s.y-1.3,0));this.world.camera.quaternion.copy(this.camera.quaternion);this.world.camera.fov=this.camera.fov;this.world.camera.updateProjectionMatrix();}
 render(){
  const r=this.renderer;if(this.usingWorld){this.world.render();return;}
  if(this.active!==this.stairs){r.render(this.active,this.camera);return;}
  const size=r.getSize(new T.Vector2()),h=Math.min(size.y,size.x*16/9),w=h*9/16,x=(size.x-w)/2,y=(size.y-h)/2;
  r.setClearColor('#111714');r.clear();r.setViewport(x,y,w,h);r.setScissor(x,y,w,h);r.setScissorTest(true);r.render(this.active,this.camera);r.setScissorTest(false);r.setViewport(0,0,size.x,size.y);
 }
}

