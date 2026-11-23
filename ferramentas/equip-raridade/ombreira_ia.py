# Ombreira da IA (TRELLIS, 2026-11-23) encaixada nos nossos trajes: o André achou as armas da IA ruins, mas a
# ombreira aproveitável. Peça dura no osso do peito (UpperChest), assentada por cima dos ombros com folga para o
# manto do roupão e o colete da patrulheira. CORPO=m faz a do corpo masculino.
# Rodar: blender -b -P ombreira_ia.py -- ombreira_lendaria.glb     Sai: ombreira_ia.glb / ombreira_ia_m.glb
import os, sys, math
os.environ['SO'] = ''
AQUI_O = os.path.dirname(os.path.abspath(__file__))
ENTRADA = sys.argv[sys.argv.index('--') + 1]
exec(open(os.path.join(AQUI_O, 'modelar3.py')).read())
from mathutils import Vector, Matrix
antes = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=ENTRADA)
novos = [o for o in bpy.data.objects if o not in antes and o.type == 'MESH']
for o in novos:
    o.data.transform(o.matrix_world); o.matrix_world = Matrix(); o.parent = None
om = novos[0]
om.name = 'ombreira_ia'
vs = [v.co for v in om.data.vertices]
mn = Vector((min(p.x for p in vs), min(p.y for p in vs), min(p.z for p in vs)))
mx = Vector((max(p.x for p in vs), max(p.y for p in vs), max(p.z for p in vs)))
print('OMB caixa', mn, mx)
# largura: dos ombros até um pouco além (a manga do roupão e o colete ficam por baixo)
ombro_x = max(abs(p.x) for p in F_PELE['vs'] if 1.29 < p.z < 1.36 and abs(p.y) < 0.12 and abs(p.x) < 0.2)
LARG = 2 * (ombro_x + 0.06)
s = LARG / (mx.x - mn.x)
cc = (mn + mx) / 2
yc = sum(p.y for p in F_PELE['vs'] if 1.25 < p.z < 1.35 and abs(p.x) < 0.1) / max(1, len([p for p in F_PELE['vs'] if 1.25 < p.z < 1.35 and abs(p.x) < 0.1]))
om.data.transform(Matrix.Translation(Vector((0, yc, 1.4))) @ Matrix.Scale(s, 4) @ Matrix.Translation(-cc))
# assenta: desce até a parte de baixo ficar 3,5 cm acima da pele (fora do pescoço)
bvh = F_PELE['bvh']
folga = []
for v in om.data.vertices:
    p = v.co
    if abs(p.x) < 0.09 or abs(p.x) > ombro_x:
        continue
    hit = bvh.ray_cast(Vector((p.x, p.y, 2.0)), Vector((0, 0, -1)), 3.0)
    if hit[0] is not None and hit[0].z < p.z + 0.2:
        folga.append(p.z - hit[0].z)
dz = float(os.environ.get('OMB_Z', '1.27')) - 1.4  # centro no alto do peito: pega os ombros e as pontas sobem ao lado da cabeça
om.data.transform(Matrix.Translation(Vector((0, 0, dz))))
print('OMB ombro_x', round(ombro_x, 3), 'larg', round(LARG, 3), 'desce', round(-dz, 3))
for m_ in om.data.materials:
    m_.name = 'ia_ombreira'
    m_.use_backface_culling = False
    for nd in m_.node_tree.nodes:
        if nd.type == 'BSDF_PRINCIPLED':
            nd.inputs['Metallic'].default_value = 0.0
            nd.inputs['Roughness'].default_value = 0.5
dm = om.modifiers.new('menos', 'DECIMATE')
dm.ratio = 6000 / max(1, len(om.data.polygons))
with bpy.context.temp_override(object=om, active_object=om):
    bpy.ops.object.modifier_apply(modifier='menos')
no_esqueleto(om, False)
bpy.ops.object.select_all(action='DESELECT')
om.select_set(True)
sai = os.path.join(AQUI_O, 'ombreira_ia_m.glb' if MASC else 'ombreira_ia.glb')
bpy.ops.export_scene.gltf(filepath=sai, use_selection=True, export_format='GLB', export_materials='EXPORT', export_yup=True, export_image_format='JPEG')
om.data.calc_loop_triangles()
print('OMB tris', len(om.data.loop_triangles), sai)
