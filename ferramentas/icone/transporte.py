"""Ícones da FASE 1 (packs e transportes, André 2026-11-09), desenhados aqui (próprios): o pack (caixote com faixa),
o galão de combustível, o carrinho de carga, o barquinho e o navio mercante. Saem em godot-prototipo/icones/itens/
(160x160, madeira com veio, luz, sombra e contorno, no jeito dos outros ícones pintados).
Uso: python3 ferramentas/icone/transporte.py
"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

AQUI = os.path.dirname(os.path.abspath(__file__))
ITENS = os.path.join(AQUI, '..', '..', 'godot-prototipo', 'icones', 'itens')
S = 4
N = 160 * S

def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))
def escuro(c, k): return mix(c, (0, 0, 0, c[3]), k)
def claro(c, k): return mix(c, (255, 255, 255, c[3]), k)

def madeira(cor, vertical=False, semente=1):
    """placa com veio de madeira (linhas onduladas mais escuras e nós)"""
    rnd = random.Random(semente)
    c = hexc(cor)
    img = Image.new('RGBA', (N, N), c); d = ImageDraw.Draw(img)
    for k in range(70):
        y0 = rnd.uniform(0, N); amp = rnd.uniform(2, 7) * S; fase = rnd.uniform(0, 6.28); tom = rnd.uniform(0.08, 0.3)
        pts = [(x, y0 + math.sin(x / (40 * S) + fase) * amp) for x in range(0, N + 8 * S, 8 * S)]
        if vertical: pts = [(p[1], p[0]) for p in pts]
        d.line(pts, fill=escuro(c, tom)[:3] + (150,), width=max(1, int(rnd.uniform(0.6, 1.6) * S)))
    for k in range(4):
        x, y, r = rnd.uniform(0, N), rnd.uniform(0, N), rnd.uniform(3, 6) * S
        d.ellipse([x - r * 1.6, y - r, x + r * 1.6, y + r], outline=escuro(c, 0.45), width=S)
    return img.filter(ImageFilter.GaussianBlur(0.6 * S))

def metal(cor):
    c = hexc(cor)
    g = Image.new('RGBA', (N, N)); d = ImageDraw.Draw(g)
    for y in range(N):
        t = y / N
        d.line([(0, y), (N, y)], fill=claro(c, 0.35 * (1 - t)) if t < 0.5 else escuro(c, 0.4 * (t - 0.5)))
    return g

def acabar(cor_mascaras):
    """junta as partes (imagem, máscara), põe contorno escuro, sombra no chão e luz de cima à esquerda"""
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0)); tudo = Image.new('L', (N, N), 0)
    for parte, m in cor_mascaras:
        img.paste(parte, (0, 0), m); tudo = ImageChops.lighter(tudo, m)
    luz = Image.new('L', (N, N), 0); ImageDraw.Draw(luz).ellipse([N * 0.05, N * 0.02, N * 0.7, N * 0.5], fill=70)
    luz = luz.filter(ImageFilter.GaussianBlur(18 * S))
    img = Image.composite(Image.new('RGBA', (N, N), (255, 245, 220, 255)), img, ImageChops.multiply(luz, tudo))
    img.putalpha(tudo)
    borda = tudo.filter(ImageFilter.MaxFilter(3 * S + 1))
    contorno = Image.new('RGBA', (N, N), (28, 18, 10, 0)); contorno.putalpha(borda)
    s = borda.filter(ImageFilter.GaussianBlur(9 * S)).point(lambda v: v * 100 // 255)
    sombra = Image.new('RGBA', (N, N), (20, 14, 8, 0)); sombra.putalpha(ImageChops.offset(s, 5 * S, 9 * S))
    base = Image.alpha_composite(Image.new('RGBA', (N, N), (0, 0, 0, 0)), sombra)
    base = Image.alpha_composite(base, contorno)
    return Image.alpha_composite(base, img)

def mascara(desenho):
    m = Image.new('L', (N, N), 0); desenho(ImageDraw.Draw(m)); return m

def pack(cor='#c9463d'):
    corpo = mascara(lambda d: d.rectangle([N * 0.18, N * 0.3, N * 0.82, N * 0.84], fill=255))
    tampa = mascara(lambda d: d.polygon([(N * 0.18, N * 0.3), (N * 0.32, N * 0.18), (N * 0.92, N * 0.18), (N * 0.82, N * 0.3)], fill=255))
    lado = mascara(lambda d: d.polygon([(N * 0.82, N * 0.3), (N * 0.92, N * 0.18), (N * 0.92, N * 0.72), (N * 0.82, N * 0.84)], fill=255))
    faixa = mascara(lambda d: d.rectangle([N * 0.18, N * 0.42, N * 0.82, N * 0.56], fill=255))
    tabuas = madeira('#a0703a', semente=3); dt = ImageDraw.Draw(tabuas)
    for x in (0.39, 0.61): dt.line([(N * x, N * 0.3), (N * x, N * 0.84)], fill=hexc('#4a2c14'), width=3 * S)
    pano = Image.new('RGBA', (N, N), hexc(cor)); dp = ImageDraw.Draw(pano)
    for k in range(0, N, 5 * S): dp.line([(k, 0), (k - 30 * S, N)], fill=escuro(hexc(cor), 0.25)[:3] + (120,), width=S)
    return acabar([(tabuas, corpo), (madeira('#b88850', semente=4), tampa), (madeira('#7a5028', vertical=True, semente=5), lado), (pano, faixa)])

def galao():
    corpo = mascara(lambda d: d.rounded_rectangle([N * 0.22, N * 0.24, N * 0.78, N * 0.88], radius=10 * S, fill=255))
    alca = mascara(lambda d: (d.rounded_rectangle([N * 0.3, N * 0.1, N * 0.62, N * 0.3], radius=8 * S, fill=255), d.rounded_rectangle([N * 0.37, N * 0.16, N * 0.55, N * 0.24], radius=4 * S, fill=0)))
    bico = mascara(lambda d: d.polygon([(N * 0.66, N * 0.26), (N * 0.8, N * 0.08), (N * 0.88, N * 0.14), (N * 0.76, N * 0.3)], fill=255))
    vermelho = metal('#b8321e'); dv = ImageDraw.Draw(vermelho)
    dv.line([(N * 0.3, N * 0.4), (N * 0.7, N * 0.76)], fill=hexc('#7a1e10'), width=4 * S)
    dv.line([(N * 0.7, N * 0.4), (N * 0.3, N * 0.76)], fill=hexc('#7a1e10'), width=4 * S)
    return acabar([(vermelho, corpo), (metal('#8a2414'), alca), (metal('#9a9a92'), bico)])

def roda(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)

def carrinho():
    cacamba = mascara(lambda d: d.polygon([(N * 0.1, N * 0.38), (N * 0.86, N * 0.38), (N * 0.8, N * 0.66), (N * 0.16, N * 0.66)], fill=255))
    motor = mascara(lambda d: d.rectangle([N * 0.62, N * 0.22, N * 0.84, N * 0.4], fill=255))
    rodas = mascara(lambda d: (roda(d, N * 0.3, N * 0.7, N * 0.15), roda(d, N * 0.68, N * 0.7, N * 0.15)))
    miolo = mascara(lambda d: (roda(d, N * 0.3, N * 0.7, N * 0.1), roda(d, N * 0.68, N * 0.7, N * 0.1)))
    caixas = mascara(lambda d: (d.rectangle([N * 0.18, N * 0.2, N * 0.38, N * 0.4], fill=255), d.rectangle([N * 0.4, N * 0.24, N * 0.6, N * 0.4], fill=255)))
    pk = madeira('#c08a4a', semente=8); dk = ImageDraw.Draw(pk)
    dk.rectangle([N * 0.18, N * 0.27, N * 0.38, N * 0.31], fill=hexc('#c9463d')); dk.rectangle([N * 0.4, N * 0.3, N * 0.6, N * 0.34], fill=hexc('#4a7aa8'))
    tab = madeira('#9a6a38', semente=6); dt = ImageDraw.Draw(tab)
    for y in (0.47, 0.56): dt.line([(N * 0.12, N * y), (N * 0.84, N * y)], fill=hexc('#4a2c14'), width=2 * S)
    return acabar([(pk, caixas), (tab, cacamba), (metal('#5a5a58'), motor), (metal('#3a3a3a'), rodas), (madeira('#7a5028', semente=7), miolo)])

def barquinho():
    casco = mascara(lambda d: d.polygon([(N * 0.06, N * 0.5), (N * 0.94, N * 0.42), (N * 0.8, N * 0.72), (N * 0.22, N * 0.74)], fill=255))
    remo = mascara(lambda d: (d.line([(N * 0.2, N * 0.2), (N * 0.62, N * 0.86)], fill=255, width=5 * S), d.ellipse([N * 0.54, N * 0.74, N * 0.7, N * 0.94], fill=255)))
    agua = mascara(lambda d: d.ellipse([N * 0.02, N * 0.66, N * 0.98, N * 0.9], fill=255))
    azul = Image.new('RGBA', (N, N), hexc('#3a7ab0')); da = ImageDraw.Draw(azul)
    for k in range(6): da.arc([N * (0.1 + k * 0.13), N * 0.72, N * (0.24 + k * 0.13), N * 0.82], 180, 360, fill=hexc('#bfe4ff'), width=2 * S)
    tab = madeira('#a87444', semente=11); dt = ImageDraw.Draw(tab)
    for y in (0.56, 0.64): dt.line([(N * 0.1, N * y), (N * 0.9, N * y - N * 0.04)], fill=hexc('#4a2c14'), width=2 * S)
    return acabar([(azul, agua), (tab, casco), (madeira('#7a5028', semente=12), remo)])

def navio():
    agua = mascara(lambda d: d.ellipse([N * 0.0, N * 0.72, N * 1.0, N * 0.96], fill=255))
    casco = mascara(lambda d: d.polygon([(N * 0.04, N * 0.58), (N * 0.96, N * 0.54), (N * 0.84, N * 0.82), (N * 0.16, N * 0.84)], fill=255))
    mastro = mascara(lambda d: d.rectangle([N * 0.48, N * 0.06, N * 0.52, N * 0.6], fill=255))
    vela = mascara(lambda d: d.polygon([(N * 0.24, N * 0.12), (N * 0.76, N * 0.1), (N * 0.8, N * 0.5), (N * 0.2, N * 0.52)], fill=255))
    pano = Image.new('RGBA', (N, N), hexc('#efe6cf')); dp = ImageDraw.Draw(pano)
    for k in range(0, N, 6 * S): dp.line([(0, k), (N, k + 4 * S)], fill=hexc('#d8ccb0'), width=S)
    dp.ellipse([N * 0.4, N * 0.22, N * 0.6, N * 0.4], outline=hexc('#c9463d'), width=4 * S)
    azul = Image.new('RGBA', (N, N), hexc('#2f6a9a'))
    tab = madeira('#7a4a2a', semente=21); dt = ImageDraw.Draw(tab)
    for y in (0.64, 0.72): dt.line([(N * 0.1, N * y), (N * 0.9, N * y - N * 0.03)], fill=hexc('#3a1e0c'), width=2 * S)
    return acabar([(azul, agua), (pano, vela), (madeira('#5a3a20', vertical=True, semente=22), mastro), (tab, casco)])

if __name__ == '__main__':
    os.makedirs(ITENS, exist_ok=True)
    for nome, fn in [('pack', pack), ('galao', galao), ('carrinho', carrinho), ('barquinho', barquinho), ('navio', navio)]:
        fn().resize((160, 160), Image.LANCZOS).save(os.path.join(ITENS, nome + '.png'))
        print('ok', nome)
