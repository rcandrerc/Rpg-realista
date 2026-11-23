# Proposta de equipamentos por raridade (setor de arte, 2026-11-23): peitoral (com ombreiras) e espada de cada
# raridade, modelados em volta do corpo da Ruiva para as fotos da proposta. NÃO entra no jogo ainda.
# Rodar: blender -b -P ferramentas/equip-raridade/modelar.py  (precisa de godot-prototipo/modelos/ruiva.glb)
# Sai: ferramentas/equip-raridade/pecas_r0.glb ... pecas_r4.glb (Comum, Raro, Épico, Lendário, Mítico).
# Nomes dos objetos dizem onde prendem no jogo: peito* (UpperChest), ombro_e*/ombro_d* (braço), espada* (mão).
# Os materiais saem com nomes (couro, aco, pano, ouro, gema, obsidiana, brasa, perola, cristal, runa): o Godot troca
# cada um pelo shader equip_novo.gdshader (vestir_novo.gd).
# Eixos do Blender: Z para cima, frente do corpo em -Y. Espada: cabo na origem, lâmina para +Z, ponta em 0,924 m.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

AQUI = os.path.dirname(os.path.abspath(__file__))
RUIVA = os.path.join(AQUI, '..', '..', 'godot-prototipo', 'modelos', 'ruiva.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RUIVA)
CORPO = [o for o in bpy.data.objects if o.type == 'MESH' and o.name in ('Body_(merged)', 'Body_(merged)_2')]
deps = bpy.context.evaluated_depsgraph_get()
bm_c = bmesh.new()
for o in CORPO:
    t = bmesh.new()
    t.from_mesh(o.data)
    t.transform(o.matrix_world)
    m = bpy.data.meshes.new('tmp')
    t.to_mesh(m)
    bm_c.from_mesh(m)
BVH = BVHTree.FromBMesh(bm_c)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

MATS = {}
def mat(nome):
    if nome not in MATS:
        m = bpy.data.materials.new(nome)
        MATS[nome] = m
    return MATS[nome]

def objeto(nome, verts, faces, mats_faces, suave=True):
    me = bpy.data.meshes.new(nome)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    nomes = sorted(set(mats_faces))
    for n in nomes:
        me.materials.append(mat(n))
    for f, n in zip(me.polygons, mats_faces):
        f.material_index = nomes.index(n)
        f.use_smooth = suave
    me.validate()
    o = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(o)
    return o

def juntar(objs, nome):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = nome
    return o

def solidificar(o, esp, borda=True):
    md = o.modifiers.new('s', 'SOLIDIFY')
    md.thickness = esp
    md.offset = -1
    md.use_rim = borda
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='s')

def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

# ---------- raio do corpo (rest/T-pose), medido por raio de fora para dentro ----------
def raio_corpo(z, a):
    c = Vector((0, -0.02, z))
    d = Vector((math.sin(a), -math.cos(a), 0))
    hit = BVH.ray_cast(c + d * 0.4, -d, 0.5)
    r = (hit[0] - c).length if hit[0] else 0.1
    lim = 0.165 if z > 1.2 else 0.16
    return min(r, lim / max(abs(math.sin(a)), 0.3) if abs(math.sin(a)) > 0.3 else 0.3)

