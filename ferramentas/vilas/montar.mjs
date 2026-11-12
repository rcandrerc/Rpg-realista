// Monta as casas e os enfeites das mini vilas do mundo grande (história v2, Entrega 3) num só modelo:
// godot-prototipo/vilas3d/vilas.glb. Cada casa é um nó com o nome dela (casa_reboco_4x4, forja, comercio...) feito das
// peças do Medieval Village MegaKit (paredes de reboco e enxaimel, pedra, telhado de telha, chaminé, porta, janela com
// postigo) e os enfeites do Fantasy Props MegaKit (barril, caixote, banca, estandarte, bigorna...). Os dois são CC0
// (Quaternius) e estão no repositório New-Game-Anime-fontes. Um modelo só: as texturas vão uma vez para o celular.
// O jogo é toon: fica só a cor (sem normal nem rugosidade) e as texturas descem para 1024.
// Uso: FONTES=/caminho/New-Game-Anime-fontes node ferramentas/vilas/montar.mjs
//      (precisa de: npm i --no-save @gltf-transform/core @gltf-transform/functions; python3 com Pillow)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { NodeIO, Document } from '@gltf-transform/core';
import { mergeDocuments, dedup, prune, join, unpartition, weld, transformMesh, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { CASAS_VILA, ENFEITES_VILA } from './pecas.mjs';

const FONTES = process.env.FONTES || path.resolve('../New-Game-Anime-fontes');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SAIDA = path.join(AQUI, '..', '..', 'godot-prototipo', 'vilas3d');
const VIL = path.join(FONTES, 'pacotes_cc0/Medieval_Village_MegaKit/Medieval Village MegaKit[Standard]/glTF/');
const PROPS = path.join(FONTES, 'pacotes_cc0/Fantasy_Props_MegaKit/Exports/glTF/');
await MeshoptSimplifier.ready;
const io = new NodeIO();
const alvo = new Document();
alvo.createBuffer();
const cena = alvo.createScene('vilas');

// põe a peça `nome` (arquivo do kit) dentro do nó pai, no lugar p = [x, y, z], girada ry (radianos) e com escala s
async function por(pai, nome, p = [0, 0, 0], ry = 0, s = 1) {
  const arq = fs.existsSync(path.join(VIL, nome + '.gltf')) ? path.join(VIL, nome + '.gltf') : path.join(PROPS, nome + '.gltf');
  const src = await io.read(arq);
  // peça pesada (canto de pedra, caixote, carroça...): menos triângulos, com a mesma silhueta
  const tris = src.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((q, pr) => q + (pr.getIndices()?.getCount() || 0) / 3, 0), 0);
  if (tris > 1200 && !/^Roof_/.test(nome)) await src.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.2, 700 / tris), error: 0.004 }));
  const mapa = mergeDocuments(alvo, src);
  for (const sc of src.getRoot().listScenes()) {
    const nova = mapa.get(sc);
    const no = alvo.createNode(nome).setTranslation(p).setRotation([0, Math.sin(ry / 2), 0, Math.cos(ry / 2)]).setScale([s, s, s]);
    for (const filho of nova.listChildren()) { nova.removeChild(filho); no.addChild(filho); }
    pai.addChild(no);
    nova.dispose();
  }
}

for (const [nome, pecas] of Object.entries({ ...CASAS_VILA, ...ENFEITES_VILA })) {
  const no = alvo.createNode(nome);
  cena.addChild(no);
  for (const [peca, p, ry, s] of pecas) await por(no, peca, p, ry, s);
}
// só a cor: o toon do jogo não usa normal, rugosidade nem metal
for (const m of alvo.getRoot().listMaterials()) {
  m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
  m.setMetallicFactor(0).setRoughnessFactor(1);
}
await alvo.transform(unpartition());
// cada casa vira poucas malhas (uma por material): a malha de cada peça é copiada já no lugar dentro da casa (a casa
// fica na origem) e as peças somem; depois o join junta as malhas irmãs do mesmo material
for (const casa of cena.listChildren()) {
  const pecas = [];
  const descer = (n) => { for (const f of n.listChildren()) { pecas.push(f); descer(f); } };
  descer(casa);
  for (const f of pecas) {
    const mesh = f.getMesh(); if (!mesh) continue;
    const copia = mesh.clone();
    transformMesh(copia, f.getWorldMatrix());
    casa.addChild(alvo.createNode(casa.getName() + '_p').setMesh(copia));
  }
  for (const f of pecas) f.dispose(); // as peças originais saem (as malhas delas o prune tira)
}
await alvo.transform(dedup(), prune(), join({ keepNamed: false }), weld(), dedup(), prune());
// texturas para 1024 (as do kit são 2048)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilas-'));
for (const t of alvo.getRoot().listTextures()) {
  const f = path.join(tmp, (t.getName() || 'tex') + '.png');
  fs.writeFileSync(f, t.getImage());
  execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open(r'${f}')\nim=im.convert('RGBA' if im.mode in ('RGBA','LA','P') else 'RGB')\nif max(im.size)>1024: im=im.resize((1024,1024), Image.LANCZOS)\nopaca = im.mode == 'RGB' or im.getchannel('A').getextrema()[0] > 250
if opaca: im.convert('RGB').save(r'${f}.jpg', quality=88)
else: im.save(r'${f}.png', optimize=True)`]);
  if (fs.existsSync(f + '.jpg')) t.setImage(fs.readFileSync(f + '.jpg')).setMimeType('image/jpeg');
  else t.setImage(fs.readFileSync(f + '.png')).setMimeType('image/png');
}
fs.mkdirSync(SAIDA, { recursive: true });
await io.write(path.join(SAIDA, 'vilas.glb'), alvo);
const tris = alvo.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((q, p) => q + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
for (const c of cena.listChildren()) console.log('  ', c.getName().padEnd(16), c.listChildren().reduce((a, n) => a + (n.getMesh()?.listPrimitives().reduce((q, p) => q + (p.getIndices()?.getCount() || 0) / 3, 0) || 0), 0), 'triângulos');
console.log('vilas.glb:', cena.listChildren().length, 'modelos,', alvo.getRoot().listMeshes().length, 'malhas,', tris, 'triângulos,', alvo.getRoot().listTextures().length, 'texturas,', (fs.statSync(path.join(SAIDA, 'vilas.glb')).size / 1e6).toFixed(1), 'MB');
