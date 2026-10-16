"""Inject per-vertex coat color ramps into locally generated P0.6 GLB without changing its node hierarchy.
This is a real glTF COLOR_0 attribute, not a baked photograph or external dependency.
"""
from pathlib import Path
import json,struct,math,numpy as np,sys
p=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'models/black-gold-cat-p06.glb'
b=p.read_bytes(); assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2
n=struct.unpack_from('<I',b,12)[0]; j=json.loads(b[20:20+n]); off=20+n
assert b[off+4:off+8]==b'BIN\x00'; length=struct.unpack_from('<I',b,off)[0]; buffer=bytearray(b[off+8:off+8+length]); assert len(j['buffers'])==1

def accessor(idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']]; assert a['type']=='VEC3' and a['componentType']==5126
 start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12)
 return np.stack([np.frombuffer(buffer,dtype='<f4',count=3,offset=start+k*stride) for k in range(a['count'])])

def ramp(name,pos):
 x,y,z=pos.T
 n=pos.shape[0]
 if name.startswith('HeadCore'):
  sx=np.abs(x)/.49; sy=y/.46; sz=z/.47
  rim=np.clip((sx-.54)/.43,0,1)**1.7 * np.clip((sz+.28)/1.15,0,1)
  halo=np.clip((sy-.50)/.48,0,1)**2*.26
  gold=np.clip(rim*.60+halo,0,.72)
  base=np.array([.055,.048,.059]);high=np.array([.48,.28,.12])
 elif name.startswith('HeadLower'):
  sx=np.abs(x)/.467;sy=y/.335;sz=z/.34
  gold=np.clip((sx-.68)/.32,0,1)**2*.36
  base=np.array([.075,.064,.066]);high=np.array([.42,.26,.12])
 elif name.startswith('Body') and 'Tufts' not in name:
  sx=np.abs(x)/.54;sy=y/.39
  gold=np.clip((sx-.57)/.42,0,1)**2*.27 + np.clip((sy-.73)/.25,0,1)*.13
  base=np.array([.059,.052,.061]);high=np.array([.34,.21,.11])
 elif name.startswith('Cheek') and 'Fur' not in name:
  sx=np.abs(x)/.175;sz=z/.19
  gold=np.clip((sx-.40)/.58,0,1)*.24
  base=np.array([.075,.064,.065]);high=np.array([.38,.24,.12])
 elif name.startswith('EyeIris') or name.startswith('EyeRing'):
  rr=np.sqrt((x/.14)**2+(y/.153)**2)
  gold=np.clip(1-rr,0,1)**.8
  base=np.array([.62,.285,.072]);high=np.array([.99,.72,.24])
 elif name.startswith('TailTipFur'):
  gold=np.clip(y/.218+.5,0,1)*.6
  base=np.array([.29,.16,.075]);high=np.array([.87,.51,.18])
 else:return None
 noise=np.sin(x*43+y*34+z*59)*np.sin(x*21-y*27+z*12)*.016
 colors=np.clip(base[None,:]+np.asarray(gold)[:,None]*(high-base)[None,:]+noise[:,None],0,1).astype('<f4')
 return colors

added=[]
for mesh in j['meshes']:
 name=mesh.get('name','');
 for prim in mesh.get('primitives',[]):
  a=prim['attributes'].get('POSITION');
  if a is None:continue
  col=ramp(name,accessor(a))
  if col is None:continue
  while len(buffer)%4:buffer.append(0)
  start=len(buffer);data=col.tobytes();buffer.extend(data)
  viewIndex=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(data)})
  accIndex=len(j['accessors']);j['accessors'].append({'bufferView':viewIndex,'byteOffset':0,'componentType':5126,'count':len(col),'type':'VEC3'})
  prim['attributes']['COLOR_0']=accIndex;added.append(name)
j['buffers'][0]['byteLength']=len(buffer)
j.setdefault('asset',{})['generator']='MMHVAULT Black Gold Cat P0.6 generator with COLOR_0 gradients'
j.setdefault('extras',{})['p06']={'vertexColorMeshes':added,'feature':'gradient coat and amber irises'}
raw=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode();raw+=b' ' * ((-len(raw))%4)
buf=bytes(buffer);buf+=b'\x00' * ((-len(buf))%4)
out=b'glTF'+struct.pack('<II',2,12+8+len(raw)+8+len(buf))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(buf),b'BIN\x00')+buf
p.write_bytes(out)
print('Vertex-color GLB:',p,'meshes=',len(added),'nodes=',len(j['nodes']),'size=',len(out))
