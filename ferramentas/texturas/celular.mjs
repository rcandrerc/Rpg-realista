// Texturas do jeito do celular (conselho de 18/11/2026, opção 1, André: "vamos la 1 pode ir").
// O Godot importa toda textura "sem perda" (WebP): no celular ela vira imagem cheia na placa (RGBA, 4 bytes por
// ponto) e 107 das grandes nem têm mipmap. O jogo ocupava 2,4-2,5 GB de memória de vídeo e esquentava o Poco até
// cair para 30 FPS. Aqui as texturas do MUNDO (chão, vila, árvores, rochas, construções, monstros) passam a ir
// comprimidas para a placa (ETC2 no Android, 4-8x menor). O mipmap fica como estava (ver TEXTURAS_MIPMAP abaixo).
//
// Ficam como estão (sem perda), de propósito:
//  - as que o jogo lê pelo processador (imagem_cpu.gd, pele rosa do Mali-G72): máscaras (mascara_vila,
//    mundo_mascara, longe), magia_atlas, T_WoodTrim do transporte.gd;
//  - interface (icones, ui, icone_app), minimapa, céu, água, capim do mato.
//
// Parte 2 (André 2026-11-19: "principalmente a de personagem, que é o que pesa mais"): os corpos VRoid (Ruiva, cabelo_m e
// os corpos dos NPCs, da Cecília, do Dário e da Geada: modelos/<corpo>_N tirados do .glb) também vão comprimidos: pele,
// rosto, olhos, roupa e cabelo. Cada corpo ocupava ~110 MB na placa. A pele, o cabelo e a roupa são lidos pelo
// processador (média da cor para tingir, pele por baixo da blusa, rosto dos NPCs): imagem_cpu.gd agora lê o .ctex
// comprimido e descomprime no processador, sem pedir para a placa (a pele rosa do Mali-G72 vinha da leitura da placa).
// Mipmap continua como o Godot importou (as do .glb já têm).
//
// Roda no apk.yml antes e depois do "godot --import" (o cache do CI traz os .import antigos; textura nova só ganha
// .import na primeira importação), e de novo o --import se mudou algo. Também serve para medir na mão.
// Uso: node ferramentas/texturas/celular.mjs [pasta do projeto Godot]   (padrão: godot-prototipo)
// Saída: "texturas do celular: N mudaram" (N = .import reescritos).
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(process.argv[2] || new URL('../../godot-prototipo', import.meta.url).pathname);

// pastas inteiras do mundo
const PASTAS = ['cenario3d/', 'construcao3d/', 'vilas3d/', 'treino3d/', 'ferramentas3d/', 'armas3d/'];
// arquivos soltos do mundo
// (mato_capim.png fica como era, sem perda e sem mipmap: é pequena e o shader do mato depende do recorte fino)
const SOLTOS = new Set([
  'relevo/brown_mud_leaves_01.jpg', 'relevo/rocky_terrain_02.jpg',
  'modelos/forrest_ground_01.jpg', 'modelos/stony_dirt_path.jpg', 'modelos/cobblestone_floor_01.jpg',
]);
// modelos/<nome>_N.(png|jpg) tirados do .glb: a vila e os monstros (corpos VRoid ficam para o PR 2)
const MODELOS = ['vila', 'arma_cajado', 'dragao', 'imp', 'lobo', 'maw', 'puglin', 'pumpkinhulk', 'tita', 'warrok'];
// corpos VRoid: todo .glb de modelos/ com material do VRoid (Body_00_SKIN, Hair, CLOTH...); pega corpo novo sozinho
const VROID = /_(SKIN|CLOTH|HAIR|FACE|EYE)\b/;
const corposVroid = new Set();
// lidas pelo processador (imagem_cpu.gd) e que precisam continuar sem perda (o transporte recorta a madeira)
const PELO_PROCESSADOR = new Set(['construcao3d/T_WoodTrim_BaseColor.png', 'construcao3d/T_WoodTrim_Normal.png']);

// "_Normal" sozinho (T_Brick_Normal, _nor_gl_1k); "NormalTree" é o tipo da árvore, não mapa de normais
const ehNormalPeloNome = (rel) => /(_normal|_nor_gl|_nrm)(?![a-z])[^/]*\.(png|jpe?g|webp)$/i.test(rel);

