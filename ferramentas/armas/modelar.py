# Espada A e Cajado A (direção de arte, 2026-11-03; escolha do André): modelos low-poly para o celular.
# Rodar: blender -b -P ferramentas/armas/modelar.py   (antes: python3 ferramentas/armas/texturas.py)
# Sai: godot-prototipo/armas3d/espada.glb e cajado.glb.
# Eixos (Blender, Z para cima): a origem é o ponto onde a mão segura e a arma cresce para +Z (no Godot, +Y).
# A lâmina é larga em X e fina em Y. Mesmas medidas da espada antiga (ponta em 0,924 m, pomo em -0,21 m),
# para os pontos de encaixe (mão, costas) e o rastro do golpe continuarem certos.
# Os materiais saem com nomes (aco, fio, runa, ouro, gema, cabo, madeira, fogo, ferro): o jogo troca cada um pelo
# shader toon dele (godot-prototipo/armas.gd).
import bpy, bmesh, math, os
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(AQUI, 'tex')
SAIDA = os.path.join(AQUI, '..', '..', 'godot-prototipo', 'armas3d')
os.makedirs(SAIDA, exist_ok=True)

COR = {'aco': (0.72, 0.76, 0.82), 'fio': (0.95, 0.97, 1.0), 'runa': (0.3, 0.7, 1.0), 'ouro': (0.85, 0.62, 0.25),
       'gema': (0.25, 0.6, 1.0), 'cabo': (0.12, 0.16, 0.3), 'madeira': (0.3, 0.2, 0.14), 'fogo': (1.0, 0.55, 0.12),
       'ferro': (0.45, 0.47, 0.5)}
IMG = {'aco': 'aco.png', 'runa': 'runa.png', 'cabo': 'cabo.png', 'madeira': 'madeira.png'}


def material(nome):
    m = bpy.data.materials.get(nome)
    if m:
        return m
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*COR[nome], 1.0)
    b.inputs['Metallic'].default_value = 1.0 if nome in ('aco', 'fio', 'ouro', 'ferro') else 0.0
    b.inputs['Roughness'].default_value = 0.3
    if nome in IMG:
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(os.path.join(TEX, IMG[nome]))
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if nome in ('runa', 'gema', 'fogo'):
        b.inputs['Emission Color'].default_value = (*COR[nome], 1.0)
        b.inputs['Emission Strength'].default_value = 0.4
    return m


