"""Sons das skills de espada (André 2026-11-12: "som das skills estão péssimos", revamp igual ao do mago).

Antes o corte usava o vento sintetizado (golpe_*), o soco do Kenney (acerto_*) e a explosão sintetizada nas skills.
Agora cada skill tem o seu som, montado em camadas a partir de gravações CC0 do OpenGameArt (uso comercial liberado,
sem crédito obrigatório), guardadas no New-Game-Anime-fontes (sons/opengameart/espada/, lista em LICENCA.txt):
  - StarNinjas: 10 ataques de espada e 10 choques de lâmina (facas raspando) e o desmoronamento (cave in)
  - artisticdude: swishes (13 balanços de arma) e o RPG Sound Pack (swing, sword-unsheathe)
  - rubberduck: 80 CC0 RPG SFX (blade, metal, stones) e 75 CC0 breaking/falling/hit (rocha quebrando, baques)
  - mieki256: earthquake (terremoto)
  - Kenney (CC0), do pacotes_cc0/ do mesmo repositório: impactPunch (o corpo do golpe), impactMetal (o "clang"),
    chop (a carne do corte) e drawKnife (a lâmina raspando)
O grave curto (sub) do Golpe Esmagador e do Pisão é gerado aqui (próprio, CC0).

Cada som tem camadas: o ar (whoosh), o brilho da lâmina ("shiiin"), o corpo (baque) e, nas skills de chão, a pedra
rachando, o tremor e a terra caindo. Tudo mono 44,1 kHz, pico em -1,5 dBFS, OGG.

Uso (precisa de numpy, scipy e ffmpeg):
    python3 ferramentas/sons/espada.py /caminho/do/New-Game-Anime-fontes
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "..", "..", "godot-prototipo", "sons")
FONTES = ""


def abrir(rel):
    """Arquivo do New-Game-Anime-fontes (sons/opengameart/espada/... ou pacotes_cc0/...) em mono float."""
    p = os.path.join(FONTES, rel)
    if not os.path.exists(p):
        p = os.path.join(FONTES, "sons", "opengameart", "espada", rel)
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                       capture_output=True, check=True)
    x = np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
    return x / (np.abs(x).max() + 1e-9)


def passa_alta(x, f, ordem=4):
    return sosfilt(butter(ordem, f, "hp", fs=SR, output="sos"), x)


def passa_baixa(x, f, ordem=4):
    return sosfilt(butter(ordem, f, "lp", fs=SR, output="sos"), x)


def banda(x, f0, f1, ordem=3):
    return sosfilt(butter(ordem, [f0, f1], "bp", fs=SR, output="sos"), x)


def tom(x, k):
    """Toca k vezes mais rápido (k < 1: mais grave e mais longo), como fita."""
    n = int(len(x) / k)
    return np.interp(np.arange(n) * k, np.arange(len(x)), x)


def inicio(x, limiar=0.05):
    """Corta o silêncio do começo (deixa 5 ms antes do ataque)."""
    e = np.abs(x)
    i = int(np.argmax(e > limiar * e.max()))
    return x[max(0, i - int(0.005 * SR)):]


def trecho(x, a, b=None):
    return x[int(a * SR):(int(b * SR) if b is not None else None)]


def fade(x, ent=0.004, sai=0.05):
    x = x.copy()
    a = min(len(x), int(ent * SR))
    b = min(len(x), int(sai * SR))
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b) ** 2
    return x


def cai(x, tau, depois=0.0):
    """Decaimento exponencial (tau em s) a partir de 'depois' s."""
    t = np.arange(len(x)) / SR
    return x * np.where(t < depois, 1.0, np.exp(-(t - depois) / tau))


def db(v):
    return 10 ** (v / 20)


def pico_em(x):
    return int(np.argmax(np.abs(np.convolve(x, np.ones(220) / 220, "same"))))


def mistura(camadas, dur=None):
    """camadas = [(som, segundos de atraso, ganho dB)]"""
    fim = max(int(o * SR) + len(s) for s, o, _ in camadas)
    if dur:
        fim = int(dur * SR)
    y = np.zeros(fim)
    for s, o, g in camadas:
        i = int(o * SR)
        if i >= fim:
            continue
        s = s[: fim - i]
        y[i:i + len(s)] += s * db(g)
    return y


def alinhar(s, alvo_s):
    """Atraso para o pico de s cair em alvo_s segundos."""
    return max(0.0, alvo_s - pico_em(s) / SR)


def sub(dur, f0, f1, tau):
    """Grave curto que desce de f0 a f1 Hz (o "bum" do chão), próprio."""
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (tau * 0.6))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau) * np.minimum(1, t / 0.003)


def cel(x):
    """Como o alto-falante do celular ouve: quase nada abaixo de 400 Hz. Devolve o volume (dB) da janela de
    100 ms mais alta: é o que o André escuta no Poco."""
    y = passa_alta(x, 400, 2)
    w = int(0.1 * SR)
    m = max(np.sqrt(np.mean(y[i:i + w] ** 2)) for i in range(0, max(1, len(y) - w), w // 4))
    return 20 * np.log10(m + 1e-9)


def final(x, alvo=-13.0, pico=-1.0, solta=0.04):
    """Masterização para celular: tira o grave que o alto-falante não toca (só embola), dá presença em 1,5-4,5 kHz,
    acerta o volume pelo que o celular ouve (alvo dB) e segura o pico com um limitador suave."""
    x = passa_alta(x, 45, 2)
    x = x - (1 - db(-5)) * passa_baixa(x, 150, 2)
    x = x + (db(3) - 1) * banda(x, 1500, 4500, 2)
    x = x * db(alvo - cel(x))
    p = db(min(pico, -1.5)) # o OGG passa um pouco do pico na volta: folga de 1,5 dB
    x = np.where(np.abs(x) > 0.6 * p, np.sign(x) * (0.6 * p + 0.4 * p * np.tanh((np.abs(x) - 0.6 * p) / (0.4 * p))), x)
    x = fade(x, 0.002, solta)
    e = np.abs(np.convolve(x, np.ones(441) / 441, "same"))
    ultimo = np.nonzero(e > db(-55))[0]
    if len(ultimo):
        x = fade(x[: min(len(x), ultimo[-1] + int(0.02 * SR))], 0.0, min(solta, 0.03))
    return x


# ---------------------------------------------------------------- camadas
def ar(qual, k=1.0, grave=180):
    """O ar do balanço, grave (artisticdude swishes 1-9): o 'vupt' que dá corpo em fone."""
    s = inicio(abrir("artisticdude-swishes/swish-%d.wav" % qual))
    return passa_alta(tom(s, k), grave)


def sopro(qual, k=1.0):
    """O ar do balanço na faixa do meio (artisticdude swing/swish leves): o 'fuum' que o celular toca."""
    nome = {1: "artisticdude-rpg/swing.wav", 2: "artisticdude-rpg/swing2.wav", 3: "artisticdude-rpg/swing3.wav",
            10: "artisticdude-swishes/swish-10.wav", 11: "artisticdude-swishes/swish-11.wav",
            12: "artisticdude-swishes/swish-12.wav", 13: "artisticdude-swishes/swish-13.wav"}[qual]
    return passa_alta(tom(inicio(abrir(nome)), k), 150)


def brilho(qual, k=1.0, f0=2500, f1=12000):
    """O 'shiiin' da lâmina (StarNinjas, sword.N). Com k < 1 desce para o meio e fica mais pesado."""
    s = inicio(abrir("starninjas-espada/sword.%d.ogg" % qual))
    return banda(tom(s, k), f0, f1)


def lamina(qual, ate=0.09):
    """Ataque do corte entrando (rubberduck blade_0N): o 'tchak'."""
    s = inicio(abrir("rubberduck-rpg/blade_%02d.ogg" % qual))
    return fade(passa_alta(trecho(s, 0, ate), 900), 0.001, 0.03)


def carne(k=0.8, ate=0.16):
    """O 'tuc' de algo cortando algo macio no meio do som (Kenney chop): é o que o celular sente como impacto."""
    s = inicio(abrir("pacotes_cc0/kenney_rpg-audio/Audio/chop.ogg"))
    return fade(trecho(passa_alta(tom(s, k), 200), 0, ate), 0.001, 0.06)


def corpo(forte, qual, k=0.9, corte=2500):
    """O baque no corpo (Kenney impactPunch), mais grave e sem o estalo do soco."""
    s = abrir("pacotes_cc0/kenney_impact-sounds/Audio/impactPunch_%s_%03d.ogg" % ("heavy" if forte else "medium", qual))
    return passa_baixa(tom(inicio(s), k), corte)


def raspa(qual, k=1.0):
    """Metal raspando no meio (Kenney drawKnife): o corpo do 'shiin' no celular."""
    s = inicio(abrir("pacotes_cc0/kenney_rpg-audio/Audio/drawKnife%d.ogg" % qual))
    return passa_alta(tom(s, k), 700)


def anel(qual, k=1.0, depois=0.04):
    """Cauda do metal soando depois do choque (StarNinjas sword_clash), só o agudo."""
    s = inicio(abrir("starninjas-choque/sword_clash.%d.ogg" % qual))
    return passa_alta(trecho(tom(s, k), depois), 3000)


def rocha(qual, ate=0.45):
    s = inicio(abrir("rubberduck-quebrar/bfh1_rock_breaking_%02d.ogg" % qual))
    return fade(trecho(s, 0, ate), 0.001, 0.08)


def tremor(dur, corte=220, tau=0.5):
    s = abrir("mieki256-terremoto/shake.flac")
    s = passa_baixa(trecho(s, 0.05, 0.05 + dur), corte)
    return fade(cai(s, tau), 0.01, 0.2)


def chocalho(dur, tau=0.35):
    """O tremor sacudindo pedrinhas (o agudo do terremoto)."""
    s = abrir("mieki256-terremoto/shake.flac")
    return fade(cai(banda(trecho(s, 0.3, 0.3 + dur), 900, 4500), tau), 0.01, 0.15)


def terra(dur, de=0.5, corte=3200, tau=0.45):
    """Terra e pedrinhas caindo (StarNinjas cave in)."""
    s = abrir("starninjas-desmoronar/cave_in.ogg")
    return fade(cai(passa_baixa(trecho(s, de, de + dur), corte), tau), 0.03, 0.15)


def peso(s, f0=110, f1=750, drive=5.0):
    """Harmônicos do grave (saturado e filtrado): o celular não toca 50 Hz, mas toca o 150-700 Hz que nasce dele."""
    return banda(np.tanh(s / (np.abs(s).max() + 1e-9) * drive), f0, f1, 2)


def junto(s, alvo, ent=0.03):
    """Põe o pico de s em alvo segundos; se o pico vem depois, corta o começo (com entrada suave)."""
    pk = pico_em(s) / SR
    if pk > alvo:
        s = fade(s[int((pk - alvo) * SR):], ent, 0.0)
        return s, 0.0
    return s, alvo - pk


def m2(camadas, dur=None):
    """Como mistura, mas cada camada é (som, pico_em_s, ganho): alinha pelos picos."""
    out = []
    for s, alvo, g in camadas:
        s2, o = junto(s, alvo)
        out.append((s2, o, g))
    return mistura(out, dur)


# ---------------------------------------------------------------- sons
def vento(i):
    """Corte do combo (4 variações): 'fuum' no meio + 'vupt' grave + 'shiin' pesado; pico ~0,09 s depois do começo."""
    a = sopro([1, 2, 3, 11][i], [1.0, 0.96, 1.04, 0.92][i])
    b = ar([1, 4, 8, 9][i], [1.0, 0.95, 1.06, 0.9][i])
    c = fade(trecho(brilho([1, 4, 7, 6][i], [0.62, 0.66, 0.6, 0.64][i], 1200, 9000), 0, 0.3), 0.01, 0.14)
    d = fade(trecho(brilho([2, 3, 8, 9][i], 1.1), 0, 0.2), 0.01, 0.1)
    y = m2([(a, 0.085, 0), (b, 0.08, -7), (c, 0.095, -3), (d, 0.1, -13)])
    return final(y, -14.0, -1.5, 0.06)


def vento_forte(i):
    """4º corte do combo e balanço pesado: ar mais grave e mais longo, brilho mais cheio."""
    a = sopro([2, 1][i], 0.8)
    a2 = sopro([12, 13][i], 0.75)
    b = ar([7, 8][i], 0.8)
    c = fade(trecho(brilho([10, 2][i], 0.55, 1000, 8000), 0, 0.42), 0.02, 0.16)
    y = m2([(a, 0.11, 0), (a2, 0.13, -3), (b, 0.11, -6), (c, 0.12, -2)])
    return final(y, -12.5, -1.5, 0.08)


def corte(i):
    """Lâmina acertando o monstro: 'tchak' no agudo + 'tuc' no meio + baque curto + um fio de brilho."""
    t = lamina([1, 2, 3][i])
    k = carne([0.82, 0.76, 0.88][i])
    c = corpo(False, [0, 1, 3][i], 0.88)
    b = fade(trecho(brilho([3, 5, 8][i], 0.55, 1200, 9000), 0, 0.1), 0.002, 0.06)
    y = mistura([(c, 0.0, -2), (k, 0.0, 0), (t, 0.0, -3), (b, 0.0, -8)])
    return final(cai(y, 0.08, 0.04), -12.0, -1.0, 0.05)


def corte_forte(i):
    """Corte pesado (fim do combo, crítico e skills): o mesmo com baque grave e 'tuc' mais fundo."""
    t = lamina([2, 1][i], 0.11)
    k = carne([0.66, 0.6][i], 0.22)
    c = corpo(True, [0, 1][i], 0.82, 1800)
    g = peso(corpo(True, [0, 1][i], 0.7, 400), 120, 700)
    b = fade(trecho(brilho([9, 10][i], 0.5, 1000, 8000), 0, 0.16), 0.002, 0.1)
    y = mistura([(c, 0.0, -1), (g, 0.0, -9), (k, 0.0, 0), (t, 0.0, -3), (b, 0.004, -7)])
    return final(cai(y, 0.13, 0.06), -11.0, -1.0, 0.08)


def duplo(i):
    """Corte Duplo (um por corte): balanço rápido e o 'shiiin' da lâmina bem na frente, com o metal soando."""
    a = sopro([3, 1][i], 1.08)
    b = fade(trecho(brilho([1, 10][i], [0.78, 0.82][i], 1000, 12000), 0, 0.32), 0.004, 0.14)
    r = raspa(2, [1.0, 1.08][i])
    n = fade(cai(anel([3, 7][i], 1.0), 0.18), 0.002, 0.1)
    y = m2([(a, 0.06, -2), (b, 0.07, 0), (r, 0.07, -6), (n, 0.12, -13)])
    return final(y, -11.5, -1.0, 0.1)


def giro(i):
    """Giro da Lâmina (um por volta): ar grande e redondo passando (duas ondas) e o brilho rodando."""
    a = sopro([10, 11][i], 0.62)
    a2 = sopro([1, 2][i], 0.72)
    b = ar([7, 3][i], 0.7)
    c = fade(trecho(brilho([10, 9][i], 0.58, 1000, 9000), 0, 0.45), 0.04, 0.18)
    y = mistura([(a, 0.0, -2), (b, 0.0, -8), (a2, 0.11, 0), (c, 0.05, -4)])
    t = np.arange(len(y)) / SR
    y *= 0.72 + 0.28 * np.sin(2 * np.pi * 7.5 * t - 1.2) # a lâmina passando perto e longe
    return final(y, -12.0, -1.5, 0.12)


def esmagar():
    """Golpe Esmagador: a espada crava no chão. Bum grave, pedra rachando, metal batendo, tremor e terra caindo."""
    bum = sub(0.55, 95, 42, 0.22)
    c = corpo(True, 2, 0.62, 900)
    k = carne(0.5, 0.3)
    r1 = rocha(1, 0.5)
    r2 = rocha(2, 0.5)
    metal = fade(passa_alta(tom(inicio(abrir("starninjas-choque/sword_clash.1.ogg")), 0.72), 600), 0.001, 0.2)
    clang = fade(tom(inicio(abrir("pacotes_cc0/kenney_impact-sounds/Audio/impactMetal_medium_001.ogg")), 0.7), 0.001, 0.1)
    tr = tremor(1.3, 220, 0.45)
    ch = chocalho(0.9, 0.3)
    tt = terra(1.1, 0.6, 3000, 0.4)
    y = mistura([(bum, 0.0, -5), (peso(bum), 0.0, -5), (c, 0.0, -3), (k, 0.0, -1), (r1, 0.0, 0), (r2, 0.02, -4),
                 (metal, 0.0, -10), (clang, 0.0, -7), (tr, 0.02, -9), (peso(tr, 120, 600, 3), 0.02, -12),
                 (ch, 0.06, -12), (tt, 0.08, -3)])
    return final(y, -11.5, -0.8, 0.25)


def pisao():
    """Pisão Sísmico: o chão racha em volta e treme. Mais tremor e rachadura, sem o metal."""
    bum = sub(0.7, 80, 36, 0.3)
    c = corpo(True, 3, 0.58, 700)
    k = carne(0.45, 0.3)
    r1 = rocha(1, 0.6)
    r3 = rocha(3, 0.45)
    r2 = rocha(2, 0.4)
    tr = tremor(1.8, 230, 0.7)
    ch = chocalho(1.4, 0.5)
    tt = terra(1.6, 0.4, 2600, 0.6)
    y = mistura([(bum, 0.0, -5), (peso(bum, 100, 600), 0.0, -5), (c, 0.0, -4), (k, 0.0, -2), (r1, 0.0, 0),
                 (r3, 0.14, -3), (r2, 0.3, -6), (tr, 0.0, -6), (peso(tr, 120, 600, 3), 0.0, -9),
                 (ch, 0.05, -9), (tt, 0.1, -2)])
    return final(y, -11.5, -0.8, 0.35)


def investida():
    """Investida (o dash): rajada de ar grave e longa com o brilho da lâmina no fim."""
    a = sopro(1, 0.58)
    a2 = sopro(12, 0.55)
    b = ar(7, 0.6)
    c = fade(trecho(brilho(6, 0.6, 1000, 9000), 0, 0.34), 0.06, 0.16)
    y = mistura([(a, 0.0, 0), (a2, 0.05, -3), (b, 0.0, -7), (c, 0.1, -4)])
    return final(y, -12.0, -1.5, 0.12)


def estocada(i):
    """Investida acertando cada inimigo da linha: estocada seca com o 'shiin'."""
    t = lamina([2, 3][i], 0.07)
    k = carne([0.95, 0.9][i], 0.12)
    c = corpo(False, [3, 4][i], 0.95, 2200)
    b = fade(trecho(brilho([3, 2][i], 0.7, 1200, 10000), 0, 0.2), 0.002, 0.12)
    y = mistura([(c, 0.0, -2), (k, 0.0, -1), (t, 0.0, -2), (b, 0.0, -4)])
    return final(cai(y, 0.11, 0.05), -12.0, -1.0, 0.08)


def foco(i):
    """Começo da skill de espada (no lugar do som de magia): a lâmina brilhando, 'shing' curto e baixo."""
    s = inicio(abrir("artisticdude-rpg/sword-unsheathe%s.wav" % ["", "3"][i]))
    s = fade(trecho(banda(tom(s, 0.85), 900, 12000), 0, 0.34), 0.003, 0.15)
    return final(s, -16.0, -3.0, 0.12)


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
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w, "-c:a", "libvorbis", "-q:a", "5",
                        os.path.join(SAIDA, nome + ".ogg")], check=True)


SONS = {
    **{"esp_vento_%d" % (i + 1): (lambda i=i: vento(i)) for i in range(4)},
    **{"esp_vento_forte_%d" % (i + 1): (lambda i=i: vento_forte(i)) for i in range(2)},
    **{"esp_corte_%d" % (i + 1): (lambda i=i: corte(i)) for i in range(3)},
    **{"esp_corte_forte_%d" % (i + 1): (lambda i=i: corte_forte(i)) for i in range(2)},
    **{"esp_duplo_%d" % (i + 1): (lambda i=i: duplo(i)) for i in range(2)},
    **{"esp_giro_%d" % (i + 1): (lambda i=i: giro(i)) for i in range(2)},
    "esp_esmagar": esmagar,
    "esp_pisao": pisao,
    "esp_investida": investida,
    **{"esp_estocada_%d" % (i + 1): (lambda i=i: estocada(i)) for i in range(2)},
    **{"esp_foco_%d" % (i + 1): (lambda i=i: foco(i)) for i in range(2)},
}


def principal():
    global FONTES
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    FONTES = sys.argv[1]
    so = sys.argv[2:]
    for nome, fn in SONS.items():
        if so and nome not in so:
            continue
        gravar(nome, fn())
    print("sons em", os.path.normpath(SAIDA))


if __name__ == "__main__":
    principal()
