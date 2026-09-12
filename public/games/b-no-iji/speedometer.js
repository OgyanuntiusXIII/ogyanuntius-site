export const displayedSpeed=s=>Math.round(s.speed*(s.rate??1)*1.8);
export function buildSpeedometer(svg){
 const ns='http://www.w3.org/2000/svg',make=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
 for(let i=0;i<=16;i++){const a=(-90+i/16*180)*Math.PI/180,major=i%4===0,r=major?71:77,x=r=>110+Math.sin(a)*r,y=r=>105-Math.cos(a)*r;svg.append(make('line',{x1:x(r),y1:y(r),x2:x(85),y2:y(85),class:major?'meter-tick-major':'meter-tick'}));if(major){const label=make('text',{x:x(58),y:y(58)+4,'text-anchor':'middle'});label.textContent=i*50;svg.append(label);}}
}
