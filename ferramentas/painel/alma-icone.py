# Ícone do Fragmento de Alma (Geada e Chama): uma alma de fumaça espiritual, não cristal (André 2026-11-24: "tá
# parecendo com cristal, pode confundir... mais fumaçado"). Mesmo tom do painel (escuro -> cor da raça), feito à mão
# aqui com ruído: núcleo claro, chama de fumaça subindo e fiapos soltos. Sai em godot-prototipo/icones/itens/ (160 px);
# o icones-painel.py copia para o painel. Rodar: python3 ferramentas/painel/alma-icone.py
import os
import numpy as np
from PIL import Image, ImageFilter

RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(RAIZ, 'godot-prototipo/icones/itens/')
N = 640  # desenha grande e reduz para 160 (bordas macias)


def ruido(rng, n, oitavas=5, base=4):
    """ruído de valor suavizado, várias oitavas (0..1)"""
    tot = np.zeros((n, n)); amp = 1.0; soma = 0.0
    for o in range(oitavas):
        g = base * 2 ** o
        grade = rng.random((g + 1, g + 1))
        im = Image.fromarray((grade * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
        tot += np.asarray(im, float) / 255 * amp; soma += amp; amp *= 0.5
    return tot / soma


def alma(escuro, cor, claro, semente):
    rng = np.random.default_rng(semente)
    y, x = np.mgrid[0:N, 0:N] / N  # 0..1, y para baixo
    sobe = np.clip(1 - y, 0, 1)
    # redemoinho: gira o espaço em volta do núcleo (mais forte em cima) e ondula com ruído
    w1, w2 = ruido(rng, N, 5, 3), ruido(rng, N, 5, 3)
    ang = (w1 - 0.5) * 2.2 + sobe * 1.4
    dx, dy = x - 0.5, y - 0.62
    xr = 0.5 + dx * np.cos(ang * 0.35) - dy * np.sin(ang * 0.35)
    yr = 0.62 + dx * np.sin(ang * 0.35) + dy * np.cos(ang * 0.35)
    xd = xr + (w2 - 0.5) * 0.10 * (0.4 + sobe)
    yd = yr
    # forma de alma: bola embaixo + cauda de fumaça que sobe torcendo até a ponta
    bola = np.clip(1 - np.hypot((xd - 0.5) / 0.27, (yd - 0.68) / 0.25), 0, 1)
    t = np.clip((0.70 - yd) / 0.66, 0, 1)  # 0 na bola, 1 na ponta
    cx = 0.5 + 0.16 * np.sin(t * 4.2 - 0.6) * t
    meia = 0.25 * (1 - t) ** 1.0 + 0.006
    cauda = np.clip(1 - np.abs(xd - cx) / meia, 0, 1) * (yd < 0.72) * (yd > 0.03)
    forma = np.maximum(bola, cauda)
    # fumaça em fios: ruído "de crista" (|n - 0.5|) faz filamentos claros
    f = ruido(rng, N, 6, 4)
    fio = 1 - np.clip(np.abs(ruido(rng, N, 5, 5) - 0.5) * 5.5, 0, 1)
    dens = forma ** 0.6 * (0.40 + 0.40 * f + 0.45 * fio)
    # anéis de fumaça soltos em volta (meia-lua que gira com o redemoinho)
    r = np.hypot((xd - 0.5) / 0.38, (yd - 0.60) / 0.40)
    anel = np.exp(-((r - 1) / 0.10) ** 2) * np.clip(np.sin(np.arctan2(yd - 0.6, xd - 0.5) * 1.0 + 2.4 + w1 * 2), 0, 1) ** 1.5
    dens = np.maximum(dens, anel * (0.35 + 0.6 * fio))
    # núcleo: a alma clara no meio da bola
    nuc = np.exp(-(((x - 0.5) / 0.12) ** 2 + ((y - 0.67) / 0.12) ** 2))
    brilho = np.clip(dens * 0.85 + nuc * 1.0, 0, 1)
    E, C, L = (np.array(Image.new('RGB', (1, 1), c).getpixel((0, 0)), float) for c in (escuro, cor, claro))
    b = brilho[..., None]
    rgb = np.where(b < 0.55, E + (C - E) * (b / 0.55), C + (L - C) * ((b - 0.55) / 0.45))
    alfa = np.clip(dens * 2.0 + nuc, 0, 1)
    im = Image.fromarray(np.dstack([rgb, alfa[..., None] * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    halo = Image.fromarray((np.clip(alfa * 0.6, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(N / 24))
    h = Image.new('RGBA', (N, N), tuple(int(v) for v in C) + (0,)); h.putalpha(halo)
    fundo = Image.new('RGBA', (N, N), (0, 0, 0, 0)); fundo.alpha_composite(h); fundo.alpha_composite(im)
    return fundo.resize((160, 160), Image.LANCZOS)


if __name__ == '__main__':
    alma('#081420', '#7fd3ff', '#f2fbff', 7).save(OUT + 'alma_geada.png', optimize=True)
    alma('#1a0e08', '#ff8a4a', '#fff1d8', 11).save(OUT + 'alma_chama.png', optimize=True)
    print('ok', OUT)
