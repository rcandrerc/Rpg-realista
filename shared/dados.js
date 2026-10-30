// Dados do jogo. Cliente e servidor leem este mesmo arquivo:
// para criar uma arma, habilidade ou inimigo novo, mexa só aqui.

// Apelidos das animações do Mixamo (nome do arquivo em client/public/assets/personagens/anims.json.gz)
export const A = {
  slash: 'mx_inward_slashing_with_a_sword_standing_st',
  slash2: 'mx_outward_slashing_with_a_sword_standing_s',
  raio: 'mx_sword_and_shield_slash_combo',
  jump: 'mx_sword_and_shield_jump_attack',
  block: 'mx_sword_and_shield_block_idle',
  swordIdle: 'mx_sword_and_shield_idle',
  bolt: 'mx_one_handed_casting_spell_fowards',
  heal: 'mx_casting_a_healing_spell_with_one_hand',
  ground: 'mx_two_handed_casting_spell_towards_ground',
  shoot: 'mx_two_handed_casting_spell_fowards', // provisório até baixar as animações de arco
  rain: 'mx_two_handed_casting_spell_upward_pull',
  hit: 'mx_large_hit_reaction_from_the_right',
  death: 'mx_sword_and_shield_falling_back_death',
  backflip: 'mortal_tras',
};

// Duração de cada animação em segundos. O servidor usa para saber quando o golpe acerta.
export const DURACAO = {
  aterrissa_queda: 1.067, espada_combo: 4.533, mortal_frente: 1.1, mortal_tras: 2.167, pulo_correndo: 1.067, pulo_impulso: 0.833, queda: 0.7,
  mx_casting_a_healing_spell_with_one_hand: 2.667, mx_inward_slashing_with_a_sword_standing_st: 2.2, mx_large_hit_reaction_from_the_right: 1.633,
  mx_one_handed_casting_spell_fowards: 2.3, mx_outward_slashing_with_a_sword_standing_s: 2.033, mx_sword_and_shield_block_idle: 1.4,
  mx_sword_and_shield_falling_back_death: 2.3, mx_sword_and_shield_idle: 2.533, mx_sword_and_shield_jump_attack: 2.333,
  mx_sword_and_shield_slash_combo: 3.533, mx_two_handed_casting_spell_fowards: 2.7, mx_two_handed_casting_spell_towards_ground: 2.967,
  mx_two_handed_casting_spell_upward_pull: 2.167,
};

// Pedaços de animação: [arquivo, início, fim] em fração da duração. O combo de espada do Mixamo
// (One Hand Sword Combo) vira 4 golpes; pulo, mortal e pouso perdem o agachamento do começo.
export const CORTES = {
  combo1: ['espada_combo', 0.12, 0.32], combo2: ['espada_combo', 0.32, 0.53], combo3: ['espada_combo', 0.53, 0.74], combo4: ['espada_combo', 0.74, 0.93],
  pulo: ['pulo_impulso', 0.42, 1], puloCorrendo: ['pulo_correndo', 0.72, 1], mortal: ['mortal_frente', 0.33, 0.92], pouso: ['aterrissa_queda', 0.28, 0.85],
};
for (const [nome, [arq, ini, fim]] of Object.entries(CORTES)) DURACAO[nome] = DURACAO[arq] * (fim - ini);
// Nestas o quadril não sobe nem desce na animação: quem dá a altura do pulo é o jogo
export const SEM_ALTURA = ['pulo', 'puloCorrendo', 'mortal', 'queda'];

// Cada arma: golpe básico + 3 habilidades. "at" = fração da animação em que o golpe acerta.
// ts = velocidade da animação. Valores pensados para o celular: poucos botões, recargas curtas.
// "combo" = o básico troca de golpe a cada toque seguido; "hits" = vários acertos na mesma animação.
// "fx" = acende o círculo mágico (pentagrama) no chão enquanto conjura.
export const ARMAS = {
  espada: {
    nome: 'Espada', estilo: 'Guerreiro', idle: A.swordIdle, desc: 'Perto do inimigo, aguenta pancada.',
    basico: { nome: 'Golpe', desc: 'combo de 4 cortes, de 12 a 20 de dano.', alcance: 2.3, arco: 1.6, cd: 0.15, dmg: 12,
      combo: [{ anim: 'combo1', ts: 1.45, at: 0.5, dmg: 12 }, { anim: 'combo2', ts: 1.45, at: 0.53, dmg: 13 },
        { anim: 'combo3', ts: 1.45, at: 0.58, dmg: 14 }, { anim: 'combo4', ts: 1.35, at: 0.41, dmg: 20 }] },
    habilidades: [
      { nome: 'Combo Relâmpago', anim: A.raio, ts: 1.6, hits: [0.14, 0.4, 0.6, 0.76], dmg: 11, alcance: 2.6, arco: 2.4, cd: 5, fx: true, desc: 'Quatro cortes seguidos e um salto.' },
      { nome: 'Salto Esmagador', anim: A.jump, ts: 1.1, at: 0.55, dmg: 26, area: 3.2, avanco: 3.5, cd: 7, fx: true, desc: 'Pula para a frente e acerta todos em volta.' },
      { nome: 'Muralha de Escudo', anim: A.block, ts: 1, segurar: 2.6, defesa: 0.8, cd: 10, desc: 'Ergue o escudo: recebe 80% menos dano.' },
    ],
  },
  cajado: {
    nome: 'Cajado', estilo: 'Mago', idle: 'Idle', desc: 'De longe, gasta mana.',
    basico: { nome: 'Faísca', anim: A.bolt, ts: 1.5, at: 0.42, proj: { vel: 16, cor: 0x7fc4ff, tam: 0.12 }, dmg: 10, cd: 0.25 },
    habilidades: [
      { nome: 'Bola de Fogo', anim: A.bolt, ts: 1.7, at: 0.43, proj: { vel: 13, cor: 0xff7a2a, tam: 0.22, explosao: 2.4, fogo: true }, dmg: 36, cd: 3, mana: 20, fx: true, desc: 'Explode e queima quem estiver perto.' },
      { nome: 'Cura', anim: A.heal, ts: 1.2, at: 0.55, cura: 38, cd: 8, mana: 25, fx: true, desc: 'Recupera vida.' },
      { nome: 'Círculo de Chamas', anim: A.ground, ts: 1.6, at: 0.6, campo: { r: 3.2, dps: 16, dur: 4 }, cd: 10, mana: 30, fx: true, desc: 'Incendeia o chão sob o alvo por 4 s.' },
    ],
  },
  arco: {
    nome: 'Arco', estilo: 'Arqueiro', idle: 'Idle', desc: 'Distância média, mobilidade.',
    basico: { nome: 'Flecha', anim: A.shoot, ts: 2, at: 0.5, proj: { vel: 30, cor: 0xe8dcc0, tam: 0.05, flecha: true }, dmg: 13, cd: 0.2 },
    habilidades: [
      { nome: 'Tiro Perfurante', anim: A.shoot, ts: 1.3, at: 0.62, proj: { vel: 40, cor: 0xffe08a, tam: 0.07, flecha: true, atravessa: true }, dmg: 32, cd: 4, fx: true, desc: 'Atravessa todos os inimigos na linha.' },
      { nome: 'Salto para Trás', anim: A.backflip, ts: 1.25, at: 0.1, salto: -4.5, cd: 5, desc: 'Mortal para trás para abrir distância.' },
      { nome: 'Chuva de Flechas', anim: A.rain, ts: 1.2, at: 0.6, chuva: { r: 3.4, ondas: 4, dmg: 11 }, cd: 10, fx: true, desc: 'Flechas caem na área do alvo.' },
    ],
  },
};
export const ORDEM_ARMAS = ['espada', 'cajado', 'arco'];

