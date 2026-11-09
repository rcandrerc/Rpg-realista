# Mapa de normais das ondinhas da água (agua.gdshader): ruído periódico (emenda sem costura) feito aqui, sem asset de fora.
# Espectro em lei de potência com mais força numa direção (vento), alturas -> normais. Saída: godot-prototipo/agua_ondas.png
import numpy as np
from PIL import Image
N = 256
rng = np.random.default_rng(7)
k = np.fft.fftfreq(N) * N
kx, ky = np.meshgrid(k, k)
kk = np.sqrt(kx ** 2 + ky ** 2)
kk[0, 0] = 1
amp = 1.0 / kk ** 1.9
amp *= np.exp(-(kk / 48.0) ** 2)  # sem chiado fino
amp *= 0.55 + 0.45 * np.abs(kx / kk)  # vento ao longo de x: cristas mais compridas
amp[kk < 2] = 0
fase = rng.uniform(0, 2 * np.pi, (N, N))
h = np.real(np.fft.ifft2(amp * np.exp(1j * fase)))
h = (h - h.min()) / (h.max() - h.min())
gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * N * 0.06
gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * N * 0.06
n = np.stack([-gx, -gy, np.ones_like(h)], -1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)
img = ((n * 0.5 + 0.5) * 255).round().astype(np.uint8)
Image.fromarray(img, 'RGB').save('godot-prototipo/agua_ondas.png', optimize=True)
print('ok', img[..., 0].std(), img[..., 1].std())
