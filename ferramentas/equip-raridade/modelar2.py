# Proposta 2 de equipamentos por raridade (setor de arte, 2026-11-23). André achou os sets da proposta 1 simples
# demais ("pensei uma coisa muito mais elaborada"): aqui cada set ganha camadas (couraça + peitoral por cima +
# lâminas da barriga + costas + gorjal), faldas no quadril, tabardo de pano, braçadeiras, ombreiras de 4 a 5
# lâminas com cúpula e crista, frisos e filigrana. Lendário e Mítico passam claramente o Épico (espada também).
# Novo: o cajado nas 5 raridades. As funções de base vêm de modelar.py (proposta 1, que continua igual).
# Rodar: blender -b -P ferramentas/equip-raridade/modelar2.py  -> pecas2_r0.glb ... pecas2_r4.glb
# Objetos: peito* (UpperChest), quadril* (Hips), ombro_e*/ombro_d* (ombro), braco_e*/braco_d* (antebraço),
# espada*, cajado*. Eixos do Blender: Z para cima, frente em -Y.
import os, math
SO_FUNCOES = True
_AQ = os.path.dirname(os.path.abspath(__file__))
__file__ = os.path.join(_AQ, 'modelar.py')
exec(open(os.path.join(_AQ, 'modelar.py')).read())
from mathutils import Vector

# ---------- medidas ----------
# André (proposta 1): "tá deixando o personagem todo gordo", "a armadura tá cobrindo o braço". Agora a medida vem
# só da pele do tronco (sem a blusa e sem os braços) e a peça pode entrar na cintura: acompanha o desenho do corpo.
_pele = [o for o in bpy.data.objects if o.name == 'Body_(merged)']
bm_t = bmesh.new()
_tmp = bmesh.new()
for o in _pele:
    _tmp.from_mesh(o.data)
    _tmp.transform(o.matrix_world)
for f in list(_tmp.faces):
    if any(abs(v.co.x) > 0.125 and v.co.z > 1.2 for v in f.verts):
        _tmp.faces.remove(f)
BVH_TRONCO = BVHTree.FromBMesh(_tmp)
def raio_corpo(z, a):
    c = Vector((0, -0.02, z))
    d = Vector((math.sin(a), -math.cos(a), 0))
    hit = BVH_TRONCO.ray_cast(c + d * 0.4, -d, 0.5)
    r = (hit[0] - c).length if hit[0] else 0.1
    return min(r, 0.135 / max(abs(math.sin(a)), 0.2)) if z > 1.2 else r

def raio_saia(z, a):
    c = Vector((0, -0.02, z))
    d = Vector((math.sin(a), -math.cos(a), 0))
    hit = BVH_SAIA.ray_cast(c + d * 0.5, -d, 0.6)
    return (hit[0] - c).length if hit[0] else 0.16

def busto(z, a):
    # no jogo o busto balança (ossos J_Sec_Bust) e sai da medida parada: folga extra só ali
    return 0.03 * math.exp(-((abs(a) - 0.42) / 0.38) ** 2 - ((z - 1.215) / 0.07) ** 2) if math.cos(a) > 0 else 0.0

def p_corpo(z, a, folga, saia=False):
    r = (raio_saia(z, a) if saia else raio_corpo(z, a)) + folga + (0.0 if saia else busto(z, a))
    return Vector((math.sin(a) * r, -0.02 - math.cos(a) * r, z))

def fora(p):
    return Vector((p.x, p.y + 0.02, 0)).normalized()

# ---------- peças ----------
def faixa(nome, pts, larg, material, alto=0.003, normais=None, fechada=False):
    # friso/filigrana: tira em relevo (meia-cana) passando pelos pontos, por fora da peça
    verts, faces = [], []
    n_pts = len(pts)
    for i, p in enumerate(pts):
        a = pts[(i - 1) % n_pts] if (fechada or i > 0) else p
        b = pts[(i + 1) % n_pts] if (fechada or i < n_pts - 1) else p
        d = (b - a).normalized()
        n = normais[i] if normais else fora(p)
        s = d.cross(n).normalized()
        verts += [p + s * larg / 2 + n * alto * 0.3, p + n * (alto + larg * 0.35), p - s * larg / 2 + n * alto * 0.3]
    seg = n_pts if fechada else n_pts - 1
    for i in range(seg):
        j = (i + 1) % n_pts
        for k in range(2):
            faces.append((i * 3 + k, j * 3 + k, j * 3 + k + 1, i * 3 + k + 1))
    return objeto(nome, verts, faces, [material] * len(faces))

def placa(nome, a0, a1, zb, zt, folga, material, NA=16, NZ=8, saia=False, borda=None, larg_borda=0.012, esp=0.006,
          bordas='tblr', crista=0.0, flare=0.0):
    # placa curva sobre o corpo (ângulo a0..a1, altura zb(a)..zt(a)), com espessura e friso na beira
    grade, minimo = [], []
    for j in range(NZ):
        t = j / (NZ - 1)
        lin, lmin = [], []
        for i in range(NA):
            u = i / (NA - 1)
            a = a0 + (a1 - a0) * u
            z = zb(a) + t * (zt(a) - zb(a))
            f = folga + crista * max(0.0, math.cos(a)) ** 30 + flare * (1 - t) ** 2
            lin.append(p_corpo(z, a, f, saia))
            lmin.append(p_corpo(z, a, folga * 0.75, saia))
        grade.append(lin)
        minimo.append(lmin)
    # alisa um pouco (cara de placa batida)
    for _ in range(2):
        nova = [[v.copy() for v in l] for l in grade]
        for j in range(1, NZ - 1):
            for i in range(1, NA - 1):
                m = (grade[j][i - 1] + grade[j][i + 1] + grade[j - 1][i] + grade[j + 1][i]) / 4
                nova[j][i] = grade[j][i] * 0.6 + m * 0.4
                mn = minimo[j][i]
                if fora(mn).dot(nova[j][i] - mn) < 0:  # nunca para dentro do corpo (busto, ombro)
                    nova[j][i] = mn
        grade = nova
    verts = [v for l in grade for v in l]
    faces = [(j * NA + i, j * NA + i + 1, (j + 1) * NA + i + 1, (j + 1) * NA + i) for j in range(NZ - 1) for i in range(NA - 1)]
    o = objeto(nome, verts, faces, [material] * len(faces))
    solidificar(o, esp)
    partes = [o]
    if borda:
        if 't' in bordas: partes.append(faixa(nome + '_bt', grade[-1], larg_borda, borda))
        if 'b' in bordas: partes.append(faixa(nome + '_bb', grade[0], larg_borda, borda))
        if 'l' in bordas: partes.append(faixa(nome + '_bl', [l[0] for l in grade], larg_borda, borda))
        if 'r' in bordas: partes.append(faixa(nome + '_br', [l[-1] for l in grade], larg_borda, borda))
    return juntar(partes, nome), grade

