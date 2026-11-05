# Passa uma animação do cavalo do Quimera (cavalo_n.glb, Quaternius Ultimate Animated Animals, CC0) para o
# esqueleto do lobo (pedido do André 2026-11-05: a corrida antiga parecia de robô).
# Cada osso do lobo recebe o giro do osso do cavalo que faz o mesmo papel (no mundo, a partir da pose de descanso
# de cada um); AMP diminui o giro das patas (a perna do cavalo é bem mais comprida). O quadril sobe e desce na
# proporção da altura. O rabo fica com o balanço da corrida antiga do lobo (o do cavalo cai para baixo).
# blender -b --python galope_cavalo.py -- Gallop galope galope.blend   (cavalo_n.glb e lobo.glb na pasta)
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
for f in range(f0,f1+1):
    sc.frame_set(f)
    for pb in W.pose.bones: pb.rotation_quaternion=(1,0,0,0); pb.location=(0,0,0)
    bpy.context.view_layer.update()
    for n in order:
        pb=W.pose.bones[n]
        if n in MAP:
            hp=H.pose.bones[MAP[n]]
            D=hp.matrix.to_quaternion() @ rest(H,MAP[n]).inverted()
            a=AMP.get(n,1.0)*SCALEROT
            if a!=1.0: D=Quaternion((1,0,0,0)).slerp(D,a)
            q=D @ rest(W,n)
            cur=pb.matrix.copy()
            m=Matrix.Translation(cur.translation) @ q.to_matrix().to_4x4()
            if n=='quadril':
                dp=(hp.matrix.translation - hrest)*S
                m=Matrix.Translation(W.data.bones[n].head_local+dp) @ q.to_matrix().to_4x4()
            pb.matrix=m
            bpy.context.view_layer.update()
    for i in range(1,6):
        pb=W.pose.bones['cauda%d'%i]; pb.rotation_quaternion=oldq(pb.name,(f-f0)/(f1-f0))
    for pb in W.pose.bones:
        pb.keyframe_insert('rotation_quaternion',frame=f-f0)
        if pb.name=='quadril': pb.keyframe_insert('location',frame=f-f0)
print('done', f1-f0)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
