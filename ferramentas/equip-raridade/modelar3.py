# Proposta 3 de equipamentos por raridade (setor de arte, 2026-11-23), na linha da referência do André: roupa leve
# de patrulheira/maga de campo, não armadura pesada. Camisa de linho, corpete de couro com cadarço, cinto largo com
# fivela, túnica por cima da saia, braçadeiras longas, bolsa a tiracolo e botas altas com dobra. As raridades sobem a
# partir dessa base com materiais melhores e detalhes (rebites, bordado, couro gravado, metal fino, brilho só no topo).
#
# Tudo que veste o corpo é PELE de verdade: cada vértice copia os pesos dos ossos do ponto mais perto do corpo da
# Ruiva (a túnica copia da saia), então a roupa dobra com o corpo em qualquer pose e acompanha o desenho dele
# (cintura marcada, braços livres). Só as ombreiras são peças duras presas no ombro.
#
# Rodar: blender -b -P ferramentas/equip-raridade/modelar3.py  (precisa de godot-prototipo/modelos/ruiva.glb)
# Sai: pecas3_r0.glb ... pecas3_r4.glb. Eixos do Blender: Z para cima, frente do corpo em -Y, pose T.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

AQUI = os.path.dirname(os.path.abspath(__file__))
RUIVA = os.path.join(AQUI, '..', '..', 'godot-prototipo', 'modelos', 'ruiva.glb')
SO = [int(x) for x in os.environ.get('SO', '0,1,2,3,4').split(',') if x != '']
NOME_SAIDA = 'pecas3_r'

