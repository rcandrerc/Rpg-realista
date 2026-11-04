// Dados do jogo. Cliente e servidor leem este mesmo arquivo:
// para criar uma habilidade, horda ou mapa novo, mexa só aqui.

import { raioNaDirecao, dentroDoMapa } from './mapa.js';

// Apelidos das animações do Mixamo (nome do arquivo em client/public/assets/personagens/anims.json.gz)
export const A = {
  slash: 'mx_inward_slashing_with_a_sword_standing_st',
  slash2: 'mx_outward_slashing_with_a_sword_standing_s',
  raio: 'mx_sword_and_shield_slash_combo',
  giro: 'mx_sword_and_shield_power_slash',
  jump: 'mx_sword_and_shield_jump_attack',
  block: 'mx_sword_and_shield_block_idle',
  swordIdle: 'mx_sword_and_shield_idle',
  bolt: 'mx_one_handed_casting_spell_fowards',
  onda: 'mx_casting_a_magic_spell_wide_with_two_arms',
  heal: 'mx_casting_a_healing_spell_with_one_hand',
  ground: 'mx_two_handed_casting_spell_towards_ground',
  rain: 'mx_two_handed_casting_spell_upward_pull',
  hit: 'mx_large_hit_reaction_from_the_right',
  death: 'mx_sword_and_shield_falling_back_death',
  roll: 'rolamento',
  estocada: 'mx_thrust_and_slash_with_blade',
  cruzado: 'mx_sword_and_shield_cross_slash',
  descendente: 'mx_sword_and_shield_downward_slash',
  lanca: 'mx_two_handed_casting_spell_fowards',
  ceu: 'mx_one_handed_casting_spell_upwards',
  vortice: 'mx_two_handed_casting_spell_pull_in_blast_o',
  // magias novas do cajado (André 2026-11-03): Mixamo Magic Pack e Kevin Iglesias Spellcasting (livres, em fontes)
  bolaForte: 'bolaForte', novaGelo: 'novaGelo', meteoroCeu: 'meteoroCeu',
};

// Duração de cada animação em segundos. O servidor usa para saber quando o golpe acerta.
export const DURACAO = {
  aterrissa_queda: 1.067, espada_combo: 4.533, mortal_frente: 1.1, pulo_correndo: 1.067, pulo_impulso: 0.833, queda: 0.7, rolamento: 1.4,
  mx_casting_a_healing_spell_with_one_hand: 2.667, mx_casting_a_magic_spell_wide_with_two_arms: 3.533, mx_inward_slashing_with_a_sword_standing_st: 2.2,
  mx_large_hit_reaction_from_the_right: 1.633, mx_one_handed_casting_spell_fowards: 2.3, mx_outward_slashing_with_a_sword_standing_s: 2.033,
  mx_sword_and_shield_block_idle: 1.4, mx_sword_and_shield_falling_back_death: 2.3, mx_sword_and_shield_idle: 2.533, mx_sword_and_shield_jump_attack: 2.333,
  mx_sword_and_shield_power_slash: 2.433, mx_sword_and_shield_slash_combo: 3.533, mx_two_handed_casting_spell_towards_ground: 2.967,
  mx_two_handed_casting_spell_upward_pull: 2.167, mx_thrust_and_slash_with_blade: 3, mx_sword_and_shield_cross_slash: 1.667,
  mx_sword_and_shield_downward_slash: 1.5, mx_two_handed_casting_spell_fowards: 2.7, mx_one_handed_casting_spell_upwards: 2.267,
  mx_conjuring_magic_and_throwing: 7.7, mx_two_handed_casting_spell_pull_in_blast_o: 3.267, mx_casting_a_spell_with_one_hand: 4.267,
  mx_one_handed_casting_spell_sweep_right_to: 2.2,
  esc_braced_hang_to_crouch: 1.133, esc_climbing_down_wall: 2, esc_climbing_ladder: 0.767, esc_climbing_to_top: 4, esc_climbing_up_wall: 2,
  esc_diagonal_wall_run: 1.133, esc_sprint_to_wall_climb: 1.8, esc_start_climbing_ladder: 2.033, esc_wall_run: 2.1,
  mx_hanging_by_hands_against_wall: 2.333, mx_hanging_by_hands_gently_swaying: 2.333, mx_hanging_from_a_ledge_idle: 4.7,
  mx_left_braced_hang_shimmy: 1.167, mx_right_braced_hang_shimmy: 1.167,
  // Mixamo Run To Stop e Running Turn 180 (app Godot: o jogo leva o corpo pelo caminho do quadril, ver RAIZ)
  freada: 1.8, meia_volta: 0.667,
  // Mixamo Rifle Start Run: no app Godot só as pernas e o quadril tocam (os braços seguram fuzil)
  arrancada: 1.733,
  // Mixamo Jogging (André 2026-11-03): o trote do joystick, 3 passadas por volta
  trote: 2.567,
  // Mixamo Pro Magic Pack, Standing Walk/Run Left, Right e Back (André 2026-11-04): o mago anda de lado e de costas
  // enquanto atira a Faísca, virado para o alvo
  lado_e_andar: 1.167, lado_d_andar: 1.2, tras_andar: 1.2, lado_e_correr: 0.767, lado_d_correr: 0.767, tras_correr: 0.633,
  // magias novas do cajado: Kevin Iglesias Magic Attack Direct 1H (direita/esquerda) e Mixamo Standing 2H Magic Attack 01,
  // 2H Magic Area Attack 01 e 2H Cast Spell 01
  mg_basico_d: 1.2, mg_basico_e: 1.2, mg_bola: 2.667, mg_gelo: 2.967, mg_meteoro: 2.167,
};

// Pedaços de animação: [arquivo, início, fim] em fração da duração. O combo de espada do Mixamo
// (One Hand Sword Combo) vira 4 golpes; pulo, mortal e pouso perdem o agachamento do começo.
export const CORTES = {
  combo1: ['espada_combo', 0.12, 0.32], combo2: ['espada_combo', 0.32, 0.53], combo3: ['espada_combo', 0.53, 0.74], combo4: ['espada_combo', 0.74, 0.93],
  // golpe básico de magia (3 disparos), a investida e o arremesso triplo
  magia1: ['mx_one_handed_casting_spell_sweep_right_to', 0.05, 0.55], magia2: ['mx_one_handed_casting_spell_fowards', 0.12, 0.55],
  magia3: ['mx_casting_a_spell_with_one_hand', 0.32, 0.6], investida: ['mx_thrust_and_slash_with_blade', 0.15, 0.6],
  arremesso: ['mx_conjuring_magic_and_throwing', 0.45, 0.92],
  // Faísca nova (alterna as mãos), Bola de Fogo (junta as duas mãos e empurra), Nova de Gelo (bate no chão), Meteoro (braços ao céu)
  magiaD: ['mg_basico_d', 0.1, 0.7], magiaE: ['mg_basico_e', 0.1, 0.7], bolaForte: ['mg_bola', 0.1, 0.75],
  novaGelo: ['mg_gelo', 0.05, 0.7], meteoroCeu: ['mg_meteoro', 0, 0.85],
  pulo: ['pulo_impulso', 0.42, 1], puloCorrendo: ['pulo_correndo', 0.72, 1], mortal: ['mortal_frente', 0.33, 0.92], pouso: ['aterrissa_queda', 0.28, 0.85],
};
for (const [nome, [arq, ini, fim]] of Object.entries(CORTES)) DURACAO[nome] = DURACAO[arq] * (fim - ini);
// Nestas o quadril não sobe nem desce na animação: quem dá a altura do pulo é o jogo
export const SEM_ALTURA = ['pulo', 'puloCorrendo', 'mortal', 'queda'];
// Nestas o quadril não anda para a frente na animação: quem leva o corpo é o jogo (a investida já sai no impulso)
export const SEM_AVANCO = ['investida', 'freada', 'meia_volta', 'arrancada'];
// Nestas o quadril não gira em volta do corpo: quem vira o herói é o jogo, pelo giro gravado (meia-volta correndo)
export const SEM_GIRO = ['meia_volta'];
// Animações em que o jogo (app Godot) anda e vira o corpo pelo caminho do quadril da própria animação
export const RAIZ = ['freada', 'meia_volta'];

// Escalada (animações do Mixamo, pasta mixamo/movimento e mixamo/combate do New-Game-Anime-fontes).
// "traj" = caminho do quadril na animação em 13 pontos: [lado (+ = esquerda), sobe, frente] em metros, já na escala do herói.
// O cliente deixa o quadril parado na animação e o jogo move o corpo por esse caminho: assim dá para esticar para a altura de cada pedra.
export const ESCALADA = {
  miniSubida: { anim: 'esc_climbing_to_top', ts: 1.8, traj: [[0,0,0], [-0.01,0.03,0.01], [-0.11,0.3,-0.01], [-0.07,0.52,-0.02], [0.05,0.65,0.02], [-0.06,0.9,0.16], [-0.14,0.93,0.22], [-0.09,1.28,0.47], [-0.15,1.44,0.83], [-0.13,1.35,1.04], [-0.02,1.38,1.13], [-0.03,1.38,1.15], [-0.04,1.37,1.15]] },
  subirParede: { anim: 'esc_climbing_up_wall', ts: 1.35, traj: [[0,0,0], [0.06,0.14,0.01], [0.2,0.38,-0.06], [0.27,0.54,-0.08], [0.25,0.59,-0.04], [0.21,0.53,0.04], [0.18,0.57,0], [0.14,0.69,-0.12], [0.08,0.84,-0.17], [0.03,1.01,-0.19], [0,1.09,-0.12], [-0.01,1.08,-0.02], [0,1.06,0]] },
  descerParede: { anim: 'esc_climbing_down_wall', ts: 1.35, traj: [[0,0,0], [-0.01,0.02,-0.01], [0,0.03,-0.09], [0.03,-0.04,-0.14], [0.09,-0.19,-0.11], [0.15,-0.35,-0.06], [0.19,-0.47,0.06], [0.21,-0.52,0.09], [0.25,-0.46,0.01], [0.27,-0.51,-0.04], [0.2,-0.69,-0.04], [0.06,-0.94,0.01], [0,-1.06,0]] },
  topo: { anim: 'esc_braced_hang_to_crouch', ts: 0.9, traj: [[0,0,0], [-0.01,0.11,-0.07], [-0.02,0.35,0.02], [-0.04,0.61,0.1], [-0.06,0.79,0.13], [-0.07,1.01,0.14], [-0.07,1.13,0.15], [-0.07,1.22,0.18], [-0.07,1.28,0.24], [-0.07,1.34,0.33], [-0.07,1.37,0.38], [-0.09,1.35,0.45], [-0.1,1.29,0.49]] },
  esquerda: { anim: 'mx_left_braced_hang_shimmy', ts: 1.2, traj: [[0,0,0], [0.07,0.01,0.04], [0.15,0.06,0.07], [0.21,0.12,0.09], [0.25,0.15,0.08], [0.26,0.16,0.08], [0.27,0.16,0.06], [0.28,0.16,0.04], [0.32,0.14,-0.01], [0.36,0.11,-0.04], [0.4,0.07,-0.05], [0.45,0.02,-0.03], [0.5,0,0]] },
  direita: { anim: 'mx_right_braced_hang_shimmy', ts: 1.2, traj: [[0,0,0], [-0.07,0.01,0.03], [-0.15,0.05,0.07], [-0.22,0.11,0.09], [-0.26,0.15,0.09], [-0.27,0.16,0.08], [-0.28,0.16,0.06], [-0.29,0.16,0.04], [-0.32,0.15,-0.01], [-0.36,0.11,-0.04], [-0.41,0.07,-0.04], [-0.45,0.02,-0.03], [-0.5,0,0]] },
  corridaParede: { anim: 'esc_sprint_to_wall_climb', ts: 1, traj: [[0,0,0], [-0.03,-0.12,0.72], [-0.01,-0.06,1.23], [0.05,0.33,1.79], [0.03,0.6,2.08], [-0.01,0.99,2.24], [0.01,1.23,2.35], [0.02,1.49,2.44], [0.03,1.66,2.5], [0.03,1.77,2.57], [0.03,1.82,2.65], [0.01,1.79,2.75], [0,1.72,2.79]] },
  correrNaParede: { anim: 'esc_wall_run', ts: 1.2, traj: [[0,0,0], [0.05,0.06,0.79], [0.02,0.49,1.62], [0.05,0.9,2], [0.05,1.34,2.21], [0.03,1.67,2.31], [0.02,1.95,2.46], [0.03,1.83,2.62], [0.05,1.62,2.68], [0.02,1.6,2.67], [0,1.62,2.68], [-0.01,1.62,2.69], [0,1.61,2.69]] },
  diagonal: { anim: 'esc_diagonal_wall_run', ts: 1, traj: [[0,0,0], [0.09,0.16,0.33], [0.16,0.36,0.61], [0.17,0.52,0.82], [0.14,0.66,0.94], [0.05,0.85,1.1], [-0.12,1.03,1.19], [-0.28,1.16,1.25], [-0.44,1.22,1.31], [-0.62,1.22,1.35], [-0.8,1.2,1.38], [-1.12,1.12,1.41], [-1.45,0.95,1.44]] },
  pegarEscada: { anim: 'esc_start_climbing_ladder', ts: 1.3, traj: [[0,0,0], [0.01,0,0.01], [0.05,-0.02,-0.02], [0.08,-0.11,-0.05], [0.16,-0.12,0.04], [0.36,-0.11,0.21], [0.45,-0.09,0.33], [0.59,0.04,0.43], [0.74,0.28,0.43], [0.89,0.38,0.39], [0.93,0.51,0.33], [0.9,0.67,0.34], [0.87,0.7,0.34]] },
  subirEscada: { anim: 'esc_climbing_ladder', ts: 1, traj: [[0,0,0], [0,0.02,-0.01], [0.01,0.08,-0.01], [0.03,0.14,0], [0.06,0.18,0.01], [0.07,0.19,0.01], [0.09,0.2,0], [0.09,0.22,0], [0.08,0.28,0], [0.06,0.34,0.02], [0.03,0.38,0.02], [0.02,0.4,0.03], [0,0.42,0.02]] },
};
// Paradas na parede (repetem): agarrado, pendurado na beirada e balançando quando fica muito tempo parado
export const PARADO_PAREDE = { agarrado: 'mx_hanging_by_hands_against_wall', beirada: 'mx_hanging_from_a_ledge_idle', balanca: 'mx_hanging_by_hands_gently_swaying' };
// Todas as animações de escalada: o cliente tira delas o sobe-desce e o anda do quadril (quem move é o jogo)
export const ANIMS_ESCALADA = [...Object.values(ESCALADA).map((e) => e.anim), ...Object.values(PARADO_PAREDE)];
export const SUBIDA = { degrau: 0.45, mini: 1.95, empurrar: 0.18, maoAcima: 1.53, topo: 1.6, parede: 0.32 }; // m: sobe andando; mini escalada até; tempo empurrando; altura das mãos acima do corpo; topo: beirada no máximo isso acima do corpo para subir no topo (a animação sobe 1,29 m); parede: distância do quadril até a parede agarrado (mãos e pés encostam)

