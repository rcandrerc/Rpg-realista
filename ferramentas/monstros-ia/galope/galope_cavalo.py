# Passa uma animação do cavalo do Quimera (cavalo_n.glb, Quaternius Ultimate Animated Animals, CC0) para o
# esqueleto do lobo (pedido do André 2026-11-05: a corrida antiga parecia de robô).
# Cada osso do lobo recebe o giro do osso do cavalo que faz o mesmo papel (no mundo, a partir da pose de descanso
# de cada um); AMP diminui o giro das patas (a perna do cavalo é bem mais comprida). O quadril sobe e desce na
# proporção da altura. O rabo fica com o balanço da corrida antiga do lobo (o do cavalo cai para baixo).
# Depois do retarget (direção de arte, 2026-11-05): a pata mais baixa encosta no chão (TRAVA amolece a trava), o
# corpo sobe LIFT da altura na suspensão, a coluna arqueia com as patas juntas e estica com elas abertas (flex) e a
# cabeça vai contra o balanço do corpo. 'off' gira coxa/ombro para trás (o lobo descansa com as patas para a frente).
# Números usados no jogo:
# blender -b --python galope_cavalo.py -- Gallop galope galope.blend 1.0 \
#   '{"coxaD":1.2,"canelaD":0.85,"jarreteD":0.8,"coxaE":1.2,"canelaE":0.85,"jarreteE":0.8,"ombroD":1.2,"bracoD":1.1,"ombroE":1.2,"bracoE":1.1}' \
#   '{"chao":-0.03,"off":{"coxaD":72,"coxaE":72,"ombroD":17,"ombroE":17}}'
# (cavalo_n.glb e o lobo.glb antigo, sem correr_cavalo, na pasta)
# Juntas (André 2026-11-05: patas duras): com a pata no ar, o pulso da frente e o pé de trás dobram para trás
# ('pulso', 'pe', graus) e o jarrete fecha ('jarrete'); a base do rabo desfaz parte do giro do quadril ('rabo').
import bpy,sys,mathutils
from mathutils import Matrix,Vector,Quaternion
argv=sys.argv[sys.argv.index('--')+1:]
SRC_ACT, NEW_NAME, OUT = argv[0], argv[1], argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene; sc.render.fps=30
bpy.ops.import_scene.gltf(filepath='cavalo_n.glb')
H=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
bpy.ops.import_scene.gltf(filepath='lobo.glb')
W=[o for o in bpy.data.objects if o.type=='ARMATURE' and o!=H][0]
MAP={'quadril':'Back','coluna':'Torso','peito':'Torso2','pescoco':'Neck2','cabeca':'Head',
 'ombroD':'FrontUpperLeg.L','bracoD':'FrontLowerLeg.L','ombroE':'FrontUpperLeg.R','bracoE':'FrontLowerLeg.R',
 'coxaD':'BackLeg.L','canelaD':'BackUpperLeg.L','jarreteD':'BackLowerLeg.L',
 'coxaE':'BackLeg.R','canelaE':'BackUpperLeg.R','jarreteE':'BackLowerLeg.R',
}
AMP={'coxaD':0.7,'canelaD':0.6,'jarreteD':0.6,'coxaE':0.7,'canelaE':0.6,'jarreteE':0.6,'ombroD':0.9,'bracoD':0.85,'ombroE':0.9,'bracoE':0.85}
import json; AMP.update(json.loads(argv[4]) if len(argv)>4 else {})
AMP0=dict(AMP)
def rest(arm,n): return arm.data.bones[n].matrix_local.to_quaternion()
# horse rest (bones world rot)
act=bpy.data.actions[[a.name for a in bpy.data.actions if a.name.startswith(SRC_ACT)][0]]
H.animation_data.action=act
f0,f1=[int(round(x)) for x in act.frame_range]
print('frames',f0,f1)
W.animation_data_create(); 
wa=bpy.data.actions.new(NEW_NAME); W.animation_data.action=wa
for pb in W.pose.bones: pb.rotation_mode='QUATERNION'
order=[b.name for b in W.data.bones]  # parents before children
# hip translation scale
S=W.data.bones['quadril'].head_local.z/ H.data.bones['Back'].head_local.z
# horse hip rest pos
hrest=H.data.bones['Back'].head_local.copy()
SCALEROT=float(argv[3]) if len(argv)>3 else 1.0
old=[a for a in bpy.data.actions if a.name.startswith('correr') and 'cavalo' not in a.name][0]
of0,of1=old.frame_range
def oldq(bn,ph):
    fr=of0+(of1-of0)*ph
    q=[0,0,0,0]
    for fc in old.fcurves:
        if fc.data_path=='pose.bones["%s"].rotation_quaternion'%bn: q[fc.array_index]=fc.evaluate(fr)
    return Quaternion(q)
import math
K=json.loads(argv[5]) if len(argv)>5 else {}
FLEX=math.radians(K.get('flex',8)); OFF=K.get('off',{}); TRAVA=K.get('trava',0.35); LIFT=K.get('lift',0.06); HEADK=K.get('head',0.7); CHAO=K.get('chao',-0.02)
def escala(D,a):
    ax,an=D.to_axis_angle()
    if an>math.pi: an-=2*math.pi
    return Quaternion(ax,an*a)
