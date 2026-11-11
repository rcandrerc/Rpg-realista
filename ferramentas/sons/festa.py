"""Sons de comemoração (André 2026-11-11: "preciso gerar endorfina no jogo"), sintetizados aqui (próprios, CC0, sem
gravação de terceiros). Uso (precisa de numpy e ffmpeg): python3 ferramentas/sons/festa.py

festa_nivel   subiu de nível: baque grave, arpejo de sino subindo e acorde maior que brilha (2,4 s)
festa_missao  missão cumprida: fanfarra curta "ta-ta-tááá" e acorde (2,6 s)
festa_sucesso reforço/evoluir deu certo: duas notas subindo e brilho (1,2 s)
festa_falha   reforço/evoluir falhou: duas notas descendo, abafadas (0,8 s)
festa_libera  coisa nova liberada: glissando de harpa subindo e cintilar (1,4 s)
"""
import numpy as np, wave, subprocess, os, tempfile
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'godot-prototipo', 'sons')
TMP = tempfile.mkdtemp()
SR = 44100
rng = np.random.default_rng(11)

def nota(n):  # número MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)

def sino(f, dur, d=0.6, brilho=1.0):
    # sino/celesta: parciais um pouco desafinadas, as altas morrem antes
    n = int(SR * dur); t = np.arange(n) / SR; x = np.zeros(n)
    for k, (m, a) in enumerate([(1, 1), (2.0, 0.45 * brilho), (3.01, 0.22 * brilho), (4.2, 0.12 * brilho), (5.4, 0.06 * brilho)]):
        x += a * np.sin(2 * np.pi * f * m * t + k) * np.exp(-t / (d / (1 + k * 0.7)))
    return x * np.minimum(1, t / 0.004)

def metal(f, dur, a=0.03, d=0.5):
    # sopro de metal (trompete simples): dente de serra suave com vibrato e ataque curto
    n = int(SR * dur); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.25)
    fase = 2 * np.pi * np.cumsum(f * vib) / SR
    x = sum(np.sin(fase * k) / k ** 1.15 for k in range(1, 9))
    e = np.minimum(1, t / a) * (0.75 + 0.25 * np.exp(-t / 0.08)) * np.minimum(1, (dur - t) / max(0.02, d * 0.3))
    return x * np.clip(e, 0, 1)

def baque(dur=0.6):
    n = int(SR * dur); t = np.arange(n) / SR; f = 45 + 70 * np.exp(-t / 0.06)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.18)

def cintilar(dur, n_pts=40, f0=2500, f1=7000, t0=0.0):
    n = int(SR * dur); x = np.zeros(n)
    for _ in range(n_pts):
        i = int(rng.uniform(t0, dur - 0.15) * SR); f = rng.uniform(f0, f1); m = int(SR * 0.12); tt = np.arange(m) / SR
        x[i:i + m] += rng.uniform(0.3, 1) * np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.03)
    return x

def eco(x, mix=0.25):
    # reverb barato: 4 linhas de atraso com realimentação (cabe no tamanho original + cauda)
    y = np.concatenate([x, np.zeros(int(SR * 0.6))])
    out = y.copy()
    for ms, g in [(53, 0.5), (79, 0.45), (113, 0.4), (151, 0.35)]:
        dd = int(SR * ms / 1000); z = y.copy()
        for i in range(dd, len(z)):
            z[i] += g * z[i - dd]
        out += mix * z / 4
    return out

def por(x, alvo, em):
    i = int(SR * em); alvo[i:i + len(x)] += x[:max(0, len(alvo) - i)]

def salvar(nome, x, v=0.85):
    x = x / np.max(np.abs(x)) * v
    fim = int(SR * 0.04); x[-fim:] *= np.linspace(1, 0, fim)
    d = (x * 32767).astype(np.int16)
    with wave.open(os.path.join(TMP, nome + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(TMP, nome + '.wav'), '-c:a', 'libvorbis', '-q:a', '5',
                    os.path.join(SAIDA, nome + '.ogg')], check=True)