// Uma arma só: a espada mágica. Corta e solta magia; o jogador monta a build escolhendo as habilidades.
// "at" = fração da animação em que acerta; ts = velocidade da animação; "hits" = vários acertos na mesma animação;
// "lamina" = deixa rastro na espada; "fx" = acende o círculo mágico (pentagrama) no chão enquanto conjura.
export const ARMA = { nome: 'Espada mágica', idle: A.swordIdle };
export const BASICO = {
  nome: 'Golpe', desc: 'Combo de 4 cortes, de 12 a 20 de dano. Toque de novo no fim do corte para emendar.', alcance: 2.3, arco: 1.6, cd: 0.15, lamina: true,
  combo: [{ anim: 'combo1', ts: 1.45, at: 0.5, dmg: 12 }, { anim: 'combo2', ts: 1.45, at: 0.53, dmg: 13 },
    { anim: 'combo3', ts: 1.45, at: 0.58, dmg: 14 }, { anim: 'combo4', ts: 1.35, at: 0.41, dmg: 20 }],
};
// Golpe básico de magia: tiros de energia sem gastar mana, para quem prefere lutar de longe
export const BASICO_MAGIA = {
  nome: 'Disparo', tipo: 'Magia', desc: 'Três tiros de energia arcana, de 9 a 15 de dano. Não gasta mana.', cd: 0.15,
  proj: { vel: 18, cor: 0x9a6bff, tam: 0.24, estilo: 'arcano', largura: 0.8 },
  combo: [{ anim: 'magia1', ts: 1.5, at: 0.34, dmg: 9 }, { anim: 'magia2', ts: 1.5, at: 0.44, dmg: 10 }, { anim: 'magia3', ts: 1.35, at: 0.4, dmg: 15 }],
};
export const HABILIDADES = {
  bola: { nome: 'Cometa de Fogo', tipo: 'Magia', anim: A.bolt, ts: 1.7, at: 0.43, proj: { vel: 14, cor: 0xff7a2a, tam: 0.26, explosao: 1.8, estilo: 'fogo' }, dmg: 24, cd: 1.5, mana: 10, fx: true, desc: 'Cometa de fogo com cauda que explode no alvo.' },
  relampago: { nome: 'Combo Relâmpago', tipo: 'Espada', anim: A.raio, ts: 1.6, hits: [0.14, 0.4, 0.6, 0.76], dmg: 11, alcance: 2.6, arco: 2.4, cd: 5, lamina: true, fx: true, desc: 'Quatro cortes seguidos e um salto.' },
  explosao: { nome: 'Explosão', tipo: 'Magia', anim: A.ground, ts: 1.6, at: 0.6, dmg: 34, area: 3.6, cd: 7, mana: 25, fx: true, desc: 'Fogo explode no chão em volta de você.' },
  giro: { nome: 'Giro da Lâmina', tipo: 'Espada', anim: A.giro, ts: 1.2, hits: [0.52, 0.74], dmg: 30, area: 4, cd: 6, lamina: true, fx: true, desc: 'Salta girando e corta forte tudo em volta, duas vezes (raio de 4 m).' },
  salto: { nome: 'Salto Esmagador', tipo: 'Espada', anim: A.jump, ts: 1.1, at: 0.55, dmg: 26, area: 3.2, avanco: 3.5, cd: 7, lamina: true, fx: true, desc: 'Pula para a frente e crava a espada no chão.' },
  onda: { nome: 'Onda Arcana', tipo: 'Magia', anim: A.onda, ts: 1.8, at: 0.45, dmg: 22, area: 4.2, empurra: 2.4, cd: 6, mana: 25, fx: true, desc: 'Onda de gelo que empurra tudo para longe.' },
  chamas: { nome: 'Círculo de Chamas', tipo: 'Magia', anim: A.ground, ts: 1.6, at: 0.6, campo: { r: 3.2, dps: 16, dur: 4 }, cd: 10, mana: 30, fx: true, desc: 'Incendeia o chão sob o alvo por 4 s.' },
  meteoros: { nome: 'Chuva de Meteoros', tipo: 'Magia', anim: A.rain, ts: 1.2, at: 0.6, chuva: { r: 3.4, ondas: 4, dmg: 12 }, cd: 10, mana: 30, fx: true, desc: 'Bolas de fogo caem na área do alvo.' },
  investida: { nome: 'Investida', tipo: 'Espada', anim: 'investida', ts: 1.5, hits: [0.22, 0.78], dmg: 19, alcance: 2.8, arco: 2.4, avanco: 7, avancoT: 0.2, cd: 4, lamina: true, fx: true, dash: true, impacto: true, desc: 'Dash até o alvo e já crava a estocada, depois um corte.' },
  furia: { nome: 'Fúria', tipo: 'Espada', anim: 'espada_combo', ts: 1.5, hits: [0.22, 0.43, 0.65, 0.82], dmg: 15, alcance: 2.5, arco: 2.4, avanco: 2, cd: 8, lamina: true, fx: true, desc: 'O combo inteiro da espada, sem parar, mais forte.' },
  corte: { nome: 'Corte Aéreo', tipo: 'Espada', anim: A.cruzado, ts: 1.3, at: 0.43, proj: { vel: 16, cor: 0x7fe3ff, tam: 0.9, atravessa: true, largura: 1.3, estilo: 'corte', vida: 0.8 }, dmg: 22, cd: 5, lamina: true, fx: true, desc: 'Corta o ar e solta uma lâmina de energia que atravessa todos.' },
  fenda: { nome: 'Fenda de Fogo', tipo: 'Espada', anim: A.descendente, ts: 1.15, at: 0.4, linha: { comp: 8, larg: 1.6, passos: 6, dmg: 20 }, cd: 7, lamina: true, fx: true, desc: 'Golpe no chão que abre uma trilha de explosões à frente.' },
  lanca: { nome: 'Lança de Gelo', tipo: 'Magia', anim: A.lanca, ts: 1.5, at: 0.4, proj: { vel: 20, cor: 0x7fd0ff, tam: 0.22, atravessa: true, largura: 0.9, estilo: 'gelo' }, dmg: 26, cd: 4, mana: 15, fx: true, desc: 'Uma lança de gelo que atravessa a fila inteira.' },
  raio: { nome: 'Raio Celeste', tipo: 'Magia', anim: A.ceu, ts: 1.3, at: 0.3, raios: { n: 3, alcance: 14, dmg: 28 }, cd: 8, mana: 25, fx: true, desc: 'Raios caem do céu em até 3 inimigos.' },
  rajada: { nome: 'Rajada de Cometas', tipo: 'Magia', anim: 'arremesso', ts: 1.5, at: 0.53, proj: { vel: 15, cor: 0xffa21a, tam: 0.2, explosao: 1.3, estilo: 'fogo', leque: 3 }, dmg: 18, cd: 7, mana: 25, fx: true, desc: 'Três cometas de fogo em leque.' },
  vortice: { nome: 'Vórtice', tipo: 'Magia', anim: A.vortice, ts: 1.3, at: 0.52, puxa: { r: 7, de: 0.12 }, dmg: 30, area: 3, cd: 10, mana: 30, fx: true, desc: 'Puxa os inimigos para perto e explode.' },
  barreira: { nome: 'Barreira Arcana', tipo: 'Magia', anim: A.block, ts: 1, segurar: 2.6, defesa: 0.8, cd: 10, mana: 15, fx: true, desc: 'Uma bolha de luz: recebe 80% menos dano.' },
};
// A cura tem botão próprio, fora da build
export const CURA = { nome: 'Cura', tipo: 'Magia', anim: A.heal, ts: 1.2, at: 0.55, cura: 38, cd: 8, mana: 25, fx: true, desc: 'Recupera vida. Tem botão próprio, sempre à mão.' };
export const ESPACOS_ESPADA = 4, ESPACOS_MAGIA = 4; // 4 de espada (modo espada) e 4 de magia (modo magia); o botão Trocar alterna
export const ESPACOS_BUILD = ESPACOS_ESPADA + ESPACOS_MAGIA;
// a build é a lista das 8: primeiro as 4 de espada, depois as 4 de magia
export const BUILD_PADRAO = ['investida', 'giro', 'salto', 'relampago', 'bola', 'raio', 'explosao', 'meteoros'];
export const buildValida = (b) => Array.isArray(b) && b.length === ESPACOS_BUILD && new Set(b).size === b.length
  && b.every((k, i) => HABILIDADES[k]?.tipo === (i < ESPACOS_ESPADA ? 'Espada' : 'Magia'));

export const HEROI = { vida: 120, mana: 100, manaPorSeg: 7, andar: 1.8, correr: 5.4, rolarCd: 1.2, renascer: 3.5, altura: 1.7 }; // altura: até a cabeça (teto da ferraria)
// Pulo (no ar, de novo: mortal), dash (arrancada curta; nenhum golpe pega) e rolamento no chão. Velocidades em m/s.
export const MOVIMENTO = { pulo: 6.2, gravidade: 17, dashVel: 11, dashTempo: 0.28, dashCd: 0.9 };
// Conferência da posição que o celular manda (Simulacao.posicaoCliente): metros guardados para dash/rolamento/avanço
// e altura máxima acima do chão (pulo duplo, escalada de casa e pedra).
export const ORCAMENTO = { burst: 10, altura: 9 };
// Montarias (teste): o herói sobe e anda mais rápido. Habilidade, dash, rolar ou escalar fazem descer.
// modelo: GLB com as animações parado, andar, correr (feito por IA: ferramentas/monstros-ia). escala: tamanho no jogo.
export const MONTARIAS = {
  lobo: { nome: 'Lobo', modelo: 'assets/monstros/lobo.glb', andar: 3, correr: 9, escala: 1.9, sela: 0.3, flanco: 0.15 },
};

// Inimigos: cada horda usa um personagem anime que o jogador não pode escolher (nunca fica igual ao herói).
// Mudam tamanho, números e o brilho da espada. Hordas novas entram aqui.
// Monstros do Bestiário (Quaternius): visual 'bst:<Nome>' = client/src/bestiario.js (site) e godot-prototipo/modelos/<nome>.glb.
// Atacam com garra e soco, sem espada. Nascem só no acampamento do leste, nunca dentro da vila.
export const TIPOS_INIMIGO = {
  puglin: { nome: 'Puglin', horda: 'Monstros do Leste', visual: 'bst:Puglin', vida: 80, dano: 8, intervalo: 1.7, escala: 1, brilho: 0x8a3dff },
  imp: { nome: 'Imp', horda: 'Monstros do Leste', visual: 'bst:Imp', vida: 110, dano: 11, intervalo: 1.8, escala: 1, brilho: 0xff6a2a },
  chefe: { nome: 'Imp Chefe', horda: 'Monstros do Leste', visual: 'bst:Imp', vida: 220, dano: 16, intervalo: 1.5, escala: 1.15, brilho: 0xff2a3a },
  // o lobo (feito por IA, ferramentas/monstros-ia) era montaria de teste; virou bicho de caça (pedido do André 2026-11-03)
  lobo: { nome: 'Lobo', horda: 'Monstros do Leste', visual: 'lobo', vida: 95, dano: 10, intervalo: 1.5, escala: 1, brilho: 0xd8e6ff },
  // Monstros do Mixamo (pedido do André 2026-11-03; visual aprovado pela direção de arte 2026-11-04). O Warrok é chefe
  // (chefe: true vale como o Imp Chefe: não voa longe, não é puxado, sofre metade do controle). O golem de magma é o
  // Pumpkinhulk do Mixamo repintado de pedra e lava.
  golem: { nome: 'Golem de Magma', horda: 'Monstros do Leste', visual: 'golem', vida: 130, dano: 13, intervalo: 2.6, escala: 1, brilho: 0xff7a1a },
  maw: { nome: 'Maw', horda: 'Monstros do Leste', visual: 'maw', vida: 140, dano: 14, intervalo: 2.4, escala: 1, brilho: 0x9cff5a },
  warrok: { nome: 'Warrok', horda: 'Monstros do Leste', visual: 'warrok', vida: 260, dano: 18, intervalo: 2.0, escala: 1, brilho: 0xffcc40, chefe: true },
  // espantalho de treino (TREINO, abaixo): não anda, não bate, não morre, não dá XP nem item
  espantalho: { nome: 'Espantalho de treino', horda: 'Treino', visual: 'espantalho', vida: 1000, dano: 0, intervalo: 99, escala: 1, brilho: 0, treino: true },
};
// Espantalho de treino (pedido do André 2026-11-03: "coloca um espantalho pra eu treinar golpes e testar na vila ali perto
// do ferreiro"). Apanha de tudo (golpe, skill, magia, crítico, congelar, atordoar), mostra o dano, mas nunca morre:
// quando a vida acaba ela volta cheia na hora, e depois de `volta` s sem apanhar também enche de novo.
// Não anda, não revida, não dá XP nem item e não conta para missão. raio = o quanto ele ocupa (ninguém atravessa).
// Modelo: Dummy do Fantasy Props MegaKit (Quaternius, CC0) em godot-prototipo/treino3d/.
export const TREINO = { volta: 4, raio: 0.38, alto: 1.6 }; // alto: a câmera passa por cima dele

// Combate dos monstros (André 2026-11-02, "combate amador"): o monstro avisa antes de bater (preparo, em s, com a
// animação bem devagar e um brilho vermelho), no máximo `aoMesmoTempo` batem no mesmo herói (os outros rodeiam a
// `roda` m), aguenta `firmeGolpes` golpes seguidos e fica firme (não para de apanhar, revida) por `firmeDur` s.
// Rolar ou dar dash na hora do golpe = esquiva: o próximo golpe do herói em `contraDur` s vale `contraK`x e é crítico.
export const COMBATE_INIMIGO = {
  // André 2026-11-04: "pode fazer igual Quimera tudo": preparo de 0,4 s, sem limite de quantos batem juntos
  // (aoMesmoTempo alto = todos vão para cima), perseguem correndo até encostar e, depois do golpe acertar,
  // esperam de cdMin a cdMax s (sorteado) para bater de novo, como o cd na(1.05, 1.5) do Quimera
  preparo: { puglin: 0.4, imp: 0.4, chefe: 0.4, lobo: 0.4 }, preparoTs: 0.3, golpeTs: 1.1, acerto: 0.45,
  aoMesmoTempo: 99, roda: 2.9, rodaVel: 1.6, perseguir: 3.6, chegar: 2.2, chegarDist: 2.6, folga: 0, cdMin: 1.05, cdMax: 1.5,
  firmeGolpes: { puglin: 6, imp: 6, chefe: 4, lobo: 6 }, firmeJanela: 1.6, firmeDur: 2.0,
  aoMesmoTempo: 2, roda: 3.4, rodaVel: 1.1,
  firmeGolpes: { puglin: 6, imp: 6, chefe: 4, lobo: 6, golem: 5, maw: 5, warrok: 4 }, firmeJanela: 1.6, firmeDur: 2.0,
  contraDur: 1.5, contraK: 1.5, voaMorte: 1.4,
};

