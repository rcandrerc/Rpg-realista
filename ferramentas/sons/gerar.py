"""Sons do jogo Godot (godot-prototipo/sons/).

Duas fontes, as duas livres para uso comercial:
1. Kenney (CC0), do repositório New-Game-Anime-fontes: passos na grama, impactos, pano, moedas, espada.
2. Sons gerados aqui mesmo (próprios, CC0): vento do golpe, dash, magia, explosão, cura, subir de nível,
   batida do coração (vida baixa) e a queda do herói.

Uso (precisa de numpy e ffmpeg):
    python3 ferramentas/sons/gerar.py /caminho/do/New-Game-Anime-fontes
"""
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 44100
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "..", "..", "godot-prototipo", "sons")

# nome no jogo -> arquivo do Kenney (pasta pacotes_cc0/...)
KENNEY = {
    "passo_1": "kenney_impact-sounds/Audio/footstep_grass_000.ogg",
    "passo_2": "kenney_impact-sounds/Audio/footstep_grass_001.ogg",
    "passo_3": "kenney_impact-sounds/Audio/footstep_grass_002.ogg",
    "passo_4": "kenney_impact-sounds/Audio/footstep_grass_003.ogg",
    "acerto_1": "kenney_impact-sounds/Audio/impactPunch_medium_000.ogg",
    "acerto_2": "kenney_impact-sounds/Audio/impactPunch_medium_001.ogg",
    "acerto_3": "kenney_impact-sounds/Audio/impactPunch_medium_002.ogg",
    "acerto_forte_1": "kenney_impact-sounds/Audio/impactPunch_heavy_000.ogg",
    "acerto_forte_2": "kenney_impact-sounds/Audio/impactPunch_heavy_001.ogg",
    "corte_1": "kenney_rpg-audio/Audio/knifeSlice.ogg",
    "corte_2": "kenney_rpg-audio/Audio/knifeSlice2.ogg",
    "pouso_1": "kenney_impact-sounds/Audio/impactSoft_medium_000.ogg",
    "pouso_2": "kenney_impact-sounds/Audio/impactSoft_medium_001.ogg",
    "pouso_forte": "kenney_impact-sounds/Audio/impactSoft_heavy_000.ogg",
    "pano_1": "kenney_rpg-audio/Audio/cloth1.ogg",
    "pano_2": "kenney_rpg-audio/Audio/cloth2.ogg",
    "pano_3": "kenney_rpg-audio/Audio/cloth3.ogg",
    "sacar": "kenney_rpg-audio/Audio/drawKnife1.ogg",
    "moedas": "kenney_rpg-audio/Audio/handleCoins.ogg",
    "apanhar_1": "kenney_impact-sounds/Audio/impactPunch_heavy_002.ogg",
    "apanhar_2": "kenney_impact-sounds/Audio/impactPunch_heavy_003.ogg",
    # profissões (Parte 3): picareta na pedra, machado na madeira, martelo na bigorna
    "minerar_1": "kenney_impact-sounds/Audio/impactMining_000.ogg",
    "minerar_2": "kenney_impact-sounds/Audio/impactMining_001.ogg",
    "minerar_3": "kenney_impact-sounds/Audio/impactMining_002.ogg",
    "lenha_1": "kenney_impact-sounds/Audio/impactWood_heavy_000.ogg",
    "lenha_2": "kenney_impact-sounds/Audio/impactWood_heavy_001.ogg",
    "lenha_3": "kenney_rpg-audio/Audio/chop.ogg",
    "forja_1": "kenney_impact-sounds/Audio/impactMetal_medium_000.ogg",
    "forja_2": "kenney_impact-sounds/Audio/impactMetal_medium_001.ogg",
}


def ruido(n, semente):
    return np.random.default_rng(semente).standard_normal(n)


