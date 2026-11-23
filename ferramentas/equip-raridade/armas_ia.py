# Teste do caminho da IA para peças duras (setor de arte, 2026-11-23): espada, cajado e manto de ombros do TRELLIS,
# deitados de pé e no mesmo tamanho das peças feitas à mão (armas3_r3.glb), material sem metal e dos dois lados.
# Rodar: blender -b -P armas_ia.py -- pasta_dos_glb saida.glb
import bpy, sys, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]
PASTA, SAI = a[0], a[1]
AQUI = '/home/user/rpg-realista/ferramentas/equip-raridade'
bpy.ops.wm.read_factory_settings(use_empty=True)
def importar(arq):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=arq)
    ms = [o for o in bpy.data.objects if o not in antes and o.type == 'MESH']
    for o in ms:
        o.data.transform(o.matrix_world); o.matrix_world = Matrix(); o.parent = None
    return ms
def caixa(o):
    vs = [v.co for v in o.data.vertices]
    return (Vector((min(p.x for p in vs), min(p.y for p in vs), min(p.z for p in vs))),
            Vector((max(p.x for p in vs), max(p.y for p in vs), max(p.z for p in vs))))
ref = {o.name.split('.')[0]: caixa(o) for o in importar(AQUI + '/armas3_r3.glb')}
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
print('REF', {k: (tuple(round(x, 3) for x in v[0]), tuple(round(x, 3) for x in v[1])) for k, v in ref.items()})
def de_pe(o):
    # eixo principal (a IA deixa a peça na diagonal, como no desenho) -> Z
    import numpy as np
    P = np.array([tuple(v.co) for v in o.data.vertices])
    w, V = np.linalg.eigh(np.cov((P - P.mean(0)).T))
    ax = Vector(V[:, -1].tolist()).normalized()
    print("EIXO", o.name, ax, w)
    o.data.transform(ax.rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4())
    # segundo eixo (a largura da guarda) -> X
    P = np.array([tuple(v.co) for v in o.data.vertices])
    C = np.cov((P[:, :2] - P[:, :2].mean(0)).T)
    w2, V2 = np.linalg.eigh(C)
    ang = math.atan2(V2[1, -1], V2[0, -1])
    o.data.transform(Matrix.Rotation(-ang, 4, 'Z'))
    # a parte mais larga (guarda / cabeça) vai para onde deve
    mn, mx = caixa(o)
    def largura(z0, z1):
        vs = [v.co for v in o.data.vertices if z0 <= v.co.z <= z1]
        return (max(p.x for p in vs) - min(p.x for p in vs)) if vs else 0
    h = mx.z - mn.z
    return largura(mn.z, mn.z + h * 0.45), largura(mx.z - h * 0.45, mx.z)
def encaixar(o, alvo, larga_em_cima):
    baixo, cima = de_pe(o)
    if (cima > baixo) != larga_em_cima:
        o.data.transform(Matrix.Rotation(math.radians(180), 4, 'Y'))
    mn, mx = caixa(o); tmn, tmx = alvo
    s = (tmx.z - tmn.z) / (mx.z - mn.z)
    c = (mn + mx) / 2; tc = (tmn + tmx) / 2
    o.data.transform(Matrix.Translation(Vector((tc.x, tc.y, tmn.z))) @ Matrix.Scale(s, 4) @ Matrix.Translation(-Vector((c.x, c.y, mn.z))))
def material(o):
    for m in o.data.materials:
        m.name = 'ia_' + o.name
        m.use_backface_culling = False
        for nd in m.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                nd.inputs['Metallic'].default_value = 0.0
                nd.inputs['Roughness'].default_value = 0.5
                # brilho próprio nas partes acesas da textura (brasa)
                tx = [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']
                if tx:
                    m.node_tree.links.new(tx[0].outputs['Color'], nd.inputs['Emission Color'])
                    nd.inputs['Emission Strength'].default_value = 0.25
saida = []
e = importar(PASTA + '/espada_lendaria.glb')[0]; e.name = 'espada'
encaixar(e, ref['espada'], False)  # guarda embaixo, ponta em cima
material(e); saida.append(e)
c = importar(PASTA + '/cajado_lendario.glb')[0]; c.name = 'cajado'
encaixar(c, ref['cajado'], True)  # cabeça em cima
material(c); saida.append(c)
m = importar(PASTA + '/ombreira_lendaria.glb')[0]; m.name = 'peito_manto'
mn, mx = caixa(m); cc = (mn + mx) / 2
s = 0.44 / (mx.x - mn.x)
m.data.transform(Matrix.Translation(Vector((0, 0.01, 1.355))) @ Matrix.Scale(s, 4) @ Matrix.Translation(-cc))
material(m); saida.append(m)
for o in saida:
    o.data.calc_loop_triangles(); print('PECA', o.name, len(o.data.loop_triangles), caixa(o))
bpy.ops.object.select_all(action='DESELECT')
for o in saida: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=SAI, use_selection=True, export_format='GLB', export_materials='EXPORT', export_yup=True, export_image_format='JPEG')
