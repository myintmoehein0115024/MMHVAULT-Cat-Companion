/* P2.2 groomed coat — runtime geometry only; original P2.1 GLB/skeleton intact.
 * Two thin, skin-weighted surface shells + short surface-combed triangular cards.
 * No textures, transparency sorting, model topology changes or extra network fetches.
 * Deterministic geometry means no flicker from moving random hair vertices.
 */
const EPS=1e-9;
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normalize=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
const attr=(arr,index,n)=>Array.from(arr.slice(index*n,(index+1)*n));
function rand(seed){let state=seed>>>0;return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);}
function normalizeSkin(indices,weights){
 const influence=new Map();
 for(let i=0;i<indices.length;i++)for(let j=0;j<4;j++){
  const bone=indices[i][j],w=weights[i][j];
  influence.set(bone,(influence.get(bone)||0)+Math.max(w,0));
 }
 const strongest=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4),total=strongest.reduce((s,p)=>s+p[1],0)||1;
 return {ids:Array.from({length:4},(_,i)=>strongest[i]?.[0]||0),weights:Array.from({length:4},(_,i)=>(strongest[i]?.[1]||0)/total)};
}
const emptyMesh=()=>({pos:[],normal:[],colors:[],idx:[],jointIds:[],jointWeights:[]});
function push(mesh,pos,nrm,color,skin){
 mesh.pos.push(...pos);mesh.normal.push(...nrm);mesh.colors.push(...color);
 mesh.jointIds.push(...skin.ids);mesh.jointWeights.push(...skin.weights);
 mesh.idx.push(mesh.idx.length);
}
function makeShell(source,offset){
 const mesh=emptyMesh(),count=source.positions.length/3;
 for(let k=0;k<count;k++){
  const p=attr(source.positions,k,3),n=normalize(attr(source.normals,k,3)),color=attr(source.colors,k,3);
  // Extremely fine undulation avoids the appearance of a rigid second plastic skin.
  const wobble=.83+.17*Math.sin(k*19.117)*Math.sin(k*7.771);
  push(mesh,add(p,n,offset*wobble),n,color,{ids:attr(source.jointIds,k,4),weights:attr(source.jointWeights,k,4)});
 }
 mesh.idx=Array.from(source.indices);
 return mesh;
}
function makeCards(source,{count,seed,tail}){
 const random=rand(seed),p=source.positions,n=source.normals,ind=source.indices;
 const tris=[],cdf=[];let total=0;
 for(let k=0;k<ind.length;k+=3){
  const ai=ind[k],bi=ind[k+1],ci=ind[k+2];
  const a=attr(p,ai,3),b=attr(p,bi,3),c=attr(p,ci,3),area=Math.hypot(...cross(add(b,a,-1),add(c,a,-1)))*.5;
  if(!Number.isFinite(area)||area<EPS)continue;
  total+=area;tris.push([ai,bi,ci]);cdf.push(total);
 }
 if(!total)throw Error('毛发基础蒙皮网格没有有效三角形');
 const mesh=emptyMesh();
 for(let i=0;i<count;i++){
  const needle=random()*total;let lo=0,hi=cdf.length-1;
  while(lo<hi){const m=(lo+hi)>>1;if(cdf[m]<needle)lo=m+1;else hi=m;}
  const triangle=tris[lo],a=random(),b=random();
  const r=Math.sqrt(a),bary=[1-r,r*(1-b),r*b];
  const blend=(data,size)=>Array.from({length:size},(_,j)=>triangle.reduce((sum,index,k)=>sum+data[index*size+j]*bary[k],0));
  const pos=blend(source.positions,3),normal=normalize(blend(source.normals,3));
  const baseColor=blend(source.colors,3);
  const singleIndices=triangle.map(j=>attr(source.jointIds,j,4));
  const singleWeights=triangle.map((j,k)=>attr(source.jointWeights,j,4).map(w=>w*bary[k]));
  const skin=normalizeSkin(singleIndices,singleWeights);
  // Comb along the anatomical surface, not radially from the center of the cat.
  // Lower body goes down/back; tail flows towards its tip.
  const axis=tail?[.03,.72,-.62]:[0,-.58,.81];
  let flow=add(axis,normal,-dot(axis,normal));
  if(Math.hypot(...flow)<.12)flow=cross(normal,[1,0,0]);
  flow=normalize(flow);
  let side=normalize(cross(normal,flow));
  if(random()<.5)side=side.map(v=>-v);
  const size=(tail?.0105:.0082)+random()*(tail?.0075:.006);
  const lift=(tail?.0078:.0056)+random()*(tail?.007:.0048);
  const width=(tail?.0032:.0028)+random()*(tail?.0029:.0025);
  const root=add(pos,normal,.002);
  const tip=add(add(root,flow,size),normal,lift);
  const soft=(tail?1.12:1.07)*(0.94+random()*.11);
  const rootColor=baseColor.map(c=>Math.max(0.020,Math.min(.13,c*.92)));
  const tipColor=baseColor.map(c=>Math.max(0.028,Math.min(.16,c*soft)));
  push(mesh,add(root,side,-width),normal,rootColor,skin);
  push(mesh,add(root,side,width),normal,rootColor,skin);
  push(mesh,tip,normal,tipColor,skin);
 }
 return mesh;
}
export function buildGroom(source,{tail=false}={}){
 if(!source?.normals||!source?.jointIds||!source?.jointWeights||!source?.colors)
  throw Error('P2.2 Groom 要求包含 NORMAL/COLOR_0/JOINTS_0/WEIGHTS_0 的蒙皮基础网格');
 return [
  {name:'short-shell',mesh:makeShell(source,tail?.0075:.0065),detail:false,coatLayer:1},
  {name:'short-fibers',mesh:makeCards(source,{count:tail?1650:5400,seed:tail?0xabc42:0x21bad,tail}),detail:false,coatLayer:2},
  {name:'outer-shell',mesh:makeShell(source,tail?.013:.0115),detail:true,coatLayer:1.5},
  {name:'fine-fibers',mesh:makeCards(source,{count:tail?1100:3100,seed:tail?0x99dea:0x22ced,tail}),detail:true,coatLayer:2}
 ];
}
