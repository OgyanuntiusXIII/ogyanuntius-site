import * as T from './vendor/three.module.js';
import {makeLandmark} from './landmarks.js';
import {ROUTE} from './journey.js';
import {applySlidePose} from './rig.js';
const box=new T.BoxGeometry(1,1,1),ball=new T.SphereGeometry(1,16,12);
const mat=(color,metalness=0)=>new T.MeshStandardMaterial({color,metalness,roughness:.42});
const glow=color=>new T.MeshBasicMaterial({color});
function part(parent,geo,material,x,y,z,sx=1,sy=sx,sz=sx){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
function sign(parent,text,y,w,size=95){const c=document.createElement('canvas');c.width=1536;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#fff5c1';ctx.font=`900 ${size}px "Yu Gothic", sans-serif`;ctx.textAlign='center';ctx.fillText(text,768,128);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return part(parent,new T.PlaneGeometry(w,w/8),new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}),0,y,-7);}
export class Finale{
 constructor(source){
  this.scene=new T.Scene();this.scene.background=new T.Color('#383459');this.scene.fog=new T.Fog('#383459',90,160);this.scene.add(new T.HemisphereLight('#ffdca5','#57567b',2.6));const sun=new T.DirectionalLight('#fff1c4',3);sun.position.set(-6,12,14);this.scene.add(sun);
  part(this.scene,box,mat('#50756b'),0,-.4,-30,140,.8,170);part(this.scene,ball,glow('#ffd489'),-30,21,-90,15);
  const kaimon=makeLandmark(ROUTE.length-1);kaimon.position.set(29,0,-70);kaimon.scale.setScalar(1.4);this.scene.add(kaimon);
  const gold=mat('#f4c258',.65),cream=mat('#f7edc9');part(this.scene,new T.CylinderGeometry(5.2,6,.75,64),gold,0,.4,0);part(this.scene,new T.CylinderGeometry(4.7,5.2,.22,64),cream,0,.89,0);
  for(const x of[-7,7]){part(this.scene,box,gold,x,6,-5,.7,12,.7);part(this.scene,box,cream,x,1,-5,1.7,2,1.7);}part(this.scene,box,gold,0,12,-5,15,.6,.6);
  this.headline=sign(this.scene,'日本縦断',10.5,14,115);sign(this.scene,'稚内 → 西大山',8.5,9,72);sign(this.scene,`${ROUTE.length} / ${ROUTE.length}`,7,5,85);
  this.actor=source.clone(true);this.actor.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.emissive)o.material.emissiveIntensity=0;if(o.geometry.type==='TorusGeometry')o.visible=false;}});applySlidePose(this.actor,0);this.actor.scale.setScalar(1.2);this.actor.getObjectByName('Guitar')?.removeFromParent();this.scene.add(this.actor);
  this.actor.visible=true;this.actor.traverse(o=>{if(o.material?.name==='Reference violet')o.material.color.set('#a13df1');});for(const name of['LeftArm','RightArm','LeftEar','RightEar']){const limb=this.actor.getObjectByName(name);limb.scale.setScalar(1);limb.rotation.set(0,0,0);}
  this.crown=new T.Group();part(this.crown,new T.CylinderGeometry(.9,.8,.4,32),gold,0,0,0);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;part(this.crown,new T.ConeGeometry(.25,.8,5),gold,Math.sin(a)*.75,.4,Math.cos(a)*.75);part(this.crown,ball,glow(i%2?'#a3f4dc':'#ee9ece'),Math.sin(a)*.75,.8,Math.cos(a)*.75,.12);}this.scene.add(this.crown);
  this.ribbon=[-1,1].map(side=>part(this.scene,box,mat('#edb2cf'),side*3,3,2,6,.55,.08));
  this.lamps=[];for(let i=0;i<ROUTE.length;i++){const a=i*Math.PI*2/ROUTE.length,m=part(this.scene,ball,glow(new T.Color().setHSL(i/ROUTE.length,.8,.7)),Math.sin(a)*6.5,1.2,Math.cos(a)*6.5,.15);this.lamps.push(m);}
  for(let i=0;i<44;i++){const x=(i%2?1:-1)*(9+i%6*2),z=-8-Math.floor(i/2)*2;part(this.scene,ball,glow('#ffe598'),x,.5,z,.5,.28,.5);}
  // One instanced confetti draw and one firework line draw, with a deterministic timeline.
  this.dummy=new T.Object3D();this.confetti=new T.InstancedMesh(new T.PlaneGeometry(.12,.24),new T.MeshBasicMaterial({color:'#fff',side:T.DoubleSide}),420);this.confetti.frustumCulled=false;for(let i=0;i<420;i++)this.confetti.setColorAt(i,new T.Color().setHSL((i*.618)%1,.85,.65));this.scene.add(this.confetti);
  this.positions=new Float32Array(5*40*6);this.colors=new Float32Array(this.positions.length);for(let i=0;i<200;i++){const c=new T.Color().setHSL(Math.floor(i/40)/5,.8,.7);c.toArray(this.colors,i*6);c.toArray(this.colors,i*6+3);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(this.positions,3));geo.setAttribute('color',new T.BufferAttribute(this.colors,3));this.fireworks=new T.LineSegments(geo,new T.LineBasicMaterial({vertexColors:true}));this.fireworks.frustumCulled=false;this.scene.add(this.fireworks);
 }
 update(t,camera,reduced=false){
  const arrive=Math.min(1,t/1.2),ease=1-(1-arrive)**3;this.actor.position.set(0,1,12*(1-ease));this.actor.rotation.set(-.15*(1-ease),-.25,0);this.actor.getObjectByName('LeftArm').rotation.z=.12;this.actor.getObjectByName('RightArm').rotation.z=-.12;
  this.crown.position.set(0,6.3+Math.max(0,1-(t-1.2))*4,0);this.crown.visible=t>=1.2;this.crown.rotation.y=reduced?0:t*.35;
  this.ribbon.forEach((m,i)=>{const side=i?1:-1,u=Math.max(0,Math.min(1,(t-.65)/.75));m.position.set(side*(3+u*5),3-u*1.8,2-u*2);m.rotation.z=-side*u*.6;m.scale.x=6*(1-u*.45);m.visible=t<2;});
  this.headline.scale.setScalar(t<1?0:Math.min(1,(t-1)*3));this.lamps.forEach((m,i)=>m.visible=t>i*.025);
  for(let i=0;i<420;i++){const age=Math.max(0,t-.8),x=Math.sin(i*13.371)*11,y=15-((i*.037+age*(reduced?.5:3.5))%15),z=Math.cos(i*7.12)*9-3;this.dummy.position.set(x+Math.sin(age+i)*.8,y,z);this.dummy.rotation.set(age*1.5+i,age+i,age*2);this.dummy.scale.setScalar(t>.8&&(!reduced||i<60)?1:0);this.dummy.updateMatrix();this.confetti.setMatrixAt(i,this.dummy.matrix);}this.confetti.instanceMatrix.needsUpdate=true;
  for(let j=0;j<5;j++)for(let i=0;i<40;i++){const age=Math.max(0,(t-1.2-j*.23)%2.1),radius=age<1.3?Math.sin(age/1.3*Math.PI/2)*6:0,a=i*Math.PI*2/40,cx=(j-2)*9,cy=14+(j%2)*5,k=(j*40+i)*6;this.positions.set([cx+Math.cos(a)*radius,cy+Math.sin(a)*radius-age*1.5,-14,cx+Math.cos(a)*radius*.82,cy+Math.sin(a)*radius*.82-age*1.5,-14],k);}this.fireworks.geometry.attributes.position.needsUpdate=true;this.fireworks.visible=t>1.2&&!reduced;
  camera.position.set(0,6,innerWidth/innerHeight<1?31:24);camera.lookAt(0,6,-3);camera.fov=innerWidth/innerHeight<1?57:50;camera.updateProjectionMatrix();
 }
}