def tubo(nome, pts, r, material, lados=5):
    verts, faces = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        t = d.orthogonal().normalized()
        b = d.cross(t)
        rr = r * (1 - 0.6 * (i / (len(pts) - 1)) ** 3)
        for k in range(lados):
            q = 2 * math.pi * k / lados
            verts.append(p + (t * math.cos(q) + b * math.sin(q)) * rr)
    for i in range(len(pts) - 1):
        for k in range(lados):
            k2 = (k + 1) % lados
            faces.append((i * lados + k, i * lados + k2, (i + 1) * lados + k2, (i + 1) * lados + k))
    return objeto(nome, verts, faces, [material] * len(faces))

def arco(nome, centro, raio, gross, a0, a1, material, eixo=Vector((0, 1, 0)), N=16, M=5, afina=True):
    # pedaço de anel (lua crescente, asa): afina nas pontas
    verts, faces = [], []
    t = Vector((1, 0, 0)) if abs(eixo.x) < 0.9 else Vector((0, 0, 1))
    t = (t - eixo * t.dot(eixo)).normalized()
    b = eixo.cross(t).normalized()
    for i in range(N + 1):
        u = i / N
        a = a0 + (a1 - a0) * u
        rad = t * math.cos(a) + b * math.sin(a)
        c = centro + rad * raio
        g = gross * (math.sin(u * math.pi) ** 0.6 if afina else 1) + 0.0008
        for k in range(M):
            q = 2 * math.pi * k / M
            verts.append(c + (rad * math.cos(q) + eixo * math.sin(q)) * g)
    for i in range(N):
        for k in range(M):
            k2 = (k + 1) % M
            faces.append((i * M + k, (i + 1) * M + k, (i + 1) * M + k2, i * M + k2))
    return objeto(nome, verts, faces, [material] * len(faces))

def gola(nome, z0, z1, r0, r1, material, borda=None, N=20):
    # gorjal: faixa cônica em volta do pescoço, aberta um pouco na frente
    verts, faces = [], []
    for z, r in ((z0, r0), (z1, r1)):
        for i in range(N):
            a = 0.35 + (2 * math.pi - 0.7) * i / (N - 1)
            verts.append(Vector((math.sin(a) * r, 0.012 - math.cos(a) * r * 0.92, z)))
    faces = [(i, i + 1, N + i + 1, N + i) for i in range(N - 1)]
    o = objeto(nome, verts, faces, [material] * len(faces))
    solidificar(o, 0.006)
    ps = [o]
    if borda:
        ps.append(faixa(nome + 'b', [verts[N + i] for i in range(N)], 0.01, borda))
        ps.append(faixa(nome + 'c', [verts[i] for i in range(N)], 0.008, borda))
    return juntar(ps, nome)

def ombreira(n, lado, base, borda, lames=4, tam=1.0, crista=None, desloca=Vector((0, 0, 0)), abre=0.0):
    ps = []
    for k in range(lames):
        a = lame_ombro(n + str(k), lado, (0.095 + 0.018 * k), (0.2 + 0.018 * k), (0.078 + 0.011 * k) * tam,
                       (0.1 + 0.012 * k) * tam, OMBRO_Z + 0.018 - 0.026 * k * tam, 1.4 - 0.02 * k, base,
                       desloca=desloca * (1 + abre * k), borda=borda)
        solidificar(a, 0.006)
        ps.append(a)
    if crista:  # crista no alto da cúpula, de frente para trás
        th = math.radians(28)
        O = Vector((lado * math.cos(th), 0, math.sin(th)))
        J = Vector((lado * 0.115, -0.005, 1.30 + 0.018))
        pts = [J + O * (0.083 * tam + 0.006) + Vector((0, -0.07 + 0.14 * i / 10, 0)) for i in range(11)]
        pts = [p + O * 0.012 * math.sin(math.pi * i / 10) for i, p in enumerate(pts)]
        ps.append(faixa(n + 'cr', pts, 0.014, crista, alto=0.008, normais=[O] * len(pts)))
    return ps

def bracadeira(n, lado, base, borda, cotovelo=None, tam=1.0, extra=None):
    # antebraço na pose T: braço ao longo de X, de 0,327 (cotovelo) a 0,535 (punho); preso no osso do antebraço
    ps = []
    N, M = 7, 12
    verts, faces = [], []
    for i in range(N):
        u = i / (N - 1)
        x = 0.37 + 0.14 * u
        r = (0.041 + 0.004 * u + 0.008 * u ** 6) * tam
        for k in range(M):
            q = 2 * math.pi * k / M
            verts.append(Vector((lado * x, 0.025 + math.cos(q) * r, 1.309 + math.sin(q) * r * 0.95)))
    for i in range(N - 1):
        for k in range(M):
            k2 = (k + 1) % M
            faces.append((i * M + k, i * M + k2, (i + 1) * M + k2, (i + 1) * M + k) if lado > 0 else (i * M + k, (i + 1) * M + k, (i + 1) * M + k2, i * M + k2))
    o = objeto(n + 'b', verts, faces, [base] * len(faces))
    solidificar(o, 0.005)
    ps.append(o)
    if borda:
        for i in (0, N - 1):
            ps.append(faixa(n + 'f%d' % i, [verts[i * M + k] for k in range(M)], 0.01, borda, fechada=True,
                            normais=[(verts[i * M + k] - Vector((lado * (0.37 + 0.14 * i / (N - 1)), 0.025, 1.309))).normalized() for k in range(M)]))
    if cotovelo:
        ps.append(esfera(n + 'cot', Vector((lado * 0.33, 0.045, 1.309)), 0.034 * tam, cotovelo, seg=8, aneis=5, escala=(0.8, 1.0, 1.0)))
    if extra:
        ps += extra
    return juntar(ps, n)

