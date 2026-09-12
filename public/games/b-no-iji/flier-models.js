import * as T from './vendor/three.module.js';
// The two rivals that fly in from the far end: the little penguin and the orange squirrel. Both face +z, toward the player.
const ball=new T.SphereGeometry(1,20,14);
const mats=new Map();
function mat(color,roughness=.6){const k=color+roughness;if(!mats.has(k))mats.set(k,new T.MeshStandardMaterial({color,roughness}));return mats.get(k);}
function part(g,geo,material,x,y,z,sx=1,sy=sx,sz=sx){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m;}
export function makePenguin(){
 const g=new T.Group();g.name='Penguin';
 const black=mat('#202124',.55),white=mat('#f7f7f4',.7),orange=mat('#f39a2b',.5);
 part(g,ball,black,0,.74,0,.52,.74,.5);
 part(g,ball,white,0,.6,.2,.36,.5,.32);
 for(const s of[-1,1]){part(g,ball,white,s*.18,1.08,.4,.12,.14,.08);part(g,ball,black,s*.19,1.08,.47,.05,.06,.03);}
 const beak=part(g,new T.ConeGeometry(.09,.24,10),orange,0,.94,.56);beak.rotation.x=Math.PI/2;
 for(const s of[-1,1])part(g,ball,orange,s*.2,.04,.12,.18,.06,.24);
 for(const s of[-1,1]){const pivot=new T.Group();pivot.name=s<0?'WingL':'WingR';pivot.position.set(s*.44,.92,0);part(pivot,ball,black,s*.22,-.22,0,.1,.38,.16);g.add(pivot);}
 g.userData.kind='penguin';return g;
}
export function makeSquirrel(){
 const g=new T.Group();g.name='Squirrel';
 const fur=mat('#f0873a',.65),cream=mat('#f9c58f',.7),black=mat('#1c1b1b',.5),white=mat('#ffffff',.6),pink=mat('#f2969b',.7);
 part(g,ball,fur,0,.62,0,.46,.56,.42);
 part(g,ball,cream,0,.55,.22,.3,.4,.24);
 part(g,ball,fur,0,1.3,.05,.56,.5,.5);
 part(g,ball,black,0,1.7,.05,.14,.2,.34);
 for(const s of[-1,1]){
  part(g,ball,fur,s*.42,1.64,-.02,.15,.2,.12);
  part(g,ball,black,s*.22,1.36,.48,.13,.17,.08);
  part(g,ball,white,s*.19,1.41,.55,.04,.05,.02);
  part(g,ball,pink,s*.36,1.17,.42,.09,.06,.05);
  const arm=part(g,new T.CapsuleGeometry(.09,.36,4,8),fur,s*.62,.88,.05);arm.rotation.z=s*1.25;
  part(g,ball,fur,s*.2,.1,.12,.17,.08,.22);
 }
 part(g,ball,black,0,1.2,.56,.06,.05,.04);
 const smile=part(g,new T.TorusGeometry(.12,.025,6,16,Math.PI),black,0,1.14,.55);smile.rotation.z=Math.PI;smile.rotation.x=.2;
 const curve=new T.CatmullRomCurve3([new T.Vector3(.1,.25,-.35),new T.Vector3(.45,.35,-.55),new T.Vector3(.7,.9,-.55),new T.Vector3(.55,1.5,-.45),new T.Vector3(.2,1.75,-.4)]);
 const tail=part(g,new T.TubeGeometry(curve,16,.22,8,false),fur,0,0,0);tail.name='Tail';
 part(g,ball,black,.2,1.75,-.4,.26,.26,.26);
 g.userData.kind='squirrel';return g;
}
// Built at unit size, then scaled to match FLIER_SIZE (penguin about 1.9 tall, squirrel about 2.4).
export function makeFlier(kind){const g=kind==='squirrel'?makeSquirrel():makePenguin();g.scale.setScalar(kind==='squirrel'?1.25:1.28);return g;}
// Bob and flap; the hit box never moves with this.
export function animateFlier(obj,f,time){
 const beat=time*(f.kind==='penguin'?24:11)+f.serial;
 obj.position.y+=Math.sin(beat*.5)*.12;obj.rotation.set(f.kind==='penguin'?-.25:-.1,0,Math.sin(beat*.5)*(f.kind==='penguin'?.08:.12));
 ['WingL','WingR'].forEach((name,i)=>{const w=obj.getObjectByName(name);if(w)w.rotation.z=(i?-1:1)*(.45+Math.sin(beat)*.5);});
 const tail=obj.getObjectByName('Tail');if(tail)tail.rotation.y=Math.sin(beat*.5)*.25;
}
