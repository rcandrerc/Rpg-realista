# Gera opções de ícone do Aethra. uso: python3 icone.py <pasta_saida>
# Cada opção sai em camadas (fundo + frente) para ícone adaptativo do Android,
# e numa versão completa 1024x1024.
import sys, math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

S = 2048  # desenha em 2x e reduz para 1024 (borda lisa)
OUT = sys.argv[1]
AQUI = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

def L(): return Image.new("L", (S, S), 0)

def gradiente_v(c0, c1, c2):
    g = Image.new("RGB", (1, S))
    for y in range(S):
        t = y / (S - 1)
        a, b, u = (c0, c1, t * 2) if t < .5 else (c1, c2, (t - .5) * 2)
        g.putpixel((0, y), tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3)))
    return g.resize((S, S))

OURO = gradiente_v((255, 244, 200), (236, 178, 62), (150, 86, 20))
GELO = gradiente_v((240, 252, 255), (150, 215, 255), (60, 130, 220))

import numpy as np
def fundo_noite():
    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    d = np.clip(np.hypot(x - S*.5, y - S*.48) / (S*.75), 0, 1)
    c0 = np.array([46, 70, 150], np.float32); c1 = np.array([7, 10, 34], np.float32)
    a = (c0 + (c1 - c0) * d[..., None] ** .8)
    halo = np.exp(-(d / .30) ** 2)[..., None] * np.array([40, 26, 4], np.float32)
    a = np.clip(a + halo, 0, 255).astype(np.uint8)
    img = Image.fromarray(a, "RGB")
    d = ImageDraw.Draw(img)
    for (x, y) in [(.24, .23), (.30, .19), (.77, .22), (.73, .27), (.22, .78), (.79, .80)]:
        r = 5
        d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=(130, 140, 180))
    return img

def _velho():
    # céu noturno azul com halo dourado no centro (como o sol-sigilo da capa)
    img = Image.new("RGB", (S, S))
    px = img.load()
    for y in range(0, S, 4):
        for x in range(0, S, 4):
            d = math.hypot(x - S * .5, y - S * .46) / (S * .72)
            t = min(1, d)
            c = (int(28 + (6 - 28) * t), int(46 + (10 - 46) * t), int(96 + (32 - 96) * t))
            for yy in range(4):
                for xx in range(4):
                    px[x + xx, y + yy] = c
    img = img.filter(ImageFilter.GaussianBlur(6))
    halo = L(); ImageDraw.Draw(halo).ellipse([S*.5-S*.36, S*.46-S*.36, S*.5+S*.36, S*.46+S*.36], fill=150)
    halo = halo.filter(ImageFilter.GaussianBlur(S * .12))
    img = Image.composite(Image.new("RGB", (S, S), (255, 190, 90)), img, halo.point(lambda v: int(v * .55)))
    # estrelinhas
    d = ImageDraw.Draw(img)
    import random; r = random.Random(7)
    for _ in range(70):
        x, y = r.random() * S, r.random() * S
        if math.hypot(x - S/2, y - S*.46) < S * .40: continue
        s = r.choice([2, 3, 3, 4, 6])
        d.ellipse([x - s, y - s, x + s, y + s], fill=(235, 240, 255))
    return img

def brilho(base, mask, cor, raio, forca):
    g = mask.filter(ImageFilter.GaussianBlur(raio)).point(lambda v: min(255, int(v * forca)))
    return Image.composite(Image.new("RGB", (S, S), cor), base, g)

def pinta(base, mask, tinta, contorno=None, esp=0):
    if contorno:
        m2 = mask.filter(ImageFilter.MaxFilter(esp * 2 + 1))
        base = Image.composite(Image.new("RGB", (S, S), contorno), base, m2)
    return Image.composite(tinta, base, mask)

# ---------- sigilo (círculo mágico dourado) ----------
def sigilo(cx, cy, R):
    m = L(); d = ImageDraw.Draw(m)
    def anel(r, w): d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=255, width=int(w))
    anel(R, R * .045)
    anel(R * .86, R * .02)
    anel(R * .62, R * .03)
    # runas entre os anéis: marcas alternadas
    n = 24
    for i in range(n):
        a = i / n * 2 * math.pi
        r0, r1 = R * .885, R * .975
        if i % 3 == 0:  # losango
            rm = (r0 + r1) / 2; w = R * .05
            pts = [(cx + math.cos(a) * (rm + w * .8), cy + math.sin(a) * (rm + w * .8)),
                   (cx + math.cos(a + .045) * rm, cy + math.sin(a + .045) * rm),
                   (cx + math.cos(a) * (rm - w * .8), cy + math.sin(a) * (rm - w * .8)),
                   (cx + math.cos(a - .045) * rm, cy + math.sin(a - .045) * rm)]
            d.polygon(pts, fill=255)
        else:
            d.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1)], fill=255, width=int(R * .022))
    # estrela de 8 pontas inscrita
    pts = []
    for i in range(8):
        a = i / 8 * 2 * math.pi - math.pi / 2
        pts.append((cx + math.cos(a) * R * .86, cy + math.sin(a) * R * .86))
    for k in range(8):
        d.line([pts[k], pts[(k + 3) % 8]], fill=255, width=int(R * .018))
    return m