class Malha:
    def __init__(s, nome):
        s.nome = nome
        s.bm = bmesh.new()
        s.uv = s.bm.loops.layers.uv.new('UVMap')
        s.mats = []

    def mat(s, nome):
        if nome not in s.mats:
            s.mats.append(nome)
        return s.mats.index(nome)

    def face(s, pts, nome, uvf):
        vs = [s.bm.verts.new(p) for p in pts]
        f = s.bm.faces.new(vs)
        f.material_index = s.mat(nome)
        uvs = [uvf(Vector(p)) for p in pts]
        # costura do mapa cilíndrico: não deixa a face dar a volta inteira na textura
        us = [u for u, v in uvs]
        if max(us) - min(us) > 0.5:
            uvs = [(u + 1.0 if u < 0.5 else u, v) for u, v in uvs]
        for l, uv in zip(f.loops, uvs):
            l[s.uv].uv = uv
        return f

    def anel_loft(s, aneis, nome_fn, uvf, fechar=True):
        # liga anéis consecutivos (mesmo número de pontos) com quads
        for i in range(len(aneis) - 1):
            a, b = aneis[i], aneis[i + 1]
            n = len(a)
            for j in range(n if fechar else n - 1):
                k = (j + 1) % n
                pts = [a[j], a[k], b[k], b[j]]
                # anel que encolheu para um ponto: triângulo
                if (Vector(b[j]) - Vector(b[k])).length < 1e-7:
                    pts = [a[j], a[k], b[j]]
                elif (Vector(a[j]) - Vector(a[k])).length < 1e-7:
                    pts = [a[j], b[k], b[j]]
                s.face(pts, nome_fn(i, j), uvf)

    def tampa(s, anel, nome, uvf, para_cima=True):
        pts = list(anel) if para_cima else list(reversed(anel))
        s.face(pts, nome, uvf)

    def objeto(s):
        bmesh.ops.remove_doubles(s.bm, verts=s.bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(s.bm, faces=s.bm.faces)  # todas as faces para fora (o contorno e o cull dependem disso)
        me = bpy.data.meshes.new(s.nome)
        s.bm.normal_update()
        s.bm.to_mesh(me)
        for n in s.mats:
            me.materials.append(material(n))
        o = bpy.data.objects.new(s.nome, me)
        bpy.context.collection.objects.link(o)
        # faces planas nas arestas duras, lisas nas curvas (ângulo de 35 graus)
        for p in me.polygons:
            p.use_smooth = True
        o.modifiers.new('suave', 'EDGE_SPLIT').split_angle = math.radians(35)
        return o


def plano_xz(k=3.0):
    return lambda p: (p.x * k + 0.5, p.z * k)


def cilindro_uv(kv):
    return lambda p: ((math.atan2(p.y, p.x) / (2 * math.pi)) % 1.0, p.z * kv)


def anel(r, z, n, fase=0.0, rx=None, ry=None, cx=0.0, cy=0.0):
    rx = r if rx is None else rx
    ry = r if ry is None else ry
    return [(cx + rx * math.cos(fase + 2 * math.pi * j / n), cy + ry * math.sin(fase + 2 * math.pi * j / n), z) for j in range(n)]


def torus(M, nome, z, R, r, n=14, m=6):
    an = []
    for i in range(n + 1):
        a = 2 * math.pi * i / n
        c = Vector((math.cos(a), math.sin(a), 0))
        an.append([tuple(c * (R + r * math.cos(2 * math.pi * j / m)) + Vector((0, 0, z + r * math.sin(2 * math.pi * j / m)))) for j in range(m)])
    M.anel_loft(an, lambda i, j: nome, plano_xz())


def torno(M, perfil, n, nome_fn, uvf, fase=0.0, sx=1.0, sy=1.0):
    # sólido de revolução: perfil = [(raio, z)] de baixo para cima; raio 0 nas pontas fecha
    an = [[(r * sx * math.cos(fase + 2 * math.pi * j / n), r * sy * math.sin(fase + 2 * math.pi * j / n), z) for j in range(n)] for r, z in perfil]
    M.anel_loft(an, nome_fn, uvf)
    if perfil[0][0] > 1e-6:
        M.tampa(an[0], nome_fn(0, 0), uvf, para_cima=False)
    if perfil[-1][0] > 1e-6:
        M.tampa(an[-1], nome_fn(len(an) - 1, 0), uvf)


def torno_y(M, perfil, n, zc, nome):
    # sólido de revolução em volta do eixo Y (disco da guarda), centrado na altura zc; perfil = [(raio, y)]
    an = [[(r * math.cos(2 * math.pi * j / n), y, zc + r * math.sin(2 * math.pi * j / n)) for j in range(n)] for r, y in perfil]
    M.anel_loft(an, lambda i, j: nome, plano_xz())


def tubo(M, caminho, raios, nome, n=5):
    # tubo afinando ao longo de um caminho (garras do cajado)
    an = []
    for i, p in enumerate(caminho):
        p = Vector(p)
        t = (Vector(caminho[min(i + 1, len(caminho) - 1)]) - Vector(caminho[max(i - 1, 0)])).normalized()
        a = t.orthogonal().normalized()
        b = t.cross(a).normalized()
        r = raios[i]
        an.append([tuple(p + (a * math.cos(2 * math.pi * j / n) + b * math.sin(2 * math.pi * j / n)) * r) for j in range(n)])
    M.anel_loft(an, lambda i, j: nome, plano_xz())
    M.tampa(an[0], nome, plano_xz(), para_cima=False)


def gema(M, nome, c, rx, ry, rz, n=6):
    # pedra lapidada: dois cones (coroa e pavilhão)
    c = Vector(c)
    cima, baixo = c + Vector((0, 0, rz)), c - Vector((0, 0, rz))
    meio = [c + Vector((rx * math.cos(2 * math.pi * j / n), ry * math.sin(2 * math.pi * j / n), 0)) for j in range(n)]
    for j in range(n):
        k = (j + 1) % n
        M.face([tuple(meio[j]), tuple(meio[k]), tuple(cima)], nome, plano_xz())
        M.face([tuple(meio[k]), tuple(meio[j]), tuple(baixo)], nome, plano_xz())


def gema_y(M, nome, c, r, prof, n=8):
    # gema redonda olhando para os dois lados (±Y): na guarda e no pomo
    c = Vector(c)
    fr, tr = c + Vector((0, -prof, 0)), c + Vector((0, prof, 0))
    meio = [c + Vector((r * math.cos(2 * math.pi * j / n), 0, r * math.sin(2 * math.pi * j / n))) for j in range(n)]
    for j in range(n):
        k = (j + 1) % n
        M.face([tuple(meio[j]), tuple(meio[k]), tuple(fr)], nome, plano_xz())
        M.face([tuple(meio[k]), tuple(meio[j]), tuple(tr)], nome, plano_xz())


def prisma(M, contorno, y0, y1, nome, chanfro=0.0):
    # contorno no plano XZ (anti-horário visto de -Y), engrossado em Y; chanfro encolhe as faces da frente
    import mathutils
    c = Vector((sum(p[0] for p in contorno) / len(contorno), 0, sum(p[1] for p in contorno) / len(contorno)))
    def enc(p, k):
        v = Vector((p[0], 0, p[1]))
        return tuple(c + (v - c) * k)
    k = 1.0 - chanfro
    fr = [tuple(Vector(enc(p, k)) + Vector((0, y0, 0))) for p in contorno]
    me0 = [(p[0], y0 * 0.55, p[1]) for p in contorno]
    me1 = [(p[0], y1 * 0.55, p[1]) for p in contorno]
    tr = [tuple(Vector(enc(p, k)) + Vector((0, y1, 0))) for p in contorno]
    M.anel_loft([fr, me0, me1, tr], lambda i, j: nome, plano_xz())
    M.face(list(reversed(fr)), nome, plano_xz())
    M.face(tr, nome, plano_xz())


def limpar():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)