// Missões que os NPCs dão. horda = qual bando conta (TIPOS_INIMIGO[..].horda). {faltam} vira o número.
export const MISSOES = {
  bando: {
    nome: 'Expulsar os monstros do leste', horda: 'Monstros do Leste', total: 4,
    pedido: 'Monstros apareceram no leste, no fim do caminho. Derrube quatro deles e volte aqui.',
    andamento: 'Ainda faltam {faltam}. O acampamento fica no leste, é só seguir o caminho de terra.',
    pronto: 'Você conseguiu! A vila está em dívida com você, andarilho.',
    depois: 'Graças a você a estrada do leste anda mais calma.',
  },
};

// Mapa da Clareira de Vael. Cada mapa novo vira um objeto como este.
// Vila do começo: casas, praça, caminhos e árvores. Tudo aqui é sólido (servidor) e desenhado igual no cliente (client/src/vila.js).
const PRACA = { x: -6, z: -14, r: 4.6 };
const CASAS = [
  // w = largura (frente), d = fundo, h = altura da parede; a porta fica na frente (+z do giro ry), virada para a praça
  { id: 'lider', x: -6, z: -23.2, w: 7.4, d: 5.6, h: 3.6, chamine: true },
  { id: 'casa1', x: -15.5, z: -17.5, w: 5.6, d: 4.6, h: 2.8, chamine: true },
  { id: 'casa2', x: -16.5, z: -8.5, w: 5, d: 4.4, h: 2.7 },
  { id: 'curandeira', x: 4, z: -20.5, w: 5.4, d: 4.6, h: 2.8, chamine: true },
  { id: 'casa3', x: 5.5, z: -12.5, w: 4.8, d: 4.2, h: 2.6 },
  { id: 'ferraria', x: 4.4, z: -5, w: 4.4, d: 3.6, h: 2.6, ry: -1.25, aberta: true, chamine: true }, // virada para o caminho
].map((c) => ({ ...c, ry: c.ry ?? Math.atan2(PRACA.x - c.x, PRACA.z - c.z) }));
const portaDe = (c, dist = 1.2) => ({ x: c.x + Math.sin(c.ry) * (c.d / 2 + dist), z: c.z + Math.cos(c.ry) * (c.d / 2 + dist) });
// ---------- a mata: estrada principal tortuosa e 10 clareiras de caça (pedido do André 2026-11-03) ----------
// A estradinha de terra do leste vira a estrada principal: atravessa o campo de fora, sai dele pelo sul e segue em
// curvas pela mata (nunca reta). Nenhum monstro fica perto dela: cada campo de caça é uma clareira plana e limpa
// (sem árvore nem pedra dentro, só em volta) no meio da mata, a 26 m ou mais da estrada; chega-se por uma trilha
// estreita que sai da estrada e entra entre as árvores. A mata é andável (árvores espaçadas) e fecha nas bordas.
const ESTRADA = [[45, -3.2], [48.5, 1.5], [53, 7.5], [58, 13], [62.5, 19], [64, 27], [62, 37], [67, 47], [80, 56], [98, 62],
  [118, 56], [134, 44], [152, 50], [160, 66], [146, 82], [118, 88], [94, 98], [80, 114], [86, 136], [108, 148], [136, 142],
  [164, 148], [186, 166]];
// distância de (x, z) até a linha de pontos L (e o ponto mais perto)
function pertoDaLinha(L, x, z) {
  let md = Infinity, mp = L[0];
  for (let i = 1; i < L.length; i++) {
    const [ax, az] = L[i - 1], [bx, bz] = L[i], vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))), px = ax + vx * t, pz = az + vz * t;
    const d = Math.hypot(x - px, z - pz); if (d < md) { md = d; mp = [px, pz]; }
  }
  return { d: md, p: mp };
}
// Os 10 campos de caça, da vila para o fim da estrada (nível 1 ao 25; o herói vai até o 30). Cada um tem UM bicho só
// (Puglin, Imp ou Lobo, alternando) e o mesmo nível aparece de novo com outro bicho, para o jogador escolher onde
// subir. A exceção é o Imp Chefe: todo campo tem 1 (pedido do André). caca1 é o campo antigo, agora só de Puglins.
const CLAREIRAS = [
  { id: 'caca1', tipo: 'puglin', nivel: 1, x: 77, z: -8 },
  { id: 'caca2', tipo: 'imp', nivel: 3, x: 34, z: 58 },
  { id: 'caca3', tipo: 'lobo', nivel: 5, x: 104, z: 30 },
  { id: 'caca4', tipo: 'puglin', nivel: 5, x: 160, z: 24 },
  { id: 'caca5', tipo: 'imp', nivel: 10, x: 190, z: 64 },
  { id: 'caca6', tipo: 'lobo', nivel: 10, x: 50, z: 96 },
  { id: 'caca7', tipo: 'puglin', nivel: 15, x: 116, z: 118 },
  { id: 'caca8', tipo: 'imp', nivel: 15, x: 52, z: 150 },
  { id: 'caca9', tipo: 'lobo', nivel: 20, x: 152, z: 112 },
  { id: 'caca10', tipo: 'imp', nivel: 25, x: 206, z: 134 },
  // fim da estrada (2026-11-04): monstros do Mixamo para variar antes do 30; o chefe destes é o Warrok
  { id: 'caca11', tipo: 'golem', nivel: 28, x: 162, z: 190, chefe: 'warrok' },
  { id: 'caca12', tipo: 'maw', nivel: 30, x: 208, z: 186, chefe: 'warrok' },
];
const CLAREIRA_R = 12; // raio do campo (área de combate lisa); as árvores começam 1,5 m depois
// trilha de cada clareira: sai do ponto da estrada mais perto, faz uma curva entre as árvores e entra na clareira
const TRILHAS = CLAREIRAS.map((c, i) => {
  const { p } = pertoDaLinha(ESTRADA, c.x, c.z), dx = c.x - p[0], dz = c.z - p[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  const lado = i % 2 ? 1 : -1, curva = (L - CLAREIRA_R) * 0.28 * lado;
  const em = (t, k) => [+(p[0] + dx * t - uz * k).toFixed(2), +(p[1] + dz * t + ux * k).toFixed(2)];
  const fim = (L - CLAREIRA_R + 2.5) / L;
  return [[+p[0].toFixed(2), +p[1].toFixed(2)], em(fim * 0.3, curva * 0.8), em(fim * 0.62, curva), em(fim, curva * 0.15)];
});

// caminhos de terra (linhas de pontos, largura em metros)
const CAMINHOS = [
  { largura: 2.4, pontos: [[0, 1], [-1.5, -4], [-4, -8.5], [PRACA.x, PRACA.z]] },
  // saída da vila para o leste: sai da estrada larga onde o herói nasce, por fora das casas (o André pediu, 2026-11-02:
  // a estradinha antiga passava espremida entre a casa3 e a ferraria)
  { largura: 2.4, pontos: [[0, 1], [5, 1.2], [10, 0.4], [14, -0.6], [17.5, -1.6], [21, -2.2]] },
  // a estradinha do leste continua: sai da vila pela passagem nas pedras e vira a estrada principal (ESTRADA, abaixo)
  { largura: 2.2, pontos: [[17, -2], [21, -2.2], [24.7, -3.1], [28, -3.9], [31.5, -3.5], [38, -3.4], [45, -3.2]] },
  // trilha estreita até o veio de cobre
  { largura: 1.5, pontos: [[44, -3.4], [45, -7.5], [46, -11.5]] },
  // estrada principal tortuosa pela mata (com o mesmo lastro de terra) e as trilhas que entram na mata até cada clareira
  { largura: 2.2, pontos: ESTRADA },
  ...TRILHAS.map((t) => ({ largura: 1.4, forca: 0.6, pontos: t })),
  ...CASAS.map((c) => ({ largura: 1.5, pontos: [[PRACA.x, PRACA.z], [portaDe(c, 0.6).x, portaDe(c, 0.6).z]] })),
];
// Pedras de verdade (Poly Haven): o herói não atravessa, sobe nas baixas (mini escalada) e escala as grandes.
// modelo = grade de alturas em shared/rochas.js (musgoN = pedra N do rock_moss_set_01); y = quanto fica enterrada
const ROCHAS = [
    { modelo: 'boulder04', x: -7, z: 7, s: 2.4, ry: 0, grande: true },
    { modelo: 'boulder04', x: -12.6, z: 12.6, s: 3.9, ry: 1.1, grande: true }, // a maior: lá de cima se vê a vila
    { modelo: 'boulder04', x: 5, z: 4, s: 0.72, ry: 2 },
    { modelo: 'musgo0', x: 10, z: -16.5, s: 1.9, ry: 0.5, y: -0.1 },
    { modelo: 'musgo1', x: -9, z: -3, s: 1.4, ry: 2.1, y: -0.1 },
    { modelo: 'musgo3', x: 11, z: 9, s: 1.6, ry: 1.2, y: -0.1 },
    { modelo: 'musgo4', x: -25, z: -2, s: 2.5, ry: 4, y: -0.1 },
    { modelo: 'musgo5', x: 15, z: -11, s: 1.3, ry: 0.8, y: -0.1 },
    { modelo: 'musgo0', x: 2, z: 14, s: 2, ry: 3, y: -0.1 },
    { modelo: 'musgo1', x: -19, z: 4, s: 1.8, ry: 5.1, y: -0.1 },
];
// árvores espalhadas em volta (sorteio fixo: servidor e cliente veem as mesmas)
function sortearArvores() {
  let sem = 1234; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const livre = (x, z) => {
    if (x > -22 && x < 11 && z > -28.5 && z < -1.5) return false; // vila
    if (Math.hypot(x - 18, z - 3) < 8) return false; // acampamento do Bando
    if (Math.hypot(x, z) < 6) return false; // onde o herói nasce
    if (Math.hypot(x + 10, z - 10) < 9) return false; // rochas grandes
    if (ROCHAS.some((r) => Math.hypot(x - r.x, z - r.z) < 2.2 * r.s + 1)) return false;
    return true;
  };
  const lista = [];
  for (let t = 0; lista.length < 46 && t < 3000; t++) {
    const a = rnd(0, 6.283), r = rnd(9, 31), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!livre(x, z) || lista.some((o) => Math.hypot(o.x - x, o.z - z) < 3.6)) continue;
    lista.push({ x: +x.toFixed(2), z: +z.toFixed(2), s: +rnd(0.8, 1.25).toFixed(2), ry: +rnd(0, 6.28).toFixed(2), v: lista.length % 3 });
  }
  // algumas na vila, para sombra
  lista.push({ x: -12, z: -12.5, s: 1.1, ry: 1, v: 0 }, { x: -11.5, z: -26.5, s: 0.95, ry: 2, v: 1 }, { x: -1, z: -26, s: 1.2, ry: 4, v: 2 }, { x: -20, z: -13, s: 1, ry: 3, v: 1 });
  // lá fora (depois das da vila, para os ids a0... das árvores de antes não mudarem): bosque em volta do campo de caça,
  // que fica aberto e plano no meio (como as zonas de caça do Quimera), e do veio de cobre
  const longeDe = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) > r;
  // a estrada agora vira para o sul dentro do campo de fora (ESTRADA) e uma trilha leva ao campo dos Puglins
  const estrada = [[24.7, -3.1], [28, -3.9], [31.5, -3.5], [38, -3.4], ...ESTRADA.slice(0, 7)];
  const naEstrada = (x, z) => pertoDaLinha(estrada, x, z).d < 4.5 || pertoDaLinha(TRILHAS[0], x, z).d < 2.4; // a câmera passa sem entrar em tronco
  for (let t = 0, n = 0; n < 34 && t < 4000; t++) {
    const a = rnd(0, 6.283), r = rnd(4, raioNaDirecao(FORA, a) - 2.5), x = FORA.x + Math.cos(a) * r, z = FORA.z + Math.sin(a) * r;
    if (!longeDe(x, z, CACA[0].x, CACA[0].z, CACA[0].r + 1.5) || !longeDe(x, z, MINA[0].x, MINA[0].z, MINA[0].r + 2.2) || naEstrada(x, z)) continue;
    if (Math.abs(x - 45.5) < 2.2 && z < -3 && z > -12) continue; // trilha do cobre
    if (lista.some((o) => Math.hypot(o.x - x, o.z - z) < 3.6)) continue;
    lista.push({ x: +x.toFixed(2), z: +z.toFixed(2), s: +rnd(0.85, 1.3).toFixed(2), ry: +rnd(0, 6.28).toFixed(2), v: lista.length % 3 }); n++;
  }
  // três árvores grandes em cima da borda de pedras, para quebrar a linha (direção de arte)
  for (const a of [0.55, 2.35, 4.6]) {
    const r = raioNaDirecao(FORA, a) + 0.4;
    lista.push({ x: +(FORA.x + Math.cos(a) * r).toFixed(2), z: +(FORA.z + Math.sin(a) * r).toFixed(2), s: 1.55, ry: +(a * 2).toFixed(2), v: lista.length % 3 });
  }
  return lista;
}