def faldas(nome, base, borda, angs, lames=3, h=0.075, larg=0.62, flare=0.03, z0=0.965):
    ps = []
    for i, ac in enumerate(angs):
        for k in range(lames):
            zt = z0 - k * h * 0.78
            o, _ = placa('%s%d_%d' % (nome, i, k), ac - larg / 2, ac + larg / 2, lambda a, zt=zt: zt - h, lambda a, zt=zt: zt,
                         0.016 + 0.006 * k, base, NA=7, NZ=3, saia=True, borda=borda, larg_borda=0.009, bordas='b', flare=flare)
            ps.append(o)
    return ps

def tabardo(nome, pano, borda, z_cima=0.95, z_baixo=0.52, l0=0.065, l1=0.085, emblema=None):
    N = 10
    verts = []
    y_bainha = None
    for j in range(N + 1):
        t = j / N
        z = z_cima + (z_baixo - z_cima) * t
        l = l0 + (l1 - l0) * t
        zz = max(z, 0.8)
        y = -0.02 - (raio_saia(zz, 0.0) + 0.022)
        y -= 0.02 * t
        verts += [Vector((-l, y + 0.01, z)), Vector((0, y, z)), Vector((l, y + 0.01, z))]
    verts.append(Vector((0, verts[-2].y - 0.004, z_baixo - 0.05)))
    faces = [(j * 3 + k, j * 3 + k + 1, (j + 1) * 3 + k + 1, (j + 1) * 3 + k) for j in range(N) for k in range(2)]
    faces += [(N * 3, N * 3 + 1, len(verts) - 1), (N * 3 + 1, N * 3 + 2, len(verts) - 1)]
    ps = [objeto(nome, verts, faces, [pano] * len(faces))]
    if borda:
        lado_e = [verts[j * 3] for j in range(N + 1)] + [verts[-1]]
        lado_d = [verts[j * 3 + 2] for j in range(N + 1)] + [verts[-1]]
        nv = [Vector((0, -1, 0))] * len(lado_e)
        ps.append(faixa(nome + 'be', lado_e, 0.01, borda, normais=nv))
        ps.append(faixa(nome + 'bd', lado_d, 0.01, borda, normais=nv))
    if emblema:
        ps += emblema(verts[3 * 3 + 1] + Vector((0, -0.006, 0)))
    return ps

def cinto(nome, couro, metal, z=0.955, fivela=None):
    pts = [p_corpo(z, 2 * math.pi * i / 28, 0.014) for i in range(28)]
    ps = [faixa(nome, pts, 0.034, couro, alto=0.002, fechada=True)]
    c = p_corpo(z, 0.0, 0.022)
    ps.append(fivela(c) if fivela else caixa(nome + 'fv', c, (0.05, 0.012, 0.042), metal))
    return ps

def filigrana(nome, material, lado, centro, escala=1.0, r=0.0032):
    # voluta em S na frente do peito, do meio para o lado (só pontos que ficam por cima da placa)
    pts = []
    for i in range(16):
        u = i / 15
        a = lado * (0.12 + 0.9 * u) * escala
        z = centro + 0.05 * math.sin(u * math.pi * 1.5) * escala - 0.03 * u
        pts.append(p_corpo(z, a, 0.0))
    return pts

# ---------- set de metal (Raro a Mítico) ----------
def set_metal(r, base, trim, pano=None, gema_mat=None, extra=None, faldas_lames=2, ombro_lames=3, ombro_tam=1.0,
              crista=0.0, ombro_crista=None, gravura_mat=None, braco_extra=None, cot=None, folga_peito=0.017,
              tab_baixo=0.58):
    pe = []
    # 1 couraça de baixo
    o, _ = placa('couraca', -math.pi + 0.02, math.pi - 0.02, lambda a: 0.95 - 0.03 * max(0.0, math.cos(a)) ** 6,
                 lambda a: 1.345 - 0.05 * max(0.0, math.cos(a)) ** 3 - 0.13 * ss(0.55, 0.95, abs(math.sin(a))),
                 0.008, base, NA=30, NZ=12, esp=0.005)
    pe.append(o)
    # 2 peitoral por cima (V embaixo, recortado nas cavas)
    pp, g = placa('peitoral', -1.3, 1.3, lambda a: 1.1 + 0.055 * (a / 1.3) ** 2 - 0.015 * math.cos(a) ** 8,
                  lambda a: 1.338 - 0.035 * math.cos(a) ** 4 - 0.07 * ss(0.8, 1.2, abs(a)),
                  folga_peito, base, NA=22, NZ=9, borda=trim, larg_borda=0.014, esp=0.007, crista=crista, bordas='tblr')
    pe.append(pp)
    # 3 lâminas da barriga
    for k in range(3):
        zt = 1.105 - 0.05 * k
        o, _ = placa('barriga%d' % k, -1.45, 1.45, lambda a, zt=zt: zt - 0.058, lambda a, zt=zt: zt, 0.014 + 0.004 * k, base,
                     NA=14, NZ=3, borda=trim, larg_borda=0.008, bordas='b')
        pe.append(o)
    # 4 costas
    o, _ = placa('costas', math.pi - 1.25, math.pi + 1.25, lambda a: 1.0, lambda a: 1.345 - 0.06 * ss(0.8, 1.2, abs(a - math.pi)),
                 0.016, base, NA=14, NZ=7, borda=trim, larg_borda=0.012)
    pe.append(o)
    # 5 gorjal
    pe.append(gola('gorjal', 1.335, 1.39, 0.083, 0.078, base, borda=trim))
    if gema_mat:
        c = p_corpo(1.2, 0.0, folga_peito + 0.03)
        pe.append(gema('gema', c, 0.026, gema_mat, alto=1.5))
        pe.append(anel('engaste', c + Vector((0, 0.008, 0)), 0.034, 0.006, trim, eixo_frente=Vector((0, 1, 0)), N=14, M=4))
    if gravura_mat:  # volutas em relevo dos dois lados do peito
        for lado in (1, -1):
            pts = filigrana('fil', gravura_mat, lado, 1.25)
            pts = [p_corpo(p.z, math.atan2(p.x, -(p.y + 0.02)), folga_peito + 0.006) for p in pts]
            pe.append(tubo('fil%d' % lado, pts, 0.0035, gravura_mat))
    if extra:
        pe += extra.get('peito', [])
    objs = [juntar(pe, 'peito')]
    # quadril: cinto, faldas e tabardo
    qd = cinto('cinto', 'couro_escuro', trim, fivela=(extra or {}).get('fivela'))
    qd += faldas('falda', base, trim, [-0.55, 0.55, -1.45, 1.45, math.pi - 0.5, math.pi + 0.5], lames=faldas_lames)
    if pano:
        qd += tabardo('tabardo', pano, trim, z_baixo=tab_baixo, emblema=(extra or {}).get('emblema'))
    if extra:
        qd += extra.get('quadril', [])
    objs.append(juntar(qd, 'quadril'))
    for lado, n in ((L, 'ombro_e'), (R_, 'ombro_d')):
        ps = ombreira(n, lado, base, trim, lames=ombro_lames, tam=ombro_tam, crista=ombro_crista)
        if extra and 'ombro' in extra:
            ps += extra['ombro'](lado, n)
        objs.append(juntar(ps, n))
        objs.append(bracadeira('braco_e' if lado > 0 else 'braco_d', lado, base, trim, cotovelo=cot,
                               extra=braco_extra(lado) if braco_extra else None))
    return objs

