import * as T from './vendor/three.module.js';

// Keep a level horizon and let the character move within a gently following frame.
export class FlightCamera{
 constructor(camera){this.camera=camera;this.eye=new T.Vector3();this.target=new T.Vector3();this.aim=new T.Vector3();this.ready=false;}
 reset(){this.ready=false;}
 update(dt,s,reduced=false){
  if(dt<=0)return;
  const c=this.camera;
  if(!this.ready){c.getWorldDirection(this.aim).multiplyScalar(34.5).add(c.position);this.ready=true;}
  const height=(s.y-5.4)*.35,follow=1-Math.exp(-3*dt);
  this.eye.set(s.x*.45,8.7+height,13.5);this.target.set(s.x*.30,6.3+height,-21);
  c.position.lerp(this.eye,follow);this.aim.lerp(this.target,follow);
  c.up.set(0,1,0);c.lookAt(this.aim);
  c.fov+=((!reduced&&s.guitar?68:64)-c.fov)*(1-Math.exp(-2*dt));
 }
}

// Render between completed physics steps without changing collisions or input.
export function captureFlight(view,s){view.x=s.x;view.y=s.y;view.travel=s.travel;}
export function interpolateFlight(out,previous,s,alpha){
 Object.assign(out,s);const a=Math.max(0,Math.min(1,alpha));
 for(const key of ['x','y','travel'])out[key]=previous[key]+(s[key]-previous[key])*a;
 return out;
}