// ---------- mapa de fora da vila ----------
// A vila é o círculo de raio 34; a estradinha do leste sai por uma passagem nas pedras (corredor) e chega numa clareira
// grande (FORA, borda irregular) com o primeiro campo de caça e um veio de cobre pequeno.
// borda orgânica (direção de arte): elipse 30 × 23 m alongada para o leste, com ondas na borda (raio varia uns ±20%)
const FORA = { x: 66, z: -3, rx: 30, rz: 23, lobos: [[3, 0.13, 2.1], [2, 0.07, -0.6], [5, 0.05, 2.2]] };
// Campo de caça (regra das zonas de caça do Quimera, znSp): sempre "n" monstros. A cada "passo" s, se falta algum,
// nasce um num ponto ao acaso do campo (até 85% do raio, a pelo menos "longe" m de qualquer jogador). O próximo vem
// em "rapido" s enquanto houver menos da metade, senão em "normal" s. Quem morre some depois de "corpo" s e abre a vaga.
// tipos: um por vaga, para o Godot ter um modelo fixo por vaga. Cada campo é uma clareira (CLAREIRAS, acima) com um
// bicho só e 1 Imp Chefe; nivel = nível dos monstros (vida, dano e XP sobem com ele: NIVEL_INIMIGO).
const NOME_CLAREIRA = { puglin: 'Clareira dos Puglins', imp: 'Clareira dos Imps', lobo: 'Clareira dos Lobos', golem: 'Clareira dos Golens', maw: 'Clareira dos Maws' };
export const CACA = [
  ...CLAREIRAS.map((c) => ({ id: c.id, nome: NOME_CLAREIRA[c.tipo], nivel: c.nivel, bicho: c.tipo, x: c.x, z: c.z, r: CLAREIRA_R,
    n: 11, tipos: [...Array(10).fill(c.tipo), 'chefe'].map((t) => (t === 'chefe' && c.chefe) || t), passo: 0.35, rapido: 0.3, normal: 1.5, longe: 6, corpo: 2.2, ate: 0.85 })),
];
// Nível dos monstros: cada nível acima do 1 soma uma fração da vida, do dano, do XP e do ouro de base (TIPOS_INIMIGO,
// XP_INIMIGO e DROPS). A curva acompanha o herói (dano +8%/nível mais os pontos e o equipamento); XP cai quando o herói
// passa muito do nível do bicho (acima de "folga" níveis, perde "perde" por nível, até "min").
// Diferença de nível igual ao Quimera (André 2026-11-04, "o dano vai diminuindo de acordo com o nível"):
//  - monstro acima do herói bate +danoAcima por nível; herói acima do monstro apanha -danoAbaixo por nível (até danoAbaixoMin)
//  - um golpe de monstro nunca tira mais que teto (chefe: tetoChefe) da vida máxima, vezes o mesmo desconto
//  - herói bate menos em monstro com mais de golpeFolga níveis acima (-golpeCai por nível, até golpeMin) e mais no de
//    nível abaixo (+golpeSobe por nível, até golpeMax)
//  - XP: monstro 2+ níveis acima dá +xpSobe por nível (até xpMax); herói 3+ níveis acima perde xpCai por nível (até xpMin)
//  - nome do monstro: cinza (fácil) com corFacil níveis ou menos, vermelho (perigo) com corForte ou mais, verde no meio
// folga, perde e min eram a regra de XP de antes (sem uso desde 2026-11-04, ficam por causa da regra "Nada some").
export const NIVEL_INIMIGO = { vida: 0.16, dano: 0.18, xp: 0.5, ouro: 0.15, folga: 5, perde: 0.15, min: 0.1,
  danoAcima: 0.06, danoAbaixo: 0.05, danoAbaixoMin: 0.55, teto: 0.3, tetoChefe: 0.45,
  golpeFolga: 3, golpeCai: 0.06, golpeMin: 0.6, golpeSobe: 0.04, golpeMax: 1.4,
  xpSobe: 0.15, xpMax: 1.6, xpCai: 0.2, xpMin: 0.15, corFacil: -3, corForte: 2 };
export const statusInimigo = (tipo, nivel = 1) => {
  const t = TIPOS_INIMIGO[tipo], k = Math.max(0, (nivel || 1) - 1);
  return { vida: Math.round(t.vida * (1 + NIVEL_INIMIGO.vida * k)), dano: Math.round(t.dano * (1 + NIVEL_INIMIGO.dano * k)) };
};
// A mata andável: círculos de borda ondulada ao longo da estrada e em volta de cada clareira, ligados por corredores
// (a saída do campo de fora pelo sul e as trilhas). Sem anel de pedra (direção de arte: borda de mata fechada).
function montarMata() {
  const areas = [], corredores = [{ a: [63, 12], b: [63.5, 34], larg: 12, mata: true }];
  const folga = (x, z) => { // quanto falta até a borda do campo de fora e da vila (para a mata não abrir o anel de pedras)
    const df = Math.hypot(x - FORA.x, z - FORA.z) - raioNaDirecao(FORA, Math.atan2(z - FORA.z, x - FORA.x));
    return Math.min(df, Math.hypot(x, z) - 34);
  };
  const circulo = (x, z, r) => {
    const n = areas.length, rr = Math.min(r, folga(x, z) - 4);
    if (rr >= 9) areas.push({ x: +x.toFixed(2), z: +z.toFixed(2), rx: +rr.toFixed(2), rz: +rr.toFixed(2), mata: true, lobos: [[3, 0.07, n * 1.7], [5, 0.05, n * 0.9]] });
  };
  for (let i = 5; i < ESTRADA.length - 1; i++) { // a cada ~16 m da estrada
    const [ax, az] = ESTRADA[i], [bx, bz] = ESTRADA[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < L; d += 16) circulo(ax + (bx - ax) * d / L, az + (bz - az) * d / L, 24);
  }
  circulo(...ESTRADA[ESTRADA.length - 1], 20);
  CLAREIRAS.forEach((c, i) => {
    if (i === 0) return; // o campo dos Puglins fica dentro do campo de fora
    circulo(c.x, c.z, CLAREIRA_R + 9);
    const t = TRILHAS[i];
    for (let k = 1; k < t.length; k++) corredores.push({ a: t[k - 1], b: t[k], larg: 10, mata: true });
  });
  return { areas, corredores };
}
const MATA = montarMata();

