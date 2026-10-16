/* P0.7 self-hosted GLB geometry + small weighted-skin loader.
   Supports one embedded GLB buffer, up to 8 joints per skin (renderer max),
   JOINTS_0/WEIGHTS_0 and inverse bind matrices; no clips, textures, Draco/KTX2.
   Not a complete glTF implementation or a studio grooming solution. */
const COMPONENT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const ELEMENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function readAccessor(json,bytes,index){
 const a=json.accessors?.[index];if(!a)throw Error('无效 glTF accessor '+index);
 if(a.sparse)throw Error('暂不支持稀疏 accessor');
 const view=json.bufferViews?.[a.bufferView];
 if(!view ||view.buffer!==0)throw Error('当前测试加载器仅支持内置单个 GLB buffer');
 const ctor=COMPONENT[a.componentType];const n=ELEMENTS[a.type];
 if(!ctor||!n)throw Error('不支持的 glTF 顶点类型');
 const stride=view.byteStride||ctor.BYTES_PER_ELEMENT*n;
 const size=ctor.BYTES_PER_ELEMENT*n;
 if(stride<size)throw Error('glTF byteStride 错误');
 const offset=(view.byteOffset||0)+(a.byteOffset||0);
 if(offset+(a.count-1)*stride+size>view.byteLength+(view.byteOffset||0) || offset+(a.count-1)*stride+size>bytes.byteLength)throw Error('GLB accessor 超出边界');
 const data=new ctor(a.count*n);
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const getters={5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'};
 for(let row=0;row<a.count;row++)for(let col=0;col<n;col++)data[row*n+col]=dv[getters[a.componentType]](offset+row*stride+col*ctor.BYTES_PER_ELEMENT,true);
 return data;
}
export async function loadCatGLB(url,{signal}={}){
 const response=await fetch(url,{signal,cache:'no-cache'});
 if(!response.ok)throw Error('模型加载失败：HTTP '+response.status);
 const buffer=await response.arrayBuffer();
 if(buffer.byteLength<20)throw Error('GLB 文件过短');
 const view=new DataView(buffer),magic=view.getUint32(0,true),ver=view.getUint32(4,true),total=view.getUint32(8,true);
 if(magic!==0x46546c67||ver!==2||total!==buffer.byteLength)throw Error('不是有效的 GLB 2.0 文件');
 let pos=12,json=null,binary=null;
 while(pos<total){
  if(pos+8>total)throw Error('GLB chunk 头部越界');
  const length=view.getUint32(pos,true),type=view.getUint32(pos+4,true);pos+=8;
  if(pos+length>total)throw Error('GLB chunk 越界');
  if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,pos,length)));
  if(type===0x004e4942)binary=new Uint8Array(buffer,pos,length);
  pos+=length;
 }
 if(!json||!binary||json.asset?.version!=='2.0')throw Error('GLB 缺少模型数据');
 if((json.buffers||[]).length!==1)throw Error('当前测试加载器仅支持一个 GLB buffer');
 if(json.extensionsRequired?.length)throw Error('当前测试加载器尚不支持此模型需要的 glTF 扩展');
 if(json.animations?.length)throw Error('当前蒙皮原型尚未支持 glTF 内嵌动画剪辑');
 const meshes=(json.meshes||[]).map((m,index)=>{
  return (m.primitives||[]).map(prim=>{
   if(prim.mode!==undefined&&prim.mode!==4)throw Error('只能绘制三角形网格');
   const positions=readAccessor(json,binary,prim.attributes.POSITION);
   const colors=prim.attributes.COLOR_0===undefined?null:readAccessor(json,binary,prim.attributes.COLOR_0);
   const jointIds=prim.attributes.JOINTS_0===undefined?null:readAccessor(json,binary,prim.attributes.JOINTS_0);
   const jointWeights=prim.attributes.WEIGHTS_0===undefined?null:readAccessor(json,binary,prim.attributes.WEIGHTS_0);
   let normals=prim.attributes.NORMAL===undefined?null:readAccessor(json,binary,prim.attributes.NORMAL);
   const indices=prim.indices===undefined?Array.from({length:positions.length/3},(_,i)=>i):readAccessor(json,binary,prim.indices);
   if(positions.length%3||normals&&normals.length!==positions.length ||colors&&colors.length!==positions.length ||indices.length%3)throw Error('模型网格属性不完整');
   if(!!jointIds!==!!jointWeights)throw Error('JOINTS_0 和 WEIGHTS_0 必须成对出现');
   if(jointIds&&(jointIds.length!==positions.length/3*4||jointWeights.length!==jointIds.length))throw Error('蒙皮权重数量不正确');
   if(positions.length/3>65535)throw Error('当前测试加载器单网格顶点数量不能超过65535');
   for(const idx of indices)if(idx<0||idx>=positions.length/3)throw Error('模型网格索引越界');
   if(!normals){
    // A legal glTF mesh may omit NORMAL; calculate smooth vertex normals.
    normals=new Float32Array(positions.length);
    for(let i=0;i<indices.length;i+=3){
     const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
     const ab=[positions[b]-positions[a],positions[b+1]-positions[a+1],positions[b+2]-positions[a+2]];
     const ac=[positions[c]-positions[a],positions[c+1]-positions[a+1],positions[c+2]-positions[a+2]];
     const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
     for(const q of [a,b,c])for(let k=0;k<3;k++)normals[q+k]+=n[k];
    }
    for(let i=0;i<normals.length;i+=3){const l=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;for(let k=0;k<3;k++)normals[i+k]/=l;}
   }
   const mtl=json.materials?.[prim.material||0]||{};
   const pbr=mtl.pbrMetallicRoughness||{};
   return {name:m.name||`Mesh${index}`,positions,normals,colors,jointIds,jointWeights,indices,baseColor:pbr.baseColorFactor||[.5,.5,.5,1],metallic:pbr.metallicFactor??0,roughness:pbr.roughnessFactor??1,doubleSided:!!mtl.doubleSided};
  });
 });
 const nodes=(json.nodes||[]).map(n=>({name:n.name||'',mesh:n.mesh,skin:n.skin,children:n.children||[],matrix:n.matrix||null,translation:n.translation||[0,0,0],rotation:n.rotation||[0,0,0,1],scale:n.scale||[1,1,1]}));
 const skins=(json.skins||[]).map((sk,i)=>{
   if(!sk.joints?.length||sk.joints.length>8||sk.inverseBindMatrices===undefined)throw Error('蒙皮关节数超过8或缺少 inverseBindMatrices: '+i);
   const inverseBindMatrices=readAccessor(json,binary,sk.inverseBindMatrices);
   if(inverseBindMatrices.length!==sk.joints.length*16)throw Error('反向绑定矩阵数量错误');
   for(const joint of sk.joints)if(!nodes[joint])throw Error('蒙皮骨骼节点索引无效');
   return {joints:sk.joints,inverseBindMatrices};
 });
 for(const n of nodes)if(n.skin!==undefined&&!skins[n.skin])throw Error('未找到绑定的 glTF skin');
 for(const m of meshes)for(const p of m)if(p.jointIds){for(const k of p.jointIds)if(k>=8)throw Error('当前蒙皮加载器只支持0至7号骨骼索引');}

 const roots=json.scenes?.[json.scene||0]?.nodes || [0];
 return {meshes,nodes,skins,roots,bytes:buffer.byteLength,materialCount:(json.materials||[]).length};
}
