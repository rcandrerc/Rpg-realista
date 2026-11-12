// As casas e os enfeites das mini vilas (ferramentas/vilas/montar.mjs junta tudo em godot-prototipo/vilas3d/vilas.glb).
// Cada entrada: nome -> [[peça do kit, [x, y, z], giro em radianos, escala], ...]. A casa fica com o meio do chão na
// origem e a porta virada para +z (o jogo gira a casa para a praça). Módulo de parede: 2 m de largura e 3 m de altura;
// o lado de fora da parede é o +z da peça.
const PI = Math.PI;
// alicerce de pedra: a mesma parede de pedra, enterrada (o topo no chão da casa). Casa em morro: aparece embaixo.
const ALICERCE = -2.4;
// casa W x D metros (W na frente, múltiplo de 2). frente/fundo/lados: lista do que vai em cada módulo, da esquerda
// para a direita olhando de fora: 'p' parede, 'j' janela, 'J' janela estreita, 'd' porta, 'g' enxaimel (grade)
function casa(W, D, { estilo = 'reboco', frente, fundo, esq, dir, chamine = null, telhado = true } = {}) {
  const L = [], pedra = estilo === 'pedra';
  const parede = { p: pedra ? 'Wall_UnevenBrick_Straight' : 'Wall_Plaster_Straight', g: pedra ? 'Wall_UnevenBrick_Straight' : 'Wall_Plaster_WoodGrid',
    j: pedra ? 'Wall_UnevenBrick_Window_Wide_Round' : 'Wall_Plaster_Window_Wide_Round', J: pedra ? 'Wall_UnevenBrick_Window_Thin_Round' : 'Wall_Plaster_Window_Thin_Round',
    d: pedra ? 'Wall_UnevenBrick_Door_Round' : 'Wall_Plaster_Door_Round' };
  // um lado: centro do lado (cx, cz), giro ry, quantos módulos n e o que vai em cada um
  const lado = (cx, cz, ry, n, tipos) => {
    const ux = Math.cos(ry), uz = -Math.sin(ry); // a direita de quem olha a parede de fora
    for (let i = 0; i < n; i++) {
      const o = -n + 1 + i * 2, x = cx + ux * o, z = cz + uz * o, t = (tipos || '')[i] || 'p';
      L.push([parede[t] || parede.p, [x, 0, z], ry]);
      L.push(['Wall_UnevenBrick_Straight', [x, ALICERCE, z], ry]);
      const fx = Math.sin(ry) * 0.12, fz = Math.cos(ry) * 0.12; // um pouco para fora da parede
      if (t === 'j') { L.push(['Window_Wide_Round1', [x, 0, z], ry]); L.push(['WindowShutters_Wide_Round_Open', [x + fx * 0.2, 0, z + fz * 0.2], ry]); }
      if (t === 'J') L.push(['Window_Thin_Round1', [x, 0, z], ry]);
      if (t === 'd') L.push(['Door_1_Round', [x - ux * 0.53, 0, z - uz * 0.53], ry]);
    }
  };
  lado(0, D / 2, 0, W / 2, frente);
  lado(0, -D / 2, PI, W / 2, fundo);
  lado(W / 2, 0, PI / 2, D / 2, dir);
  lado(-W / 2, 0, -PI / 2, D / 2, esq);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) L.push([pedra ? 'Corner_Exterior_Brick' : 'Corner_Exterior_Wood', [sx * W / 2, 0, sz * D / 2], 0]);
  if (telhado) {
    L.push([`Roof_RoundTiles_${W}x${D}`, [0, 3, 0], 0]);
    L.push([`Roof_Front_Brick${W}`, [0, 3, D / 2], 0], [`Roof_Front_Brick${W}`, [0, 3, -D / 2], PI]);
  }
  if (chamine) L.push([pedra ? 'Prop_Chimney2' : 'Prop_Chimney', [chamine[0], chamine[1] ?? 3.2, chamine[2]], 0]);
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