// ---------- cenário da mata: ruínas, pedras, troncos caídos (pedido do André 2026-11-03: "o mapa está muito genérico") ----------
// Modelos CC0 (godot-prototipo/cenario3d, montados por ferramentas/cenario/preparar.mjs a partir do New-Game-Anime-fontes:
// Quaternius Stylized Nature e Medieval Village MegaKit, Poly Haven). Cada CONJUNTO é um lugar marcante montado com várias
// peças: [modelo, dx, dz, dy, ry, s, rx, rz] (metros e radianos, no sistema do conjunto; dy < 0 = enterrado, que é o que
// faz parede e pilar inteiros virarem ruína quebrada). r = raio que o conjunto ocupa (árvore nenhuma nasce dentro).
// Cada clareira de caça ganha um na borda (direção de arte: clareira com um marco) e a estrada ganha outros pelo caminho.
const CONJUNTOS = {
  // torre de vigia caída: quatro pilares de alturas diferentes, paredes afundadas e tortas, uma tombada no chão
  ruina: { r: 4.6, pecas: [
    ['piso', -1, -1, 0.02, 0, 1, 0.02, 0], ['piso', 1, -1, 0.03, 0, 1, 0, -0.03], ['piso', -1, 1, 0.01, 0, 1, -0.03, 0.02],
    ['pilar', -2, -2, -0.3, 0, 1], ['pilar', 2, -2, -1.5, 1.57, 1, 0, 0.05], ['pilar', 2, 2, -2.2, 3.14, 1], ['pilar', -2, 2, -0.9, 4.71, 1, 0.06, 0],
    ['parede', -1, -2, -0.8, 0, 1], ['parede', 1, -2, -1.7, 0, 1, 0, 0.22],
    ['parede_janela', -2, -1, -0.5, 1.57, 1], ['parede', -2, 1, -2.1, 1.57, 1, 0.1, 0],
    ['parede', 3.6, 1.2, 0.05, 0.35, 1, -1.5, 0],
    ['hera1', -1.78, -1, 2.45, 1.57, 1], ['hera4', -0.6, -1.8, 2.2, 0, 1],
    ['tijolo1', 0.4, 0.6, 0.06, 0.4, 1.2], ['tijolo3', 1.3, 1.6, 0.06, 1.9, 1.3], ['tijolo1', 2.8, -0.6, 0.06, 2.6, 1.1], ['tijolo3', -0.2, 2.9, 0.06, 0.2, 1.2],
    ['tijolo1', 3.1, 2.7, 0.06, 1.1, 1], ['tijolo3', -2.9, -2.8, 0.06, 2.2, 1.1], ['tijolo1', 1.6, -2.8, 0.06, 0.8, 1.2],
    ['cogumelo', -2.4, 2.5, 0, 0.5, 0.9], ['samambaia', 2.9, -2.9, 0, 1.2, 0.8], ['arbusto', -3.2, 0.2, 0, 2, 0.9],
  ] },
  // portal em ruínas: um arco de janela de pé entre dois pilares, a escada afundada na frente e a parede vizinha caída
  arco: { r: 3.6, pecas: [
    ['parede_janela', 0, 0, -0.35, 0, 1], ['pilar', -1.15, 0, -0.3, 0, 1], ['pilar', 1.15, 0, -0.9, 3.14, 1, 0, -0.04],
    ['escada', 0, 1.35, -0.55, 3.14, 1, 0.05, 0], ['parede', 2.25, 0.2, -1.9, 0, 1, 0, 0.25], ['parede', -2.4, -0.6, -2.3, 0.2, 1, 0, -0.18],
    ['hera4', 0.55, 0.12, 2.25, 0, 1], ['hera1', -0.95, 0.15, 2.5, 0, 0.9],
    ['tijolo1', 1.2, 1.2, 0.06, 0.4, 1.2], ['tijolo3', 2.6, 1.4, 0.06, 1.2, 1.2], ['tijolo1', -1.8, 1.6, 0.06, 2.2, 1.1], ['tijolo3', -2.9, 0.8, 0.06, 0.6, 1.2],
    ['arbusto', -2.5, 1.9, 0, 0.3, 0.8], ['samambaia', 2.6, -1.4, 0, 2.2, 0.7],
  ] },
  // santuário: uma estátua velha num piso de pedra, cercada por pilares quebrados quase no chão
  estatua: { r: 3.4, pecas: [
    ['piso', -1, -1, 0.02, 0, 1, 0.02, 0], ['piso', 1, -1, 0.02, 0, 1, 0, 0.02], ['piso', -1, 1, 0.01, 0, 1, -0.02, 0], ['piso', 1, 1, 0.03, 0, 1, 0, -0.03],
    ['estatua', 0, -0.2, 0.02, 0, 1.25],
    ['pilar', -1.9, -1.9, -2.2, 0, 1], ['pilar', 1.9, -1.9, -2.4, 1.57, 1], ['pilar', 1.9, 1.9, -1.9, 3.14, 1, 0.08, 0], ['pilar', -1.9, 1.9, -2.5, 4.71, 1],
    ['tijolo1', 2.3, 0.4, 0.06, 0.4, 1.2], ['tijolo3', -2.4, -0.3, 0.06, 1.7, 1.2], ['tijolo1', 0.5, 2.5, 0.06, 2.4, 1.1],
    ['arbusto_flor', -2.6, 1.0, 0, 0.6, 0.8], ['arbusto_flor', 2.6, -1.2, 0, 2.6, 0.75], ['samambaia', 0.3, -2.7, 0, 1.4, 0.7],
  ] },
  // rochedo: pedras grandes amontoadas, com cogumelo e samambaia na sombra
  rochedo: { r: 4.2, pecas: [
    ['rocha3', 0, 0, 0, 0, 1.6], ['rocha1', 2.7, 1.1, 0, 1, 1.1], ['rocha2', -2.4, 1.3, 0, 2, 0.8], ['rocha2', 1.1, 2.8, 0, 4, 0.45],
    ['cogumelo', -1.2, 2.6, 0, 0.3, 1], ['cogumelo', -0.7, 2.9, 0, 2, 0.7], ['cogumelo', 3.3, -0.6, 0, 1, 0.8],
    ['samambaia', -2.6, -1.6, 0, 0.8, 0.8], ['arbusto', 3.4, 2.6, 0, 1.4, 0.8],
  ] },
  // tronco caído: dois troncos velhos no chão, com orelha-de-pau e cogumelos
  tronco: { r: 3.8, pecas: [
    ['tronco_caido', 0, 0, 0.05, 0, 1.5], ['tronco_caido', 1.0, 2.3, 0.02, 0.9, 1.0],
    ['orelha_de_pau', 0.9, 0.35, 0.45, 0, 0.6], ['orelha_de_pau', -1.6, -0.45, 0.3, 3.1, 0.5],
    ['cogumelo', -0.6, 0.95, 0, 0.4, 0.9], ['cogumelo', -0.2, 1.1, 0, 2.2, 0.6], ['cogumelo', 2.4, 1.2, 0, 1.1, 0.8],
    ['toco2', 3.4, -0.9, 0, 0.5, 1], ['samambaia', -2.8, 1.2, 0, 1.2, 0.8], ['planta', 1.6, -1.3, 0, 0.6, 1.2],
  ] },
  // árvore morta gigante: marca de longe (sem folha), pedras na raiz
  arvore_morta: { r: 3.4, pecas: [
    ['arvore_morta3', 0, 0, 0, 0, 0.85], ['rocha2', 1.8, 1.1, 0, 0.7, 0.5], ['rocha1', -1.7, -1.4, 0, 2.3, 0.35],
    ['cogumelo', 0.9, -1.0, 0, 0.3, 0.8], ['orelha_de_pau', -0.55, 0.35, 0.7, 2.6, 0.5], ['samambaia', -1.8, 1.6, 0, 0.4, 0.7],
  ] },
  // acampamento abandonado: fogueira de pedra, tocos de banco, um tronco e a carroça largada torta
  acampamento: { r: 4.4, pecas: [
    ['fogueira', 0, 0, 0.05, 0, 1], ['toco2', 1.7, 0.4, 0, 0.5, 0.8], ['toco2', -1.2, 1.4, 0, 2.1, 0.75], ['tronco_caido', 0, -1.9, 0.02, 0.15, 0.9],
    ['carroca', 3.0, -1.6, 0.0, 0.6, 1, 0, 0.12], ['arbusto', -2.8, -1.5, 0, 0.4, 0.9], ['cogumelo', -2.0, 2.2, 0, 1.2, 0.8],
  ] },
};
// raio de colisão de cada modelo (os pequenos não têm: o herói passa por cima de tijolo, cogumelo e planta).
// tronco_caido e paredes viram uma fila de círculos ao longo do comprimento (x do modelo).
const SOLIDO_CENARIO = { pilar: 0.4, estatua: 0.75, rocha1: 1.35, rocha2: 1.2, rocha3: 1.4, arvore_morta1: 0.55, arvore_morta3: 0.6, fogueira: 0.75, toco2: 0.65 };
// altura de cada modelo (m, sem escala): por cima disso não bate (a câmera passa por cima do tronco caído)
const ALTO_CENARIO = { pilar: 3, estatua: 1.7, rocha1: 2, rocha2: 1.85, rocha3: 2, arvore_morta1: 9, arvore_morta3: 12.9, fogueira: 0.2, toco2: 0.3, parede: 3.1, parede_janela: 3.1, tronco_caido: 0.75, carroca: 1.5, escada: 1 };
const FILA_CENARIO = { parede: [[-0.65, 0.4], [0, 0.4], [0.65, 0.4]], parede_janela: [[-0.7, 0.4], [0.7, 0.4]], tronco_caido: [[-1.35, 0.4], [-0.45, 0.42], [0.45, 0.42], [1.35, 0.4]], carroca: [[0, 0.9]], escada: [[0, 0.95]] };
// marcos: cada clareira (menos a primeira, que fica no campo de fora) e alguns pontos da estrada (índice em ESTRADA, lado)
const MARCOS_CLAREIRA = ['ruina', 'rochedo', 'estatua', 'tronco', 'arco', 'arvore_morta', 'ruina', 'acampamento', 'rochedo', 'rochedo', 'arvore_morta']; // caca11 (golem) e caca12 (Maw): 2026-11-04
const MARCOS_ESTRADA = [[5, 1, 'tronco'], [8, -1, 'arco'], [11, 1, 'arvore_morta'], [14, -1, 'ruina'], [17, 1, 'estatua'], [20, -1, 'tronco'], [22, 1, 'ruina']];
function montarCenario() {
  const M = { areas: [{ x: 0, z: 0, r: 34 }, FORA].concat(MATA.areas), corredores: [{ a: [27, -2.7], b: [44, -3.4], larg: 9 }].concat(MATA.corredores) };
  const marcos = [], pecas = [], solidos = [], arvoresVila = sortearArvores();
  const cabe = (x, z, r) => arvoresVila.every((a) => Math.hypot(x - a.x, z - a.z) > r + 0.6) && dentroDoMapa(M, x, z, r * 0.6) && Math.hypot(x, z) > 40
    && pertoDaLinha(ESTRADA, x, z).d > r + 3 && TRILHAS.every((L) => pertoDaLinha(L, x, z).d > r + 2)
    && CLAREIRAS.every((c) => Math.hypot(x - c.x, z - c.z) > CLAREIRA_R + r + 0.5)
    && Math.hypot(x - MINA[0].x, z - MINA[0].z) > MINA[0].r + r + 2
    && marcos.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 6);
  // procura um lugar perto de (cx, cz) na direção ang (tenta girar e afastar) e vira a frente (+z do conjunto) para (fx, fz)
  const colocar = (tipo, cx, cz, ang, dist, fx, fz) => {
    const C = CONJUNTOS[tipo];
    for (let t = 0; t < 40; t++) {
      const a = ang + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 0.22, d = dist + (t >= 20 ? 2.5 : 0);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!cabe(x, z, C.r)) continue;
      const ry = Math.atan2(fx - x, fz - z);
      marcos.push({ tipo, x: +x.toFixed(2), z: +z.toFixed(2), r: C.r, ry: +ry.toFixed(3) });
      return true;
    }
    return false;
  };
  CLAREIRAS.slice(1).forEach((c, i) => {
    const t = TRILHAS[i + 1], [ex, ez] = t[t.length - 1]; // a trilha entra por aqui: o marco fica do outro lado, um pouco de lado
    const ang = Math.atan2(c.z - ez, c.x - ex) + (i % 2 ? 0.7 : -0.7);
    colocar(MARCOS_CLAREIRA[i], c.x, c.z, ang, CLAREIRA_R + CONJUNTOS[MARCOS_CLAREIRA[i]].r + 1.2, c.x, c.z);
  });
  for (const [i, lado, tipo] of MARCOS_ESTRADA) {
    const [ax, az] = ESTRADA[Math.max(0, i - 1)], [bx, bz] = ESTRADA[Math.min(ESTRADA.length - 1, i + (i === ESTRADA.length - 1 ? 0 : 1))];
    const [px, pz] = ESTRADA[i], dir = Math.atan2(bz - az, bx - ax) + lado * Math.PI / 2;
    colocar(tipo, px, pz, dir, CONJUNTOS[tipo].r + 4.2, px, pz);
  }
  // as peças em coordenadas do mundo (y = dy: o chão da mata é plano) e os sólidos de cada uma
  for (const mk of marcos) {
    const cs = Math.cos(mk.ry), sn = Math.sin(mk.ry);
    const mundo = (dx, dz) => [mk.x + dx * cs + dz * sn, mk.z - dx * sn + dz * cs];
    for (const [m, dx, dz, dy, ry, s, rx = 0, rz = 0] of CONJUNTOS[mk.tipo].pecas) {
      const [x, z] = mundo(dx, dz), rr = mk.ry + ry;
      pecas.push({ m, x: +x.toFixed(2), z: +z.toFixed(2), y: dy, ry: +rr.toFixed(3), s, ...(rx ? { rx } : {}), ...(rz ? { rz } : {}) });
      const alto = +Math.max(0.2, (rx ? 0.45 : ALTO_CENARIO[m] * s) + dy).toFixed(2); // parede tombada (rx) fica baixinha
      if (SOLIDO_CENARIO[m]) solidos.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: +(SOLIDO_CENARIO[m] * s).toFixed(2), alto });
      for (const [lx, r] of FILA_CENARIO[m] || []) { // ao longo do x do modelo, girado com ele
        const c2 = Math.cos(rr), s2 = Math.sin(rr);
        solidos.push({ x: +(x + lx * s * c2).toFixed(2), z: +(z - lx * s * s2).toFixed(2), r: +(r * s).toFixed(2), alto });
      }
    }
  }
  return { marcos, pecas, solidos };
}
let CENARIO_FEITO = null; // montado na primeira vez que alguém pede (a MINA é declarada mais abaixo)
const cenario = () => (CENARIO_FEITO ||= montarCenario());
// Árvores da mata (enfeite sólido; desde 2026-11-03 todas dão lenha, ids m0, m1...): espaçadas dentro da área andável
// (dá para andar entre elas), fechadas num anel em volta de cada clareira e numa faixa densa logo depois da borda.
// Nada na estrada, nas trilhas, dentro das clareiras nem em cima dos marcos (CENARIO). Sorteio fixo: servidor, site e
// Godot veem as mesmas (o Godot desenha em MultiMesh, por pedaços).
// 2026-11-03 (André: "pode diminuir a quantidade delas"): por dentro da mata andável o espaço entre árvores subiu de
// 5,4 m para 6,6 m (menos árvores, mais chão para os marcos e o mato); o anel das clareiras e a borda continuam fechados.
function sortearMata() {
  let sem = 4321; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const M = { areas: MATA.areas, corredores: MATA.corredores };
  const x0 = Math.min(...MATA.areas.map((a) => a.x - a.rx)) - 12, x1 = Math.max(...MATA.areas.map((a) => a.x + a.rx)) + 12;
  const z0 = Math.min(...MATA.areas.map((a) => a.z - a.rz)) - 12, z1 = Math.max(...MATA.areas.map((a) => a.z + a.rz)) + 12;
  const grade = new Map(), cel = 6, chave = (i, j) => i * 10007 + j, lista = [];
  const livre = (x, z, esp) => {
    const i = Math.floor(x / cel), j = Math.floor(z / cel);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const o of grade.get(chave(a, b)) || []) if (Math.hypot(o.x - x, o.z - z) < esp) return false;
    return true;
  };
  const tentativas = Math.round((x1 - x0) * (z1 - z0) / 2.2);
  for (let t = 0; t < tentativas; t++) {
    const x = rnd(x0, x1), z = rnd(z0, z1), dentro = dentroDoMapa(M, x, z, 0);
    if (!dentro && !dentroDoMapa(M, x, z, -9)) continue; // longe demais da borda: ninguém vê
    const df = Math.hypot(x - FORA.x, z - FORA.z) - raioNaDirecao(FORA, Math.atan2(z - FORA.z, x - FORA.x));
    if (df < 2 || Math.hypot(x, z) < 37) continue; // o campo de fora e a vila têm as árvores deles
    if (pertoDaLinha(ESTRADA, x, z).d < 5.5 || TRILHAS.some((L) => pertoDaLinha(L, x, z).d < 2.2)) continue;
    const dc = Math.min(...CLAREIRAS.map((c) => Math.hypot(x - c.x, z - c.z)));
    if (dc < CLAREIRA_R + 1.5) continue; // a área de combate fica limpa
    if (cenario().marcos.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 1.2)) continue; // em cima de ruína ou rochedo, não
    const anel = dc < CLAREIRA_R + 5, esp = anel ? 2.7 : dentro ? 6.6 : 3.3;
    if (!livre(x, z, esp)) continue;
    // direção de arte: nada de pomar. Tamanho de 0,7 a 1,4, modelo ao acaso e a posição ainda sai até 40% do espaço
    // para o lado (a grade de espaço usa a posição sorteada; o tremido só vale se não cair na estrada nem na clareira)
    let jx = x + rnd(-0.4, 0.4) * esp, jz = z + rnd(-0.4, 0.4) * esp;
    if (pertoDaLinha(ESTRADA, jx, jz).d < 5.5 || TRILHAS.some((L) => pertoDaLinha(L, jx, jz).d < 2.2)
      || Math.min(...CLAREIRAS.map((c) => Math.hypot(jx - c.x, jz - c.z))) < CLAREIRA_R + 1.5
      || cenario().marcos.some((o) => Math.hypot(jx - o.x, jz - o.z) < o.r + 1.2)) { jx = x; jz = z; }
    const a = { x: +jx.toFixed(2), z: +jz.toFixed(2), s: +(dentro && !anel ? rnd(0.7, 1.4) : rnd(0.9, 1.4)).toFixed(2), ry: +rnd(0, 6.28).toFixed(2), v: Math.floor(rnd(0, 2.999)) };
    lista.push(a);
    const k = chave(Math.floor(x / cel), Math.floor(z / cel)); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(a);
  }
  // Terras da Estrada (2026-11-04, André tirou o anel de pedras): a borda vira mata fechada, três fileiras de árvores
  // tortas por fora da área e da passagem. Vêm depois das outras, para os ids m0, m1... de antes não mudarem.
  const T = VILA_LOTES.area, P = VILA_LOTES.passagem;
  const andavel = { areas: [{ x: 0, z: 0, r: 34 }, FORA, ...MATA.areas, T], corredores: [...MATA.corredores, P] };
  const borda = [];
  for (const [fora, esp] of [[1.2, 2.6], [3.9, 3.0], [6.8, 3.6]]) {
    for (let a = 0; a < 6.283;) {
      const R = raioNaDirecao(T, a) + fora;
      borda.push([T.x + Math.cos(a) * R, T.z + Math.sin(a) * R, esp]);
      a += esp / R;
    }
  }
  const [pax, paz] = P.a, [pbx, pbz] = P.b, pl = Math.hypot(pbx - pax, pbz - paz); // paredes da passagem
  for (let d = 0; d <= pl; d += 2.8) for (const lado of [-1, 1]) for (const fora of [1.2, 3.9]) {
    const off = P.larg / 2 + fora, ux = (pbx - pax) / pl, uz = (pbz - paz) / pl;
    borda.push([pax + ux * d - uz * off * lado, paz + uz * d + ux * off * lado, 2.6]);
  }
  for (const [bx, bz, esp] of borda) {
    const x = bx + rnd(-0.35, 0.35) * esp, z = bz + rnd(-0.35, 0.35) * esp;
    if (dentroDoMapa(andavel, x, z, -0.9) || !livre(x, z, esp * 0.8)) continue; // não fecha a passagem nem a estrada
    if (pertoDaLinha(VILA_LOTES.estrada, x, z).d < 3) continue;
    const a = { x: +x.toFixed(2), z: +z.toFixed(2), s: +rnd(0.9, 1.4).toFixed(2), ry: +rnd(0, 6.28).toFixed(2), v: Math.floor(rnd(0, 2.999)) };
    lista.push(a);
    const k = chave(Math.floor(x / cel), Math.floor(z / cel)); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(a);
  }
  return lista;
}
// Veio de cobre (zona de mineração do Quimera, só que pequena e com pouco minério, pedido do André 2026-11-02):
// "veios" pedras no círculo de raio r. O minério é de todos: quando alguém esgota uma pedra, ela some para todo mundo
// e volta em "volta" s (no Quimera a pedra minerada volta em 6 min).
export const MINA = [
  { id: 'cobre1', nome: 'Veio de cobre', tipo: 'cobre', x: 46, z: -15, r: 4.5, veios: 6, volta: 360 },
];
// NPC de resetar a build (o Mestre Ivo do Quimera): devolve os pontos de atributo; as skills ficam (sobem usando).
// Preço do Quimera: max(500, 50 x nível); aqui o ouro é mais curto, então max(minimo, porNivel x nível).
export const RESET_BUILD = { minimo: 50, porNivel: 10 };
// Voltar para a vila (André 2026-11-03): botão da casinha no menu do topo. Canalização lenta (canal s, parado; andar,
// atacar ou levar dano cancela) e o herói aparece na praça. Recarga de cd s (10 min, como no Quimera), guardada na conta:
// sair e entrar de novo não zera. Dentro da vila (raio vila m do centro) não precisa.
export const VOLTA_VILA = { canal: 8, cd: 600, vila: 30 };

// ---------- Terras (construção e fazenda, pedido do André 2026-11-03, base no Quimera) ----------
// Ao sul da vila do começo, uma área de terra livre com uma estrada central de terra. Não tem lote pronto: o jogador
// escolhe o pedaço que quer comprar (toca num canto e arrasta até o outro, como no Quimera) e paga por bloco de 1 m².
// Fora do terreno dele não se constrói (regra do André: "não vai poder construir em qualquer lugar").
// 2026-11-04 (André, "remoção aprovada"): saíram os 6 lotes prontos com estaca, corda e placa, a rua de través e o
// anel de pedras em volta da área (a borda agora é de árvores, como a mata). Quem já tinha comprado um lote antigo
// fica com o mesmo pedaço de chão (LOTES_ANTIGOS), agora como terreno.
// Terreno: retângulo alinhado aos eixos (x0..x1, z0..z1, em metros inteiros; a horta usa quadrados de 1 m).
export const VILA_LOTES = {
  nome: 'Terras da Estrada',
  // semPedras: a área e a passagem não ganham anel de pedras (client/src/cena.js); a borda é de árvores (sortearArvores)
  area: { x: -16, z: 68.5, rx: 22, rz: 27, lobos: [[3, 0.025, 1.3], [5, 0.02, 0.4]], lotes: true, semPedras: true },
  passagem: { a: [-10, 28], b: [-15, 47], larg: 9, semPedras: true },
  // estrada de terra que sai de onde o herói nasce, passa pela passagem e vira a estrada central das terras
  estrada: [[0, 1], [-1, 10], [-2, 15], [-6.5, 21], [-10, 28], [-12.5, 35], [-14.5, 42], [-16, 48]],
  ruas: [
    { largura: 2.8, pontos: [[-16, 48], [-16, 58], [-16, 70], [-16, 92]] }, // estrada central (norte-sul)
  ],
  lotes: [], // não tem lote pronto: os terrenos nascem quando alguém compra (Simulacao.comprarLote)
};
// Lotes da primeira versão (2026-11-03): quem comprou um deles continua dono do mesmo chão
export const LOTES_ANTIGOS = {
  lote1: { x0: -28, x1: -18, z0: 51, z1: 61 }, lote2: { x0: -14, x1: -4, z0: 51, z1: 61 },
  lote3: { x0: -28, x1: -18, z0: 64, z1: 74 }, lote4: { x0: -14, x1: -4, z0: 64, z1: 74 },
  lote5: { x0: -28, x1: -18, z0: 76, z1: 86 }, lote6: { x0: -14, x1: -4, z0: 76, z1: 86 },
};
// Regras do terreno (o servidor confere tudo em Simulacao.comprarLote / construir / horta)
// precoBloco: ouro por bloco de 1 x 1 m (maior = mais caro; estimativa, o André ajusta depois)
// ladoMin / ladoMax: lados do terreno em metros · areaMax: blocos no máximo · uma pessoa tem um terreno só
// folgaRua: metros livres entre o terreno e a beira da estrada · folgaBorda: metros até a borda das árvores
// alcance: até quantos metros fora do terreno o herói pode estar para construir (a câmera flutua, como no Quimera)
// pecasPorBloco: peças que cabem (mínimo pecasMin, máximo maxPecas) · estacaoDist: perto da estação para criar
// preco e placaDist eram do lote pronto de 10 x 10 (sem uso desde 2026-11-04, ficam por causa da regra "Nada some")
export const LOTE = { preco: 400, placaDist: 3, precoBloco: 4, ladoMin: 3, ladoMax: 20, areaMax: 300, folgaRua: 0.6, folgaBorda: 1.5,
  alcance: 6, pecasPorBloco: 0.4, pecasMin: 12, maxPecas: 120, estacaoDist: 3 };