# pele de verdade: as peças do tronco, quadril e braços copiam os pesos dos ossos do corpo da Ruiva (o quadril copia
# da saia) e dobram junto com ele em qualquer pose. As ombreiras continuam presas no ombro (feitas com o braço caído).
_antes = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=RUIVA)
_novos = [o for o in bpy.data.objects if o not in _antes]
ARM = [o for o in _novos if o.type == 'ARMATURE'][0]
FONTE = {'corpo': bpy.data.objects[[o.name for o in _novos if o.type == 'MESH' and o.name.startswith('Body_(merged)') and len(o.data.vertices) == 9270][0]],
         'saia': [o for o in _novos if o.type == 'MESH' and any('Bottoms' in m.name for m in o.data.materials)][0]}
for o in _novos:
    if o.type == 'MESH' and o not in FONTE.values():
        bpy.data.objects.remove(o)
    elif o.type == 'EMPTY':
        o.hide_set(True)
for o in FONTE.values():
    o.hide_set(True)

def pele(o, fonte):
    for g in fonte.vertex_groups:
        o.vertex_groups.new(name=g.name)
    md = o.modifiers.new('dt', 'DATA_TRANSFER')
    md.object = fonte
    md.use_vert_data = True
    md.data_types_verts = {'VGROUP_WEIGHTS'}
    md.vert_mapping = 'POLYINTERP_NEAREST'
    md.layers_vgroup_select_src = 'ALL'
    md.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='dt')
    o.parent = ARM
    a = o.modifiers.new('arm', 'ARMATURE')
    a.object = ARM

def exportar2(r, objs):
    for o in objs:
        if o.name.startswith('peito') and o.name != 'peito_aureola' or o.name.startswith('braco'):
            pele(o, FONTE['corpo'])
        elif o.name.startswith('quadril'):
            pele(o, FONTE['saia'])
    bpy.ops.object.select_all(action='DESELECT')
    ARM.select_set(True)
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(_AQ, 'pecas2_r%d.glb' % r), use_selection=True, export_format='GLB',
                              export_materials='EXPORT', export_apply=False, export_yup=True, export_skins=True)
    for o in objs:
        o.data.calc_loop_triangles()
        print('PECA', r, o.name, len(o.data.loop_triangles))
    print('RARIDADE', r, 'tris', sum(len(o.data.loop_triangles) for o in objs))
    for o in objs:
        bpy.data.objects.remove(o)

