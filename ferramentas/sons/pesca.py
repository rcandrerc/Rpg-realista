"""Sons da pescaria (André 2026-11-08), sintetizados aqui (próprios, CC0, sem gravação de terceiros), com as mesmas
receitas do Quimera (Zj.splash, bloop, reel). Uso (precisa de numpy e ffmpeg): python3 ferramentas/sons/pesca.py
"""
import numpy as np, wave, subprocess, os, tempfile
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'godot-prototipo', 'sons')
TMP = tempfile.mkdtemp()
SR=44100
rng=np.random.default_rng(7)
def bp(x,f,q):
    # biquad passa-faixa (f pode variar por amostra)
    f=np.broadcast_to(np.asarray(f,float),x.shape); y=np.zeros_like(x); x1=x2=y1=y2=0.0
    for i in range(len(x)):
        w=2*np.pi*f[i]/SR; al=np.sin(w)/(2*q); c=np.cos(w); a0=1+al
        b0=al/a0; b2=-al/a0; a1=-2*c/a0; a2=(1-al)/a0
        yy=b0*x[i]+b2*x2-a1*y1-a2*y2; x2=x1; x1=x[i]; y2=y1; y1=yy; y[i]=yy
    return y
def env(n,a,d):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-t/d); return e
def salvar(nome,x,v=0.8):
    x=x/np.max(np.abs(x))*v; d=(x*32767).astype(np.int16)
    with wave.open(os.path.join(TMP,nome+'.wav'),'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',os.path.join(TMP,nome+'.wav'),'-c:a','libvorbis','-q:a','4',os.path.join(SAIDA,nome+'.ogg')],check=True)
# splash: ruído 0,45 s, filtro descendo de 1600 para 500 Hz + gotinhas
n=int(SR*0.5); t=np.arange(n)/SR
x=bp(rng.standard_normal(n),1600*np.exp(-t*2.4)+400,0.7)*env(n,0.005,0.12)
for k in range(9):
    i=int(rng.uniform(0.04,0.4)*SR); m=int(SR*0.03); tt=np.arange(m)/SR; f=rng.uniform(900,2200)
    x[i:i+m]+=0.25*np.sin(2*np.pi*(f*tt+ 9000*tt*tt))*np.exp(-tt/0.008)
salvar('pesca_splash',x)
# bloop: seno 420 -> 150 Hz em 0,14 s
n=int(SR*0.18); t=np.arange(n)/SR; f=150+270*np.exp(-t/0.05)
x=np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,0.004,0.05)
salvar('pesca_boia',x,0.6)
# molinete: estalinho 0,04 s em 3200 Hz
n=int(SR*0.05); x=bp(rng.standard_normal(n),3200,4)*env(n,0.001,0.012)
salvar('pesca_molinete',x,0.5)
# lançar: vupt de ar (ruído com filtro subindo e descendo)
n=int(SR*0.45); t=np.arange(n)/SR; f=600+2400*np.sin(np.pi*t/0.45)**2
x=bp(rng.standard_normal(n),f,1.2)*np.sin(np.pi*t/0.45)**1.5
salvar('pesca_lanca',x,0.5)