# subiu de nível: baque, arpejo Dó-Mi-Sol-Dó-Mi em sino + metal e o acorde final segurando com cintilar
x = np.zeros(int(SR * 2.4))
por(baque(0.7) * 0.9, x, 0.0)
for i, n in enumerate([72, 76, 79, 84, 88]):
    por(sino(nota(n), 1.6, 0.5) * 0.55, x, 0.05 + i * 0.085)
for n in [60, 64, 67, 72]:
    por(metal(nota(n), 1.8, 0.05, 1.6) * 0.16, x, 0.48)
for n in [84, 88, 91]:
    por(sino(nota(n), 1.9, 0.9, 0.6) * 0.35, x, 0.48)
x += cintilar(2.4, 34, 3000, 8000, 0.45) * 0.12
salvar('festa_nivel', eco(x)[:int(SR * 2.4)])

# missão cumprida: ta-ta-tááá (Sol Sol Dó) e acorde Dó-Mi-Sol subindo para o Dó alto
x = np.zeros(int(SR * 2.6))
por(metal(nota(67), 0.13, 0.01, 0.1) * 0.5, x, 0.0)
por(metal(nota(67), 0.13, 0.01, 0.1) * 0.5, x, 0.16)
por(metal(nota(72), 0.5, 0.012, 0.5) * 0.55, x, 0.32)
por(baque(0.6) * 0.7, x, 0.86)
for n in [60, 64, 67, 72, 76]:
    por(metal(nota(n), 1.6, 0.03, 1.5) * 0.2, x, 0.86)
for i, n in enumerate([79, 84, 88, 91]):
    por(sino(nota(n), 1.5, 0.6) * 0.3, x, 0.86 + i * 0.07)
x += cintilar(2.6, 26, 3000, 8000, 0.9) * 0.1
salvar('festa_missao', eco(x)[:int(SR * 2.6)])

# deu certo: Sol -> Dó alto (sino) e um brilho
x = np.zeros(int(SR * 1.2))
por(sino(nota(79), 0.9, 0.35) * 0.6, x, 0.0)
por(sino(nota(84), 1.1, 0.6) * 0.75, x, 0.09)
por(sino(nota(91), 1.0, 0.5, 0.5) * 0.3, x, 0.09)
x += cintilar(1.2, 14, 3500, 8000, 0.1) * 0.12
salvar('festa_sucesso', eco(x, 0.2)[:int(SR * 1.2)], 0.8)

# falhou: Mi bemol -> Si (descendo), metal abafado e um baquezinho
x = np.zeros(int(SR * 0.8))
m1 = metal(nota(63), 0.22, 0.01, 0.2); m2 = metal(nota(59), 0.5, 0.01, 0.5)
k = np.exp(-np.arange(800) / 120.0); k /= k.sum()  # abafa (passa-baixa simples)
por(np.convolve(m1, k, 'same') * 0.5, x, 0.0)
por(np.convolve(m2, k, 'same') * 0.5, x, 0.18)
por(baque(0.4) * 0.4, x, 0.18)
salvar('festa_falha', eco(x, 0.15)[:int(SR * 0.8)], 0.7)

# liberado: harpa subindo em escala pentatônica e cintilar
x = np.zeros(int(SR * 1.4))
for i, n in enumerate([67, 69, 72, 74, 76, 79, 81, 84, 86, 88]):
    por(sino(nota(n), 1.0, 0.35, 0.4) * (0.35 + i * 0.03), x, i * 0.045)
por(sino(nota(91), 0.9, 0.7, 0.4) * 0.4, x, 0.46)
x += cintilar(1.4, 22, 4000, 9000, 0.2) * 0.12
salvar('festa_libera', eco(x, 0.25)[:int(SR * 1.4)], 0.75)
print('ok', SAIDA)
