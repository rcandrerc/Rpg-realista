"""Ícones da pescaria (André 2026-11-08), desenhados aqui (próprios): os 8 peixes nas cores do Quimera, o peixe
assado, a vara de pescar (item e profissão Pescador) e o botão Pescar. Saem em godot-prototipo/icones/itens/ e
icones/pintados/ (160x160, com luz, sombra e escamas, no jeito dos outros ícones pintados).
Uso: python3 ferramentas/icone/pesca.py
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

AQUI = os.path.dirname(os.path.abspath(__file__))
ITENS = os.path.join(AQUI, '..', '..', 'godot-prototipo', 'icones', 'itens')
PINT = os.path.join(AQUI, '..', '..', 'godot-prototipo', 'icones', 'pintados')
S = 4  # desenha 4x maior e reduz (borda lisa)
N = 160 * S

def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))
def claro(c, k):
    return mix(c, (255, 255, 255, c[3]), k)
def escuro(c, k):
    return mix(c, (0, 0, 0, c[3]), k)

def gradiente_vertical(w, h, c0, c1):
    g = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=mix(c0, c1, y / max(1, h - 1)))
    return g

def sombra(mascara, desloc=(6, 10), raio=10, forca=110):
    s = mascara.filter(ImageFilter.GaussianBlur(raio * S))
    s = s.point(lambda v: v * forca // 255)
    out = Image.new('RGBA', mascara.size, (20, 14, 8, 0))
    out.putalpha(ImageChops.offset(s, desloc[0] * S, desloc[1] * S))
    return out

def peixe(costas, barriga, gordo=1.0, comprido=1.0, assado=False):
    costas, barriga = hexc(costas), hexc(barriga)
    cx, cy = N * 0.47, N * 0.52
    rx, ry = N * 0.3 * comprido, N * 0.15 * gordo
    # forma: corpo + rabo + barbatanas (máscara), pintada com o gradiente costas -> barriga
    m = Image.new('L', (N, N), 0); d = ImageDraw.Draw(m)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    tx = cx + rx * 0.9
    rabo = [(tx - 6 * S, cy), (tx + N * 0.17, cy - ry * 1.15), (tx + N * 0.13, cy), (tx + N * 0.17, cy + ry * 1.15)]
    d.polygon(rabo, fill=255)
    dorsal = [(cx - rx * 0.3, cy - ry * 0.85), (cx + rx * 0.05, cy - ry * 1.55), (cx + rx * 0.45, cy - ry * 0.75)]
    d.polygon(dorsal, fill=255)
    ventral = [(cx - rx * 0.05, cy + ry * 0.8), (cx + rx * 0.2, cy + ry * 1.35), (cx + rx * 0.45, cy + ry * 0.75)]
    d.polygon(ventral, fill=255)
    if assado:
        costas, barriga = mix(costas, hexc('#8a4a1a'), 0.75), mix(barriga, hexc('#d08a3a'), 0.7)
    corpo = gradiente_vertical(N, N, claro(costas, 0.0), barriga)
    # gradiente só dentro do corpo: costas em cima, barriga embaixo
    g = Image.new('RGBA', (N, N))
    gg = gradiente_vertical(N, int(ry * 2.4), escuro(costas, 0.1), claro(barriga, 0.15))
    g.paste(gg, (0, int(cy - ry * 1.3)))
    g.paste(gradiente_vertical(N, int(cy - ry * 1.3) + 1, escuro(costas, 0.1), escuro(costas, 0.1)), (0, 0))
    g.paste(gradiente_vertical(N, N - int(cy + ry * 1.1), claro(barriga, 0.15), claro(barriga, 0.15)), (0, int(cy + ry * 1.1)))
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    img.paste(g, (0, 0), m)
    d2 = ImageDraw.Draw(img)
    # escamas: arquinhos em fileiras, mais escuros
    esc = escuro(costas, 0.35)[:3] + (90,)
    passo = int(N * 0.045)
    for j, yy in enumerate(range(int(cy - ry * 0.8), int(cy + ry * 0.7), passo)):
        for xx in range(int(cx - rx * 0.45) + (j % 2) * passo // 2, int(cx + rx * 0.85), passo):
            if ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 0.8:
                d2.arc([xx - passo * 0.55, yy - passo * 0.55, xx + passo * 0.55, yy + passo * 0.55], 100, 260, fill=esc, width=S)
    # raios das barbatanas e do rabo
    for k in range(6):
        f = k / 5
        d2.line([(tx + 2 * S, cy), (tx + N * 0.16, cy - ry * 1.1 + f * ry * 2.2)], fill=escuro(costas, 0.3)[:3] + (110,), width=S)
    # opérculo (guelra), olho com brilho, boca
    gx = cx - rx * 0.55
    d2.arc([gx - ry * 0.7, cy - ry * 0.75, gx + ry * 0.3, cy + ry * 0.75], 300, 60, fill=escuro(costas, 0.45)[:3] + (200,), width=2 * S)
    ox, oy, orr = cx - rx * 0.72, cy - ry * 0.25, ry * 0.2
    d2.ellipse([ox - orr, oy - orr, ox + orr, oy + orr], fill=(250, 240, 210, 255) if not assado else (230, 220, 200, 255))
    d2.ellipse([ox - orr * 0.65, oy - orr * 0.65, ox + orr * 0.65, oy + orr * 0.65], fill=(20, 16, 14, 255))
    d2.ellipse([ox - orr * 0.45, oy - orr * 0.55, ox - orr * 0.05, oy - orr * 0.15], fill=(255, 255, 255, 230))
    d2.line([(cx - rx * 0.98, cy + ry * 0.12), (cx - rx * 0.8, cy + ry * 0.18)], fill=escuro(costas, 0.5), width=2 * S)
    if assado:  # marcas da grelha e brilho de gordura
        for k in range(4):
            x0 = cx - rx * 0.3 + k * rx * 0.3
            d2.line([(x0 - ry * 0.5, cy - ry * 0.7), (x0 + ry * 0.4, cy + ry * 0.7)], fill=(50, 22, 8, 210), width=4 * S)
    # brilho (luz de cima à esquerda) e sombreado embaixo
    luz = Image.new('L', (N, N), 0); dl = ImageDraw.Draw(luz)
    dl.ellipse([cx - rx * 0.7, cy - ry * 0.75, cx + rx * 0.3, cy - ry * 0.2], fill=120)
    luz = luz.filter(ImageFilter.GaussianBlur(6 * S))
    img = Image.composite(Image.new('RGBA', (N, N), (255, 255, 255, 255)), img, ImageChops.multiply(luz, m))
    img.putalpha(m)
    # contorno escuro fino
    borda = m.filter(ImageFilter.MaxFilter(2 * S + 1))
    fundo = Image.new('RGBA', (N, N), escuro(costas, 0.7)[:3] + (0,))
    fundo.putalpha(borda)
    base = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    base = Image.alpha_composite(base, sombra(borda))
    base = Image.alpha_composite(base, fundo)
    base = Image.alpha_composite(base, img)
    return base, m

def tabua(img):
    # tábua de madeira por baixo (como a da carne assada)
    t = Image.new('RGBA', (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    poly = [(N * 0.1, N * 0.72), (N * 0.86, N * 0.6), (N * 0.92, N * 0.7), (N * 0.16, N * 0.84)]
    d.polygon(poly, fill=hexc('#b89a72'))
    for k in range(7):
        y = N * 0.66 + k * N * 0.022
        d.line([(N * 0.14, y + N * 0.05), (N * 0.88, y - N * 0.06)], fill=hexc('#9a7c56', 160), width=S)
    d.line(poly[:2], fill=hexc('#e2cfaa'), width=2 * S)
    m = Image.new('L', (N, N), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    base = Image.alpha_composite(Image.new('RGBA', (N, N), (0, 0, 0, 0)), sombra(m, raio=8))
    base = Image.alpha_composite(base, t)
    return Image.alpha_composite(base, img)

def vara():
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    a, b = (N * 0.2, N * 0.86), (N * 0.86, N * 0.12)
    # linha e boia
    pts = [(b[0] + (N * 0.02) * math.sin(t * 3), b[1] + t * N * 0.55) for t in [i / 20 for i in range(21)]]
    d.line(pts, fill=(235, 235, 230, 200), width=S)
    bx, by = pts[-1]
    d.pieslice([bx - 9 * S, by - 9 * S, bx + 9 * S, by + 9 * S], 180, 360, fill=hexc('#e8463a'))
    d.pieslice([bx - 9 * S, by - 9 * S, bx + 9 * S, by + 9 * S], 0, 180, fill=hexc('#f2f1ec'))
    d.line([(bx, by - 9 * S), (bx, by - 15 * S)], fill=hexc('#e8463a'), width=2 * S)
    # vara: madeira afinando, cabo de cortiça, passadores, molinete
    L = math.hypot(b[0] - a[0], b[1] - a[1]); ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L; px, py = -uy, ux
    for i in range(60):
        f0, f1 = i / 60, (i + 1) / 60
        w = (7 - 5 * f0) * S
        c = mix(hexc('#7a5230'), hexc('#5a3a1e'), f0)
        d.line([(a[0] + ux * L * f0, a[1] + uy * L * f0), (a[0] + ux * L * f1, a[1] + uy * L * f1)], fill=c, width=int(w))
    d.line([(a[0] + px * 2 * S, a[1] + py * 2 * S), (b[0] + px * S, b[1] + py * S)], fill=hexc('#a07a50', 180), width=S)  # brilho
    d.line([(a[0], a[1]), (a[0] + ux * L * 0.22, a[1] + uy * L * 0.22)], fill=hexc('#b48c5e'), width=11 * S)
    for k in range(6):
        f = 0.02 + k * 0.035
        d.line([(a[0] + ux * L * f - px * 5 * S, a[1] + uy * L * f - py * 5 * S), (a[0] + ux * L * f + px * 5 * S, a[1] + uy * L * f + py * 5 * S)], fill=hexc('#8e6a42'), width=S)
    for f in [0.4, 0.55, 0.7, 0.84, 0.95]:
        cx, cy = a[0] + ux * L * f - px * 5 * S, a[1] + uy * L * f - py * 5 * S
        d.ellipse([cx - 3 * S, cy - 3 * S, cx + 3 * S, cy + 3 * S], outline=hexc('#9aa2ac'), width=S)
    rx, ry = a[0] + ux * L * 0.27 - px * 13 * S, a[1] + uy * L * 0.27 - py * 13 * S
    d.ellipse([rx - 13 * S, ry - 13 * S, rx + 13 * S, ry + 13 * S], fill=hexc('#7d848c'), outline=hexc('#3a3e44'), width=2 * S)
    d.ellipse([rx - 7 * S, ry - 7 * S, rx + 7 * S, ry + 7 * S], fill=hexc('#b8c0c8'))
    d.line([(rx, ry), (rx + 12 * S, ry - 4 * S)], fill=hexc('#2c2420'), width=3 * S)
    m = img.split()[3]
    base = Image.alpha_composite(Image.new('RGBA', (N, N), (0, 0, 0, 0)), sombra(m, raio=6))
    return Image.alpha_composite(base, img)

def gravar(img, pasta, nome):
    img.resize((160, 160), Image.LANCZOS).save(os.path.join(pasta, nome + '.png'))

CORES = {'lambari': ('#7a8a96', '#d8e2e8', 0.8, 0.9), 'tilapia': ('#5a6a4a', '#b8c4a0', 1.15, 0.9), 'traira': ('#3a2a1a', '#8a7a5a', 0.85, 1.05),
         'sardinha': ('#5a7a9a', '#d0e4f0', 0.75, 0.95), 'robalo': ('#4a5a6a', '#d8dee4', 0.9, 1.05), 'garoupa': ('#6a3a2a', '#c87a5a', 1.2, 1.0),
         'atum': ('#2a4a7a', '#d8e4ee', 1.1, 1.08), 'dourado': ('#c08010', '#ffe070', 1.0, 1.0)}
for k, (c0, c1, gordo, comp) in CORES.items():
    img, _ = peixe(c0, c1, gordo, comp)
    if k == 'dourado':  # brilho dourado em volta (lendário)
        aura = img.split()[3].filter(ImageFilter.GaussianBlur(10 * S)).point(lambda v: min(255, v * 2) * 150 // 255)
        a = Image.new('RGBA', (N, N), (255, 210, 60, 0)); a.putalpha(aura)
        img = Image.alpha_composite(a, img)
    gravar(img, ITENS, k)
img, _ = peixe('#7a8a96', '#d8e2e8', 0.9, 0.95, assado=True)
gravar(tabua(img), ITENS, 'peixe_assado')
def radar():
    # bússola de cobre com o vidro azul, ondas e um peixinho no ponteiro
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    c, r = N / 2, N * 0.36
    d.ellipse([c - r, c - r, c + r, c + r], fill=hexc('#b06a32'))
    d.ellipse([c - r * 0.97, c - r * 0.97, c + r * 0.97, c + r * 0.97], outline=hexc('#e0a060'), width=2 * S)
    vidro = gradiente_vertical(N, N, hexc('#3a8ac0'), hexc('#0e3050'))
    mv = Image.new('L', (N, N), 0); ImageDraw.Draw(mv).ellipse([c - r * 0.8, c - r * 0.8, c + r * 0.8, c + r * 0.8], fill=255)
    img.paste(vidro, (0, 0), mv); d = ImageDraw.Draw(img)
    for k in [0.3, 0.52, 0.74]:
        d.ellipse([c - r * k, c - r * k, c + r * k, c + r * k], outline=(160, 220, 255, 150), width=S)
    d.pieslice([c - r * 0.78, c - r * 0.78, c + r * 0.78, c + r * 0.78], 300, 345, fill=(140, 230, 255, 90))
    fx, fy, t = c + r * 0.38, c - r * 0.3, r * 0.17
    d.ellipse([fx - t, fy - t * 0.55, fx + t, fy + t * 0.55], fill=hexc('#ffd040'))
    d.polygon([(fx + t * 0.8, fy), (fx + t * 1.6, fy - t * 0.6), (fx + t * 1.6, fy + t * 0.6)], fill=hexc('#ffd040'))
    d.ellipse([c - 4 * S, c - 4 * S, c + 4 * S, c + 4 * S], fill=hexc('#e0a060'))
    luz = Image.new('L', (N, N), 0); ImageDraw.Draw(luz).ellipse([c - r * 0.6, c - r * 0.75, c + r * 0.1, c - r * 0.3], fill=90)
    luz = luz.filter(ImageFilter.GaussianBlur(5 * S))
    img = Image.composite(Image.new('RGBA', (N, N), (255, 255, 255, 255)), img, ImageChops.multiply(luz, mv))
    m = Image.new('L', (N, N), 0); ImageDraw.Draw(m).ellipse([c - r, c - r, c + r, c + r], fill=255)
    img.putalpha(m)
    base = Image.alpha_composite(Image.new('RGBA', (N, N), (0, 0, 0, 0)), sombra(m, raio=6))
    return Image.alpha_composite(base, img)

gravar(radar(), ITENS, 'radar_pesca')
v = vara()
gravar(v, ITENS, 'vara')
gravar(v, PINT, 'pf_pes')
gravar(v, PINT, 'pescar')
print('ok')
