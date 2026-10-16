/* P1.5: soft matte black velvet coat. Suppress bronze zebra waves; warm rim only at silhouette. */
/* Black Gold Cat P1.3 — shared standalone WebGL2 core with weighted skin support and roughness-aware shading.
   More expressive, higher tessellation procedural 3D than P0.2.
   Prototype 2-skin quadruped: contiguous body and four legs plus tail. Still no professional groom or glTF animation clips. No CDNs. */
const PI=Math.PI;
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const multiply=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
const T=(x=0,y=0,z=0)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
const S=(x=1,y=1,z=1)=>new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]);
const RX=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);};
const RY=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);};
const RZ=a=>{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);};
const mat=(parent, ...changes)=>changes.reduce((a,b)=>multiply(a,b),parent);
const perspective=(fov,ratio,near,far)=>{let f=1/Math.tan(fov/2),m=new Float32Array(16);m[0]=f/ratio;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=(2*far*near)/(near-far);return m;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const lookAt=(eye,center)=>{const z=norm(eye.map((v,i)=>v-center[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);};
function rgba(hex){const h=hex.replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];}
function ellipsoid(lon=52,lat=34){const pos=[],normal=[],idx=[];for(let i=0;i<=lat;i++){const a=Math.PI*i/lat;for(let j=0;j<=lon;j++){const b=2*Math.PI*j/lon,x=Math.sin(a)*Math.cos(b),y=Math.cos(a),z=Math.sin(a)*Math.sin(b);pos.push(x,y,z);normal.push(x,y,z);}}
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const k=i*(lon+1)+j;idx.push(k,k+1,k+lon+1,k+1,k+lon+2,k+lon+1);}return {pos,normal,idx};}
function earShape(){
 // Rounded outer ear shell, built as an actual thick curved surface, not a paper triangle.
 const pos=[],normal=[],idx=[];
 const quad=(a,b,c,d)=>{
   for(const tri of [[a,b,c],[a,c,d]]){
     const n=norm(cross(tri[1].map((v,i)=>v-tri[0][i]),tri[2].map((v,i)=>v-tri[0][i])));
     const k=pos.length/3;
     for(const v of tri){pos.push(...v);normal.push(...n);}
     idx.push(k,k+1,k+2);
   }
 };
 const rows=11,cols=9;
 const ring=(t,u,front)=>{
   const taper=Math.pow(1-t,.80),width=.173*taper+.002;
   return [u*width, t*.354-.015*u*u*(1-t),
           (front?.075:-.070)-.025*t+.027*(1-u*u)*(1-t)];
 };
 for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){
   const t=j/rows,t2=(j+1)/rows,u=-1+2*k/cols,u2=-1+2*(k+1)/cols;
   quad(ring(t,u,true),ring(t,u2,true),ring(t2,u2,true),ring(t2,u,true));
   quad(ring(t,u2,false),ring(t,u,false),ring(t2,u,false),ring(t2,u2,false));
 }
 for(let j=0;j<rows;j++){
   const t=j/rows,t2=(j+1)/rows;
   quad(ring(t,-1,false),ring(t,-1,true),ring(t2,-1,true),ring(t2,-1,false));
   quad(ring(t,1,true),ring(t,1,false),ring(t2,1,false),ring(t2,1,true));
 }
 quad(ring(0,-1,false),ring(0,1,false),ring(0,1,true),ring(0,-1,true));
 return {pos,normal,idx};
}
function furTufts(count=800,seed=47,filter='all'){
 // Combined low-overhead fur clumps: the silhouette has depth and moves WITH the body.
 // Fewer than real hair strands; deliberate real-time compromise for small mobile screens.
 let n=seed>>>0;
 const rnd=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
 const pos=[],normal=[],idx=[];
 const pushFace=(a,b,c)=>{const nn=norm(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));const k=pos.length/3;
  for(const v of [a,b,c]){pos.push(...v);normal.push(...nn);}idx.push(k,k+1,k+2);};
 let made=0,attempts=0;
 while(made<count&&attempts<count*12){attempts++;
   const u=rnd()*2-1,phi=rnd()*2*Math.PI,r=Math.sqrt(1-u*u),nrm=[r*Math.cos(phi),u,r*Math.sin(phi)];
   // Eyes and muzzle stay uncovered: fur grows around face, not across it.
   if(filter==='head'&&nrm[2]>.66&&nrm[1]>-.43&&nrm[1]<.52)continue;
   if(filter==='gold'&&!((Math.abs(nrm[0])>.69&&nrm[2]>.04)||nrm[1]>.71||nrm[2]<-.53))continue;
   if(filter==='chest'&&nrm[2]<.10)continue;
   const base=nrm.map(v=>v*.99);
   const a=norm(cross(nrm,Math.abs(u)>.92?[1,0,0]:[0,1,0]));
   const b=norm(cross(nrm,a));
   const rad=.015+rnd()*.024,len=.055+rnd()*.080;
   const skew=[(rnd()-.5)*.04,-.02-rnd()*.035,(rnd()-.5)*.025];
   const tip=base.map((v,i)=>v+nrm[i]*len+skew[i]);
   const ring=[];
   for(let k=0;k<3;k++){
     const ang=k*Math.PI*2/3;
     ring.push(base.map((v,i)=>v+rad*(a[i]*Math.cos(ang)+b[i]*Math.sin(ang))));
   }
   for(let k=0;k<3;k++)pushFace(ring[k],ring[(k+1)%3],tip);
   made++;
 }
 return {pos,normal,idx};
}
function whiskerMesh(){
 const pos=[],normal=[],idx=[];
 const face=(a,b,c)=>{const n=norm(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));const k=pos.length/3;
  for(const v of [a,b,c]){pos.push(...v);normal.push(...n);}idx.push(k,k+1,k+2);
  const m=pos.length/3;for(const v of [c,b,a]){pos.push(...v);normal.push(...n.map(x=>-x));}idx.push(m,m+1,m+2);};
 for(const side of [-1,1])for(let w=0;w<4;w++){
  const y=-.185-w*.033;
  const points=[[side*.16,y,.51],[side*.34,y+.038-w*.008,.535],[side*.52,y+.056-w*.027,.49],[side*(.67-.02*w),y+.07-w*.043,.38]];
  for(let q=0;q<points.length-1;q++){
   const a=points[q],b=points[q+1],th=.005*(1-q*.24);
   face([a[0],a[1]+th,a[2]],[a[0],a[1]-th,a[2]],[b[0],b[1]+th*.78,b[2]]);
   face([a[0],a[1]-th,a[2]],[b[0],b[1]-th*.78,b[2]],[b[0],b[1]+th*.78,b[2]]);
  }
 }
 return {pos,normal,idx};
}
function circle(radius=1,thickness=.055,segments=72){const pos=[],normal=[],idx=[];for(let j=0;j<=segments;j++){const a=j*2*PI/segments;for(const r of [radius-thickness,radius+thickness]){pos.push(Math.cos(a)*r,0,Math.sin(a)*r);normal.push(0,1,0);}}for(let j=0;j<segments;j++){const n=j*2;idx.push(n,n+2,n+1,n+1,n+2,n+3);}return {pos,normal,idx};}
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aVertexColor;
layout(location=3) in vec4 aJointIds;
layout(location=4) in vec4 aJointWeights;
uniform mat4 uProj,uView,uModel;
uniform mat4 uJointPalette[16];
uniform float uUseSkin;
out vec3 vN,vW,vVertexColor,vObj;
void main(){
 mat4 skin=mat4(1.0);
 if(uUseSkin>.5){
   skin=uJointPalette[int(aJointIds.x)]*aJointWeights.x
       +uJointPalette[int(aJointIds.y)]*aJointWeights.y
       +uJointPalette[int(aJointIds.z)]*aJointWeights.z
       +uJointPalette[int(aJointIds.w)]*aJointWeights.w;
 }
 vec4 p=uModel*skin*vec4(aPos,1.0);
 vW=p.xyz;
 vN=mat3(transpose(inverse(uModel)))*mat3(skin)*aNormal;
 vVertexColor=aVertexColor;
 vObj=aPos;
 gl_Position=uProj*uView*p;
}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vN,vW,vVertexColor,vObj;
uniform vec3 uColor;
uniform float uMetal,uGlow,uFur,uAlpha,uRough,uVertexBlend,uEyeAccent;
out vec4 frag;
void main(){
 vec3 n=normalize(vN);
 vec3 light=normalize(vec3(-.52,1.65,2.2));
 vec3 fill=normalize(vec3(1.0,.76,-1.25));
 vec3 eye=normalize(vec3(0.0,.62,2.9));
 vec3 halfVec=normalize(light+eye);
 float key=max(dot(n,light),0.0),bounce=max(dot(n,fill),0.0);
 float rough=clamp(uRough,.065,1.0),metal=clamp(uMetal,0.0,1.0);
 // Roughness controls highlight size: broad matte coat vs tight glossy eyes / gold.
 float shininess=mix(128.0,7.0,rough*rough);
 float spec=pow(max(dot(n,halfVec),0.0),shininess);
 float fres=pow(1.0-max(dot(n,eye),0.0),4.0);
 vec3 base=mix(uColor,vVertexColor,clamp(uVertexBlend,0.0,1.0));
 vec3 diffuse=base*(.63+.68*key+.22*bounce)*(1.0-metal*.62);
 vec3 f0=mix(vec3(.045),base,metal);
 vec3 F=f0+(vec3(1.0)-f0)*pow(1.0-max(dot(halfVec,eye),0.0),5.0);
 vec3 reflection=spec*F*(.35+key*.65)*mix(.92,.36,rough);
 // Satin-like fur receives a broader gold edge light than hard surfaces.
 // It is deliberately subtle so the coat stays black instead of turning gold.
 float furHalo=(.014+.088*uFur)*pow(fres,2.05);
 // Gold only at the contour: dark velvet remains nearly black at the center.
 float backRim=max(dot(n,normalize(vec3(-.55,.95,-1.8))),0.0);
 vec3 warmRim=vec3(1.0,.67,.26)*(fres*(.032+.14*metal)+furHalo*(.70+.60*backRim));
 vec3 coolFill=vec3(.025,.033,.051)*(1.0-metal)*(.6+.4*max(n.y,0.0));
 vec3 color=diffuse+reflection+warmRim+coolFill+vec3(1.0,.76,.36)*uGlow;
 // Small, low-contrast flecks suggest short velvet hairs without patterned bands.
 // Strong trigonometric stripes made the P1.4 body look bronze/zebra-striped.
 // Gold is reserved for silhouette highlights, not painted over the torso.
 float smallFibre=sin(dot(vObj,vec3(131.0,117.0,86.0)))*
                   sin(dot(vObj,vec3(157.0,-102.0,123.0)));
 float fibreAA=clamp((2.4-fwidth(dot(vObj,vec3(131.0,117.0,86.0))))*.26,0.0,1.0);
 color*=1.0+uFur*fibreAA*smallFibre*.016;
 color+=uFur*vec3(.07,.048,.024)*pow(fres,3.5)*.075;
 // Procedural iris fibers: inexpensive local-space detailing on the existing
 // amber mesh, without an external texture request. No effect on pupils.
 if(uEyeAccent>.5){
   float theta=atan(vObj.y,vObj.x);
   float irisR=length(vec2(vObj.x/.146,vObj.y/.157));
   float fiber=pow(.5+.5*sin(theta*43.0+irisR*7.0),6.0);
   float irisMask=smoothstep(.18,.40,irisR)*(1.0-smoothstep(.82,1.15,irisR));
   color+=irisMask*fiber*vec3(.21,.087,.012);
   color+=spec*.095*vec3(.93,.74,.40);
 }
 frag=vec4(pow(max(color,vec3(.0)),vec3(.92)),uAlpha);
 }`;
function shader(gl,source,type){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,VERT,gl.VERTEX_SHADER));gl.attachShader(p,shader(gl,FRAG,gl.FRAGMENT_SHADER));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
export class CatRenderer{
 constructor(canvas,options={}){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,powerPreference:'default'});if(!this.gl)throw Error('当前浏览器或设备未启用 WebGL2。建议使用新版 Safari / Chrome，并检查硬件加速。');
  this.shader=program(this.gl);this.loc={};for(const n of ['uProj','uView','uModel','uColor','uMetal','uGlow','uFur','uAlpha','uRough','uVertexBlend','uUseSkin','uJointPalette[0]','uEyeAccent'])this.loc[n]=this.gl.getUniformLocation(this.shader,n);
  this.gl.useProgram(this.shader);this.gl.uniform1f(this.loc.uUseSkin,0);this.meshes=options.minimal?{ring:this.upload(circle()),shadow:this.upload(circle(.75,.70,60))}:{sphere:this.upload(ellipsoid()),ear:this.upload(earShape()),ring:this.upload(circle()),shadow:this.upload(circle(.75,.70,60)), furHead:this.upload(furTufts(1100,194,'head')),furGold:this.upload(furTufts(280,731,'gold')),furBody:this.upload(furTufts(920,182,'all')),furChest:this.upload(furTufts(350,881,'chest')),furTail:this.upload(furTufts(390,271,'all')),whiskers:this.upload(whiskerMesh())};this.size=[0,0];this.gl.enable(this.gl.DEPTH_TEST);this.gl.enable(this.gl.CULL_FACE);this.gl.enable(this.gl.BLEND);this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA);this.gl.clearColor(.009,.030,.051,1);this.lost=false;
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
 }
 upload(mesh){
  const g=this.gl,vao=g.createVertexArray();g.bindVertexArray(vao);
  const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);
  const interleaved=[];
  for(let i=0;i<mesh.pos.length;i+=3){
   const v=i/3;
   const weights=mesh.jointWeights?Array.from(mesh.jointWeights.slice(v*4,v*4+4)):[1,0,0,0];
   let sum=weights.reduce((a,b)=>a+Math.max(0,b),0);
   if(!sum||!Number.isFinite(sum))sum=1;
   interleaved.push(...mesh.pos.slice(i,i+3),...mesh.normal.slice(i,i+3),
    ...(mesh.colors?mesh.colors.slice(i,i+3):[1,1,1]),
    ...(mesh.jointIds?mesh.jointIds.slice(v*4,v*4+4):[0,0,0,0]),
    ...weights.map(w=>Math.max(0,w)/sum));
  }
  g.bufferData(g.ARRAY_BUFFER,new Float32Array(interleaved),g.STATIC_DRAW);
  for(const [index,bytes] of [[0,0],[1,12],[2,24],[3,36],[4,52]]){
   g.enableVertexAttribArray(index);g.vertexAttribPointer(index,index===3||index===4?4:3,g.FLOAT,false,68,bytes);
  }
  const ib=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);
  g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array(mesh.idx),g.STATIC_DRAW);
  g.bindVertexArray(null);
  return {vao,vertexBuffer:buffer,indexBuffer:ib,count:mesh.idx.length};
 }
 resize(){
  const rect=this.canvas.getBoundingClientRect();
  const cssW=Math.max(2,rect.width), cssH=Math.max(2,rect.height);
  // Cap GPU backbuffer by both device pixel ratio and total pixels. Prevents
  // multi-megapixel allocations on high-DPR iPhones, iPads and Androids.
  const dprCap=(cssW<670?1.5:1.8);
  const dpr=Math.min(devicePixelRatio||1,dprCap,Math.sqrt(2000000/(cssW*cssH)));
  const w=Math.max(2,Math.round(cssW*dpr)),h=Math.max(2,Math.round(cssH*dpr));
  if(this.size[0]!==w||this.size[1]!==h){
   this.canvas.width=w;this.canvas.height=h;this.size=[w,h];this.gl.viewport(0,0,w,h);
  }
 }
 draw(mesh,model,color,metal=0,glow=0,fur=0,alpha=1,rough=.82,vertexBlend=0,eyeAccent=0){const g=this.gl,m=this.meshes[mesh];g.uniformMatrix4fv(this.loc.uModel,false,model);g.uniform3fv(this.loc.uColor,rgba(color));g.uniform1f(this.loc.uMetal,metal);g.uniform1f(this.loc.uGlow,glow);g.uniform1f(this.loc.uFur,fur);g.uniform1f(this.loc.uAlpha,alpha);g.uniform1f(this.loc.uRough,rough);g.uniform1f(this.loc.uVertexBlend,vertexBlend);g.uniform1f(this.loc.uEyeAccent,eyeAccent);g.bindVertexArray(m.vao);g.drawElements(g.TRIANGLES,m.count,g.UNSIGNED_SHORT,0);}
 ball(parent,point,size,color,metal=0,extra=[]){this.draw('sphere',mat(parent,T(...point),...extra,S(...size)),color,metal);}
 ear(parent,side,time){const pitch=.045*Math.sin(time*1.8+side),p=mat(parent,T(side*.34,.39,-.12),RZ(-side*.08),RX(pitch));this.draw('ear',p,'#0c1017');this.draw('ear',mat(p,T(0,.06,.076),S(.62,.72,.36)),'#995b43',0,.02);}
 drawCat(mind,time){const g=this.gl;
  const root=mat(I(),T(mind.x,0,mind.z),RY(mind.yaw));
  const bodyY=.78-mind.crouch*.17;
  const motion=mind.motion;
  const walk=Math.min(1,motion*2.2),step=mind.step;
  const breathing=Math.sin(time*2.2)*.011;
  // ground platform and contact shadow are drawn BEFORE the cat, aligned to y = 0
  this.draw('shadow',mat(I(),T(mind.x,.002,mind.z),S(1.12,1,.91)),'#03080a',0,0,0,.28);
  this.draw('ring',mat(I(),T(mind.x,.017,mind.z),S(1.12,1,.82)),'#b58b45',.35,.02,0,.62);
  this.draw('ring',mat(I(),T(mind.x,.016,mind.z),S(.85,1,.57)),'#453a28',.02,0,0,.26);
  const torso=mat(root,T(0,bodyY+.02+Math.sin(step*2)*.015*walk,0));
  this.ball(torso,[0,0,-.10],[.55,.38+breathing, .88],'#090b10');
  this.ball(torso,[0,.04,-.03],[.57,.40,.76],'#111116');
  this.draw('furBody',mat(torso,T(0,.01,-.10),S(.556,.392,.89)),'#111015',0,.015,1);
  this.ball(torso,[0,-.19,.35],[.32,.22,.38],'#1c1716');
  this.draw('furChest',mat(torso,T(0,-.15,.37),S(.31,.25,.37)),'#5a3b1e',0,.025,1);
  this.ball(torso,[0,-.22,.49],[.14,.14,.17],'#b48038',.12);
  // legs are separated and animated individually; final rigged model will provide actual IK.
  for(const side of [-1,1])for(const front of [true,false]){
   const stride=walk*Math.sin(step+(side*(front?1:-1)>0?PI:0));
   const shift=stride*.15;
   const lift=walk*Math.max(0,stride)*.11;
   const anchorY=bodyY-.10;
   const z=front?.52:-.65;
   const xx=side*(front?.365:.40);
   const center=(anchorY+(.14+lift))/2;
   this.ball(root,[xx,center,z+shift*.6],[.145,Math.max(.15,(anchorY-.12-lift)/2+.10),.16],front?'#111218':'#14151a');
   this.ball(root,[xx,.145+lift,z+.09+shift],[.17,.115,.22],'#1a1819');
   this.ball(root,[xx,.11+lift,z+.19+shift],[.124,.067,.115],'#a87632',.12);
   for(const toe of [-1,0,1])this.ball(root,[xx+toe*.077,.113+lift,z+.295+shift],[.045,.043,.067],toe===0?'#ae7939':'#7a5429',.02);
  }
  // tail arcs swing as a continuous curve of overlapping tapered segments
  const tailRoot=mat(torso,T(.0,.07,-.86),RY(.22+mind.tail*.20),RZ(.12+mind.tail*.18));
  this.ball(tailRoot,[0,.07,-.16],[.165,.16,.32],'#101014');
  this.ball(tailRoot,[.04,.24,-.37],[.14,.16,.26],'#111015');
  this.ball(tailRoot,[.10,.42,-.48],[.16,.22,.19],'#17110c');
  this.ball(tailRoot,[.12,.52,-.49],[.15,.16,.16],'#7b5529');
  this.draw('furTail',mat(tailRoot,T(.11,.46,-.48),S(.17,.215,.19)),'#684620',0,.026,1);
  // neck and animated head keep their own local rotation
  const head=mat(torso,T(0,.33,.58),RY(Math.sin(time*.9)*.06+mind.gazeX*.15),RX(Math.sin(time*.61)*.034-mind.gazeY*.08));
  this.ball(head,[0,0,0],[.49,.46,.46],'#080a10',.05);
  this.draw('furHead',mat(head,S(.495,.466,.469)),'#101017',0,.008,1);
  this.draw('furGold',mat(head,S(.50,.472,.472)),'#a47738',0,.025,1);
  this.ball(head,[0,-.10,.23],[.50,.37,.33],'#101015',.04);
  this.ball(head,[0,-.35,.08],[.33,.20,.29],'#23190f');
  for(const side of [-1,1]){
   this.ear(head,side,time);
   // warm cheek tufts behind the eyes, not over the eyes
   this.ball(head,[side*.376,-.19,.14],[.17,.20,.19],'#1a1313');
   const eye=mat(head,T(side*.206,.074,.432),RY(-side*.10));
   this.draw('sphere',mat(eye,S(.159,.169,.058)),'#261911',.08);
   const eyeScale=Math.max(.03,1-mind.blink*.95);
   this.draw('sphere',mat(eye,T(0,-.003,.054),S(.132,.140*eyeScale,.027)),'#e6a742',.40);
   this.draw('sphere',mat(eye,T(side*mind.gazeX*.016,0,.080),S(.049,.102*eyeScale,.016)),'#0c0909',.13);
   this.draw('sphere',mat(eye,T(-.040,.051,.097),S(.022,.026*eyeScale,.006)),'#ffebba',.17,.10);
   this.ball(head,[side*.118,-.208,.413],[.128,.10,.114],'#68462b');
   this.ball(head,[side*.117,-.214,.499],[.115,.075,.035],'#b98b51');
  }
  this.draw('whiskers',head,'#ead4ab',0,.12);
  this.ball(head,[0,-.15,.507],[.082,.055,.047],'#b67d65',.25);
  this.ball(head,[0,-.206,.522],[.024,.052,.022],'#1c1311');
  this.ball(head,[0,-.255,.503],[.095,.024,.034],'#7c583c');
  this.ball(head,[0,-.307,.32],[.21,.070,.074],'#100d10');
  // collar and small gold medallion
  this.ball(torso,[0,.192,.46],[.17,.055,.075],'#805521',.78);
  this.ball(torso,[0,.08,.79],[.103,.103,.05],'#dfac50',.9);
  this.ball(torso,[0,.08,.841],[.060,.062,.014],'#4b3318',.3);
  // animated welcoming raised forepaw
  if(mind.mode==='welcome'){
    const envelope=Math.sin(Math.min(1,(time-mind.modeAt)/2.7)*Math.PI);
    this.ball(root,[-.46,.63+.18*envelope,.65],[.12,.22,.13],'#11121a',0,[RZ(-envelope*.5)]);
    this.ball(root,[-.57,.76+.20*envelope,.75],[.16,.12,.16],'#191417');
  }
  if(mind.mode==='stretch'){
    // small forward head stretch, controlled and non-teleporting
    const stretch=Math.sin(Math.min(1,(time-mind.modeAt)/2.8)*Math.PI);
    this.ball(root,[0,bodyY-.2,.74+stretch*.24],[.20,.105,.12],'#181619');
  }
 }
 render(mind,time){if(this.lost)return;this.resize();const g=this.gl;const ratio=this.size[0]/Math.max(1,this.size[1]);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.shader);g.uniformMatrix4fv(this.loc.uProj,false,perspective(.72,ratio,.1,50));
  const portrait=ratio<.9;
  // Mobile camera gets closer for legible face/eyes; walking range is limited
  // separately by CatMind so the full kitten stays visible.
  // Framing revised against desktop + narrow-phone user screenshots: make the kitten
  // the visual focus without cutting off ears, paws or the animated tail.
  const cameraZ=portrait?5.00+Math.max(0,.82-ratio)*2.2:4.60;
  g.uniformMatrix4fv(this.loc.uView,false,lookAt([0,portrait?1.85:1.87,cameraZ],[0,.98,0]));
  this.drawCat(mind,time);
 }
 dispose(){const g=this.gl;if(!g)return;for(const m of Object.values(this.meshes)){g.deleteVertexArray(m.vao);if(m.vertexBuffer)g.deleteBuffer(m.vertexBuffer);if(m.indexBuffer)g.deleteBuffer(m.indexBuffer);}g.deleteProgram(this.shader);}
}

/* Release marker p14 */