# ---------- casca do peito ----------
def casca(nome, folga, z_baixo, ponta_v, gola, cava, crista, NA=28, NZ=14, material='aco', alisar=3, barriga=0.0):
    # folga: m para fora do corpo; ponta_v: quanto a frente desce em V; gola: altura do decote; cava: corte do braço
    # crista: aresta no meio do peito (placa forjada); barriga: placa reta na barriga (couraça)
    R = []
    for j in range(NZ):
        t = j / (NZ - 1)
        lin = []
        for i in range(NA):
            a = 2 * math.pi * i / NA - math.pi
            frente = math.cos(a) ** 2 * (1 if math.cos(a) < 0 else 0)  # a=±pi é a frente? ajustado abaixo
            lin.append(a)
        R.append(lin)
    verts, faces = [], []
    grade = []
    for j in range(NZ):
        t = j / (NZ - 1)
        linha = []
        for i in range(NA):
            a = 2 * math.pi * i / NA  # 0 = frente (-Y)
            f = max(0.0, math.cos(a))  # 1 na frente
            costas = max(0.0, -math.cos(a))
            lado = abs(math.sin(a))
            zb = z_baixo - ponta_v * f ** 6
            zt = 1.355 - gola * f ** 3 + 0.01 * costas - cava * ss(0.55, 0.95, lado)
            z = zb + t * (zt - zb)
            r = raio_corpo(z, a)
            linha.append([a, z, r])
        grade.append(linha)
    # alisa o raio (some o desenho do corpo, fica cara de placa)
    for _ in range(alisar):
        nova = [[c[:] for c in l] for l in grade]
        for j in range(NZ):
            for i in range(NA):
                vs = [grade[j][(i - 1) % NA][2], grade[j][(i + 1) % NA][2]]
                if j > 0: vs.append(grade[j - 1][i][2])
                if j < NZ - 1: vs.append(grade[j + 1][i][2])
                nova[j][i][2] = max(grade[j][i][2], 0.5 * grade[j][i][2] + 0.5 * sum(vs) / len(vs))
        grade = nova
    for j in range(NZ):
        for i in range(NA):
            a, z, r = grade[j][i]
            f = max(0.0, math.cos(a))
            r += folga + crista * max(0.0, math.cos(a)) ** 24 + barriga * f ** 2 * ss(1.18, 1.0, z) * 0.6
            r += 0.012 * ss(z_baixo + 0.06, z_baixo - 0.02, z)  # a borda de baixo abre um pouco (saia da couraça)
            verts.append(Vector((math.sin(a) * r, -0.02 - math.cos(a) * r, z)))
    for j in range(NZ - 1):
        for i in range(NA):
            i2 = (i + 1) % NA
            faces.append((j * NA + i, j * NA + i2, (j + 1) * NA + i2, (j + 1) * NA + i))
    o = objeto(nome, verts, faces, [material] * len(faces))
    return o, grade, folga

def friso(nome, o_casca, linha_j, NA, larg, fora, material, cima=True):
    # faixa de borda (friso) seguindo a linha j da casca, um pouco para fora
    me = o_casca.data
    vs = [me.vertices[linha_j * NA + i].co.copy() for i in range(NA)]
    verts, faces = [], []
    for v in vs:
        d = Vector((v.x, v.y + 0.02, 0)).normalized()
        b = v + d * fora
        verts.append(b + Vector((0, 0, larg * (0.5 if cima else -0.5))))
        verts.append(b + d * 0.004)
        verts.append(b - Vector((0, 0, larg * (0.5 if cima else -0.5))))
    for i in range(NA):
        i2 = (i + 1) % NA
        for k in range(2):
            faces.append((i * 3 + k, i2 * 3 + k, i2 * 3 + k + 1, i * 3 + k + 1))
    return objeto(nome, verts, faces, [material] * len(faces))

def lame_ombro(nome, lado, x0, x1, r0, r1, zc, ang, material, desloca=Vector((0, 0, 0)), pontas=0, borda=None):
    # ombreira em sino por cima do ombro, já com o braço caído (pose do jogo): presa no osso do ombro (clavícula).
    # x0..x1: de onde começa a onde termina, medido do ombro para fora; ang: quanto cobre de frente a trás.
    th = math.radians(28)
    A = Vector((lado * math.sin(th), 0, -math.cos(th)))  # eixo do braço caído
    O = Vector((lado * math.cos(th), 0, math.sin(th)))  # para fora e para cima
    F = Vector((0, -1, 0))
    J = Vector((lado * 0.115, -0.005, 1.30 + (zc - 1.318)))
    NU, NV = 7, 12
    verts, faces = [], []
    for u in range(NU):
        s = u / (NU - 1)
        d = -0.06 + (x1 - x0) * 1.1 * s - (x0 - 0.1) * 0.5
        r = r0 + (r1 - r0) * s ** 0.7
        r *= 0.55 + 0.45 * math.sin(min(1.0, s * 2.0 + 0.15) * math.pi / 2)  # fecha em cima (cúpula)
        for v in range(NV):
            phi = -ang + 2 * ang * v / (NV - 1)
            p = J + A * d + (O * math.cos(phi) + F * math.sin(phi)) * r
            verts.append(p + desloca)
    for u in range(NU - 1):
        for v in range(NV - 1):
            a, b = u * NV + v, u * NV + v + 1
            c, d = (u + 1) * NV + v + 1, (u + 1) * NV + v
            faces.append((a, b, c, d) if lado > 0 else (a, d, c, b))
    mats = [material] * len(faces)
    if borda:  # friso na beira de baixo da lâmina
        u = NU - 1
        base = len(verts)
        for v in range(NV):
            p = verts[u * NV + v]
            dd = (p - (J + desloca)).normalized()
            verts.append(p + dd * 0.006 + A * 0.004)
            verts.append(p + dd * 0.006 - A * 0.012)
        for v in range(NV - 1):
            a, b = base + v * 2, base + (v + 1) * 2
            faces.append((a, b, b + 1, a + 1) if lado > 0 else (a, a + 1, b + 1, b))
            mats.append(borda)
    o = objeto(nome, verts, faces, mats)
    return o

