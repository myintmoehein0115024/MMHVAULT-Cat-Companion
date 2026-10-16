"""Original, self-contained stylized black-gold cat GLB test asset.
This is a 3D authored prototype with hinged limbs and separate eyelids, not film groomed fur or weighted skin.
All geometry and materials are generated locally without third-party art assets.
"""
import numpy as np, trimesh, math, random, os, json
from trimesh.transformations import translation_matrix
OUT=os.path.join(os.path.dirname(os.path.dirname(__file__)),'models','black-gold-cat-p05.glb')
sc=trimesh.Scene(); rng=random.Random(2405)
COL={
 'coat':(10,10,17),'fur':(19,16,21),'charcoal':(26,23,27),'gold':(200,132,53),
 'goldDark':(112,70,30),'amber':(245,165,52),'amberBright':(255,198,93),
 'cream':(171,116,69),'nose':(181,109,106),'pink':(193,130,115),
 'eyeBlack':(10,7,9),'highlight':(255,242,216),'whiskers':(225,198,159)
}

def mat(name, metal=.02, rough=.80):
 c=COL[name]
 return trimesh.visual.material.PBRMaterial(name=name,baseColorFactor=[*c,255], metallicFactor=metal,roughnessFactor=rough,doubleSided=True)

def paint(mesh,col,metal=0,rough=.8):
 mesh.visual=trimesh.visual.TextureVisuals(material=mat(col,metal,rough));return mesh

def M(x=0,y=0,z=0): return translation_matrix([x,y,z])

def node(name,parent='CatRoot',xyz=(0,0,0)):
 sc.graph.update(frame_to=name,frame_from=parent,matrix=M(*xyz))

def add(name,mesh,parent='CatRoot',xyz=(0,0,0),color='coat',metal=.02,rough=.82):
 mesh=paint(mesh,color,metal,rough)
 sc.add_geometry(mesh, node_name=name,geom_name=f'{name}_Geo',parent_node_name=parent,transform=M(*xyz))

def ball(name, center, scales, parent='CatRoot',color='coat',sub=3,metal=0,rough=.82):
 m=trimesh.creation.icosphere(subdivisions=sub,radius=1.)
 m.apply_transform(np.diag([*scales,1.])); add(name,m,parent,center,color,metal,rough)

def line(name,points,radius,col,parent):
 # Tube along chain: one continuous mesh per whisker
 verts=[];faces=[];segments=7
 for j,p in enumerate(points):
  p=np.asarray(p,float)
  tangent=np.asarray(points[min(len(points)-1,j+1)],float)-np.asarray(points[max(0,j-1)],float)
  tangent=tangent/(np.linalg.norm(tangent)+1e-9)
  q=np.cross(tangent,[0,1,0]);q=q/(np.linalg.norm(q)+1e-9)
  r=np.cross(tangent,q)
  rad=radius*(1.0-j/(len(points)-1)*.78)
  for k in range(segments):
   a=2*math.pi*k/segments;verts.append(p+rad*(q*math.cos(a)+r*math.sin(a)))
  if j:
   for k in range(segments):
    a=(j-1)*segments+k;b=(j-1)*segments+(k+1)%segments;c=j*segments+k;d=j*segments+(k+1)%segments
    faces.extend([[a,c,b],[b,c,d]])
 m=trimesh.Trimesh(vertices=verts,faces=faces,process=False);add(name,m,parent,color=col)

def ear_mesh(inner=False):
 vs=[];fs=[];N=12;front=.061 if inner else 0
 for j in range(N+1):
  t=j/N;w=(.162 if not inner else .120)*(1-t)**.77+.003
  # pointed rounded kitten ear, positive z looks towards viewer
  y=t*(.39 if not inner else .31)
  off=front +(.015*(1-t) if not inner else .008)
  for k in range(2): vs.append([-w if k==0 else w,y,off-(t*.041)])
 for j in range(N):
  a=2*j;b=a+1;c=a+2;d=a+3;fs.extend([[a,b,c],[c,b,d]])
 if not inner:
  offset=len(vs);vs.extend([[x,y,z-.055] for x,y,z in vs])
  for j in range(N):
   a=offset+2*j;b=a+1;c=a+2;d=a+3;fs.extend([[a,c,b],[c,d,b]])
   x=2*j;fs.extend([[x,x+2,offset+x],[offset+x,x+2,offset+x+2]])
   x=2*j+1;fs.extend([[x,offset+x,x+2],[offset+x,x+2,offset+x+2]])
 return trimesh.Trimesh(vertices=vs,faces=fs,process=False)

