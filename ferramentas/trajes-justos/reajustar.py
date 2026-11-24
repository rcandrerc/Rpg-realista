# Trajes justos (André 2026-11-24): "a roupa não acompanha o corpo nem os membros, deixou tudo muito gordo, ombros
# altos demais; usa a linha do meu irmão mas o seu modelo".
#
# Por quê: dentro do jogo o corpo não é o do .glb. armadura.gd afina a cintura e o quadril, cola a manga no braço,
# afina o tronco do masculino e encurta a saia (André 2026-11-03/04, "tá gordão, sem cintura", "bujão de gás"). O
# patrulheiro/roupão v5 do irmão nasce desse corpo já afinado. O Patrulheiro 2 / Roupão 2 (modelar3.py,
# modelar_robe.py) foi medido no corpo CRU do .glb: até 4 cm mais largo de cada lado na cintura.
#
# O que faz: não refaz o desenho. Cada vértice da roupa acha o ponto mais perto do corpo cru e anda o mesmo que esse
# ponto andou no corpo do jogo (corpo-do-jogo.gd grava as duas malhas, vértice a vértice). Assim a roupa veste o
# corpo afinado como a do irmão, com a mesma folga de antes. Opcional: K < 1 também aperta a folga (a + (d-a)*K).
# O deslocamento é alisado na malha (sem degrau). Pesos dos ossos ficam os mesmos.
# A ombreira (peça dura) anda com o ombro e fica um pouco menor (OMBREIRA, padrão 0,85).
#
# Rodar: blender -b -P ferramentas/trajes-justos/reajustar.py -- entrada.glb corpo_do_jogo.obj saida.glb
import bpy, sys, os, math
from mathutils.kdtree import KDTree
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ent, obj, sai = sys.argv[sys.argv.index('--') + 1:][:3]
K = float(os.environ.get('K', '1.0'))
A = float(os.environ.get('A', '0.004'))
OMBREIRA = float(os.environ.get('OMBREIRA', '0.85'))
K_BOTA = float(os.environ.get('K_BOTA', os.environ.get('K', '1.0')))
DESCE = float(os.environ.get('DESCE', '0.0'))  # a ombreira desce (m)
ROBE = 'robe_' in os.path.basename(ent)
MASC = '_m_r' in os.path.basename(ent)

MASC_CORPO = '_m_r' in os.path.basename(ent)
# ---------- corpo cru e do jogo (OBJ de corpo-do-jogo.gd, Y para cima -> Blender Z para cima) ----------
grupos, atual, vs = {}, None, []
for linha in open(obj):
    if linha.startswith('o '):
        atual = linha.split()[1]
        grupos[atual] = {'v0': len(vs), 'f': []}
    elif linha.startswith('v '):
        x, y, z = map(float, linha.split()[1:4])
        vs.append(Vector((x, -z, y)))
    elif linha.startswith('f '):
        grupos[atual]['f'].append([int(t) - 1 for t in linha.split()[1:4]])
cru_v, cru_f, desl_v = [], [], []
for nome, g in grupos.items():
    if not nome.startswith('cru_'):
        continue
    par = grupos['jogo_' + nome[4:]]
    n0 = len(cru_v)
    fim = min(f for f in [gg['v0'] for gg in grupos.values() if gg['v0'] > g['v0']] + [len(vs)])
    nv = fim - g['v0']
    for i in range(nv):
        cru_v.append(vs[g['v0'] + i])
        dv = vs[par['v0'] + i] - vs[g['v0'] + i]
        # só o aperto para dentro conta: no masculino o jogo também encurta o moletom (a barra sobe 22 cm) e some
        # com o capuz; isso não é a linha do corpo. Sem a parte vertical e no máximo 5 cm
        dv.z = 0.0
        if MASC_CORPO and nome.startswith('cru_Tops'):
            dv = Vector()  # o moletom dele no jogo é outro (sem capuz, curto): a roupa mede pela pele (aperto K abaixo)
        if dv.length > 0.05:
            dv = dv.normalized() * 0.05
        desl_v.append(dv)
    cru_f += [[n0 + (i - g['v0']) for i in f] for f in g['f']]
    print('CORPO', nome, nv, 'mexeu no maximo', round(max((d.length for d in desl_v[n0:]), default=0), 3))