def exportar(nome):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(SAIDA, nome + '.glb'), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_image_format='AUTO')
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('EXPORTOU', nome, 'triângulos ~', tris)


# ---------------------------------------------------------------- ESPADA A
def espada():
    limpar()
    M = Malha('espada')
    # v2 (direção de arte): lâmina larga como na referência (~17% do comprimento), 15% mais curta, e só afina
    # nos ~20% finais até a ponta
    Z0, ZP = 0.14, 0.78  # base da lâmina (logo acima da guarda) e ponta
    ZA = 0.655  # onde começa a afinar para a ponta
    est = [0.14, 0.17, 0.22, 0.29, 0.36, 0.43, 0.50, 0.57, 0.625, 0.655, 0.69, 0.72, 0.745, 0.765]
    def larg(z):  # meia largura: base com ombro, quase reta e fecha na ponta
        if z < 0.17:
            return 0.046 + (z - 0.14) / 0.03 * 0.008
        if z <= ZA:
            return 0.054 - (z - 0.17) / (ZA - 0.17) * 0.004
        return 0.050 * max(0.0, (ZP - z) / (ZP - ZA)) ** 0.75
    def sulco(z):  # meia largura do sulco da runa (acaba antes da ponta)
        if z < 0.165 or z > 0.6:
            return 0.0
        return 0.009 * min(1.0, (z - 0.165) / 0.03, (0.6 - z) / 0.05)
    T, TS, E, TE = 0.0068, 0.0044, 0.0040, 0.0010  # espessura (meia) da lâmina, no sulco, bisel claro de ~3-4 mm, espessura no fio
    aneis = []
    for z in est:
        w, g = larg(z), sulco(z)
        g = min(g, w * 0.4)
        e = min(E, w * 0.45)
        meio = [(g, TS if g > 0 else T), (g + 0.002 if g > 0 else 0.0005, T), (w - e, T * 0.8), (w, TE)]
        # anel: x>0 frente (-Y) -> trás (+Y), espelhado
        lado = [(x, -y, z) for x, y in meio] + [(x, y, z) for x, y in reversed(meio)]
        outro = [(-x, y, z) for x, y, _ in reversed(lado)]
        aneis.append(lado + outro)
    n = len(aneis[0])  # 16 pontos: 0..3 frente direita, 4..7 trás direita, 8..11 trás esquerda, 12..15 frente esquerda
    tip = [(0.0, 0.0, ZP)] * n
    aneis.append(tip)
    def nome(i, j):
        z = est[min(i, len(est) - 1)]
        tem_sulco = sulco(z) > 0 and sulco(est[min(i + 1, len(est) - 1)]) > 0
        # pares de pontos (j, j+1): faixas da seção
        faixa = {0: 's', 1: 'p', 2: 'f', 3: 'e', 4: 'f', 5: 'p', 6: 's', 7: 'c', 8: 's', 9: 'p', 10: 'f', 11: 'e', 12: 'f', 13: 'p', 14: 's', 15: 'c'}[j]
        if faixa == 'c':
            return 'runa' if tem_sulco else 'aco'
        if faixa == 's':
            return 'runa' if tem_sulco else 'aco'
        if faixa in ('f', 'e'):
            return 'fio'
        return 'aco'
    def uv(p):
        return ((p.x + 0.009) / 0.018, (p.z - 0.165) / 0.435)
    # a runa tem UV própria (faixa do sulco); o aço usa o plano da lâmina
    M.anel_loft(aneis, nome, lambda p: (p.x * 6 + 0.5, p.z * 1.5))
    # refaz a UV das faces da runa
    for f in M.bm.faces:
        if M.mats[f.material_index] == 'runa':
            for l in f.loops:
                l[M.uv].uv = uv(l.vert.co)
    # base da lâmina fechada (fica escondida na guarda)
    M.tampa(aneis[0], 'aco', plano_xz(), para_cima=False)

    # guarda em asa (dourada): contorno no plano XZ, espelhado
    # v2: asa de verdade, pontas viradas para cima e 2 recortes (penas) de cada lado no alto
    meia = [(0.0, 0.11), (0.035, 0.106), (0.07, 0.11), (0.1, 0.12), (0.125, 0.136), (0.144, 0.158), (0.156, 0.186),
            (0.168, 0.245),  # ponta da asa, para cima
            (0.144, 0.2), (0.128, 0.19), (0.13, 0.172),  # 1º recorte
            (0.11, 0.176), (0.094, 0.168), (0.096, 0.153),  # 2º recorte
            (0.074, 0.157), (0.052, 0.152), (0.036, 0.158), (0.0, 0.166)]
    cont = meia[:-1] + [(-x, z) for x, z in reversed(meia[1:])]
    cont = cont[:-1]
    # ordem anti-horária vista de -Y
    prisma(M, cont, -0.013, 0.013, 'ouro', chanfro=0.04)
    # miolo da guarda que segura a gema: disco mais grosso, deitado no eixo Y
    torno_y(M, [(0.0, -0.011), (0.029, -0.011), (0.033, -0.007), (0.033, 0.007), (0.029, 0.011), (0.0, 0.011)], 12, 0.137, 'ouro')
    # gema da guarda (azul, nos dois lados): ~2,5 cm visíveis, saltada para fora do engaste
    gema_y(M, 'gema', (0, 0, 0.137), 0.019, 0.032, n=10)
    # cabo: couro azul com tiras (cilindro de 8 lados) e anéis dourados nas pontas
    torno(M, [(0.0145, -0.168), (0.0158, -0.12), (0.0162, -0.03), (0.0155, 0.06), (0.0148, 0.105)], 8,
          lambda i, j: 'cabo', cilindro_uv(3.4))
    torno(M, [(0.0, 0.098), (0.019, 0.1), (0.021, 0.106), (0.019, 0.114), (0.0, 0.116)], 10, lambda i, j: 'ouro', plano_xz())
    torno(M, [(0.0, -0.176), (0.019, -0.175), (0.021, -0.168), (0.019, -0.16), (0.0, -0.158)], 10, lambda i, j: 'ouro', plano_xz())
    # pomo dourado em losango com gema pequena
    torno(M, [(0.0, -0.212), (0.012, -0.205), (0.024, -0.19), (0.016, -0.178), (0.0, -0.172)], 4, lambda i, j: 'ouro', plano_xz(),
          fase=math.pi / 4, sx=1.0, sy=0.55)
    gema_y(M, 'gema', (0, 0, -0.19), 0.0085, 0.019, n=6)
    M.objeto()
    exportar('espada')