export const precoTerreno = (w, d) => Math.max(0, Math.round(w) * Math.round(d)) * LOTE.precoBloco;
export const maxPecasTerreno = (w, d) => Math.max(LOTE.pecasMin, Math.min(LOTE.maxPecas, Math.round(w * d * LOTE.pecasPorBloco)));
// Peças que se constroem no lote (aba Construir do modo construção, como no Quimera). w x d = tamanho no chão (m)
// sem girar; circulos = sólidos [dx, dz, r] no espaço da peça (o herói não atravessa); custo sai da mochila e volta
// inteiro ao desmontar. estacao: as receitas que dá para criar perto dela (mesma conta do servidor, RECEITA_ESTACAO).
// Modelos: Fantasy Props MegaKit e Medieval Village MegaKit (Quaternius, CC0, do repositório de fontes); a fornalha é
// de pedra como a forja da ferraria da vila (godot-prototipo/construcao.gd).
export const CONSTRUCOES = {
  bancada: { nome: 'Bancada de trabalho', w: 2, d: 1, circulos: [[-0.5, 0, 0.5], [0.5, 0, 0.5]], custo: { lenha: 6, pedra: 3 }, estacao: 'alf',
    desc: 'Perto dela você costura como na banca da Rosa (receitas do Alfaiate).' },
  bigorna: { nome: 'Bigorna', w: 0.8, d: 0.8, circulos: [[0, 0, 0.4]], custo: { barra_ferro: 3, lenha: 2 }, estacao: 'fer',
    desc: 'Perto dela você forja espadas, cajados, colares e armaduras (receitas do Ferreiro).' },
  fornalha: { nome: 'Fornalha', w: 1.4, d: 1.2, circulos: [[0, 0, 0.7]], custo: { pedra: 12, lenha: 2 }, estacao: 'fundir',
    desc: 'Derrete minério em barras e queima lenha em carvão.' },
  cerca: { nome: 'Cerca', w: 2, d: 0.3, circulos: [[-0.75, 0, 0.2], [0, 0, 0.2], [0.75, 0, 0.2]], custo: { lenha: 2 },
    desc: 'Cerca de madeira de 2 m. Gire para mudar a direção.' },
};
// Plantas da horta (números do Quimera: G = horas de rega para ficar madura, y = quantos saem na colheita,
// a terra regada fica molhada por "rega" horas; sem água a planta não cresce)
export const HORTA = { rega: 24, vigor: 1 };
export const PLANTAS = {
  rabanete: { nome: 'Rabanete', G: 0.5, y: [2, 3], semente: 2, venda: 2, cura: 0.05, cor: '#e8486a', folha: '#5fae4a' },
  cenoura: { nome: 'Cenoura', G: 2, y: [2, 4], semente: 4, venda: 3, cura: 0.08, cor: '#ff8a2a', folha: '#4f9a44' },
  batata: { nome: 'Batata', G: 2, y: [3, 5], semente: 4, venda: 3, cura: 0.06, cor: '#c9a46a', folha: '#5f8f3a' },
  tomate: { nome: 'Tomate', G: 2, y: [3, 6], semente: 8, venda: 5, cura: 0.08, cor: '#e8402e', folha: '#4f9a44' },
  milho: { nome: 'Milho', G: 2, y: [2, 4], semente: 8, venda: 5, cura: 0.08, cor: '#ffd23f', folha: '#7fb04a' },
  abobora: { nome: 'Abóbora', G: 4, y: [1, 2], semente: 20, venda: 14, cura: 0.2, cor: '#ff9a2a', folha: '#4f8a3c' },
};
// fase da planta (0 semente, 1 broto, 2 média, 3 quase, 4 madura) pela fração crescida (Quimera WJ)
export const fasePlanta = (f) => (f >= 1 ? 4 : f < 0.03 ? 0 : f < 0.4 ? 1 : f < 0.75 ? 2 : 3);
// qual estação serve para a receita: barras e carvão na fornalha; o resto do Ferreiro na bigorna; Alfaiate na bancada
export const RECEITA_ESTACAO = (R) => (/^barra_|^carvao$/.test(R.faz) ? 'fornalha' : R.prof === 'fer' ? 'bigorna' : 'bancada');
CAMINHOS.push({ largura: 2.4, pontos: VILA_LOTES.estrada }, ...VILA_LOTES.ruas);

export const MAPA_CLAREIRA = {
  id: 'clareira',
  nome: 'Vila da Clareira',
  raio: 34,
  nascimento: { x: 0, z: 1 },
  // onde dá para andar: a vila (raio 34), a passagem da estradinha do leste e a clareira de fora (shared/mapa.js)
  // e a mata (MATA, pedido do André 2026-11-03): círculos ao longo da estrada e das clareiras, sem anel de pedra
  areas: [{ x: 0, z: 0, r: 34 }, FORA].concat(MATA.areas, [VILA_LOTES.area]), // + Vila dos Lotes (construção e fazenda)
  corredores: [{ a: [27, -2.7], b: [44, -3.4], larg: 9 }].concat(MATA.corredores, [VILA_LOTES.passagem]),
  // máscara do chão (trilhas e praça) cobre a vila e a área de fora: x0, z0 e o tamanho do quadrado em metros
  mascara: { x0: -38, z0: -62, tam: 292, px: 2048 }, // 2026-11-03: cresceu para cobrir a mata (mesma nitidez)
  // minimapa (desenho de cima: client/src/minimapa.js -> modelos/minimapa.png): quadrado que pega o mapa todo
  minimapa: { x0: -44, z0: -44, tam: 288, px: 1024 },
  // inimigos parados num lugar (renascem no mesmo lugar). Dentro da vila não tem mais nenhum (pedido do André
  // 2026-11-02): os monstros ficam no campo de caça lá fora (CACA)
  inimigos: [],
  caca: CACA,
  mina: MINA,
  // espantalho de treino ao lado da ferraria, na grama entre a parede dela, os caixotes e a estrada larga (fora dos
  // caminhos), a 4,6 m do Tomás para os nomes não se encostarem (direção de arte);
  // virado para a estrada, de onde o herói chega. O v dele vem depois das vagas dos campos de caça.
  treino: [{ id: 'espantalho1', tipo: 'espantalho', x: 5, z: -1.2, ry: -0.8 }],
  // NPCs da vila: personagens anime (VRoid CC0) com cabelo, roupa e tamanho próprios. funcao: o que o botão Falar faz (veja Simulacao.falar e client/src/main.js)
  // acoes: o que aparece no menu do NPC no app (botão de interação, como no Quimera); 'Conversar' sempre aparece.
  // 'vender' = ele compra itens da mochila (o servidor confere: Simulacao.pertoDeQuemCompra)
  npcs: [
    { id: 'lider', nome: 'Aldo, o líder da vila', x: -6, z: -18.6, ry: 0, visual: 'fumiriya', escala: 1.03, tinta: { cabelo: 0xc9c7c2, roupa: 0x5b3a24, calca: 0x3b3229 }, funcao: 'missao', missao: 'bando', acoes: ['missao'], falas: [
      'Andarilho, monstros apareceram no leste. Derrube quatro deles e a vila te deve uma.',
      'A praça foi construída pelos nossos avós. Enquanto eu viver, ela fica de pé.',
    ] },
    { id: 'ferreiro', nome: 'Tomás, o ferreiro', x: 1.5, z: -4.2, ry: -1.25, visual: 'cabelo_m', escala: 1.08, tinta: { cabelo: 0x4a2f1c, roupa: 0x6b4a2e, calca: 0x2f2a24 }, funcao: 'habilidades', acoes: ['vender', 'forja', 'habilidades'], falas: [
      'Essa espada corta e conjura. Fale comigo para escolher os seus golpes e magias.',
      'Bigorna boa é bigorna quente. Volte quando quiser trocar a build.',
    ] },
    { id: 'curandeira', nome: 'Irmã Lúcia, a curandeira', x: 1.4, z: -17.6, ry: -1, visual: 'shino', tinta: { cabelo: 0xe4e0d8, roupa: 0xe8e1cf, calca: 0x6d7f8c }, funcao: 'cura', acoes: ['cura'], falas: [
      'Ferido? Fale comigo e eu cuido de você.',
      'As ervas da clareira curam quase tudo. Quase.',
    ] },
    { id: 'andarilho', nome: 'Bento, o andarilho', x: -3.5, z: 5.2, ry: 2.4, visual: 'fumiriya', escala: 0.9, tinta: { cabelo: 0x8a4a22, roupa: 0x4f5e36, calca: 0x4a3c2c }, funcao: 'dica', acoes: [], falas: [
      'Já subiu na rocha mais alta, perto daqui? Lá de cima se vê a vila inteira.',
      'A escada na rocha menor é o jeito fácil. Na grande, só escalando.',
      'Pedra baixa você sobe andando. Na alta, agarre e vá subindo. Correndo contra ela, dá até para correr pela parede.',
    ] },
    { id: 'comerciante', nome: 'Rosa, a comerciante', x: -9.6, z: -11.2, ry: 0.9, visual: 'vivi', tinta: { cabelo: 0x5a1e24, roupa: 0xa0563c, calca: 0x3c3a52 }, funcao: 'loja', acoes: ['comprar', 'vender', 'alfaiate'], falas: [
      'Minha carroça chega em breve com mercadoria da cidade.',
      'Tenho de tudo um pouco... quer dizer, vou ter.',
    ] },
    { id: 'reset', nome: 'Mestre Ivo, o instrutor', x: 2.6, z: 4.6, ry: -2.4, visual: 'cabelo_m', escala: 1.0, tinta: { cabelo: 0x2a2622, roupa: 0x3c4a5e, calca: 0x2b2a30 }, funcao: 'resetar', acoes: ['resetar'], falas: [
      'Quer recomeçar a build? Eu devolvo seus pontos de atributo. As skills ficam, porque sobem usando.',
    ] },
  ],
  rochas: ROCHAS,
  // escada de madeira encostada na rocha grande: pé no chão e topo na beirada
  escadas: [{ x: -7, z: 4, ry: 0, topo: { x: -7, z: 5.3 } }],
  // sólidos pequenos: poço da praça, caixotes da ferraria, banca da comerciante
  obstaculos: [{ x: PRACA.x, z: PRACA.z, r: 1.15 }, { x: 6.6, z: -2.4, r: 0.8 }, { x: -10.7, z: -12.3, r: 0.75 }],
  // objetos de enfeite (Poly Haven) desenhados pelo cliente; os que atrapalham a passagem estão em obstaculos
  props: [
    { tipo: 'caixote', x: 6.4, z: -2.2, ry: 0.4 }, { tipo: 'caixote', x: 7.2, z: -2.9, s: 0.8, ry: 1.1 }, { tipo: 'caixote', x: 6.6, z: -2.3, s: 0.7, ry: 0.9, y: 0.62 },
    { tipo: 'mesa', x: -10.7, z: -12.3, ry: 0.9 }, { tipo: 'caixote', x: -11.6, z: -11.2, s: 0.8, ry: 0.3 }, { tipo: 'balde', x: -9.9, z: -13.3, ry: 1 },
    { tipo: 'balde', x: PRACA.x + 1.25, z: PRACA.z + 0.5, ry: 2 }, { tipo: 'toco', x: -18.5, z: -14, ry: 1 }, { tipo: 'toco', x: 8.6, z: -19, s: 0.8, ry: 3 },
  ],
  vila: { praca: PRACA, casas: CASAS, caminhos: CAMINHOS, arvores: sortearArvores() },
  // Vila dos Lotes: onde se compra lote para construir e plantar (VILA_LOTES, LOTE, CONSTRUCOES, PLANTAS)
  lotes: VILA_LOTES.lotes,
  // árvores da mata (enfeite sólido, sem lenha) e a estrada principal (minimapa)
  mata: sortearMata(),
  estrada: ESTRADA,
};

