import bpy,sys,math
from mathutils import Vector
src,out=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
o=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
for x in list(bpy.context.scene.objects):
    x.select_set(x==o)
bpy.context.view_layer.objects.active=o
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for x in list(bpy.context.scene.objects):
    if x!=o: bpy.data.objects.remove(x)
# chao em z=0
zmin=min(v.co.z for v in o.data.vertices)
for v in o.data.vertices: v.co.z-=zmin
o.name='Lobo'
G=-0.35  # z original do chao
def P(x,y,z): return Vector((x,y,z-G))
B={ # nome: (cabeca, cauda, pai)
 'quadril':(P(0,0.14,0.13),P(0,0.0,0.17),None),
 'coluna':(P(0,0.0,0.17),P(0,-0.16,0.17),'quadril'),
 'peito':(P(0,-0.16,0.17),P(0,-0.27,0.16),'coluna'),
 'pescoco':(P(0,-0.27,0.16),P(0,-0.36,0.17),'peito'),
 'cabeca':(P(0,-0.36,0.17),P(0,-0.50,0.10),'pescoco'),
 'cauda1':(P(0,0.16,0.10),P(0,0.30,-0.04),'quadril'),
 'cauda2':(P(0,0.30,-0.04),P(0,0.42,-0.15),'cauda1'),
 'cauda3':(P(0,0.42,-0.15),P(0,0.50,-0.24),'cauda2'),
}
for s,sx in (('E',-1),('D',1)):
    x=0.10*sx
    B['ombro'+s]=(P(x,-0.17,0.10),P(x,-0.16,-0.10),'peito')
    B['braco'+s]=(P(x,-0.16,-0.10),P(x,-0.24,-0.27),'ombro'+s)
    B['pataF'+s]=(P(x,-0.24,-0.27),P(x,-0.31,-0.34),'braco'+s)
    B['coxa'+s]=(P(x,0.10,0.10),P(x,0.04,-0.06),'quadril')
    B['canela'+s]=(P(x,0.04,-0.06),P(x,0.10,-0.20),'coxa'+s)
    B['jarrete'+s]=(P(x,0.10,-0.20),P(x,0.0,-0.30),'canela'+s)
    B['pataT'+s]=(P(x,0.0,-0.30),P(x,-0.06,-0.345),'jarrete'+s)
arm_d=bpy.data.armatures.new('Esqueleto'); arm=bpy.data.objects.new('Esqueleto',arm_d)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT')
for n,(h,t,p) in B.items():
    b=arm_d.edit_bones.new(n); b.head=h; b.tail=t
for n,(h,t,p) in B.items():
    if p: arm_d.edit_bones[n].parent=arm_d.edit_bones[p]; arm_d.edit_bones[n].use_connect=(arm_d.edit_bones[p].tail-arm_d.edit_bones[n].head).length<1e-4
bpy.ops.object.mode_set(mode='OBJECT')
# pesos por distancia aos ossos (malha do TRELLIS nao e fechada, bone heat falha)
from mathutils.geometry import intersect_point_line
segs={n:(h,t) for n,(h,t,p) in B.items()}
for n in segs: o.vertex_groups.new(name=n)
def lado_ok(n,x):
    if n[-1]=='E' and n!='quadril': return x<0.02
    if n[-1]=='D': return x>-0.02
    return True
for v in o.data.vertices:
    c=v.co; ds=[]
    for n,(h,t) in segs.items():
        if not lado_ok(n,c.x): continue
        q,f=intersect_point_line(c,h,t); f=min(max(f,0),1)
        ds.append(((c-(h+(t-h)*f)).length,n))
    ds.sort(); d0=ds[0][0]
    ws=[(math.exp(-(d-d0)/0.015),n) for d,n in ds[:4] if d<d0+0.06]
    s=sum(w for w,_ in ws)
    for w,n in ws: o.vertex_groups[n].add([v.index],w/s,'REPLACE')
bpy.context.view_layer.objects.active=o
for x in bpy.context.scene.objects: x.select_set(x==o)
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
o.parent=arm; mod=o.modifiers.new('Armature','ARMATURE'); mod.object=arm
bpy.ops.wm.save_as_mainfile(filepath=out)