def fur(name,center,scale,count,color,parent='CatRoot',seed=5,limit_face=False):
 rnd=random.Random(seed)
 vs=[];fs=[]
 for i in range(count):
  for tryi in range(24):
   u=rnd.uniform(-1,1);ang=rnd.uniform(0,2*math.pi);ra=math.sqrt(max(0,1-u*u))
   n=np.array([ra*math.cos(ang),u,ra*math.sin(ang)])
   if limit_face and n[2]>.64 and -.38<n[1]<.55:continue
   break
  a=np.cross(n,([1,0,0] if abs(u)>.9 else [0,1,0]));a/=np.linalg.norm(a)+1e-9
  b=np.cross(n,a)
  q=np.array(center)+n*np.array(scale)*(.99)
  w=rnd.uniform(.007,.014);h=rnd.uniform(.025,.073)
  tip=q+n*h+np.array([0,-h*.24,0]);k=len(vs)
  vs.extend([q+a*w,q-a*w,tip])
  fs.append([k,k+1,k+2])
  fs.append([k,k+2,k+1])
 m=trimesh.Trimesh(vertices=vs,faces=fs,process=False)
 add(name,m,parent,color=color)

node('CatRoot','world')
# Body proportions: compact long-haired kitten, large head and four paws
ball('Body',[0,.81,-.13],[.54,.39,.75],color='coat',sub=4)
ball('BodyFurBase',[0,.79,-.13],[.551,.406,.77],color='fur',sub=3)
fur('BodyFurTufts',[0,.81,-.13],[.54,.39,.75],1400,'fur',seed=350)
ball('Chest',[0,.68,.43],[.31,.29,.28],color='charcoal',sub=3)
fur('ChestGoldFuzz',[0,.68,.43],[.31,.29,.28],360,'goldDark',seed=221)
ball('ChestBib',[0,.53,.63],[.17,.13,.07],color='goldDark',sub=3)
# head pivot at center of face
node('HeadPivot','CatRoot',(0,1.18,.54))
ball('HeadCore',[0,0,0],[.49,.46,.47],parent='HeadPivot',color='coat',sub=4)
ball('HeadLower',[0,-.12,.18],[.467,.335,.34],parent='HeadPivot',color='fur',sub=3)
fur('HeadFur',[0,0,0],[.485,.454,.465],1760,'fur',parent='HeadPivot',seed=492,limit_face=True)
fur('HeadGoldOutline',[0,0,0],[.49,.457,.47],260,'goldDark',parent='HeadPivot',seed=180,limit_face=True)
for side,name in [(-1,'Left'),(1,'Right')]:
 # ears are grouped with head so turning or looking moves them together
 node('Ear'+name,'HeadPivot',(side*.337,.375,-.07))
 add('EarShell'+name,ear_mesh(),parent='Ear'+name,color='coat')
 m=ear_mesh(True)
 add('EarInner'+name,m,parent='Ear'+name,xyz=(0,.028,.013),color='pink')
 ball('Cheek'+name,[side*.34,-.18,.16],[.175,.20,.19],parent='HeadPivot',color='fur',sub=3)
 fur('CheekFur'+name,[side*.34,-.18,.16],[.16,.184,.17],180,'goldDark',parent='HeadPivot',seed=990+(1 if side>0 else 0))
 node('EyePivot'+name,'HeadPivot',(side*.21,.09,.416))
 ball('EyeSocket'+name,[0,0,0],[.163,.177,.06],parent='EyePivot'+name,color='charcoal',sub=3)
 ball('EyeIris'+name,[0,0,.056],[.14,.153,.032],parent='EyePivot'+name,color='amber',sub=3,metal=.06,rough=.18)
 ball('EyeRing'+name,[0,0,.078],[.117,.134,.012],parent='EyePivot'+name,color='amberBright',sub=3,metal=.08,rough=.24)
 node('PupilPivot'+name,'EyePivot'+name,(0,0,.082))
 ball('Pupil'+name,[0,0,.005],[.049,.105,.010],parent='PupilPivot'+name,color='eyeBlack',sub=3,metal=.01,rough=.12)
 ball('EyeSpark'+name,[-.036,.05,.017],[.020,.027,.010],parent='PupilPivot'+name,color='highlight',sub=2,rough=.15)
 ball('EyeSparkSmall'+name,[.044,-.041,.014],[.009,.01,.004],parent='PupilPivot'+name,color='highlight',sub=1,rough=.15)
 # Dedicated eyelid controller: translates down on blink, independent of iris.
 node('UpperLid'+name,'EyePivot'+name,(0,.174,.077))
 ball('UpperLidMesh'+name,[0,0,0],[.155,.038,.036],parent='UpperLid'+name,color='coat',sub=3)

 ball('Muzzle'+name,[side*.12,-.22,.44],[.155,.102,.12],parent='HeadPivot',color='cream',sub=3)
 for j in range(3):
  yy=-.185-j*.038
  line(f'Whisker{name}{j}',[(side*.17,yy,.51),(side*.33,yy+.024,.525),(side*.49,yy+.045-j*.02,.47),(side*.64,yy+.06-j*.03,.36)],.0032,'whiskers','HeadPivot')
