import * as T from './vendor/three.module.js';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function addMorph(mesh,key,warp){
 mesh.geometry=mesh.geometry.clone();const geo=mesh.geometry,base=geo.attributes.position,target=base.clone();
 for(let i=0;i<base.count;i++){const x=base.getX(i)+mesh.position.x,y=base.getY(i)+mesh.position.y,z=base.getZ(i)+mesh.position.z,p=warp(x,y,z);target.setXYZ(i,p[0]-mesh.position.x,p[1]-mesh.position.y,p[2]-mesh.position.z);}
 const temp=new T.BufferGeometry();temp.setAttribute('position',target);if(geo.index)temp.setIndex(geo.index);temp.computeVertexNormals();
 const positions=geo.morphAttributes.position??[],normals=geo.morphAttributes.normal??[];mesh.userData[key]=positions.length;geo.morphAttributes.position=[...positions,target];geo.morphAttributes.normal=[...normals,temp.attributes.normal];mesh.updateMorphTargets();mesh.frustumCulled=false;
}
function apply(model,key,t){model.traverse(o=>{if(o.userData[key]!==undefined)o.morphTargetInfluences[o.userData[key]]=t;});}
export function setupSlidePose(model){for(const name of ['Body','Tail'])addMorph(model.getObjectByName(name),'slide',(x,y,z)=>{const a=smooth((2.35-y)/1.8)*1.55,dy=y-2.05;return[x*Math.cos(a)-dy*Math.sin(a),2.05+x*Math.sin(a)+dy*Math.cos(a),z];});}
export const applySlidePose=(model,t)=>apply(model,'slide',t);
const bodyWidth=y=>.72+.52*smooth((y-1.2)/1.65);
const profile=[[.78,.03,.03],[1,.46,.30],[1.35,.70,.43],[1.75,.79,.49],[2.08,.69,.44],[2.4,.55,.36],[2.7,.54,.36],[3,.53,.36],[3.2,.40,.27],[3.35,.015,.015]];
function front(x,y){let i=1;while(i<profile.length-1&&profile[i][0]<y)i++;const a=profile[i-1],b=profile[i],t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0]))),rx=a[1]+(b[1]-a[1])*t,rz=a[2]+(b[2]-a[2])*t;return rz*Math.sqrt(Math.max(.01,1-(x/rx)**2));}
export function swapPoint(name,x,y,z){
 if(name==='Body'){
  const u=smooth((1.3-y)/1.2),w=bodyWidth(y);
  return[x*(w+1.05*u),y+.23*u+.13*u*(x/.8)**2,z*(1-.35*u)];
 }
 if(name.endsWith('Ear')){const side=x<0?-1:1;return[side*.43+(x-side*.94)*.4,3.58+(y-3.65)*.56,z*1.15];}
 if(name.endsWith('Arm')||name==='Tail')return[-x,4-y,z];
 const tx=-x*.82,ty=4.18-y;
 return[tx,ty,front(tx/bodyWidth(ty),ty)+z-front(x,y)+.045];
}
// The same ear vertices become feet; the original feet expand into the new ears.
// Face vertices migrate to the opposite end while the body stays inverted.
export function setupSwapPose(model){for(const name of ['Body','LeftEar','RightEar','LeftArm','RightArm','Tail','ConnectedWhiteFace','Smile','Eye-1','Eye1','Nose']){const mesh=model.getObjectByName(name);if(mesh)addMorph(mesh,'swap',(x,y,z)=>swapPoint(name,x,y,z));}const bridge=new T.Mesh(new T.SphereGeometry(1,24,16),model.getObjectByName('Body').material);bridge.name='SwapBridge';bridge.position.set(0,.76,-.13);bridge.scale.setScalar(0);model.add(bridge);}
export function applySwapPose(model,t){apply(model,'swap',t);model.getObjectByName('SwapBridge')?.scale.set(.21*t,.32*t,.15*t);}