# ---------------------------------------------------------------- CAJADO A (fogo)
def cajado():
    limpar()
    M = Malha('cajado')
    # haste de madeira escura: 10 lados, levemente ondulada, mais grossa em cima
    zs = [-0.47 + k * (0.88 + 0.47) / 16 for k in range(17)]
    perfil = [(0.0205 + (z + 0.47) / 1.35 * 0.004 + 0.0012 * math.sin(z * 9.0), z) for z in zs]
    an = []
    for r, z in perfil:
        dx = 0.004 * math.sin(z * 2.1)
        an.append([(dx + r * math.cos(2 * math.pi * j / 10), r * math.sin(2 * math.pi * j / 10), z) for j in range(10)])
    M.anel_loft(an, lambda i, j: 'madeira', cilindro_uv(1.1))
    # anéis dourados
    for z in (-0.44, -0.14, 0.235, 0.465, 0.86):
        dx = 0.004 * math.sin(z * 2.1)
        r = 0.0205 + (z + 0.47) / 1.35 * 0.004
        an2 = [[(dx + (r + 0.004 + rr) * math.cos(2 * math.pi * j / 12), (r + 0.004 + rr) * math.sin(2 * math.pi * j / 12), z + dz) for j in range(12)]
               for rr, dz in ((0.0, -0.012), (0.004, -0.006), (0.004, 0.006), (0.0, 0.012))]
        M.anel_loft(an2, lambda i, j: 'ouro', plano_xz())
    # cristal laranja no meio da haste, entre dois engastes dourados
    zc = 0.35
    dxc = 0.004 * math.sin(zc * 2.1)
    gema(M, 'fogo', (dxc, 0, zc), 0.044, 0.044, 0.085, n=6)
    for s in (-1, 1):
        for k in range(4):  # garrinhas segurando o cristal
            a = k * math.pi / 2 + math.pi / 4
            c, sn = math.cos(a), math.sin(a)
            p0 = (dxc + 0.025 * c, 0.025 * sn, zc + s * 0.112)
            p1 = (dxc + 0.044 * c, 0.044 * sn, zc + s * 0.075)
            p2 = (dxc + 0.038 * c, 0.038 * sn, zc + s * 0.038)
            tubo(M, [p0, p1, p2], [0.006, 0.005, 0.0025], 'ouro', n=4)
    # topo: copa dourada + 4 garras em coroa segurando a chama
    zt = 0.86
    dxt = 0.004 * math.sin(zt * 2.1)
    torno(M, [(0.026, zt + 0.01), (0.034, zt + 0.03), (0.042, zt + 0.05), (0.03, zt + 0.062), (0.0, zt + 0.064)], 10,
          lambda i, j: 'ouro', plano_xz())
    for k in range(4):
        a = k * math.pi / 2
        c, sn = math.cos(a), math.sin(a)
        # v2: as garras abrem ~25° para fora, como chifres (curvam para fora e a ponta sobe)
        cam = [(0.04, zt + 0.05), (0.058, zt + 0.08), (0.07, zt + 0.115), (0.084, zt + 0.15), (0.101, zt + 0.185), (0.122, zt + 0.215)]
        tubo(M, [(dxt + r * c, r * sn, z) for r, z in cam], [0.0085, 0.008, 0.007, 0.0055, 0.0035, 0.0012], 'ouro', n=5)
        # espinho para fora no meio da garra (como no exemplo)
        tubo(M, [(dxt + 0.07 * c, 0.07 * sn, zt + 0.11), (dxt + 0.094 * c, 0.094 * sn, zt + 0.118)], [0.0045, 0.0008], 'ouro', n=4)
    # chama/cristal: gota laranja-amarela (torno), base redonda e ponta para cima
    gota = [(0.0, zt + 0.06), (0.026, zt + 0.075), (0.042, zt + 0.105), (0.044, zt + 0.135), (0.036, zt + 0.165),
            (0.022, zt + 0.195), (0.009, zt + 0.225), (0.0, zt + 0.245)]
    torno(M, gota, 8, lambda i, j: 'fogo', plano_xz())
    # ponteira de ferro embaixo
    torno(M, [(0.0, -0.505), (0.009, -0.497), (0.021, -0.478), (0.023, -0.468), (0.021, -0.462)], 10, lambda i, j: 'ferro', plano_xz())
    M.objeto()
    exportar('cajado')


espada()
cajado()
