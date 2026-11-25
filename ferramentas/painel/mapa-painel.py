# Fundo 2D do Mapa do painel do clã (client/painel.html): o mundo inteiro visto de cima, leve (um JPEG só).
# Mesmas cores do mapa do jogo (godot-prototipo/mapa_mundo.gd): mar raso/fundo, relevo com sombra de encosta, pedra
# nas encostas fortes, areia na praia, rios, estradas de terra e o chão batido das vilas.
# Rodar de novo quando o mundo mudar: python3 ferramentas/painel/mapa-painel.py
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
g = json.load(open(os.path.join(RAIZ, 'godot-prototipo/dados/mundo_grade.json')))
nx, nz, passo, x0, z0 = g['nx'], g['nz'], g['passo'], g['x0'], g['z0']
PX = 2  # px por ponto da grade (4 m): 2 m por px
h = np.array(g['h'], dtype=np.float32).reshape(nz, nx)
terra = np.frombuffer(g['terra'].encode(), dtype=np.uint8).reshape(nz, nx) == ord('0')

def c8(*v): return np.array(v, dtype=np.float32) / 255
def lerp(a, b, t): return a + (b - a) * t[..., None]

mar = (h < 0) | (terra & (h < 0.3))
# sombra e encosta numa altura alisada: a grade crua dá um chuvisco cinza que, de longe, esconde o verde
hs = h.copy()
for _ in range(2): hs = (hs + np.roll(hs, 1, 0) + np.roll(hs, -1, 0) + np.roll(hs, 1, 1) + np.roll(hs, -1, 1)) / 5
gx = (np.roll(hs, -1, 1) - np.roll(hs, 1, 1)) / (2 * passo); gx[:, 0] = gx[:, -1] = 0
gz = (np.roll(hs, -1, 0) - np.roll(hs, 1, 0)) / (2 * passo); gz[0, :] = gz[-1, :] = 0
incl = np.sqrt(gx * gx + gz * gz)
luz = np.clip(0.95 - (gx + gz) * 0.4, 0.68, 1.2)
# o chão baixo começa já no meio do caminho do verde para o oliva: a Vila (chão plano, altura 0) não vira uma mancha
# verde viva no meio do resto (André 2026-11-24: "queria tudo da mesma cor")
cor = lerp(c8(96, 138, 72), c8(150, 156, 108), 0.6 + 0.4 * np.clip(h / 60, 0, 1))
cor = lerp(cor, c8(128, 120, 106), np.where(incl > 0.7, np.clip((incl - 0.7) * 1.5, 0, 0.8), 0))
fundo = h < 0
perto = np.zeros_like(fundo)
for dj in range(-3, 4):
    for di in range(-3, 4):
        perto |= np.roll(np.roll(fundo, dj, 0), di, 1)
praia = (h < 1.2) & perto
cor = np.where(praia[..., None], lerp(c8(212, 194, 148), cor, np.clip(h / 1.2, 0, 1) * 0.4), cor)
cor = cor * luz[..., None]
agua = lerp(c8(92, 172, 190), c8(26, 62, 102), np.clip(-h / 6, 0, 1))
cor = np.where(mar[..., None], agua, cor)
img = Image.fromarray((np.clip(cor, 0, 1) * 255).astype(np.uint8), 'RGB').resize((nx * PX, nz * PX), Image.BICUBIC)

d = ImageDraw.Draw(img, 'RGBA')
k = PX / passo
P = lambda x, z: ((x - x0) * k, (z - z0) * k)
def linha(curva, larg, cor):
    pts = [P(p[0], p[1]) for p in curva]
    if len(pts) > 1: d.line(pts, fill=cor, width=larg, joint='curve')
for r in g.get('rios', []):
    linha(r['curva'], 5, (70, 140, 170, 255))
for camada in range(2):
    for e in g.get('estradas', []):
        trilha = str(e.get('id', '')).startswith('t_')
        larg = (3 if camada == 0 else 1) if trilha else (5 if camada == 0 else 3)
        linha(e.get('curva', []), larg, (92, 70, 42, 255) if camada == 0 else (214, 184, 126, 255))
for l in g.get('lugares', []):
    if l.get('tipo') in ('vila', 'porto', 'posto'):
        (a, b), r = P(l['x'], l['z']), l.get('r', 10) * k * 0.8
        d.ellipse([a - r, b - r, a + r, b + r], fill=(176, 160, 118, 140))
saida = os.path.join(RAIZ, 'client/public/painel-mapa.jpg')
img.save(saida, quality=74, optimize=True, progressive=True)
print(saida, img.size, os.path.getsize(saida) // 1024, 'KB', 'mundo', x0, z0, nx * passo, nz * passo)
