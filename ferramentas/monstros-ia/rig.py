# Esqueleto do lobo, versão 2: corpo mais comprido e largo, pernas mais curtas,
# rabo com 5 ossos e mechas de pelo (cartões com alfa).
import bpy,sys,math
from mathutils import Vector
src,pelo_png,out=sys.argv[-3],sys.argv[-2],sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
o=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
for x in list(bpy.context.scene.objects): x.select_set(x==o)
bpy.context.view_layer.objects.active=o
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for x in list(bpy.context.scene.objects):
    if x!=o: bpy.data.objects.remove(x)
zmin=min(v.co.z for v in o.data.vertices)
for v in o.data.vertices: v.co.z-=zmin
o.name='Lobo'
# ---- proporção (coordenadas com o chão em z=0; cabeça para -y, rabo para +y)
def cl(u): return min(max(u,0.0),1.0)
def sm(u): u=cl(u); return u*u*(3-2*u)
YA,YB,EXTRA,GLOBAL=-0.18,0.09,0.18,1.12   # estica o tronco entre o ombro e a coxa
BARRIGA,PERNA,LARG=0.30,0.85,0.22
def F(c):
    x,y,z=c
    rabo=sm((y-0.14)/0.06)
    zl=z*PERNA if z<BARRIGA else z-BARRIGA*(1-PERNA)
    z2=zl*(1-rabo)+(z-BARRIGA*(1-PERNA))*rabo
    y2=GLOBAL*(y+EXTRA*cl((y-YA)/(YB-YA)))
    wy=0.15+0.85*sm((y+0.46)/0.08)*(1-sm((y-0.13)/0.08))
    wz=0.3+0.7*sm((z-0.18)/0.14)
    return Vector((x*(1+LARG*wy*wz),y2,z2))
