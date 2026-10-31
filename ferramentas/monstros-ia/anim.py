import bpy,sys,math
src,out=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
arm=bpy.data.objects['Esqueleto']; sc=bpy.context.scene; sc.render.fps=30
for pb in arm.pose.bones: pb.rotation_mode='XYZ'
R=math.radians
def acao(nome,dur,fn,passos=None):
    a=bpy.data.actions.new(nome); arm.animation_data_create(); arm.animation_data.action=a
    n=int(dur*30); passos=passos or max(8,n//2)
    for i in range(passos+1):
        f=i*n/passos; t=i/passos
        for pb in arm.pose.bones: pb.rotation_euler=(0,0,0); pb.location=(0,0,0)
        fn(t)
        for pb in arm.pose.bones:
            pb.keyframe_insert('rotation_euler',frame=f+1); pb.keyframe_insert('location',frame=f+1)
    tr=arm.animation_data.nla_tracks.new(); tr.name=nome; tr.strips.new(nome,1,a); arm.animation_data.action=None
P=arm.pose.bones
from mathutils import Vector
def mv(n,x,y,z):  # deslocamento em coordenadas do mundo
    m=arm.data.bones[n].matrix_local.to_3x3().inverted(); d=m@Vector((x,y,z))
    for i in range(3): P[n].location[i]+=d[i]
def rx(n,g): P[n].rotation_euler[0]+=R(g)
def s(t,fase=0): return math.sin(2*math.pi*(t+fase))
def perna_f(l,ang,dobra):  # dianteira: ang>0 pra frente
    rx('ombro'+l,ang); rx('braco'+l,-max(0,dobra)); rx('pataF'+l,max(0,dobra)*0.6)
def perna_t(l,ang,dobra):
    rx('coxa'+l,ang); rx('canela'+l,max(0,dobra)*0.7); rx('jarrete'+l,-max(0,dobra)*0.7)
def rabo(t,lado,sobe,base=0,atraso=0.09,cresce=0.35):
    # corrente de 5 ossos: cada osso segue o anterior com atraso, mais solto na ponta
    for i in range(5):
        k=1+cresce*i; n='cauda%d'%(i+1)
        P[n].rotation_euler[2]+=R(lado*k*s(t,-atraso*i)); rx(n,base/5+sobe*k*s(t,-atraso*i-0.1))
def parado(t):
    rx('coluna',1.5*s(t)); rx('peito',-1.5*s(t)); rx('pescoco',2*s(t,0.1)); rx('cabeca',2*s(t,0.2))
    rabo(t,5,1.5)
def andar(t):
    for l,fa in (('E',0),('D',0.5)):
        perna_f(l,22*s(t,fa),30*s(t,fa+0.25)); perna_t(l,20*s(t,fa+0.5),30*s(t,fa+0.75))
    mv('quadril',0,0,0.008*s(2*t)); rx('cabeca',3*s(2*t))
    rabo(t,8,3,base=-10)
def correr(t):
    for l,fa in (('E',0),('D',0.08)):
        perna_f(l,30*s(t,fa),40*s(t,fa+0.25)); perna_t(l,28*s(t,fa+0.5),40*s(t,fa+0.75))
    rx('coluna',8*s(t,0.5)); rx('peito',-6*s(t,0.5)); mv('quadril',0,0,0.02*s(t,0.25))
    rx('pescoco',-6*s(t,0.5))
    # correndo o rabo levanta e vai para trás, chicoteando em onda (sobe e desce com o galope, e um pouco de lado)
    rx('cauda1',30); rabo(t,4,9,base=15,atraso=0.12,cresce=0.45); rabo(2*t,0,3,atraso=0.1)
def atacar(t):
    # agacha (0-0.35), bote (0.35-0.55), volta
    if t<0.35: k=t/0.35; b=0
    elif t<0.55: k=1-(t-0.35)/0.2; b=(t-0.35)/0.2
    else: k=0; b=1-(t-0.55)/0.45
    for l in 'ED':
        rx('ombro'+l,-12*k+25*b); rx('braco'+l,-20*k); rx('coxa'+l,-15*k-10*b); rx('canela'+l,25*k); rx('jarrete'+l,-25*k)
    mv('quadril',0,-0.12*b,-0.04*k)  # pra frente
    rx('pescoco',10*k-15*b); rx('cabeca',-12*k+20*math.sin(math.pi*b))
    for i in range(5): rx('cauda%d'%(i+1),-8*k+6*b*(1+0.3*i)*math.sin(math.pi*b))
def dano(t):
    k=math.sin(math.pi*t); mv('quadril',0,0.04*k,0); rx('pescoco',15*k); rx('cabeca',15*k); rx('coluna',-6*k)
    for i in range(5): rx('cauda%d'%(i+1),6*k*(1+0.3*i))
def morrer(t):
    k=min(1,t/0.6); e=k*k
    P['quadril'].rotation_euler[1]+=R(85*e); mv('quadril',0,0,-0.25*e)
    for l in 'ED': rx('ombro'+l,25*k); rx('coxa'+l,-20*k); rx('braco'+l,-25*k)
    rx('pescoco',-20*k)
    for i in range(5): rx('cauda%d'%(i+1),-4*k*(i+1)*0.6)
acao('parado',2.0,parado,16); acao('andar',1.0,andar,16); acao('correr',0.6,correr,12)
acao('atacar',0.9,atacar,18); acao('dano',0.4,dano,8); acao('morrer',1.2,morrer,12)
bpy.ops.wm.save_as_mainfile(filepath=out)
