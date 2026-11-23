# Robe de mago feito à mão (setor de arte, 2026-11-23), na linha da 2ª referência do André: robe azul longo até o
# tornozelo, manto curto em V de cetim escuro com borda dourada, mangas largas de sino com forro escuro e barra
# dourada, cordão na cintura com borlas, emblema no peito e capuz levantado (vai no lugar do capacete). Usa as funções da proposta 3
# (modelar3.py): o tronco e as mangas copiam a pele da Ruiva; a saia longa copia a saia dela (anda junto com as pernas).
# A saia tem fenda na frente e atrás para a perna não atravessar ao correr.
# Rodar: blender -b -P ferramentas/equip-raridade/modelar_robe.py   Sai: robe_r0.glb (Comum) e robe_r3.glb (Lendário)
import os, math
os.environ['SO'] = ''
AQUI_R = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(AQUI_R, 'modelar3.py')).read())
NOME_SAIDA = 'robe_m_r' if MASC else 'robe_r'
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def grade(nome, zs, angs, ponto, material, esp=0.0):
    # malha em grade: ponto(z, a) -> Vector
    verts = [ponto(z, a) for z in zs for a in angs]
    NA = len(angs)
    faces = [(j * NA + i, (j + 1) * NA + i, (j + 1) * NA + i + 1, j * NA + i + 1) for j in range(len(zs) - 1) for i in range(NA - 1)]
    o = objeto(nome, verts, faces, [material] * len(faces))
    if esp:
        solidificar(o, esp)
    return o, [[ponto(z, a) for a in angs] for z in zs]

