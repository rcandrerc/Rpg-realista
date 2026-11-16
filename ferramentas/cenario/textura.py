# Ajuda do preparar.mjs: reduz uma textura (e, se pedir, pinta pela paleta do jogo com o pintar.py).
# Uso: python3 textura.py entrada saida lado [rampa]   (rampa = nome de uma rampa do pintar.py, ou "sombra,meio,luz,mistura")
import sys, os, cv2, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'pintar-texturas'))
import pintar as P

ent, sai, lado = sys.argv[1], sys.argv[2], int(sys.argv[3])
rampa = sys.argv[4] if len(sys.argv) > 4 else ''
img = cv2.imread(ent, cv2.IMREAD_UNCHANGED)
alfa = img[..., 3] if img.ndim == 3 and img.shape[2] == 4 else None
cor = img[..., :3] if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
if rampa.startswith('tinta:'):
    # tinta (árvores plantadas): só troca a cor pela rampa, sem posterizar; a luz é medida só onde tem folha (alfa)
    cor = cv2.resize(cor, (lado, lado), interpolation=cv2.INTER_AREA)
    esc, mei, cla = (P.hexbgr(h) for h in rampa[6:].split(',')[:3])
    l = cv2.cvtColor(cor, cv2.COLOR_BGR2GRAY).astype(np.float32)
    m = cv2.resize(alfa, (lado, lado), interpolation=cv2.INTER_AREA) > 128 if alfa is not None else np.ones(l.shape, bool)
    lo, hi = np.percentile(l[m], 3), np.percentile(l[m], 97)
    t = ((l - lo) / max(1, hi - lo)).clip(0, 1)[..., None]
    cor = np.where(t < 0.5, esc + (mei - esc) * (t * 2), mei + (cla - mei) * (t * 2 - 1)).clip(0, 255).astype(np.uint8)
elif rampa:
    r = P.RAMPA.get(rampa) or tuple(rampa.split(',')[:3]) + (float(rampa.split(',')[3]),)
    P.LADO = lado
    cor = P.pintar(cor, r, leve=rampa in P.LEVES)
else:
    cor = cv2.resize(cor, (lado, lado), interpolation=cv2.INTER_AREA)
if alfa is not None and alfa.min() < 250:
    a = cv2.resize(alfa, (lado, lado), interpolation=cv2.INTER_AREA)
    cv2.imwrite(sai if sai.endswith('.png') else sai[:-4] + '.png', np.dstack([cor, a]), [cv2.IMWRITE_PNG_COMPRESSION, 9])
else:
    cv2.imwrite(sai[:-4] + '.jpg', cor, [cv2.IMWRITE_JPEG_QUALITY, 86])
