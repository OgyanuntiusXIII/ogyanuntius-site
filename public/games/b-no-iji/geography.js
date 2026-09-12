import {STATIONS,ROUTE,GOAL} from './journey.js';
import {PREFECTURES} from './japan-map-data.js';
const rad=v=>v*Math.PI/180;
export function coordinateAt(km){
 km=Math.max(0,Math.min(GOAL,Number(km)||0));let index=0;
 while(index<ROUTE.length-1&&km>=ROUTE[index+1].km)index++;
 const a=STATIONS[index],b=STATIONS[Math.min(index+1,STATIONS.length-1)],length=(ROUTE[index+1]?.km??km)-ROUTE[index].km,t=length>0?(km-ROUTE[index].km)/length:0;
 const vector=s=>{const lat=rad(s[1]),lon=rad(s[2]);return[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];},u=vector(a),v=vector(b),angle=Math.acos(Math.max(-1,Math.min(1,u.reduce((sum,n,i)=>sum+n*v[i],0))));
 if(angle<1e-8)return{lon:a[2],lat:a[1],index,km};
 const p=u.map((n,i)=>(n*Math.sin((1-t)*angle)+v[i]*Math.sin(t*angle))/Math.sin(angle));
 return{lon:Math.atan2(p[1],p[0])*180/Math.PI,lat:Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI,index,km};
}
function inRing(lon,lat,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function prefectureAt(lon,lat){
 for(const f of PREFECTURES)if(f.polygons.some(p=>inRing(lon,lat,p[0])&&!p.slice(1).some(h=>inRing(lon,lat,h))))return{name:f.name,code:f.code,offshore:false};
 // The flight crosses sea as well as land. Report the closest coast, explicitly as offshore.
 let closest,dist=Infinity;const scale=Math.cos(rad(lat));
 for(const f of PREFECTURES)for(const p of f.polygons)for(let i=1;i<p[0].length;i++){const a=p[0][i-1],b=p[0][i],x=(b[0]-a[0])*scale,y=b[1]-a[1],px=(lon-a[0])*scale,py=lat-a[1],t=Math.max(0,Math.min(1,(px*x+py*y)/(x*x+y*y||1))),d=(px-t*x)**2+(py-t*y)**2;if(d<dist){dist=d;closest=f;}}
 return{name:closest.name+'沖',code:closest.code,offshore:true};
}
export function journeyLocation(km){const point=coordinateAt(km);return{...point,prefecture:prefectureAt(point.lon,point.lat),percent:point.km/GOAL*100};}
export function routeCoordinates(until=GOAL){const end=coordinateAt(until),points=[];for(let i=0;i<=end.index;i++){const start=ROUTE[i].km,stop=Math.min(end.km,ROUTE[i+1]?.km??end.km),steps=Math.max(1,Math.ceil((stop-start)/15));for(let n=0;n<steps;n++)points.push(coordinateAt(start+(stop-start)*n/steps));}points.push(end);return points;}
