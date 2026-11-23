# Teste do caminho da IA para roupa (setor de arte, 2026-11-23): pega uma peça feita no TRELLIS (desenho do FLUX)
# e veste na Ruiva. A peça da IA vem com os braços caídos e com o manequim junto; a Ruiva está em pose T. Então:
#  1. baixa os braços da Ruiva até a pose da peça; 2. encaixa e escala a peça no corpo; 3. apaga o manequim (cinza
#  sem cor na textura); 4. empurra para fora do corpo o que ficou dentro; 5. copia os pesos do ponto mais perto do
#  corpo posado; 6. desfaz a pose vértice a vértice (inversa da pele) para a roupa ficar em pose T, como o esqueleto.
# Rodar: blender -b -P vestir_ia.py -- entrada.glb saida.glb escala topo_z y braco_graus folga [cinza_s]
import bpy, sys, math, colorsys, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
ENT, SAI = a[0], a[1]
ESC, TOPO, YC, BRACO, FOLGA = map(float, a[2:7])
CINZA = float(a[7]) if len(a) > 7 else 0.07
CLARO = float(a[8]) if len(a) > 8 else 0.6
RUIVA = '/home/user/rpg-realista/godot-prototipo/modelos/ruiva.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RUIVA)
ARM = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
ruiva = set(bpy.data.objects)
# 1. braços caídos
for lado, s in (('L', 1), ('R', -1)):
    pb = ARM.pose.bones['J_Bip_%s_UpperArm' % lado]
    h = pb.bone.head_local
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(s * math.radians(BRACO), 4, 'Y') @ Matrix.Translation(-h) @ pb.matrix
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
VS, PO, PE = [], [], []
for o in bpy.data.objects:
    if o.type != 'MESH' or not any(k in m.name for m in o.data.materials for k in ('Body_00_SKIN', 'Tops', 'Bottoms')):
        continue
    me = o.evaluated_get(dg).to_mesh()
    n = len(VS)
    VS += [o.matrix_world @ v.co for v in me.vertices]
    PO += [[i + n for i in p.vertices] for p in me.polygons]
    nomes = {g.index: g.name for g in o.vertex_groups}
    PE += [{nomes[g.group]: g.weight for g in v.groups if g.weight > 0.001} for v in o.data.vertices]
BVH = BVHTree.FromPolygons(VS, PO)
# 2. a peça
bpy.ops.import_scene.gltf(filepath=ENT)
novos = [o for o in bpy.data.objects if o not in ruiva and o.type == 'MESH']
for o in novos:
    o.data.transform(o.matrix_world); o.matrix_world = Matrix()
G = novos[0]
if len(novos) > 1:
    with bpy.context.temp_override(active_object=G, selected_editable_objects=novos):
        bpy.ops.object.join()
me = G.data
xs = [v.co for v in me.vertices]
mn = Vector((min(p.x for p in xs), min(p.y for p in xs), min(p.z for p in xs)))
mx = Vector((max(p.x for p in xs), max(p.y for p in xs), max(p.z for p in xs)))
c = (mn + mx) / 2
for v in me.vertices:
    p = (v.co - Vector((c.x, c.y, mx.z))) * ESC
    v.co = p + Vector((0, YC, TOPO))
# 3. manequim fora (pela cor da textura em cada face)
img = None
for m in me.materials:
    for nd in m.node_tree.nodes:
        if nd.type == 'TEX_IMAGE' and nd.image:
            img = nd.image
W, H = img.size
px = img.pixels[:]
uv = me.uv_layers.active.data
apagar = []
for p in me.polygons:
    u = sum((uv[l].uv for l in p.loop_indices), Vector((0, 0))) / p.loop_total
    i = (min(H - 1, max(0, int(u.y * H))) * W + min(W - 1, max(0, int(u.x * W)))) * 4
    h_, s_, v_ = colorsys.rgb_to_hsv(px[i], px[i + 1], px[i + 2])
    if s_ < CINZA and v_ > CLARO:
        apagar.append(p.index)
