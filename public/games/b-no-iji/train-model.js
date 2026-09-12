import * as T from './vendor/three.module.js';
const box=new T.BoxGeometry(1,1,1);
const metal=new T.MeshStandardMaterial({color:'#d8e1e3',metalness:.65,roughness:.3});
const dark=new T.MeshStandardMaterial({color:'#243742',metalness:.5,roughness:.26});
const glass=new T.MeshStandardMaterial({color:'#102e42',metalness:.65,roughness:.12});
const stripe=new T.MeshStandardMaterial({color:'#80c342',metalness:.25,roughness:.4});
const lamp=new T.MeshBasicMaterial({color:'#fff4bd'});
function part(g,material,x,y,z,w,h,d){const m=new T.Mesh(box,material);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;g.add(m);return m;}
export function makeExpress(){
 const train=new T.Group();
 for(let i=0;i<3;i++){
  const car=new T.Group();car.position.z=-i*15;train.add(car);
  part(car,dark,0,1.1,0,4.9,1.2,13.8);part(car,metal,0,3.7,0,5.2,4.5,14);part(car,dark,0,6,0,4.5,.32,13.7);
  part(car,stripe,0,2.2,.02,5.24,.55,14.06);
  for(const side of [-1,1]){
   for(let j=0;j<6;j++){part(car,glass,side*2.615,4.1,5.2-j*2.05,.035,1.6,1.5);part(car,metal,side*2.64,3.05,5.2-j*2.05,.04,.16,1.5);}
   for(const z of [-4.5,4.5]){const wheel=new T.Mesh(new T.CylinderGeometry(.7,.7,.35,16),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(side*2.15,.72,z);car.add(wheel);}
  }
  part(car,dark,0,2,-7.35,2,.5,.9);part(car,dark,0,6.35,0,2.7,.5,4.2);
  if(i===0){
   part(car,glass,0,4.25,7.04,4.45,2,.09);part(car,metal,0,4.25,7.12,.12,2,.08);
   for(const x of [-1.6,1.6]){part(car,dark,x,2.85,7.08,1,.65,.16);part(car,lamp,x,2.9,7.2,.78,.28,.09);}
   part(car,stripe,0,5.72,7.1,2.6,.35,.05);part(car,lamp,0,5.72,7.14,1.65,.13,.02);
   for(const x of [-1.1,1.1]){const wiper=part(car,dark,x,3.8,7.17,1.25,.055,.055);wiper.rotation.z=.2;}
   part(car,dark,0,1.75,7.22,4.8,.36,.5);part(car,metal,0,1.1,7.45,1.2,.4,.8);
  }
 }
 train.visible=false;return train;
}
