/* Black Gold Cat P0.4 — original modular GLB WebGL2 preview renderer.
   This proves real model loading and independently moving 3D scene parts.
   It is NOT yet a professional skinned/IK/fur-simulation runtime. */
import {CatRenderer} from './renderer.js?v=p04';
import {loadCatGLB} from './glb-loader.js';
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const mul=(a,b)=>{const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;};
const T=(x=0,y=0,z=0)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
const S=(x=1,y=1,z=1)=>new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]);
const RX=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);};
const RY=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);};
const RZ=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);};
const combine=(...args)=>args.reduce(mul,I());
function qmat(q){const [x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;return new Float32Array([1-yy-zz,xy+wz,xz-wy,0,xy-wz,1-xx-zz,yz+wx,0,xz+wy,yz-wx,1-xx-yy,0,0,0,0,1]);}
function nodeMatrix(node){return node.matrix?new Float32Array(node.matrix):combine(T(...node.translation),qmat(node.rotation),S(...node.scale));}
function cssColor(vec){return '#'+vec.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('');}
export class GLBCatRenderer extends CatRenderer{
 constructor(canvas){super(canvas,{minimal:true});this.model=null;this.entries=[];this.assetName='独立 GLB 模块模型';}
 async load(url){
  const model=await loadCatGLB(url);const meshes=model.meshes.map(prims=>prims.map(p=>{
   const mesh=this.upload({pos:Array.from(p.positions),normal:p.normals?Array.from(p.normals):Array.from(p.positions,()=>0),idx:Array.from(p.indices)});
   const name='glb'+this.entries.length;this.meshes[name]=mesh;this.entries.push(name);
   return {key:name,color:cssColor(p.baseColor),metal:p.metallic,alpha:p.baseColor[3]??1,doubleSided:p.doubleSided};
  }));
  this.model={nodes:model.nodes.map(n=>({...n,base:nodeMatrix(n)})),meshes,roots:model.roots};
  this.assetName='GLB原创猫咪 · '+Math.round(model.bytes/1024)+' KB · '+model.nodes.length+'个节点';
  return this;
 }
 drawCat(mind,time){if(!this.model)return;
  const g=this.gl;
  // The original shadow stays underneath the new modular 3D character.
  this.draw('shadow',combine(T(mind.x,.003,mind.z),S(1.08,1,.78)),'#03080a',0,0,0,.27);
  this.draw('ring',combine(T(mind.x,.016,mind.z),S(1.03,1,.78)),'#af8344',.3,.02,0,.52);
  const walk=Math.min(1,mind.motion*2.4),loaf=mind.crouch,timeS=time*.7;
  const poseFor=(node)=>{
   const name=node.name;
   if(name==='CatRoot')return combine(node.base,T(mind.x,.04*loaf,mind.z),RY(mind.yaw),S(1,1-.11*loaf,1));
   if(name==='HeadPivot')return combine(node.base,RY(.10*Math.sin(timeS)+mind.gazeX*.12),RX(-mind.gazeY*.07+.025*Math.sin(timeS*.7)),RZ(.035*Math.sin(timeS*.85)));
   if(name==='EarLeft'||name==='EarRight')return combine(node.base,RZ((name==='EarLeft'?-1:1)*Math.sin(time*1.6)*.040));
   if(name.startsWith('PupilPivot'))return combine(node.base,T(mind.gazeX*.016,mind.gazeY*.012,0));
   if(name.startsWith('EyeIris')||name.startsWith('EyeRing')||name.startsWith('Pupil')||name.startsWith('EyeSpark'))return combine(node.base,S(1,Math.max(.06,1-mind.blink*.96),1));
   if(name.startsWith('Leg')){
    const front=name.includes('Front'),left=name.includes('Left'),phase=mind.step+(left?0:Math.PI)+(front?0:Math.PI);
    const hello=(name==='LegFrontLeft'&&mind.mode==='welcome')
      ?Math.sin(Math.PI*Math.min(1,Math.max(0,(time-mind.modeAt)/2.7))):0;
    return combine(node.base,RZ(hello*-.40),RX(Math.sin(phase)*walk*.33+(front?loaf*.26:-loaf*.19)-hello*.55));
   }
   if(name.startsWith('Paw'))return combine(node.base,RX(-.20*loaf));
   if(name==='TailRoot')return combine(node.base,RY(mind.tail*.50),RZ(Math.sin(time*1.4)*.11));
   if(name==='TailMid')return combine(node.base,RY(-mind.tail*.70),RX(Math.sin(time*1.5+.7)*.18));
   if(name==='TailTip')return combine(node.base,RY(mind.tail*.9),RX(Math.sin(time*1.7+1.2)*.18));
   return node.base;
  };
  const traverse=(id,parent)=>{
   const node=this.model.nodes[id];const world=mul(parent,poseFor(node));
   if(node.mesh!==undefined){for(const p of this.model.meshes[node.mesh]){
    if(p.doubleSided)g.disable(g.CULL_FACE);
    this.draw(p.key,world,p.color,Math.max(0,Math.min(1,p.metal)),.01,0,p.alpha);
    if(p.doubleSided)g.enable(g.CULL_FACE);
   }}
   for(const child of node.children)traverse(child,world);
  };
  for(const root of this.model.roots)traverse(root,I());
 }
}
