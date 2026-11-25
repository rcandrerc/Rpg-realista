# Casa o desenho da Vila (painel-vila.jpg, o minimapa do jogo) com o fundo do mundo (painel-mapa.jpg), para o Mapa do
# painel ficar todo de um jeito só (André 2026-11-24: "um quadradão escuro e o resto homogêneo, queria tudo da mesma cor"):
# a mata fechada e a pedra escura do minimapa ficam transparentes (aparece o mundo por baixo) e o verde vivo puxa para o
# tom do mundo. Sai client/public/painel-vila.png. Rodar depois de vila-painel.mjs.
import os
import numpy as np
from PIL import Image, ImageFilter
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
v = np.array(Image.open(os.path.join(RAIZ, 'client/public/painel-vila.jpg')).convert('RGB')).astype(np.float32)
lum = v @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
a = np.clip((lum - 70) / 40, 0, 1)  # mata fechada e pedra escura somem; chão, trilha e água ficam
mx, mn = v.max(2), v.min(2); sat = (mx - mn) / np.maximum(mx, 1)
a *= np.clip((sat - 0.12) / 0.1, 0, 1)  # a encosta cinza da montanha (quadrada no minimapa) também: o mundo já tem a dele
a = np.array(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
borda = np.ones_like(a); n = a.shape[0]; b = int(n * 0.08)
r = np.minimum.reduce([np.arange(n)[None, :].repeat(n, 0), np.arange(n)[::-1][None, :].repeat(n, 0), np.arange(n)[:, None].repeat(n, 1), np.arange(n)[::-1][:, None].repeat(n, 1)])
borda = np.clip(r / b, 0, 1)
a *= borda
# o verde vivo do minimapa puxa para o tom do mundo (oliva acinzentado): meio caminho para o cinza da mesma luz
cinza = lum[..., None].repeat(3, 2)
cor = v * 0.55 + cinza * 0.45
cor = cor * np.array([1.04, 1.0, 0.92], dtype=np.float32)  # um pouco mais quente, como o mundo
out = np.dstack([np.clip(cor, 0, 255), a * 255]).astype(np.uint8)
saida = os.path.join(RAIZ, 'client/public/painel-vila.png')
Image.fromarray(out, 'RGBA').resize((512, 512), Image.LANCZOS).save(saida, optimize=True)
print(saida, os.path.getsize(saida) // 1024, 'KB')
