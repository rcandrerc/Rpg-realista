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
import { NodeIO, Document, PropertyType } from '@gltf-transform/core';
import { mergeDocuments, dedup, prune, join, unpartition, weld, transformMesh, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { CASAS_VILA, ENFEITES_VILA, CIDADE_AURORA, RIO_CLARO } from './pecas.mjs';

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

// Aurora viva: materiais próprios da cidade de pedra branca (a mesma textura do kit, clareada ou tingida aqui) e os
// das peças feitas aqui (cristal, água, vidro aceso). vilas_mundo.gd acha Vidro_Aurora, Cristal_Aurora e Agua_Aurora
// pelo nome e acende depois do fim da história.
const tmpTex = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-'));
function tingir(arquivo, conta) { // conta em Python sobre r, g, b (0-255) -> (r, g, b)
  const ent = path.join(VIL, arquivo), sai = path.join(tmpTex, arquivo.replace('.png', '_aurora.png'));
  execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open(r'${ent}').convert('RGB')\nif max(im.size)>1024: im=im.resize((1024,1024), Image.LANCZOS)\npx=im.load()\nfor y in range(im.size[1]):\n  for x in range(im.size[0]):\n    r,g,b=px[x,y]\n    ${conta}\n    px[x,y]=(max(0,min(255,int(R))),max(0,min(255,int(G))),max(0,min(255,int(B))))\nim.save(r'${sai}')`]);
  return fs.readFileSync(sai);
}
const MAT_AURORA = {}; // nome do material do kit -> material da cidade
{
  const tex = (nome, buf) => alvo.createTexture(nome).setImage(buf).setMimeType('image/png');
  const comTex = (nome, t) => alvo.createMaterial(nome).setBaseColorTexture(t).setDoubleSided(true);
  const branca = tex('T_PedraBranca', tingir('T_Brick_BaseColor.png', 'R=255-(255-r)*0.40; G=255-(255-g)*0.40; B=255-(255-b)*0.36'));
  MAT_AURORA.MI_UnevenBrick = comTex('PedraBranca_Aurora', branca);
  MAT_AURORA.MI_Brick = comTex('Calcada_Aurora', tex('T_CalcadaBranca', tingir('T_Brick_BaseColor.png', 'R=255-(255-r)*0.52; G=255-(255-g)*0.52; B=255-(255-b)*0.48')));
  MAT_AURORA.MI_RockTrim = comTex('Cantaria_Aurora', tex('T_CantariaBranca', tingir('T_RockTrim_BaseColor.png', 'R=255-(255-r)*0.45; G=255-(255-g)*0.45; B=255-(255-b)*0.42')));
  MAT_AURORA.MI_Plaster = comTex('Reboco_Aurora', tex('T_RebocoBranco', tingir('T_Plaster_BaseColor.png', 'R=255-(255-r)*0.30; G=255-(255-g)*0.30; B=255-(255-b)*0.28')));
  MAT_AURORA.MI_RoundTiles = comTex('Ardosia_Aurora', tex('T_ArdosiaAzul', tingir('T_RoundTiles_BaseColor.png', 'L=0.3*r+0.59*g+0.11*b; R=L*0.62+18; G=L*0.80+26; B=L*1.12+40')));
  const cor = (nome, c) => alvo.createMaterial(nome).setBaseColorFactor(c).setDoubleSided(true);
  MAT_AURORA.MI_WindowGlass = cor('Vidro_Aurora', [0.13, 0.15, 0.22, 1]);
  MAT_AURORA['@cristal'] = cor('Cristal_Aurora', [0.55, 0.62, 0.78, 1]);
  MAT_AURORA['@agua'] = cor('Agua_Aurora', [0.22, 0.36, 0.48, 1]);
  MAT_AURORA['@ferro'] = cor('Ferro_Aurora', [0.16, 0.16, 0.18, 1]);
  // Rio Claro (Casa do Comércio grande): o balcão de madeira, os tapetes e a placa com o nome da casa
  MAT_AURORA['@madeira'] = comTex('Balcao_Madeira', tex('T_Balcao', fs.readFileSync(path.join(VIL, 'T_WoodTrim_BaseColor.png'))));
  MAT_AURORA['@pedra'] = comTex('Pedra_Canto', tex('T_PedraCanto', fs.readFileSync(path.join(VIL, 'T_UnevenBrick_BaseColor.png'))));
  const lin = (c) => c.map((v, i) => (i === 3 ? v : v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); // a cor como se vê (sRGB) -> glTF (linear)
  MAT_AURORA['@tampo'] = cor('Balcao_Tampo', lin([0.29, 0.17, 0.09, 1]));
  MAT_AURORA['@vermelho'] = cor('Tapete_Vermelho', lin([0.48, 0.12, 0.12, 1]));
  MAT_AURORA['@vinho'] = cor('Tapete_Vinho', lin([0.35, 0.16, 0.23, 1]));
  MAT_AURORA['@roxo'] = cor('Tapete_Roxo', lin([0.24, 0.16, 0.36, 1]));
  MAT_AURORA['@ferro_rio'] = cor('Ferro_Rio', lin([0.17, 0.16, 0.15, 1])); // ferro escuro dos lampiões
  MAT_AURORA['@vidro_rio'] = cor('Vidro_Rio', lin([0.92, 0.78, 0.5, 1])); // vidro das lanternas do Rio Claro (acende de noite)
  MAT_AURORA['@ouro'] = cor('Tapete_Ouro', lin([0.79, 0.64, 0.23, 1]));
  MAT_AURORA['@papel'] = cor('Papel_Guilda', lin([0.88, 0.82, 0.68, 1])); // contratos presos no quadro da guilda
  const placa = path.join(tmpTex, 'placa.png'); // a placa: madeira escura, moldura e letras douradas (fonte DejaVu Serif, livre)
  execFileSync('python3', ['-c', `from PIL import Image, ImageDraw, ImageFont\nim=Image.new('RGB',(1024,256),(58,36,20))\nd=ImageDraw.Draw(im)\nd.rectangle([12,12,1011,243],outline=(201,162,58),width=14)\nf=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',86)\nt='CASA DO COMÉRCIO'\nw=d.textlength(t,font=f)\nd.text(((1024-w)/2,74),t,fill=(232,195,90),font=f)\nim.save(r'${placa}')`]);
  MAT_AURORA['@placa'] = comTex('Placa_Comercio', tex('T_PlacaComercio', fs.readFileSync(placa)));
}
// caixa de 1 x 1 x 1 (chão em y = 0, meio em x e z) com a textura inteira em cada face (a escala da peça dá o tamanho)
function caixa(add, mat, frente = mat) {
  const F = [[[0, 0, 1], frente], [[0, 0, -1], mat], [[1, 0, 0], mat], [[-1, 0, 0], mat], [[0, 1, 0], mat], [[0, -1, 0], mat]];
  for (const [[nx, ny, nz], m] of F) {
    // dois eixos da face (u para a direita de quem olha de fora, v para cima)
    const u = ny ? [1, 0, 0] : [nz || -0, 0, -nx], v = ny ? [0, 0, -ny] : [0, 1, 0];
    const c = [nx * 0.5, 0.5 + ny * 0.5, nz * 0.5], P = (a, b) => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, c[2] + u[2] * a + v[2] * b];
    const q = [[P(-0.5, -0.5), [0, 1]], [P(0.5, -0.5), [1, 1]], [P(0.5, 0.5), [1, 0]], [P(-0.5, 0.5), [0, 0]]];
    add(m, q[0], q[1], q[2]); add(m, q[0], q[2], q[3]);
  }
}
// as peças feitas aqui: listas de triângulos [[x,y,z]x3] por material
function gerar(nome) {
  const tri = {}, add = (mat, a, b, c) => (tri[mat] ||= []).push(a, b, c);
  const anel = (n, r, y, fase = 0) => Array.from({ length: n }, (_, i) => { const a = fase + i * 2 * Math.PI / n; return [Math.sin(a) * r, y, Math.cos(a) * r]; });
  if (nome === '@cristal') { // seis faces, ponta comprida em cima e curta embaixo (altura 2 m, base 0)
    const meio = anel(6, 0.42, 0.55), cima = [0, 2, 0], baixo = [0, 0, 0];
    for (let i = 0; i < 6; i++) { const a = meio[i], b = meio[(i + 1) % 6]; add('@cristal', a, b, cima); add('@cristal', b, a, baixo); }
  } else if (nome === '@canto' || nome === '@canto_rio') { // pilar de canto de 0,4 x 3,05 m (no lugar do Corner_Exterior_Brick)
    const q = 0.2, y = 3.05, P = [[-q, -q], [q, -q], [q, q], [-q, q]], M = nome === '@canto' ? 'MI_UnevenBrick' : '@pedra'; // @pedra: a pedra do kit, sem clarear
    for (let i = 0; i < 4; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % 4]; add(M, [ax, 0, az], [ax, y, az], [bx, y, bz]); add(M, [ax, 0, az], [bx, y, bz], [bx, 0, bz]); }
    add(M, [-q, y, -q], [q, y, q], [q, y, -q]); add(M, [-q, y, -q], [-q, y, q], [q, y, q]);
  } else if (nome === '@coluna') { // coluna de pedra da arcada da Casa do Comércio (2026-11-18): base, fuste e capitel, 3 m
    const bloco = (x, y0, y1) => caixa((m, ...v) => add(m, ...v.map(([q, t]) => [[q[0] * x, y0 + q[1] * (y1 - y0), q[2] * x], t])), '@pedra');
    bloco(0.62, 0, 0.35); bloco(0.46, 0.35, 2.62); bloco(0.62, 2.62, 2.8);
  } else if (nome === '@viga') { // viga de madeira (caixa 1 x 1 x 1; a escala dá o tamanho)
    caixa(add, '@madeira');
  } else if (nome === '@quadro') { // quadro de contratos da Guilda, preso na parede acima da cabeça: 2,2 x 1,3 m e os papéis
    const bloco = (m, x0, x1, y0, y1, z0, z1) => caixa((mm, ...v) => add(mm, ...v.map(([q, t]) => [[x0 + (q[0] + 0.5) * (x1 - x0), y0 + q[1] * (y1 - y0), z0 + (q[2] + 0.5) * (z1 - z0)], t])), m);
    bloco('@tampo', -1.1, 1.1, 1.55, 2.85, 0, 0.06);
    for (const [x0, x1, y0, y1] of [[-1.17, 1.17, 1.48, 1.56], [-1.17, 1.17, 2.84, 2.92], [-1.17, -1.09, 1.48, 2.92], [1.09, 1.17, 1.48, 2.92]]) bloco('@madeira', x0, x1, y0, y1, 0, 0.1);
    for (const [x, y, w, h] of [[-0.78, 2.5, 0.42, 0.5], [-0.24, 2.55, 0.38, 0.44], [0.3, 2.48, 0.44, 0.52], [0.8, 2.53, 0.36, 0.42],
      [-0.7, 1.9, 0.4, 0.5], [-0.15, 1.88, 0.44, 0.46], [0.4, 1.94, 0.38, 0.48], [0.86, 1.86, 0.3, 0.4]])
      bloco('@papel', x - w / 2, x + w / 2, y - h / 2, y + h / 2, 0.06, 0.075);
  } else if (nome === '@agua') { // disco de raio 1
    const r = anel(20, 1, 0);
    for (let i = 0; i < 20; i++) add('@agua', [0, 0, 0], r[i], r[(i + 1) % 20]);
  } else if (nome === '@balcao') { // balcão: corpo de madeira e tampo escuro (o tampo passa 5 cm de cada lado)
    const a = (m, ...v) => add(m, ...v.map(([p, t]) => [[p[0], p[1] * 0.93, p[2]], t]));
    caixa(a, '@madeira');
    caixa((m, ...v) => add(m, ...v.map(([p, t]) => [[p[0] * 1.06, 0.93 + p[1] * 0.07, p[2] * 1.2], t])), '@tampo');
  } else if (nome.startsWith('@tapete_')) { // tapete com barra dourada
    const cor = '@' + nome.slice(8);
    caixa((m, ...v) => add(m, ...v.map(([p, t]) => [[p[0], p[1] * 0.03, p[2]], t])), cor);
    caixa((m, ...v) => add(m, ...v.map(([p, t]) => [[p[0] * 1.08, p[1] * 0.02 - 0.004, p[2] * 1.02], t])), '@ouro');
  } else if (nome === '@placa') {
    caixa((m, ...v) => add(m, ...v.map(([p, t]) => [[p[0], p[1] - 0.5, p[2]], t])), '@tampo', '@placa');
  } else if (nome === '@lampiao') { // poste de rua do Rio Claro (André 2026-11-17): pé de pedra, haste de ferro, braço
    // com duas lanternas penduradas (vidro Vidro_Rio: acende de noite, vilas_mundo.gd) e a ponta em cima. Altura 3,4 m.
    const prisma = (m, n, r0, r1, y0, y1) => { const a = anel(n, r0, y0, Math.PI / n), b = anel(n, r1, y1, Math.PI / n);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; add(m, a[i], a[j], b[j]); add(m, a[i], b[j], b[i]); }
      if (r1 > 0.001) for (let i = 0; i < n; i++) add(m, b[i], b[(i + 1) % n], [0, y1, 0]); };
    // bloco com textura (pedra: [ponto, uv]) ou de cor só (ferro: só o ponto; cada material tem um jeito só na lista)
    const bloco = (m, x0, x1, y0, y1, z0, z1, uv = m !== '@ferro_rio') => caixa((mm, ...v) => add(mm, ...v.map(([q, t]) => { const P = [x0 + (q[0] + 0.5) * (x1 - x0), y0 + q[1] * (y1 - y0), z0 + (q[2] + 0.5) * (z1 - z0)]; return uv ? [P, t] : P; })), m);
    bloco('@pedra', -0.24, 0.24, 0, 0.5, -0.24, 0.24);
    bloco('@pedra', -0.3, 0.3, 0.5, 0.58, -0.3, 0.3);
    prisma('@ferro_rio', 6, 0.11, 0.11, 0.58, 0.68); prisma('@ferro_rio', 6, 0.065, 0.055, 0.68, 3.0);
    prisma('@ferro_rio', 6, 0.09, 0.09, 2.96, 3.06); prisma('@ferro_rio', 6, 0.05, 0, 3.06, 3.4);
    const v = (m, ...q) => add(m, ...q);
    for (const s of [-1, 1]) {
      const x0 = s * 0.06, x1 = s * 0.62; // braço com um arco por baixo
      const B = [[x0, 3.0, -0.03], [x1, 3.0, -0.03], [x1, 3.05, -0.03], [x0, 3.05, -0.03], [x0, 3.0, 0.03], [x1, 3.0, 0.03], [x1, 3.05, 0.03], [x0, 3.05, 0.03]];
      for (const [a, b, c, d] of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) { v('@ferro_rio', B[a], B[b], B[c]); v('@ferro_rio', B[a], B[c], B[d]); }
      const arco = Array.from({ length: 5 }, (_, i) => { const t = i / 4; return [x0 + (x1 - x0) * t * 0.8, 2.72 + 0.28 * Math.sin(t * Math.PI / 2), 0]; });
      for (let i = 0; i < 4; i++) { const a = arco[i], b = arco[i + 1]; v('@ferro_rio', [a[0], a[1], -0.02], [b[0], b[1], -0.02], [b[0], b[1], 0.02]); v('@ferro_rio', [a[0], a[1], -0.02], [b[0], b[1], 0.02], [a[0], a[1], 0.02]);
        v('@ferro_rio', [a[0], a[1], 0.02], [b[0], b[1], 0.02], [b[0], b[1], -0.02]); v('@ferro_rio', [a[0], a[1], 0.02], [b[0], b[1], -0.02], [a[0], a[1], -0.02]); }
      const cx = s * 0.56; // a lanterna pendurada: gancho, tampa, vidro e base
      const sh = (q) => [q[0] + cx, q[1], q[2]];
      bloco('@ferro_rio', cx - 0.012, cx + 0.012, 2.9, 3.0, -0.012, 0.012);
      const t0 = anel(6, 0.17, 2.86, Math.PI / 6).map(sh), topo = [cx, 2.98, 0], g0 = anel(6, 0.12, 2.56, Math.PI / 6).map(sh), g1 = anel(6, 0.14, 2.86, Math.PI / 6).map(sh), f0 = anel(6, 0.1, 2.52, Math.PI / 6).map(sh);
      for (let i = 0; i < 6; i++) { const j = (i + 1) % 6;
        v('@ferro_rio', t0[i], t0[j], topo); v('@ferro_rio', t0[j], t0[i], [cx, 2.86, 0]);
        v('@vidro_rio', g0[i], g0[j], g1[j]); v('@vidro_rio', g0[i], g1[j], g1[i]);
        v('@ferro_rio', f0[i], f0[j], g0[j]); v('@ferro_rio', f0[i], g0[j], g0[i]); v('@ferro_rio', f0[j], f0[i], [cx, 2.52, 0]); }
    }
  } else if (nome === '@lanterna') { // prisma de vidro (0,3 m) com tampa e base de ferro
    const b0 = anel(6, 0.11, -0.15, Math.PI / 6), b1 = anel(6, 0.11, 0.15, Math.PI / 6), t = anel(6, 0.15, 0.15, Math.PI / 6), f = anel(6, 0.13, -0.17, Math.PI / 6);
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      add('MI_WindowGlass', b0[i], b0[j], b1[j]); add('MI_WindowGlass', b0[i], b1[j], b1[i]);
      add('@ferro', t[i], t[j], [0, 0.3, 0]); add('@ferro', f[j], f[i], [0, -0.17, 0]); add('@ferro', f[i], f[j], b0[j]);
    }
  }
  return tri;
}
function porGerada(pai, nome, p, ry, s) {
  for (let [mat, L] of Object.entries(gerar(nome))) {
    const comUv = Array.isArray(L[0][0]), T = comUv ? L.map((q) => q[1]) : null;
    if (comUv) L = L.map((q) => q[0]);
    const pos = new Float32Array(L.flat()), nor = new Float32Array(L.length * 3), uv = new Float32Array(L.length * 2);
    for (let i = 0; i < L.length; i += 3) { // normal da face (flat): cristal facetado
      const [a, b, c] = [L[i], L[i + 1], L[i + 2]], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
      for (let k = 0; k < 3; k++) { // textura: de cima no chão (água), de lado nas paredes (canto), 2 m por volta
        const P = L[i + k], deLado = Math.abs(n[1] / l) < 0.5;
        nor.set(n.map((q) => q / l), (i + k) * 3);
        uv.set(T ? T[i + k] : deLado ? [(Math.abs(n[0]) > Math.abs(n[2]) ? P[2] : P[0]) / 2 + 0.5, -P[1] / 2] : [P[0] / 2 + 0.5, P[2] / 2 + 0.5], (i + k) * 2);
      }
    }
    const buf = alvo.getRoot().listBuffers()[0];
    const prim = alvo.createPrimitive()
      .setAttribute('POSITION', alvo.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
      .setAttribute('NORMAL', alvo.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf))
      .setAttribute('TEXCOORD_0', alvo.createAccessor().setType('VEC2').setArray(uv).setBuffer(buf))
      .setIndices(alvo.createAccessor().setType('SCALAR').setArray(new Uint16Array(L.map((_, i) => i))).setBuffer(buf))
      .setMaterial(MAT_AURORA[mat] || MAT_AURORA['@ferro']);
    const no = alvo.createNode(nome).setTranslation(p).setRotation([0, Math.sin(ry / 2), 0, Math.cos(ry / 2)]).setScale(Array.isArray(s) ? s : [s, s, s]).setMesh(alvo.createMesh(nome).addPrimitive(prim));
    pai.addChild(no);
  }
}

