# Gera a grade de alturas (topo) de cada malha de pedra, no espaço local da malha.
import json, struct, sys, numpy as np, os
TIPO = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}
def acessor(g, binarios, base, i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    buf = binarios[bv['buffer']]
    comp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    fmt, sz = TIPO[a['componentType']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(buf, dtype={'f': np.float32, 'I': np.uint32, 'H': np.uint16, 'B': np.uint8}[fmt], count=a['count'] * comp, offset=off)
    if a.get('normalized'): pass
    return arr.reshape(-1, comp) if comp > 1 else arr
def grade(caminho, malha_idx, passo=0.08):
    g = json.load(open(caminho)); base = os.path.dirname(caminho)
    binarios = [open(os.path.join(base, b['uri']), 'rb').read() for b in g['buffers']]
    m = g['meshes'][malha_idx]; P = []; T = []
    for p in m['primitives']:
        pos = acessor(g, binarios, base, p['attributes']['POSITION']).astype(np.float64)
        idx = acessor(g, binarios, base, p['indices']).astype(np.int64).reshape(-1, 3) + sum(len(x) for x in P)
        P.append(pos); T.append(idx)
    P = np.concatenate(P); T = np.concatenate(T)
    x0, z0 = P[:, 0].min(), P[:, 2].min(); x1, z1 = P[:, 0].max(), P[:, 2].max()
    nx = int(np.ceil((x1 - x0) / passo)) + 1; nz = int(np.ceil((z1 - z0) / passo)) + 1
    H = np.full((nz, nx), -9.0)
    # amostra cada triângulo com pontos suficientes para cobrir a grade
    a, b, c = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    k = 6
    for i in range(k + 1):
        for j in range(k + 1 - i):
            u, v = i / k, j / k; w = 1 - u - v
            q = a * w + b * u + c * v
            ix = np.clip(np.round((q[:, 0] - x0) / passo).astype(int), 0, nx - 1)
            iz = np.clip(np.round((q[:, 2] - z0) / passo).astype(int), 0, nz - 1)
            np.maximum.at(H, (iz, ix), q[:, 1])
    # buracos pequenos: preenche com o vizinho
    for _ in range(3):
        vaz = H < -8
        if not vaz.any(): break
        Hp = np.pad(H, 1, constant_values=-9)
        viz = np.max(np.stack([Hp[:-2, 1:-1], Hp[2:, 1:-1], Hp[1:-1, :-2], Hp[1:-1, 2:]]), axis=0)
        H[vaz] = viz[vaz]
    H[H < -8] = -1
    return {'x0': round(x0, 3), 'z0': round(z0, 3), 'passo': passo, 'nx': nx, 'nz': nz, 'h': [int(round(v * 100)) for v in H.flatten()]}
out = {}
for nome, caminho, idx in json.loads(sys.argv[1]):
    out[nome] = grade(caminho, idx); print(nome, out[nome]['nx'], out[nome]['nz'], max(out[nome]['h']), file=sys.stderr)
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
