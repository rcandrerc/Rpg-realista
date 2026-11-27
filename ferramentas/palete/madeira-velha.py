# Madeira velha do palete (André 2026-11-27: "aspecto mais de madeira mesmo com marcas de tempo, envelhecidos").
# Base: old_planks_02 da Poly Haven (CC0). Cada tábua da foto vira uma coluna de 64 px (8 colunas, 512 x 512), sem a
# fresta escura entre elas: no jogo cada tábua do palete pega uma coluna inteira (construcao.gd _mat_palete). Por cima:
# cinza do sol, borda gasta e escura, sujeira nas pontas, rachas no veio e os pregos enferrujados com escorrido
# (onde as tábuas pregam nas 3 vigas: v = 0,083 / 0,5 / 0,917).
# Uso: python3 ferramentas/palete/madeira-velha.py old_planks_02_diff_1k.jpg godot-prototipo/construcao3d/palete_velho_512.jpg
import sys, random
import numpy as np
from PIL import Image, ImageFilter
random.seed(7); np.random.seed(7)
src = Image.open(sys.argv[1]).convert("RGB")
W, H, N = 512, 512, 8
col = W // N
fendas = [22, 167, 321, 467, 611, 757, 900, 1046]  # frestas escuras da foto (1046 = 22 da volta)
a = np.asarray(src, float)
a = np.concatenate([a, a[:, :100]], 1)  # para a última tábua passar da borda
tabuas = []
for i in range(7):
	x0, x1 = fendas[i] + 9, fendas[i + 1] - 9
	tabuas.append(Image.fromarray(a[:, x0:x1].astype(np.uint8)))
tabuas.append(tabuas[2].transpose(Image.FLIP_TOP_BOTTOM))  # 8ª = 3ª de cabeça para baixo
out = np.zeros((H, W, 3), float)
for i, t in enumerate(tabuas):
	t = t.resize((col, H), Image.LANCZOS)
	if i % 2: t = t.transpose(Image.FLIP_LEFT_RIGHT)
	b = np.asarray(t, float)
	# deslocamento no comprimento: cada tábua começa num ponto da foto
	b = np.roll(b, random.randint(0, H), 0)
	# tom de cada tábua: umas mais cinzas (sol), outras mais marrons
	cinza = random.uniform(0.15, 0.45)
	lum = b.mean(2, keepdims=True)
	b = b * (1 - cinza) + lum * cinza * np.array([1.0, 0.98, 0.95])
	b *= random.uniform(0.98, 1.2)
	out[:, i * col:(i + 1) * col] = b
lum = out.mean(2)
m = np.ones((H, W))
xs = np.arange(W) % col
# borda da tábua gasta: escurece nos 6 px de cada lado, com irregularidade
borda = np.minimum(xs, col - 1 - xs).astype(float)
ruido = np.asarray(Image.fromarray((np.random.rand(H // 8, W // 4) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), float) / 255
m *= np.clip(0.55 + borda / 7.0 + ruido * 0.25, 0, 1)
# pontas sujas (encostam no chão e na chuva)
ys = np.arange(H)[:, None] / H
ponta = np.minimum(ys, 1 - ys)
m *= np.clip(0.6 + ponta * 6 + ruido * 0.2, 0, 1)
# manchas de umidade grandes
mancha = np.asarray(Image.fromarray((np.random.rand(10, 16) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(10)), float) / 255
m *= 0.78 + 0.3 * mancha
out *= m[..., None]
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
px = img.load()
def escurece(x, y, f, cor=(0, 0, 0)):
	if 0 <= x < W and 0 <= y < H:
		r, g, b = px[x, y]
		px[x, y] = (int(r * (1 - f) + cor[0] * f), int(g * (1 - f) + cor[1] * f), int(b * (1 - f) + cor[2] * f))
# rachas no veio (de comprido), 1-2 por tábua
for i in range(N):
	for _ in range(random.randint(1, 2)):
		x = i * col + random.randint(10, col - 10)
		y0 = random.randint(0, H - 120); L = random.randint(50, 200)
		for y in range(y0, min(H, y0 + L)):
			if random.random() < 0.06: x += random.choice([-1, 1])
			f = 0.55 * min(1, (y - y0) / 15, (y0 + L - y) / 15)
			escurece(x, y, f); escurece(x + 1, y, f * 0.4)
# pregos enferrujados e escorrido de ferrugem
ferrugem = (92, 48, 26)
for i in range(N):
	for v in (0.083, 0.5, 0.917):
		for u in (0.28, 0.72):
			cx = int(i * col + u * col + random.randint(-2, 2)); cy = int(v * H + random.randint(-3, 3))
			for dy in range(random.randint(14, 34)):  # escorrido para um lado do veio
				for dx in (-1, 0, 1):
					escurece(cx + dx, cy + dy, 0.45 * (1 - dy / 34) * (1 - abs(dx) * 0.4), ferrugem)
			for dx in range(-4, 5):
				for dy in range(-4, 5):
					d = (dx * dx + dy * dy) ** 0.5
					if d <= 3.2: escurece(cx + dx, cy + dy, 0.75 if d < 2.2 else 0.3, (58, 54, 50) if d < 2.2 else ferrugem)
					elif d <= 4.5: escurece(cx + dx, cy + dy, 0.18, ferrugem)
img.save(sys.argv[2], quality=88)
print("ok", img.size)