def passa_baixa(x, corte):
    """Filtro de um polo; corte pode variar no tempo (array)."""
    corte = np.broadcast_to(np.asarray(corte, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.zeros_like(x)
    v = 0.0
    for i in range(len(x)):
        v = (1 - a[i]) * x[i] + a[i] * v
        y[i] = v
    return y


def passa_banda(x, centro, q=1.5):
    """Duas passadas de passa-baixa menos o grave: banda que anda junto com o centro."""
    alto = passa_baixa(x, np.asarray(centro) * (1 + 1 / q))
    baixo = passa_baixa(x, np.asarray(centro) * (1 - 0.5 / q))
    return alto - baixo


def envelope(n, ataque, solta, curva=2.0):
    t = np.arange(n) / SR
    dur = n / SR
    e = np.minimum(1.0, t / max(ataque, 1e-4))
    fim = np.clip((dur - t) / max(solta, 1e-4), 0, 1) ** curva
    return e * fim


def normal(x, pico=0.9):
    m = np.max(np.abs(x))
    return x * (pico / m) if m > 0 else x


def vento(dur, f0, f1, semente, brilho=1.0):
    """Vento de lâmina/dash: ruído em banda que sobe e desce, com corpo no meio."""
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    centro = f0 + (f1 - f0) * np.sin(np.pi * np.clip(t * 1.1, 0, 1)) ** 1.5
    x = passa_banda(ruido(n, semente), centro * brilho, 1.2)
    forma = np.sin(np.pi * np.clip(t, 0, 1)) ** 1.8
    return normal(x * forma)


def golpe(semente):
    return vento(0.26, 500, 2600, semente)


def dash():
    return vento(0.42, 300, 1800, 7, 0.9)


def magia():
    """Conjurar: brilho de sinos subindo com ar por baixo."""
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, f in enumerate([880, 1320, 1760, 2349]):
        atraso = k * 0.06
        e = np.clip((t - atraso) / 0.02, 0, 1) * np.exp(-np.clip(t - atraso, 0, None) * 5)
        x += np.sin(2 * np.pi * f * t * (1 + 0.02 * t)) * e * (0.6 ** k)
    ar = passa_banda(ruido(n, 11), 3000, 1.0) * envelope(n, 0.2, 0.4) * 0.35
    return normal(x + ar, 0.7)


def tiro():
    """Faísca/projétil saindo da mão: estalo curto e assobio que cai."""
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = 1400 * np.exp(-t * 6) + 300
    fase = 2 * np.pi * np.cumsum(f) / SR
    tom = np.sin(fase) * np.exp(-t * 9) * 0.5
    sopro = passa_banda(ruido(n, 13), 2200, 1.0) * np.exp(-t * 14)
    return normal(tom + sopro, 0.8)


def explosao():
    """Explosão de magia: estouro de ruído grave e tom que cai."""
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    ronco = passa_baixa(ruido(n, 17), 400 * np.exp(-t * 2) + 60) * np.exp(-t * 3.2) * 4
    f = 90 * np.exp(-t * 3) + 35
    grave = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4)
    estalo = ruido(n, 19) * np.exp(-t * 60) * 0.5
    return normal(ronco + grave + estalo, 0.9)


def cura():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
        atraso = k * 0.09
        e = np.clip((t - atraso) / 0.01, 0, 1) * np.exp(-np.clip(t - atraso, 0, None) * 3.5)
        x += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * e
    return normal(x, 0.6)


def nivel():
    n = int(1.3 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, f in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.5]):
        atraso = k * 0.1
        e = np.clip((t - atraso) / 0.01, 0, 1) * np.exp(-np.clip(t - atraso, 0, None) * 2.5)
        x += (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4)) * e
    return normal(x, 0.6)


def morte():
    """Monstro caindo: baque grave abafado."""
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    baque = passa_baixa(ruido(n, 23), 220) * np.exp(-t * 8) * 6
    f = 70 * np.exp(-t * 2) + 40
    grave = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    return normal(baque + grave, 0.85)


def coracao():
    """Batida do coração (vida baixa): "tum-tum" grave e abafado, sentido mais que ouvido."""
    n = int(0.62 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for ini, forca, f0 in ((0.0, 1.0, 58.0), (0.2, 0.7, 52.0)):
        tt = np.clip(t - ini, 0, None)
        e = np.where(t >= ini, np.minimum(1.0, tt / 0.006) * np.exp(-tt * 16), 0.0)
        f = f0 * (1 + 0.6 * np.exp(-tt * 40))
        x += np.sin(2 * np.pi * np.cumsum(f) / SR) * e * forca
        x += passa_baixa(ruido(n, 31 + int(ini * 10)), 160) * e * forca * 2.5
    return normal(passa_baixa(x, 300), 0.9)


def queda_heroi():
    """O herói caiu: pancada grave que se arrasta num ronco baixo (a vida apagando)."""
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    baque = passa_baixa(ruido(n, 41), 180) * np.exp(-t * 6) * 5
    f = 55 * np.exp(-t * 0.8) + 28
    ronco = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.4) * 0.8
    ar = passa_banda(ruido(n, 43), 400 * np.exp(-t * 1.2) + 120, 1.4) * envelope(n, 0.05, 1.6) * 0.35
    return normal(baque + ronco + ar, 0.85)


def gravar(nome, x):
    os.makedirs(SAIDA, exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with tempfile.TemporaryDirectory() as tmp:
        w = os.path.join(tmp, "s.wav")
        with wave.open(w, "wb") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(SR)
            f.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w, "-c:a", "libvorbis", "-q:a", "4",
                        os.path.join(SAIDA, nome + ".ogg")], check=True)


def principal():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fontes = os.path.join(sys.argv[1], "pacotes_cc0")
    os.makedirs(SAIDA, exist_ok=True)
    for nome, rel in KENNEY.items():
        shutil.copy(os.path.join(fontes, rel), os.path.join(SAIDA, nome + ".ogg"))
    for i in range(3):
        gravar("golpe_%d" % (i + 1), golpe(i + 1))
    gravar("dash", dash())
    gravar("magia", magia())
    gravar("tiro", tiro())
    gravar("explosao", explosao())
    gravar("cura", cura())
    gravar("nivel", nivel())
    gravar("morte", morte())
    gravar("coracao", coracao())
    gravar("queda_heroi", queda_heroi())
    print("sons em", os.path.normpath(SAIDA))


if __name__ == "__main__":
    principal()
