import * as T from './vendor/three.module.js';
const palette={perfect:'#fff18d',chain:'#ffb83c',near:'#83f4ed',demolition:'#8ffa95',station:'#ffc8fa',region:'#a8d9ff',record:'#ffd259',final:'#fff291',strum:'#da98ff'};
export class CelebrationView{
 constructor(scene){
  this.group=new T.Group();scene.add(this.group);this.dummy=new T.Object3D();this.color=new T.Color();this.cursor=0;this.arcCursor=0;
  this.data=Array.from({length:320},()=>({life:0}));this.arcs=Array.from({length:12},()=>({life:0}));
  this.bits=new T.InstancedMesh(new T.PlaneGeometry(.16,.3),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,depthWrite:false}),this.data.length);
  this.hoops=new T.InstancedMesh(new T.TorusGeometry(1,.035,4,48),new T.MeshBasicMaterial({color:'#ffffff',depthWrite:false}),this.arcs.length);
  this.bits.frustumCulled=false;this.hoops.frustumCulled=false;this.group.add(this.bits,this.hoops);this.reset();
 }
 reset(){for(const p of this.data)p.life=0;for(const a of this.arcs)a.life=0;this.update(0);}
 emit(kind,s,reduced=false){
  const color=palette[kind]??palette.perfect,station=['station','region','record','final'].includes(kind),count=reduced?4:kind==='strum'?8:station?68:28;
  for(let i=0;i<count;i++){const n=this.cursor++%this.data.length,a=i*2.399963,p=this.data[n];Object.assign(p,{life:station?1.65:.7,total:station?1.65:.7,x:s.x,y:s.y+.4,z:-1,vx:Math.cos(a)*(station?10:4),vy:Math.sin(a)*(station?10:4)+3,vz:station?-5:2,spin:a,kind});this.bits.setColorAt(n,this.color.set(color));}
  const n=this.arcCursor++%this.arcs.length;Object.assign(this.arcs[n],{life:reduced?.3:.6,x:s.x,y:s.y+.4,z:-1,kind});this.hoops.setColorAt(n,this.color.set(color));
  this.bits.instanceColor.needsUpdate=true;this.hoops.instanceColor.needsUpdate=true;
 }
 update(dt){
  for(let i=0;i<this.data.length;i++){const p=this.data[i];p.life=Math.max(0,p.life-dt);if(p.life){p.vy-=dt*6;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.spin+p.life*3,p.life*2,p.spin);this.dummy.scale.setScalar(Math.min(1,p.life/.25));}else this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.bits.setMatrixAt(i,this.dummy.matrix);}
  for(let i=0;i<this.arcs.length;i++){const a=this.arcs[i];a.life=Math.max(0,a.life-dt);this.dummy.rotation.set(0,0,0);this.dummy.position.set(a.x??0,a.y??0,a.z??0);const size=a.life?1.5+(1-a.life/.6)*3:0;this.dummy.scale.set(size*(a.kind==='near'?1.7:1),size,Math.min(1,a.life*4));this.dummy.updateMatrix();this.hoops.setMatrixAt(i,this.dummy.matrix);}
  this.bits.instanceMatrix.needsUpdate=true;this.hoops.instanceMatrix.needsUpdate=true;this.group.visible=this.data.some(p=>p.life>0)||this.arcs.some(p=>p.life>0);
 }
}
