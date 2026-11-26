# Escudos da Patente de Guerra (André 2026-11-26): 8 patentes x 2 raças, PNG 128 px (desenho em 4x e reduz).
# Uso: python3 ferramentas/patente/escudos.py  -> godot-prototipo/icones/patente/ e client/public/painel-icones/patente/
import math, os
from PIL import Image, ImageDraw, ImageFilter
S = 512
CORES = {  # fundo, fundo escuro, metal (borda e marcas), brilho
  'chama': ((150, 46, 18), (82, 20, 8), (255, 206, 120), (255, 150, 60)),
  'geada': ((26, 74, 120), (12, 34, 62), (200, 236, 255), (120, 200, 255)),
}
OURO = (255, 214, 90)
def escudo(k=1.0, cx=S/2, cy=S/2):
  w, h = 0.40 * S * k, 0.46 * S * k
  pts = [(cx, cy - h), (cx + w, cy - h * 0.72), (cx + w, cy - h * 0.05)]
  for i in range(1, 20):
    t = i / 20
    pts.append((cx + w * (1 - t) ** 1.2 * math.cos(t * math.pi / 2) ** 0.4, cy - h * 0.05 + (h * 1.05) * math.sin(t * math.pi / 2)))
  pts.append((cx, cy + h))
  esq = [(2 * cx - x, y) for (x, y) in reversed(pts[1:-1])]
  return pts + esq
def chevron(d, cy, cor, larg):
  w = 0.24 * S
  d.line([(S/2 - w, cy + 0.09 * S), (S/2, cy - 0.05 * S), (S/2 + w, cy + 0.09 * S)], fill=cor, width=larg, joint='curve')
def estrela(d, cx, cy, r, cor):
  p = []
  for i in range(10):
    a = -math.pi / 2 + i * math.pi / 5
    rr = r if i % 2 == 0 else r * 0.42
    p.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
  d.polygon(p, fill=cor)
def coroa(d, cy, cor):
  w, h = 0.22 * S, 0.13 * S
  p = [(S/2 - w, cy + h), (S/2 - w, cy - h * 0.4), (S/2 - w * 0.5, cy + h * 0.15), (S/2, cy - h), (S/2 + w * 0.5, cy + h * 0.15), (S/2 + w, cy - h * 0.4), (S/2 + w, cy + h)]
  d.polygon(p, fill=cor)
  d.rectangle([S/2 - w, cy + h, S/2 + w, cy + h * 1.45], fill=cor)
def fazer(raca, i):
  fu, fe, me, br = CORES[raca]
  borda = OURO if i == 7 else me
  img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
  # sombra
  sb = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(sb).polygon(escudo(1.0, S/2, S/2 + 10), fill=(0, 0, 0, 150))
  img.alpha_composite(sb.filter(ImageFilter.GaussianBlur(10)))
  d = ImageDraw.Draw(img)
  d.polygon(escudo(1.0), fill=borda)
  d.polygon(escudo(0.88), fill=fe)
  # degradê de cima para baixo dentro do escudo
  g = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
  for y in range(S):
    t = y / S; c = tuple(int(fu[j] * (1 - t) + fe[j] * t) for j in range(3))
    gd.line([(0, y), (S, y)], fill=c + (255,))
  m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).polygon(escudo(0.84), fill=255)
  img.paste(g, (0, 0), m)
  # reflexo em cima
  rf = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(rf).ellipse([S*0.28, S*0.12, S*0.72, S*0.36], fill=br + (60,))
  img.alpha_composite(rf.filter(ImageFilter.GaussianBlur(18)))
  d = ImageDraw.Draw(img)
  cor = OURO if i >= 6 else me
  L = int(0.055 * S)
  if i == 0:
    d.ellipse([S/2 - 0.05*S, S/2 - 0.05*S, S/2 + 0.05*S, S/2 + 0.05*S], fill=me + (150,))
  elif i <= 3:
    for n in range(i):
      chevron(d, S * 0.40 + n * 0.12 * S - (i - 1) * 0.06 * S, cor, L)
  elif i <= 6:
    n = i - 3
    xs = [S/2] if n == 1 else [S/2 - 0.11*S, S/2 + 0.11*S] if n == 2 else [S/2 - 0.16*S, S/2, S/2 + 0.16*S]
    for k, x in enumerate(xs):
      estrela(d, x, S * (0.42 if n < 3 or k == 1 else 0.47) - (0.03*S if n == 3 and k == 1 else 0), 0.1 * S if n < 3 else 0.085 * S, cor)
    chevron(d, S * 0.62, cor, L)
  else:
    coroa(d, S * 0.42, OURO)
    estrela(d, S/2, S * 0.66, 0.08 * S, OURO)
  d.polygon(escudo(1.0), outline=(0, 0, 0, 120), width=4)
  return img.resize((128, 128), Image.LANCZOS)
raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
for pasta in ['godot-prototipo/icones/patente', 'client/public/painel-icones/patente']:
  os.makedirs(os.path.join(raiz, pasta), exist_ok=True)
  for raca in CORES:
    for i in range(8):
      fazer(raca, i).save(os.path.join(raiz, pasta, f'{raca}_{i}.png'), optimize=True)
print('ok')