def set_robe(r, c):
    pele, saia, duras = [], [], []
    # --- tronco do robe (camisa longa por baixo do manto) ---
    tr, gtr = casca('robe_tronco', linhas_z(0.9, 1.385, 16, lambda z, t: (-math.pi + 0.01, math.pi - 0.01)),
                    lambda z, a: 0.009 + 0.004 * ss(1.3, 1.385, z), c['robe'], NA=40)
    for v in tr.data.vertices:  # decote em V pequeno e cava para a manga
        a = math.atan2(v.co.x, -(v.co.y + 0.02))
        v.co.z = min(v.co.z, 1.385 - 0.07 * max(0.0, math.cos(a)) ** 6 - 0.12 * ss(0.7, 0.95, abs(math.sin(a))))
    pc = [tr]
    # mangas de sino: justas no ombro, abrindo do cotovelo para a mão; forro escuro e barra dourada na boca
    for lado, (A, B) in ((1, (OMBRO_E, PUNHO_E)), (-1, (espelho(OMBRO_E), espelho(PUNHO_E)))):
        sino = lambda t: 0.008 + 0.004 * t + 0.075 * ss(0.45, 1.0, t) ** 1.6
        m, aneis, eixo = manga('manga%d' % lado, A, B, -0.02, 0.93, sino, c['robe'], N=16, M=16)
        pc.append(m)
        f, aneis_f, _ = manga('forro%d' % lado, A, B, 0.62, 0.925, lambda t: sino(t) - 0.004, c['forro'], N=6, M=16)
        pc.append(f)
        pc.append(faixa('barra_m%d' % lado, aneis[-1], 0.03, c['borda'], alto=0.003, normais=anel_normais(aneis[-1], eixo), fechada=True))
        pc.append(faixa('barra_m2%d' % lado, aneis[-3], 0.012, c['borda'], alto=0.003, normais=anel_normais(aneis[-3], eixo), fechada=True))
    pele.append(juntar(pc, 'peito_robe'))

    # --- manto curto em V (cetim escuro), por cima dos ombros, ponta no peito e nas costas ---
    def ponta(a):  # altura da barra de baixo do manto: ponta em V na frente e atrás
        return 1.31 - 0.10 * max(0.0, math.cos(a)) ** 3 - 0.07 * max(0.0, -math.cos(a)) ** 3
    linhas = []
    NZ = 9
    for j in range(NZ):
        u = j / (NZ - 1)
        linhas.append(u)
    angs = [-math.pi + 0.01 + (2 * math.pi - 0.02) * i / 47 for i in range(48)]
    def p_manto(u, a):
        z = ponta(a) + (1.39 - ponta(a)) * u
        return p_tronco(z, a, 0.017 - 0.004 * u)
    mt, gmt = grade('manto', linhas, angs, p_manto, c['manto'], esp=0.003)
    pc = [mt]
    pc.append(faixa('manto_borda', gmt[0], 0.016, c['borda'], alto=0.004))
    pc.append(faixa('manto_borda2', [p + fora(p) * 0.002 + Vector((0, 0, 0.022)) for p in gmt[0]], 0.005, c['borda'], alto=0.003))
    # gola alta
    gl = [p_tronco(1.385, a, 0.016) for a in angs]
    pc.append(faixa('gola', gl, 0.028, c['manto'], alto=0.005))
    pc.append(faixa('gola_b', [p + Vector((0, 0, 0.014)) for p in gl], 0.006, c['borda'], alto=0.006))
    # emblema dourado no peito (runa com gema)
    e = p_tronco(1.24, 0.0, 0.03)
    pc.append(gema('emb', e, 0.011, c['gema'], alto=1.5))
    pc.append(arco('emb_a', e + Vector((0, 0.003, 0)), 0.02, 0.003, -0.5, math.pi + 0.5, c['borda']))
    for s in (1, -1):
        pc.append(tubo('emb_r%d' % s, [e + Vector((s * 0.018, -0.003, 0.012)), e + Vector((s * 0.03, -0.004, 0.03)), e + Vector((s * 0.022, -0.004, 0.045))], 0.0022, c['borda'], lados=4))
    # o manto desce por cima dos ombros: meia manga curta de cetim (só a parte de cima do braço)
    for lado, (A, B) in ((1, (OMBRO_E, PUNHO_E)), (-1, (espelho(OMBRO_E), espelho(PUNHO_E)))):
        cap, aneis_c, eixo_c = manga('capa%d' % lado, A, B, -0.03, 0.24, lambda t: 0.02 - 0.01 * t, c['manto'], N=5, M=16, esp=0.003)
        # só a metade de cima: apaga as faces de baixo do braço e faz a barra cair em curva
        import bmesh as _bm
        bm = _bm.new(); bm.from_mesh(cap.data)
        _bm.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < A.z - 0.01], context='FACES')
        bm.to_mesh(cap.data); bm.free()
        pc.append(cap)
        borda = [p for p in aneis_c[-1] if p.z >= A.z - 0.01]
        borda.sort(key=lambda p: p.y)
        pc.append(faixa('capa_b%d' % lado, borda, 0.012, c['borda'], alto=0.004))
    pele.append(juntar(pc, 'peito_manto'))

    # --- saia longa até o tornozelo, com fenda na frente e atrás ---
    zs = [0.98 - (0.98 - 0.13) * j / 17 for j in range(18)]
    base = {}
    def raio_saia(z, a):
        if a not in base:  # quadril (o mais largo) vale como mínimo para baixo: o robe cai reto, sem entrar entre as pernas
            base[a] = max((p_tronco(zz, a, 0.0, saia=True) - Vector((0, -0.02, zz))).length for zz in (0.8, 0.84, 0.88))
        med = (p_tronco(z, a, 0.0, saia=True) - Vector((0, -0.02, z))).length
        rr = max(med, base[a]) if z < 0.86 else med
        return rr + 0.014 + 0.11 * ss(0.86, 0.13, z) ** 1.3
    def fenda(z):  # meia abertura da fenda (rad), da coxa para baixo
        return -0.012 + 0.22 * ss(0.5, 0.15, z)
    for nome, a0, a1 in (('saia_e', 0.0, math.pi), ('saia_d', -math.pi, 0.0)):
        def ponto(z, a, a0=a0, a1=a1):
            # cada metade vai da fenda da frente até a fenda de trás
            f = fenda(z)
            u = (a - a0) / (a1 - a0)
            aa = (a0 + f) + (a1 - a0 - 2 * f) * u
            d = Vector((math.sin(aa), -math.cos(aa), 0))
            return Vector((0, -0.02, z)) + d * raio_saia(z, aa)
        angs_s = [a0 + (a1 - a0) * i / 19 for i in range(20)]
        sa, gsa = grade(nome, zs, angs_s, ponto, c['robe'], esp=0.0)
        ps = [sa]
        ps.append(faixa(nome + 'b', [p + Vector((0, 0, 0.016)) for p in gsa[-1]], 0.03, c['borda_saia'], alto=0.003))
        ps.append(faixa(nome + 'f', [l[0] for l in gsa[6:]], 0.012, c['borda'], alto=0.003))
        ps.append(faixa(nome + 't', [l[-1] for l in gsa[6:]], 0.012, c['borda'], alto=0.003))
        if c.get('runa'):  # coluna de runas ao lado da fenda, da cintura até a barra
            sg = 1 if a0 == 0.0 else -1
            col = 3 if sg > 0 else len(angs_s) - 4
            for j in range(2, len(zs) - 2, 2):
                p0 = gsa[j][col]; p1 = gsa[j + 1][col]
                n = fora(p0)
                m = (p0 + p1) / 2 + n * 0.004
                ps.append(tubo(nome + 'ru%d' % j, [m + Vector((0, 0, 0.018)), m + Vector((sg * 0.012, 0, 0.004)), m + Vector((0, 0, -0.01)),
                                                   m + Vector((-sg * 0.01, 0, -0.016))], 0.0024, c['runa'], lados=4, afina=False))
                ps.append(esfera(nome + 'rp%d' % j, m + Vector((sg * 0.016, 0, 0.012)), 0.0035, c['runa'], seg=5, aneis=3))
        saia.append(juntar(ps, 'quadril_' + nome))

    # --- cordão na cintura com nó e duas pontas com borla (peça dura, presa no quadril) ---
    zc = 0.965
    pts = [p_tronco(zc, 2 * math.pi * i / 40, 0.03, saia=True) for i in range(41)]
    cd = [tubo('cordao', pts, 0.006, c['cordao'], lados=5, afina=False)]
    pts2 = [p_tronco(zc - 0.012, 2 * math.pi * i / 40, 0.032, saia=True) for i in range(41)]
    cd.append(tubo('cordao2', pts2, 0.0055, c['cordao'], lados=5, afina=False))
    no = p_tronco(zc - 0.006, 0.45, 0.04, saia=True)
    cd.append(esfera('no', no, 0.016, c['cordao'], seg=7, aneis=5, escala=(1, 0.7, 1)))
    for k, dx in enumerate((-0.012, 0.014)):
        fio = [no + Vector((dx * (1 + 0.4 * u), -0.012 - 0.03 * u * u, -0.33 * u)) for u in [i / 10 for i in range(11)]]
        cd.append(tubo('fio%d' % k, fio, 0.005, c['cordao'], lados=5, afina=False))
        fim = fio[-1]
        cd.append(esfera('borla_t%d' % k, fim + Vector((0, 0, -0.004)), 0.011, c['borda'], seg=6, aneis=4))
        for q in range(6):
            ang = 2 * math.pi * q / 6
            cd.append(tubo('borla%d%d' % (k, q), [fim + Vector((math.cos(ang) * 0.006, math.sin(ang) * 0.006, -0.01)),
                                                  fim + Vector((math.cos(ang) * 0.014, math.sin(ang) * 0.014, -0.06))], 0.003, c['cordao'], lados=3))
    duras_q = juntar(cd, 'quadril_cordao')
    saia_rigida = [duras_q]

    # --- botas (as mesmas da patrulheira, mais baixas: só o cano aparece) ---
    for lado, (A, B) in ((1, (JOELHO_E, TORNOZELO_E)), (-1, (espelho(JOELHO_E), espelho(TORNOZELO_E)))):
        nome = 'bota_e' if lado > 0 else 'bota_d'
        bt, aneis, eixo = manga(nome + 'c', A, B, 0.2, 1.02, lambda t: 0.012 + 0.006 * (1 - t), c['bota'], N=10, M=14, esp=0.003,
                                longe=0.13, bvh=BVH_PERNA[lado], atras=lambda t: 0.006)
        pele.append(bt)
    duras.append(capuz(c))
    if c.get('extra'):
        e = c['extra']()
        pele += e.get('pele', [])
        duras += e.get('duras', [])
    exportar(r, pele, saia, duras + saia_rigida)