# ================= ESPADAS (as da proposta 1, com Lendária e Mítica bem mais ricas) =================
def espada(r):
    if r == 0:
        return juntar([lamina('lam', lambda t: 0.024 * (1 - t ** 3 * 0.7), 'losango', 'ferro', 'ferro_fio', z1=0.86),
                       caixa('guarda', Vector((0, 0, 0.105)), (0.15, 0.02, 0.022), 'ferro'),
                       cilindro('cabo', -0.17, 0.095, 0.016, 0.017, 'couro_escuro', lados=8),
                       esfera('pomo', Vector((0, 0, -0.185)), 0.022, 'ferro', seg=6, aneis=4)], 'espada')
    if r == 1:
        return juntar([lamina('lam', lambda t: 0.027 * (1 - t ** 4 * 0.8), 'canal', 'aco', 'aco_fio'),
                       guarda_curva('guarda', 0.17, 0.022, 0.012, -0.012, 'aco_escuro'),
                       cilindro('cabo', -0.17, 0.09, 0.016, 0.017, 'pano', lados=8),
                       cilindro('anel1', 0.07, 0.09, 0.019, 0.019, 'aco_escuro', lados=8),
                       esfera('pomo', Vector((0, 0, -0.19)), 0.026, 'aco_escuro', seg=8, aneis=5, escala=(1, 0.6, 1))], 'espada')
    if r == 2:
        return juntar([lamina('lam', lambda t: 0.034 * (1 + 0.25 * math.sin(t * math.pi) - t ** 4 * 0.85), 'canal', 'aco_azul', 'ouro', z1=0.95),
                       lamina('runa', lambda t: 0.007 * (1 - t * 0.6), 'losango', 'runa', None, z0=0.14, z1=0.75, esp=0.0075),
                       guarda_curva('guarda', 0.21, 0.03, 0.014, 0.035, 'ouro'),
                       gema('gemag', Vector((0, -0.016, 0.1)), 0.012, 'gema_roxa', alto=1.3),
                       cilindro('cabo', -0.18, 0.09, 0.016, 0.018, 'couro_escuro', lados=8),
                       esfera('pomo', Vector((0, 0, -0.2)), 0.024, 'ouro', seg=6, aneis=4, escala=(1, 1, 1.4))], 'espada')
    if r == 3:  # Coração de Brasa: lâmina larga negra com gume aceso, dentes no dorso, guarda de chamas
        ps = [lamina('lam', lambda t: 0.056 * (1 + 0.2 * math.sin(t * 2.6)) * (1 - t ** 5 * 0.9), 'canal', 'obsidiana', 'brasa_linha', z1=1.02),
              lamina('fenda', lambda t: 0.012 * (1 - t * 0.7), 'losango', 'brasa_linha', None, z0=0.13, z1=0.9, esp=0.0105),
              guarda_curva('guarda', 0.2, 0.04, 0.018, 0.03, 'bronze'),
              esfera('nuc', Vector((0, 0, 0.11)), 0.024, 'brasa', seg=8, aneis=6, escala=(1, 0.7, 1)),
              cilindro('cabo', -0.2, 0.09, 0.017, 0.019, 'couro_escuro', lados=8),
              cilindro('an1', -0.05, -0.03, 0.021, 0.021, 'bronze', lados=8), cilindro('an2', 0.05, 0.07, 0.021, 0.021, 'bronze', lados=8),
              gema('pomo', Vector((0, 0, -0.225)), 0.024, 'brasa', alto=1.6),
              cone('pomo_esp', Vector((0, 0, -0.24)), Vector((0, 0, -0.31)), 0.012, 'bronze', lados=5)]
        for s in (1, -1):  # chamas da guarda subindo, 3 de cada lado
            for k in range(3):
                b = Vector((s * (0.04 + 0.035 * k), 0, 0.115))
                ps.append(cone('ch%d%d' % (s, k), b, b + Vector((s * (0.03 + 0.012 * k), 0, 0.07 + 0.03 * (2 - k))), 0.013 - 0.002 * k, 'bronze', lados=5))
            for k in range(4):  # dentes no gume perto da base
                z = 0.2 + 0.06 * k
                w = 0.056 * (1 + 0.2 * math.sin(((z - 0.12) / 0.9) * 2.6))
                ps.append(cone('dente%d%d' % (s, k), Vector((s * w * 0.9, 0, z)), Vector((s * (w + 0.022), 0, z + 0.03)), 0.008, 'obsidiana', lados=4))
        return juntar(ps, 'espada')
    # Mítico, Aurora: lâmina de cristal com miolo de luz, asas duplas, cristais flutuando e dois anéis
    ps = [lamina('lam', lambda t: 0.046 * (1 + 0.3 * math.sin(t * math.pi * 0.9)) * (1 - t ** 3 * 0.85), 'losango', 'cristal', 'cristal_fio', z1=1.06),
          lamina('miolo', lambda t: 0.01 * (1 - t * 0.8), 'losango', 'luz_branca', None, z0=0.15, z1=0.95, esp=0.0125),
          cilindro('cabo', -0.19, 0.09, 0.016, 0.018, 'perola', lados=8),
          cilindro('an1', 0.07, 0.095, 0.021, 0.021, 'ouro_claro', lados=8),
          gema('nucg', Vector((0, -0.012, 0.115)), 0.02, 'cristal_fio', alto=1.6),
          gema('pomo', Vector((0, 0, -0.22)), 0.022, 'cristal', alto=1.8),
          anel('orb1', Vector((0, 0, 0.2)), 0.075, 0.004, 'ouro_claro', eixo_frente=Vector((0.2, 0.3, 1)).normalized(), N=20, M=3),
          anel('orb2', Vector((0, 0, 0.2)), 0.09, 0.003, 'cristal_fio', eixo_frente=Vector((-0.3, 0.2, 1)).normalized(), N=20, M=3)]
    for s in (1, -1):
        ps.append(arco('asa1%d' % s, Vector((s * 0.03, 0, 0.06)), 0.11, 0.014, math.radians(90 - s * 90) + (0 if s > 0 else 0), 0, 'perola', eixo=Vector((0, 1, 0))) if False else
                  arco('asa1%d' % s, Vector((s * 0.0, 0, 0.0)), 0.13, 0.014, math.radians(15) if s > 0 else math.radians(165), math.radians(80) if s > 0 else math.radians(100), 'perola', eixo=Vector((0, 1, 0))))
        ps.append(arco('asa2%d' % s, Vector((s * 0.0, 0, 0.02)), 0.16, 0.01, math.radians(25) if s > 0 else math.radians(155), math.radians(70) if s > 0 else math.radians(110), 'ouro_claro', eixo=Vector((0, 1, 0))))
        for k in range(3):  # cristais soltos ao lado da lâmina
            ps.append(gema('cr%d%d' % (s, k), Vector((s * (0.085 + 0.01 * k), 0, 0.35 + 0.17 * k)), 0.012 - 0.002 * k, 'cristal_fio', alto=2.4))
    return juntar(ps, 'espada')