def espada(cx, topo, base_y, larg):
    """espada de gelo vertical, ponta para cima. devolve (lâmina, guarda+pomo, cabo)"""
    lam = L(); d = ImageDraw.Draw(lam)
    gy = base_y
    d.polygon([(cx, topo), (cx + larg / 2, topo + larg * 1.3), (cx + larg / 2, gy), (cx - larg / 2, gy), (cx - larg / 2, topo + larg * 1.3)], fill=255)
    fio = L(); ImageDraw.Draw(fio).polygon([(cx, topo + larg * .5), (cx + larg * .09, topo + larg * 1.4), (cx + larg * .09, gy), (cx - larg * .09, gy), (cx - larg * .09, topo + larg * 1.4)], fill=255)
    gu = L(); d = ImageDraw.Draw(gu)
    gw, gh = larg * 3.4, larg * .42
    d.rounded_rectangle([cx - gw / 2, gy, cx + gw / 2, gy + gh], radius=gh / 2, fill=255)
    for sx in (-1, 1):  # pontas curvas da guarda
        ex = cx + sx * gw / 2
        d.ellipse([ex - gh * .9, gy - gh * .7, ex + gh * .9, gy + gh * 1.1], fill=255)
    d.polygon([(cx - larg * .55, gy), (cx + larg * .55, gy), (cx, gy - larg * .7)], fill=255)  # bico da guarda
    cabo_y0, cabo_y1 = gy + gh, gy + gh + larg * 2.0
    cab = L(); ImageDraw.Draw(cab).rectangle([cx - larg * .22, cabo_y0, cx + larg * .22, cabo_y1], fill=255)
    pr = larg * .42
    ImageDraw.Draw(gu).ellipse([cx - pr, cabo_y1 - pr * .2, cx + pr, cabo_y1 + pr * 1.6], fill=255)
    return lam, fio, gu, cab

def bisel(mask, tinta, k=10):
    """luz em cima-esquerda e sombra embaixo-direita, para dar volume de metal"""
    bl = mask.filter(ImageFilter.GaussianBlur(k))
    luz = ImageChops.subtract(mask, ImageChops.offset(bl, k, k)).point(lambda v: min(255, int(v * 1.3)))
    som = ImageChops.subtract(mask, ImageChops.offset(bl, -k, -k)).point(lambda v: min(255, int(v * 1.1)))
    t = Image.composite(Image.new("RGB", (S, S), (255, 252, 230)), tinta, luz.point(lambda v: int(v * .75)))
    t = Image.composite(Image.new("RGB", (S, S), (90, 44, 8)), t, som.point(lambda v: int(v * .7)))
    return t

class Camada:
    def __init__(s):
        s.c = Image.new("RGB", (S, S)); s.a = L()
    def add(s, mask, tinta, cont=None, esp=0):
        if cont:
            m2 = mask.filter(ImageFilter.MaxFilter(esp * 2 + 1))
            s.c = Image.composite(Image.new("RGB", (S, S), cont), s.c, m2); s.a = ImageChops.lighter(s.a, m2)
        s.c = Image.composite(tinta, s.c, mask); s.a = ImageChops.lighter(s.a, mask)
    def brilho(s, mask, cor, raio, forca):
        g = mask.filter(ImageFilter.GaussianBlur(raio)).point(lambda v: min(255, int(v * forca)))
        s.add(g, Image.new("RGB", (S, S), cor))
    def rgba(s):
        f = s.c.convert("RGBA"); f.putalpha(s.a); return f

def sigilo2(cx, cy, R):
    m = L(); d = ImageDraw.Draw(m)
    def anel(r, w): d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=255, width=int(w))
    anel(R, R * .06); anel(R * .84, R * .025); anel(R * .58, R * .035)
    n = 16
    for i in range(n):
        a = i / n * 2 * math.pi - math.pi / 2
        rm = R * .92
        if i % 2 == 0:
            w = R * .07
            pts = [(cx + math.cos(a) * (rm + w), cy + math.sin(a) * (rm + w)),
                   (cx + math.cos(a + .07) * rm, cy + math.sin(a + .07) * rm),
                   (cx + math.cos(a) * (rm - w), cy + math.sin(a) * (rm - w)),
                   (cx + math.cos(a - .07) * rm, cy + math.sin(a - .07) * rm)]
            d.polygon(pts, fill=255)
        else:
            r = R * .025; x, y = cx + math.cos(a) * rm, cy + math.sin(a) * rm
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    # dois quadrados cruzados (estrela de 8 pontas limpa)
    for off in (0, math.pi / 4):
        pts = [(cx + math.cos(off + k * math.pi / 2) * R * .84, cy + math.sin(off + k * math.pi / 2) * R * .84) for k in range(4)]
        d.line(pts + [pts[0]], fill=255, width=int(R * .03), joint="curve")
    return m

