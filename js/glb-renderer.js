/* Black Gold Cat P0.5 — modular GLB player with explicit elbow/hock hinges,
   grounded paw compensation, per-material roughness, expressive eyelids.
   It is articulated node animation, NOT a professional skinned/IK rig. */
import {CatRenderer} from './renderer.js?v=p05';
import {loadCatGLB} from './glb-loader.js?v=p05';

const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const mul=(a,b)=>{const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;};
const T=(x=0,y=0,z=0)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
const S=(x=1,y=1,z=1)=>new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]);
const RX=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);};
const RY=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);};
const RZ=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);};
const combine=(...args)=>args.reduce(mul,I());
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
function qmat(q){const [x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;return new Float32Array([1-yy-zz,xy+wz,xz-wy,0,xy-wz,1-xx-zz,yz+wx,0,xz+wy,yz-wx,1-xx-yy,0,0,0,0,1]);}
function nodeMatrix(node){return node.matrix?new Float32Array(node.matrix):combine(T(...node.translation),qmat(node.rotation),S(...node.scale));}
function cssColor(vec){return '#'+vec.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('');}

// Paw and hinged leg easing can be tested without a browser / GPU.
export function felineJointAngles({step=0,motion=0,crouch=0,mode='idle',modeAge=0}={},front=true,left=true){
 const walk=clamp(motion*2.4,0,1);
 // Diagonal pairs: front-left + back-right, front-right + back-left.
 const diagonal=(front===left)?0:Math.PI;
 const phase=step+diagonal;
 const swing=Math.sin(phase)*walk;
 const lift=Math.max(0,Math.cos(phase))*walk;
 const greeting=(front&&left&&mode==='welcome')?Math.sin(Math.PI*clamp(modeAge/2.7,0,1)):0;
 const rest=clamp(crouch,0,1);
 const hip=swing*(front?.29:.25)+(front?.43:-.37)*rest-greeting*.59;
 const knee=(front?-.06:.15)+(front?-.56:.47)*rest+(front?-.57:.47)*lift-greeting*.36;
 const paw=-(hip+knee)*.64+.12*lift+.17*rest+greeting*.16;
 return {hip,knee,paw,walk,lift,greeting};
}

export class GLBCatRenderer extends CatRenderer{
 constructor(canvas){super(canvas,{minimal:true});this.model=null;this.entries=[];this.assetName='P0.5 关节式 GLB';}
 async load(url){
  const model=await loadCatGLB(url);
  const meshes=model.meshes.map(prims=>prims.map(p=>{
   const mesh=this.upload({pos:Array.from(p.positions),normal:p.normals?Array.from(p.normals):Array.from(p.positions,()=>0),idx:Array.from(p.indices)});
   const name='glb'+this.entries.length;this.meshes[name]=mesh;this.entries.push(name);
   const metal=clamp(p.metallic??0,0,1),rough=clamp(p.roughness??1,.065,1);
   return {key:name,color:cssColor(p.baseColor),metal,rough,fur:metal<.1&&rough>.76?.55:0,alpha:p.baseColor[3]??1,doubleSided:p.doubleSided};
  }));
  this.model={nodes:model.nodes.map(n=>({...n,base:nodeMatrix(n)})),meshes,roots:model.roots};
  this.assetName='P0.5 GLB关节猫 · '+Math.round(model.bytes/1024)+' KB · '+model.nodes.length+'节点';
  return this;
 }
 drawCat(mind,time){if(!this.model)return;
  const g=this.gl;
  this.draw('shadow',combine(T(mind.x,.003,mind.z),S(1.08,1,.78)),'#03080a',0,0,0,.27);
  this.draw('ring',combine(T(mind.x,.016,mind.z),S(1.03,1,.78)),'#af8344',.3,.02,0,.52);
  const loaf=clamp(mind.crouch||0,0,1),walk=clamp(mind.motion*2.4,0,1),age=time-(mind.modeAt??time);
  const breath=.005*Math.sin(time*2.05),bodyBob=.008*Math.sin(mind.step*2)*walk;
  const poseFor=node=>{
   const name=node.name;
   if(name==='CatRoot')return combine(node.base,T(mind.x,.018+breath+bodyBob,mind.z),RY(mind.yaw),S(1,1-.105*loaf,1));
   if(name==='HeadPivot')return combine(node.base,RY(.06*Math.sin(time*.47)+mind.gazeX*.105),RX(-mind.gazeY*.065+.022*Math.sin(time*.55)),RZ(.020*Math.sin(time*.6)));
   if(name==='EarLeft'||name==='EarRight')return combine(node.base,RZ((name==='EarLeft'?-1:1)*Math.sin(time*1.6)*.032));
   if(name.startsWith('PupilPivot'))return combine(node.base,T(mind.gazeX*.017,mind.gazeY*.013,0));
   if(name.startsWith('UpperLid'))return combine(node.base,T(0,-clamp(mind.blink,0,1)*.139,0));
   if(name.startsWith('EyeIris')||name.startsWith('EyeRing')||name.startsWith('Pupil')||name.startsWith('EyeSpark'))return combine(node.base,S(1,Math.max(.26,1-mind.blink*.70),1));
   if(name.startsWith('Leg')||name.startsWith('Knee')||name.startsWith('Paw')){
    const front=name.includes('Front'),left=name.includes('Left');
    const angles=felineJointAngles({step:mind.step,motion:mind.motion,crouch:loaf,mode:mind.mode,modeAge:age},front,left);
    if(name.startsWith('Leg'))return combine(node.base,RX(angles.hip),RZ(angles.greeting*.14));
    if(name.startsWith('Knee'))return combine(node.base,RX(angles.knee));
    return combine(node.base,RX(angles.paw));
   }
   if(name==='TailRoot')return combine(node.base,RY(mind.tail*.46),RZ(Math.sin(time*1.3)*.075));
   if(name==='TailMid')return combine(node.base,RY(-mind.tail*.62),RX(Math.sin(time*1.5+.7)*.15));
   if(name==='TailTip')return combine(node.base,RY(mind.tail*.83),RX(Math.sin(time*1.7+1.2)*.18));
   return node.base;
  };
  const traverse=(id,parent)=>{
   const node=this.model.nodes[id];if(!node)return;
   const world=mul(parent,poseFor(node));
   if(node.mesh!==undefined){for(const p of this.model.meshes[node.mesh]){
    if(p.doubleSided)g.disable(g.CULL_FACE);
    this.draw(p.key,world,p.color,p.metal,.01,p.fur,p.alpha,p.rough);
    if(p.doubleSided)g.enable(g.CULL_FACE);
   }}
   for(const child of node.children)traverse(child,world);
  };
  for(const root of this.model.roots)traverse(root,I());
 }
}
