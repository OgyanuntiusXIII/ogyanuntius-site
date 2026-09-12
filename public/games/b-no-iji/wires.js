import * as T from './vendor/three.module.js';
import {CEILING_Y,SIDE_LIMIT} from './flight.js';
const metal=new T.MeshStandardMaterial({color:'#637572',metalness:.65,roughness:.48});
const porcelain=new T.MeshStandardMaterial({color:'#d2cfc1',roughness:.36});
const box=new T.BoxGeometry(1,1,1),spacing=44;
function beam(g,x,y,z,w,h,d){const m=new T.Mesh(box,metal);m.position.set(x,y,z);m.scale.set(w,h,d);g.add(m);}
function cable(points,material,r=.015){return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,r,4,false),material);}
export function makeWires(){
 const group=new T.Group(),wire=new T.MeshStandardMaterial({color:'#677971',metalness:.45,roughness:.65}),warning=new T.MeshBasicMaterial({color:'#edb767'});
 for(let i=0;i<9;i++){
  const span=new T.Group();span.position.z=-i*spacing;group.add(span);
  for(const sign of [-1,1]){
   const x=sign*(SIDE_LIMIT+.3);beam(span,x,6.25,0,.17,12.5,.2);beam(span,sign*(SIDE_LIMIT-.65),11.55,0,2.3,.14,.17);
   for(const y of [2.6,6.8,11.2]){
    beam(span,sign*(SIDE_LIMIT+.12),y,0,.5,.07,.07);
    const insulator=new T.Mesh(new T.CylinderGeometry(.14,.14,.35,8,3),porcelain);insulator.rotation.z=Math.PI/2;insulator.position.set(sign*(SIDE_LIMIT+.1),y,0);span.add(insulator);
    const points=Array.from({length:7},(_,n)=>{const u=n/6;return new T.Vector3(sign*SIDE_LIMIT,y-Math.sin(u*Math.PI)*.30,-u*spacing);});span.add(cable(points,wire));
   }
   const cap=new T.Mesh(new T.SphereGeometry(.14,8,6),warning);cap.position.set(x,11.8,0);span.add(cap);
  }
  // Catenary has its lowest point exactly at the ceiling, so the visible limit never intrudes into the course.
  span.add(cable(Array.from({length:13},(_,n)=>{const x=(n/12*2-1)*SIDE_LIMIT;return new T.Vector3(x,CEILING_Y+1.05*(x/SIDE_LIMIT)**2,0);}),wire,.022));
  for(const x of [-3,3])span.add(cable(Array.from({length:7},(_,n)=>{const u=n/6;return new T.Vector3(x,CEILING_Y+.22+.3*(1-Math.sin(u*Math.PI)),-u*spacing);}),wire,.014));
 }
 // Merge by material so the overhead wires add only four draw calls.
 group.updateMatrixWorld(true);const batches=new Map();group.traverse(o=>{if(o.isMesh){const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geo);}});group.clear();
 for(const [material,geos] of batches){const g=new T.BufferGeometry();for(const name of ['position','normal']){const size=geos.reduce((n,g)=>n+g.attributes[name].array.length,0),data=new Float32Array(size);let offset=0;for(const geo of geos){data.set(geo.attributes[name].array,offset);offset+=geo.attributes[name].array.length;}g.setAttribute(name,new T.BufferAttribute(data,3));}g.computeBoundingSphere();group.add(new T.Mesh(g,material));geos.forEach(g=>g.dispose());}
 return {group,wire,warning,update(travel,danger,visible){group.visible=visible;group.position.z=travel%spacing+spacing;wire.emissive.set('#a74512');wire.emissiveIntensity=Math.max(0,danger)*.45;warning.color.set(danger>.5?'#ff6c3d':'#edb767');}};
}
