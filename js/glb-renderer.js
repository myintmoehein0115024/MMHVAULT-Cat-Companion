/* Black Gold Cat P2.0 — stronger whole-body short velvet fur presence, fuller tail plume, and preserved P1.8 ear/face fixes; native glTF animation clips blended over GPU-skinned body and tail.
   Face details remain attached to rigid named pivots; this is NOT final studio topology, fur groom, or professionally animated motions. */
import {CatRenderer} from './renderer.js?v=p18';
import {actionPulse,pawCycle,walkBlend} from './motion-mixer.js?v=p11';
import {loadCatGLB} from './glb-loader.js?v=p11';
import {sampleAnimationLayers} from './clip-player.js?v=p11';
import {FootPlantCoordinator} from './foot-plant.js?v=p11';

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

/** A 2D two-link solver in cat-local Y/Z space. Exact joint geometry matches
 * Leg -> Knee -> Paw pivot offsets in build_cat_glb_p06.py. Targets are clamped
 * to reach and the result is finite for all gait phases. No external physics. */
export function solvePawIK(targetY,targetZ,front=true){
 const a=[-.260,front?.018:-.015],b=[-.235,.105];
 const l1=Math.hypot(...a),l2=Math.hypot(...b);
 const d0=Math.hypot(targetY,targetZ),d=clamp(d0,Math.abs(l1-l2)+.0003,l1+l2-.0008);
 const phi=Math.atan2(targetZ,targetY),b1=Math.atan2(a[1],a[0]),b2=Math.atan2(b[1],b[0]);
 // The bent-elbow branch stays close to the neutral rig at rest.
 const internal=-Math.acos(clamp((d*d-l1*l1-l2*l2)/(2*l1*l2),-1,1));
 const knee=internal-(b2-b1 < -Math.PI ? b2-b1+2*Math.PI : b2-b1 > Math.PI ? b2-b1-2*Math.PI : b2-b1);
 const hip=Math.atan2(Math.sin(phi-b1),Math.cos(phi-b1))-Math.atan2(l2*Math.sin(internal),l1+l2*Math.cos(internal));
 return {hip:clamp(hip,-1.10,1.10),knee:clamp(knee,-1.45,.75),paw:clamp(-hip-knee,-1.25,1.25),reach:d0-d};
}