// Corpos que o jogador pode escolher para o herói. Os avatares VRoid A, B e C nunca entram (licença).
// As duas bases (VRoid CC0) vêm primeiro: o criador de personagem pinta cabelo, olhos, pele e roupa em cima delas.
export const PERSONAGENS = [
  { id: 'cabelo_f', nome: 'Base feminina', tipo: 'vrm', base: true },
  { id: 'cabelo_m', nome: 'Base masculina', tipo: 'vrm', base: true },
  { id: 'ruiva', nome: 'Ruiva', tipo: 'vrm' },
  { id: 'vita', nome: 'Vita', tipo: 'vrm' },
  { id: 'vivi', nome: 'Vivi', tipo: 'vrm' },
  { id: 'victoria', nome: 'Victoria', tipo: 'vrm' },
  { id: 'shino', nome: 'Shino', tipo: 'vrm' },
  { id: 'shibu', nome: 'Shibu', tipo: 'vrm' },
  { id: 'shibu_sombrio', nome: 'Shibu Sombrio', tipo: 'vrm' },
];
// Cores do criador (null = a cor original do modelo). O servidor só aceita cores desta lista.
export const CRIADOR = {
  cabelo: [null, 0x1c1a1f, 0x3b2619, 0x6b4429, 0xa8401c, 0xd9b36c, 0xe9e4d8, 0x9a9894, 0x2f4f9c, 0xd9799a, 0x3f7a4a, 0x5b3a8a, 0x9c1c24],
  olhos: [null, 0x6b3f22, 0xb07a2a, 0x3d8a4a, 0x3a6fd0, 0x8a96a0, 0x7a4ac0, 0xc02a2a, 0xe0b030],
  pele: [null, 0xffe6d6, 0xf3cdb0, 0xe2ad88, 0xc68a62, 0x996344, 0x6e4530],
  roupa: [null, 0xf0eee8, 0x222226, 0x24345c, 0x6e1e2a, 0x4a5a32, 0x6b4a2e, 0x7a7c80, 0xa8322c, 0x7aa6d0, 0x5a3a7a],
  calca: [null, 0x222226, 0x3c3a52, 0x5a4632, 0x2a3a5a, 0x6e1e2a, 0x7a7c80, 0x4a5a32, 0xe8e2d4],
  altura: [0.92, 1.08],
  // formato do rosto: tamanho dos olhos, do nariz e da boca (1 = original)
  rosto: { olhosT: [0.75, 1.25], narizT: [0.7, 1.3], bocaT: [0.7, 1.3] },
  // corpos que o criador do app Godot mostra (sem nome, pedido do André 2026-11-03): a Ruiva primeiro, depois os
  // masculinos e os outros corpos VRoid do jogo (os mesmos dos NPCs, todos CC0 ou com uso comercial)
  corpos: ['ruiva', 'cabelo_m', 'shibu', 'shibu_sombrio', 'fumiriya', 'shino', 'vivi', 'vita', 'victoria'],
};
// Corpo do personagem (visual) que o servidor aceita: os do jogo HTML (PERSONAGENS) e os do criador do app Godot
export function visualValido(v) {
  return typeof v === 'string' && (PERSONAGENS.some((p) => p.id === v) || CRIADOR.corpos.includes(v));
}
// Aparência mandada pelo jogador: só cores da lista e altura dentro do limite (o resto vira a cor original)
export function aparenciaValida(a) {
  if (!a || typeof a !== 'object') return null;
  const r = {};
  for (const k of ['cabelo', 'olhos', 'pele', 'roupa', 'calca']) r[k] = CRIADOR[k].includes(a[k]) ? a[k] : null;
  const [min, max] = CRIADOR.altura;
  r.altura = Number.isFinite(a.altura) ? Math.round(Math.min(max, Math.max(min, a.altura)) * 100) / 100 : 1;
  for (const [k, [lo, hi]] of Object.entries(CRIADOR.rosto)) r[k] = Number.isFinite(a[k]) ? Math.round(Math.min(hi, Math.max(lo, a[k])) * 100) / 100 : 1;
  return r;
}
export const PERSONAGEM_PADRAO = 'ruiva';
// Nome do personagem: 3 a 16 letras, números ou espaços (sem espaço sobrando). Devolve o nome limpo ou null.
export const NOME = { min: 3, max: 16 };
export function nomeValido(n) {
  if (typeof n !== 'string') return null;
  const s = n.normalize('NFC').replace(/\s+/g, ' ').trim();
  return s.length >= NOME.min && s.length <= NOME.max && /^[\p{L}\p{N} ]+$/u.test(s) ? s : null;
}

// ---------- Itens (Parte 2 do Quimera: mochila, equipamento, drops, Tomos e loja) ----------
// Raridades e números do Set de Bruxa do Quimera (wiki.html). Cada número vai de Comum até Mítico.
export const RARIDADES = [
  { nome: 'Comum', cor: 0xcfc8b8 }, { nome: 'Raro', cor: 0x5aa8ff }, { nome: 'Épico', cor: 0xb974ff },
  { nome: 'Lendário', cor: 0xffb03a }, { nome: 'Mítico', cor: 0xff5a72 },
];
// Lugares do corpo (pedido do André): Capacete (cabeca), Camisa (corpo), Calça ou Short (pernas), Botas (pes), Capa,
// Acessório e Arma (a Arma mostra a da mão: a espada ou o cajado, cada um no seu lugar). Capacete, camisa, calça,
// short, botas e capa aparecem no corpo do herói (godot-prototipo/armadura.gd).
export const LUGARES = ['cabeca', 'corpo', 'pernas', 'capa', 'pes', 'acessorio', 'espada', 'cajado'];
export const MOCHILA = 40; // lugares de UMA página da mochila: 10 x 4 (André 2026-11-03; antes 8 x 4 = 32)
// Páginas da mochila (André 2026-11-03): começa com 1 e compra as outras com ouro, uma de cada vez, até 4.
// PAGINA_PRECO[n] = ouro para liberar a página n+1 (a primeira é de graça). Compra em qualquer lugar, pelo menu.
export const MOCHILA_PAGINAS = 4;
export const PAGINA_PRECO = [0, 500, 2000, 6000];
// st: o que a peça soma no herói (vida, mana, defesa, critico, danoFisico, danoMagico), por raridade
export const ITENS = {
  // Uma linha só de armadura (serve para espada e magia). Comum é de couro; do Raro em diante, placas de aço.
  peitoral: { nome: 'Peitoral', lugar: 'corpo', st: { defesa: [4, 7, 10, 14, 20], vida: [10, 15, 22, 32, 46], mana: [4, 7, 10, 14, 20] } },
  chapeu: { nome: 'Capacete', lugar: 'cabeca', st: { defesa: [2, 3, 4, 6, 8], vida: [4, 7, 10, 14, 20] } }, // a chave antiga 'chapeu' continua: contas antigas não perdem a peça
  short: { nome: 'Short', lugar: 'pernas', st: { defesa: [1, 2, 3, 4, 6], vida: [4, 7, 10, 14, 20], mana: [4, 6, 9, 13, 18] } }, // mais leve que a calça: menos defesa, mais mana
  calca: { nome: 'Calça', lugar: 'pernas', st: { defesa: [2, 3, 4, 6, 8], vida: [6, 9, 13, 19, 27], mana: [3, 5, 7, 10, 14] } },
  capa: { nome: 'Capa', lugar: 'capa', st: { defesa: [1, 2, 2, 3, 5], mana: [7, 10, 14, 21, 30] } },
  botas: { nome: 'Botas', lugar: 'pes', st: { defesa: [2, 3, 4, 6, 8], vida: [6, 9, 13, 19, 27] } },
  colar: { nome: 'Colar de Estrela', lugar: 'acessorio', st: { vida: [15, 22, 30, 42, 60], defesa: [1, 2, 3, 4, 6] } },
  espada: { nome: 'Espada', lugar: 'espada', st: { danoFisico: [3, 5, 7, 10, 14] } },
  cajado: { nome: 'Cajado', lugar: 'cajado', st: { danoMagico: [3, 5, 7, 10, 14] } },
  pocao: { nome: 'Poção de vida', pilha: 20, usar: { vida: 0.35 }, preco: 15, venda: 5, desc: 'Recupera 35% da vida.' },
  pocao_mana: { nome: 'Poção de mana', pilha: 20, usar: { mana: 0.4 }, preco: 18, venda: 6, desc: 'Recupera 40% da mana.' },
  tomo: { nome: 'Tomo', pilha: 20, desc: 'Sobe a skill do nível anterior para o deste Tomo quando a barra de usos dela estiver cheia.' },
  // materiais (Parte 3: profissões). mat = não se usa, serve para criar coisas (RECEITAS) ou vender
  minerio_ferro: { nome: 'Minério de ferro', mat: true, pilha: 50, venda: 2, desc: 'Sai dos veios de ferro. Na forja, 3 viram uma barra.' },
  minerio_cobre: { nome: 'Minério de cobre', mat: true, pilha: 50, venda: 2, desc: 'Sai dos veios de cobre. Na forja, 3 viram uma barra.' },
  cristal: { nome: 'Cristal arcano', mat: true, pilha: 50, venda: 8, desc: 'Cristal que guarda magia. Sai dos veios de cristal (e, às vezes, dos de ferro e cobre).' },
  lenha: { nome: 'Lenha', mat: true, pilha: 50, venda: 1, desc: 'Madeira cortada das árvores. Alimenta a forja e vira cabo e cajado.' },
  barra_ferro: { nome: 'Barra de ferro', mat: true, pilha: 50, venda: 8, desc: 'Ferro fundido na forja. Vira lâmina de espada.' },
  barra_cobre: { nome: 'Barra de cobre', mat: true, pilha: 50, venda: 8, desc: 'Cobre fundido na forja. Vira joia e ponteira de cajado.' },
  pedra: { nome: 'Pedra', mat: true, pilha: 50, venda: 1, desc: 'Pedra comum que sai junto quando você minera. Serve para construir e para afiar ferramentas.' },
  carvao: { nome: 'Carvão', mat: true, pilha: 50, venda: 2, desc: 'Lenha queimada na forja. Misturado ao ferro, vira aço.' },
  barra_aco: { nome: 'Barra de aço', mat: true, pilha: 50, venda: 20, desc: 'Ferro com carvão, mais duro que o ferro. Vira armadura e lâmina melhores.' },
  couro: { nome: 'Couro', mat: true, pilha: 50, venda: 3, desc: 'Couro grosso dos Puglins. O alfaiate faz botas e reforços.' },
  tecido: { nome: 'Tecido', mat: true, pilha: 50, venda: 3, desc: 'Pano encantado que os Imps carregam. O alfaiate faz calças, shorts e capas.' },
};
export const VENDA_EQUIP = [20, 80, 250, 700, 2000]; // quanto a loja paga por raridade
export const VENDA_TOMO = 30; // x nível do Tomo
export const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
// Bônus de conjunto (Set de Bruxa): peças da mesma raridade ou melhor (a Arma conta se a espada ou o cajado for)
// 2 peças: vida e mana; 3: dano (e defesa); 6: crítico, área das skills e regeneração de mana. Vale o melhor de cada.
export const CONJUNTO = [
  null,
  { 2: { mana: 10 }, 3: { danoK: 0.05 }, 6: { critico: 0.02, regenManaK: 0.25 } },
  { 2: { vida: 20, mana: 20 }, 3: { danoK: 0.12 }, 6: { critico: 0.04, areaK: 0.15, regenManaK: 0.4 } },
  { 2: { vida: 40, mana: 35 }, 3: { danoK: 0.2, defesa: 15 }, 6: { critico: 0.06, areaK: 0.25, regenManaK: 0.55 } },
  { 2: { vida: 70, mana: 60 }, 3: { danoK: 0.3, defesa: 30 }, 6: { critico: 0.08, areaK: 0.35, regenManaK: 0.7 } },
];
// Loja da Rosa (a comerciante): poções e as peças Comum e Rara (3x o que ela paga)
export const LOJA = [
  { k: 'pocao', preco: 15 }, { k: 'pocao_mana', preco: 18 },
  ...['chapeu', 'peitoral', 'calca', 'short', 'botas', 'capa', 'colar', 'espada', 'cajado'].flatMap((k) => [{ k, r: 0, preco: 60 }, { k, r: 1, preco: 240 }]),
];
export const LOJA_DISTANCIA = 4; // metros da Rosa para comprar e vender
// Drops: cada herói que ganhou XP com o monstro tira a sua sorte (vai direto para a mochila dele).
// ouro [mín, máx]; pocao/mana/equip/tomo = chance; raridade = chance de cada raridade da peça (Comum..Mítico)
// mat: materiais para o alfaiate { item: [chance, quantos] }
const DROP_COMUM = { ouro: [3, 7], pocao: 0.12, mana: 0.1, equip: 0.1, tomo: 0.01, raridade: [0.78, 0.2, 0.02, 0, 0] };
export const DROPS = {
  puglin: { ...DROP_COMUM, mat: { couro: [0.45, 1] } }, lobo: { ...DROP_COMUM, ouro: [3, 8], mat: { couro: [0.6, 1] } }, imp: { ...DROP_COMUM, ouro: [4, 9], mat: { tecido: [0.45, 1] } }, sombrio: DROP_COMUM,
  lider: { ouro: [12, 20], pocao: 0.3, mana: 0.25, equip: 0.35, tomo: 0.08, raridade: [0.5, 0.38, 0.12, 0, 0] },
  chefe: { ouro: [35, 55], pocao: 0.5, mana: 0.4, equip: 1, tomo: 0.3, raridade: [0, 0.6, 0.35, 0.05, 0], mat: { couro: [1, 3], tecido: [1, 3], cristal: [0.5, 1] } },
  golem: { ...DROP_COMUM, ouro: [5, 10], mat: { cristal: [0.25, 1] } }, maw: { ...DROP_COMUM, ouro: [5, 11], mat: { couro: [0.6, 1] } },
  warrok: { ouro: [45, 70], pocao: 0.6, mana: 0.5, equip: 1, tomo: 0.35, raridade: [0, 0.5, 0.4, 0.1, 0], mat: { couro: [2, 3], tecido: [1, 3], cristal: [0.7, 2] } },
};

// ---------- Parte 3 do Quimera: estamina, vigor e profissões ----------
// Estamina (a barra amarela, números do Quimera): máx. = base + porNivel x nível + porDes x Destreza.
// Correr no fim do joystick (acima de "trote" da corrida) gasta por segundo (x combateK em combate); sem fôlego o herói
// só trota (trote x a corrida). No Quimera a corrida é um botão à parte; aqui é o joystick, então gasta menos. Dash, rolamento e o mortal (2º pulo) gastam de uma vez, e o gasto
// seguido (dentro de seguidaJanela s) sobe seguidaK até seguidaMax. Volta "volta" do máximo por segundo depois de
// "espera" s parado de gastar (em combate volta mais devagar e, depois de correr, espera esperaCombate s).
// Zerou: sem fôlego, só volta a correr com "folego" do máximo. combate = s depois de bater ou apanhar.
// Regeneração de vida e mana copiada do Quimera (Bh.hp / Bh.mana no laço do herói). Por segundo:
// vida = vida + vidaNivel·nível + vidaVit·Vitalidade, e só fora de combate (vidaCombate 0 = parada em luta);
// mana = (mana + manaNivel·nível + manaInt·Inteligência + Mente Arcana) × (1 + conjunto), e em luta cai para manaCombate.
// "Em combate" = bateu ou apanhou há menos de ESTAMINA.combate segundos (5 s, igual ao combatT do Quimera).
export const REGEN = { vida: 1, vidaNivel: 0.05, vidaVit: 0.25, vidaCombate: 0, mana: 1.1, manaNivel: 0.07, manaInt: 0.05, manaMente: 0.3, manaCombate: 0.35 };
export const ESTAMINA = { base: 50, porNivel: 2, porDes: 5, correr: 10, trote: 0.7, combateK: 1.5, volta: 0.17, voltaCombate: 0.55, espera: 0.9,
  esperaCombate: 8, dash: 8, rolar: 8, mortal: 6, seguidaK: 0.5, seguidaMax: 2.4, seguidaJanela: 1.3, folego: 0.2, combate: 5 };