def cone(nome, base, ponta, r, material, lados=5):
    eixo = (ponta - base).normalized()
    t = eixo.orthogonal().normalized()
    b2 = eixo.cross(t)
    verts = [base + (t * math.cos(2 * math.pi * k / lados) + b2 * math.sin(2 * math.pi * k / lados)) * r for k in range(lados)] + [ponta]
    faces = [(k, (k + 1) % lados, lados) for k in range(lados)] + [tuple(reversed(range(lados)))]
    return objeto(nome, verts, faces, [material] * len(faces), suave=False)

def gema(nome, centro, tam, material, alto=1.4, frente=Vector((0, -1, 0))):
    # octaedro alongado (cristal), deitado na frente do peito
    up = Vector((0, 0, 1))
    lado = frente.cross(up).normalized()
    up = lado.cross(frente).normalized() * -1
    pts = [centro + up * tam * alto, centro - up * tam * alto, centro + lado * tam, centro - lado * tam, centro + frente * tam * 0.6, centro - frente * tam * 0.2]
    faces = [(0, 2, 4), (0, 4, 3), (0, 3, 5), (0, 5, 2), (1, 4, 2), (1, 3, 4), (1, 5, 3), (1, 2, 5)]
    return objeto(nome, pts, faces, [material] * 8, suave=False)

def anel(nome, centro, raio, grossura, material, eixo_frente=Vector((0, 1, 0)), N=32, M=4):
    verts, faces = [], []
    t = eixo_frente.orthogonal().normalized()
    b = eixo_frente.cross(t).normalized()
    for i in range(N):
        a = 2 * math.pi * i / N
        c = centro + (t * math.cos(a) + b * math.sin(a)) * raio
        rad = (t * math.cos(a) + b * math.sin(a))
        for k in range(M):
            q = 2 * math.pi * k / M
            verts.append(c + (rad * math.cos(q) + eixo_frente * math.sin(q)) * grossura)
    for i in range(N):
        for k in range(M):
            i2, k2 = (i + 1) % N, (k + 1) % M
            faces.append((i * M + k, i2 * M + k, i2 * M + k2, i * M + k2))
    return objeto(nome, verts, faces, [material] * len(faces))

def tira(nome, pts, larg, normal_fora, material, esp=0.004):
    # correia/faixa passando pelos pontos (para fora do corpo)
    verts, faces = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = Vector((p.x, p.y + 0.02, 0)).normalized()
        s = d.cross(n).normalized()
        verts += [p + s * larg / 2 + n * esp, p - s * larg / 2 + n * esp]
    for i in range(len(pts) - 1):
        faces.append((i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2))
    return objeto(nome, verts, faces, [material] * len(faces))

def ponto_corpo(z, a, folga):
    r = raio_corpo(z, a) + folga
    return Vector((math.sin(a) * r, -0.02 - math.cos(a) * r, z))

