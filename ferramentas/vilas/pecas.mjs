// As casas e os enfeites das mini vilas (ferramentas/vilas/montar.mjs junta tudo em godot-prototipo/vilas3d/vilas.glb).
// Cada entrada: nome -> [[peça do kit, [x, y, z], giro em radianos, escala], ...]. A casa fica com o meio do chão na
// origem e a porta virada para +z (o jogo gira a casa para a praça). Módulo de parede: 2 m de largura e 3 m de altura;
// o lado de fora da parede é o +z da peça.
const PI = Math.PI;
// alicerce de pedra: a mesma parede de pedra, enterrada (o topo no chão da casa). Casa em morro: aparece embaixo.
const ALICERCE = -2.4;
// casa W x D metros (W na frente, múltiplo de 2). frente/fundo/lados: lista do que vai em cada módulo, da esquerda
// para a direita olhando de fora: 'p' parede, 'j' janela, 'J' janela estreita, 'd' porta, 'g' enxaimel (grade)
// andares: quantos andares de 3 m (o de cima usa cima: { frente, fundo, esq, dir }, janela em tudo se faltar)
function casa(W, D, { estilo = 'reboco', frente, fundo, esq, dir, chamine = null, telhado = true, andares = 1, cima = {} } = {}) {
  const L = [], pedra = estilo === 'pedra';
  const parede = { p: pedra ? 'Wall_UnevenBrick_Straight' : 'Wall_Plaster_Straight', g: pedra ? 'Wall_UnevenBrick_Straight' : 'Wall_Plaster_WoodGrid',
    j: pedra ? 'Wall_UnevenBrick_Window_Wide_Round' : 'Wall_Plaster_Window_Wide_Round', J: pedra ? 'Wall_UnevenBrick_Window_Thin_Round' : 'Wall_Plaster_Window_Thin_Round',
    d: pedra ? 'Wall_UnevenBrick_Door_Round' : 'Wall_Plaster_Door_Round' };
  // um lado: centro do lado (cx, cz), giro ry, quantos módulos n e o que vai em cada um
  const lado = (cx, cz, ry, n, tipos, y = 0) => {
    const ux = Math.cos(ry), uz = -Math.sin(ry); // a direita de quem olha a parede de fora
    for (let i = 0; i < n; i++) {
      const o = -n + 1 + i * 2, x = cx + ux * o, z = cz + uz * o, t = (tipos || (y ? 'j'.repeat(n) : ''))[i] || 'p';
      L.push([parede[t] || parede.p, [x, y, z], ry]);
      if (!y) L.push(['Wall_UnevenBrick_Straight', [x, ALICERCE, z], ry]);
      const fx = Math.sin(ry) * 0.12, fz = Math.cos(ry) * 0.12; // um pouco para fora da parede
      if (t === 'j') { L.push(['Window_Wide_Round1', [x, y, z], ry]); L.push(['WindowShutters_Wide_Round_Open', [x + fx * 0.2, y, z + fz * 0.2], ry]); }
      if (t === 'J') L.push(['Window_Thin_Round1', [x, y, z], ry]);
      if (t === 'd') L.push(['Door_1_Round', [x - ux * 0.53, y, z - uz * 0.53], ry]);
    }
  };
  for (let a = 0; a < andares; a++) {
    const y = a * 3, T = a ? cima : { frente, fundo, esq, dir };
    lado(0, D / 2, 0, W / 2, T.frente, y);
    lado(0, -D / 2, PI, W / 2, T.fundo, y);
    lado(W / 2, 0, PI / 2, D / 2, T.dir, y);
    lado(-W / 2, 0, -PI / 2, D / 2, T.esq, y);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) L.push([pedra ? 'Corner_Exterior_Brick' : 'Corner_Exterior_Wood', [sx * W / 2, y, sz * D / 2], 0]);
  }
  const yt = 3 * andares;
  if (telhado) {
    L.push([`Roof_RoundTiles_${W}x${D}`, [0, yt, 0], 0]);
    L.push([`Roof_Front_Brick${W}`, [0, yt, D / 2], 0], [`Roof_Front_Brick${W}`, [0, yt, -D / 2], PI]);
  }
  if (chamine) L.push([pedra ? 'Prop_Chimney2' : 'Prop_Chimney', [chamine[0], (chamine[1] ?? 3.2) + yt - 3, chamine[2]], 0]);
  return L;
}
export const CASAS_VILA = {
  casa_4x4: casa(4, 4, { frente: 'dp', fundo: 'pj', esq: 'jp', dir: 'pj', chamine: [1, 3.4, -1.2] }),
  casa_4x6: casa(4, 6, { frente: 'jd', fundo: 'pp', esq: 'jgj', dir: 'jgj', chamine: [-1, 3.3, -2.2] }),
  casa_6x6: casa(6, 6, { frente: 'jdj', fundo: 'pJp', esq: 'jpj', dir: 'jpj', chamine: [1.8, 3.6, -1.6] }),
  pedra_4x6: casa(4, 6, { estilo: 'pedra', frente: 'Jd', fundo: 'pp', esq: 'pJp', dir: 'pJp', chamine: [1, 3.3, -2.2] }),
  pedra_6x6: casa(6, 6, { estilo: 'pedra', frente: 'JdJ', fundo: 'ppp', esq: 'pjp', dir: 'pjp', chamine: [-1.8, 3.6, -1.6] }),
  comercio: casa(6, 10, { frente: 'jdj', fundo: 'ppp', esq: 'jjgjj', dir: 'jjgjj', chamine: [1.8, 4.0, -3.5] }),
};
// ferraria aberta: quatro esteios, telhado, o muro do fundo de pedra com a chaminé (a bigorna, o forninho e a bancada
// são as estações públicas do jogo, postas por cima: shared/dados.js VILAS_MUNDO)
const forja = () => [
  ...[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => ['Corner_Exterior_Wood', [sx * 2, 0, sz * 2], 0]),
  ['Wall_UnevenBrick_Straight', [-1, 0, -2], PI], ['Wall_UnevenBrick_Straight', [1, 0, -2], PI],
  ['Wall_UnevenBrick_Straight', [-1, ALICERCE, -2], PI], ['Wall_UnevenBrick_Straight', [1, ALICERCE, -2], PI],
  ['Roof_RoundTiles_4x4', [0, 3, 0], 0], ['Roof_Front_Brick4', [0, 3, -2], PI], ['Prop_Chimney2', [1.3, 3.2, -1.6], 0],
  ['Floor_UnevenBrick', [-1, 0.02, -1], 0], ['Floor_UnevenBrick', [1, 0.02, -1], 0], ['Floor_UnevenBrick', [-1, 0.02, 1], 0], ['Floor_UnevenBrick', [1, 0.02, 1], 0],
];
// estandarte: um mastro (esteio de 3 m) com o pano pendurado
const estandarte = () => [['Corner_Exterior_Wood', [0, 0, 0], 0], ['Corner_Exterior_Wood', [0, 1.2, 0], 0], ['Banner_2_Cloth', [0, 4.1, 0.14], 0]];
export const ENFEITES_VILA = {
  forja: forja(),
  banca: [['Stall_Empty', [0, 0, 0], 0]],
  banca_carroca: [['Stall_Cart_Empty', [0, 0, 0], 0]],
  barril: [['Barrel', [0, 0, 0], 0]],
  barris: [['Barrel', [0, 0, 0], 0], ['Barrel', [0.75, 0, 0.2], 0.6], ['Barrel', [0.35, 0, -0.62], 1.3]],
  caixotes: [['Crate_Wooden', [0, 0, 0], 0], ['Crate_Wooden', [0.95, 0, 0.1], 0.3], ['Crate_Wooden', [0.4, 0.93, 0.05], 0.8]],
  banco: [['Bench', [0, 0, 0], 0]],
  mesa: [['Table_Large', [0, 0, 0], 0], ['Bench', [0, 0, 0.85], 0], ['Bench', [0, 0, -0.85], PI]],
  estandarte: estandarte(),
  carroca: [['Prop_Wagon', [0, 0, 0], 0]],
  cerca: [['Prop_WoodenFence_Single', [0, 0, 0], 0]],
  bigorna_enfeite: [['Anvil', [0, 0, 0], 0], ['Barrel', [1.0, 0, -0.3], 0]],
  armas: [['WeaponStand', [0, 0, 0], 0]],
};