BVH = BVHTree.FromPolygons(cru_v, cru_f)
jogo_v = [cru_v[i] + desl_v[i] for i in range(len(cru_v))]
# para apertar a folga: pele, blusa e sapato do jogo. A saia do VRoid fica de fora (escondida debaixo da roupa, ela
# segurava a calça larga longe da perna)
sem_saia = set()
for nome, g in grupos.items():
    if nome.startswith('cru_Bottoms'):
        sem_saia.add(nome)
f_jogo, n0 = [], 0
for nome, g in grupos.items():
    if not nome.startswith('cru_'):
        continue
    nf = len(g['f'])
    if nome not in sem_saia and not (MASC and nome.startswith('cru_Tops')):  # o moletom dele no jogo é curto: só pele
        f_jogo += cru_f[n0:n0 + nf]
    n0 += nf
BVH_JOGO = BVHTree.FromPolygons(jogo_v, f_jogo)
# só a pele (crua e do jogo): a roupa nunca entra nela (o tronco do masculino afina muito e furava a barriga)
f_pele, n0 = [], 0
for nome, g in grupos.items():
    if not nome.startswith('cru_'):
        continue
    nf = len(g['f'])
    if nome.startswith('cru_Body_00'):
        f_pele += cru_f[n0:n0 + nf]
    n0 += nf
PELE_CRU = BVHTree.FromPolygons(cru_v, f_pele)
PELE_JOGO = BVHTree.FromPolygons(jogo_v, f_pele)
# as faces do Godot giram ao contrário do Blender: descobre o lado de fora com um ponto bem na frente do peito
_q, _n, _, _ = PELE_CRU.find_nearest(Vector((0, -1.0, 1.0)))
FORA = 1.0 if (Vector((0, -1.0, 1.0)) - _q).dot(_n) > 0 else -1.0
def lado_pele(bvh, p):
    q, n, _, d = bvh.find_nearest(p)
    if q is None:
        return 1.0, None, None
    return (d if (p - q).dot(n) * FORA >= 0 else -d), q, n * FORA

def bary(p, f):
    a, b, c = (cru_v[i] for i in f)
    v0, v1, v2 = b - a, c - a, p - a
    d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-12:
        return (1 / 3, 1 / 3, 1 / 3)
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    return (1 - v - w, v, w)

def desl_corpo(p):
    q, n, fi, d = BVH.find_nearest(p)
    if q is None:
        return Vector(), 0.0
    f = cru_f[fi]
    u = bary(q, f)
    return sum((desl_v[i] * u[k] for k, i in enumerate(f)), Vector()), d

def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ent)
ARM = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
def osso(n):
    return ARM.matrix_world @ ARM.data.bones[n].head_local
QUADRIL = osso('J_Bip_L_UpperLeg').z
ZBRACO = osso('J_Bip_L_UpperArm').z
OMBRO_X = abs(osso('J_Bip_L_UpperArm').x)

duras, pele, cru = [], [], []
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.startswith('Icosphere'):
        continue
    if o.parent is not ARM or o.name.startswith('cabeca'):
        duras.append(o)
        continue
    mw = o.matrix_world
    ps = [mw @ v.co for v in o.data.vertices]
    desl = []
    for p in ps:
        dc, d = desl_corpo(p)
        nova = p + dc
        # saia, túnica e robe abaixo do quadril: a roda é desenho, não aperta
        fk = ss(QUADRIL - 0.04, QUADRIL + 0.06, p.z) if (ROBE or 'tunica' in o.name or 'saia' in o.name) else 1.0
        kk = K_BOTA if o.name.startswith('bota') and not ROBE else K  # a dobra da bota virava calça bufante
        if kk < 1.0 and fk > 0:
            q, n, _, dj = BVH_JOGO.find_nearest(nova)
            if q is not None and dj > A:  # (as faces do Godot giram ao contrário: sem teste de lado)
                nova = nova + (q + (nova - q).normalized() * (A + (dj - A) * kk) - nova) * fk
        desl.append(nova - p)
    cru.append((o, ps, desl))

# camadas: camisa, corpete, cinto, bolsa e túnica (ou robe, manto, cordão) se sobrepõem. Cada vértice anda a média do
# que andou a vizinhança (3 cm) de TODAS as camadas do tronco: quem está uma em cima da outra anda igual e a camisa
# não fura o corpete. Pernas (calça, bota) são outro grupo.
def grupo(nome):
    return 'perna' if nome.startswith('calca') or nome.startswith('bota') else 'tronco'