# ---------- espada ----------
def lamina(nome, perfil, secao, material_meio, material_fio=None, z0=0.12, z1=0.924, N=14, curva=0.0, esp=None):
    # perfil(t) -> meia largura; secao: 'losango' (4) ou 'canal' (6, com sulco no meio)
    verts, faces, mats = [], [], []
    for j in range(N + 1):
        t = j / N
        z = z0 + (z1 - z0) * t
        w = perfil(t)
        e = esp if esp else max(0.004, w * 0.16)
        if j == N:
            verts += [Vector((curva, 0, z1))] * 6
            continue
        dx = curva * t * t
        if secao == 'canal':
            verts += [Vector((dx - w, 0, z)), Vector((dx - w * 0.72, -e, z)), Vector((dx + w * 0.72, -e, z)),
                      Vector((dx + w, 0, z)), Vector((dx + w * 0.72, e, z)), Vector((dx - w * 0.72, e, z))]
        else:
            verts += [Vector((dx - w, 0, z)), Vector((dx - w * 0.6, -e, z)), Vector((dx + w * 0.6, -e, z)),
                      Vector((dx + w, 0, z)), Vector((dx + w * 0.6, e, z)), Vector((dx - w * 0.6, e, z))]
    for j in range(N):
        for k in range(6):
            k2 = (k + 1) % 6
            faces.append((j * 6 + k, j * 6 + k2, (j + 1) * 6 + k2, (j + 1) * 6 + k))
            fio = k in (0, 2, 3, 5)
            mats.append(material_fio if (fio and material_fio) else material_meio)
    base = list(range(6))
    faces.append(tuple(reversed(base)))
    mats.append(material_meio)
    return objeto(nome, verts, faces, mats, suave=False)

def cilindro(nome, z0, z1, r0, r1, material, lados=8, centro=Vector((0, 0, 0)), eixo='z'):
    verts, faces = [], []
    for z, r in ((z0, r0), (z1, r1)):
        for k in range(lados):
            a = 2 * math.pi * k / lados
            p = Vector((math.cos(a) * r, math.sin(a) * r, z)) if eixo == 'z' else Vector((z, math.cos(a) * r, math.sin(a) * r))
            verts.append(p + centro)
    for k in range(lados):
        k2 = (k + 1) % lados
        faces.append((k, k2, lados + k2, lados + k))
    faces.append(tuple(reversed(range(lados))))
    faces.append(tuple(range(lados, 2 * lados)))
    return objeto(nome, verts, faces, [material] * len(faces))

def caixa(nome, c, tam, material, giro=0.0):
    o = cilindro(nome, -tam[2] / 2, tam[2] / 2, 1, 1, material, lados=4)
    o.scale = (tam[0] / 1.414, tam[1] / 1.414, 1)
    o.rotation_euler = (0, giro, math.pi / 4)
    o.location = c
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o

def esfera(nome, c, r, material, seg=8, aneis=6, escala=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=aneis, radius=r)
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    me.materials.append(mat(material))
    for f in me.polygons:
        f.use_smooth = True
    o = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(o)
    o.scale = escala
    o.location = c
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, scale=True)
    return o

def guarda_curva(nome, larg, alto, grossura, curva, material, pontas_fogo=0):
    # guarda: barra com as pontas viradas para a lâmina (curva > 0) ou para o cabo
    N = 10
    verts, faces = [], []
    for i in range(N + 1):
        s = -1 + 2 * i / N
        x = s * larg / 2
        z = 0.1 + curva * s * s
        h = alto * (1 - 0.5 * abs(s))
        for (dy, dz) in ((-grossura, -h / 2), (grossura, -h / 2), (grossura, h / 2), (-grossura, h / 2)):
            verts.append(Vector((x, dy, z + dz)))
    for i in range(N):
        for k in range(4):
            k2 = (k + 1) % 4
            faces.append((i * 4 + k, i * 4 + k2, (i + 1) * 4 + k2, (i + 1) * 4 + k))
    faces.append((3, 2, 1, 0))
    faces.append((N * 4, N * 4 + 1, N * 4 + 2, N * 4 + 3))
    return objeto(nome, verts, faces, [material] * len(faces), suave=False)

