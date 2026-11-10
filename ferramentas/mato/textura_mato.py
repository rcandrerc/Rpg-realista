# Textura do mato (godot-prototipo/mato_capim.png), feita aqui do zero (nada de asset de fora: livre para uso comercial).
# André 2026-11-10: "uns bush fininhos, igual a da foto": muitas folhinhas finas de capim por touceira, desenhadas numa
# carta com transparência (o shader recorta). Duas touceiras lado a lado: esquerda capim fino e cheio, direita capim
# com umas folhas mais largas e pendões (mato de beira). Tons em verde claro/escuro; a cor final vem da touceira (shader).
# Uso: python3 ferramentas/mato/textura_mato.py
import math, random
from PIL import Image, ImageDraw, ImageFilter

S = 4                     # desenha 4x maior e reduz (borda macia)
W, H = 512, 256           # cada touceira 256 x 256
img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def folha(cx, base, alto, larg, curva, cor_pe, cor_ponta, segs=10):
    # folha fina afinando até a ponta, curvando para o lado (curva em fração da altura)
    pts_e, pts_d = [], []
    for i in range(segs + 1):
        t = i / segs
        x = cx + curva * alto * t * t
        y = base - alto * t
        w = larg * (1 - t) ** 0.8
        ang = math.atan2(2 * curva * alto * t, alto) if alto else 0
        nx, ny = math.cos(ang), math.sin(ang)
        pts_e.append((x - nx * w, y - ny * w))
        pts_d.append((x + nx * w, y + ny * w))
    # cor em degradê: um polígono por gomo
    for i in range(segs):
        t = (i + 0.5) / segs
        c = tuple(int(cor_pe[k] + (cor_ponta[k] - cor_pe[k]) * t) for k in range(3)) + (255,)
        d.polygon([pts_e[i], pts_e[i + 1], pts_d[i + 1], pts_d[i]], fill=c)

def tom(r, escuro=False):
    # verdes do jogo (claros, pintadinhos) com uns amarelados de capim seco
    if r.random() < 0.12:
        base = (150, 150, 70)
    else:
        base = (70 + r.randint(-15, 20), 120 + r.randint(-20, 25), 45 + r.randint(-10, 15))
    if escuro:
        base = tuple(int(v * 0.55) for v in base)
    return base

def touceira(x0, semente, largas):
    r = random.Random(semente)
    cx = x0 + 128 * S
    chao = H * S - 2 * S
    n = 170
    # de trás para a frente: as de trás mais escuras (sombra dentro da touceira)
    for i in range(n):
        t = i / n
        dx = r.gauss(0, 34) * S
        alto = r.uniform(0.45, 1.0) * (1.0 - abs(dx) / (150 * S)) * 225 * S
        if alto < 40 * S:
            continue
        curva = r.gauss(0, 0.16) + dx / (260 * S)
        larg = r.uniform(1.0, 2.2) * S
        pe = tom(r, escuro=True)
        ponta = tom(r)
        ponta = tuple(min(255, int(v * (0.75 + 0.45 * t))) for v in ponta)
        folha(cx + dx, chao, alto, larg, curva, pe, ponta)
    if largas:
        for i in range(14):
            dx = r.gauss(0, 30) * S
            alto = r.uniform(0.35, 0.7) * 225 * S
            curva = r.choice([-1, 1]) * r.uniform(0.25, 0.5)
            folha(cx + dx, chao, alto, r.uniform(4.5, 7) * S, curva, tom(r, True), tom(r), 12)
        for i in range(4):  # pendões (capim com semente na ponta)
            dx = r.gauss(0, 26) * S
            alto = r.uniform(0.85, 1.05) * 225 * S
            curva = r.gauss(0, 0.08)
            folha(cx + dx, chao, alto, 0.9 * S, curva, (90, 110, 50), (175, 165, 95))
            tx = cx + dx + curva * alto
            ty = chao - alto
            for k in range(10): # sementinhas soltas dos dois lados da haste, como capim de beira de estrada
                yy = ty + k * 2.6 * S
                lado = (1 if k % 2 else -1) * r.uniform(1.0, 2.6) * S
                d.ellipse([tx + lado - 1.3 * S, yy - 2.2 * S, tx + lado + 1.3 * S, yy + 2.2 * S], fill=(176, 160, 100, 255))

touceira(0, 7, False)
touceira(256 * S, 11, True)
img = img.resize((W, H), Image.LANCZOS)
# cor sangrada nas áreas transparentes (o mipmap não escurece a borda das folhas)
rgb = img.convert('RGB')
a = img.getchannel('A')
cheio = Image.new('RGB', (W, H), (78, 112, 50))
borr = rgb
for _ in range(6):
    borr = borr.filter(ImageFilter.MaxFilter(5))
cheio.paste(borr, (0, 0))
cheio.paste(rgb, (0, 0), a.point(lambda v: 255 if v > 8 else 0))
out = cheio.copy()
out.putalpha(a)
out.save('godot-prototipo/mato_capim.png')
print('ok', out.size)
