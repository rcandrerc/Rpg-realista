"""Motor do carrinho de carga (André 2026-11-09: "tremor quando liga e barulho de motor de tratorzinho"), sintetizado
aqui (próprio, CC0, sem gravação de terceiros). Motor de 1 cilindro a vapor/explosão bem lento, "pó-pó-pó":
- motor_partida.ogg: o arranque (manivela girando, duas explosões falhando e pega);
- motor_lento.ogg: o motor ligado em marcha lenta, em laço sem emenda (o jogo acelera o tom com a velocidade).
Uso (precisa de numpy e ffmpeg): python3 ferramentas/sons/motor.py
"""
import numpy as np, wave, subprocess, os, tempfile
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'godot-prototipo', 'sons')
TMP = tempfile.mkdtemp()
SR = 44100
rng = np.random.default_rng(11)

def lp(x, fc):
    # passa-baixa de 1 polo (duas vezes = 12 dB por oitava)
    a = np.exp(-2 * np.pi * fc / SR)
    for _ in range(2):
        y = np.zeros_like(x); s = 0.0
        for i in range(len(x)):
            s = (1 - a) * x[i] + a * s; y[i] = s
        x = y
    return x

def salvar(nome, x, v=0.85):
    x = x / np.max(np.abs(x)) * v; d = (x * 32767).astype(np.int16)
    w_ = os.path.join(TMP, nome + '.wav')
    with wave.open(w_, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w_, '-c:a', 'libvorbis', '-q:a', '4', os.path.join(SAIDA, nome + '.ogg')], check=True)

def explosao(m, forte=1.0):
    # uma batida do cilindro: baque grave (55-80 Hz caindo) + estalo do escapamento (ruído filtrado) + chacoalho de lata
    t = np.arange(m) / SR
    f = 48 + 40 * np.exp(-t / 0.02)
    baque = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05)
    esc = lp(rng.standard_normal(m), 700) * np.exp(-t / 0.035) * 3.0
    lata = np.sin(2 * np.pi * 410 * t) * np.exp(-t / 0.018) * 0.12 + np.sin(2 * np.pi * 690 * t) * np.exp(-t / 0.01) * 0.06
    return (baque + esc * 0.8 + lata) * forte

# marcha lenta: 8,5 batidas por segundo; 34 batidas = 4 s exatos de laço (o fim emenda no começo)
BPS = 8.5; N = 34
per = int(round(SR / BPS)); n = per * N
x = np.zeros(n + per)
for k in range(N):
    j = int(rng.uniform(-0.04, 0.04) * per) if k else 0 # irregular como motor velho
    i = k * per + j
    e = explosao(per, rng.uniform(0.8, 1.05) * (1.0 if k % 2 == 0 else 0.86))
    x[i:i + per] += e
x[:per] += x[n:n + per] # o que passou do fim volta para o começo (laço sem emenda)
x = x[:n]
ronco = lp(rng.standard_normal(n), 160) * 0.6 # o ronco grave por baixo
mec = lp(rng.standard_normal(n), 2500) * 0.04 * (0.6 + 0.4 * np.sin(2 * np.pi * BPS * 2 * np.arange(n) / SR)) # engrenagem
salvar('motor_lento', x + ronco + mec)

# partida: manivela (ruído com tom subindo) 0,7 s, falha, falha, pega e 1,2 s de marcha lenta subindo o volume
d = 2.4; n = int(SR * d); t = np.arange(n) / SR
x = np.zeros(n)
ca = int(SR * 0.75); tc = np.arange(ca) / SR
fr = 6 + 10 * tc / 0.75 # rotações da manivela
manivela = lp(rng.standard_normal(ca), 900) * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(fr) / SR)) * 0.5
x[:ca] += manivela * np.minimum(1, tc / 0.1)
for tt, f_ in [(0.55, 0.5), (0.72, 0.7)]:
    i = int(tt * SR); m = int(SR * 0.12); x[i:i + m] += explosao(m, f_)
k = 0; tt = 0.9
while tt < d - 0.12:
    i = int(tt * SR); m = int(SR / BPS)
    x[i:i + m] += explosao(min(m, n - i), 1.15 if k < 3 else 1.0)[:min(m, n - i)]
    tt += (1 / 5.0 if k < 3 else 1 / BPS) # acelera e assenta
    k += 1
x += lp(rng.standard_normal(n), 160) * 0.6 * np.clip((t - 0.85) / 0.4, 0, 1)
x *= np.clip((d - t) / 0.15, 0, 1)
salvar('motor_partida', x)
print('ok')
