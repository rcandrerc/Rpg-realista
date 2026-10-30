// Dados do jogo. Cliente e servidor leem este mesmo arquivo:
// para criar uma arma, habilidade ou inimigo novo, mexa só aqui.

// Apelidos das animações do Mixamo (nome do arquivo em client/public/assets/anims.json.gz)
export const A = {
  slash: 'mx_inward_slashing_with_a_sword_standing_st',
  slash2: 'mx_outward_slashing_with_a_sword_standing_s',
  power: 'mx_sword_and_shield_power_slash',
  jump: 'mx_sword_and_shield_jump_attack',
  block: 'mx_sword_and_shield_block_idle',
  swordIdle: 'mx_sword_and_shield_idle',
  bolt: 'mx_one_handed_casting_spell_fowards',
  fireball: 'mx_conjuring_magic_and_throwing',
  heal: 'mx_casting_a_healing_spell_with_one_hand',
  ground: 'mx_two_handed_casting_spell_towards_ground',
  shoot: 'mx_two_handed_casting_spell_fowards', // provisório até baixar as animações de arco
  rain: 'mx_two_handed_casting_spell_upward_pull',
  hit: 'mx_large_hit_reaction_from_the_right',
  death: 'mx_sword_and_shield_falling_back_death',
  roll: 'rolamento',
  backflip: 'mortal_tras',
};

// Duração de cada animação em segundos. O servidor usa para saber quando o golpe acerta.
export const DURACAO = {
  mortal_tras: 2.167, mx_casting_a_healing_spell_with_one_hand: 2.667, mx_conjuring_magic_and_throwing: 7.7,
  mx_inward_slashing_with_a_sword_standing_st: 2.2, mx_large_hit_reaction_from_the_right: 1.633,
  mx_one_handed_casting_spell_fowards: 2.3, mx_outward_slashing_with_a_sword_standing_s: 2.033,
  mx_sword_and_shield_block_idle: 1.4, mx_sword_and_shield_falling_back_death: 2.3, mx_sword_and_shield_idle: 2.533,
  mx_sword_and_shield_jump_attack: 2.333, mx_sword_and_shield_power_slash: 2.433, mx_two_handed_casting_spell_fowards: 2.7,
  mx_two_handed_casting_spell_towards_ground: 2.967, mx_two_handed_casting_spell_upward_pull: 2.167, rolamento: 1.4,
};

// Não existe classe: o estilo muda com a arma equipada.
// ts = velocidade da animação, at = momento do impacto (fração da animação)
export const ARMAS = {
  espada: {
    nome: 'Espada', estilo: 'Guerreiro', idle: A.swordIdle, desc: 'Perto do inimigo, aguenta pancada.',
    basico: { nome: 'Golpe', anim: A.slash, ts: 1.25, at: 0.42, dmg: 14, alcance: 2.3, arco: 1.6, cd: 0.2 },
    habilidades: [
      { nome: 'Golpe Pesado', anim: A.power, ts: 1.15, at: 0.5, dmg: 34, alcance: 2.6, arco: 1.8, cd: 4, desc: 'Um corte forte à frente.' },
      { nome: 'Salto Esmagador', anim: A.jump, ts: 1.1, at: 0.55, dmg: 26, area: 3.2, avanco: 3.5, cd: 7, desc: 'Pula para a frente e acerta todos em volta.' },
      { nome: 'Muralha de Escudo', anim: A.block, ts: 1, segurar: 2.6, defesa: 0.8, cd: 10, desc: 'Ergue o escudo: recebe 80% menos dano.' },
    ],
  },
  cajado: {
    nome: 'Cajado', estilo: 'Mago', idle: 'Idle', desc: 'De longe, gasta mana.',
    basico: { nome: 'Faísca', anim: A.bolt, ts: 1.5, at: 0.42, proj: { vel: 16, cor: 0x7fc4ff, tam: 0.12 }, dmg: 10, cd: 0.25 },
    habilidades: [
      { nome: 'Bola de Fogo', anim: A.fireball, ts: 2.6, at: 0.72, proj: { vel: 13, cor: 0xff7a2a, tam: 0.26, explosao: 2.4 }, dmg: 36, cd: 3, mana: 20, desc: 'Explode e queima quem estiver perto.' },
      { nome: 'Cura', anim: A.heal, ts: 1.2, at: 0.55, cura: 38, cd: 8, mana: 25, desc: 'Recupera vida.' },
      { nome: 'Círculo de Chamas', anim: A.ground, ts: 1.3, at: 0.55, campo: { r: 3.2, dps: 16, dur: 4 }, cd: 10, mana: 30, desc: 'Incendeia o chão sob o alvo por 4 s.' },
    ],
  },
  arco: {
    nome: 'Arco', estilo: 'Arqueiro', idle: 'Idle', desc: 'Distância média, mobilidade.',
    basico: { nome: 'Flecha', anim: A.shoot, ts: 2, at: 0.5, proj: { vel: 30, cor: 0xe8dcc0, tam: 0.05, flecha: true }, dmg: 13, cd: 0.2 },
    habilidades: [
      { nome: 'Tiro Perfurante', anim: A.shoot, ts: 1.3, at: 0.62, proj: { vel: 40, cor: 0xffe08a, tam: 0.07, flecha: true, atravessa: true }, dmg: 32, cd: 4, desc: 'Atravessa todos os inimigos na linha.' },
      { nome: 'Salto para Trás', anim: A.backflip, ts: 1.25, at: 0.1, salto: -4.5, cd: 5, desc: 'Mortal para trás para abrir distância.' },
      { nome: 'Chuva de Flechas', anim: A.rain, ts: 1.2, at: 0.6, chuva: { r: 3.4, ondas: 4, dmg: 11 }, cd: 10, desc: 'Flechas caem na área do alvo.' },
    ],
  },
};
export const ORDEM_ARMAS = ['espada', 'cajado', 'arco'];

export const HEROI = { vida: 120, mana: 100, manaPorSeg: 6, andar: 1.8, correr: 5.4, rolarCd: 1.2, renascer: 3.5 };

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