// Mapas de normais dentro dos .glb (o Godot tira a imagem como <glb>_<índice ou nome>.<ext>)
const normaisGlb = new Set();
function lerGlb(arq) {
  try {
    const b = fs.readFileSync(arq);
    if (b.readUInt32LE(0) !== 0x46546c67) return null; // "glTF"
    return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  } catch { return null; }
}
function juntarNormais(dir, glb) {
  const j = lerGlb(path.join(raiz, dir, glb));
  if (!j) return;
  const base = glb.replace(/\.glb$/i, '');
  if (dir === 'modelos/' && (j.materials || []).some((m) => VROID.test(m.name || ''))) corposVroid.add(base);
  for (const m of j.materials || []) {
    const t = m.normalTexture && j.textures?.[m.normalTexture.index];
    const im = t && j.images?.[t.source];
    if (!im) continue;
    for (const ext of ['png', 'jpg', 'webp']) {
      normaisGlb.add(path.posix.join(dir, `${base}_${t.source}.${ext}`));
      if (im.name) normaisGlb.add(path.posix.join(dir, `${base}_${im.name}.${ext}`));
    }
  }
}
for (const dir of [...PASTAS, 'modelos/']) {
  let nomes = [];
  try { nomes = fs.readdirSync(path.join(raiz, dir)); } catch { continue; }
  for (const n of nomes) if (n.toLowerCase().endsWith('.glb')) juntarNormais(dir, n);
}

// null = deixa como está; senão { normal }
export function regra(rel) {
  if (PELO_PROCESSADOR.has(rel)) return null;
  const doMundo = SOLTOS.has(rel) || PASTAS.some((p) => rel.startsWith(p))
    || [...MODELOS, ...corposVroid].some((n) => new RegExp(`^modelos/${n}_\\d+\\.(png|jpe?g|webp)$`, 'i').test(rel));
  if (!doMundo) return null;
  // folhas recortadas pelo alfa (árvores, arbustos, samambaia, hera): comprimidas, mas SEM mipmap, como eram. Com
  // mipmap o recorte de longe vira borrão (o capim do mato virou folha larga na foto de teste).
  const folha = /(leaves|leaf)[^/]*\.(png|webp)$/i.test(rel);
  return { normal: ehNormalPeloNome(rel) || normaisGlb.has(rel), semMip: folha };
}

function* imports(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.godot' || e.name === 'android' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* imports(p);
    else if (e.name.endsWith('.import')) yield p;
  }
}

// troca (ou acrescenta) chave=valor na seção [params]
function porParam(txt, chave, valor) {
  const re = new RegExp(`^${chave.replace(/[/.]/g, '\\$&')}=.*$`, 'm');
  if (re.test(txt)) return txt.replace(re, `${chave}=${valor}`);
  return txt.replace(/^\[params\]\s*$/m, `[params]\n\n${chave}=${valor}`);
}

let mudaram = 0, total = 0, normais = 0, folhas = 0, corpos = 0;
for (const arq of imports(raiz)) {
  const txt = fs.readFileSync(arq, 'utf8');
  if (!/^importer="texture"$/m.test(txt) || !/^\[params\]/m.test(txt)) continue;
  const rel = path.relative(raiz, arq).split(path.sep).join('/').replace(/\.import$/, '');
  const r = regra(rel);
  if (!r) continue;
  total++;
  if (r.normal) normais++;
  if (r.semMip) folhas++;
  if ([...corposVroid].some((n) => new RegExp(`^modelos/${n}_\\d+\\.`).test(rel))) corpos++;
  let novo = txt;
  novo = porParam(novo, 'compress/mode', 2); // VRAM comprimida (ETC2/ASTC no celular, S3TC no PC)
  // mipmap: fica como o Godot importou (as tiradas do .glb já vêm com mipmap; as outras sem). Com mipmap novo, paredes e
  // chão vistos de lado ficavam mais borrados nas fotos de teste (18/11). TEXTURAS_MIPMAP=1 liga para testar.
  if (process.env.TEXTURAS_MIPMAP === '1') novo = porParam(novo, 'mipmaps/generate', r.semMip ? 'false' : 'true');
  novo = porParam(novo, 'detect_3d/compress_to', 0);
  novo = porParam(novo, 'compress/normal_map', r.normal ? 1 : 0); // normais em RG: o Godot refaz o Z (melhor que ETC2 RGB)
  if (novo !== txt) {
    fs.writeFileSync(arq, novo);
    mudaram++;
    if (process.env.TEXTURAS_LISTA) console.log('  ' + rel + (r.normal ? ' (normal)' : ''));
  }
}
console.log(`texturas do celular: ${mudaram} mudaram (${total} comprimidas, ${normais} mapas de normais, ${folhas} folhas sem mipmap, ${corpos} dos ${corposVroid.size} corpos VRoid)`);
