# Textura do TRELLIS sai escura demais para o mundo pintado: clareia, tira o reflexo azul e separa os olhos
# (laranja/amarelo forte) numa textura de brilho. Uso: python3 clarear.py textura.png saida_cor.png saida_brilho.png
import sys
import numpy as np
from PIL import Image, ImageFilter

ent, cor, brilho = sys.argv[1:4]
im = Image.open(ent).convert('RGB'); a = np.asarray(im).astype(float) / 255
hsv = np.asarray(im.convert('HSV')).astype(float) / 255
h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
novo = np.clip(np.power(a, 0.8) * 1.2 + 0.03, 0, 1)
cinza = novo.mean(-1, keepdims=True)
azul = ((h > 190) & (h < 230) & (s > 0.5))[..., None]
novo = np.where(azul, novo * 0.7 + cinza * 0.3, novo)
Image.fromarray((np.clip(novo, 0, 1) * 255).astype(np.uint8)).save(cor)
olhos = Image.fromarray((((h > 18) & (h < 60) & (s > 0.55) & (v > 0.55)) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
Image.fromarray((np.asarray(im).astype(float) * (np.asarray(olhos)[..., None] / 255)).astype(np.uint8)).resize((256, 256)).save(brilho)