R_MEDIA = float(os.environ.get('R_MEDIA', '0.03'))
for gname in ('tronco', 'perna'):
    pts = [(p, d) for o, ps, ds in cru if grupo(o.name) == gname for p, d in zip(ps, ds)]
    if not pts:
        continue
    kd = KDTree(len(pts))
    for i, (p, _) in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
    for o, ps, ds in cru:
        if grupo(o.name) != gname:
            continue
        novo = []
        for p in ps:
            soma, peso = Vector(), 0.0
            for _, j, dist in kd.find_range(p, R_MEDIA):
                w = math.exp(-(dist / (R_MEDIA * 0.5)) ** 2)
                soma += pts[j][1] * w; peso += w
            novo.append(soma / peso if peso else Vector())
        ds[:] = novo

# pele: a roupa fica fora dela pelo menos o que já ficava (até 5 mm). O empurrão para fora também vale para as
# camadas de cima na mesma vizinhança (o maior de perto), senão a camisa empurrada furava o corpete
for gname in ('tronco', 'perna'):
    emp = []
    for o, ps, desl in cru:
        if grupo(o.name) != gname:
            continue
        for i, p in enumerate(ps):
            s0, _, _ = lado_pele(PELE_CRU, p)
            if s0 <= 0:
                continue
            s1, q, n = lado_pele(PELE_JOGO, p + desl[i])
            alvo = min(s0, 0.005)
            if q is not None and s1 < alvo and alvo - s1 < 0.015:  # mais que isso é o lado errado (axila, dobra): ignora
                emp.append((p + desl[i], n.normalized() * (alvo - s1)))
    if not emp:
        continue
    kd = KDTree(len(emp))
    for i, (p, _) in enumerate(emp):
        kd.insert(p, i)
    kd.balance()
    for o, ps, desl in cru:
        if grupo(o.name) != gname:
            continue
        for i, p in enumerate(ps):
            perto = kd.find_range(p + desl[i], R_MEDIA * 0.7)
            if perto:
                desl[i] = desl[i] + max((emp[j][1] for _, j, _ in perto), key=lambda v: v.length)

for o, ps, desl in cru:
    me = o.data
    mw = o.matrix_world
    mi = mw.inverted()
    for i, v in enumerate(me.vertices):
        v.co = mi @ (ps[i] + desl[i])
    me.update()
    pele.append((ps, desl))
    print('PECA', o.name, 'max', round(max(x.length for x in desl), 3), 'media', round(sum(x.length for x in desl) / len(desl), 4))

# peça dura: a ombreira anda com o ombro (média do que a roupa de perto andou) e fica um pouco menor; o capuz e o
# cordão andam com o corpo onde estão (quase nada)
PELE_P = [p for ps, ds in pele for p in ps]
PELE_D = [d for ps, ds in pele for d in ds]
KD_PELE = KDTree(len(PELE_P))
for i, p in enumerate(PELE_P):
    KD_PELE.insert(p, i)
KD_PELE.balance()
for o in duras:
    mw = o.matrix_world
    pts = [mw @ v.co for v in o.data.vertices]
    c = sum(pts, Vector()) / len(pts)
    soma, n = Vector(), 0
    for ps, desl in pele:
        for p, dd in zip(ps, desl):
            if (p - c).length < 0.08:
                soma += dd; n += 1
    t = soma / n if n else desl_corpo(c)[0]
    novo = [p + t for p in pts]
    if not o.name.startswith('ombro') and not o.name.startswith('cabeca'):
        # cordão e afins: cada ponto anda o que a roupa ao lado andou (o robe afinou na cintura e o cordão ficava sobrando)
        novo = []
        for p in pts:
            s2, w2 = Vector(), 0.0
            for _, j, dist in KD_PELE.find_range(p, 0.05):
                w = math.exp(-(dist / 0.025) ** 2)
                s2 += PELE_D[j] * w; w2 += w
            novo.append(p + (s2 / w2 if w2 else t))
    if o.name.startswith('ombro'):
        lado = 1 if c.x > 0 else -1
        eixo = Vector((lado * OMBRO_X, c.y + t.y, ZBRACO + t.z))
        novo = [eixo + (p - eixo) * OMBREIRA - Vector((0, 0, DESCE)) for p in novo]
    mi = mw.inverted()
    for v, p in zip(o.data.vertices, novo):
        v.co = mi @ p
    o.data.update()
    print('DURA', o.name, 'andou', tuple(round(x, 3) for x in t), 'n', n)

bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=sai, use_selection=True, export_format='GLB', export_materials='EXPORT', export_yup=True,
                          export_skins=True, export_apply=False, export_animations=False)
print('SAIU', sai)
