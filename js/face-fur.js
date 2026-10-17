/** P2.3: tiny, rigid micro-fur attached to named Head/Ear/Cheek/Neck GLB nodes.
 * No changes to immutable P2.1 GLB, bones, clips, eye/face animations or P2.2 skinned coat.
 * Each generated mesh stays in the exact local coordinate system of its source node;
 * glb-renderer.js supplies the existing animated world matrix each frame.
 * NOT real strand hair, strand physics, fur textures or offline character grooming.
 */
const TAU=Math.PI*2;
const cfg=Object.freeze({
 HeadCore:{base:1800,fine:900,length:[.010,.019],width:[.0016,.0032],lift:[.0028,.007],axis:[0,.10,-1],region:'head'},
 HeadLower:{base:390,fine:160,length:[.009,.016],width:[.0014,.0028],lift:[.002,.005],axis:[0,-1,-.25],region:'lower'},
 CheekLeft:{base:550,fine:260,length:[.012,.021],width:[.0019,.0035],lift:[.003,.007],axis:[-.35,-.95,-.25],region:'cheek'},
 CheekRight:{base:550,fine:260,length:[.012,.021],width:[.0019,.0035],lift:[.003,.007],axis:[.35,-.95,-.25],region:'cheek'},
 EarShellLeft:{base:330,fine:180,length:[.007,.014],width:[.0013,.0025],lift:[.003,.008],axis:[-.18,1,-.2],region:'ear'},
 EarShellRight:{base:330,fine:180,length:[.007,.014],width:[.0013,.0025],lift:[.003,.008],axis:[.18,1,-.2],region:'ear'},
 ChestRuffP12:{base:740,fine:310,length:[.014,.024],width:[.0020,.0040],lift:[.004,.009],axis:[0,-1,.18],region:'chest'},
 P18SoftNeckRuffNode:{base:480,fine:210,length:[.010,.018],width:[.0016,.0035],lift:[.002,.006],axis:[0,-1,.24],region:'neck'}
});
const sample=(v,i,n)=>Array.from({length:n},(_,j)=>v[i*n+j]);
const add=(a,b,s=1)=>a.map((x,i)=>x+b[i]*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
const lerp=(a,b,t)=>a+(b-a)*t;
function randomFrom(seed){let x=seed>>>0;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);}
function allowed(region,p,n,c){
 if(region==='head'){
  // Keep pupils, lids and the expressive center of the muzzle unobstructed.
  return !(p[2]>.21 && Math.abs(p[0])<.29 && p[1]>-.34 && p[1]<.31);
 }
 if(region==='lower')return !(p[2]>.12 && Math.abs(p[0])<.22);
 if(region==='ear'){
  // Ear mesh includes rose-colored interior; ONLY the dark, outer-facing skin grows fur.
  // Bright inner-ear vertex colors and front-facing recesses remain completely clear.
  return c[0]<.135 && c[1]<.12 && (n[2]<.48 || Math.abs(p[0])>.09);
 }
 if(region==='cheek')return n[2]<.9 || Math.abs(p[0])>.095;
 return true;
}
function meshFrom(source,config,count,seed){
 const rng=randomFrom(seed),pos=source.positions,nrm=source.normals,colors=source.colors,ind=source.indices;
 const tri=[],cdf=[];let surface=0;
 for(let i=0;i<ind.length;i+=3){
  const a=sample(pos,ind[i],3),b=sample(pos,ind[i+1],3),c=sample(pos,ind[i+2],3);
  const area=Math.hypot(...cross(add(b,a,-1),add(c,a,-1)))*.5;
  if(area<1e-10||!Number.isFinite(area))continue;
  surface+=area;tri.push([ind[i],ind[i+1],ind[i+2]]);cdf.push(surface);
 }
 if(!surface)throw Error('P2.3 刚性毛发来源网格没有有效三角形');
 const mesh={pos:[],normal:[],colors:[],idx:[]};
 let done=0,attempts=0;
 while(done<count && attempts<count*28){
  attempts++;
  const needle=rng()*surface;let lo=0,hi=cdf.length-1;
  while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]<needle)lo=mid+1;else hi=mid;}
  const ids=tri[lo],u=Math.sqrt(rng()),v=rng(),w=[1-u,u*(1-v),u*v];
  const interpolate=(data)=>[0,1,2].map(j=>ids.reduce((sum,id,k)=>sum+data[id*3+j]*w[k],0));
  const base=interpolate(pos),n=norm(interpolate(nrm)),c=colors?interpolate(colors):[.052,.054,.067];
  if(!allowed(config.region,base,n,c))continue;
  const bend=norm(add(config.axis,n,-dot(config.axis,n)));
  const flow=Math.hypot(...cross(bend,n))<.05?norm(cross(n,[0,1,0])):bend;
  const side=norm(cross(n,flow));
  const len=lerp(...config.length,rng()),width=lerp(...config.width,rng()),lift=lerp(...config.lift,rng());
  const root=add(base,n,.0015),tip=add(add(root,flow,len),n,lift);
  // Short black velvet with restrained warmth: never copy rose inner-ear colors.
  const coat=c.map((x,k)=>Math.min(config.region==='ear'?.081:.18,Math.max(.026,x*(config.region==='ear'?.95:.88))));
  const tipColor=coat.map(x=>Math.min(.17,x*(.96+rng()*.11)));
  for(const [point,color] of [
   [add(root,side,-width),coat],[add(root,side,width),coat],[tip,tipColor]]){
   mesh.pos.push(...point);mesh.normal.push(...n);mesh.colors.push(...color);mesh.idx.push(mesh.idx.length);
  }
  done++;
 }
 if(done<count*.72)throw Error(`P2.3 ${config.region} 毛发覆盖面不足：${done}/${count}`);
 return mesh;
}
export const P23_RIGID_GROOM_TARGETS=Object.freeze(Object.keys(cfg));
export function buildRigidFaceGroom(source,nodeName){
 const spec=cfg[nodeName];if(!spec)return [];
 if(!source?.positions||!source?.normals||!source?.indices)throw Error('P2.3 缺少刚性网格所需属性');
 if(source.jointIds)throw Error('P2.3 刚性毛发不能附着到蒙皮节点');
 const id=P23_RIGID_GROOM_TARGETS.indexOf(nodeName);
 return [
  {name:'short-microcoat',detail:false,mesh:meshFrom(source,spec,spec.base,0x23a13+id*711)},
  {name:'fine-microcoat',detail:true,mesh:meshFrom(source,spec,spec.fine,0x231fa+id*933)}
 ];
}