export const HEROI = { vida: 120, mana: 100, manaPorSeg: 6, andar: 1.8, correr: 5.4, renascer: 3.5 };
// Pulo (no ar, de novo: mortal) e dash (arrancada curta; nenhum golpe pega durante ela). Velocidades em m/s.
export const MOVIMENTO = { pulo: 6.2, gravidade: 17, dashVel: 11, dashTempo: 0.28, dashCd: 0.9 };

// Inimigos humanos usam o mesmo corpo do herói, só mudam cor, tamanho e números
export const TIPOS_INIMIGO = {
  bandido: { nome: 'Bandido', vida: 90, dano: 9, intervalo: 2.4, cor: 0x8a5b48, escala: 1 },
  capitao: { nome: 'Capitão Rasgo', vida: 190, dano: 16, intervalo: 1.8, cor: 0x4d3b36, escala: 1.12 },
};

// Mapa da Clareira de Vael. Cada mapa novo vira um objeto como este.
export const MAPA_CLAREIRA = {
  id: 'clareira',
  nome: 'Clareira (mapa de teste)',
  raio: 34,
  nascimento: { x: 0, z: 0 },
  inimigos: [
    { tipo: 'bandido', x: 9, z: 10 },
    { tipo: 'bandido', x: -11, z: 12 },
    { tipo: 'capitao', x: 14, z: -6 },
  ],
  npcs: [
    { nome: 'Tomás, o ferreiro', x: -2.2, z: -3.6, ry: 0.6, cor: 0xc9b48a, falas: [
      'Uma lâmina, um cajado ou um arco. Você é quem escolhe, a cada golpe.',
      'Os bandidos do Rasgo acamparam no leste da clareira. Cuidado com ele.',
      'Troque de arma no meio da luta. O inimigo nunca sabe o que vem.',
    ] },
  ],
  // pedras soltas (posição e tamanho) e caixotes: o cliente desenha, o servidor usa como obstáculo
  pedras: [[6, -8, 1.9], [-9, -4, 1.4], [-5, 9, 2.2], [11, 6, 1.6], [-14, -12, 2.5], [15, -11, 1.3], [2, 14, 2.0], [-17, 6, 1.8]],
  obstaculos: [{ x: -2.8, z: -5.7, r: 1.1 }],
};

// Corpos que o jogador pode escolher para o herói. Os avatares VRoid A, B e C nunca entram (licença).
// Trocar o corpo não muda nada no combate: é só visual.
export const PERSONAGENS = [
  { id: 'ruiva', nome: 'Ruiva', tipo: 'vrm' },
  { id: 'vita', nome: 'Vita', tipo: 'vrm' },
  { id: 'vivi', nome: 'Vivi', tipo: 'vrm' },
  { id: 'victoria', nome: 'Victoria', tipo: 'vrm' },
  { id: 'shino', nome: 'Shino', tipo: 'vrm' },
  { id: 'shibu', nome: 'Shibu', tipo: 'vrm' },
  { id: 'shibu_sombrio', nome: 'Shibu Sombrio', tipo: 'vrm' },
  { id: 'fumiriya', nome: 'Fumiriya', tipo: 'vrm' },
  { id: 'cabelo_f', nome: 'Amostra F', tipo: 'vrm' },
  { id: 'cabelo_m', nome: 'Amostra M', tipo: 'vrm' },
  { id: 'soldado', nome: 'Soldado (realista)', tipo: 'glb' },
];
export const PERSONAGEM_PADRAO = 'ruiva';