def capuz(c):
    # capuz levantado (vai no lugar do capacete, preso no osso da cabeça). Cobre a cabeça e o coque/rabo de cavalo
    # (o cabelo vai até 0,23 m atrás da nuca), desce como gola até os ombros e abre na frente só no rosto; o rabo
    # de cavalo sai por baixo da barra de trás. Ponta caída para trás como o da referência, forro por dentro.
    H = entortar(osso_w('J_Bip_C_Head'))
    cab = [o for o in bpy.data.objects if o.type == 'MESH' and any(k in m.name for m in o.data.materials for k in ('Face_00_SKIN', 'HAIR'))]
    vs, po = [], []
    for o in cab:
        n = len(vs)
        vs += [o.matrix_world @ v.co for v in o.data.vertices]  # no corpo dele já vem entortado
        po += [[i + n for i in p.vertices] for p in o.data.polygons]
    bvh = BVHTree.FromPolygons(vs, po)
    C = H + Vector((0, 0.046, 0.069))
    T = Vector((0, 0.62, 0.78)).normalized()  # ponta do capuz
    FOLGA = 0.026
    NF = 64  # azimutes da grade de medida (0 = frente, cresce para a esquerda dela)
    def hor(a):
        return Vector((math.sin(a), -math.cos(a), 0))
    # linhas: de baixo (barra, s=0) até o alto da cabeça; NL de gola e ND de cúpula
    NL, ND = 7, 14
    linhas = [('g', k / (NL - 1)) for k in range(NL - 1)] + [('d', math.radians(86) * k / (ND - 1)) for k in range(ND)]
    def barra_z(a):
        return H.z - 0.045 - 0.022 * (1 - math.cos(a)) / 2
    def bruto(L, a):  # (centro do raio, direção) da linha L no azimute a
        tipo, v = L
        if tipo == 'g':
            z = barra_z(a) + (C.z - barra_z(a)) * v
            return Vector((0, C.y, z)), hor(a)
        return C, hor(a) * math.cos(v) + Vector((0, 0, math.sin(v)))
    R = []
    for L in linhas:
        lin = []
        for i in range(NF):
            o_, d = bruto(L, 2 * math.pi * i / NF)
            rr = raio(bvh, o_, d, 0.35)
            lin.append(min(max(rr or 0.1, 0.105), 0.26))
        R.append(lin)
    for _ in range(4):
        R = [[(R[j][i] * 2 + R[j][(i - 1) % NF] + R[j][(i + 1) % NF] + R[max(j - 1, 0)][i] + R[min(j + 1, len(R) - 1)][i]) / 6
              for i in range(NF)] for j in range(len(R))]
    def raio_em(j, a):
        f = (a % (2 * math.pi)) / (2 * math.pi) * NF
        i0 = int(f) % NF
        t = f - int(f)
        return R[j][i0] * (1 - t) + R[j][(i0 + 1) % NF] * t
    def ponto(j, a, dentro=0.0):
        tipo, v = linhas[j]
        o_, d = bruto(linhas[j], a)
        rr = raio_em(j, a) + FOLGA - dentro
        if tipo == 'g':
            rr += 0.028 * (1 - v) ** 1.6  # a gola abre sobre os ombros
            p = o_ + d * rr
        else:
            dd = d.normalized()
            ang = math.acos(max(-1, min(1, dd.dot(T))))
            rr += 0.06 * math.exp(-(ang / 0.45) ** 2)
            p = o_ + dd * rr
            if dd.dot(T) > 0.55:  # a ponta cai um pouco para trás
                p += Vector((0, 0.035, -0.025)) * ((dd.dot(T) - 0.55) / 0.45) ** 2
        return p
    def abertura(j):  # meio ângulo da abertura do rosto em cada linha (0 = fechado)
        tipo, v = linhas[j]
        if tipo == 'g':
            return math.radians(38 + 22 * v)
        e = math.degrees(v)
        return math.radians(60 * math.sqrt(max(0.0, 1 - (e / 64) ** 2)))
    NA = 44
    pecas = []
    for nome, dentro, mat_ in (('capuz', 0.0, c['robe']), ('capuz_forro', 0.006, c['forro'])):
        verts, faces = [], []
        for j in range(len(linhas)):
            A = abertura(j)
            for i in range(NA + 1):
                verts.append(ponto(j, A + (2 * math.pi - 2 * A) * i / NA, dentro))
        for j in range(len(linhas) - 1):
            for i in range(NA):
                faces.append((j * (NA + 1) + i, j * (NA + 1) + i + 1, (j + 1) * (NA + 1) + i + 1, (j + 1) * (NA + 1) + i))
        o = objeto(nome, verts, faces, [mat_] * len(faces))
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0015)
        bm.to_mesh(o.data); bm.free()
        pecas.append(o)
    # barra na abertura do rosto (sobe por um lado e desce pelo outro) e na de baixo
    abertas = [j for j in range(len(linhas)) if abertura(j) > 0.01]
    borda = [ponto(j, abertura(j)) for j in abertas] + [ponto(j, -abertura(j)) for j in reversed(abertas)]
    pecas.append(faixa('capuz_b', borda, 0.018, c['borda'], alto=0.004, normais=[(p - C).normalized() for p in borda]))
    A0 = abertura(0)
    baixo = [ponto(0, A0 + (2 * math.pi - 2 * A0) * i / 60) for i in range(61)]
    pecas.append(faixa('capuz_bb', baixo, 0.014, c['borda'], alto=0.004, normais=[(p - Vector((0, C.y, p.z))).normalized() for p in baixo]))
    if c.get('capuz_det'):
        pecas += c['capuz_det'](C, ponto, linhas)
    return juntar(pecas, 'cabeca_capuz')

