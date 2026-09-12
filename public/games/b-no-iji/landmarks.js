import * as T from './vendor/three.module.js';
import {DISTRICTS} from './districts.js';
const cube=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,16,10);
const mats=new Map();
function mat(color,metalness=0){const k=color+metalness;if(!mats.has(k))mats.set(k,new T.MeshStandardMaterial({color,metalness,roughness:metalness?.35:.78}));return mats.get(k);}
function part(g,geo,c,x,y,z,sx=1,sy=sx,sz=sx){const m=new T.Mesh(geo,typeof c==='string'?mat(c):c);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
const box=(g,c,x,y,z,sx,sy,sz)=>part(g,cube,c,x,y,z,sx,sy,sz);
function beam(g,c,a,b,r=.15){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va),m=part(g,new T.CylinderGeometry(r,r,d.length(),8),c,...va.add(vb).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
function roof(g,c,y,w,d){const geo=new T.CylinderGeometry(.68,1,1,4,1);const m=part(g,geo,c,0,y,0,w*.72,1.35,d*.72);m.rotation.y=Math.PI/4;return m;}
function windows(g,x,y,z,w,h,count=6){for(let i=0;i<count;i++)box(g,'#a4cbd4',x+(i-(count-1)/2)*w/count,y,z,w/count*.55,h,.07);}
function castle(g,kind){const black=['castle-black','castle-twin'].includes(kind),body=black?'#27393e':'#f1ede0',tiles=kind==='castle-gold'?'#548d7e':'#45565a';box(g,'#8c9185',0,2,0,18,4,14);
 const floors=kind==='castle-odawara'?3:kind==='castle-himeji'?5:4;
 for(let i=0;i<floors;i++){const w=15-i*2.25,d=12-i*1.65,y=5.5+i*3.3;box(g,body,0,y,0,w,3,d);box(g,'#eeeadd',0,y+.85,0,w+.15,.35,d+.15);windows(g,0,y, d/2+.06,w,1,Math.max(2,7-i));roof(g,tiles,y+2,w+3,d+3);}
 if(kind==='castle-himeji')for(const x of [-13,13]){const wing=new T.Group();wing.position.set(x,0,4);box(wing,body,0,5,0,7,8,7);roof(wing,tiles,10,10,10);roof(wing,tiles,6,11,11);g.add(wing);box(g,body,x/2,2.8,7,14,3,3);}
 if(kind==='castle-fukuyama')box(g,'#27393e',0,10,-6.08,15,14,.2);
 if(kind==='castle-kokura'){box(g,'#7eb9bc',0,-.15,0,35,.2,32);roof(g,tiles,16,14,12);}
 for(const sign of[-1,1]){const fish=part(g,sphere,mat('#f1c655',.5),sign*2.2,19,0,.45,1,.28);fish.rotation.z=-sign*.4;part(g,new T.ConeGeometry(.5,1,5),mat('#f1c655',.5),sign*2.5,19.8,0).rotation.z=sign*.8;}
 if(kind==='castle-twin'){const wing=new T.Group();g.add(wing);box(wing,'#28383a',0,4,0,7,8,7);roof(wing,'#333a3e',9,10,10);roof(wing,'#333a3e',6,11,11);wing.position.set(13,0,2);}
}
function lattice(g,color,height=40){const levels=8,foot=6;for(let j=0;j<levels;j++){const y=j*height/levels,y2=(j+1)*height/levels,a=foot*(1-j/levels)*.85+1,b=foot*(1-(j+1)/levels)*.85+1;for(const side of[-1,1])for(const axis of[0,1]){const A=axis?[side*a,y,-a]:[-a,y,side*a],B=axis?[side*b,y2,b]:[b,y2,side*b];beam(g,color,A,B,.13);beam(g,color,axis?[side*a,y,a]:[a,y,side*a],axis?[side*b,y2,-b]:[-b,y2,side*b],.13);}for(const x of[-1,1])for(const z of[-1,1])beam(g,j>5?'#f2eee5':color,[x*a,y,z*a],[x*b,y2,z*b],.3);}}
export function makeLandmark(index){const info=DISTRICTS[index],g=new T.Group();g.name=info.landmark;const k=info.kind;
 if(k.startsWith('castle'))castle(g,k);
 else if(k==='dome'){
  const s=new T.Shape();s.absarc(0,6,7,Math.PI,0,true);s.lineTo(6.5,6);s.absarc(0,6,6.5,0,Math.PI,false);s.closePath();part(g,new T.ExtrudeGeometry(s,{depth:54,bevelEnabled:false,curveSegments:24}),'#dddcd0',0,0,-27);
  box(g,'#c5c6ba',-6.7,3,0,.6,6,54);for(let z=-27;z<=27;z+=4.5){part(g,new T.CylinderGeometry(.43,.6,6,12),'#eeeadd',6.3,3,z);box(g,'#e5e1d3',6.3,5.8,z,1.3,.5,1.3);}box(g,'#c7cabf',0,.15,0,15,.3,58);
 }else if(k==='bridge'){
  box(g,'#77b3c1',0,-.1,0,45,.2,65);box(g,'#6f8188',0,2,0,12,.6,50);
  for(const x of[-5,5]){const pts=[];for(let i=0;i<=20;i++)pts.push(new T.Vector3(x,3+Math.sin(i/20*Math.PI)*12,-25+i*2.5));part(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),40,.28,8,false),'#577d71',0,0,0);for(let i=1;i<12;i++){const z=-25+i*50/12,y=3+Math.sin(i/12*Math.PI)*12;beam(g,'#748e7b',[x,2,z],[x,y,z],.15);if(i<11)beam(g,'#688578',[x,3+Math.sin((i+1)/12*Math.PI)*12,z+50/12],[x,2,z],.1);}}
 }else if(k==='tv'){
  lattice(g,'#bb5944',33);box(g,'#eae7d2',0,24,0,7,4.5,6);for(const z of[-3.04,3.04])windows(g,0,24,z,6,2.5,5);box(g,'#b96b4c',0,13,0,9,3,7);box(g,'#343d43',0,13,3.6,6,2,.1);beam(g,'#edeadd',[0,33,0],[0,46,0],.24);
 }else if(k==='star'){
  const shape=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?10:22,x=Math.sin(a)*r,y=Math.cos(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();const moat=part(g,new T.ShapeGeometry(shape),'#68afc0',0,.08,0,1.15,1.15,1.15);moat.rotation.x=-Math.PI/2;const fort=part(g,new T.ExtrudeGeometry(shape,{depth:.7,bevelEnabled:false}),'#87af77',0,.9,0);fort.rotation.x=-Math.PI/2;box(g,'#f1eedf',0,2.5,0,8,3,5);roof(g,'#536e69',4.6,11,8);box(g,'#dbe6df',18,15,10,2,30,2);part(g,new T.CylinderGeometry(5,3.5,4,5),'#b7d9d8',18,31,10);
 }else if(k==='triangle'){
  const shape=new T.Shape();shape.moveTo(-14,0);shape.lineTo(0,32);shape.lineTo(14,0);shape.closePath();part(g,new T.ExtrudeGeometry(shape,{depth:9,bevelEnabled:false}),mat('#a6c2cf',.5),0,0,-4.5);for(let y=2;y<30;y+=2){const w=28*(1-y/32);box(g,'#dae4e5',0,y,4.57,w,.18,.08);windows(g,0,y-.7,4.6,w,1,Math.max(1,Math.floor(w/2)));}
 }else if(k==='brick'){
  box(g,'#b16650',0,5,0,25,10,9);for(let y=1;y<=9;y+=2)box(g,'#e7dac3',0,y,0,25.1,.25,9.1);for(let x=-11;x<=11;x+=3){box(g,'#e1d9bf',x,5,4.6,.42,9,.25);for(const y of[3,7]){box(g,'#34494c',x+1.25,y,4.57,1.4,2.1,.1);part(g,new T.CircleGeometry(.7,12,0,Math.PI),'#dbcaae',x+1.25,y+1.1,4.65);}}roof(g,'#52656b',11,29,13);box(g,'#ab5f4a',-9,12,0,5,6,5);part(g,new T.ConeGeometry(4,5,4),'#465663',-9,17,0).rotation.y=Math.PI/4;
 }else if(k==='statue'){
  const bronze=mat('#456e62',.45);box(g,'#8a928b',0,2,0,10,4,7);part(g,sphere,bronze,0,6.6,0,3,1.2,1);beam(g,bronze,[2,6.5,0],[3,8.6,0],.75);part(g,sphere,bronze,3.4,8.5,0,1,.65,.55);for(const z of[-.7,.7]){beam(g,bronze,[-1.8,6,z],[-2.5,4,z],.28);beam(g,bronze,[1.5,6,z],[2.7,4.5,z],.27);}beam(g,bronze,[-3,6.5,0],[-3.8,4.2,0],.32);part(g,sphere,bronze,0,8.7,0,.65,1.5,.5);part(g,sphere,bronze,.2,10.7,0,.52,.6,.5);part(g,new T.TorusGeometry(.7,.09,6,24,Math.PI),bronze,.2,11,.45);beam(g,bronze,[.4,9,0],[1.9,8.1,.1],.18);
 }else if(k==='skytree'){
  part(g,new T.CylinderGeometry(1.1,4.5,43,12),mat('#cfdbe2',.45),0,21.5,0);for(let y=3;y<43;y+=2)part(g,new T.TorusGeometry(4.5-y/43*3.4,.09,4,20),'#f5efdf',0,y,0).rotation.x=Math.PI/2;for(const [y,r,h]of[[30,5,3],[40,3.5,2]]){part(g,new T.CylinderGeometry(r,r*.83,h,24),mat('#96b9cc',.45),0,y,0);part(g,new T.CylinderGeometry(r*1.06,r*1.06,.3,24),'#e8eeee',0,y+h/2,0);}beam(g,'#e9eff1',[0,43,0],[0,61,0],.4);
 }else if(k==='pagoda'||k==='garden-pagoda'){
  box(g,'#9b9d86',0,1,0,17,2,17);for(let i=0;i<5;i++){const w=13-i*1.6,y=3.5+i*4.1;box(g,'#735742',0,y,0,w,2.8,w);for(const x of[-.4,.4])for(const z of[-.4,.4])box(g,'#c0a477',x*w,y,z*w,.35,3,.35);roof(g,'#414d43',y+2,w+4,w+4);}beam(g,'#807e5b',[0,23,0],[0,32,0],.15);for(let y=25;y<30;y+=.55)part(g,new T.TorusGeometry(.7,.1,5,16),'#8c865d',0,y,0).rotation.x=Math.PI/2;
 }else if(k==='tsutenkaku'){
  lattice(g,'#aabfb1',22);box(g,'#85a891',0,25,0,8,7,8);windows(g,0,25,4.1,7,2.5,5);box(g,'#b6c9b8',0,30,0,10,2,10);box(g,'#48635e',0,18,3.2,2,10,.15);beam(g,'#d4e1cb',[0,31,0],[0,38,0],.35);for(let x=-14;x<=14;x+=7){box(g,x%2?'#cd9978':'#968797',x,5,8,5,10,7);box(g,'#f0d3ad',x,6,11.6,2.5,5,.1);}
 }else if(k==='torii'||k==='lake-torii'){
  box(g,'#76b9c6',0,-.1,0,55,.2,50);for(const x of[-7,7]){part(g,new T.CylinderGeometry(.8,1.15,14,12),'#c94b36',x,7,0);for(const z of[-3,3]){part(g,new T.CylinderGeometry(.42,.55,9,10),'#bf4c36',x,4.5,z);beam(g,'#b94a36',[x,8,-3.5],[x,8,3.5],.38);}}box(g,'#c14b35',0,11.2,0,21,1.3,1.2);box(g,'#b84631',0,14,0,25,1.4,2);for(const side of[-1,1]){const tip=box(g,'#333d35',side*10,15,0,7,.8,2.5);tip.rotation.z=side*.1;}box(g,'#333d35',0,14.8,0,14,.8,2.5);box(g,'#8f5c31',0,12.5,.7,2,2.5,.15);
 }else if(k==='glass'){
  part(g,new T.CylinderGeometry(3.4,6,42,3),mat('#85b5ca',.6),0,21,0).rotation.y=Math.PI;for(let y=2;y<42;y+=2)part(g,new T.CylinderGeometry(6-y*.06,6-y*.06,.16,3),'#dae4dc',0,y,0).rotation.y=Math.PI;beam(g,'#d4e3e6',[0,42,0],[0,54,0],.25);part(g,new T.CylinderGeometry(4.5,4.5,4,3),mat('#597e94',.5),0,36,0).rotation.y=Math.PI;
 }else if(k==='volcano'||k==='kaimon'){
  const geo=new T.ConeGeometry(k==='kaimon'?25:31,k==='kaimon'?33:26,40,12);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),noise=Math.sin(x*.6)*Math.cos(z*.42)*.8;pos.setY(i,y+noise*(k==='kaimon'?.3:1));}geo.computeVertexNormals();part(g,geo,k==='kaimon'?'#608863':'#7e8874',0,k==='kaimon'?16.5:13,0);if(k==='volcano'){part(g,new T.ConeGeometry(18,20,24,6),'#70836a',-15,10,-6);for(let i=0;i<5;i++)part(g,sphere,'#c5cdca',Math.sin(i)*2,26+i*3,-i*.8,2+i*.6,2+i,2+i*.6);}else for(let i=0;i<28;i++)part(g,sphere,'#e7d459',Math.sin(i*2.4)*27,.4,20+Math.cos(i*1.8)*7,.9,.3,.8);
 }else if(k==='observatory'){
  box(g,'#e9e5d7',0,3,0,19,6,12);windows(g,0,3,6.1,17,2,8);
  for(const [x,r]of[[-5,4.5],[6,3]]){part(g,new T.CylinderGeometry(r,r,2.2,24),'#d5dfe0',x,6.6,0);part(g,new T.SphereGeometry(r,24,12,0,Math.PI*2,0,Math.PI/2),mat('#b5ced5',.4),x,7.7,0);box(g,'#4e6d7b',x,9.3,r*.55,.65,3,.35);}
  box(g,'#9cae99',0,.1,0,28,.2,24);
 }else if(k==='canal'){
  box(g,'#699da6',0,-.1,0,13,.2,48);for(const x of[-11,11]){box(g,'#bcb8a2',x,.1,0,9,.3,48);for(let z=-17;z<22;z+=11){box(g,'#9b9b8d',x,3,z,7,6,9);const r=roof(g,'#755d53',6.5,9,11);r.position.x=x;r.position.z=z;windows(g,x,3,z+4.6,6,2,3);beam(g,'#37494a',[Math.sign(x)*7,0,z],[Math.sign(x)*7,5,z],.12);part(g,sphere,mat('#ffe2a2'),Math.sign(x)*7,5,z,.4,.6,.4);}}
 }else if(k==='lake'){
  part(g,new T.CylinderGeometry(27,27,.25,56),'#68b6c8',0,0,0);for(const[x,z,r,h]of[[0,0,10,9],[-9,5,6,5],[7,-5,5,4]])part(g,new T.ConeGeometry(r,h,20),'#6c9c6c',x,h/2,z);for(let i=0;i<10;i++)part(g,new T.ConeGeometry(3,6,8),'#668974',Math.cos(i)*25,3,Math.sin(i)*25);
 }else if(k==='island-shrine'){
  box(g,'#79bdc8',0,-.2,0,43,.2,39);part(g,new T.CylinderGeometry(10,17,8,16),'#85976b',0,4,0);box(g,'#c89964',0,10,0,12,5,9);roof(g,'#4e6568',13,16,13);for(let i=0;i<13;i++)box(g,'#b9b7aa',0,.4+i*.6,18-i*.8,4,.8,1);for(const x of[-2,2])beam(g,'#d87c47',[x,6,10],[x,10,10],.18);box(g,'#cf6944',0,10,10,6,.5,.5);for(let i=0;i<7;i++){const x=Math.sin(i*2)*15,y=12+i%3*2,z=Math.cos(i)*12;beam(g,'#fff6e3',[x-1,y+.3,z],[x,y,z],.09);beam(g,'#fff6e3',[x,y,z],[x+1,y+.3,z],.09);}
 }else if(k==='gold-temple'){
  box(g,'#94977b',0,.8,0,17,1.6,17);box(g,mat('#d1ad5d',.4),0,4,0,10,6,10);for(const x of[-5,-2,2,5])box(g,mat('#e8c977',.5),x,4,5.1,.4,6,.4);box(g,'#392e23',0,3.5,5.15,3,5,.15);roof(g,'#5b6350',7.8,17,17);beam(g,'#e0c779',[0,8.4,0],[0,10.5,0],.12);for(let i=0;i<8;i++)part(g,new T.ConeGeometry(3,13,9),'#5d8566',Math.sin(i)*16,6.5,Math.cos(i)*16);
 }else if(k==='dumpling'){
  box(g,'#8f9290',0,1.2,0,9,2.4,8);part(g,sphere,'#bdbca9',0,6,0,4,5,2.2);for(let i=0;i<9;i++){const a=i*Math.PI/8;part(g,sphere,'#c9c8b6',Math.cos(a)*3.4,6+Math.sin(a)*4.5,1.1,.55,1.1,1.1);}part(g,sphere,'#8a9082',0,8,2.12,.75,1,.35);beam(g,'#a0a28f',[-1,6.6,2],[0,6.3,2.8],.27);beam(g,'#a0a28f',[1,6.6,2],[0,6.3,2.8],.27);box(g,'#8c977f',0,.1,0,16,.2,14);
 }else if(k==='rail-museum'){
  box(g,'#697d84',0,7,-5,28,.7,18);box(g,'#9faeae',0,3,-12,28,6,.4);for(const x of[-13,0,13])box(g,'#c3cfce',x,3.5,-5,.5,7,18);for(const x of[-8,8]){box(g,'#344750',x,1.5,-1,5,2.5,13);const boiler=part(g,new T.CylinderGeometry(1.8,1.8,8,18),'#35434a',x,3,1);boiler.rotation.x=Math.PI/2;box(g,'#465b61',x,4,-4,4,4,4);part(g,new T.CylinderGeometry(.5,.5,2,10),'#26353c',x,5.4,3);for(const z of[-3,0,3])for(const side of[-1,1]){const wheel=part(g,new T.CylinderGeometry(1,1,.35,16),'#222e32',x+side*2.4,1.2,z);wheel.rotation.z=Math.PI/2;}for(const side of[-1,1])beam(g,'#697f83',[x+side*2.6,1.2,-3],[x+side*2.6,1.2,3],.12);}
 }else if(k==='fuji'){
  part(g,new T.ConeGeometry(32,40,48,10),'#6b91a7',0,20,0);part(g,new T.ConeGeometry(10.4,13,48,8),'#f5f4eb',0,33.5,0);box(g,'#68a7bc',0,-.15,16,65,.2,24);for(let i=0;i<10;i++)part(g,new T.ConeGeometry(2,5,8),'#5c8265',-24+i*5,2.5,28);
 }else if(k==='sand-bath'){
  box(g,'#d4bf94',0,.1,0,29,.4,24);box(g,'#68b4c6',0,-.1,-22,35,.2,22);for(let i=0;i<6;i++){const x=(i%3-1)*8,z=Math.floor(i/3)*8-3;part(g,sphere,'#c0aa81',x,.45,z,2,.55,3);part(g,sphere,'#e9cbb0',x,.65,z+2.3,.55,.55,.55);beam(g,'#ad8b61',[x+2,.3,z],[x+2,5,z],.12);part(g,new T.ConeGeometry(3,1.6,12),i%2?'#ad6288':'#e4d6af',x+2,5.4,z);for(let j=0;j<2;j++)part(g,sphere,new T.MeshBasicMaterial({color:'#f2f3e6',transparent:true,opacity:.22,depthWrite:false}),x+Math.sin(i+j),1.5+j*1.5,z,.6,1.2,.6);}
 }
 if(k==='garden-pagoda'){box(g,'#86b8ae',0,-.1,15,35,.15,19);for(let i=0;i<10;i++)part(g,sphere,'#83a76b',Math.sin(i)*18,2,Math.cos(i)*18,3,3,3);}
 if(k==='lake-torii')for(let z=-20;z<22;z+=6){box(g,'#a9b9b0',18,1.5,z,2,3,2);box(g,'#b2bdb5',18,3.2,z,4,.5,6);}
 if(['pasture','forest','mountain','city','harbor','lighthouse','watermill','station-square'].includes(k)){
  const variant=index%4;
  if(k==='pasture'){
   for(let i=0;i<9;i++)box(g,i%2?'#94b85d':'#b7cc78',0,.15,-20+i*5,42,.3,3.6);
   for(const x of[-13,10]){part(g,new T.CylinderGeometry(.35,.65,23,10),'#e9ede2',x,11.5,0);part(g,sphere,'#eceee8',x,23,0,.9);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;beam(g,'#eff3ee',[x,23,0],[x+Math.sin(a)*8,23+Math.cos(a)*8,0],.5);}}
  }else if(k==='forest'){
   for(let i=0;i<24;i++){const x=Math.sin(i*2.4)*19,z=Math.cos(i*1.8)*18,h=7+i%5*1.7;part(g,new T.CylinderGeometry(.25,.35,h,7),'#e6e4d4',x,h/2,z);part(g,sphere,i%2?'#6b956a':'#95b77d',x,h-1,z,2.5,3.6,2.5);for(let y=1;y<h-1;y+=2)box(g,'#776f61',x,y,z+.29,.33,.13,.09);}
  }else if(k==='mountain'){
   for(let i=0;i<3;i++){const h=20+(i+variant)%3*7,x=(i-1)*16;part(g,new T.ConeGeometry(20,h,20),'#729d7b',x,h/2,-9-i*4);if(index<16)part(g,new T.ConeGeometry(6,h*.3,20),'#e7eeeb',x,h*.85,-9-i*4);}
   for(let i=0;i<5;i++){box(g,'#dfddca',-13+i*6,1.8,15,4,3.6,5);const m=part(g,new T.ConeGeometry(3.7,2,4),'#687d79',-13+i*6,4.5,15);m.rotation.y=Math.PI/4;}
  }else if(k==='city'){
   for(let i=0;i<9;i++){const x=(i%3-1)*9,z=(Math.floor(i/3)-1)*10,h=9+((i*7+index*3)%24);box(g,i%2?'#a9c2cc':'#dedfd5',x,h/2,z,6,h,7);for(let y=3;y<h;y+=3)windows(g,x,y,z+3.55,5,1.2,3);box(g,'#829ba6',x,h+.4,z,5,.8,6);}
  }else if(k==='harbor'){
   box(g,'#8cbdc8',0,-.12,5,55,.2,46);box(g,'#b8bbae',0,.3,-10,49,.6,20);
   for(let i=0;i<10;i++)box(g,['#b86455','#789eaa','#bfac69'][i%3],(i%5-2)*8,1.5+Math.floor(i/5)*2.8,-13,7,2.8,5);
   for(const x of[-18,17]){beam(g,'#c68966',[x-4,0,-1],[x-2,20,-1],.6);beam(g,'#c68966',[x+4,0,-1],[x+2,20,-1],.6);beam(g,'#c68966',[x-7,20,-1],[x+10,20,-1],.65);beam(g,'#667980',[x+9,20,-1],[x+9,7,-1],.12);}
  }else if(k==='lighthouse'){
   box(g,'#80b4c5',0,-.1,0,45,.2,40);box(g,'#abb9aa',0,.6,0,18,1.2,22);part(g,new T.CylinderGeometry(2.5,3.5,20,20),'#edece2',0,10,0);part(g,new T.CylinderGeometry(3.6,3.6,1,20),'#687d80',0,20,0);part(g,new T.CylinderGeometry(2.6,2.6,3,12),'#d8e7ab',0,22,0);part(g,new T.ConeGeometry(3.7,2.5,20),'#a4554a',0,24.5,0);
  }else if(k==='watermill'){
   box(g,'#78acb9',0,-.1,4,40,.2,8);box(g,'#c7b496',0,4,-3,13,8,10);roof(g,'#656b59',9,17,14);const wheel=new T.Group();wheel.position.set(8,4,2);g.add(wheel);part(wheel,new T.TorusGeometry(4,.25,8,24),'#82654b',0,0,0);for(let i=0;i<12;i++){const a=i*Math.PI/6;beam(wheel,'#82654b',[0,0,0],[Math.sin(a)*4,Math.cos(a)*4,0],.13);const m=box(wheel,'#9c7d59',Math.sin(a)*4,Math.cos(a)*4,0,1.6,.4,2);m.rotation.z=-a;}
  }else{
   box(g,'#babfb2',0,.2,0,35,.4,24);box(g,'#c3ab85',0,7,0,3,14,3);part(g,new T.CylinderGeometry(2.6,2.6,.6,32),'#e8e9dd',0,14,1.8).rotation.x=Math.PI/2;beam(g,'#40534e',[0,14,2.2],[0,15.6,2.2],.12);beam(g,'#40534e',[0,14,2.2],[1.4,14.5,2.2],.12);for(const x of[-11,11]){box(g,'#8f7b5e',x,1.1,4,6,.4,2);box(g,'#6f7667',x,.5,4,4,1,1);part(g,sphere,'#93b882',x,5,-5,3,4,3);}
  }
 }
 return g;
}
