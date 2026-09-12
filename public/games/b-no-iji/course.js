import {GOAL,KM_PER_UNIT} from './journey.js';
export const ringAt=i=>({z:-200-i*105,x:i<2?0:Math.sin(i*.72)*4.8,y:i<2?5.5:5.4+Math.sin(i*.46)*2});
// Full-width low/high barriers require altitude changes; columns require steering.
export const FIRST_OBSTACLE=-430, OBSTACLE_SPACING=185;
// Past the halfway point the barriers come 1.1 times as often.
export const LATE_START=.5, LATE_SPACING_FACTOR=1.1;
export const obstacleSpacing=km=>km>=GOAL*LATE_START?OBSTACLE_SPACING/LATE_SPACING_FACTOR:OBSTACLE_SPACING;
export function obstaclePattern(i){
 const kind=i%4;
 if(kind===0)return{x:0,w:20,h:4.4,baseY:0,kind:'low'};
 if(kind===1)return{x:0,w:20,h:6,baseY:7.0,kind:'high'};
 if(kind===2)return{x:0,w:5.2,h:13,baseY:0,kind:'column'};
 return{x:(Math.floor(i/4)%2?1:-1)*4.7,w:9.4,h:13,baseY:0,kind:'side'};
}
export const obstacleAt=(i,z)=>({z,...obstaclePattern(i)});
// How many barriers a flight of this many units can have met. Shared with the leaderboard check.
export function obstacleCount(units){let z=FIRST_OBSTACLE,n=0;while(-z-1<=units&&n<100000){n++;z-=obstacleSpacing(-z*KM_PER_UNIT);}return n;}
