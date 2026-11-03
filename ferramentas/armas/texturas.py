# Texturas pintadas da Espada A e do Cajado A (direção de arte, 2026-11-03). Gera PNGs em ferramentas/armas/tex/.
import math, os, random
from PIL import Image, ImageDraw, ImageFilter
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex'); os.makedirs(D, exist_ok=True)
random.seed(7)

# aço: riscos de forja ao longo da lâmina (v = comprimento). Tons de cinza: o shader usa como variação do reflexo.
W, H = 128, 512
im = Image.new('L', (W, H), 200); d = ImageDraw.Draw(im)
for _ in range(260):
    x = random.uniform(0, W); y = random.uniform(0, H); L = random.uniform(30, 220); c = random.randint(150, 245)
    d.line([(x, y), (x + random.uniform(-2, 2), y + L)], fill=c, width=1)
for _ in range(40):  # manchas suaves de têmpera
    x = random.uniform(0, W); y = random.uniform(0, H); r = random.uniform(10, 40)
    d.ellipse([x - r * 0.4, y - r, x + r * 0.4, y + r], fill=random.randint(175, 215))
im = im.filter(ImageFilter.GaussianBlur(0.6)); im.save(os.path.join(D, 'aco.png'))

# runa: sulco escuro com runas azuis claras (canal RGB = cor; o shader usa a luminância como brilho)
W, H = 64, 512
im = Image.new('RGB', (W, H), (18, 30, 62)); d = ImageDraw.Draw(im)
y = 18
while y < H - 30:
    h = random.randint(26, 40); cx = W / 2
    pts = [(cx, y), (cx, y + h)]
    d.line(pts, fill=(140, 220, 255), width=14)
    for _ in range(random.randint(1, 3)):
        yy = y + random.uniform(0.15, 0.85) * h; s = random.choice([-1, 1])
        d.line([(cx, yy), (cx + s * random.uniform(16, 26), yy + random.uniform(-9, 9))], fill=(140, 220, 255), width=10)
    if random.random() < 0.5:
        d.ellipse([cx - 13, y + h + 6, cx + 13, y + h + 30], outline=(140, 220, 255), width=7)
        y += 12
        y += 20
    y += h + 22
glow = im.filter(ImageFilter.GaussianBlur(4))
im = Image.blend(glow, im, 0.7); im.save(os.path.join(D, 'runa.png'))

# cabo: couro azul-escuro com tiras cruzadas (u = volta, v = comprimento)
W, H = 128, 256
im = Image.new('RGB', (W, H), (22, 32, 64)); d = ImageDraw.Draw(im)
passo = 32
for k in range(-H, W + H, passo):
    d.line([(k, 0), (k + H * 0.5, H)], fill=(52, 72, 122), width=9)
    d.line([(k, 0), (k - H * 0.5, H)], fill=(40, 56, 100), width=9)
for k in range(-H, W + H, passo):  # filete dourado entre as tiras
    d.line([(k + 5, 0), (k + 5 + H * 0.5, H)], fill=(150, 112, 50), width=1)
im = im.filter(ImageFilter.GaussianBlur(0.5)); im.save(os.path.join(D, 'cabo.png'))

# madeira escura com veio (u = volta, v = comprimento)
W, H = 128, 512
im = Image.new("RGB", (W, H), (92, 60, 42)); d = ImageDraw.Draw(im)
for _ in range(90):
    x = random.uniform(0, W); c = random.choice([(62, 40, 28), (112, 76, 52), (74, 48, 33), (128, 88, 60)])
    amp = random.uniform(1, 4); fase = random.uniform(0, 6); w = random.randint(1, 3)
    pts = [(x + amp * math.sin(yy / 40.0 + fase), yy) for yy in range(0, H + 8, 8)]
    d.line(pts, fill=c, width=w)
for _ in range(6):  # nós
    x = random.uniform(10, W - 10); y = random.uniform(20, H - 20)
    d.ellipse([x - 6, y - 12, x + 6, y + 12], outline=(34, 22, 16), width=2)
im = im.filter(ImageFilter.GaussianBlur(0.7)); im.save(os.path.join(D, 'madeira.png'))
print('ok', os.listdir(D))
