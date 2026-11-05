# Converte as texturas de foto da Poly Haven (CC0) em texturas "pintadas" para o estilo anime:
# tira o detalhe miúdo de foto (filtro que preserva bordas), junta as cores em poucos tons
# e repinta pela paleta do jogo. Saída em client/public/assets/cenario/pintado/.
# Uso: python3 ferramentas/pintar-texturas/pintar.py   (precisa de opencv-python-headless e numpy)
import os, glob
import cv2
import numpy as np

RAIZ = os.path.join(os.path.dirname(__file__), '..', '..', 'client', 'public', 'assets', 'cenario')
SAIDA = os.path.join(RAIZ, 'pintado')
# palha e madeira guardam o veio (filtro mais leve)
LEVES = {'thatch_roof_angled', 'bark_brown_02'}
LISOS = {'stony_dirt_path', 'forrest_ground_01'}  # chão: sem pedrinha marcada, senão vira chuvisco ao longe
LADO = 512  # pintado não precisa de 1k: menos memória no celular

# Paleta do jogo: cada material ganha uma rampa de 3 cores (sombra, meio, luz) que substitui a cor da foto.
# Assim tudo sai na mesma família de tons, como cenário pintado à mão. (sombra, meio, luz, mistura com a cor original)
MADEIRA = ('3e2a1c', '72502f', 'b48654', 0.7)
RAMPA = {
    'forrest_ground_01': ('4a7a2a', '78a444', 'aac862', 0.8),
    'stony_dirt_path': ('4e331f', '7a5332', '9c7448', 0.85),
    'cobblestone_floor_01': ('64605a', '96907f', 'c9bfa8', 0.75),
    'worn_mossy_plasterwall': ('b2a68f', 'e2d8c3', 'fbf4e4', 0.75),
    'thatch_roof_angled': ('6b4f2a', 'ad8a4c', 'e3c57f', 0.75),
    'stacked_stone_wall': ('5c5853', '9b958a', 'd8cfbf', 0.7),
    'rock_moss_set_01': ('4c5946', '7a876c', 'adb497', 0.75),
    'namaqualand_boulder_04': ('665850', '908070', 'bcab94', 0.75),
    'bark_brown_02': ('3b2a20', '6c4d35', 'a07a58', 0.7),
    'fern_02': ('2c6a2c', '5ea443', 'b8de6c', 0.8),
    'folhagem': ('2c6a2c', '5ea443', 'b8de6c', 0.8),
    # relevo (lagos e montanha, 2026-11-05): pedra da montanha e lama do fundo do lago
    'rocky_terrain_02': ('57534c', '8c8676', 'c6bda6', 0.8),
    'brown_mud_leaves_01': ('3a3122', '62553a', '8e7f58', 0.8),
}
# palha e madeira guardam o veio (filtro mais leve)
LEVES = {'thatch_roof_angled', 'bark_brown_02'}
LISOS = {'stony_dirt_path', 'forrest_ground_01'}  # chão: sem pedrinha marcada, senão vira chuvisco ao longe
LADO = 512  # pintado não precisa de 1k: menos memória no celular

def hexbgr(h):
    return np.array([int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)], np.float32)

def pintar(img, rampa, leve=False, liso=False):
    escura, meio, clara, mistura = rampa
    img = cv2.resize(img, (LADO, LADO), interpolation=cv2.INTER_AREA)
    for _ in range(1 if leve else 3):
        img = cv2.bilateralFilter(img, 9, 50, 9)
    img = cv2.pyrMeanShiftFiltering(img, 4, 18) if leve else cv2.pyrMeanShiftFiltering(img, 8, 28)
    # poucos tons, como tinta: k-means nas cores
    z = img.reshape(-1, 3).astype(np.float32)
    _, rot, cen = cv2.kmeans(z, 8, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 12, 1.0), 2, cv2.KMEANS_PP_CENTERS)
    q = cen[rot.flatten()].reshape(img.shape)
    img = cv2.addWeighted(q, 0.6, img.astype(np.float32), 0.4, 0).clip(0, 255).astype(np.uint8)
    img = cv2.GaussianBlur(img, (3, 3), 0).astype(np.float32)
    if liso:
        img = cv2.GaussianBlur(img, (0, 0), 3)
    # luminosidade espalhada de 0 a 1 e passada pela rampa da paleta
    l = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    lo, hi = np.percentile(l, 3), np.percentile(l, 97)
    t = ((l - lo) / max(1, hi - lo)).clip(0, 1)[..., None]
    a, b, c = hexbgr(escura), hexbgr(meio), hexbgr(clara)
    r = np.where(t < 0.5, a + (b - a) * (t * 2), b + (c - b) * (t * 2 - 1))
    return (img * (1 - mistura) + r * mistura).clip(0, 255).astype(np.uint8)

def main():
    os.makedirs(SAIDA, exist_ok=True)
    feitos = 0
    for arq in sorted(glob.glob(os.path.join(RAIZ, '**', '*_diff_*.jpg'), recursive=True)):
        if os.sep + 'pintado' + os.sep in arq:
            continue
        nome = os.path.basename(arq).split('_diff_')[0]
        img = cv2.imread(arq)
        cv2.imwrite(os.path.join(SAIDA, nome + '.jpg'), pintar(img, RAMPA.get(nome, MADEIRA), nome in LEVES or nome not in RAMPA, nome in LISOS), [cv2.IMWRITE_JPEG_QUALITY, 86])
        feitos += 1
    # folhagem: mantém o recorte (alfa) e pinta só a cor
    f = cv2.imread(os.path.join(RAIZ, 'vila', 'folhagem.png'), cv2.IMREAD_UNCHANGED)
    cor = pintar(f[..., :3], RAMPA['folhagem'])
    alfa = cv2.resize(f[..., 3], (LADO, LADO), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(SAIDA, 'folhagem.png'), np.dstack([cor, alfa]), [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print(feitos + 1, 'texturas pintadas em', os.path.normpath(SAIDA))

if __name__ == '__main__':
    main()