def det_epico(C, ponto, linhas):  # filigrana de ouro subindo pelas laterais do capuz
    ps = []
    for s_ in (1, -1):
        pts = [ponto(j, s_ * math.radians(95)) for j in range(1, len(linhas) - 4)]
        ps.append(tubo('cf%d' % s_, [p + (p - C).normalized() * 0.004 for p in pts], 0.0028, 'ouro', lados=4, afina=False))
    return ps
def det_brasa(C, ponto, linhas):  # duas pontas de chifre de bronze e brasa na testa
    ps = []
    jt = len(linhas) - 5
    for s_ in (1, -1):
        b = ponto(jt, s_ * math.radians(55))
        ps.append(tubo('ch%d' % s_, [b, b + Vector((s_ * 0.02, 0.01, 0.05)), b + Vector((s_ * 0.035, 0.04, 0.08))], 0.012, 'bronze', lados=5))
    b = ponto(len(linhas) - 4, 0)
    ps.append(gema('cbr', b + Vector((0, -0.006, 0)), 0.01, 'brasa', alto=1.6))
    return ps
def det_aurora(C, ponto, linhas):  # cristal na testa e auréola fina atrás
    b = ponto(len(linhas) - 4, 0)
    ps = [gema('cc', b + Vector((0, -0.008, 0)), 0.012, 'cristal_fio', alto=2.2)]
    c0 = C + Vector((0, 0.2, 0.05))
    ps.append(arco('aur', c0, 0.17, 0.004, 0, 2 * math.pi, 'ouro_claro', eixo=Vector((0, 1, 0.25)).normalized(), N=36, M=3))
    for k in range(8):
        a = 2 * math.pi * k / 8
        p = c0 + Vector((math.cos(a) * 0.17, -math.sin(a) * 0.04, math.sin(a) * 0.17))
        ps.append(gema('al%d' % k, p, 0.009, 'cristal_fio' if k % 2 else 'cristal', alto=2.4, frente=(p - c0).normalized()))
    return ps
