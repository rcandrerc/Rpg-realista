# uso: python3 previa.py <pasta> <saida.jpg>
import sys
from PIL import Image, ImageDraw, ImageFont
O, SAIDA = sys.argv[1], sys.argv[2]
FT = "/home/user/rpg-realista/godot-prototipo/fontes/AlegreyaSans-Bold.ttf"
F = ImageFont.truetype(FT, 28); F2 = ImageFont.truetype(FT, 42)
def adaptativo(nome):
    bg = Image.open(f"{O}/{nome}_fundo_432.png").convert("RGBA").resize((1080, 1080), Image.LANCZOS)
    fr = Image.open(f"{O}/{nome}_frente_432.png").convert("RGBA").resize((1080, 1080), Image.LANCZOS)
    bg.alpha_composite(fr)
    return bg.crop((180, 180, 900, 900))  # 72 dos 108 dp ficam visíveis
def mascara(im, tipo, t):
    im = im.resize((t * 4, t * 4), Image.LANCZOS)
    m = Image.new("L", (t * 4, t * 4), 0); d = ImageDraw.Draw(m)
    if tipo == "circulo": d.ellipse([0, 0, t * 4 - 1, t * 4 - 1], fill=255)
    else: d.rounded_rectangle([0, 0, t * 4 - 1, t * 4 - 1], radius=t * 4 * .28, fill=255)
    im.putalpha(m); return im.resize((t, t), Image.LANCZOS)
linhas = [("a-sigilo-espada", "a-simples-pequeno", "A · Sigilo + Espada A (recomendada)"), ("b-sigla-A", "b-sigla-A", "B · Sigla A")]
W, H = 1800, 1240
tela = Image.new("RGB", (W, H))
dd = ImageDraw.Draw(tela)
for y in range(H): dd.line([(0, y), (W, y)], fill=(int(40 + 60 * y / H), int(70 + 40 * y / H), int(110 - 20 * y / H)))
d = ImageDraw.Draw(tela)
for i, (n, pequeno, rot) in enumerate(linhas):
    y0 = 40 + i * 560
    ad = adaptativo(n); adp = adaptativo(pequeno)
    big = mascara(ad, "quadrado", 400); tela.paste(big, (60, y0), big)
    d.text((500, y0 + 10), rot, font=F2, fill=(255, 255, 255))
    x = 500
    for tipo, t in [("quadrado", 150), ("circulo", 150), ("quadrado", 96), ("circulo", 64)]:
        ic = mascara(ad, tipo, t); tela.paste(ic, (x, y0 + 90 + (150 - t) // 2), ic)
        d.text((x + t // 2, y0 + 270), "Aethra", font=F, fill=(255, 255, 255), anchor="mm"); d.text((x + t // 2, y0 + 305), f"{t} px", font=F, fill=(200, 215, 235), anchor="mm")
        x += t + 60
    for t in (48, 32):
        ic = mascara(adp, "circulo", t); tela.paste(ic, (x, y0 + 90 + (150 - t) // 2), ic)
        d.text((x + t // 2, y0 + 305), f"{t} px", font=F, fill=(200, 215, 235), anchor="mm"); x += t + 60
    if pequeno != n:
        d.text((500, y0 + 360), "48 e 32 px: versão só com anel e espada", font=F, fill=(220, 230, 245))
# barra de notificação com a silhueta branca
nt = Image.open(f"{O}/notificacao_96.png").convert("RGBA")
y0 = 1130
d.rounded_rectangle([60, y0 - 20, 1000, y0 + 80], radius=24, fill=(30, 32, 40))
for t, x in [(48, 90), (32, 170)]:
    ic = nt.resize((t, t), Image.LANCZOS); tela.paste(ic, (x, y0 + 30 - t // 2), ic)
d.text((240, y0 + 30), "ícone de notificação (silhueta branca da Espada A)", font=F, fill=(230, 230, 235), anchor="lm")
tela.save(SAIDA, quality=92)
