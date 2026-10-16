/* Black Gold Cat P1.1 — limited ground-contact anchor for a lightweight
 * character prototype. While paws are in stance, retain world X/Z contact;
 * during swing, release and recapture at next touchdown. The existing
 * 2-joint sagittal IK has limited lateral reach; this is NOT full physics IK.
 */
import {pawCycle} from './motion-mixer.js?v=p11';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SIDE={FrontLeft:-.34,FrontRight:.34,BackLeft:-.39,BackRight:.39};
const FORE_AFT={Front:.46,Back:-.60};
export class FootPlantCoordinator {
 constructor(){this.contacts=new Map();this.groundedCount=0;}
 clear(){this.contacts.clear();this.groundedCount=0;}
 /** Return a target relative to the hip, compatible with solvePawIK(y,z).
  * Note: root pitch is low in this prototype and is deliberately ignored here. */
 target(mind,{front,left,walk,phase,neutralZ,targetY}){
  const key=(front?'Front':'Back')+(left?'Left':'Right');
  const cycle=pawCycle(phase),xLocal=SIDE[key],zHip=FORE_AFT[front?'Front':'Back'];
  const swingZ=neutralZ+.118*cycle.slide*walk;
  const yaw=mind.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
  const world=(x,z)=>({x:mind.x+c*x+s*z,z:mind.z-s*x+c*z});
  const state=this.contacts.get(key)||{stance:false,anchor:null};
  if(walk<.06){state.stance=false;state.anchor=null;}
  else if(cycle.stance){
   if(!state.stance||!state.anchor)state.anchor=world(xLocal,zHip+swingZ);
   state.stance=true;
  }else{state.stance=false;state.anchor=null;}
  let z=swingZ,lateral=0,locked=false;
  if(state.stance&&state.anchor){
   // Inverse RY on the fixed world contact.
   const dx=state.anchor.x-mind.x,dz=state.anchor.z-mind.z;
   const localX=c*dx-s*dz,localZ=s*dx+c*dz;
   z=clamp(localZ-zHip,neutralZ-.17,neutralZ+.17);
   lateral=clamp(localX-xLocal,-.065,.065);
   locked=true;
  }
  this.contacts.set(key,state);
  this.groundedCount=Array.from(this.contacts.values()).filter(v=>v.stance).length;
  // Counteracting animated bob only while the paw is planted.
  return {targetY:targetY-(locked?(mind.rootBob||0):0),targetZ:z,lateral,grounded:locked,lift:cycle.lift,stance:cycle.stance};
 }
}