# ================= CAJADOS =================
def cajado(r):
    ps = []
    if r == 0:  # galho torto de madeira, couro na pega e uma pedra amarrada
        pts = [Vector((0.012 * math.sin(i * 0.9), 0.008 * math.cos(i * 1.3), -0.8 + 1.7 * i / 12)) for i in range(13)]
        ps.append(tubo('haste', pts, 0.019, 'madeira', lados=7))
        ps.append(cilindro('pega', -0.12, 0.12, 0.022, 0.022, 'couro_escuro', lados=8))
        ps.append(esfera('no', Vector((0.01, 0, 0.9)), 0.03, 'madeira', seg=7, aneis=5, escala=(1, 1, 1.3)))
        ps.append(gema('pedra', Vector((0.0, -0.02, 0.96)), 0.026, 'pedra', alto=1.2))
        for k in range(3):
            ps.append(cilindro('am%d' % k, 0.86 + 0.025 * k, 0.872 + 0.025 * k, 0.03, 0.03, 'couro_escuro', lados=8))
    elif r == 1:  # madeira com cintas de aço e gaiola de 4 garras com cristal azul
        ps.append(cilindro('haste', -0.8, 0.9, 0.018, 0.02, 'madeira', lados=8))
        for z in (-0.78, -0.3, 0.1, 0.5, 0.88):
            ps.append(cilindro('cinta', z, z + 0.03, 0.023, 0.023, 'aco_escuro', lados=8))
        ps.append(cilindro('pega', -0.12, 0.12, 0.022, 0.022, 'pano', lados=8))
        c = Vector((0, 0, 1.0))
        ps.append(gema('cristal', c, 0.034, 'gema_azul', alto=1.6))
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            d = Vector((math.cos(a), math.sin(a), 0))
            pts = [Vector((0, 0, 0.9)) + d * (0.045 * math.sin(u * math.pi * 0.75)) + Vector((0, 0, 0.16 * u)) for u in [i / 8 for i in range(9)]]
            ps.append(tubo('garra%d' % k, pts, 0.007, 'aco', lados=4))
    elif r == 2:  # aço azul-noite com anéis de ouro, lua crescente de ouro abraçando a gema roxa, runa girando
        ps.append(cilindro('haste', -0.82, 0.9, 0.017, 0.019, 'aco_azul', lados=8))
        for z in (-0.8, -0.4, 0.0, 0.45, 0.86):
            ps.append(cilindro('anel', z, z + 0.025, 0.023, 0.023, 'ouro', lados=8))
        ps.append(cilindro('pega', -0.13, 0.13, 0.021, 0.021, 'couro_escuro', lados=8))
        ps.append(cone('ponta', Vector((0, 0, -0.82)), Vector((0, 0, -0.9)), 0.017, 'ouro', lados=6))
        c = Vector((0, 0, 1.03))
        ps.append(arco('lua', c, 0.085, 0.016, math.radians(-60), math.radians(240), 'ouro', eixo=Vector((0, 1, 0)), N=22))
        ps.append(gema('gema', c, 0.034, 'gema_roxa', alto=1.5))
        ps.append(anel('runa', c, 0.06, 0.003, 'runa', eixo_frente=Vector((0.3, 1, 0.2)).normalized(), N=20, M=3))
        ps.append(cone('topo', Vector((0, 0, 1.12)), Vector((0, 0, 1.2)), 0.01, 'ouro', lados=5))
    elif r == 3:  # Coração de Brasa: haste negra com fendas, 6 garras de bronze em chama e núcleo de brasa grande
        ps.append(cilindro('haste', -0.85, 0.92, 0.019, 0.022, 'obsidiana', lados=8))
        for z in (-0.6, -0.2, 0.3, 0.7):
            ps.append(cilindro('anel', z, z + 0.03, 0.026, 0.026, 'bronze', lados=8))
        ps.append(cilindro('pega', -0.13, 0.13, 0.023, 0.023, 'couro_escuro', lados=8))
        for k in range(3):
            ps.append(cone('pe%d' % k, Vector((0.012 * math.cos(k * 2.1), 0.012 * math.sin(k * 2.1), -0.83)), Vector((0.03 * math.cos(k * 2.1), 0.03 * math.sin(k * 2.1), -0.95)), 0.01, 'bronze', lados=4))
        c = Vector((0, 0, 1.08))
        ps.append(esfera('nucleo', c, 0.05, 'brasa', seg=10, aneis=8))
        ps.append(esfera('miolo', c, 0.03, 'luz_brasa', seg=8, aneis=6))
        for k in range(6):
            a = k * math.pi / 3
            d = Vector((math.cos(a), math.sin(a), 0))
            pts = [Vector((0, 0, 0.92)) + d * (0.075 * math.sin(u * math.pi * 0.85)) + Vector((0, 0, 0.27 * u)) + d * 0.02 * u ** 3 for u in [i / 10 for i in range(11)]]
            ps.append(tubo('chama%d' % k, pts, 0.011, 'bronze' if k % 2 == 0 else 'obsidiana', lados=5))
        for s in (1, -1):  # chifres
            pts = [Vector((s * (0.03 + 0.1 * u), 0, 0.95 + 0.05 * u + 0.12 * u * u)) for u in [i / 8 for i in range(9)]]
            ps.append(tubo('chifre%d' % s, pts, 0.014, 'bronze', lados=5))
    else:  # Mítico, Aurora: haste perolada com espiral de ouro, coroa de 6 cristais flutuando, dois halos cruzados
        ps.append(cilindro('haste', -0.85, 0.95, 0.017, 0.02, 'perola', lados=8))
        pts = [Vector((0.022 * math.cos(u * 18), 0.022 * math.sin(u * 18), -0.8 + 1.7 * u)) for u in [i / 60 for i in range(61)]]
        ps.append(tubo('espiral', pts, 0.004, 'ouro_claro', lados=4))
        ps.append(cilindro('pega', -0.13, 0.13, 0.021, 0.021, 'perola', lados=8))
        ps.append(gema('ponta', Vector((0, 0, -0.9)), 0.016, 'cristal', alto=3.0))
        c = Vector((0, 0, 1.12))
        ps.append(gema('cristal', c, 0.045, 'cristal_fio', alto=2.0))
        ps.append(arco('berco_e', Vector((0, 0, 0.97)), 0.07, 0.01, math.radians(10), math.radians(80), 'ouro_claro', eixo=Vector((0, 1, 0))))
        ps.append(arco('berco_d', Vector((0, 0, 0.97)), 0.07, 0.01, math.radians(100), math.radians(170), 'ouro_claro', eixo=Vector((0, 1, 0))))
        for k in range(6):
            a = k * math.pi / 3
            d = Vector((math.cos(a), math.sin(a), 0))
            ps.append(gema('coroa%d' % k, c + d * 0.1 + Vector((0, 0, 0.02 * math.sin(a * 2))), 0.016, 'cristal', alto=2.5, frente=d))
        ps.append(anel('halo1', c, 0.13, 0.004, 'ouro_claro', eixo_frente=Vector((0, 1, 0.15)).normalized(), N=28, M=3))
        ps.append(anel('halo2', c, 0.15, 0.003, 'cristal_fio', eixo_frente=Vector((1, 0.2, 0.1)).normalized(), N=28, M=3))
    return juntar(ps, 'cajado')