for v in o.data.vertices: v.co=F(v.co)
G=-0.35
def P(x,y,z): return F(Vector((x,y,z-G)))
B={
 'quadril':(P(0,0.14,0.13),P(0,0.0,0.17),None),
 'coluna':(P(0,0.0,0.17),P(0,-0.16,0.17),'quadril'),
 'peito':(P(0,-0.16,0.17),P(0,-0.27,0.16),'coluna'),
 'pescoco':(P(0,-0.27,0.16),P(0,-0.36,0.17),'peito'),
 'cabeca':(P(0,-0.36,0.17),P(0,-0.50,0.10),'pescoco'),
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
# rabo: linha do meio do rabo original, dividida em 5 ossos iguais
linha=[P(0,0.16,0.10),P(0,0.30,-0.04),P(0,0.42,-0.15),P(0,0.50,-0.24)]
segL=[(linha[i+1]-linha[i]).length for i in range(3)]; TOT=sum(segL)
def no_rabo(t):  # ponto e direção a uma fração t do comprimento
    d=t*TOT
    for i in range(3):
        if d<=segL[i] or i==2:
            f=min(d/segL[i],1.0); return linha[i].lerp(linha[i+1],f),(linha[i+1]-linha[i]).normalized()
        d-=segL[i]
NC=5
for i in range(NC):
    B['cauda%d'%(i+1)]=(no_rabo(i/NC)[0],no_rabo((i+1)/NC)[0],'quadril' if i==0 else 'cauda%d'%i)
arm_d=bpy.data.armatures.new('Esqueleto'); arm=bpy.data.objects.new('Esqueleto',arm_d)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT')
for n,(h,t,p) in B.items():
    b=arm_d.edit_bones.new(n); b.head=h; b.tail=t
for n,(h,t,p) in B.items():
    if p: arm_d.edit_bones[n].parent=arm_d.edit_bones[p]; arm_d.edit_bones[n].use_connect=(arm_d.edit_bones[p].tail-arm_d.edit_bones[n].head).length<1e-4
bpy.ops.object.mode_set(mode='OBJECT')
from mathutils.geometry import intersect_point_line
segs={n:(h,t) for n,(h,t,p) in B.items()}
def lado_ok(n,x):
    if n[-1]=='E' and n!='quadril': return x<0.02
    if n[-1]=='D': return x>-0.02
    return True
def pesar(ob,suave=0.015):
    for n in segs:
        if n not in ob.vertex_groups: ob.vertex_groups.new(name=n)
    for v in ob.data.vertices:
        c=v.co; ds=[]
        for n,(h,t) in segs.items():
            if not lado_ok(n,c.x): continue
            q,f=intersect_point_line(c,h,t); f=min(max(f,0),1)
            ds.append(((c-(h+(t-h)*f)).length,n))
        ds.sort(); d0=ds[0][0]
        ws=[(math.exp(-(d-d0)/suave),n) for d,n in ds[:4] if d<d0+0.06]
        s=sum(w for w,_ in ws)
        for w,n in ws: ob.vertex_groups[n].add([v.index],w/s,'REPLACE')
    bpy.context.view_layer.objects.active=ob
    for x in bpy.context.scene.objects: x.select_set(x==ob)
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    ob.parent=arm; mod=ob.modifiers.new('Armature','ARMATURE'); mod.object=arm
pesar(o)
# ---- mechas do rabo: tufos de 3 cartões girados 60° em volta do eixo (de trás fica redondo),
# cada cartão curvado (3 fileiras de vértices) e inclinado para trás, como um espanador
import random; random.seed(3)
from mathutils import Matrix
vs=[];fs=[];uvs=[];ns=[]
X=Vector((1,0,0))
ANEIS=9
for a in range(ANEIS+1):
    t=0.06+0.94*a/ANEIS; p,D=no_rabo(min(t,0.999))
    Ry=D.cross(X).normalized()
    r=0.07*(1-0.45*t)+0.02*math.sin(math.pi*t)
    k=5 if a<ANEIS else 3
    for j in range(k):
        th=2*math.pi*j/k+a*0.7+random.uniform(-0.25,0.25)
        n=(X*math.cos(th)+Ry*math.sin(th)).normalized()
        incl=math.radians(28 if a<ANEIS else 10)
        dc=(D*math.cos(incl)+n*math.sin(incl)).normalized()
        L=(0.13+0.04*math.sin(math.pi*t))*random.uniform(0.85,1.1); Wd=0.085*(1-0.3*t)
        base=p+n*r*(0.35 if a<ANEIS else 0.0)-dc*0.01
        for pl in range(3):
            # plano girado em volta da direção da mecha
            rot=Matrix.Rotation(math.radians(60*pl),3,dc)
            wv=(rot@n.cross(D)).normalized(); nout=(rot@n).normalized()
            if nout.dot(n)<0: nout=-nout
            u0=random.choice([0,0.5]); i0=len(vs)
            for f,(dv,lw) in enumerate(((0,1.0),(0.5,0.85),(1.0,0.55))):
                # curva: a ponta dobra para fora (afasta do eixo do rabo)
                c=base+dc*L*dv+n*(0.025*dv*dv)
                vs+=[c-wv*Wd*lw/2,c+wv*Wd*lw/2]; uvs+=[(u0,dv),(u0+0.5,dv)]
                nn=(n*0.75+nout*0.15+dc*0.1).normalized(); ns+=[nn,nn]
            for f in range(2):
                b0=i0+2*f; fs.append((b0,b0+1,b0+3,b0+2))
me=bpy.data.meshes.new('Pelo'); me.from_pydata([tuple(v) for v in vs],[],fs); me.update()
ul=me.uv_layers.new(name='UVMap')
for p in me.polygons:
    for li in p.loop_indices: ul.data[li].uv=uvs[me.loops[li].vertex_index]
me.normals_split_custom_set([tuple(ns[me.loops[li].vertex_index]) for p in me.polygons for li in p.loop_indices])
pelo=bpy.data.objects.new('Pelo',me); bpy.context.scene.collection.objects.link(pelo)
mat=bpy.data.materials.new('lobo_pelo'); mat.use_nodes=True; mat.blend_method='CLIP'; mat.alpha_threshold=0.5; mat.use_backface_culling=False
nt=mat.node_tree; bsdf=nt.nodes['Principled BSDF']; tx=nt.nodes.new('ShaderNodeTexImage'); import os; tx.image=bpy.data.images.load(os.path.abspath(pelo_png)); tx.image.name='lobo_pelo'
nt.links.new(tx.outputs['Color'],bsdf.inputs['Base Color']); nt.links.new(tx.outputs['Alpha'],bsdf.inputs['Alpha'])
bsdf.inputs['Roughness'].default_value=0.9; bsdf.inputs['Metallic'].default_value=0.0
me.materials.append(mat)
# só ossos do rabo e quadril pesam nas mechas
keep={n for n in segs if n.startswith('cauda') or n=='quadril'}
segs={n:v for n,v in segs.items() if n in keep}
pesar(pelo,0.03)
print('ALT_CERNELHA',max(v.co.z for v in o.data.vertices if -0.2<v.co.y<-0.05 and abs(v.co.x)<0.05))
fo=min(v.co.y for v in o.data.vertices); print('FOCINHO',fo,'BASE_RABO',B['cauda1'][0].y,'COMP',B['cauda1'][0].y-fo)
print('TRIS',sum(len(p.vertices)-2 for ob in (o,pelo) for p in ob.data.polygons))
bpy.ops.wm.save_as_mainfile(filepath=out)