def espada2(cx, topo, gy, larg):
    esq = L(); dir_ = L()
    ImageDraw.Draw(esq).polygon([(cx, topo), (cx, gy), (cx - larg / 2, gy), (cx - larg / 2, topo + larg * 1.2)], fill=255)
    ImageDraw.Draw(dir_).polygon([(cx, topo), (cx + larg / 2, topo + larg * 1.2), (cx + larg / 2, gy), (cx, gy)], fill=255)
    gu = L(); d = ImageDraw.Draw(gu)
    gw, gh = larg * 3.6, larg * .46
    # guarda reta com pontas em losango
    d.polygon([(cx - gw / 2 + gh * .9, gy + gh * .1), (cx + gw / 2 - gh * .9, gy + gh * .1),
               (cx + gw / 2 - gh * .9, gy + gh * .9), (cx - gw / 2 + gh * .9, gy + gh * .9)], fill=255)
    for sx in (-1, 1):
        ex = cx + sx * (gw / 2 - gh * .7)
        d.polygon([(ex - gh * .75, gy + gh / 2), (ex, gy - gh * .3), (ex + gh * .75, gy + gh / 2), (ex, gy + gh * 1.3)], fill=255)
    d.polygon([(cx - larg * .7, gy + gh * .5), (cx, gy - larg * .55), (cx + larg * .7, gy + gh * .5), (cx, gy + gh * 1.5)], fill=255)
    c0, c1 = gy + gh, gy + gh + larg * 1.55
    cab = L(); ImageDraw.Draw(cab).rectangle([cx - larg * .2, c0, cx + larg * .2, c1], fill=255)
    faixas = L(); df = ImageDraw.Draw(faixas)
    k = 5
    for i in range(k):
        y = c0 + (c1 - c0) * (i + .5) / k
        df.line([(cx - larg * .2, y - larg * .1), (cx + larg * .2, y + larg * .1)], fill=255, width=int(larg * .06))
    pr = larg * .38
    pomo = L(); ImageDraw.Draw(pomo).ellipse([cx - pr, c1 - pr * .1, cx + pr, c1 + pr * 1.9], fill=255)
    return esq, dir_, gu, cab, faixas, pomo, (cx, gy + gh / 2), (cx, c1 + pr * .85)

def somar(bg, mask, cor, raio, forca):
    g = mask.filter(ImageFilter.GaussianBlur(raio)).point(lambda v: min(255, int(v * forca)))
    cam = Image.composite(Image.new("RGB", (S, S), cor), Image.new("RGB", (S, S)), g)
    return ImageChops.add(bg, cam)

def gema(c, r):
    m = L(); ImageDraw.Draw(m).ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=255); return m

def opcao_sigilo():
    bg = fundo_noite(); glow = Image.new("RGB", (S, S))
    k = Camada()
    cx, cy, R = S * .5, S * .47, S * .265
    sig = sigilo2(cx, cy, R)
    larg = S * .074
    esq, dir_, gu, cab, faixas, pomo, g1, g2 = espada2(cx, S * .19, S * .635, larg)
    lam = ImageChops.lighter(esq, dir_)
    # sol central (espiral de luz da capa)
    luz = gema((cx, cy), R * .55)
    glow = somar(glow, luz, (95, 62, 12), R * .3, 1.0)
    glow = somar(glow, sig, (130, 80, 15), 30, 1.3)
    k.add(sig, bisel(sig, OURO, 9), (64, 30, 6), 7)
    metal = ImageChops.lighter(ImageChops.lighter(lam, gu), ImageChops.lighter(cab, pomo))
    k.add(metal.filter(ImageFilter.MaxFilter(45)).filter(ImageFilter.GaussianBlur(14)), Image.new("RGB", (S, S), (8, 12, 38)))
    k.brilho(lam, (110, 200, 255), 46, 2.2)
    k.add(lam, GELO, (16, 36, 86), 6)
    k.add(esq, Image.new("RGB", (S, S), (236, 250, 255)))
    k.add(dir_, gradiente_v((170, 225, 255), (95, 175, 245), (40, 100, 200)))
    k.add(cab, Image.new("RGB", (S, S), (110, 38, 30)), (30, 10, 8), 6)
    k.add(faixas, Image.new("RGB", (S, S), (60, 18, 14)))
    dourado = ImageChops.lighter(gu, pomo)
    k.add(dourado, bisel(dourado, OURO, 8), (64, 30, 6), 7)
    gm = ImageChops.lighter(gema(g1, larg * .2), gema(g2, larg * .17))
    k.brilho(gm, (120, 220, 255), 14, 1.6)
    k.add(gm, gradiente_v((230, 250, 255), (90, 200, 255), (30, 90, 200)))
    return bg, glow, k.rgba()

