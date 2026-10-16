/* Black Gold Cat P1.0: genuine glTF keyframe evaluator.
 * Plays authored node tracks embedded inside the GLB; blends layer rotations
 * additively with existing procedural IK/gaze. Not a full studio animation mixer.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const IDENTITY=[0,0,0,1];
const normalize=(q)=>{const l=Math.hypot(...q)||1;return q.map(v=>v/l);};
const lerp=(a,b,t)=>a+(b-a)*t;
function slerp(q0,q1,t){
 let d=q0.reduce((v,a,i)=>v+a*q1[i],0);
 let end=q1;
 if(d<0){end=q1.map(v=>-v);d=-d;}
 if(d>.9995)return normalize(q0.map((v,i)=>lerp(v,end[i],t)));
 const th=Math.acos(clamp(d,-1,1)),s=Math.sin(th);
 return q0.map((v,i)=>(Math.sin((1-t)*th)*v+Math.sin(t*th)*end[i])/s);
}
/** Sample a glTF animation channel at seconds. Handles STEP, LINEAR with
 * quaternion SLERP and clamped endpoints. */
export function sampleChannel({sampler,path},seconds){
 const {times,values,interpolation}=sampler;
 const width=path==='rotation'?4:3;
 const read=i=>Array.from(values.subarray(i*width,(i+1)*width));
 if(times.length===1||seconds<=times[0])return read(0);
 if(seconds>=times[times.length-1])return read(times.length-1);
 let lo=0,hi=times.length-1;
 while(lo+1<hi){const middle=(lo+hi)>>1;if(times[middle]<=seconds)lo=middle;else hi=middle;}
 if(interpolation==='STEP')return read(lo);
 const alpha=clamp((seconds-times[lo])/(times[hi]-times[lo]),0,1);
 const a=read(lo),b=read(hi);
 return path==='rotation'?slerp(a,b,alpha):a.map((v,i)=>lerp(v,b[i],alpha));
}
/** Sample six real named glTF clips. The pose blend weights come from CatMind.
 * Per-action playback clocks are preserved through blend-outs, avoiding jumps.
 * Returns node-index -> local additive quaternion matrix-compatible values.
 * Translation and scale samplers are imported but are not layered in this demo.
 */
export function sampleAnimationLayers(animations,pose,clocks={},walkPhase=0){
 const perNode=new Map();
 for(const clip of animations||[]){
  const weight=clamp(Number(pose?.[clip.name]||0),0,1);
  if(weight<.0001)continue;
  let t=clip.name==='walk'?(walkPhase/(2*Math.PI))*(clip.duration||1):(clocks[clip.name]||0);
  if(clip.loop)t=((t%clip.duration)+clip.duration)%clip.duration;
  else t=clamp(t,0,clip.duration);
  for(const channel of clip.channels){
   if(channel.path!=='rotation')continue;
   const q=sampleChannel(channel,t);
   let array=perNode.get(channel.node);
   if(!array){array=[0,0,0,0,0];perNode.set(channel.node,array);}
   // Sign align to identity, because q and -q represent the same rotation.
   const sign=q[3]<0?-1:1;
   for(let k=0;k<4;k++)array[k]+=q[k]*sign*weight;
   array[4]+=weight;
  }
 }
 const out=new Map();
 for(const [node,v] of perNode){
  const absent=Math.max(0,1-v[4]);
  out.set(node,normalize([v[0],v[1],v[2],v[3]+absent]));
 }
 return out;
}
export const identityQuaternion=()=>IDENTITY.slice();