# ================= SETS =================
def comum2():
    # couro em camadas: gibão, peitoral de couro fervido por cima, ombreira de couro em 2 camadas, braçadeira com
    # tiras, cinto com bolsas, faldas de couro e correia com fivela
    pe = []
    o, _ = placa('gibao', -math.pi + 0.02, math.pi - 0.02, lambda a: 0.94, lambda a: 1.34 - 0.06 * max(0.0, math.cos(a)) ** 3 - 0.13 * ss(0.55, 0.95, abs(math.sin(a))),
                 0.008, 'couro', NA=30, NZ=12, esp=0.005, borda='couro_escuro', bordas='tb', larg_borda=0.01)
    pe.append(o)
    pp, _ = placa('peit', -1.1, 1.1, lambda a: 1.13 + 0.03 * (a / 1.1) ** 2, lambda a: 1.32 - 0.03 * math.cos(a) ** 4 - 0.06 * ss(0.7, 1.1, abs(a)),
                  0.016, 'couro_fervido', NA=16, NZ=7, borda='couro_escuro', larg_borda=0.01)
    pe.append(pp)
    pts = [p_corpo(0.97 + 0.35 * t, -0.9 + 1.9 * t, 0.024) for t in [i / 12 for i in range(13)]]
    pe.append(faixa('correia', pts, 0.03, 'couro_escuro', alto=0.004))
    pe.append(caixa('fiv', p_corpo(1.16, -0.1, 0.045), (0.03, 0.01, 0.03), 'ferro'))
    for k in range(5):  # costura (pontos de ferro) na beira do peitoral
        pe.append(esfera('rb%d' % k, p_corpo(1.17 + 0.03 * k, 1.0 - 0.05 * k, 0.034), 0.0045, 'ferro', seg=4, aneis=3))
    objs = [juntar(pe, 'peito')]
    qd = cinto('cinto', 'couro_escuro', 'ferro')
    for s in (1, -1):  # bolsas
        qd.append(caixa('bolsa%d' % s, p_corpo(0.92, s * 1.1, 0.045), (0.07, 0.04, 0.08), 'couro', giro=0))
    qd += faldas('falda', 'couro', 'couro_escuro', [-0.55, 0.55, math.pi], lames=1, h=0.1)
    objs.append(juntar(qd, 'quadril'))
    for lado, n in ((L, 'ombro_e'), (R_, 'ombro_d')):
        objs.append(juntar(ombreira(n, lado, 'couro', 'couro_escuro', lames=2, tam=0.9), n))
        tiras = [faixa('t%d%d' % (lado, k), [Vector((lado * (0.39 + 0.05 * k), 0.025 + math.cos(q) * 0.05, 1.309 + math.sin(q) * 0.048)) for q in [2 * math.pi * i / 12 for i in range(12)]],
                       0.01, 'couro_escuro', fechada=True, normais=[Vector((0, math.cos(q), math.sin(q))) for q in [2 * math.pi * i / 12 for i in range(12)]]) for k in range(3)]
        objs.append(bracadeira('braco_e' if lado > 0 else 'braco_d', lado, 'couro', None, extra=tiras))
    objs += [espada(0), cajado(0)]
    exportar2(0, objs)

def raro2():
    rebites = [esfera('rb%d' % i, p_corpo(1.0, -1.2 + 0.48 * i, 0.045), 0.006, 'aco_escuro', seg=5, aneis=3) for i in range(6)]
    objs = set_metal(1, 'aco', 'aco_escuro', pano='pano', crista=0.01, faldas_lames=2, ombro_lames=3, extra={'peito': rebites},
                     cot='aco')
    objs += [espada(1), cajado(1)]
    exportar2(1, objs)

def epico2():
    def emblema(p):
        return [gema('emb', p, 0.02, 'gema_roxa', alto=1.4), arco('emb_l', p, 0.032, 0.006, math.radians(-40), math.radians(220), 'ouro', eixo=Vector((0, 1, 0)))]
    def ombro(lado, n):
        th = math.radians(28)
        O = Vector((lado * math.cos(th), 0, math.sin(th)))
        J = Vector((lado * 0.115, -0.005, 1.318))
        # asa de ouro em voluta subindo da ombreira
        pts = [J + O * (0.1 + 0.05 * u) + Vector((0, -0.05 + 0.1 * u, 0.07 * math.sin(u * math.pi))) for u in [i / 10 for i in range(11)]]
        return [tubo(n + 'vol', pts, 0.006, 'ouro'), gema(n + 'g', J + O * 0.11 + Vector((0, -0.065, -0.01)), 0.014, 'gema_roxa', alto=1.4, frente=Vector((lado * 0.4, -1, 0)).normalized())]
    objs = set_metal(2, 'aco_azul', 'ouro', pano='pano_roxo', gema_mat='gema_roxa', crista=0.012, faldas_lames=3, ombro_lames=4,
                     ombro_crista='ouro', gravura_mat='ouro', cot='ouro', extra={'emblema': emblema, 'ombro': ombro})
    objs += [espada(2), cajado(2)]
    exportar2(2, objs)

def lendario2():
    # Coração de Brasa: tudo do Épico e mais: ombreiras enormes com 3 fileiras de espinhos, chifres, núcleo de brasa
    # com garras, faldas em escamas até o joelho, "asas" de lâminas nas costas e braçadeiras com garras
    nuc = []
    c = p_corpo(1.2, 0.0, 0.07)
    nuc.append(esfera('nucleo', c, 0.034, 'brasa', seg=10, aneis=8, escala=(1, 0.6, 1.15)))
    for k in range(6):
        a = k * math.pi / 3 + math.pi / 6
        d = Vector((math.cos(a), 0, math.sin(a)))
        nuc.append(cone('garra%d' % k, c + d * 0.065 + Vector((0, 0.012, 0)), c + d * 0.026 + Vector((0, -0.016, 0)), 0.011, 'bronze', lados=4))
    for s in (1, -1):  # lâminas das costas, como asas fechadas de brasa
        for k in range(3):
            b = Vector((s * (0.05 + 0.03 * k), 0.14, 1.3 - 0.05 * k))
            nuc.append(cone('asa%d%d' % (s, k), b, b + Vector((s * (0.16 - 0.03 * k), 0.06, 0.22 - 0.05 * k)), 0.018, 'obsidiana', lados=4))
            nuc.append(cone('asab%d%d' % (s, k), b + Vector((0, -0.003, 0)), b + Vector((s * (0.15 - 0.03 * k), 0.055, 0.2 - 0.05 * k)), 0.006, 'brasa_linha', lados=3))
    def ombro(lado, n):
        ps = []
        for fila in range(3):
            for k in range(3):
                base = Vector((lado * (0.125 + 0.03 * k + 0.012 * fila), -0.045 + 0.045 * k, 1.395 - 0.018 * k - 0.03 * fila))
                ps.append(cone(n + 'e%d%d' % (fila, k), base, base + Vector((lado * (0.05 + 0.01 * fila), 0.004, 0.1 - 0.025 * k - 0.025 * fila)), 0.015 - 0.003 * fila, 'bronze', lados=5))
        th = math.radians(28)
        O = Vector((lado * math.cos(th), 0, math.sin(th)))
        J = Vector((lado * 0.115, -0.005, 1.318))
        ps.append(esfera(n + 'nuc', J + O * 0.105 + Vector((0, -0.075, -0.03)), 0.017, 'brasa', seg=6, aneis=5))
        return ps
    def braco(lado):
        return [cone('bg%d%d' % (lado, k), Vector((lado * (0.4 + 0.05 * k), 0.025, 1.355)), Vector((lado * (0.43 + 0.05 * k), 0.035, 1.41)), 0.01, 'bronze', lados=4) for k in range(3)]
    def fivela(p):
        return juntar([esfera('fvn', p, 0.024, 'brasa', seg=8, aneis=6, escala=(1, 0.5, 1)), anel('fva', p, 0.03, 0.007, 'bronze', eixo_frente=Vector((0, 1, 0)), N=12, M=4)], 'fivela')
    objs = set_metal(3, 'obsidiana', 'bronze', pano='pano_brasa', crista=0.02, faldas_lames=4, ombro_lames=5, ombro_tam=1.15,
                     ombro_crista='brasa_linha', gravura_mat='bronze', cot='bronze', tab_baixo=0.5,
                     extra={'peito': nuc, 'ombro': ombro, 'fivela': fivela,
                            'emblema': lambda p: [esfera('emb', p, 0.02, 'brasa', seg=8, aneis=6, escala=(1, 0.5, 1.2)), anel('emba', p, 0.03, 0.006, 'bronze', eixo_frente=Vector((0, 1, 0)), N=12, M=4)]},
                     braco_extra=braco)
    objs += [espada(3), cajado(3)]
    exportar2(3, objs)