def opcao_sigla():
    bg = fundo_noite(); glow = Image.new("RGB", (S, S))
    cx, cy = S * .5, S * .49
    camada = Image.new("RGB", (S, S)); alfa = L()
    def add(mask, tinta, cont=None, esp=0):
        nonlocal camada, alfa
        if cont:
            m2 = mask.filter(ImageFilter.MaxFilter(esp * 2 + 1))
            camada = Image.composite(Image.new("RGB", (S, S), cont), camada, m2); alfa = ImageChops.lighter(alfa, m2)
        camada = Image.composite(tinta, camada, mask); alfa = ImageChops.lighter(alfa, mask)
    R = S * .31
    an = L(); d = ImageDraw.Draw(an)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=255, width=int(R * .05))
    for i in range(4):  # 4 losangos nos pontos cardeais
        a = i * math.pi / 2; x, y = cx + math.cos(a) * R, cy + math.sin(a) * R; w = R * .09
        d.polygon([(x - w, y), (x, y - w * 1.4), (x + w, y), (x, y + w * 1.4)], fill=255)
    F = ImageFont.truetype(os.path.join(AQUI, "CinzelDecorative-Bold.ttf"), int(S * .41))
    le = L(); dl = ImageDraw.Draw(le)
    bb = dl.textbbox((0, 0), "A", font=F)
    dl.text((cx - (bb[0] + bb[2]) / 2 - S * .012, cy - (bb[1] + bb[3]) / 2 - S * .005), "A", font=F, fill=255)
    folga = ImageChops.multiply(le.resize((512, 512)).filter(ImageFilter.MaxFilter(2 * int(512 * .03 / 1.2) + 1)), an.resize((512, 512))).point(lambda v: 255 if v > 60 else 0).getbbox()
    print('folga da letra ok' if folga is None else f'letra perto do anel em {folga}')
    tudo = ImageChops.lighter(an, le)
    glow = somar(glow, gema((cx, cy), R * .55), (80, 55, 12), R * .3, 1.0)
    glow = somar(glow, tudo, (130, 80, 15), 30, 1.3)
    add(an, bisel(an, OURO, 9), (64, 30, 6), 7)
    add(le.filter(ImageFilter.MaxFilter(61)).filter(ImageFilter.GaussianBlur(8)), Image.new("RGB", (S, S), (10, 14, 40)))
    add(le, bisel(le, OURO, 14), (64, 30, 6), 9)
    fr = camada.convert("RGBA"); fr.putalpha(alfa)
    return bg, glow, fr

def opcao_rosto():
    src = Image.open("/mnt/project-files/aethra-arte/v3/aethra-icone-app.png").convert("RGB")
    bg = src.resize((S, S), Image.LANCZOS)
    # moldura dourada fina, sem nada na frente
    fr = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return bg, Image.new("RGB", (S, S)), fr

# ---------- v2: pedidos da direção de arte ----------
# medidas em fração do ÍCONE VISÍVEL: desenho * 0,8 (zona segura) * 1,5 (recorte 72/108) = 1,2x
def F(frac): return frac / 1.2 * S

def sigilo3(cx, cy, R, simples=False):
    m = L(); d = ImageDraw.Draw(m)
    def anel(r, w): d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=255, width=int(w))
    anel(R, F(.06))                       # anel externo ~6%
    for i in range(4):                    # 4 losangos nos pontos cardeais
        a = i * math.pi / 2; x, y = cx + math.cos(a) * R, cy + math.sin(a) * R; w = F(.045)
        d.polygon([(x - w, y), (x, y - w * 1.35), (x + w, y), (x, y + w * 1.35)], fill=255)
    if not simples:
        anel(R * .70, F(.025))            # 1 anel interno
        pts = [(cx + math.cos(k * math.pi / 2 + math.pi / 4) * (R - F(.03)), cy + math.sin(k * math.pi / 2 + math.pi / 4) * (R - F(.03))) for k in range(4)]
        d.line(pts + [pts[0]], fill=255, width=int(F(.025)), joint="curve")  # 4 linhas (quadrado girado)
    return m

def espada3(cx, topo, gy, Lg, ponta=1.25, asa=1.0, cabo=1.44, pomo=1.0):
    """Espada A do jogo: lâmina prateada com veio azul, guarda dourada em asa, gema azul, cabo azul-escuro com tiras cruzadas, pomo em losango."""
    esq = L(); dir_ = L()
    ImageDraw.Draw(esq).polygon([(cx, topo), (cx, gy), (cx - Lg / 2, gy), (cx - Lg / 2, topo + Lg * ponta)], fill=255)
    ImageDraw.Draw(dir_).polygon([(cx, topo), (cx + Lg / 2, topo + Lg * ponta), (cx + Lg / 2, gy), (cx, gy)], fill=255)
    veio = L(); ImageDraw.Draw(veio).polygon([(cx, topo + Lg * 1.5), (cx + Lg * .14, topo + Lg * 2.0), (cx + Lg * .14, gy - Lg * .35), (cx, gy - Lg * .1), (cx - Lg * .14, gy - Lg * .35), (cx - Lg * .14, topo + Lg * 2.0)], fill=255)
    gu = L(); d = ImageDraw.Draw(gu)
    for sx in (-1, 1):  # asas da guarda, pontas viradas para a lâmina
        P = lambda x, y: (cx + sx * (.3 + (x - .3) * asa) * Lg, gy + y * asa * Lg)
        d.polygon([P(.3, -.1), P(1.0, -.14), P(1.42, -.3), P(1.72, -.55), P(1.62, -.12), P(1.3, .2), P(.9, .34), P(.3, .4)], fill=255)
    d.polygon([(cx, gy - Lg * .85), (cx + Lg * .6, gy + Lg * .1), (cx, gy + Lg * .95), (cx - Lg * .6, gy + Lg * .1)], fill=255)
    c0, c1 = gy + Lg * .55, gy + Lg * cabo
    cab = L(); ImageDraw.Draw(cab).rounded_rectangle([cx - Lg * .23, c0, cx + Lg * .23, c1], radius=Lg * .08, fill=255)
    tiras = L(); dt = ImageDraw.Draw(tiras)
    for i in range(3):
        y0 = c0 + (c1 - c0) * i / 3; y1 = c0 + (c1 - c0) * (i + 1) / 3
        dt.line([(cx - Lg * .23, y0), (cx + Lg * .23, y1)], fill=255, width=int(Lg * .09))
        dt.line([(cx + Lg * .23, y0), (cx - Lg * .23, y1)], fill=255, width=int(Lg * .09))
    tiras = ImageChops.multiply(tiras, cab)
    pq = pomo; pomo = L(); ImageDraw.Draw(pomo).polygon([(cx, c1 - Lg * .15 * pq), (cx + Lg * .42 * pq, c1 + Lg * .4 * pq), (cx, c1 + Lg * 1.05 * pq), (cx - Lg * .42 * pq, c1 + Lg * .4 * pq)], fill=255)
    g1 = L(); ImageDraw.Draw(g1).ellipse([cx - Lg * .27, gy + Lg * .1 - Lg * .3, cx + Lg * .27, gy + Lg * .1 + Lg * .3], fill=255)
    g2 = L(); ImageDraw.Draw(g2).polygon([(cx, c1 + Lg * .12 * pq), (cx + Lg * .17 * pq, c1 + Lg * .4 * pq), (cx, c1 + Lg * .7 * pq), (cx - Lg * .17 * pq, c1 + Lg * .4 * pq)], fill=255)
    return dict(esq=esq, dir=dir_, veio=veio, gu=gu, cab=cab, tiras=tiras, pomo=pomo, gemas=ImageChops.lighter(g1, g2))

