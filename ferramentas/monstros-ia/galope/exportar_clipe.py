# Exporta só o lobo com o clipe novo (o cavalo sai da cena): blender -b --python exportar_clipe.py -- galope.blend galope galope_tmp.glb
import bpy,sys
argv=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=argv[0])
H=[o for o in bpy.data.objects if o.type=='ARMATURE' and o.name=='AnimalArmature'][0]
for o in list(bpy.data.objects):
    p=o
    while p.parent: p=p.parent
    if p==H or o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
W=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
keep=argv[1]
for a in list(bpy.data.actions):
    if a.name!=keep: bpy.data.actions.remove(a)
W.animation_data.action=bpy.data.actions[keep]
bpy.context.scene.render.fps=30
bpy.ops.export_scene.gltf(filepath=argv[2],export_animation_mode='ACTIONS',export_force_sampling=True,export_optimize_animation_size=False)
