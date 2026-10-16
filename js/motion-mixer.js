/* Black Gold Cat P0.9 — dependency-free procedural animation mixer.
   Softly interpolates animation intent (NOT imported glTF clips) and calculates
   contact-aware two-beat paw paths. No financial app dependencies. */
export const ACTIONS=Object.freeze(['idle','walk','loaf','inspect','welcome','stretch']);
export const clamp01=v=>Math.min(1,Math.max(0,v));
export const smoothStep=v=>{const t=clamp01(v);return t*t*(3-2*t);};
const TWO_PI=Math.PI*2;
const finite=(v,backup=0)=>Number.isFinite(v)?v:backup;
export const newPose=(name='idle')=>Object.fromEntries(ACTIONS.map(action=>[action,Number(action===name)]));
/** Target one state, exponentially blend all action layers, keep weights normalized.
 * Frame-rate independent (up to the simulation's conservative dt cap). */
export function blendPose(pose,next,dt,{inRate=4.2,outRate=3.1}={}){
  if(!ACTIONS.includes(next))throw Error('Unknown cat motion state: '+next);
  const tIn=1-Math.exp(-Math.max(0,dt)*inRate),tOut=1-Math.exp(-Math.max(0,dt)*outRate);
  const result={};let sum=0;
  for(const action of ACTIONS){
    const target=Number(action===next),value=finite(pose?.[action],0);
    const v=clamp01(value+(target-value)*(target>value?tIn:tOut));
    result[action]=v;sum+=v;
  }
  // Prevent tiny visible model pops caused by exponentially fading old actions.
  if(sum>1e-8)for(const action of ACTIONS)result[action]/=sum;
  else return newPose(next);
  return result;
}
/** Walk cycle: feet stay on the ground during stance and travel forwards only
 * during swing; raised foot forms an arch. phase=0 starts stance. */
export function pawCycle(phase,stanceFraction=.6){
  const u=(((finite(phase)%TWO_PI)+TWO_PI)%TWO_PI)/TWO_PI;
  const stance=clamp01(stanceFraction);
  if(u<stance){return {slide:1-2*(u/stance),lift:0,stance:true};}
  const q=(u-stance)/(1-stance),s=smoothStep(q);
  return {slide:-1+2*s,lift:Math.pow(Math.sin(Math.PI*q),1.12),stance:false};
}
/** Finite action envelope for start/end of brief expressions. */
export function actionPulse(age,duration=2.8){
  return Math.sin(Math.PI*smoothStep(clamp01(finite(age)/Math.max(.1,duration))));
}
/** Walk blend scaled to real horizontal speed, separate from a state label. */
export function walkBlend(mind){
  const p=mind.pose?.walk ?? (mind.mode==='walk'?1:0);
  return clamp01(p)*clamp01(finite(mind.motion)*2.35);
}