PRATA_E = gradiente_v((252, 253, 255), (226, 233, 242), (196, 206, 222))
PRATA_D = gradiente_v((206, 214, 228), (160, 172, 192), (118, 130, 152))
GEMA = gradiente_v((225, 248, 255), (80, 190, 255), (25, 85, 200))

def desenha_espada(k, glow, e):
    tudo = e["esq"]
    for n in ("dir", "gu", "cab", "pomo"): tudo = ImageChops.lighter(tudo, e[n])
    k.add(tudo.filter(ImageFilter.MaxFilter(2 * int(F(.015)) + 1)), Image.new("RGB", (S, S), (10, 14, 40)))  # contorno ~1,5%
    k.add(e["esq"], PRATA_E); k.add(e["dir"], PRATA_D)
    k.brilho(e["veio"], (80, 190, 255), 18, 1.8)       # brilho azul só no veio central
    k.add(e["veio"], gradiente_v((210, 245, 255), (90, 200, 255), (40, 130, 235)))
    k.add(e["cab"], Image.new("RGB", (S, S), (24, 34, 70)))
    k.add(e["tiras"], bisel(e["tiras"], OURO, 4))
    dour = ImageChops.lighter(e["gu"], e["pomo"])
    k.add(dour, bisel(dour, OURO, 8), (64, 30, 6), 5)
    k.brilho(e["gemas"], (110, 210, 255), 12, 1.5)
    k.add(e["gemas"], GEMA)
    return glow

def opcao_sigilo_v2(simples=False):
    bg = fundo_noite(); glow = Image.new("RGB", (S, S)); k = Camada()
    cx, cy, R = S * .5, S * .47, S * .265
    sig = sigilo3(cx, cy, R, simples)
    glow = somar(glow, gema((cx, cy), R * .6), (40, 32, 20), R * .3, 1.0)
    glow = somar(glow, sig, (130, 80, 15), 30, 1.3)
    k.add(sig, bisel(sig, OURO, 10), (64, 30, 6), 7)
    e = espada3(cx, S * .135, S * .60, F(.11))
    glow = desenha_espada(k, glow, e)
    return bg, glow, k.rgba()

def silhueta_notificacao():
    e = espada3(S * .5, S * .08, S * .64, S * .13)
    m = L()
    for n in ("esq", "dir", "gu", "cab", "pomo"): m = ImageChops.lighter(m, e[n])
    m = ImageChops.subtract(m, e["gemas"].filter(ImageFilter.MinFilter(9)))  # gemas vazadas
    out = Image.new("RGBA", (S, S), (255, 255, 255, 0)); out.putalpha(m); return out

# ---------- v3: fusão pedida pelo André: letra A feita de espada + cajado ----------
def transforma(m, ref, angulo, alvo):
    return m.rotate(angulo, resample=Image.BICUBIC, center=ref, translate=(alvo[0] - ref[0], alvo[1] - ref[1]))