def mitico2():
    # Aurora: placas peroladas com ouro claro e veios de cristal; ombreiras em camadas flutuando com asas de cristal;
    # auréola de cristais e 2 anéis atrás; tabardo branco; tudo pulsa de leve
    ex = []
    c = p_corpo(1.21, 0.0, 0.075)
    ex.append(gema('gema', c, 0.034, 'cristal_fio', alto=1.7))
    ex.append(arco('eng1', c + Vector((0, 0.01, 0)), 0.05, 0.007, math.radians(-30), math.radians(210), 'ouro_claro', eixo=Vector((0, 1, 0))))
    ex.append(arco('eng2', c + Vector((0, 0.01, 0)), 0.062, 0.004, math.radians(200), math.radians(340), 'ouro_claro', eixo=Vector((0, 1, 0))))
    hal = [anel('aureola', Vector((0, 0.16, 1.47)), 0.25, 0.008, 'cristal', eixo_frente=Vector((0, 1, 0.25)).normalized(), N=36, M=4),
           anel('aureola2', Vector((0, 0.17, 1.47)), 0.2, 0.004, 'ouro_claro', eixo_frente=Vector((0, 1, 0.25)).normalized(), N=36, M=3)]
    for k in range(12):
        a = 2 * math.pi * k / 12
        p = Vector((math.cos(a) * 0.25, 0.16 - math.sin(a) * 0.06, 1.47 + math.sin(a) * 0.25))
        hal.append(gema('lasca%d' % k, p, 0.016 if k % 2 else 0.011, 'cristal_fio' if k % 3 == 0 else 'cristal', alto=2.4, frente=(p - Vector((0, 0.16, 1.47))).normalized()))
    def ombro(lado, n):
        ps = []
        th = math.radians(28)
        O = Vector((lado * math.cos(th), 0, math.sin(th)))
        J = Vector((lado * 0.115, -0.005, 1.318))
        sobe = Vector((lado * 0.03, 0, 0.035))
        # asa de cristal: 4 penas que abrem para trás e para cima, soltas do ombro
        for k in range(4):
            b = J + O * 0.13 + sobe + Vector((0, 0.03 + 0.02 * k, 0.02))
            ps.append(gema(n + 'pena%d' % k, b + Vector((lado * 0.03 * k, 0.04 * k, 0.07 + 0.02 * k)), 0.02 - 0.002 * k, 'cristal', alto=3.2 - 0.3 * k,
                           frente=Vector((lado * 0.6, 0.6, 0.3)).normalized()))
        ps.append(gema(n + 'gema', J + O * 0.12 + sobe * 1.3 + Vector((0, -0.07, 0)), 0.016, 'cristal_fio', alto=2.0, frente=Vector((lado * 0.4, -1, 0)).normalized()))
        return ps
    def braco(lado):
        return [gema('bc%d' % lado, Vector((lado * 0.44, 0.025, 1.37)), 0.012, 'cristal_fio', alto=2.2, frente=Vector((0, 0, 1))),
                arco('ba%d' % lado, Vector((lado * 0.44, 0.025, 1.309)), 0.07, 0.004, math.radians(20), math.radians(160), 'ouro_claro', eixo=Vector((1, 0, 0)))]
    def emblema(p):
        return [gema('emb', p, 0.022, 'cristal_fio', alto=1.8), arco('emba', p, 0.034, 0.005, math.radians(-30), math.radians(210), 'ouro_claro', eixo=Vector((0, 1, 0)))]
    objs = set_metal(4, 'perola', 'ouro_claro', pano='pano_branco', crista=0.016, faldas_lames=4, ombro_lames=5, ombro_tam=1.1,
                     ombro_crista='cristal_fio', gravura_mat='cristal_fio', cot='perola', tab_baixo=0.45,
                     extra={'peito': ex, 'ombro': ombro, 'emblema': emblema}, braco_extra=braco)
    objs.append(juntar(hal, 'peito_aureola'))
    objs += [espada(4), cajado(4)]
    exportar2(4, objs)

if os.environ.get('SO_ARMAS'):  # proposta 3: só as espadas e os cajados (armas3_rN.glb)
    for r in range(5):
        objs = [espada(r), cajado(r)]
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(_AQ, 'armas3_r%d.glb' % r), use_selection=True, export_format='GLB',
                                  export_materials='EXPORT', export_apply=True, export_yup=True)
        print('ARMAS', r, [len(o.data.polygons) for o in objs])
        for o in objs:
            bpy.data.objects.remove(o)
else:
    comum2(); raro2(); epico2(); lendario2(); mitico2()
