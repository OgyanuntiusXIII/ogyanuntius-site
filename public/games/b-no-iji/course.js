export const ringAt=i=>({z:-200-i*105,x:i<2?0:Math.sin(i*.72)*4.8,y:i<2?5.5:5.4+Math.sin(i*.46)*2});
// Full-width low/high barriers require altitude changes; columns require steering.
export function obstacleAt(i){
 const z=-430-i*185,kind=i%4;
 if(kind===0)return{z,x:0,w:20,h:4.4,baseY:0,kind:'low'};
 if(kind===1)return{z,x:0,w:20,h:6,baseY:7.0,kind:'high'};
 if(kind===2)return{z,x:0,w:5.2,h:13,baseY:0,kind:'column'};
 return{z,x:(Math.floor(i/4)%2?1:-1)*4.7,w:9.4,h:13,baseY:0,kind:'side'};
}