def cajado(cx, cabeca_y, comp, w, r=None, garra=1.0, aneis=None, anel_e=None, ponteira=None):
    """Cajado A do jogo: haste escura com anéis dourados, garras douradas segurando a chama laranja."""
    r = r or w * 1.45
    haste = L(); ImageDraw.Draw(haste).rounded_rectangle([cx - w / 2, cabeca_y + r * .6, cx + w / 2, cabeca_y + comp], radius=w * .3, fill=255)
    ouro = L(); d = ImageDraw.Draw(ouro)
    for y in (aneis or [cabeca_y + comp * t for t in (.28, .55, .8)]):  # anéis
        h = anel_e or w * .32
        d.rounded_rectangle([cx - w * .8, y - h, cx + w * .8, y + h], radius=min(h, w * .2), fill=255)
    pe = cabeca_y + comp
    if ponteira:  # ponteira curta de metal
        d.rounded_rectangle([cx - w * .62, pe - w * .1, cx + w * .62, pe + ponteira * .7], radius=w * .15, fill=255)
        d.polygon([(cx - w * .62, pe + ponteira * .65), (cx + w * .62, pe + ponteira * .65), (cx + w * .3, pe + ponteira), (cx - w * .3, pe + ponteira)], fill=255)
    else:
        d.polygon([(cx - w * .7, pe - w * .2), (cx + w * .7, pe - w * .2), (cx, pe + w * 1.3)], fill=255)  # ponteira
    # base das garras e duas garras curvas em volta da chama
    d.polygon([(cx - w * 1.1, cabeca_y + r * .55), (cx + w * 1.1, cabeca_y + r * .55), (cx + w * .5, cabeca_y + r * 1.5), (cx - w * .5, cabeca_y + r * 1.5)], fill=255)
    for sx in (-1, 1):
        g = lambda v: (.72 + (v - .72) * garra) if v > .72 else v
        d.polygon([(cx + sx * w * .6, cabeca_y + r * .8), (cx + sx * r * g(1.25), cabeca_y + r * .2), (cx + sx * r * g(1.15), cabeca_y - r * .7),
                   (cx + sx * r * g(.85), cabeca_y - r * 1.25), (cx + sx * r * g(.95), cabeca_y - r * .5), (cx + sx * r * g(.8), cabeca_y + r * .3), (cx + sx * w * .3, cabeca_y + r * .55)], fill=255)
    chama = L(); dc = ImageDraw.Draw(chama)
    dc.ellipse([cx - r * .72, cabeca_y - r * .55, cx + r * .72, cabeca_y + r * .75], fill=255)
    dc.polygon([(cx - r * .55, cabeca_y - r * .1), (cx, cabeca_y - r * 1.55), (cx + r * .55, cabeca_y - r * .1)], fill=255)  # ponta da chama
    nucleo = L(); ImageDraw.Draw(nucleo).ellipse([cx - r * .3, cabeca_y - r * .05, cx + r * .3, cabeca_y + r * .5], fill=255)
    return dict(haste=haste, ouro=ouro, chama=chama, nucleo=nucleo)

FOGO = gradiente_v((255, 236, 150), (255, 150, 40), (200, 60, 15))

def opcao_fusao():
    bg = fundo_noite(); glow = Image.new("RGB", (S, S)); k = Camada()
    cx, cy = S * .5, S * .49
    R = S * .31
    an = L(); d = ImageDraw.Draw(an)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=255, width=int(F(.06)))
    for i in range(4):
        a = i * math.pi / 2; x, y = cx + math.cos(a) * R, cy + math.sin(a) * R; w = F(.045)
        d.polygon([(x - w, y), (x, y - w * 1.35), (x + w, y), (x, y + w * 1.35)], fill=255)
    glow = somar(glow, gema((cx, cy), R * .55), (40, 32, 20), R * .3, 1.0)
    glow = somar(glow, an, (130, 80, 15), 30, 1.3)
    k.add(an, bisel(an, OURO, 10), (64, 30, 6), 7)
    apice = (cx, S * .235)
    pe_e, pe_d = (S * .335, S * .715), (S * .665, S * .715)
    ang = math.degrees(math.atan2(pe_d[0] - apice[0], pe_d[1] - apice[1]))  # inclinação das pernas
    un = lambda p, q: ((q[0] - p[0]) / math.dist(p, q), (q[1] - p[1]) / math.dist(p, q))
    # cajado = perna esquerda, chama no topo do A
    wc = F(.042); r = wc * 1.45
    ap_c = (apice[0] - S * .03, apice[1] + S * .015)
    de = un(ap_c, pe_e)
    cab = (ap_c[0] + de[0] * r * 1.7, ap_c[1] + de[1] * r * 1.7)
    ref_c = (S / 2, S * .2)
    cj = cajado(ref_c[0], ref_c[1], math.dist(cab, pe_e) - wc * 1.1, wc)
    ang_c = math.degrees(math.atan2(ap_c[0] - pe_e[0], pe_e[1] - ap_c[1]))
    cj = {n: transforma(m, ref_c, -ang_c, cab) for n, m in cj.items()}
    # espada = perna direita, ponta no topo do A, guarda e cabo embaixo (pé do A)
    Lg = F(.08)
    ap_e = (apice[0] + S * .03, apice[1] - S * .005)
    dd = un(ap_e, pe_d)
    lamina = math.dist(ap_e, pe_d) - Lg * 2.55
    ref_e = (S / 2, S * .8)
    e = espada3(ref_e[0], ref_e[1] - lamina, ref_e[1], Lg, 2.1)
    guarda = (ap_e[0] + dd[0] * lamina, ap_e[1] + dd[1] * lamina)
    ang_e = math.degrees(math.atan2(pe_d[0] - ap_e[0], pe_d[1] - ap_e[1]))
    e = {n: transforma(m, ref_e, ang_e, guarda) for n, m in e.items()}
    # barra do A: faixa dourada com gema azul
    by = S * .50
    xb = lambda y, lado: apice[0] + lado * (y - apice[1]) * math.tan(math.radians(ang))
    barra = L(); db = ImageDraw.Draw(barra)
    h = F(.04)
    db.polygon([(xb(by, -1) - F(.035), by - h / 2), (xb(by, 1) + F(.035), by - h / 2), (xb(by + h, 1) + F(.035), by + h / 2), (xb(by + h, -1) - F(.035), by + h / 2)], fill=255)
    gb = L(); gw = F(.04); ImageDraw.Draw(gb).polygon([(cx - gw, by), (cx, by - gw * 1.3), (cx + gw, by), (cx, by + gw * 1.3)], fill=255)
    gb_borda = gb.filter(ImageFilter.MaxFilter(17))
    # desenho: cajado, barra, espada por cima
    cont = lambda *ms: (lambda u: u.filter(ImageFilter.MaxFilter(2 * int(F(.013)) + 1)))(_uniao(*ms))
    desenha_espada(k, glow, e)
    k.add(cont(cj["haste"], cj["ouro"], cj["chama"]), Image.new("RGB", (S, S), (10, 14, 40)))
    k.add(cj["haste"], gradiente_v((70, 50, 60), (45, 32, 40), (28, 20, 26)))
    k.add(cj["ouro"], bisel(cj["ouro"], OURO, 6))
    glow = somar(glow, encolhe_n(cj["chama"]), (150, 70, 10), 40, 1.6)
    k.brilho(cj["chama"], (255, 140, 40), 16, 1.3)
    k.add(cj["chama"], FOGO); k.add(cj["nucleo"], Image.new("RGB", (S, S), (255, 248, 210)))
    k.add(cont(barra, gb_borda), Image.new("RGB", (S, S), (10, 14, 40)))
    k.add(ImageChops.lighter(barra, gb_borda), bisel(ImageChops.lighter(barra, gb_borda), OURO, 6))
    k.add(gb, GEMA)
    return bg, glow, k.rgba()