// Vigor: energia para trabalhar (coletar e criar). Vai de 0 a max e enche sozinho em "enche" segundos (6 h), mesmo com o jogo fechado.
export const VIGOR = { max: 100, enche: 6 * 3600 };
// Profissões (as do Quimera que cabem no mapa de agora; Pescador e Fazendeiro chegam com água e horta).
// Trabalhar gasta vigor e dá pontos na profissão: Nv = raiz(pontos / 8) + 1, até 20. Rank sobe a cada 2 níveis
// (19 e 20 têm rank próprio): rank maior gasta menos vigor (-4% por rank), trabalha mais rápido (+3,5%), dá chance
// de +1 na coleta (+2%) e, na criação, chance de a peça sair numa raridade melhor.
export const PROFISSOES = {
  min: { nome: 'Minerador', grupo: 'Coleta', desc: 'Minerar veios de ferro, cobre e cristal' },
  len: { nome: 'Lenhador', grupo: 'Coleta', desc: 'Cortar lenha das árvores' },
  fer: { nome: 'Ferreiro', grupo: 'Criação', desc: 'Barras, espadas, cajados e colares na forja do Tomás' },
  alf: { nome: 'Alfaiate', grupo: 'Criação', desc: 'Calças, shorts, capas, botas e óculos na banca da Rosa' },
  mer: { nome: 'Mercador', grupo: 'Comércio', desc: 'Negociar com a Rosa: vende mais caro e compra mais barato' },
};
export const RANKS = ['Novato', 'Veterano', 'Especialista', 'Mestre', 'Autoridade', 'Campeão', 'Adepto', 'Arauto', 'Virtuoso', 'Celebridade', 'Famoso'];
export const PROF_MAX = 20;
// Mercador: no Nv 20 a Rosa paga +25% e cobra -15% (sobe aos poucos desde o Nv 1). Ganha 1 ponto a cada "pontoOuro" de ouro negociado.
export const MERCADOR = { venda: 0.25, compra: 0.15, pontoOuro: 10 };
// Veios (Minerador) e árvores (Lenhador): cada batida leva "tempo" s, gasta "vigor" e dá os itens de "da"
// (raro = chance de um item a mais). Cada veio aguenta "cargas" batidas por jogador e volta em "volta" s.
// A coleta continua sozinha enquanto houver carga e vigor; mexer o joystick, pular, bater ou apanhar para.
// Do chão saem 3 minérios brutos (cobre, ferro e, mais tarde, mitril) e o cristal; o resto é mistura na forja
// (aço = ferro + carvão). nivel = nível de Minerador para conseguir minerar.
export const COLETA = {
  ferro: { nome: 'Veio de ferro', prof: 'min', nivel: 5, vigor: 2, tempo: 2.4, cargas: 3, volta: 90, da: { minerio_ferro: 1 }, raro: { cristal: 0.05, pedra: 0.5 } },
  cobre: { nome: 'Veio de cobre', prof: 'min', vigor: 1.5, tempo: 2.2, cargas: 3, volta: 90, da: { minerio_cobre: 1 }, raro: { cristal: 0.04, pedra: 0.5 } },
  cristal: { nome: 'Veio de cristal', prof: 'min', nivel: 8, vigor: 3, tempo: 2.8, cargas: 2, volta: 150, da: { cristal: 1 }, raro: { cristal: 0.1, pedra: 0.4 } },
  arvore: { nome: 'Árvore', esgotado: 'esgotada', prof: 'len', vigor: 1, tempo: 2.0, cargas: 3, volta: 60, da: { lenha: 1 }, raro: { lenha: 0.25 } },
};
export const COLETA_DISTANCIA = 2.4; // metros da borda do veio ou do tronco
// Onde ficam os veios (fora da vila e longe do acampamento dos monstros). As árvores do mapa todas dão lenha.
// Dentro da vila não tem mais veio (pedido do André 2026-11-02): o cobre fica na zona de mineração lá fora (MINA).
// Ferro e cristal ficam para depois (COLETA continua sabendo minerá-los).
// mina = id da zona (o minério é de todos e volta no tempo da zona); sorteio fixo, igual no servidor e no Godot.
export const VEIOS = MINA.flatMap((z) => {
  let sem = 777; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const lista = [];
  for (let t = 0; lista.length < z.veios && t < 500; t++) {
    const a = rnd(0, 6.283), r = Math.sqrt(rnd(0, 1)) * (z.r - 0.9), x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r;
    if (lista.some((o) => Math.hypot(o.x - x, o.z - zz) < 2.3)) continue;
    lista.push({ tipo: z.tipo, x: +x.toFixed(2), z: +zz.toFixed(2), ry: +rnd(0, 6.28).toFixed(2), mina: z.id });
  }
  return lista;
});
export const VEIO_RAIO = 0.8; // sólido: ninguém atravessa
// Receitas (Ferreiro na forja do Tomás, Alfaiate na banca da Rosa): usa os materiais, gasta vigor e dá pontos.
// Peça de equipamento sai Comum, com chance de subir de raridade (melhor com o nível da profissão: 6% no Nv 1, 30% no Nv 20).
export const RECEITAS = {
  barra_ferro: { prof: 'fer', faz: 'barra_ferro', usa: { minerio_ferro: 3, lenha: 1 }, vigor: 1, nivel: 1 },
  carvao: { prof: 'fer', faz: 'carvao', usa: { lenha: 2 }, vigor: 1, nivel: 1 },
  barra_aco: { prof: 'fer', faz: 'barra_aco', usa: { barra_ferro: 1, carvao: 2 }, vigor: 2, nivel: 5 },
  barra_cobre: { prof: 'fer', faz: 'barra_cobre', usa: { minerio_cobre: 3, lenha: 1 }, vigor: 1, nivel: 1 },
  espada: { prof: 'fer', faz: 'espada', usa: { barra_ferro: 3, lenha: 2 }, vigor: 4, nivel: 1 },
  cajado: { prof: 'fer', faz: 'cajado', usa: { lenha: 4, barra_cobre: 1, cristal: 1 }, vigor: 4, nivel: 2 },
  colar: { prof: 'fer', faz: 'colar', usa: { barra_cobre: 2, cristal: 2 }, vigor: 4, nivel: 4 },
  botas: { prof: 'alf', faz: 'botas', usa: { couro: 4 }, vigor: 8, nivel: 1 },
  chapeu: { prof: 'fer', faz: 'chapeu', usa: { barra_ferro: 2, couro: 1, tecido: 1 }, vigor: 6, nivel: 2 }, // Capacete
  short: { prof: 'alf', faz: 'short', usa: { couro: 2, tecido: 1 }, vigor: 8, nivel: 1 },
  capa: { prof: 'alf', faz: 'capa', usa: { tecido: 4, couro: 1 }, vigor: 8, nivel: 2 },
  manto: { prof: 'alf', faz: 'manto', usa: { tecido: 5, couro: 2 }, vigor: 8, nivel: 3 },
  // peças das armaduras visíveis (camisa, calça, botas, capa, acessório): entram quando o item existir em ITENS
  calca: { prof: 'alf', faz: 'calca', usa: { couro: 3, tecido: 1 }, vigor: 8, nivel: 1 },
  peitoral: { prof: 'fer', faz: 'peitoral', usa: { barra_ferro: 4, couro: 2 }, vigor: 6, nivel: 3 },
};
// receita de item que não existe (ex.: o manto, que virou peitoral) some sozinha
for (const k of Object.keys(RECEITAS)) if (!ITENS[RECEITAS[k].faz]) delete RECEITAS[k];
// Onde cada profissão de criação trabalha: perto do NPC dessa função (metros)
export const OFICINA = { fer: { npc: 'ferreiro', onde: 'na forja do Tomás' }, alf: { npc: 'comerciante', onde: 'na banca da Rosa' } };
export const OFICINA_DISTANCIA = 4.5;
export const RARIDADE_CRIAR = { base: 0.06, max: 0.3, ate: 2 }; // chance de subir cada raridade e até qual (2 = Épico)
MAPA_CLAREIRA.veios = VEIOS;

// ---------- horta (Vila dos Lotes): sementes na loja da Rosa, o que se colhe vira item (cura um pouco ou vende) ----------
for (const [k, p] of Object.entries(PLANTAS)) {
  ITENS['semente_' + k] = { nome: 'Semente de ' + p.nome.toLowerCase(), mat: true, pilha: 50, venda: Math.max(1, Math.floor(p.semente / 2)), cor: p.cor,
    desc: `Plante na terra arada do seu lote (modo construção, aba Fazenda). Fica madura com ${p.G < 1 ? Math.round(p.G * 60) + ' min' : p.G + ' h'} de rega.` };
  ITENS[k] = { nome: p.nome, pilha: 50, usar: { vida: p.cura }, venda: p.venda, cor: p.cor, colheita: true,
    desc: `Da horta. Recupera ${Math.round(p.cura * 100)}% da vida ou vende para a Rosa.` };
  LOJA.push({ k: 'semente_' + k, preco: p.semente });
}
// Fazendeiro (o Quimera tem; chegou com a horta): arar, plantar, regar e colher dão pontos
PROFISSOES.faz = { nome: 'Fazendeiro', grupo: 'Coleta', desc: 'Arar, plantar, regar e colher na horta do seu lote' };

// Mato e pedras soltas da mata (pedido do André 2026-11-03, junto com os marcos do CENARIO): sorteio fixo em volta das
// árvores (cogumelo no pé, orelha-de-pau no tronco, arbusto e samambaia entre elas) e pedras na beira da estrada.
// O Godot desenha em MultiMesh por pedaços (godot-prototipo/cenario.gd); só as pedras maiores são sólidas.
function sortearEnfeites(arvores) {
  let sem = 9157; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const lista = [], solidos = [], r2 = (n) => +n.toFixed(2);
  const longeDoCaminho = (x, z, d) => pertoDaLinha(ESTRADA, x, z).d > d && TRILHAS.every((L) => pertoDaLinha(L, x, z).d > d - 1.5)
    && CLAREIRAS.every((c) => Math.hypot(x - c.x, z - c.z) > CLAREIRA_R + 0.5) && cenario().marcos.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + 0.5);
  for (const a of arvores) {
    const sorte = rnd(0, 1), ang = rnd(0, 6.283), sa = Math.cos(ang), ca = Math.sin(ang);
    if (sorte < 0.09) { // cogumelos no pé da árvore (um ou dois)
      for (let k = 0, n = rnd(0, 1) < 0.5 ? 1 : 2; k < n; k++) {
        const d = 0.32 * a.s + rnd(0.25, 0.6), b = ang + k * 0.5;
        lista.push({ m: 'cogumelo', x: r2(a.x + Math.cos(b) * d), z: r2(a.z + Math.sin(b) * d), ry: r2(rnd(0, 6.28)), s: r2(rnd(0.6, 1.1)) });
      }
    } else if (sorte < 0.13) { // orelha-de-pau grudada no tronco, virada para fora
      const d = 0.32 * a.s * 0.75;
      lista.push({ m: 'orelha_de_pau', x: r2(a.x + sa * d), z: r2(a.z + ca * d), y: r2(rnd(0.3, 0.9)), ry: r2(Math.atan2(sa, ca)), s: r2(rnd(0.4, 0.6)) });
    }
    const outra = rnd(0, 1), d = rnd(1.6, 2.8), x = a.x + Math.cos(ang + 2) * d, z = a.z + Math.sin(ang + 2) * d;
    if (!longeDoCaminho(x, z, 3.2)) continue;
    if (outra < 0.13) lista.push({ m: outra < 0.035 ? 'arbusto_flor' : 'arbusto', x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)), s: r2(rnd(0.6, 1.0)) });
    else if (outra < 0.21) lista.push({ m: 'samambaia', x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)), s: r2(rnd(0.5, 0.85)) });
    else if (outra < 0.26) lista.push({ m: 'planta', x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)), s: r2(rnd(0.9, 1.4)) });
    else if (outra < 0.29) {
      const s = r2(rnd(0.22, 0.5)), m = ['rocha1', 'rocha2', 'rocha3'][Math.floor(rnd(0, 2.999))];
      lista.push({ m, x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)), s });
      if (s >= 0.38) solidos.push({ x: r2(x), z: r2(z), r: r2(1.2 * s), alto: r2(1.9 * s) });
    }
  }
  // pedras na beira da estrada: uma a cada ~14 m, alternando o lado, a 4 a 5,5 m do meio (fora da terra batida)
  for (let i = 3; i < ESTRADA.length - 1; i++) {
    const [ax, az] = ESTRADA[i], [bx, bz] = ESTRADA[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    for (let t = rnd(3, 9); t < L; t += rnd(11, 17)) {
      const lado = rnd(0, 1) < 0.5 ? -1 : 1, off = rnd(4, 5.5), x = ax + ux * t - uz * off * lado, z = az + uz * t + ux * off * lado;
      if (!dentroDoMapa({ areas: MATA.areas, corredores: MATA.corredores }, x, z, 0.5) || Math.hypot(x, z) < 40) continue;
      if (TRILHAS.some((Lt) => pertoDaLinha(Lt, x, z).d < 2.5) || cenario().marcos.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 1)) continue;
      if (arvores.some((o) => Math.hypot(o.x - x, o.z - z) < 1.6)) continue;
      const s = r2(rnd(0.3, 0.6)), m = ['rocha1', 'rocha2', 'rocha3'][Math.floor(rnd(0, 2.999))];
      lista.push({ m, x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)), s });
      if (s >= 0.38) solidos.push({ x: r2(x), z: r2(z), r: r2(1.2 * s), alto: r2(1.9 * s) });
      if (rnd(0, 1) < 0.5) lista.push({ m: 'samambaia', x: r2(x + rnd(-1.2, 1.2)), z: r2(z + rnd(-1.2, 1.2)), ry: r2(rnd(0, 6.28)), s: r2(rnd(0.45, 0.7)) });
    }
  }
  return { lista, solidos };
}
// cenário da mata: peças dos marcos (ruínas, rochedos, troncos caídos...), mato solto e os sólidos de tudo (o servidor
// e o Godot colidem com eles na mesma grade das árvores da mata)
{
  const c = cenario(), e = sortearEnfeites(MAPA_CLAREIRA.mata);
  MAPA_CLAREIRA.cenario = { marcos: c.marcos, pecas: c.pecas, enfeites: e.lista, solidos: [...c.solidos, ...e.solidos] };
}
