// Monta os modelos de cenário do mapa (ruínas, pedras, troncos caídos, cogumelos...) em godot-prototipo/cenario3d/.
// Fonte: repositório New-Game-Anime-fontes (só pacotes CC0: Quaternius Stylized Nature e Medieval Village MegaKit,
// Poly Haven). Cada modelo vira um .glb leve: a malha de foto da Poly Haven é simplificada, as texturas descem para
// 512 (1024 nas paredes) e só fica a cor (o jogo é toon: sem normal, rugosidade ou metal). As de foto são pintadas
// pela paleta do jogo (ferramentas/pintar-texturas/pintar.py), como o resto do cenário.
// Uso: FONTES=/caminho/New-Game-Anime-fontes node ferramentas/cenario/preparar.mjs
//      (precisa de: npm i --no-save @gltf-transform/core @gltf-transform/functions meshoptimizer; python3 com opencv)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { simplify, weld, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const FONTES = process.env.FONTES || path.resolve('../New-Game-Anime-fontes');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SAIDA = path.join(AQUI, '..', '..', 'godot-prototipo', 'cenario3d');
const NAT = 'pacotes_cc0/Stylized_Nature_MegaKit/glTF/';
const VIL = 'pacotes_cc0/Medieval_Village_MegaKit/Medieval Village MegaKit[Standard]/glTF/';
const PH = 'polyhaven/modelos/';
// nome no jogo: [arquivo na fonte, proporção de triângulos que fica (1 = tudo), lado da textura, rampa de pintura]
const LISTA = {
  rocha1: [NAT + 'Rock_Medium_1.gltf', 1, 512], rocha2: [NAT + 'Rock_Medium_2.gltf', 1, 512], rocha3: [NAT + 'Rock_Medium_3.gltf', 1, 512],
  arvore_morta1: [NAT + 'DeadTree_1.gltf', 0.5, 512], arvore_morta3: [NAT + 'DeadTree_3.gltf', 0.5, 512],
  cogumelo: [NAT + 'Mushroom_Common.gltf', 0.5, 256], orelha_de_pau: [NAT + 'Mushroom_Laetiporus.gltf', 0.3, 256],
  arbusto: [NAT + 'Bush_Common.gltf', 1, 256, 'folhagem'], arbusto_flor: [NAT + 'Bush_Common_Flowers.gltf', 1, 256],
  samambaia: [NAT + 'Fern_1.gltf', 1, 512, 'fern_02'], planta: [NAT + 'Plant_7_Big.gltf', 1, 512, 'folhagem'],
  parede: [VIL + 'Wall_UnevenBrick_Straight.gltf', 1, 1024], parede_janela: [VIL + 'Wall_UnevenBrick_Window_Wide_Round.gltf', 1, 1024],
  pilar: [VIL + 'Corner_Exterior_Brick.gltf', 0.4, 1024], piso: [VIL + 'Floor_UnevenBrick.gltf', 1, 1024],
  escada: [VIL + 'Stairs_Exterior_Straight.gltf', 1, 1024], tijolo1: [VIL + 'Prop_Brick1.gltf', 1, 512], tijolo3: [VIL + 'Prop_Brick3.gltf', 1, 512],
  hera1: [VIL + 'Prop_Vine1.gltf', 1, 512], hera4: [VIL + 'Prop_Vine4.gltf', 1, 512], carroca: [VIL + 'Prop_Wagon.gltf', 0.6, 1024],
  tronco_caido: [PH + 'dead_tree_trunk_02/dead_tree_trunk_02_1k.gltf', 0.03, 512, 'bark_brown_02'],
  estatua: [PH + 'gothic_statue/gothic_statue_1k.gltf', 0.12, 512, 'stacked_stone_wall'],
  fogueira: [PH + 'stone_fire_pit/stone_fire_pit_1k.gltf', 0.4, 512, 'stacked_stone_wall'],
  toco2: [PH + 'tree_stump_02/tree_stump_02_1k.gltf', 0.03, 512, 'bark_brown_02'],
};

// paredes de ruína: sem reboco nem viga de madeira (era casa; agora é pedra velha)
const PEDRA = new Set(['parede', 'parede_janela']);
await MeshoptSimplifier.ready;
const io = new NodeIO();
fs.mkdirSync(SAIDA, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cenario-'));
const so = process.argv.slice(2);
for (const [nome, [arq, ratio, lado, rampa]] of Object.entries(LISTA)) {
  if (so.length && !so.includes(nome)) continue;
  const doc = await io.read(path.join(FONTES, arq));
  const root = doc.getRoot();
  if (PEDRA.has(nome)) { // ruína: tudo pedra. O lado de reboco vira tijolo e as vigas de madeira viram pedra
    const mats = Object.fromEntries(root.listMaterials().map((m) => [m.getName(), m]));
    const tijolo = mats.MI_UnevenBrick;
    for (const mesh of root.listMeshes()) for (const pr of mesh.listPrimitives()) if (pr.getMaterial()?.getName() === 'MI_Plaster' && tijolo) pr.setMaterial(tijolo);
    if (mats.MI_WoodTrim) {
      const img = fs.readFileSync(path.join(FONTES, VIL, '..', 'Textures', 'T_RockTrim_BaseColor.png'));
      const t = doc.createTexture('T_RockTrim_BaseColor').setImage(img).setMimeType('image/png');
      mats.MI_WoodTrim.setBaseColorTexture(t);
    }
  }
  for (const m of root.listMaterials()) { // só a cor: o resto o toon não usa
    for (const t of [m.getNormalTexture(), m.getOcclusionTexture(), m.getMetallicRoughnessTexture(), m.getEmissiveTexture()]) if (t) t.dispose();
    m.setMetallicFactor(0).setRoughnessFactor(1);
  }
  for (const t of root.listTextures()) {
    const ext = t.getMimeType() === 'image/png' ? '.png' : '.jpg';
    const ent = path.join(tmp, 'e' + ext), sai = path.join(tmp, 's' + ext);
    fs.writeFileSync(ent, Buffer.from(t.getImage()));
    for (const f of ['s.png', 's.jpg']) fs.rmSync(path.join(tmp, f), { force: true });
    execFileSync('python3', [path.join(AQUI, 'textura.py'), ent, sai, String(lado), ...(rampa ? [rampa] : [])]);
    const feito = fs.existsSync(path.join(tmp, 's.png')) ? 's.png' : 's.jpg';
    t.setImage(fs.readFileSync(path.join(tmp, feito))).setMimeType(feito.endsWith('png') ? 'image/png' : 'image/jpeg').setURI(nome + '_' + t.getName() + (feito.endsWith('png') ? '.png' : '.jpg'));
  }
  if (ratio < 1) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }));
  await doc.transform(dedup(), prune());
  for (const b of root.listBuffers().slice(1)) b.dispose();
  for (const a of root.listAccessors()) a.setBuffer(root.listBuffers()[0]);
  await io.write(path.join(SAIDA, nome + '.glb'), doc);
  let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  console.log(nome.padEnd(14), String(tris | 0).padStart(6), 'tri', (fs.statSync(path.join(SAIDA, nome + '.glb')).size / 1024).toFixed(0).padStart(5), 'KB');
}
fs.rmSync(tmp, { recursive: true, force: true });