import bmesh
bm = bmesh.new(); bm.from_mesh(me)
bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.faces[i] for i in apagar], context='FACES')
# pedaços soltos pequenos (resto do manequim)
ilhas, visto = [], set()
for f in bm.faces:
    if f.index in visto: continue
    pilha, ilha = [f], []
    visto.add(f.index)
    while pilha:
        g = pilha.pop(); ilha.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in visto:
                    visto.add(h.index); pilha.append(h)
    ilhas.append(ilha)
bm.faces.index_update()
pequenas = [f for il in ilhas if len(il) < 40 for f in il]
bmesh.ops.delete(bm, geom=pequenas, context='FACES')
bm.to_mesh(me); bm.free()
print('APAGADAS', len(apagar), 'ilhas', len(ilhas), 'faces', len(me.polygons))
PREVIA = os.environ.get('PREVIA', '')
def foto(nome):
    if not PREVIA: return
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.render.resolution_x = 500; sc.render.resolution_y = 700
    if not sc.world:
        w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
        w.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.78, 0.82, 1)
    for ang in (0, 90):
        cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
        r = math.radians(ang)
        cam.location = Vector((math.sin(r) * 3.2, -math.cos(r) * 3.2, 1.05)); cam.rotation_euler = (math.radians(90), 0, r)
        cam.data.lens = 50
        sc.render.filepath = PREVIA + nome + '_%d.png' % ang
        bpy.ops.render.render(write_still=True)
for o in ruiva:
    if o.type == 'MESH' and any(k in m.name for m in o.data.materials for k in ('Tops', 'Bottoms', 'Tie')):
        o.hide_render = True
foto('a')
# 4. nada dentro do corpo
dentro = 0
for v in me.vertices:
    loc, nrm, idx, d = BVH.find_nearest(v.co)
    if loc is None: continue
    if (v.co - loc).dot(nrm) < 0 or d < FOLGA:
        v.co = loc + nrm * FOLGA; dentro += 1
print('EMPURRADOS', dentro, 'de', len(me.vertices))
foto('b')
# 5. pesos do corpo posado
grupos = {}
pesos_v = []
for v in me.vertices:
    loc, nrm, idx, d = BVH.find_nearest(v.co)
    soma, tot = {}, 0.0
    for i in PO[idx]:
        k = 1.0 / ((VS[i] - loc).length + 1e-4)
        for g, w in PE[i].items():
            soma[g] = soma.get(g, 0.0) + w * k
    top = sorted(soma.items(), key=lambda x: -x[1])[:4]
    s = sum(w for _, w in top) or 1.0
    top = [(g, w / s) for g, w in top]
    pesos_v.append(top)
    for g, w in top:
        if g not in grupos:
            grupos[g] = G.vertex_groups.new(name=g)
        grupos[g].add([v.index], w, 'REPLACE')
# 6. desfazer a pose
D = {pb.name: pb.matrix @ pb.bone.matrix_local.inverted() for pb in ARM.pose.bones}
for v, top in zip(me.vertices, pesos_v):
    M = Matrix(((0, 0, 0, 0),) * 4)
    for g, w in top:
        M = M + D.get(g, Matrix()) * w
    v.co = M.inverted() @ v.co
for pb in ARM.pose.bones:
    pb.matrix_basis = Matrix()
for m in me.materials:
    m.name = 'ia_' + m.name
    m.use_backface_culling = False  # a malha do TRELLIS tem faces viradas: os dois lados
    for nd in m.node_tree.nodes:
        if nd.type == 'BSDF_PRINCIPLED':
            nd.inputs['Metallic'].default_value = 0.0
            nd.inputs['Roughness'].default_value = 0.85
G.name = 'peito_ia'
G.parent = ARM
md = G.modifiers.new('arm', 'ARMATURE'); md.object = ARM
bpy.ops.object.select_all(action='DESELECT')
ARM.select_set(True); G.select_set(True)
bpy.ops.export_scene.gltf(filepath=SAI, use_selection=True, export_format='GLB', export_materials='EXPORT',
                          export_yup=True, export_skins=True, export_apply=False, export_image_format='JPEG')
print('TRIS', sum(len(p.vertices) - 2 for p in me.polygons))