// Aurora viva (André 2026-11-12, esboço aprovado: /mnt/project-files/historia/aurora-viva-v1.jpg): a cidade de pedra
// branca em volta dos bairros. Tudo que começa com "aurora_" sai com a pedra clareada, o telhado de ardósia azul e o
// vidro das janelas próprio da cidade (montar.mjs troca o material): escuro antes do fim da história, aceso depois
// (vilas_mundo.gd). As peças com "@" são feitas aqui mesmo (montar.mjs): @cristal (cristal de seis faces),
// @agua (espelho d'água redondo) e @lanterna (lanterna de parede de vidro, com tampa de ferro).
// lanterna dos dois lados da porta: i = módulo da porta na frente (da esquerda para a direita), n = módulos da frente
const lanternas = (W, D, i, y = 0) => { const x = -W / 2 + 1 + i * 2; return [['@lanterna', [x - 1.15, y + 2.25, D / 2 + 0.16], 0], ['@lanterna', [x + 1.15, y + 2.25, D / 2 + 0.16], 0]]; };
// sacada no andar de cima, na frente (módulos de 2 m)
const sacada = (W, D, mods) => mods.map((i) => ['Balcony_Simple_Straight', [-W / 2 + 1 + i * 2, 3, D / 2 - 0.9], 0]);
// torre de cristal: 4 x 4, três andares de pedra branca, telhado de torre e o cristal flutuando em cima
const torre = () => [
  ...casa(4, 4, { estilo: 'pedra', frente: 'dp', fundo: 'pp', esq: 'pp', dir: 'pp', andares: 3, cima: { frente: 'pJ', fundo: 'Jp', esq: 'pp', dir: 'pp' }, telhado: false }),
  ['Roof_Tower_RoundTiles', [0, 9, 0], 0],
  ['@cristal', [0, 16.4, 0], 0, 1.4], ['@lanterna', [1.15, 2.25, 2.16], 0],
];
// Portão do Mar: dois pilares de 2 x 2 (6 m) e a ponte de pedra por cima da estrada (vão de 6 m), estandartes e cristal
function portao() {
  const L = [];
  for (const sx of [-4, 4]) for (const y of [0, 3]) {
    L.push(['Wall_UnevenBrick_Straight', [sx, y, 1], 0], ['Wall_UnevenBrick_Straight', [sx, y, -1], PI],
      ['Wall_UnevenBrick_Straight', [sx + 1, y, 0], PI / 2], ['Wall_UnevenBrick_Straight', [sx - 1, y, 0], -PI / 2]);
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) L.push(['Corner_Exterior_Brick', [sx + a, y, b], 0]);
    if (!y) L.push(['Wall_UnevenBrick_Straight', [sx, ALICERCE, 1], 0], ['Wall_UnevenBrick_Straight', [sx, ALICERCE, -1], PI]);
  }
  for (const x of [-2, 0, 2]) L.push(['Wall_UnevenBrick_Straight', [x, 3, 1], 0], ['Wall_UnevenBrick_Straight', [x, 3, -1], PI], ['Floor_UnevenBrick', [x, 3.02, 0], 0]);
  for (const x of [-4, -2, 0, 2, 4]) L.push(['Floor_UnevenBrick', [x, 6.02, 0], 0]);
  L.push(['Banner_2_Cloth', [-4, 5.7, 1.2], 0], ['Banner_2_Cloth', [4, 5.7, 1.2], 0], ['Banner_2_Cloth', [-4, 5.7, -1.2], PI], ['Banner_2_Cloth', [4, 5.7, -1.2], PI]);
  L.push(['@cristal', [0, 6.1, 0], 0, 1.1], ['@lanterna', [-2.85, 2.4, 1.16], 0], ['@lanterna', [2.85, 2.4, 1.16], 0]);
  return L;
}
// Fonte da Praça das Luzes: bacia de oito lados de pedra branca, espelho d'água e a Chama de Aethra no pedestal
function fonte() {
  const L = [];
  for (let k = 0; k < 8; k++) {
    const a = k * PI / 4, r = 2.414;
    L.push(['Wall_UnevenBrick_Straight', [Math.sin(a) * r, 0, Math.cos(a) * r], a, [1.0, 0.26, 1.0]]);
    L.push(['Prop_ExteriorBorder_Straight1', [Math.sin(a) * 1.95, 0.8, Math.cos(a) * 1.95], a, [1.0, 1.0, 1.0]]);
  }
  for (const [x, z, ry] of [[0, 0.4, 0], [0, -0.4, PI], [0.4, 0, PI / 2], [-0.4, 0, -PI / 2]]) L.push(['Wall_UnevenBrick_Straight', [x, 0, z], ry, [0.4, 0.45, 1.0]]);
  L.push(['Floor_UnevenBrick', [0, 1.41, 0], 0, [0.45, 1, 0.45]]);
  L.push(['@agua', [0, 0.62, 0], 0, [2.25, 1, 2.25]]);
  L.push(['@cristal', [0, 1.45, 0], 0, 1.25], ['@cristal', [0.32, 1.42, 0.2], 0.6, 0.45], ['@cristal', [-0.3, 1.42, -0.22], 2.1, 0.38]);
  return L;
}
// mais leve para o celular (a cidade tem ~20 prédios): sem postigo, janela reta no andar de cima, sacada de grade,
// canto de pedra e telhado simplificados (montar.mjs: peça com "@leve" sai com menos triângulos)
const leve = (L) => L.filter(([n]) => !n.startsWith('WindowShutters')).map(([n, p, ry, s]) => {
  if (/^Roof_(RoundTiles|Tower)/.test(n)) n += '@leve';
  if (n === 'Corner_Exterior_Brick') n = '@canto'; // o canto do kit tem 3 mil triângulos: aqui é um pilar de pedra branca
  if (n === 'Window_Thin_Round1') n = 'Window_Wide_Round1';
  if (n === 'Wall_UnevenBrick_Window_Thin_Round') n = 'Wall_UnevenBrick_Window_Wide_Round';
  if (p[1] >= 3 && n === 'Window_Wide_Round1') n = 'Window_Wide_Flat1';
  if (p[1] >= 3 && n === 'Wall_UnevenBrick_Window_Wide_Round') n = 'Wall_UnevenBrick_Window_Wide_Flat';
  if (n === 'Balcony_Simple_Straight') n = 'Balcony_Cross_Straight';
  return [n, p, ry, s];
});
export const CIDADE_AURORA = {
  aurora_casa: [...casa(4, 6, { estilo: 'pedra', frente: 'Jd', fundo: 'pp', esq: 'pjp', dir: 'pjp', chamine: [1, 3.3, -2.2] }), ...lanternas(4, 6, 1)],
  aurora_sobrado: [...casa(4, 4, { estilo: 'pedra', frente: 'jd', fundo: 'pJ', esq: 'jp', dir: 'pj', andares: 2, cima: { frente: 'jj', fundo: 'pJ', esq: 'Jp', dir: 'pJ' }, chamine: [1, 3.4, -1.2] }), ...lanternas(4, 4, 1)],
  aurora_sobrado2: [...casa(4, 4, { estilo: 'pedra', frente: 'dj', fundo: 'Jp', esq: 'pj', dir: 'jp', andares: 2, cima: { frente: 'jj', fundo: 'Jp', esq: 'pJ', dir: 'Jp' } }), ...sacada(4, 4, [0, 1]), ...lanternas(4, 4, 0)],
  aurora_pousada: [...casa(8, 12, { estilo: 'pedra', frente: 'jdjj', fundo: 'pJJp', esq: 'pjppjp', dir: 'pjppjp', andares: 2, cima: { frente: 'jjjj', fundo: 'pjjp', esq: 'jppjpp', dir: 'ppjppj' }, chamine: [2.5, 3.6, -4] }),
    ...sacada(8, 12, [0, 1, 2, 3]), ...lanternas(8, 12, 1)],
  aurora_templo: [...casa(8, 12, { estilo: 'pedra', frente: 'JddJ', fundo: 'pppp', esq: 'pJppJp', dir: 'pJppJp', andares: 2, cima: { frente: 'pjjp', fundo: 'pppp', esq: 'pjppjp', dir: 'pjppjp' } }),
    ...lanternas(8, 12, 1), ...lanternas(8, 12, 2), ['@cristal', [0, 12.15, 6.3], 0, 1.2]],
  aurora_paco: [...casa(8, 14, { estilo: 'pedra', frente: 'jddj', fundo: 'pppp', esq: 'pjppjpp', dir: 'ppjppjp', andares: 2, cima: { frente: 'jjjj', fundo: 'pjjp', esq: 'pjppjpp', dir: 'ppjppjp' }, chamine: [-2.5, 3.6, -5] }),
    ...sacada(8, 14, [1, 2]), ...lanternas(8, 14, 1), ...lanternas(8, 14, 2), ['Banner_2_Cloth', [-3.2, 5.6, 7.2], 0], ['Banner_2_Cloth', [3.2, 5.6, 7.2], 0], ['@cristal', [0, 12.15, 7.3], 0, 1.3]],
  aurora_torre: torre(),
  aurora_portao: portao(),
  aurora_fonte: fonte(),
  // só para o jogo pegar o material do calçamento (vilas_mundo.gd faz a praça e as ruas com ele)
  aurora_chao: [['Floor_Brick', [0, 0, 0], 0]],
};
for (const k of Object.keys(CIDADE_AURORA)) CIDADE_AURORA[k] = leve(CIDADE_AURORA[k]);