# CORPO=m: corpo masculino do criador (cabelo_m). Ele é medido "entortado" para as medidas da Ruiva (alturas e largura
# dos ombros nos mesmos lugares), a roupa sai com todo o código feito para ela e depois volta para as medidas dele.
CORPO = os.environ.get('CORPO', 'f')
MASC = CORPO == 'm'
if MASC:
    RUIVA = os.path.join(AQUI, '..', '..', 'godot-prototipo', 'modelos', 'cabelo_m.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RUIVA)
ARM = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
def osso_w(n):
    return ARM.matrix_world @ ARM.data.bones[n].head_local
def _linear(x, a, b):  # interpolação por trechos (a -> b), crescente
    if x <= a[0]: return b[0] + (x - a[0]) * (b[1] - b[0]) / (a[1] - a[0])
    for i in range(len(a) - 1):
        if x <= a[i + 1]:
            return b[i] + (x - a[i]) * (b[i + 1] - b[i]) / (a[i + 1] - a[i])
    return b[-1] + (x - a[-1]) * (b[-1] - b[-2]) / (a[-1] - a[-2])
if MASC:
    _zm = [0.0, osso_w('J_Bip_L_Foot').z, osso_w('J_Bip_L_LowerLeg').z, osso_w('J_Bip_L_UpperLeg').z, osso_w('J_Bip_C_Chest').z,
           osso_w('J_Bip_C_UpperChest').z, osso_w('J_Bip_L_UpperArm').z, osso_w('J_Bip_C_Neck').z, osso_w('J_Bip_C_Head').z, 2.0]
    _zf = [0.0, 0.106, 0.535, 0.907, 1.11, 1.2167, 1.3087, 1.3478, 1.43, 1.9]
    _xm = [0.0, abs(osso_w('J_Bip_L_UpperArm').x), abs(osso_w('J_Bip_L_LowerArm').x), abs(osso_w('J_Bip_L_Hand').x), 1.0]
    _xf = [0.0, 0.1092, 0.3268, 0.5349, 0.92]
    print('MASC z', [round(z, 3) for z in _zm], 'x', [round(x, 3) for x in _xm])
    _rosto = [o for o in bpy.data.objects if o.type == 'MESH' and any('Face_00_SKIN' in m.name for m in o.data.materials)][0]
    _vy = sum((_rosto.matrix_world @ v.co).y for v in _rosto.data.vertices) / len(_rosto.data.vertices)
    GIRA = _vy > osso_w('J_Bip_C_Neck').y  # rosto para +Y: gira meia volta para ficar de frente para -Y como a Ruiva
    print('GIRA', GIRA)
def entortar(p):  # corpo dele -> medidas dela
    if not MASC: return p.copy()
    if GIRA: p = Vector((-p.x, -p.y, p.z))
    s = 1 if p.x >= 0 else -1
    return Vector((s * _linear(abs(p.x), _xm, _xf), p.y, _linear(p.z, _zm, _zf)))
def desentortar(p):  # medidas dela -> corpo dele
    if not MASC: return p.copy()
    s = 1 if p.x >= 0 else -1
    q = Vector((s * _linear(abs(p.x), _xf, _xm), p.y, _linear(p.z, _zf, _zm)))
    return Vector((-q.x, -q.y, q.z)) if GIRA else q
def malha_por_material(chave):
    ms = [o for o in bpy.data.objects if o.type == 'MESH' and any(chave in m.name for m in o.data.materials)]
    if len(ms) > 1:  # o corpo masculino vem em pedaços: junta numa malha só
        for o in ms[1:]:
            ms[0].data  # noqa
        with bpy.context.temp_override(active_object=ms[0], selected_editable_objects=ms):
            bpy.ops.object.join()
    return ms[0]
PELE = malha_por_material('Body_00_SKIN')
SAIA = malha_por_material('Bottoms')
if MASC:
    for o in bpy.data.objects:
        if o.type == 'MESH':
            mw = o.matrix_world; mi = mw.inverted()
            for v in o.data.vertices:
                v.co = mi @ entortar(mw @ v.co)

def fonte(o, filtro=None):
    # BVH do mundo + pesos por vértice (para copiar a pele)
    mw = o.matrix_world
    vs = [mw @ v.co for v in o.data.vertices]
    polys = [list(p.vertices) for p in o.data.polygons]
    if filtro:
        polys = [p for p in polys if filtro([vs[i] for i in p])]
    nomes = {g.index: g.name for g in o.vertex_groups}
    pesos = [{nomes[g.group]: g.weight for g in v.groups if g.weight > 0.001} for v in o.data.vertices]
    return {'bvh': BVHTree.FromPolygons(vs, polys), 'vs': vs, 'polys': polys, 'pesos': pesos}

BLUSA = malha_por_material('Tops')
def juntar_fontes(a, b):
    n = len(a['vs'])
    return {'bvh': BVHTree.FromPolygons(a['vs'] + b['vs'], a['polys'] + [[i + n for i in p] for p in b['polys']]),
            'vs': a['vs'] + b['vs'], 'polys': a['polys'] + [[i + n for i in p] for p in b['polys']], 'pesos': a['pesos'] + b['pesos']}
# a Ruiva não tem peito de pele debaixo da blusa: o tronco se mede pela blusa (e a pele onde não há blusa)
F_PELE = juntar_fontes(fonte(PELE), fonte(BLUSA))
_sem_braco = lambda ps: not any(abs(p.x) > 0.125 and p.z > 1.2 for p in ps)
F_TRONCO = juntar_fontes(fonte(PELE, _sem_braco), fonte(BLUSA, _sem_braco))
F_SAIA = fonte(SAIA)
# cada perna sozinha (para medir a coxa por trás sem bater na outra perna)
BVH_PERNA = {l: fonte(PELE, lambda ps, l=l: all(p.x * l > 0.004 for p in ps) and all(p.z < 0.95 for p in ps))['bvh'] for l in (1, -1)}
# a saia junto com a pele (para medir a túnica por fora da saia)
_vs = F_PELE['vs'] + F_SAIA['vs']
_n = len(F_PELE['vs'])
BVH_SAIA_PELE = BVHTree.FromPolygons(_vs, F_PELE['polys'] + [[i + _n for i in p] for p in F_SAIA['polys']])

# ---------- materiais ----------
MATS = {}
def mat(n):
    if n not in MATS:
        MATS[n] = bpy.data.materials.new(n)
    return MATS[n]

def objeto(nome, verts, faces, mats, suave=True):
    me = bpy.data.meshes.new(nome)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    nomes = sorted(set(mats))
    for n in nomes:
        me.materials.append(mat(n))
    for f, n in zip(me.polygons, mats):
        f.material_index = nomes.index(n)
        f.use_smooth = suave
    me.validate()
    o = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(o)
    return o

def ativar(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o

def juntar(objs, nome):
    objs = [o for o in objs if o]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = nome
    return o

def solidificar(o, esp):
    md = o.modifiers.new('s', 'SOLIDIFY')
    md.thickness = esp
    md.offset = 1
    md.use_rim = True
    ativar(o)
    bpy.ops.object.modifier_apply(modifier='s')

def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

# ---------- medir o corpo ----------
def raio(bvh, c, d, longe=0.4):
    hit = bvh.ray_cast(c + d * longe, -d, longe + 0.05)
    return (hit[0] - c).length if hit[0] else None

def busto(z, a):
    if MASC: return 0.0
    return 0.018 * math.exp(-((abs(a) - 0.42) / 0.4) ** 2 - ((z - 1.215) / 0.075) ** 2) if math.cos(a) > 0 else 0.0

def p_tronco(z, a, folga, saia=False):
    folga += 0.0 if saia else busto(z, a)
    c = Vector((0, -0.02, z))
    d = Vector((math.sin(a), -math.cos(a), 0))
    r = raio(BVH_SAIA_PELE if saia else F_TRONCO['bvh'], c, d)
    if r is None:
        r = 0.1
    if not saia and z > 1.2:
        r = min(r, 0.13 / max(abs(math.sin(a)), 0.2))
    return c + d * (r + folga)

def fora(p):
    return Vector((p.x, p.y + 0.02, 0)).normalized()

# ---------- casca do tronco ----------
def casca(nome, linhas, folga, material, NA=32, saia=False, alisar=2, esp=0.0):
    # linhas: lista de (z, a_ini, a_fim) de baixo para cima (a: 0 = frente, cresce para a esquerda dela)
    # folga: número ou função (z, a) -> m para fora do corpo
    NZ = len(linhas)
    grade, minimo = [], []
    for z, a0, a1 in linhas:
        l, lm = [], []
        for i in range(NA):
            a = a0 + (a1 - a0) * i / (NA - 1)
            f = folga(z, a) if callable(folga) else folga
            l.append(p_tronco(z, a, f, saia))
            lm.append(p_tronco(z, a, f * 0.6, saia))
        grade.append(l)
        minimo.append(lm)
    for _ in range(alisar):
        nova = [[v.copy() for v in l] for l in grade]
        for j in range(NZ):
            for i in range(1, NA - 1):
                vz = [grade[j][i - 1], grade[j][i + 1]] + ([grade[j - 1][i]] if j > 0 else []) + ([grade[j + 1][i]] if j < NZ - 1 else [])
                m = sum(vz, Vector()) / len(vz)
                v = grade[j][i] * 0.6 + m * 0.4
                v.z = grade[j][i].z
                mn = minimo[j][i]
                if fora(mn).dot(v - mn) < 0:
                    v = mn
                nova[j][i] = v
        grade = nova
    verts = [v for l in grade for v in l]
    faces = [(j * NA + i, (j + 1) * NA + i, (j + 1) * NA + i + 1, j * NA + i + 1) for j in range(NZ - 1) for i in range(NA - 1)]
    o = objeto(nome, verts, faces, [material] * len(faces))
    if esp:
        solidificar(o, esp)
    return o, grade

def linhas_z(z0, z1, n, faixa_a):
    return [(z0 + (z1 - z0) * j / (n - 1),) + faixa_a(z0 + (z1 - z0) * j / (n - 1), j / (n - 1)) for j in range(n)]

# ---------- tubo em volta de um membro (braço, perna) ----------
def manga(nome, A, B, t0, t1, folga, material, N=10, M=12, bvh=None, esp=0.0, longe=0.085, atras=None):
    # A->B: eixo do osso (pose T); t0..t1: trecho; folga(t) -> m
    eixo = (B - A).normalized()
    u = Vector((0, 0, 1)) if abs(eixo.z) < 0.9 else Vector((0, -1, 0))
    u = (u - eixo * u.dot(eixo)).normalized()
    w = eixo.cross(u)
    verts = []
    for i in range(N):
        t = t0 + (t1 - t0) * i / (N - 1)
        c = A + (B - A) * t
        rs = []
        for k in range(M):
            q = 2 * math.pi * k / M
            d = u * math.cos(q) + w * math.sin(q)
            r = raio(bvh or F_PELE['bvh'], c, d, longe)
            rs.append(r if r is not None and r < longe else None)
        validos = [r for r in rs if r]
        med = sum(validos) / len(validos) if validos else 0.04
        rs = [r if r else med for r in rs]
        rs = [0.5 * rs[k] + 0.25 * (rs[k - 1] + rs[(k + 1) % M]) for k in range(M)]
        f = folga(t) if callable(folga) else folga
        for k in range(M):
            q = 2 * math.pi * k / M
            d = u * math.cos(q) + w * math.sin(q)
            fa = atras(t) * max(0.0, d.y) if atras else 0.0
            verts.append(c + d * (max(rs[k], med * 0.85) + f + fa))
    faces = []
    for i in range(N - 1):
        for k in range(M):
            k2 = (k + 1) % M
            faces.append((i * M + k, i * M + k2, (i + 1) * M + k2, (i + 1) * M + k))
    o = objeto(nome, verts, faces, [material] * len(faces))
    if esp:
        solidificar(o, esp)
    aneis = [[verts[i * M + k] for k in range(M)] for i in range(N)]
    return o, aneis, (A, B)

# ---------- detalhes ----------
def faixa(nome, pts, larg, material, alto=0.002, normais=None, fechada=False):
    # tira em relevo (friso, costura, cadarço, correia) passando pelos pontos
    n_pts = len(pts)
    verts, faces = [], []
    for i, p in enumerate(pts):
        a = pts[(i - 1) % n_pts] if (fechada or i > 0) else p
        b = pts[(i + 1) % n_pts] if (fechada or i < n_pts - 1) else p
        d = (b - a).normalized()
        n = normais[i] if normais else fora(p)
        s = d.cross(n).normalized()
        verts += [p + s * larg / 2 + n * alto * 0.4, p + n * (alto + larg * 0.25), p - s * larg / 2 + n * alto * 0.4]
    seg = n_pts if fechada else n_pts - 1
    for i in range(seg):
        j = (i + 1) % n_pts
        for k in range(2):
            faces.append((i * 3 + k, j * 3 + k, j * 3 + k + 1, i * 3 + k + 1))
    return objeto(nome, verts, faces, [material] * len(faces))

def anel_normais(anel, eixo):
    A, B = eixo
    e = (B - A).normalized()
    out = []
    for p in anel:
        v = p - A
        v = v - e * v.dot(e)
        out.append(v.normalized())
    return out

def caixa(nome, c, tam, material, frente=Vector((0, -1, 0))):
    # caixa orientada: tam = (largura, profundidade, altura); frente = para onde aponta a profundidade
    up = Vector((0, 0, 1))
    f = frente.normalized()
    lado = up.cross(f).normalized()
    up = f.cross(lado).normalized()
    hx, hy, hz = tam[0] / 2, tam[1] / 2, tam[2] / 2
    vs = []
    for sz in (-1, 1):
        for sy in (-1, 1):
            for sx in (-1, 1):
                vs.append(c + lado * sx * hx + f * sy * hy + up * sz * hz)
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return objeto(nome, vs, faces, [material] * 6, suave=False)

def esfera(nome, c, r, material, seg=8, aneis=6, escala=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=aneis, radius=r)
    for v in bm.verts:
        v.co = Vector((v.co.x * escala[0], v.co.y * escala[1], v.co.z * escala[2])) + c
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    me.materials.append(mat(material))
    for f in me.polygons:
        f.use_smooth = True
    o = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(o)
    return o

def gema(nome, c, tam, material, alto=1.4, frente=Vector((0, -1, 0))):
    up = Vector((0, 0, 1))
    lado = frente.cross(up).normalized()
    up = lado.cross(frente).normalized() * -1
    pts = [c + up * tam * alto, c - up * tam * alto, c + lado * tam, c - lado * tam, c + frente * tam * 0.6, c - frente * tam * 0.2]
    faces = [(0, 2, 4), (0, 4, 3), (0, 3, 5), (0, 5, 2), (1, 4, 2), (1, 3, 4), (1, 5, 3), (1, 2, 5)]
    return objeto(nome, pts, faces, [material] * 8, suave=False)

def moldura(nome, c, larg, alt, gross, material, frente=Vector((0, -1, 0))):
    # fivela: moldura retangular com pino no meio
    up = Vector((0, 0, 1))
    lado = up.cross(frente).normalized()
    ps = [caixa(nome + 'c', c + up * alt / 2, (larg, gross, gross), material, frente),
          caixa(nome + 'b', c - up * alt / 2, (larg, gross, gross), material, frente),
          caixa(nome + 'e', c + lado * larg / 2, (gross, gross, alt + gross), material, frente),
          caixa(nome + 'd', c - lado * larg / 2, (gross, gross, alt + gross), material, frente),
          caixa(nome + 'p', c + frente * gross * 0.6, (gross * 0.7, gross * 0.7, alt * 0.9), material, frente)]
    return juntar(ps, nome)

def arco(nome, centro, raio_, gross, a0, a1, material, eixo=Vector((0, 1, 0)), N=14, M=4):
    verts, faces = [], []
    t = Vector((1, 0, 0)) if abs(eixo.x) < 0.9 else Vector((0, 0, 1))
    t = (t - eixo * t.dot(eixo)).normalized()
    b = eixo.cross(t).normalized()
    for i in range(N + 1):
        u = i / N
        a = a0 + (a1 - a0) * u
        rad = t * math.cos(a) + b * math.sin(a)
        c = centro + rad * raio_
        g = gross * (math.sin(u * math.pi) ** 0.6) + 0.0008
        for k in range(M):
            q = 2 * math.pi * k / M
            verts.append(c + (rad * math.cos(q) + eixo * math.sin(q)) * g)
    for i in range(N):
        for k in range(M):
            k2 = (k + 1) % M
            faces.append((i * M + k, (i + 1) * M + k, (i + 1) * M + k2, i * M + k2))
    return objeto(nome, verts, faces, [material] * len(faces))

def tubo(nome, pts, r, material, lados=5, afina=True):
    verts, faces = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        t = d.orthogonal().normalized()
        b = d.cross(t)
        rr = r * (1 - 0.6 * (i / (len(pts) - 1)) ** 3) if afina else r
        for k in range(lados):
            q = 2 * math.pi * k / lados
            verts.append(p + (t * math.cos(q) + b * math.sin(q)) * rr)
    for i in range(len(pts) - 1):
        for k in range(lados):
            k2 = (k + 1) % lados
            faces.append((i * lados + k, i * lados + k2, (i + 1) * lados + k2, (i + 1) * lados + k))
    return objeto(nome, verts, faces, [material] * len(faces))

# ---------- ombreira dura (presa no ombro, feita com o braço caído) ----------
def lame_ombro(nome, lado, d0, d1, r0, r1, zc, ang, material, borda=None, desloca=Vector((0, 0, 0))):
    th = math.radians(28)
    A = Vector((lado * math.sin(th), 0, -math.cos(th)))
    O = Vector((lado * math.cos(th), 0, math.sin(th)))
    F = Vector((0, -1, 0))
    J = Vector((lado * 0.115, -0.005, zc))
    NU, NV = 6, 12
    verts, faces = [], []
    for u in range(NU):
        s = u / (NU - 1)
        d = d0 + (d1 - d0) * s
        r = (r0 + (r1 - r0) * s ** 0.7) * (0.55 + 0.45 * math.sin(min(1.0, s * 2.0 + 0.15) * math.pi / 2))
        for v in range(NV):
            phi = -ang + 2 * ang * v / (NV - 1)
            verts.append(J + A * d + (O * math.cos(phi) + F * math.sin(phi)) * r + desloca)
    for u in range(NU - 1):
        for v in range(NV - 1):
            a, b = u * NV + v, u * NV + v + 1
            c, d = (u + 1) * NV + v + 1, (u + 1) * NV + v
            faces.append((a, b, c, d) if lado > 0 else (a, d, c, b))
    mats = [material] * len(faces)
    o = objeto(nome, verts, faces, mats)
    solidificar(o, 0.004)
    ps = [o]
    if borda:
        borda_pts = verts[(NU - 1) * NV:]
        ps.append(faixa(nome + 'b', borda_pts, 0.008, borda, normais=[(p - J - desloca).normalized() for p in borda_pts]))
    return juntar(ps, nome)

# ---------- copiar a pele ----------
def pesar(o, f):
    bvh, vs, polys, pesos = f['bvh'], f['vs'], f['polys'], f['pesos']
    grupos = {}
    mw = o.matrix_world
    for v in o.data.vertices:
        p = mw @ v.co
        loc, nrm, idx, dist = bvh.find_nearest(p)
        if idx is None:
            continue
        soma = {}
        tot = 0.0
        for i in polys[idx]:
            k = 1.0 / ((vs[i] - loc).length + 1e-4)
            tot += k
            for g, w in pesos[i].items():
                soma[g] = soma.get(g, 0.0) + w * k
        top = sorted(soma.items(), key=lambda x: -x[1])[:4]
        s = sum(w for _, w in top) or 1.0
        for g, w in top:
            if g not in grupos:
                grupos[g] = o.vertex_groups.get(g) or o.vertex_groups.new(name=g)
            grupos[g].add([v.index], w / s, 'REPLACE')
    a = o.modifiers.new('arm', 'ARMATURE')
    a.object = ARM

def pesar_saia_longa(o, f=None):
    # corpo masculino: a calça dele separa as pernas de uma vez e rasgava a saia longa no meio. Aqui o peso é suave:
    # quadril em cima, as duas pernas misturadas no meio da frente e de trás, canela só perto da barra
    mw = o.matrix_world
    gs = {}
    def g(n):
        if n not in gs:
            gs[n] = o.vertex_groups.get(n) or o.vertex_groups.new(name=n)
        return gs[n]
    for v in o.data.vertices:
        p = mw @ v.co
        perna = 0.85 * ss(0.98, 0.72, p.z)
        canela = 0.45 * ss(0.55, 0.3, p.z)
        esq = ss(-0.05, 0.05, p.x)
        ws = {'J_Bip_C_Hips': 1 - perna}
        for lado, k in (('L', esq), ('R', 1 - esq)):
            ws['J_Bip_%s_UpperLeg' % lado] = perna * k * (1 - canela)
            ws['J_Bip_%s_LowerLeg' % lado] = perna * k * canela
        for n, w in ws.items():
            if w > 0.001:
                g(n).add([v.index], w, 'REPLACE')
    a = o.modifiers.new('arm', 'ARMATURE')
    a.object = ARM

def no_esqueleto(o, pele=True):
    # volta para as medidas do corpo e põe no espaço do esqueleto (o masculino vem girado no glb)
    mw = o.matrix_world; ai = ARM.matrix_world.inverted()
    for v in o.data.vertices:
        v.co = ai @ desentortar(mw @ v.co)
    o.matrix_world = Matrix()
    if pele:
        o.parent = ARM
        o.matrix_parent_inverse = Matrix()
        o.matrix_basis = Matrix()

def exportar(r, pele, saia, duras):
    for o in pele:
        pesar(o, F_PELE)
    for o in saia:
        (pesar_saia_longa if MASC else pesar)(o, F_SAIA)
    todos = pele + saia + duras
    for o in pele + saia:
        no_esqueleto(o)
    for o in duras:
        no_esqueleto(o, False)
    bpy.ops.object.select_all(action='DESELECT')
    ARM.select_set(True)
    for o in todos:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(AQUI, NOME_SAIDA + '%d.glb' % r), use_selection=True, export_format='GLB',
                              export_materials='EXPORT', export_yup=True, export_skins=True, export_apply=False)
    tot = 0
    for o in todos:
        o.data.calc_loop_triangles()
        tot += len(o.data.loop_triangles)
        print('PECA', r, o.name, len(o.data.loop_triangles))
    print('RARIDADE', r, 'tris', tot)
    for o in todos:
        bpy.data.objects.remove(o)

# ================= O SET =================
OMBRO_E = Vector((0.109, 0.025, 1.309)); COTOVELO_E = Vector((0.327, 0.025, 1.309)); PUNHO_E = Vector((0.535, 0.025, 1.309))
JOELHO_E = Vector((0.075, 0.009, 0.535)); TORNOZELO_E = Vector((0.075, 0.034, 0.106))
if MASC:  # os ossos dele, já nas medidas dela
    OMBRO_E, COTOVELO_E, PUNHO_E = (entortar(osso_w(n)) for n in ('J_Bip_L_UpperArm', 'J_Bip_L_LowerArm', 'J_Bip_L_Hand'))
    JOELHO_E, TORNOZELO_E = entortar(osso_w('J_Bip_L_LowerLeg')), entortar(osso_w('J_Bip_L_Foot'))
    print('OSSOS', OMBRO_E, PUNHO_E, JOELHO_E, TORNOZELO_E)
def espelho(v): return Vector((-v.x, v.y, v.z))

def set_roupa(r, c):
    # c: dicionário de materiais e detalhes da raridade
    pele, saia, duras = [], [], []
    # --- camisa de linho: tronco + mangas compridas + punho ---
    def folga_camisa(z, a):
        # justa onde o corpete cobre (não atravessa o couro quando o braço mexe); folgada no decote e no ombro
        g = 0.07 + 0.36 * ss(1.1, 1.31, z)
        aa = abs((a + math.pi) % (2 * math.pi) - math.pi)
        coberta = ss(1.318, 1.298, z) * ss(g - 0.03, g + 0.06, aa)
        return 0.007 + 0.004 * ss(1.3, 1.395, z) - 0.005 * coberta
    cam, gcam = casca('camisa', linhas_z(0.9, 1.395, 16, lambda z, t: (-math.pi + 0.01, math.pi - 0.01)), folga_camisa, c['camisa'], NA=36)
    # gola: decote redondo com fenda; cava nas laterais (o ombro fica com a manga)
    for v in cam.data.vertices:
        a = math.atan2(v.co.x, -(v.co.y + 0.02))
        v.co.z = min(v.co.z, 1.395 - 0.03 * max(0.0, math.cos(a)) ** 2 - 0.12 * ss(0.7, 0.95, abs(math.sin(a))))
    pc = [cam]
    for lado, (A, B) in ((1, (OMBRO_E, PUNHO_E)), (-1, (espelho(OMBRO_E), espelho(PUNHO_E)))):
        m, aneis, eixo = manga('manga%d' % lado, A, B, -0.02, 0.97, lambda t: 0.006 + 0.012 * max(t, 0.0) ** 1.5, c['camisa'], N=15, M=12)
        pc.append(m)
        # punho bordado na ponta da manga (aparece por cima da braçadeira)
        anel = aneis[-4]
        pc.append(faixa('punho%d' % lado, anel, 0.022, c['punho'], alto=0.003, normais=anel_normais(anel, eixo), fechada=True))
    # cadarço da fenda da camisa
    for k in range(3):
        z = 1.375 - 0.014 * k
        pc.append(faixa('cad_c%d' % k, [p_tronco(z, -0.13, 0.009), p_tronco(z - 0.01, 0.13, 0.009)], 0.003, c['cadarco']))
        pc.append(faixa('cad_d%d' % k, [p_tronco(z, 0.13, 0.009), p_tronco(z - 0.01, -0.13, 0.009)], 0.003, c['cadarco']))
    pele.append(juntar(pc, 'peito_camisa'))

    # --- corpete de couro: aberto em V na frente com cadarço, cava funda, alças por cima do ombro ---
    def abertura(z, t):
        g = 0.07 + 0.36 * ss(1.1, 1.31, z)
        return (g, 2 * math.pi - g)
    def folga_c(z, a):
        return 0.02 + 0.004 * ss(1.0, 0.9, z)
    linhas = []
    for j in range(15):
        z = 0.92 + (1.30 - 0.92) * j / 14
        g0, g1 = abertura(z, 0)
        linhas.append((z, g0, g1))
    cor, gcor = casca('corpete', linhas, folga_c, c['couro'], NA=40, esp=0.0035)
    pc = [cor]
    NA = len(gcor[0])
    # beiradas com costura (frente esquerda/direita, embaixo)
    pc.append(faixa('beira_e', [l[0] for l in gcor], 0.012, c['costura'], alto=0.004))
    pc.append(faixa('beira_d', [l[-1] for l in gcor], 0.012, c['costura'], alto=0.004))
    pc.append(faixa('beira_b', gcor[0], 0.012, c['costura'], alto=0.004))
    pc.append(faixa('beira_t', gcor[-1], 0.012, c['costura'], alto=0.004))
    # alças por cima do ombro (da frente do decote até as costas), com costura nas beiradas
    for s_ in (1, -1):
        c0 = Vector((s_ * 0.085, -0.01, 1.30))
        al, na = [], []
        for i in range(17):
            th = math.pi * i / 16
            d = Vector((0, -math.cos(th), math.sin(th)))
            rr = raio(F_PELE['bvh'], c0, d, 0.25) or 0.1
            al.append(c0 + d * (rr + 0.02))
            na.append(d)
        pc.append(faixa('alca%d' % s_, al, 0.04, c['couro'], alto=0.004, normais=na))
        pc.append(faixa('alcac%d' % s_, al, 0.012, c['costura'], alto=0.0065, normais=na))
    # cadarço em X de 0,96 a 1,24
    pts_e = [l[0] for l in gcor]
    pts_d = [l[-1] for l in gcor]
    for k in range(1, 10):
        a_, b_ = pts_e[k], pts_d[k]
        a2, b2 = pts_e[k + 1], pts_d[k + 1]
        pc.append(faixa('x1_%d' % k, [a_, b2], 0.0035, c['cadarco'], alto=0.005))
        pc.append(faixa('x2_%d' % k, [b_, a2], 0.0035, c['cadarco'], alto=0.005))
        if c.get('ilhos'):
            pc.append(esfera('il_e%d' % k, a_ + fora(a_) * 0.004, 0.0035, c['ilhos'], seg=5, aneis=3))
            pc.append(esfera('il_d%d' % k, b_ + fora(b_) * 0.004, 0.0035, c['ilhos'], seg=5, aneis=3))
    # rebites/filigrana pelas beiradas (raro em diante)
    if c.get('rebite'):
        for j in range(2, 15, 2):
            for l, s in ((gcor[j][1], 1), (gcor[j][-2], -1)):
                pc.append(esfera('rb%d%d' % (j, s), l + fora(l) * 0.004, 0.004, c['rebite'], seg=5, aneis=3))
    if c.get('gravura'):  # volutas gravadas no couro, dos dois lados do peito
        for s in (1, -1):
            pts = []
            for i in range(18):
                u = i / 17
                a = s * (0.55 + 0.75 * u)
                z = 1.16 + 0.07 * math.sin(u * math.pi * 1.6) - 0.1 * u
                pts.append(p_tronco(z, a, 0.0195))
            pc.append(tubo('vol%d' % s, pts, 0.0028, c['gravura'], lados=4))
            pts2 = [p_tronco(1.04 + 0.03 * math.sin(u * 6), s * (0.4 + 0.9 * u), 0.019) for u in [i / 14 for i in range(15)]]
            pc.append(tubo('vol2%d' % s, pts2, 0.0022, c['gravura'], lados=4))
    if c.get('broche'):
        pc += c['broche'](p_tronco(1.33, 0.0, 0.03))
    # aba do corpete (peplum) por cima do quadril, aberta na frente
    for i, (a0, a1) in enumerate(((0.1, 1.45), (1.5, 2.95), (3.33, 4.78), (4.83, 6.18))):
        ab, gab = casca('aba%d' % i, [(z, a0, a1) for z in (0.84, 0.88, 0.92, 0.935)], lambda z, a: 0.016 + 0.03 * ss(0.93, 0.84, z), c['couro'], NA=10, saia=True, esp=0.0035)
        pc.append(ab)
        pc.append(faixa('abab%d' % i, gab[0], 0.01, c['costura'], alto=0.004))
    pele.append(juntar(pc, 'peito_corpete'))

    # --- cinto largo com fivela e ponta caída; bolsa a tiracolo ---
    pc = []
    zc = 0.945
    pts = [p_tronco(zc, 2 * math.pi * i / 36, 0.026, saia=True) for i in range(36)]
    pc.append(faixa('cinto', pts, 0.042, c['cinto'], alto=0.003, fechada=True))
    fv = p_tronco(zc, 0.0, 0.034, saia=True)
    pc.append(moldura('fivela', fv, 0.05, 0.044, 0.0065, c['fivela']))
    if c.get('joia_cinto'):
        pc.append(c['joia_cinto'](fv + Vector((0, -0.006, 0))))
    ponta = [p_tronco(zc - 0.005 - 0.02 * k, 0.18 + 0.02 * k, 0.03, saia=True) for k in range(7)]
    pc.append(faixa('ponta', ponta, 0.034, c['cinto'], alto=0.003))
    # correia da bolsa: do ombro direito, cruzando o peito, até o quadril esquerdo; e por trás
    frente = [p_tronco(1.345 - 0.36 * u, -0.6 + 2.0 * u, 0.03 + 0.006 * math.sin(u * math.pi)) for u in [i / 18 for i in range(19)]]
    tras = [p_tronco(1.345 - 0.36 * u, -2.5 - 1.9 * u + 0.0, 0.02) for u in [i / 18 for i in range(19)]]
    pc.append(faixa('correia_f', frente, 0.028, c['correia'], alto=0.004))
    pc.append(faixa('correia_t', tras, 0.028, c['correia'], alto=0.004))
    pele.append(juntar(pc, 'peito_cinto'))
    bolsa_c = p_tronco(0.86, 1.25, 0.05, saia=True)
    fr = Vector((math.sin(1.25), -math.cos(1.25), 0))
    bl = [caixa('bolsa', bolsa_c, (0.1, 0.045, 0.11), c['bolsa'], frente=fr),
          caixa('tampa', bolsa_c + fr * 0.024 + Vector((0, 0, 0.03)), (0.104, 0.008, 0.06), c['bolsa_tampa'], frente=fr),
          caixa('fech', bolsa_c + fr * 0.03 + Vector((0, 0, 0.005)), (0.014, 0.006, 0.026), c['fivela'], frente=fr)]
    saia.append(juntar(bl, 'quadril_bolsa'))

    # --- túnica de pano por cima da saia (no lugar da saia do herói), barra bordada, fenda na frente ---
    tl = [(z, -math.pi + 0.01, math.pi - 0.01) for z in (0.58, 0.63, 0.68, 0.73, 0.78, 0.83, 0.88, 0.93, 0.98)]
    tun, gtun = casca('tunica', tl, lambda z, a: 0.008 + 0.09 * ss(0.95, 0.58, z) ** 1.4, c['tunica'], NA=40, saia=True, esp=0.0)
    pt = [tun]
    barra = [v + Vector((0, 0, 0.012)) for v in gtun[0]]
    pt.append(faixa('barra', barra, 0.028, c['barra'], alto=0.002))
    saia.append(juntar(pt, 'quadril_tunica'))

    # --- braçadeiras longas de couro com 2 tiras e fivelinhas ---
    for lado, (A, B) in ((1, (COTOVELO_E, PUNHO_E)), (-1, (espelho(COTOVELO_E), espelho(PUNHO_E)))):
        nome = 'braco_e' if lado > 0 else 'braco_d'
        br, aneis, eixo = manga(nome + 'b', A, B, 0.2, 0.93, lambda t: 0.017 + 0.006 * t ** 4, c['bracadeira'], N=9, M=12, esp=0.003)
        pb = [br]
        for i in (0, len(aneis) - 1):
            pb.append(faixa(nome + 'f%d' % i, aneis[i], 0.009, c['costura'], alto=0.004, normais=anel_normais(aneis[i], eixo), fechada=True))
        for i in (2, 5):
            n = anel_normais(aneis[i], eixo)
            pb.append(faixa(nome + 't%d' % i, aneis[i], 0.011, c['tira'], alto=0.007, normais=n, fechada=True))
            k = 0  # fivelinha em cima do braço
            p = aneis[i][k] + n[k] * 0.009
            pb.append(caixa(nome + 'fv%d' % i, p, (0.012, 0.004, 0.014), c['fivela'], frente=n[k]))
        if c.get('placa_braco'):
            for i in range(1, 7):
                anel = aneis[i]
                n = anel_normais(anel, eixo)
                pb.append(faixa(nome + 'pl%d' % i, [anel[k] + n[k] * 0.004 for k in range(1, 6)], 0.016, c['placa_braco'], alto=0.006, normais=n[1:6]))
        if c.get('joia_braco'):
            p = aneis[4][0] + anel_normais(aneis[4], eixo)[0] * 0.012
            pb.append(gema(nome + 'jo', p, 0.009, c['joia_braco'], alto=1.6, frente=anel_normais(aneis[4], eixo)[0]))
        pele.append(juntar(pb, nome))

    # --- calça justa nas coxas (entra na bota) ---
    for lado in (1, -1):
        A = Vector((lado * JOELHO_E.x, 0.0, 0.907))
        B = Vector((lado * JOELHO_E.x, JOELHO_E.y, JOELHO_E.z))
        cl, _, _ = manga('calca%d' % lado, A + Vector((0, 0, 0.03)), B, 0.0, 1.05, 0.004, c['calca'], N=10, M=14, longe=0.14, bvh=BVH_PERNA[lado], atras=lambda t: 0.006)
        pele.append(cl)
    # --- botas altas de couro com dobra no joelho ---
    for lado, (A, B) in ((1, (JOELHO_E, TORNOZELO_E)), (-1, (espelho(JOELHO_E), espelho(TORNOZELO_E)))):
        nome = 'bota_e' if lado > 0 else 'bota_d'
        bt, aneis, eixo = manga(nome + 'c', A, B, -0.02, 1.02, lambda t: 0.012 + 0.006 * (1 - t), c['bota'], N=12, M=14, esp=0.003, longe=0.13, bvh=BVH_PERNA[lado], atras=lambda t: 0.01 * ss(0.4, 0.0, t))
        pb = [bt]
        # dobra: anel mais largo do joelho para cima
        db, aneis2, eixo2 = manga(nome + 'd', A + (A - B) * 0.0, B, -0.2, 0.02, lambda t: 0.024 + 0.02 * (0.02 - t) * 4, c['bota_dobra'], N=5, M=14, esp=0.003, longe=0.14, bvh=BVH_PERNA[lado], atras=lambda t: 0.01)
        pb.append(db)
        pb.append(faixa(nome + 'dbb', aneis2[0], 0.01, c['costura'], alto=0.004, normais=anel_normais(aneis2[0], eixo2), fechada=True))
        pb.append(faixa(nome + 'dbc', aneis2[-1], 0.01, c['costura'], alto=0.004, normais=anel_normais(aneis2[-1], eixo2), fechada=True))
        if c.get('joelheira'):
            p = aneis2[2][7] if False else None
            j = A + Vector((0, -0.05, -0.01))
            pb.append(esfera(nome + 'jl', j, 0.034, c['joelheira'], seg=8, aneis=5, escala=(0.9, 0.45, 1.0)))
        pele.append(juntar(pb, nome))

    # --- ombreiras (raro em diante) ---
    for lado, n in ((1, 'ombro_e'), (-1, 'ombro_d')):
        if c.get('ombro') and (lado in c.get('ombro_lados', (1, -1))):
            ps = []
            for k in range(c.get('ombro_lames', 2)):
                ps.append(lame_ombro(n + str(k), lado, -0.055 + 0.0 * k, 0.03 + 0.012 * k, 0.07 + 0.008 * k, 0.085 + 0.009 * k,
                                     1.325 - 0.022 * k, 1.35, c['ombro'], borda=c.get('ombro_borda'), desloca=c.get('ombro_flutua', Vector()) * Vector((lado, 1, 1)) * (1 + k * 0.5)))
            if c.get('ombro_extra'):
                ps += c['ombro_extra'](lado, n)
            duras.append(juntar(ps, n))
    if c.get('extra'):
        e = c['extra']()
        pele += e.get('pele', [])
        duras += e.get('duras', [])
    exportar(r, pele, saia, duras)

BASE = dict(camisa='linho', punho='linho_punho', cadarco='cadarco', couro='couro', costura='couro_costura', cinto='couro_escuro',
            fivela='ferro', correia='couro_escuro', bolsa='couro', bolsa_tampa='couro_escuro', tunica='pano_cinza', barra='pano_cinza_escuro',
            bracadeira='couro', tira='couro_escuro', bota='couro', bota_dobra='couro', joelheira=None, calca='pano_verde')

def raridade(r):
    c = dict(BASE)
    if r == 1:  # Patrulheiro: couro escuro oleado, latão, túnica azul com barra bordada, ombreira de couro só na direita
        c.update(camisa='linho_claro', punho='bordado_azul', couro='couro_oleado', costura='couro_costura_clara', cinto='couro_preto',
                 fivela='latao', ilhos='latao', rebite='latao', tunica='pano_azul', barra='bordado_azul', bracadeira='couro_oleado',
                 tira='couro_preto', bota='couro_oleado', bota_dobra='couro_oleado', ombro='couro_oleado', ombro_borda='latao',
                 ombro_lados=(-1,), ombro_lames=2)
    if r == 2:  # Arcano da trilha: couro vinho gravado a ouro, túnica roxa bordada, ombreiras finas de aço polido, broche
        c.update(camisa='seda_branca', punho='bordado_roxo', couro='couro_vinho', costura='couro_costura_ouro', cinto='couro_preto',
                 fivela='ouro', ilhos='ouro', cadarco='cadarco_ouro', gravura='ouro', tunica='pano_roxo', barra='bordado_roxo',
                 bracadeira='couro_vinho', tira='couro_preto', placa_braco='aco', bota='couro_preto', bota_dobra='couro_vinho',
                 joelheira='aco', ombro='aco', ombro_borda='ouro', ombro_lames=2,
                 joia_cinto=lambda p: gema('jc', p, 0.012, 'gema_roxa', alto=1.4),
                 broche=lambda p: [gema('br', p, 0.013, 'gema_roxa', alto=1.4), arco('bra', p + Vector((0, 0.004, 0)), 0.018, 0.004, -0.6, math.pi + 0.6, 'ouro')])
    if r == 3:  # Brasa: couro negro com costura de brasa acesa, túnica carmesim com runas de brasa, bronze fino
        def extra3():
            ps = []
            # gola alta de bronze fino na nuca (gorjal leve) e 2 penas de brasa no ombro esquerdo
            pts = [p_tronco(1.37, a, 0.02) for a in [math.pi - 1.4 + 2.8 * i / 16 for i in range(17)]]
            ps.append(faixa('gola', pts, 0.03, 'bronze', alto=0.004))
            return {'pele': [juntar(ps, 'peito_gola')]}
        def ombro3(lado, n):
            th = math.radians(28)
            O = Vector((lado * math.cos(th), 0, math.sin(th)))
            J = Vector((lado * 0.115, -0.005, 1.325))
            return [arco(n + 'ln', J + O * 0.02, 0.085, 0.004, -0.9, 0.9, 'brasa_linha', eixo=Vector((0, 1, 0)) if False else Vector((-lado * math.sin(th) * 0 + 0, 1, 0)))] if False else \
                   [esfera(n + 'nb', J + O * 0.09 + Vector((0, -0.055, -0.01)), 0.011, 'brasa', seg=6, aneis=4)]
        c.update(camisa='seda_carmesim_esc', calca='pano_negro', punho='bordado_brasa', couro='couro_negro', costura='costura_brasa', cinto='couro_negro',
                 fivela='bronze', ilhos='bronze', cadarco='cadarco_brasa', gravura='bronze', rebite='bronze', tunica='pano_carmesim',
                 barra='bordado_brasa', bracadeira='couro_negro', tira='bronze', placa_braco='bronze', bota='couro_negro',
                 bota_dobra='couro_negro', joelheira='bronze', ombro='couro_negro', ombro_borda='bronze', ombro_lames=3,
                 ombro_extra=ombro3, extra=extra3, joia_braco='brasa',
                 joia_cinto=lambda p: esfera('jc', p, 0.014, 'brasa', seg=8, aneis=6, escala=(1, 0.5, 1)),
                 broche=lambda p: [esfera('br', p, 0.012, 'brasa', seg=8, aneis=6, escala=(1, 0.5, 1)), arco('bra', p + Vector((0, 0.004, 0)), 0.019, 0.004, -0.6, math.pi + 0.6, 'bronze')])
    if r == 4:  # Aurora: couro perolado com filigrana de prata acesa, seda iridescente, runas ciano, cristais e ombreiras soltas
        def ombro4(lado, n):
            th = math.radians(28)
            O = Vector((lado * math.cos(th), 0, math.sin(th)))
            J = Vector((lado * 0.115, -0.005, 1.325))
            ps = []
            for k in range(3):
                b = J + O * 0.11 + Vector((lado * 0.02, 0.03 + 0.025 * k, 0.03))
                ps.append(gema(n + 'p%d' % k, b + Vector((lado * 0.025 * k, 0.03 * k, 0.06 + 0.015 * k)), 0.014 - 0.002 * k, 'cristal', alto=3.0 - 0.3 * k,
                               frente=Vector((lado * 0.6, 0.6, 0.3)).normalized()))
            return ps
        def extra4():
            ps = []
            # aureola fina de cristais atrás da cabeça (presa no peito)
            c0 = Vector((0, 0.15, 1.5))
            ps.append(arco('aur', c0, 0.2, 0.004, 0, 2 * math.pi, 'ouro_claro', eixo=Vector((0, 1, 0.2)).normalized(), N=36, M=3))
            for k in range(8):
                a = 2 * math.pi * k / 8
                p = c0 + Vector((math.cos(a) * 0.2, -math.sin(a) * 0.04, math.sin(a) * 0.2))
                ps.append(gema('al%d' % k, p, 0.01, 'cristal_fio' if k % 2 else 'cristal', alto=2.4, frente=(p - c0).normalized()))
            return {'duras': [juntar(ps, 'peito_aureola')]}
        c.update(camisa='seda_aurora', punho='bordado_aurora', couro='couro_aurora', costura='costura_aurora', cinto='couro_perola_escuro',
                 fivela='prata', ilhos='prata', cadarco='cadarco_aurora', gravura='prata_viva', rebite='cristal_fio', tunica='seda_aurora_tunica', calca='pano_noite',
                 barra='bordado_aurora', bracadeira='couro_aurora', tira='prata', placa_braco='prata', bota='couro_aurora',
                 bota_dobra='couro_aurora', joelheira='prata', ombro='prata', ombro_borda='cristal_fio', ombro_lames=3,
                 ombro_flutua=Vector((0.02, 0, 0.02)), ombro_extra=ombro4, extra=extra4, joia_braco='cristal_fio',
                 joia_cinto=lambda p: gema('jc', p, 0.014, 'cristal_fio', alto=1.6),
                 broche=lambda p: [gema('br', p, 0.015, 'cristal_fio', alto=1.6), arco('bra', p + Vector((0, 0.004, 0)), 0.02, 0.004, -0.6, math.pi + 0.6, 'prata')])
    return c

for r in SO:
    set_roupa(r, raridade(r))