// cada arquivo do kit é lido (e simplificado) uma vez só: a cidade de Aurora usa centenas de peças
const lidas = new Map();
async function lerPeca(nome) {
  if (lidas.has(nome)) return lidas.get(nome);
  const [base, modo] = nome.split('@');
  const arq = fs.existsSync(path.join(VIL, base + '.gltf')) ? path.join(VIL, base + '.gltf') : path.join(PROPS, base + '.gltf');
  const src = await io.read(arq);
  // peça pesada (canto de pedra, caixote, carroça...): menos triângulos, com a mesma silhueta
  const tris = src.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((q, pr) => q + (pr.getIndices()?.getCount() || 0) / 3, 0), 0);
  if (modo === 'meio') { if (tris > 300) await src.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.08, 300 / tris), error: 0.02 })); } // Rio Claro: enfeite, janela e grade mais leves
  else if (modo === 'leve') await src.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: /^Roof_/.test(base) ? 0.35 : 0.1, error: 0.01 })); // Aurora: canto e telhado mais leves
  else if (tris > 1200 && !/^Roof_/.test(nome)) await src.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.2, 700 / tris), error: 0.004 }));
  lidas.set(nome, src);
  return src;
}
// põe a peça `nome` (arquivo do kit) dentro do nó pai, no lugar p = [x, y, z], girada ry (radianos) e com escala s
// (número, ou [sx, sy, sz] para achatar: a bacia da fonte é a parede de pedra baixinha)
async function por(pai, nome, p = [0, 0, 0], ry = 0, s = 1) {
  if (nome.startsWith('@')) return porGerada(pai, nome, p, ry, s);
  const src = await lerPeca(nome);
  const mapa = mergeDocuments(alvo, src);
  for (const sc of src.getRoot().listScenes()) {
    const nova = mapa.get(sc);
    const no = alvo.createNode(nome.split('@')[0]).setTranslation(p).setRotation([0, Math.sin(ry / 2), 0, Math.cos(ry / 2)]).setScale(Array.isArray(s) ? s : [s, s, s]);
    for (const filho of nova.listChildren()) { nova.removeChild(filho); no.addChild(filho); }
    pai.addChild(no);
    nova.dispose();
  }
}

for (const [nome, pecas] of Object.entries({ ...CASAS_VILA, ...ENFEITES_VILA, ...CIDADE_AURORA, ...RIO_CLARO })) {
  const no = alvo.createNode(nome);
  cena.addChild(no);
  for (const [peca, p, ry, s] of pecas) await por(no, peca, p, ry, s);
  await alvo.transform(dedup({ propertyTypes: [PropertyType.TEXTURE] })); // as texturas repetidas de cada peça saem logo (memória)
}
// só a cor: o toon do jogo não usa normal, rugosidade nem metal
for (const m of alvo.getRoot().listMaterials()) {
  if (Object.values(MAT_AURORA).includes(m)) { m.setMetallicFactor(0).setRoughnessFactor(1); continue; }
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
    // Aurora viva: a pedra, a telha e o vidro da cidade trocam pelos materiais dela
    if (casa.getName().startsWith('aurora_')) for (const pr of copia.listPrimitives()) { const nm = MAT_AURORA[pr.getMaterial()?.getName()]; if (nm) pr.setMaterial(nm); }
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