def opcao_fusao4():
    """v4 (direção de arte): pernas a ±18°, cruzam num X pequeno no topo, 7% de largura, guarda como serifa."""
    bg = fundo_noite(); glow = Image.new("RGB", (S, S)); k = Camada()
    Dp = lambda x, y: (((x - .5) / 1.2 + .5) * S, ((y - .5) / 1.2 + .5) * S)  # ponto do ícone final -> desenho
    cx, cy = S * .5, S * .49
    R = S * .31
    an = L(); d = ImageDraw.Draw(an)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=255, width=int(F(.06)))
    for i in range(4):
        a = i * math.pi / 2; x, y = cx + math.cos(a) * R, cy + math.sin(a) * R; w = F(.045)
        d.polygon([(x - w, y), (x, y - w * 1.35), (x + w, y), (x, y + w * 1.35)], fill=255)
    glow = somar(glow, gema((cx, cy), R * .55), (40, 32, 20), R * .3, 1.0)
    glow = somar(glow, an, (130, 80, 15), 30, 1.3)
    k.add(an, bisel(an, OURO, 10), (64, 30, 6), 7)
    T, YC, YB, ANG = .20, .32, .80, 24.0
    TC = .17  # a chama sobe um pouco mais que a ponta da espada, para as duas aparecerem
    t = math.tan(math.radians(ANG)); c = math.cos(math.radians(ANG))
    eixo = (YB - T) / c                      # comprimento de cada perna, ponta até a base, no ícone final
    W = .07
    # espada: pé na direita, ponta sai do X para a esquerda
    Lg = F(W); cabo, pomo = .62, .55
    abaixo = Lg * (cabo + 1.05 * pomo)
    lamina = F(eixo) - abaixo
    ref = (S / 2, S * .85)
    e = espada3(ref[0], ref[1] - lamina, ref[1], Lg, 2.0, .6, cabo, pomo)
    ponta_e = Dp(.5 - (YC - T) * t, T)
    dirb = (math.sin(math.radians(ANG)), math.cos(math.radians(ANG)))  # da ponta para o pé direito
    guarda = (ponta_e[0] + dirb[0] * lamina, ponta_e[1] + dirb[1] * lamina)
    e = {n: transforma(m, ref, ANG, guarda) for n, m in e.items()}
    # cajado: pé na esquerda, chama sai do X para a direita
    wc = F(W); r = F(.05)
    topo_c = Dp(.5 + (YC - TC) * t, TC)
    dirc = (-math.sin(math.radians(ANG)), math.cos(math.radians(ANG)))
    cab = (topo_c[0] + dirc[0] * r * 1.55, topo_c[1] + dirc[1] * r * 1.55)
    pont = F(.04)
    comp = F((YB - TC) / c) - r * 1.55 - pont
    refc = (S / 2, S * .15)
    yb_ = T + .55 * (YB - T)
    cab_y_f = TC + (r * 1.55 / S * 1.2) * c          # altura (ícone final) do centro da cabeça
    em = lambda y: refc[1] + F((y - cab_y_f) / c)    # altura final -> posição ao longo da haste
    cj = cajado(refc[0], refc[1], comp, wc * .8, r, .35, [em(yb_ + .065), em((yb_ + YB) / 2 + .03)], F(.0125), pont)
    cj = {n: transforma(m, refc, -ANG, cab) for n, m in cj.items()}
    # barra a 55% da altura, 6% de espessura, gema 9%
    yb = T + .55 * (YB - T)
    meia = (yb - YC) * t + W / 2 + .025
    barra = L(); db = ImageDraw.Draw(barra)
    p0, p1 = Dp(.5 - meia, yb - .03), Dp(.5 + meia, yb + .03)
    db.rounded_rectangle([p0[0], p0[1], p1[0], p1[1]], radius=F(.012), fill=255)
    gcen = Dp(.5, yb); gw = F(.09) / 2
    gb = L(); ImageDraw.Draw(gb).polygon([(gcen[0] - gw * .8, gcen[1]), (gcen[0], gcen[1] - gw), (gcen[0] + gw * .8, gcen[1]), (gcen[0], gcen[1] + gw)], fill=255)
    gb_borda = gb.filter(ImageFilter.MaxFilter(21))
    cont = lambda *ms: _uniao(*ms).filter(ImageFilter.MaxFilter(2 * int(F(.013)) + 1))
    # espada atrás
    desenha_espada(k, glow, e)
    # cajado na frente
    k.add(cont(cj["haste"], cj["ouro"], cj["chama"]), Image.new("RGB", (S, S), (10, 14, 40)))
    k.add(cj["haste"].filter(ImageFilter.MaxFilter(2 * int(F(.015)) + 1)), bisel(cj["haste"].filter(ImageFilter.MaxFilter(2 * int(F(.015)) + 1)), OURO, 5))
    k.add(cj["haste"], gradiente_v((128, 86, 52), (106, 68, 40), (80, 50, 28)))
    k.add(cj["ouro"], bisel(cj["ouro"], OURO, 6))
    glow = somar(glow, cj["chama"], (150, 70, 10), 40, 1.6)
    k.brilho(cj["chama"], (255, 140, 40), 16, 1.3)
    k.add(cj["chama"], FOGO); k.add(cj["nucleo"], Image.new("RGB", (S, S), (255, 248, 210)))
    # trançado: acima do cruzamento a espada passa por cima do cajado
    Cx, Cy = Dp(.5, YC)
    u = (math.sin(math.radians(ANG)), -math.cos(math.radians(ANG)))  # sobe pelo cajado
    p = (-u[1], u[0])
    big = S * 2
    corte = L(); ImageDraw.Draw(corte).polygon([(Cx + p[0] * big, Cy + p[1] * big), (Cx - p[0] * big, Cy - p[1] * big),
        (Cx - p[0] * big + u[0] * big, Cy - p[1] * big + u[1] * big), (Cx + p[0] * big + u[0] * big, Cy + p[1] * big + u[1] * big)], fill=255)
    desenha_espada(k, glow, {n: ImageChops.multiply(m, corte) for n, m in e.items()})
    # anel do cajado bem no cruzamento, escondendo a emenda
    hl, ht = wc * .95, wc * .3
    anel = L(); ImageDraw.Draw(anel).polygon([(Cx + p[0] * hl + u[0] * ht, Cy + p[1] * hl + u[1] * ht), (Cx - p[0] * hl + u[0] * ht, Cy - p[1] * hl + u[1] * ht),
        (Cx - p[0] * hl - u[0] * ht, Cy - p[1] * hl - u[1] * ht), (Cx + p[0] * hl - u[0] * ht, Cy + p[1] * hl - u[1] * ht)], fill=255)
    k.add(anel, bisel(anel, OURO, 5), (10, 14, 40), int(F(.008)))
    # barra por cima das duas
    bb = ImageChops.lighter(barra, gb_borda)
    k.add(cont(bb), Image.new("RGB", (S, S), (10, 14, 40)))
    k.add(bb, bisel(bb, OURO, 6))
    k.brilho(gb, (110, 210, 255), 12, 1.4)
    k.add(gb, GEMA)
    return bg, glow, k.rgba()

