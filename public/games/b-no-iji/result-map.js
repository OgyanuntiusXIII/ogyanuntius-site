import {PREFECTURES} from './japan-map-data.js';
import {ROUTE,STATIONS,GOAL} from './journey.js';
import {journeyLocation,routeCoordinates} from './geography.js';
const ns='http://www.w3.org/2000/svg';
export const project=({lon,lat})=>[58+(lon-128)*Math.cos(38*Math.PI/180)*25.7,30+(46-lat)*25.7];
const inset=([lon,lat])=>[25+(lon-122.5)*15,95+(29.7-lat)*15];
function element(tag,attrs={},text){const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text)el.textContent=text;return el;}
function path(points){return points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('');}
let mapReady=false;
export function renderResultMap(km){
 const svg=document.getElementById('resultMap'),place=journeyLocation(km);
 if(!mapReady){
  svg.append(element('title',{id:'mapTitle'},'稚内から西大山までの飛行ルート'),element('desc',{id:'mapDescription'}));
  const defs=element('defs'),clip=element('clipPath',{id:'japanMainClip'});clip.append(element('rect',{x:0,y:0,width:560,height:455}));defs.append(clip);svg.append(defs);
  const land=element('g',{'clip-path':'url(#japanMainClip)',class:'map-land'});
  for(const f of PREFECTURES){const d=f.polygons.flatMap(p=>p.map(r=>path(r.map(([lon,lat])=>project({lon,lat})))+'Z')).join('');const area=element('path',{d,'data-prefecture':f.code,'fill-rule':'evenodd'});area.append(element('title',{},f.name));land.append(area);}svg.append(land);
  const islands=element('g',{class:'map-islands'});islands.append(element('rect',{x:17,y:80,width:151,height:126,rx:8}));
  for(const f of PREFECTURES){const d=f.polygons.filter(p=>p[0].every(c=>c[1]<29.7&&c[0]<131.5)).flatMap(p=>p.map(r=>path(r.map(inset))+'Z')).join('');if(d)islands.append(element('path',{d}));}islands.append(element('text',{x:26,y:98},'南西諸島'));svg.append(islands);
  svg.append(element('path',{class:'map-route-future',d:path(routeCoordinates().map(project))}));
  svg.append(element('path',{id:'mapTravelHalo',class:'map-travel-halo'}),element('path',{id:'mapTravel',class:'map-travel'}));
  const dots=element('g',{id:'mapStations'});for(let i=0;i<STATIONS.length;i++){const[x,y]=project({lat:STATIONS[i][1],lon:STATIONS[i][2]}),dot=element('circle',{cx:x,cy:y,r:2.5,'data-station':i});dot.append(element('title',{},STATIONS[i][0]+'駅'));dots.append(dot);}svg.append(dots);
  for(const [i,dx,dy,anchor]of[['稚内',-10,-8,'end'],['札幌',-10,1,'end'],['東京',12,5,'start'],['名古屋',12,23,'start'],['博多',-8,-8,'end'],['西大山',10,20,'start']].map(([name,...rest])=>[STATIONS.findIndex(s=>s[0]===name),...rest])){const[x,y]=project({lat:STATIONS[i][1],lon:STATIONS[i][2]});svg.append(element('text',{x:x+dx,y:y+dy,'text-anchor':anchor,class:'map-station-name'},STATIONS[i][0]));}
  const pin=element('g',{id:'mapPin'});pin.append(element('circle',{r:10,class:'map-pin-halo'}),element('circle',{r:5.5,class:'map-pin-dot'}));svg.append(pin);mapReady=true;
 }
 const d=path(routeCoordinates(km).map(project));for(const id of['mapTravel','mapTravelHalo'])document.getElementById(id).setAttribute('d',d);
 svg.querySelectorAll('[data-station]').forEach(el=>el.classList.toggle('passed',ROUTE[Number(el.dataset.station)].km<=place.km));
 svg.querySelectorAll('[data-prefecture]').forEach(el=>el.classList.toggle('current',Number(el.dataset.prefecture)===place.prefecture.code));
 document.getElementById('mapPin').setAttribute('transform',`translate(${project(place).join(' ')})`);
 document.getElementById('mapDescription').textContent=`${place.prefecture.name}まで飛行。日本縦断${place.percent.toFixed(1)}%、${place.index+1}駅を通過。紫の線が飛んだ道、灰色の線がこの先のルートです。`;
 document.getElementById('resultLocation').textContent=place.prefecture.name;
 document.getElementById('mapProgress').textContent=`日本縦断 ${place.percent.toFixed(1)}%`;
 document.getElementById('mapStationCount').textContent=`${place.index+1} / ${ROUTE.length}駅`;
 svg.classList.remove('map-reveal');void svg.getBoundingClientRect();svg.classList.add('map-reveal');
}
