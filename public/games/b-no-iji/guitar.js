import * as T from './vendor/three.module.js';
const box=new T.BoxGeometry(1,1,1),ball=new T.SphereGeometry(1,24,16);
const material=(color,metalness=0,roughness=.6)=>new T.MeshStandardMaterial({color,metalness,roughness});
const glow=color=>new T.MeshBasicMaterial({color});
function part(parent,geo,mat,pos,scale=[1,1,1]){const obj=new T.Mesh(geo,mat);obj.position.set(...pos);obj.scale.set(...scale);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;}
function beam(parent,a,b,r,mat){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);const m=part(parent,new T.CylinderGeometry(r,r,delta.length(),8),mat,[...start.add(end).multiplyScalar(.5)]);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;}
export function handAt(arm,x,y,z){const rest=new T.Vector3(arm.position.x<0?-.63:.63,-1.21,.1),target=new T.Vector3(x,y,z).sub(arm.position);arm.scale.setScalar(target.length()/rest.length());arm.quaternion.setFromUnitVectors(rest.normalize(),target.normalize());}

export function createGuitar(){
  // A shallow extruded acoustic body, sound hole, bridge, frets and six strings.
  const guitar=new T.Group();guitar.name='Guitar';const shape=new T.Shape();shape.moveTo(0,-.8);shape.bezierCurveTo(-1.0,-.83,-1.05,-.1,-.55,.14);shape.bezierCurveTo(-.20,.36,-.9,.86,-.45,1.02);shape.bezierCurveTo(-.16,1.17,.16,1.17,.45,1.02);shape.bezierCurveTo(.9,.86,.20,.36,.55,.14);shape.bezierCurveTo(1.05,-.1,1,-.83,0,-.8);
  const geo=new T.ExtrudeGeometry(shape,{depth:.23,bevelEnabled:true,bevelSize:.055,bevelThickness:.045,bevelSegments:3,steps:1,curveSegments:20});
  part(guitar,geo,material('#b28b59',.05,.4),[0,0,0]);part(guitar,new T.CircleGeometry(.24,40),material('#211d1a'),[0,.44,.285]);part(guitar,new T.TorusGeometry(.26,.015,6,40),material('#e4c99a'),[0,.44,.289]);
  part(guitar,box,material('#392921'),[0,1.65,.16],[.27,1.6,.12]);part(guitar,box,material('#785333'),[0,2.55,.14],[.41,.48,.18]);part(guitar,box,material('#382b24'),[0,-.31,.31],[.65,.13,.08]);
  for(let i=0;i<13;i++)part(guitar,box,material('#a9a6a0',.8),[0,.88+i*.115,.23],[.28,.012,.012]);for(let i=0;i<6;i++){const x=(i-2.5)*.037;beam(guitar,[x,-.36,.36],[x,2.65,.25],.004,glow('#d2c9b9'));part(guitar,ball,material('#c4c4c2',.8),[(i%2?1:-1)*.25,2.4+Math.floor(i/2)*.14,.14],[.07,.045,.04]);}
  guitar.rotation.z=-1.22;guitar.position.set(-.20,1.38,.65);guitar.scale.setScalar(.7);return guitar;
}
export function guitarRig(model){const guitar=createGuitar();guitar.visible=false;model.add(guitar);return{guitar,left:model.getObjectByName('LeftArm'),right:model.getObjectByName('RightArm')};}
export function strumPose(rig,time,lastTap=null,hits=0){const age=time-lastTap,wave=lastTap===null?Math.sin(time*Math.PI*(172/60*4)):age>=0&&age<.16?Math.sin(age/.16*Math.PI*2)*(hits%2?1:-1):0;handAt(rig.left,.08+wave*.06,1.5+wave*.24,.90);handAt(rig.right,1.02,1.79,.91);rig.guitar.rotation.x=wave*.035;}