def _uniao(*ms):
    u = ms[0]
    for m in ms[1:]: u = ImageChops.lighter(u, m)
    return u

def encolhe_n(m): return m

Z = 0.8  # emblema dentro da zona segura do ícone adaptativo (66 de 108)
def encolhe(im, vazio):
    n = int(S * Z); p = (S - n) // 2
    out = Image.new(im.mode, (S, S), vazio); out.paste(im.resize((n, n), Image.LANCZOS), (p, p)); return out

silhueta_notificacao().resize((96, 96), Image.LANCZOS).save(f"{OUT}/notificacao_96.png")
import os as _o
QUAIS = _o.environ.get("QUAIS", "a-sigilo-espada,a-simples-pequeno,b-sigla-A").split(",")
for nome, fn in [x for x in [("a-sigilo-espada", opcao_sigilo_v2), ("a-simples-pequeno", lambda: opcao_sigilo_v2(True)), ("b-sigla-A", opcao_sigla), ("d-fusao", opcao_fusao), ("e-fusao4", opcao_fusao4)] if x[0] in QUAIS]:
    bg, glow, fr = fn()
    if True:
        bg = ImageChops.add(bg, encolhe(glow, (0, 0, 0))); fr = encolhe(fr, (0, 0, 0, 0))
    full = bg.convert("RGBA"); full.alpha_composite(fr)
    full.convert("RGB").crop((S * 18 // 108, S * 18 // 108, S * 90 // 108, S * 90 // 108)).resize((1024, 1024), Image.LANCZOS).save(f"{OUT}/{nome}.png")
    bg.resize((432, 432), Image.LANCZOS).save(f"{OUT}/{nome}_fundo_432.png")
    fr.resize((432, 432), Image.LANCZOS).save(f"{OUT}/{nome}_frente_432.png")
    print(nome)