export class GLBCatRenderer extends CatRenderer{
 constructor(canvas){super(canvas,{minimal:true});this.model=null;this.entries=[];this.assetName='P2.0 全身骨骼毛发优化版';this.footPlant=new FootPlantCoordinator();}
 async load(url){
  const model=await loadCatGLB(url);
  if(['idle','walk','loaf','inspect','welcome','stretch'].some(name=>!model.animations.some(c=>c.name===name)))
   throw Error('P2.0 GLB 缺少必要的六段动画，请检查 models/black-gold-cat-p20.glb 是否上传完整');
  const meshes=model.meshes.map(prims=>prims.map(p=>{
   const mesh=this.upload({pos:Array.from(p.positions),normal:p.normals?Array.from(p.normals):Array.from(p.positions,()=>0),idx:Array.from(p.indices),colors:p.colors?Array.from(p.colors):null,
    jointIds:p.jointIds?Array.from(p.jointIds):null,jointWeights:p.jointWeights?Array.from(p.jointWeights):null});
   const name='glb'+this.entries.length;this.meshes[name]=mesh;this.entries.push(name);
   const metal=clamp(p.metallic??0,0,1),rough=clamp(p.roughness??1,.065,1);
   const furry=/^(Body|Head|Cheek|Chest|Leg|UpperLeg|LowerLeg|Paw|Tail|Skinned|P08|P16|P20|Temple|EarRim|Brow|BlackFur)/.test(p.name) && !/Eye|Iris|Ring|Collar|Gold|Medallion|Whisker|Toe|Inner|Mouth|Nose/.test(p.name);
   return {key:name,color:cssColor(p.baseColor),metal,rough,fur:furry ? .94 : 0,alpha:p.baseColor[3]??1,doubleSided:p.doubleSided,vertexBlend:p.colors?1:0,skinned:!!p.jointIds,eyeAccent:/EyeIris|EyeRing/.test(p.name)?1:0};
  }));
  this.model={nodes:model.nodes.map(n=>({...n,base:nodeMatrix(n)})),meshes,skins:model.skins,animations:model.animations,roots:model.roots};
  this.assetName='P2.0 · 身体/尾巴骨骼毛束 · '+model.animations.length+'段动画 · '+Math.round(model.bytes/1024)+' KB';
  return this;
 }
 drawCat(mind,time){if(!this.model)return;
  const g=this.gl;
  this.draw('shadow',combine(T(mind.x,.003,mind.z),S(1.08,1,.78)),'#03080a',0,0,0,.37);
  this.draw('ring',combine(T(mind.x,.016,mind.z),S(1.03,1,.78)),'#f6b94b',.58,.105,0,.72);
  const pose=mind.pose||{idle:0,walk:mind.mode==='walk'?1:0,loaf:mind.mode==='loaf'?1:0,
    inspect:mind.mode==='inspect'?1:0,welcome:mind.mode==='welcome'?1:0,stretch:mind.mode==='stretch'?1:0};
  const loaf=clamp(mind.crouch||0,0,1),sitting=clamp(mind.pose?.sit||0,0,1),walk=walkBlend(mind),age=time-(mind.modeAt??time);
  const greet=clamp(pose.welcome*actionPulse(age,2.7),0,1);
  const stretching=clamp(pose.stretch*actionPulse(age,2.8),0,1);
  const breath=.005*Math.sin(time*2.05),bodyBob=.0065*Math.sin(mind.step*2)*walk;
  const curious=clamp(pose.inspect+pose.welcome*.55,0,1);
  const smile=clamp(greet*.95+stretching*.65+curious*.23,0,1);
  // Sitting is a procedural transition layered over a quiet idle head/ear clip;
  // the P1.0 asset still has six authored GLB clips, not a seventh sit clip.
  const clipPose=sampleAnimationLayers(this.model.animations,{...pose,idle:(pose.idle||0)+sitting*.6},mind.clipAges,mind.step);
  if(!this.footPlant)this.footPlant=new FootPlantCoordinator();
  if(walk<.06)this.footPlant.clear();
  mind.rootBob=bodyBob+breath;
  const legCache=new Map();
  for(const front of [true,false])for(const left of [true,false]){
   const key=(front?'Front':'Back')+(left?'Left':'Right');
   const old=felineJointAngles({step:mind.step,motion:mind.motion,crouch:loaf,mode:mind.mode,modeAge:age},front,left);
   // Undo legacy one-shot greeting so crossfaded greeting weights control it.
   const legacyGreet=old.greeting;
   old.greeting=front&&left?greet:0;
   old.hip+=(legacyGreet-old.greeting)*.59;
   old.knee+=(legacyGreet-old.greeting)*.36;
   old.paw+=(old.greeting-legacyGreet)*.16;
   // Use the same diagonal pairing as P0.5; stance paws remain close to the
   // ground while swing paws lift as they move forwards.
   const phase=mind.step+((front===left)?0:Math.PI);
   const stride=pawCycle(phase);
   const neutralZ=front?.123:.090;
   const plant=this.footPlant.target(mind,{front,left,walk,phase,neutralZ,
     targetY:-.495+.103*stride.lift*walk+.012*loaf});
   const ik=solvePawIK(plant.targetY,plant.targetZ,front);
   const mix=walk*(1-loaf)*(1-sitting)*(1-old.greeting);
   const lerp=(a,b)=>a*(1-mix)+b*mix;
   // Fold hind legs beneath the torso for sitting, keep front legs supported.
   const hip=lerp(old.hip,ik.hip)+(front?-.16:-.62)*sitting;
   const knee=lerp(old.knee,ik.knee)+(front?.16:.72)*sitting;
   const paw=lerp(old.paw,ik.paw)-(hip-lerp(old.hip,ik.hip)+knee-lerp(old.knee,ik.knee))*.66;
   legCache.set(key,{...old,hip,knee,paw,lateral:plant.lateral*mix});
  }
  const poseFor=node=>{
   const name=node.name;
   if(name==='CatRoot')return combine(node.base,T(mind.x,-.035+breath+bodyBob,mind.z),RY(mind.yaw),RX(.11*sitting),RZ(clamp((mind.turnRate||0)*.014,-.042,.042)),S(1,1-.105*loaf-.025*sitting,1));
   if(name==='HeadPivot')return combine(node.base,RY(.06*Math.sin(time*.47)+mind.gazeX*.105),RX(-mind.gazeY*.065+.022*Math.sin(time*.55)-stretching*.11-.04*sitting),RZ(.020*Math.sin(time*.6)));
   if(name==='EarLeft'||name==='EarRight')return combine(node.base,RZ((name==='EarLeft'?-1:1)*(Math.sin(time*1.6)*.026+(curious*.030))));
   if(name.startsWith('CheekPivot'))return combine(node.base,T(0,smile*.009,.007*smile),S(1+smile*.025,1+smile*.032,1));
   if(name==='MouthPivot')return combine(node.base,T(0,smile*.019,smile*.006),S(1+smile*.18,1,1));
   if(name==='NosePivot')return combine(node.base,T(0,.002*Math.sin(time*2.2)+smile*.005,0));
   if(name.startsWith('BrowFurPivot'))return combine(node.base,T(0,(curious*.026)+.009*Math.sin(time*1.1),0),RZ((name.endsWith('Left')?-1:1)*(curious*.018)));
   if(name.startsWith('LowerLid'))return combine(node.base,T(0,clamp(mind.blink,0,1)*.065+smile*.019,0));
   if(name.startsWith('PupilPivot'))return combine(node.base,T(mind.gazeX*.017,mind.gazeY*.013,0));
   if(name.startsWith('UpperLid'))return combine(node.base,T(0,-clamp(mind.blink,0,1)*.130-smile*.016,0));
   if(name.startsWith('EyeIris')||name.startsWith('EyeRing')||name.startsWith('Pupil')||name.startsWith('EyeSpark'))return combine(node.base,S(1,Math.max(.26,1-mind.blink*.70),1));
   if(name.startsWith('Leg')||name.startsWith('Knee')||name.startsWith('Paw')){
    const front=name.includes('Front'),left=name.includes('Left');
    const angles=legCache.get((front?'Front':'Back')+(left?'Left':'Right'));
    if(name.startsWith('Leg'))return combine(node.base,RX(angles.hip+(front?-.12*stretching:0)),RZ(angles.greeting*.14));
    if(name.startsWith('Knee'))return combine(node.base,RX(angles.knee));
    return combine(node.base,T(angles.lateral||0,0,0),RX(angles.paw));
   }
   if(name==='TailRoot')return combine(node.base,RY(mind.tail*.38),RZ(Math.sin(time*1.3)*.065));
   if(name==='TailMid')return combine(node.base,RY(-mind.tail*.52),RX(Math.sin(time*1.5+.7)*.11));
   if(name==='TailTip')return combine(node.base,RY(mind.tail*.78),RX(Math.sin(time*1.7+1.2)*.15));
   return node.base;
  };
  // First evaluate the complete hierarchy, then compute current skin matrices.
  // The skinned tail mesh is authored in cat bind coordinates, so jointWorld * IBMs
  // maps original mesh vertices into animated world space without double transforms.
  const drawList=[],worlds=new Array(this.model.nodes.length);
  const traverse=(id,parent)=>{
   const node=this.model.nodes[id];if(!node)return;
   const clipQ=clipPose.get(id);
   const local=poseFor(node);
   const world=mul(parent,clipQ?mul(local,qmat(clipQ)):local);worlds[id]=world;
   if(node.mesh!==undefined)drawList.push({node,world});
   for(const child of node.children)traverse(child,world);
  };
  for(const root of this.model.roots)traverse(root,I());
  const skinPalettes=this.model.skins.map(sk=>{
   const matrices=new Float32Array(sk.joints.length*16);
   for(let i=0;i<sk.joints.length;i++){
     if(!worlds[sk.joints[i]])throw Error('未更新的蒙皮骨骼节点');
     const inverse=sk.inverseBindMatrices.subarray(i*16,(i+1)*16);
     matrices.set(mul(worlds[sk.joints[i]],inverse),i*16);
   }
   return matrices;
  });
  for(const {node,world} of drawList){
    // On phones draw the fully weighted base fur; desktop receives detail fur.
    // Preserve the complete GLB asset and animation hierarchy at every width.
    if(this.canvas.clientWidth < 620 && /P20(?:Coat|Tail)DetailFiberNode/.test(node.name)) continue;
    // Hide P0.7 rigid torso/leg shells, now replaced by one smoothly connected
    // skin-weighted body surface. Keep paw pads/toes and all face details.
    if(this.model.skins.length>=2 && (
      ['Body','BodyFurBase','BodyFurTufts','Chest','ChestGoldFuzz','ChestBib'].includes(node.name) ||
      /^(UpperLeg|LowerLeg)(Front|Back)(Left|Right)$/.test(node.name))) continue;
    // Replace the old rigid segmented tail shells with the weighted tube.
    if(this.model.skins.length&&['TailBase','TailMidFur','TailTipFur','TailHair'].includes(node.name))continue;
    for(const p of this.model.meshes[node.mesh]){
      if(p.doubleSided)g.disable(g.CULL_FACE);
      if(p.skinned){
       if(node.skin===undefined||!skinPalettes[node.skin])throw Error('蒙皮网格未引用有效 skin');
       g.uniform1f(this.loc.uUseSkin,1);
       g.uniformMatrix4fv(this.loc['uJointPalette[0]'],false,skinPalettes[node.skin]);
       // In this standalone demo, skin palette already contains CatRoot motion.
       this.draw(p.key,I(),p.color,p.metal,.01,p.fur,p.alpha,p.rough,p.vertexBlend,p.eyeAccent);
      }else{
       g.uniform1f(this.loc.uUseSkin,0);
       this.draw(p.key,world,p.color,p.metal,.01,p.fur,p.alpha,p.rough,p.vertexBlend,p.eyeAccent);
      }
      if(p.doubleSided)g.enable(g.CULL_FACE);
    }
  }
  g.uniform1f(this.loc.uUseSkin,0);
 }
}