# ================= RARIDADES =================
def exportar(r, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    caminho = os.path.join(AQUI, 'pecas_r%d.glb' % r)
    bpy.ops.export_scene.gltf(filepath=caminho, use_selection=True, export_format='GLB', export_materials='EXPORT',
                              export_apply=True, export_yup=True)
    tris = 0
    for o in objs:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    print('RARIDADE', r, 'tris', tris, 'objetos', len(objs))
    for o in objs:
        bpy.data.objects.remove(o)

L, R_ = 1, -1
OMBRO_Z = 1.318

# ---- 0 Comum: gibão de couro do andarilho ----
def comum():
    o, g, _ = casca('peito_couro', 0.012, 0.945, 0.03, 0.06, 0.13, 0.0, NA=24, NZ=10, material='couro')
    solidificar(o, 0.006)
    partes = [o, friso('friso_c', o, 9, 24, 0.01, 0.003, 'couro_escuro'), friso('friso_b', o, 0, 24, 0.01, 0.003, 'couro_escuro', cima=False)]
    # tiras: correia diagonal com fivela, cinto
    pts = [ponto_corpo(0.97 + 0.35 * t, -0.9 + 1.9 * t, 0.02) for t in [i / 10 for i in range(11)]]
    partes.append(tira('tira', pts, 0.035, None, 'couro_escuro'))
    cinto = [ponto_corpo(0.99, 2 * math.pi * i / 24, 0.022) for i in range(25)]
    partes.append(tira('cinto', cinto, 0.04, None, 'couro_escuro'))
    partes.append(caixa('fivela', ponto_corpo(0.99, 0.0, 0.03), (0.035, 0.01, 0.035), 'ferro'))
    partes.append(caixa('fivela2', ponto_corpo(1.16, -0.1, 0.03), (0.03, 0.01, 0.03), 'ferro'))
    peito = juntar(partes, 'peito')
    obj = [peito]
    for lado, n in ((L, 'ombro_e'), (R_, 'ombro_d')):
        a = lame_ombro(n, lado, 0.11, 0.2, 0.06, 0.075, OMBRO_Z, 1.3, 'couro', borda='couro_escuro')
        solidificar(a, 0.005)
        obj.append(a)
    # espada: ferro simples, cabo de couro
    esp = [lamina('lam', lambda t: 0.024 * (1 - t ** 3 * 0.7), 'losango', 'ferro', 'ferro_fio', z1=0.86),
           caixa('guarda', Vector((0, 0, 0.105)), (0.15, 0.02, 0.022), 'ferro'),
           cilindro('cabo', -0.17, 0.095, 0.016, 0.017, 'couro_escuro', lados=8),
           esfera('pomo', Vector((0, 0, -0.185)), 0.022, 'ferro', seg=6, aneis=4)]
    obj.append(juntar(esp, 'espada'))
    exportar(0, obj)

# ---- 1 Raro: couraça de aço da guarda, pano azul ----
def raro():
    o, g, _ = casca('peito_aco', 0.02, 0.95, 0.05, 0.05, 0.12, 0.012, material='aco', barriga=0.01)
    solidificar(o, 0.007)
    partes = [o]
    partes.append(friso('friso_c', o, 13, 28, 0.012, 0.004, 'aco_escuro'))
    partes.append(friso('friso_b', o, 0, 28, 0.012, 0.004, 'aco_escuro', cima=False))
    # faldas (lâminas da barriga) e tabardo azul na frente
    for k in range(2):
        b, _, _ = casca('falda%d' % k, 0.03 + 0.006 * k, 0.93 - 0.05 * k, 0.0, 0.0, 0.0, 0.0, NA=24, NZ=3, alisar=1,
                        material='aco')
        me = b.data
        for v in me.vertices:
            v.co.z = min(v.co.z, 1.02 - 0.05 * k)
        solidificar(b, 0.005)
        partes.append(b)
    tab = [Vector((x, -0.15 - 0.02 * (1.0 - z) , z)) for x, z in ((0, 1.0),)]
    partes.append(objeto('tabardo', [Vector((-0.07, -0.145, 1.0)), Vector((0.07, -0.145, 1.0)), Vector((0.06, -0.16, 0.72)), Vector((-0.06, -0.16, 0.72)), Vector((0, -0.162, 0.68))],
                         [(0, 1, 2, 3), (3, 2, 4)], ['pano'] * 2))
    for i in range(6):  # rebites
        a = -1.2 + 0.48 * i
        partes.append(esfera('rebite%d' % i, ponto_corpo(1.01, a, 0.03), 0.006, 'aco_escuro', seg=5, aneis=3))
    peito = juntar(partes, 'peito')
    obj = [peito]
    for lado, n in ((L, 'ombro_e'), (R_, 'ombro_d')):
        ps = []
        for k in range(2):
            a = lame_ombro(n + str(k), lado, 0.1 + 0.02 * k, 0.2 + 0.015 * k, 0.07 + 0.008 * k, 0.088 + 0.008 * k,
                           OMBRO_Z - 0.022 * k, 1.35, 'aco', borda='aco_escuro')
            solidificar(a, 0.006)
            ps.append(a)
        obj.append(juntar(ps, n))
    esp = [lamina('lam', lambda t: 0.027 * (1 - t ** 4 * 0.8), 'canal', 'aco', 'aco_fio'),
           guarda_curva('guarda', 0.17, 0.022, 0.012, -0.012, 'aco_escuro'),
           cilindro('cabo', -0.17, 0.09, 0.016, 0.017, 'pano', lados=8),
           cilindro('anel1', 0.07, 0.09, 0.019, 0.019, 'aco_escuro', lados=8),
           esfera('pomo', Vector((0, 0, -0.19)), 0.026, 'aco_escuro', seg=8, aneis=5, escala=(1, 0.6, 1))]
    obj.append(juntar(esp, 'espada'))
    exportar(1, obj)

# ---- 2 Épico: aço azulado com filigrana de ouro e gema arcana ----
def epico():
    o, g, _ = casca('peito_ep', 0.022, 0.95, 0.07, 0.07, 0.12, 0.016, material='aco_azul', barriga=0.012)
    solidificar(o, 0.008)
    partes = [o]
    partes.append(friso('friso_c', o, 13, 28, 0.016, 0.005, 'ouro'))
    partes.append(friso('friso_b', o, 0, 28, 0.016, 0.005, 'ouro', cima=False))
    partes.append(friso('friso_m', o, 6, 28, 0.008, 0.003, 'ouro'))
    for k in range(3):
        b, _, _ = casca('falda%d' % k, 0.032 + 0.006 * k, 0.9 - 0.045 * k, 0.04, 0.0, 0.0, 0.0, NA=24, NZ=3, alisar=1, material='aco_azul')
        for v in b.data.vertices:
            v.co.z = min(v.co.z, 1.0 - 0.045 * k)
        solidificar(b, 0.005)
        partes.append(b)
    # gola alta (gorjal)
    gol = anel('gorjal', Vector((0, 0.0, 1.355)), 0.075, 0.018, 'aco_azul', eixo_frente=Vector((0, 0, 1)), N=16, M=4)
    partes.append(gol)
    partes.append(gema('gema', ponto_corpo(1.2, 0.0, 0.05), 0.024, 'gema_roxa'))
    partes.append(anel('engaste', ponto_corpo(1.2, 0.0, 0.04), 0.03, 0.006, 'ouro', eixo_frente=Vector((0, 1, 0)), N=12, M=4))
    peito = juntar(partes, 'peito')
    obj = [peito]
    for lado, n in ((L, 'ombro_e'), (R_, 'ombro_d')):
        ps = []
        for k in range(3):
            a = lame_ombro(n + str(k), lado, 0.095 + 0.02 * k, 0.205 + 0.02 * k, 0.078 + 0.01 * k, 0.1 + 0.012 * k,
                           OMBRO_Z + 0.008 - 0.026 * k, 1.4, 'aco_azul', borda='ouro')
            solidificar(a, 0.006)
            ps.append(a)
        obj.append(juntar(ps, n))
    esp = [lamina('lam', lambda t: 0.034 * (1 + 0.25 * math.sin(t * math.pi) - t ** 4 * 0.85), 'canal', 'aco_azul', 'ouro', z1=0.95),
           lamina('runa', lambda t: 0.007 * (1 - t * 0.6), 'losango', 'runa', None, z0=0.14, z1=0.75, esp=0.0075),
           guarda_curva('guarda', 0.21, 0.03, 0.014, 0.035, 'ouro'),
           gema('gemag', Vector((0, -0.016, 0.1)), 0.012, 'gema_roxa', alto=1.3),
           cilindro('cabo', -0.18, 0.09, 0.016, 0.018, 'couro_escuro', lados=8),
           esfera('pomo', Vector((0, 0, -0.2)), 0.024, 'ouro', seg=6, aneis=4, escala=(1, 1, 1.4))]
    obj.append(juntar(esp, 'espada'))
    exportar(2, obj)

# ---- 3 Lendário: Coração de Brasa (aço negro com fendas de brasa viva) ----
def lendario():
    o, g, _ = casca('peito_le', 0.026, 0.95, 0.09, 0.08, 0.11, 0.022, material='obsidiana', barriga=0.016)
    solidificar(o, 0.009)
    partes = [o]
    partes.append(friso('friso_c', o, 13, 28, 0.02, 0.006, 'bronze'))
    partes.append(friso('friso_b', o, 0, 28, 0.02, 0.006, 'bronze', cima=False))
    for k in range(3):
        b, _, _ = casca('falda%d' % k, 0.036 + 0.007 * k, 0.88 - 0.05 * k, 0.07, 0.0, 0.0, 0.0, NA=24, NZ=3, alisar=1, material='obsidiana')
        for v in b.data.vertices:
            v.co.z = min(v.co.z, 0.98 - 0.05 * k)
        solidificar(b, 0.006)
        partes.append(b)
    gol = anel('gorjal', Vector((0, 0.0, 1.36)), 0.078, 0.022, 'obsidiana', eixo_frente=Vector((0, 0, 1)), N=16, M=4)
    partes.append(gol)
    # núcleo de brasa no peito, com garras de bronze
    c = ponto_corpo(1.2, 0.0, 0.05)
    partes.append(esfera('nucleo', c, 0.03, 'brasa', seg=8, aneis=6, escala=(1, 0.6, 1.15)))
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        d = Vector((math.cos(a), 0, math.sin(a)))
        partes.append(cone('garra%d' % k, c + d * 0.05 + Vector((0, 0.01, 0)), c + d * 0.022 + Vector((0, -0.012, 0)), 0.01, 'bronze', lados=4))
    peito = juntar(partes, 'peito')
    obj = [peito]
    for lado, n in ((L, 'ombro_e'), (R_, 'ombro_d')):
        ps = []
        for k in range(3):
            a = lame_ombro(n + str(k), lado, 0.09 + 0.022 * k, 0.215 + 0.02 * k, 0.085 + 0.012 * k, 0.112 + 0.014 * k,
                           OMBRO_Z + 0.015 - 0.028 * k, 1.45, 'obsidiana', borda='brasa_linha' if k == 2 else 'bronze')
            solidificar(a, 0.007)
            ps.append(a)
        # chifres/espinhos para cima e para fora
        for k, (dx, dy) in enumerate(((0.12, -0.03), (0.16, 0.0), (0.2, 0.03))):
            base = Vector((lado * (0.13 + 0.025 * k), -0.04 + 0.04 * k, 1.385 - 0.012 * k))
            ps.append(cone(n + 'esp%d' % k, base, base + Vector((lado * 0.06, 0.005, 0.085 - 0.02 * k)), 0.015, 'bronze', lados=5))
        obj.append(juntar(ps, n))
    esp = [lamina('lam', lambda t: 0.05 * (1 + 0.18 * math.sin(t * 2.6)) * (1 - t ** 5 * 0.9), 'canal', 'obsidiana', 'bronze', z1=0.97),
           lamina('fenda', lambda t: 0.011 * (1 - t * 0.7), 'losango', 'brasa_linha', None, z0=0.13, z1=0.88, esp=0.0095),
           guarda_curva('guarda', 0.22, 0.035, 0.016, 0.05, 'bronze'),
           cone('ch_e', Vector((0.1, 0, 0.13)), Vector((0.14, 0, 0.21)), 0.012, 'bronze', lados=4),
           cone('ch_d', Vector((-0.1, 0, 0.13)), Vector((-0.14, 0, 0.21)), 0.012, 'bronze', lados=4),
           esfera('nuc', Vector((0, 0, 0.105)), 0.016, 'brasa', seg=6, aneis=4),
           cilindro('cabo', -0.19, 0.09, 0.017, 0.019, 'couro_escuro', lados=8),
           gema('pomo', Vector((0, 0, -0.215)), 0.02, 'brasa', alto=1.5)]
    obj.append(juntar(esp, 'espada'))
    exportar(3, obj)

# ---- 4 Mítico: Aurora Astral (metal perolado iridescente, cristal, peças flutuando) ----
def mitico():
    o, g, _ = casca('peito_mi', 0.024, 0.95, 0.1, 0.09, 0.11, 0.02, material='perola', barriga=0.014)
    solidificar(o, 0.008)
    partes = [o]
    partes.append(friso('friso_c', o, 13, 28, 0.014, 0.006, 'ouro_claro'))
    partes.append(friso('friso_b', o, 0, 28, 0.014, 0.006, 'ouro_claro', cima=False))
    partes.append(friso('friso_m', o, 7, 28, 0.006, 0.004, 'cristal'))
    for k in range(3):
        b, _, _ = casca('falda%d' % k, 0.034 + 0.007 * k, 0.88 - 0.05 * k, 0.09, 0.0, 0.0, 0.0, NA=24, NZ=3, alisar=1, material='perola')
        for v in b.data.vertices:
            v.co.z = min(v.co.z, 0.98 - 0.05 * k)
        solidificar(b, 0.005)
        partes.append(b)
    c = ponto_corpo(1.21, 0.0, 0.06)
    partes.append(gema('gema', c, 0.032, 'cristal', alto=1.6))
    partes.append(anel('engaste', c + Vector((0, 0.012, 0)), 0.045, 0.005, 'ouro_claro', eixo_frente=Vector((0, 1, 0)), N=16, M=4))
    peito = juntar(partes, 'peito')
    obj = [peito]
    # auréola de cristais atrás dos ombros (flutua; presa no peito)
    hal = [anel('aureola', Vector((0, 0.16, 1.47)), 0.25, 0.008, 'cristal', eixo_frente=Vector((0, 1, 0.25)).normalized(), N=32, M=4)]
    for k in range(8):
        a = 2 * math.pi * k / 8
        p = Vector((math.cos(a) * 0.25, 0.16 - math.sin(a) * 0.06, 1.47 + math.sin(a) * 0.25))
        hal.append(gema('lasca%d' % k, p, 0.014, 'cristal', alto=2.2, frente=Vector((0, -1, 0))))
    obj.append(juntar(hal, 'peito_aureola'))
    for lado, n in ((L, 'ombro_e'), (R_, 'ombro_d')):
        ps = []
        sobe = Vector((lado * 0.025, 0, 0.03))  # as placas flutuam, separadas do ombro
        for k in range(3):
            a = lame_ombro(n + str(k), lado, 0.1 + 0.022 * k, 0.215 + 0.02 * k, 0.085 + 0.012 * k, 0.112 + 0.012 * k,
                           OMBRO_Z + 0.01 - 0.03 * k, 1.35 - 0.1 * k, 'perola', desloca=sobe * (1 + 0.5 * k), borda='ouro_claro')
            solidificar(a, 0.006)
            ps.append(a)
        ps.append(gema(n + 'gema', Vector((lado * 0.2, -0.0, 1.31)) + sobe * 2.5, 0.018, 'cristal', alto=2.2, frente=Vector((lado, -0.3, 0)).normalized()))
        obj.append(juntar(ps, n))
    esp = [lamina('lam', lambda t: 0.04 * (1 + 0.3 * math.sin(t * math.pi * 0.9)) * (1 - t ** 3 * 0.85), 'losango', 'cristal', 'cristal_fio', z1=1.0),
           guarda_curva('g_e', 0.1, 0.03, 0.013, 0.06, 'perola'),
           cilindro('cabo', -0.19, 0.09, 0.016, 0.018, 'perola', lados=8),
           esfera('pomo', Vector((0, 0, -0.21)), 0.02, 'cristal', seg=6, aneis=4, escala=(1, 1, 1.5))]
    g1 = guarda_curva('asa_e', 0.1, 0.028, 0.01, 0.05, 'ouro_claro')
    g1.location = (0.11, 0, 0.03)
    g2 = guarda_curva('asa_d', 0.1, 0.028, 0.01, 0.05, 'ouro_claro')
    g2.location = (-0.11, 0, 0.03)
    for gg in (g1, g2):
        bpy.context.view_layer.objects.active = gg
        bpy.ops.object.select_all(action='DESELECT')
        gg.select_set(True)
        bpy.ops.object.transform_apply(location=True)
    esp += [g1, g2, anel('orbita', Vector((0, 0, 0.16)), 0.05, 0.004, 'ouro_claro', eixo_frente=Vector((0, 0, 1)), N=16, M=3)]
    obj.append(juntar(esp, 'espada'))
    exportar(4, obj)

comum(); raro(); epico(); lendario(); mitico()