// Vila do Rio Claro, o centro comercial de Aethra (André 2026-11-16: "uma casa grande que a gente pudesse entrar, com
// um balcão e o leiloeiro atrás; nos corredores o NPC de resetar build e a alquimista"; esboço:
// /mnt/project-files/vila-comercio/). A Casa do Comércio grande: nave de 8 x 20 m com dois andares (6 m) e os arcos
// abertos para os dois corredores de 4 x 20 m (3 m), duas torres de pedra de 9 m na frente, sacada e placa. Entra-se a pé
// pelos dois arcos do meio da frente. Porta virada para +z, como as outras casas. Sai em dois modelos: comercio_grande
// (térreo e chão), comercio_grande_dentro (balcão, móveis e tapetes: só aparece de perto e não faz sombra) e
// comercio_grande_cima (andar de cima, galeria, lustres, telhados e o alto das torres): com o herói lá dentro e a câmera
// lá no alto (visão do alto), o de cima some (vilas_mundo.gd), como o telhado da casa do jogador.
function casaDoComercio() {
  const base = [], cima = [], dentro = [];
  const P = { p: 'Wall_UnevenBrick_Straight', j: 'Wall_UnevenBrick_Window_Wide_Round', J: 'Wall_UnevenBrick_Window_Thin_Round', a: 'Wall_Plaster_Door_RoundInset',
    g: 'Wall_Plaster_WoodGrid', W: 'Wall_Plaster_Window_Wide_Round' };
  // um lado: centro (cx, cz), giro ry, n módulos de 2 m, tipos da esquerda para a direita (de fora), altura y
  const lado = (L, cx, cz, ry, n, tipos, y = 0) => {
    const ux = Math.cos(ry), uz = -Math.sin(ry), fx = Math.sin(ry) * 0.024, fz = Math.cos(ry) * 0.024;
    for (let i = 0; i < n; i++) {
      const o = -n + 1 + i * 2, x = cx + ux * o, z = cz + uz * o, k = tipos[i] || 'p';
      L.push([P[k], [x, y, z], ry]);
      if (!y && k !== 'a') L.push(['Wall_UnevenBrick_Straight', [x, ALICERCE, z], ry]);
      if (k === 'j' || k === 'W') { L.push([y ? 'Window_Wide_Flat1' : 'Window_Wide_Round1', [x, y, z], ry]); if (!y) L.push(['WindowShutters_Wide_Round_Open', [x + fx, y, z + fz], ry]); }
      if (k === 'J') L.push(['Window_Thin_Round1', [x, y, z], ry]);
    }
  };
  // térreo: nave (frente com os dois arcos abertos no meio), arcos para os corredores e as paredes de fora
  lado(base, 0, 10, 0, 4, 'paap');
  lado(base, 0, -10, PI, 4, 'pppp');
  lado(base, 4, 0, PI / 2, 10, 'aaaaaaaaaa');
  lado(base, -4, 0, -PI / 2, 10, 'aaaaaaaaaa');
  for (const sx of [-6, 6]) { lado(base, sx, 10, 0, 2, 'jj'); lado(base, sx, -10, PI, 2, 'pp'); }
  lado(base, 8, 0, PI / 2, 10, 'pjpjppjpjp');
  lado(base, -8, 0, -PI / 2, 10, 'pjpjppjpjp');
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) base.push(['Corner_Exterior_Brick', [sx * 8, 0, sz * 10], 0]);
  for (const sx of [-1, 1]) base.push(['Corner_Exterior_Brick', [sx * 4, 0, 10], 0]);
  // andar de cima da nave: reboco com enxaimel e as janelas altas que iluminam o salão
  lado(cima, 0, 10, 0, 4, 'WggW', 3);
  lado(cima, 0, -10, PI, 4, 'gWWg', 3);
  lado(cima, 4, 0, PI / 2, 10, 'gWgWgWgWgW', 3);
  lado(cima, -4, 0, -PI / 2, 10, 'WgWgWgWgWg', 3);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) cima.push(['Corner_Exterior_Wood', [sx * 4, 3, sz * 10], 0]);
  // as duas torres (4 x 4 m, três andares) nas pontas da frente, com telhado de torre e estandarte
  for (const sx of [-10, 10]) {
    const s = Math.sign(sx);
    for (const y of [0, 3, 6]) {
      const L = y ? cima : base;
      lado(L, sx, 10, 0, 2, y === 6 ? 'JJ' : y ? 'pJ' : 'pp', y);
      lado(L, sx, 6, PI, 2, y === 6 ? 'JJ' : 'pp', y);
      lado(L, sx + s * 2, 8, s * PI / 2, 2, y ? 'Jp' : 'pp', y);
      if (y) lado(L, sx - s * 2, 8, -s * PI / 2, 2, 'pp', y);
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) L.push(['Corner_Exterior_Brick', [sx + a * 2, y, 8 + b * 2], 0]);
    }
    cima.push(['Roof_Tower_RoundTiles', [sx, 9, 8], 0], ['Banner_2_Cloth', [sx, 8.4, 10.2], 0, 1.4]);
  }
  // sacada de madeira na frente, com a placa da casa no meio; estandartes e lanternas na fachada
  for (let i = 0; i < 4; i++) cima.push(['Balcony_Simple_Straight', [-3 + i * 2, 3, 9.1], 0]);
  cima.push(['@placa', [0, 3.55, 10.35], 0, [3.6, 0.9, 0.08]]);
  cima.push(['Banner_1_Cloth', [-2.6, 5.7, 10.2], 0], ['Banner_1_Cloth', [2.6, 5.7, 10.2], 0]);
  base.push(['Banner_2_Cloth', [-6, 2.8, 10.2], 0], ['Banner_2_Cloth', [6, 2.8, 10.2], 0], ['Lantern_Wall', [-2.6, 1.9, 10.1], 0], ['Lantern_Wall', [2.6, 1.9, 10.1], 0]);
  // galeria de madeira em volta do salão, na altura do andar de cima, com grade
  for (const sx of [-3, 3]) for (let z = -9; z <= 9; z += 2) cima.push(['Floor_WoodDark', [sx, 3.0, z], 0], ['Balcony_Simple_Straight', [sx - Math.sign(sx) * 1.9, 3.0, z], Math.sign(sx) * PI / 2]);
  // telhados: a nave (8 x 20, duas peças de 8 x 10) e os corredores um pouco para fora e mais estreitos (a beira de
  // dentro não entra no salão)
  cima.push(['Roof_RoundTiles_8x10', [0, 6, 5], 0], ['Roof_RoundTiles_8x10', [0, 6, -5], 0], ['Roof_Front_Brick8', [0, 6, 10], 0], ['Roof_Front_Brick8', [0, 6, -10], PI]);
  for (const sx of [-6.6, 6.6]) {
    const e = [0.82, 1, 1];
    cima.push(['Roof_RoundTiles_4x8', [sx, 3, 6], 0, e], ['Roof_RoundTiles_4x6', [sx, 3, -1], 0, e], ['Roof_RoundTiles_4x6', [sx, 3, -7], 0, e],
      ['Roof_Front_Brick4', [sx, 3, 10], 0, e], ['Roof_Front_Brick4', [sx, 3, -10], PI, e]);
  }
  cima.push(['Prop_Chimney2', [6.6, 4.6, -8], 0], ['Chandelier', [0, 5.6, -2], 0, 1.6], ['Chandelier', [0, 5.6, 5], 0, 1.6]);
  // chão de tábua escura no salão todo e pedra na soleira
  for (let x = -7; x <= 7; x += 2) for (let z = -9; z <= 9; z += 2) base.push(['Floor_WoodDark', [x, 0.02, z], 0]);
  for (const x of [-1, 1]) base.push(['Floor_UnevenBrick', [x, 0.03, 11], 0]);
  // DENTRO: o balcão do Otávio atravessa a nave no fundo (shared/vilas.js COMERCIO_GRANDE.balcao tem o mesmo tamanho)
  dentro.push(['@balcao', [0, 0, -5.5], 0, [6.4, 1.1, 0.9]]);
  dentro.push(['Coin_Pile', [-1.6, 1.12, -5.4], 0, 2.2], ['Coin_Pile_2', [1.8, 1.12, -5.5], 0.6, 2], ['Scroll_1', [0.4, 1.12, -5.4], 0.3, 1.4],
    ['CandleStick_Triple', [-2.8, 1.12, -5.6], 0], ['CandleStick_Triple', [2.8, 1.12, -5.6], 0]);
  // atrás do Otávio: estantes, cofre com moedas, caixotes e o estandarte da casa
  dentro.push(['Bookcase_2', [-2.2, 0, -9.6], 0], ['Bookcase_2', [2.2, 0, -9.6], 0], ['Chest_Wood', [0, 0, -9.1], 0], ['Coin_Pile', [-0.3, 0.7, -9.1], 0, 2.5],
    ['Chest_Wood', [-3.3, 0, -8.2], PI / 2], ['Crate_Wooden', [3.3, 0, -8.6], 0.2], ['Crate_Wooden', [3.2, 0.93, -8.6], 0.6], ['Banner_1_Cloth', [0, 5.3, -9.75], 0, 1.6]);
  // corredor oeste: a Mestra Iara (resetar build), com bonecos de treino, armas e o livro
  dentro.push(['Dummy', [-6.2, 0, -7.5], 0.3], ['Dummy', [-6.4, 0, -5.4], -0.2], ['WeaponStand', [-7.4, 0, -3.2], PI / 2], ['BookStand', [-5.2, 0, -2.4], 0.6],
    ['Banner_2_Cloth', [-7.85, 2.7, -4.5], PI / 2], ['@tapete_vinho', [-6, 0.04, -4.5], 0, [2.8, 1, 4.2]]);
  // corredor leste: a Mirela (alquimia), com o caldeirão, estantes de frascos e a bancada
  dentro.push(['Cauldron', [6, 0, -6.5], 0], ['Shelf_Small_Bottles', [7.7, 1.2, -5.0], -PI / 2], ['Shelf_Small_Bottles', [7.7, 1.9, -5.0], -PI / 2], ['Shelf_Small_Bottles', [7.7, 1.2, -7.6], -PI / 2],
    ['Workbench', [6.6, 0, -3.0], -PI / 2], ['Potion_1', [6.5, 0.9, -3.2], 0], ['Potion_2', [6.7, 0.9, -2.7], 0], ['SmallBottles_1', [6.5, 0.9, -3.6], 0],
    ['CandleStick_Stand', [5.0, 0, -8.6], 0], ['Banner_2_Cloth', [7.85, 2.7, -6], -PI / 2], ['@tapete_roxo', [6, 0.04, -5], 0, [2.8, 1, 4.6]]);
  // o salão: tapete vermelho da entrada até o balcão, bancos e mercadoria nos corredores da frente
  dentro.push(['@tapete_vermelho', [0, 0.04, 2.5], 0, [2.6, 1, 14]]);
  dentro.push(['Bench', [-6.5, 0, 4], PI / 2], ['Bench', [-6.5, 0, 7], PI / 2], ['Barrel', [7.2, 0, 8.8], 0], ['Barrel_Apples', [6.4, 0, 9], 0], ['FarmCrate_Apple', [7.3, 0, 6.6], 1.2],
    ['Crate_Wooden', [7.2, 0, 3.4], 0.3], ['Chest_Wood', [6.0, 0, 1.2], 0.1]);
  return { comercio_grande: base, comercio_grande_cima: cima, comercio_grande_dentro: dentro };
}
// sobrados de enfeite (dois andares, sacada): ninguém mora, só deixam a rua com cara de cidade
// mais leve para o celular (a vila tem ~15 prédios e o salão grande): canto de pedra vira pilar simples, sem postigo,
// telhado, janela, grade e enfeites simplificados (montar.mjs: "@leve" e "@meio" saem com menos triângulos)
const leveRio = (L) => L.filter(([n]) => !n.startsWith('WindowShutters')).map(([n, p, ry, s]) => {
  if (n === 'Corner_Exterior_Brick') n = '@canto_rio';
  else if (n === 'Balcony_Simple_Straight') n = 'Balcony_Cross_Straight@meio';
  else if (/^Roof_(RoundTiles|Tower)/.test(n)) n += '@leve';
  else if (!n.startsWith('@') && !/^(Wall_|Floor_|Roof_Front|Corner_Exterior_Wood|Banner_)/.test(n)) n += '@meio';
  return [n, p, ry, s];
});
export const RIO_CLARO = {
  ...casaDoComercio(),
  sobrado_4x6: [...casa(4, 6, { frente: 'jd', fundo: 'pp', esq: 'jgj', dir: 'jgj', andares: 2, cima: { frente: 'jj', fundo: 'gg', esq: 'jgj', dir: 'jgj' }, chamine: [-1, 3.3, -2.2] }), ...sacada(4, 6, [0, 1])],
  sobrado_6x6: [...casa(6, 6, { estilo: 'pedra', frente: 'jdj', fundo: 'pJp', esq: 'jpj', dir: 'jpj', andares: 2, cima: { frente: 'jjj', fundo: 'pjp', esq: 'jpj', dir: 'jpj' }, chamine: [1.8, 3.6, -1.6] }), ...sacada(6, 6, [1])],
  sobrado_4x4: casa(4, 4, { frente: 'dj', fundo: 'pJ', esq: 'jp', dir: 'pj', andares: 2, cima: { frente: 'gj', fundo: 'Jg', esq: 'gj', dir: 'jg' } }),
  // bancas da Rua do Mercado com a mercadoria (os vendedores são NPCs de enfeite: shared/dados.js)
  banca_frutas: [['Stall_Empty', [0, 0, 0], 0], ['FarmCrate_Apple', [-0.4, 0.98, 0.15], 0.3], ['Barrel_Apples', [0.9, 0, 0.9], 0]],
  banca_tecidos: [['Stall_Cart_Empty', [0, 0, 0], 0], ['Bag', [-0.4, 0.98, 0.15], 0.3], ['Bag', [0.9, 0, 0.9], 0]],
  banca_peixe: [['Stall_Empty', [0, 0, 0], 0], ['Bucket_Wooden_1', [-0.4, 0.98, 0.15], 0.3], ['Barrel', [0.9, 0, 0.9], 0]],
  banca_ceramica: [['Stall_Cart_Empty', [0, 0, 0], 0], ['Vase_2', [-0.4, 0.98, 0.15], 0.3], ['Pot_1', [0.9, 0, 0.9], 0]],
  banca_temperos: [['Stall_Empty', [0, 0, 0], 0], ['FarmCrate_Carrot', [-0.4, 0.98, 0.15], 0.3], ['Bag', [0.9, 0, 0.9], 0]],
  // carroça de carga parada (o cavalo é o modelo animado res://animais/cavalo.glb, posto pelo jogo na frente dela)
  carroca_carga: [['Prop_Wagon', [0, 0, 0], 0], ['Crate_Wooden', [-0.1, 0.62, -2.75], 0.3], ['Barrel', [0.3, 0.62, -2.05], 0]], // a carga em cima da caçamba
  // poste de lanterna e a pilha de carga do pátio das caravanas
  poste: [['Corner_Exterior_Wood', [0, 0, 0], 0], ['Lantern_Wall', [0, 2.4, 0.18], 0]],
  carga: [['Crate_Wooden', [0, 0, 0], 0], ['Crate_Wooden', [1, 0, 0.2], 0.4], ['Crate_Wooden', [0.5, 0.93, 0.1], 0.2], ['Barrel', [-1.2, 0, 0.6], 0], ['Barrel', [-1.4, 0, -0.4], 0]],
  // só para o jogo pegar o material da calçada de pedra (vilas_mundo.gd faz a praça e a Rua do Mercado com ele)
  rio_chao: [['Floor_Brick', [0, 0, 0], 0]],
};
for (const k of Object.keys(RIO_CLARO)) RIO_CLARO[k] = leveRio(RIO_CLARO[k]);
