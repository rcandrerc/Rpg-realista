# Enxuga os .glb da thread de arte (ferramentas/equip-raridade) para entrar no jogo como "Patrulheiro 2" / "Roupão 2":
# tira as 83 animações da Ruiva que o Blender exporta junto (de ~9 MB para algumas centenas de KB) e tudo que só elas
# usavam. Uso: python3 ferramentas/equip2-enxugar.py entrada.glb saida.glb
import json, struct, sys

def ler(caminho):
    f = open(caminho, 'rb').read()
    pos, j, b = 12, None, b''
    while pos < len(f):
        n, tipo = struct.unpack('<II', f[pos:pos + 8])
        dado = f[pos + 8:pos + 8 + n]
        if tipo == 0x4E4F534A:
            j = json.loads(dado)
        else:
            b = dado
        pos += 8 + n
    return j, b

def usados(j):
    acc = set()
    for m in j.get('meshes', []):
        for p in m['primitives']:
            acc.update(p['attributes'].values())
            if 'indices' in p:
                acc.add(p['indices'])
            for t in p.get('targets', []):
                acc.update(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            acc.add(s['inverseBindMatrices'])
    return acc

def main(ent, sai):
    j, b = ler(ent)
    j.pop('animations', None)
    acc = sorted(usados(j))
    nova_acc = {a: i for i, a in enumerate(acc)}
    novo_buf = bytearray()
    bvs, mapa_bv = [], {}
    for a in acc:
        bvi = j['accessors'][a].get('bufferView')
        if bvi is None or bvi in mapa_bv:
            continue
        bv = dict(j['bufferViews'][bvi])
        dado = b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        while len(novo_buf) % 4:
            novo_buf.append(0)
        bv['byteOffset'] = len(novo_buf)
        bv['buffer'] = 0
        novo_buf += dado
        mapa_bv[bvi] = len(bvs)
        bvs.append(bv)
    accs = []
    for a in acc:
        x = dict(j['accessors'][a])
        if 'bufferView' in x:
            x['bufferView'] = mapa_bv[x['bufferView']]
        accs.append(x)
    j['accessors'], j['bufferViews'] = accs, bvs
    for m in j.get('meshes', []):
        for p in m['primitives']:
            p['attributes'] = {k: nova_acc[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = nova_acc[p['indices']]
            if 'targets' in p:
                p['targets'] = [{k: nova_acc[v] for k, v in t.items()} for t in p['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            s['inverseBindMatrices'] = nova_acc[s['inverseBindMatrices']]
    while len(novo_buf) % 4:
        novo_buf.append(0)
    j['buffers'] = [{'byteLength': len(novo_buf)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    tot = 12 + 8 + len(js) + 8 + len(novo_buf)
    with open(sai, 'wb') as o:
        o.write(struct.pack('<III', 0x46546C67, 2, tot))
        o.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        o.write(struct.pack('<II', len(novo_buf), 0x004E4942) + bytes(novo_buf))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