PATAS=['pataFD','pataFE','pataTD','pataTE']
def posar(f,c):
    sc.frame_set(f)
    for pb in W.pose.bones: pb.rotation_quaternion=(1,0,0,0); pb.location=(0,0,0)
    bpy.context.view_layer.update()
    for n in order:
        pb=W.pose.bones[n]
        if n in MAP:
            hp=H.pose.bones[MAP[n]]
            D=hp.matrix.to_quaternion() @ rest(H,MAP[n]).inverted()
            a=AMP.get(n,1.0)*SCALEROT
            if a!=1.0: D=escala(D,a)
            if n=='coluna' and c: D=Quaternion((1,0,0),c['flex']/2) @ D
            if n=='peito' and c: D=Quaternion((1,0,0),c['flex']/2) @ D
            if n in OFF: D=Quaternion((1,0,0),math.radians(OFF[n])) @ D
            if n=='cabeca' and c: D=Quaternion((1,0,0),c['cab']) @ D
            q=D @ rest(W,n)
            cur=pb.matrix.copy()
            m=Matrix.Translation(cur.translation) @ q.to_matrix().to_4x4()
            if n=='quadril':
                dp=(hp.matrix.translation - hrest)*S
                if c: dp=Vector((dp.x,dp.y,c['z']))
                m=Matrix.Translation(W.data.bones[n].head_local+dp) @ q.to_matrix().to_4x4()
            pb.matrix=m
            bpy.context.view_layer.update()
    P=W.pose.bones
    return {'min':min(P[p].tail.z for p in PATAS),
            'junta':abs(((P['pataFD'].tail+P['pataFE'].tail)/2-(P['pataTD'].tail+P['pataTE'].tail)/2).y),
            'z':(P['quadril'].head-W.data.bones['quadril'].head_local).z,
            'cabp':math.atan2((P['cabeca'].tail-P['cabeca'].head).z,-(P['cabeca'].tail-P['cabeca'].head).y),
            'corp':math.atan2((P['peito'].head-P['quadril'].head).z,-(P['peito'].head-P['quadril'].head).y)}
fr=list(range(f0,f1+1))
FOLD_F=math.radians(K.get('pulso',70)); FOLD_T=math.radians(K.get('pe',55)); HOCK=math.radians(K.get('jarrete',20)); RABO=K.get('rabo',0.8)
def girar(pb,ang):
    M=pb.matrix.copy(); h=M.translation.copy()
    pb.matrix=Matrix.Translation(h)@Matrix.Rotation(ang,4,'X')@Matrix.Translation(-h)@M
    bpy.context.view_layer.update()
def sobe(x,a,b): t=max(0,min(1,(x-a)/(b-a))); return t*t*(3-2*t)
q_rest_quad=rest(W,'quadril')
def juntas(f):
    P=W.pose.bones
    # rabo: desfaz parte do giro do quadril para a base do rabo não dobrar a malha (a ponta afinava num espinho)
    d=(P['quadril'].matrix.to_quaternion() @ q_rest_quad.inverted()).to_euler('XYZ').x
    girar(P['cauda1'],-RABO*d)
    # patas no ar: o pulso (frente) e o pé (trás) dobram para trás e o jarrete fecha um pouco
    for s in 'DE':
        h=P['pataF'+s].head.z
        girar(P['pataF'+s],SINAL*FOLD_F*sobe(h,0.06,0.2))
        h=P['pataT'+s].head.z
        k=sobe(h,0.05,0.18)
        girar(P['jarrete'+s],SINAL*HOCK*k)
        girar(P['pataT'+s],SINAL*FOLD_T*k)
SINAL=K.get('sinal',1)
m1={f:posar(f,None) for f in fr}
# 1) coluna: arqueia com as patas juntas (patas da frente e de trás perto), estica com elas abertas
js=[m1[f]['junta'] for f in fr]; jmin,jmax=min(js),max(js)
flex={f:FLEX*(1-2*(m1[f]['junta']-jmin)/(jmax-jmin)) for f in fr}
m2={f:posar(f,{'flex':flex[f],'cab':0,'z':m1[f]['z']}) for f in fr}
# 2) corpo: a pata mais baixa encosta no chão; na suspensão (patas juntas, todas no ar) o corpo sobe LIFT da altura
alt=W.data.bones['quadril'].head_local.z
base={f:m2[f]['z']-(m2[f]['min']-CHAO) for f in fr}
fs=max(fr,key=lambda f:m2[f]['min']); n=len(fr)-1
def bump(f):
    d=min(abs(f-fs),n-abs(f-fs))/n
    return math.cos(min(1,d/0.22)*math.pi/2)**2
bm=sum(base.values())/len(fr)
z={f:bm+TRAVA*(base[f]-bm)+LIFT*alt*bump(f) for f in fr}
zs=[z[f] for f in fr]; zm=sum(zs)/len(zs)
# 3) cabeça: contra o balanço do corpo (focinho mais parado que o corpo)
cm=sum(m2[f]['corp'] for f in fr)/len(fr)
cab={f:-HEADK*(m2[f]['corp']-cm) for f in fr}
for f in fr:
    r=posar(f,{'flex':flex[f],'cab':cab[f],'z':z[f]})
    print('Q %2d min %.3f z %.3f flex %.1f cab %.1f'%(f,r['min'],z[f],math.degrees(flex[f]),math.degrees(cab[f])))
    for i in range(1,6):
        pb=W.pose.bones['cauda%d'%i]; pb.rotation_quaternion=oldq(pb.name,(f-f0)/(f1-f0))
    bpy.context.view_layer.update()
    juntas(f)
    for pb in W.pose.bones:
        pb.keyframe_insert('rotation_quaternion',frame=f-f0)
        if pb.name=='quadril': pb.keyframe_insert('location',frame=f-f0)
print('done', f1-f0)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