ball('Nose',[0,-.166,.568],[.074,.044,.037],parent='HeadPivot',color='nose',sub=3,rough=.50)
ball('Mouth',[0,-.235,.533],[.061,.018,.017],parent='HeadPivot',color='charcoal',sub=2)
ball('Chin',[0,-.303,.405],[.17,.075,.104],parent='HeadPivot',color='fur',sub=3)
# collar at chest
ball('Collar',[0,.77,.51],[.26,.056,.081],color='goldDark',sub=3,metal=.7,rough=.25)
ball('Medallion',[0,.645,.69],[.097,.104,.038],color='gold',sub=3,metal=.8,rough=.23)
ball('MedallionInset',[0,.645,.724],[.063,.069,.010],color='goldDark',sub=3,metal=.3,rough=.30)
# P0.5 two-segment quadruped leg rig. This is an articulated node hierarchy
# (shoulder/hip -> elbow/hock -> paw), not a weighted / skinned armature.
# Paw origins are grounded in the rest pose, and toe masses rotate with the paw.
for side,name in [(-1,'Left'),(1,'Right')]:
 for front,segment in [(True,'Front'),(False,'Back')]:
  key=segment+name
  z=.46 if front else -.60
  x=side*(.34 if front else .39)
  node('Leg'+key,'CatRoot',(x,.63,z))
  ball('UpperLeg'+key,[0,-.135,.005],[(.156 if front else .172),.248,.181],parent='Leg'+key,color='coat' if front else 'fur',sub=3)
  # Joint pivots: the paired meshes move with their respective hinges.
  node('Knee'+key,'Leg'+key,(0,-.260,.018 if front else -.015))
  ball('LowerLeg'+key,[0,-.115,.035],[.146,.193,.151],parent='Knee'+key,color='coat' if front else 'fur',sub=3)
  node('Paw'+key,'Knee'+key,(0,-.235,.105))
  ball('PawMesh'+key,[0,-.026,.04],[.185,.117,.196],parent='Paw'+key,color='fur',sub=3)
  for i in [-1,0,1]:
   ball('Toe'+key+str(i),[i*.101,-.048,.193],[.049,.044,.084],parent='Paw'+key,color='goldDark' if i==0 else 'cream',sub=2)
# tail segmented chain, not a decorative immobile object
node('TailRoot','CatRoot',(0,.92,-.76))
ball('TailBase',[0,.04,-.12],[.175,.176,.31],parent='TailRoot',color='coat',sub=3)
node('TailMid','TailRoot',(.03,.16,-.32))
ball('TailMidFur',[0,.03,-.16],[.165,.18,.30],parent='TailMid',color='fur',sub=3)
node('TailTip','TailMid',(.06,.20,-.25))
ball('TailTipFur',[0,.06,-.07],[.195,.218,.18],parent='TailTip',color='goldDark',sub=3)
fur('TailHair',[0,.06,-.07],[.185,.207,.17],300,'goldDark',parent='TailTip',seed=771)
# attach metadata into extras if available; hierarchy is used by standalone player
b=trimesh.exchange.gltf.export_glb(sc,include_normals=True)
open(OUT,'wb').write(b)
print('exported',OUT, 'bytes',len(b),'geometry objects',len(sc.geometry),'graph nodes',len(sc.graph.nodes))