ROBE = {0: dict(robe='robe_azul', forro='cetim_escuro', manto='cetim_escuro', borda='ouro_velho', borda_saia='ouro_velho',
                gema='gema_azul', cordao='cordao_preto', bota='couro_escuro'),
        1: dict(robe='robe_verde', forro='couro', manto='couro_oleado', borda='latao', borda_saia='latao',
                gema='gema_verde', cordao='couro_escuro', bota='couro_oleado'),
        2: dict(robe='robe_roxo', forro='cetim_preto', manto='cetim_preto', borda='ouro', borda_saia='bordado_roxo',
                gema='gema_roxa', cordao='ouro', bota='couro_preto', runa='ouro', capuz_det=det_epico),
        3: dict(robe='robe_negro', forro='pano_carmesim', manto='couro_negro', borda='bronze', borda_saia='bordado_brasa',
                gema='brasa', cordao='bronze', bota='couro_negro', runa='brasa_linha', capuz_det=det_brasa),
        4: dict(robe='seda_aurora_tunica', forro='couro_aurora', manto='couro_aurora', borda='prata', borda_saia='bordado_aurora',
                gema='cristal_fio', cordao='prata', bota='couro_aurora', runa='cristal_fio', capuz_det=det_aurora)}
for r in [int(x) for x in os.environ.get('ROBE', '0,1,2,3,4').split(',')]:
    set_robe(r, ROBE[r])
