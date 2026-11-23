# Robe de mago feito à mão (setor de arte, 2026-11-23), na linha da 2ª referência do André: robe azul longo até o
# tornozelo, manto curto em V de cetim escuro com borda dourada, mangas largas de sino com forro escuro e barra
# dourada, cordão na cintura com borlas, emblema no peito e capuz baixado nas costas. Usa as funções da proposta 3
# (modelar3.py): o tronco e as mangas copiam a pele da Ruiva; a saia longa copia a saia dela (anda junto com as pernas).
# A saia tem fenda na frente e atrás para a perna não atravessar ao correr.
# Rodar: blender -b -P ferramentas/equip-raridade/modelar_robe.py   Sai: robe_r0.glb (Comum) e robe_r3.glb (Lendário)
import os, math
os.environ['SO'] = ''
AQUI_R = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(AQUI_R, 'modelar3.py')).read())
NOME_SAIDA = 'robe_r'
from mathutils import Vector

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
    # capuz baixado: dobra de pano nas costas, abaixo da nuca
    cz = Vector((0, 0.075, 1.36))
    for k, (rr, dz) in enumerate(((0.085, 0.0), (0.075, -0.03))):
        pc.append(arco('capuz%d' % k, cz + Vector((0, 0.01 * k, dz)), rr, 0.026 - 0.006 * k, math.pi * 0.08, math.pi * 0.92, c['robe'],
                       eixo=Vector((0, -0.35, 1)).normalized(), N=16, M=6))
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
    if c.get('extra'):
        e = c['extra']()
        pele += e.get('pele', [])
        duras += e.get('duras', [])
    exportar(r, pele, saia, duras + saia_rigida)

ROBE = {0: dict(robe='robe_azul', forro='cetim_escuro', manto='cetim_escuro', borda='ouro_velho', borda_saia='ouro_velho',
                gema='gema_azul', cordao='cordao_preto', bota='couro_escuro'),
        3: dict(robe='robe_negro', forro='pano_carmesim', manto='couro_negro', borda='bronze', borda_saia='bordado_brasa',
                gema='brasa', cordao='cordao_preto', bota='couro_negro')}
for r in [int(x) for x in os.environ.get('ROBE', '0,3').split(',')]:
    set_robe(r, ROBE[r])
