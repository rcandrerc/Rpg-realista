// Dados do jogo. Cliente e servidor leem este mesmo arquivo:
// para criar uma habilidade, horda ou mapa novo, mexa só aqui.

import { raioNaDirecao } from './mapa.js';

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
};

// Pedaços de animação: [arquivo, início, fim] em fração da duração. O combo de espada do Mixamo
// (One Hand Sword Combo) vira 4 golpes; pulo, mortal e pouso perdem o agachamento do começo.
export const CORTES = {
  combo1: ['espada_combo', 0.12, 0.32], combo2: ['espada_combo', 0.32, 0.53], combo3: ['espada_combo', 0.53, 0.74], combo4: ['espada_combo', 0.74, 0.93],
  // golpe básico de magia (3 disparos), a investida e o arremesso triplo
  magia1: ['mx_one_handed_casting_spell_sweep_right_to', 0.05, 0.55], magia2: ['mx_one_handed_casting_spell_fowards', 0.12, 0.55],
  magia3: ['mx_casting_a_spell_with_one_hand', 0.32, 0.6], investida: ['mx_thrust_and_slash_with_blade', 0.15, 0.6],
  arremesso: ['mx_conjuring_magic_and_throwing', 0.45, 0.92],
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
export const SUBIDA = { degrau: 0.45, mini: 1.95, empurrar: 0.18, maoAcima: 1.53, topo: 1.6 }; // m: sobe andando; mini escalada até; tempo empurrando; altura das mãos acima do corpo; topo: beirada no máximo isso acima do corpo para subir no topo (a animação sobe 1,29 m)

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
  puglin: { nome: 'Puglin', horda: 'Monstros do Leste', visual: 'bst:Puglin', vida: 80, dano: 8, intervalo: 2.2, escala: 1, brilho: 0x8a3dff },
  imp: { nome: 'Imp', horda: 'Monstros do Leste', visual: 'bst:Imp', vida: 110, dano: 11, intervalo: 2.4, escala: 1, brilho: 0xff6a2a },
  chefe: { nome: 'Imp Chefe', horda: 'Monstros do Leste', visual: 'bst:Imp', vida: 220, dano: 16, intervalo: 1.9, escala: 1.15, brilho: 0xff2a3a },
};

// Combate dos monstros (André 2026-11-02, "combate amador"): o monstro avisa antes de bater (preparo, em s, com a
// animação bem devagar e um brilho vermelho), no máximo `aoMesmoTempo` batem no mesmo herói (os outros rodeiam a
// `roda` m), aguenta `firmeGolpes` golpes seguidos e fica firme (não para de apanhar, revida) por `firmeDur` s.
// Rolar ou dar dash na hora do golpe = esquiva: o próximo golpe do herói em `contraDur` s vale `contraK`x e é crítico.
export const COMBATE_INIMIGO = {
  preparo: { puglin: 0.5, imp: 0.55, chefe: 0.7 }, preparoTs: 0.3, golpeTs: 1.1, acerto: 0.45,
  aoMesmoTempo: 2, roda: 3.4, rodaVel: 1.1,
  firmeGolpes: { puglin: 6, imp: 6, chefe: 4 }, firmeJanela: 1.6, firmeDur: 2.0,
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
// caminhos de terra (linhas de pontos, largura em metros)
const CAMINHOS = [
  { largura: 2.4, pontos: [[0, 1], [-1.5, -4], [-4, -8.5], [PRACA.x, PRACA.z]] },
  { largura: 2, pontos: [[PRACA.x, PRACA.z], [9, -8], [17, -2]] }, // para o leste: a saída da vila
  // a estradinha do leste continua: sai da vila pela passagem nas pedras e chega no campo de caça
  { largura: 2.2, pontos: [[17, -2], [21, -2.2], [24.7, -3.1], [28, -3.9], [31.5, -3.5], [38, -3.4], [45, -3.2], [52, -2], [58, -0.6]] },
  // trilha estreita até o veio de cobre
  { largura: 1.5, pontos: [[44, -3.4], [45, -7.5], [46, -11.5]] },
  // a estradinha some aos poucos na grama do campo de caça (forca = quanto de terra: degradê de ~1 m, não borda reta)
  { largura: 1.6, forca: 0.55, pontos: [[57, -0.8], [60.5, 0.2]] },
  { largura: 1.1, forca: 0.3, pontos: [[60, 0], [63, 0.9]] },
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
  const estrada = [[24.7, -3.1], [28, -3.9], [31.5, -3.5], [38, -3.4], [45, -3.2], [52, -2], [58, -0.6], [64, 1]];
  const naEstrada = (x, z) => estrada.slice(1).some(([bx, bz], i) => { // a menos de 4,5 m da estradinha (a câmera passa sem entrar em tronco)
    const [ax, az] = estrada[i], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - ax - vx * t, z - az - vz * t) < 4.5;
  });
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
// tipos: um por vaga (a vaga 0 é sempre Puglin...), para o Godot ter um modelo fixo por vaga.
export const CACA = [
  { id: 'caca1', nome: 'Campo de caça', x: 70, z: 2, r: 13, n: 10, tipos: ['puglin', 'puglin', 'imp', 'puglin', 'imp', 'puglin', 'puglin', 'imp', 'puglin', 'imp'],
    passo: 0.35, rapido: 0.3, normal: 1.5, longe: 6, corpo: 2.2, ate: 0.85 },
];
// Veio de cobre (zona de mineração do Quimera, só que pequena e com pouco minério, pedido do André 2026-11-02):
// "veios" pedras no círculo de raio r. O minério é de todos: quando alguém esgota uma pedra, ela some para todo mundo
// e volta em "volta" s (no Quimera a pedra minerada volta em 6 min).
export const MINA = [
  { id: 'cobre1', nome: 'Veio de cobre', tipo: 'cobre', x: 46, z: -15, r: 4.5, veios: 6, volta: 360 },
];
// NPC de resetar a build (o Mestre Ivo do Quimera): devolve os pontos de atributo; as skills ficam (sobem usando).
// Preço do Quimera: max(500, 50 x nível); aqui o ouro é mais curto, então max(minimo, porNivel x nível).
export const RESET_BUILD = { minimo: 50, porNivel: 10 };

export const MAPA_CLAREIRA = {
  id: 'clareira',
  nome: 'Vila da Clareira',
  raio: 34,
  nascimento: { x: 0, z: 1 },
  // onde dá para andar: a vila (raio 34), a passagem da estradinha do leste e a clareira de fora (shared/mapa.js)
  areas: [{ x: 0, z: 0, r: 34 }, FORA],
  corredores: [{ a: [27, -2.7], b: [44, -3.4], larg: 9 }],
  // máscara do chão (trilhas e praça) cobre a vila e a área de fora: x0, z0 e o tamanho do quadrado em metros
  mascara: { x0: -38, z0: -62, tam: 142, px: 1024 },
  // inimigos parados num lugar (renascem no mesmo lugar). Dentro da vila não tem mais nenhum (pedido do André
  // 2026-11-02): os monstros ficam no campo de caça lá fora (CACA)
  inimigos: [],
  caca: CACA,
  mina: MINA,
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
};
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
// Lugares do corpo: os 6 do menu (a Arma mostra a da mão: a espada ou o cajado, cada um no seu lugar)
export const LUGARES = ['cabeca', 'corpo', 'capa', 'pes', 'acessorio', 'espada', 'cajado'];
export const MOCHILA = 32; // 8 x 4, como uma página da mochila do Quimera
// st: o que a peça soma no herói (vida, mana, defesa, critico, danoFisico, danoMagico), por raridade
export const ITENS = {
  chapeu: { nome: 'Chapéu', lugar: 'cabeca', st: { defesa: [2, 3, 4, 6, 8], vida: [4, 7, 10, 14, 20] } },
  manto: { nome: 'Manto', lugar: 'corpo', st: { defesa: [3, 5, 7, 10, 15], vida: [10, 15, 22, 32, 46], mana: [4, 7, 10, 14, 20] } },
  capa: { nome: 'Capa', lugar: 'capa', st: { defesa: [1, 2, 2, 3, 5], mana: [7, 10, 14, 21, 30] } },
  botas: { nome: 'Botas', lugar: 'pes', st: { defesa: [1, 2, 2, 3, 5], vida: [6, 8, 12, 18, 25] } },
  oculos: { nome: 'Óculos', lugar: 'acessorio', st: { mana: [4, 8, 12, 18, 25], critico: [0.008, 0.011, 0.015, 0.021, 0.026], vida: [0, 0, 6, 11, 17] } },
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
  tecido: { nome: 'Tecido', mat: true, pilha: 50, venda: 3, desc: 'Pano encantado que os Imps carregam. O alfaiate faz chapéus, capas e mantos.' },
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
  ...['chapeu', 'manto', 'capa', 'botas', 'oculos', 'colar', 'espada', 'cajado'].flatMap((k) => [{ k, r: 0, preco: 60 }, { k, r: 1, preco: 240 }]),
];
export const LOJA_DISTANCIA = 4; // metros da Rosa para comprar e vender
// Drops: cada herói que ganhou XP com o monstro tira a sua sorte (vai direto para a mochila dele).
// ouro [mín, máx]; pocao/mana/equip/tomo = chance; raridade = chance de cada raridade da peça (Comum..Mítico)
// mat: materiais para o alfaiate { item: [chance, quantos] }
const DROP_COMUM = { ouro: [3, 7], pocao: 0.12, mana: 0.1, equip: 0.1, tomo: 0.01, raridade: [0.78, 0.2, 0.02, 0, 0] };
export const DROPS = {
  puglin: { ...DROP_COMUM, mat: { couro: [0.45, 1] } }, imp: { ...DROP_COMUM, ouro: [4, 9], mat: { tecido: [0.45, 1] } }, sombrio: DROP_COMUM,
  lider: { ouro: [12, 20], pocao: 0.3, mana: 0.25, equip: 0.35, tomo: 0.08, raridade: [0.5, 0.38, 0.12, 0, 0] },
  chefe: { ouro: [35, 55], pocao: 0.5, mana: 0.4, equip: 1, tomo: 0.3, raridade: [0, 0.6, 0.35, 0.05, 0], mat: { couro: [1, 3], tecido: [1, 3], cristal: [0.5, 1] } },
};

// ---------- Parte 3 do Quimera: estamina, vigor e profissões ----------
// Estamina (a barra amarela, números do Quimera): máx. = base + porNivel x nível + porDes x Destreza.
// Correr no fim do joystick (acima de "trote" da corrida) gasta por segundo (x combateK em combate); sem fôlego o herói
// só trota (trote x a corrida). No Quimera a corrida é um botão à parte; aqui é o joystick, então gasta menos. Dash, rolamento e o mortal (2º pulo) gastam de uma vez, e o gasto
// seguido (dentro de seguidaJanela s) sobe seguidaK até seguidaMax. Volta "volta" do máximo por segundo depois de
// "espera" s parado de gastar (em combate volta mais devagar e, depois de correr, espera esperaCombate s).
// Zerou: sem fôlego, só volta a correr com "folego" do máximo. combate = s depois de bater ou apanhar.
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
  alf: { nome: 'Alfaiate', grupo: 'Criação', desc: 'Chapéus, mantos, capas, botas e óculos na banca da Rosa' },
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
  chapeu: { prof: 'alf', faz: 'chapeu', usa: { tecido: 3, couro: 1 }, vigor: 8, nivel: 1 },
  capa: { prof: 'alf', faz: 'capa', usa: { tecido: 4, couro: 1 }, vigor: 8, nivel: 2 },
  manto: { prof: 'alf', faz: 'manto', usa: { tecido: 5, couro: 2 }, vigor: 8, nivel: 3 },
  oculos: { prof: 'alf', faz: 'oculos', usa: { barra_cobre: 1, cristal: 1, couro: 1 }, vigor: 8, nivel: 5 },
  // peças das armaduras visíveis (camisa, calça, botas, capa, acessório): entram quando o item existir em ITENS
  calca: { prof: 'alf', faz: 'calca', usa: { couro: 3, tecido: 1 }, vigor: 8, nivel: 1 },
  peitoral: { prof: 'fer', faz: 'peitoral', usa: { barra_ferro: 4, couro: 2 }, vigor: 6, nivel: 3 },
};
// receita de item que não existe (ex.: o chapéu, que virou calça) some sozinha
for (const k of Object.keys(RECEITAS)) if (!ITENS[RECEITAS[k].faz]) delete RECEITAS[k];
// Onde cada profissão de criação trabalha: perto do NPC dessa função (metros)
export const OFICINA = { fer: { npc: 'ferreiro', onde: 'na forja do Tomás' }, alf: { npc: 'comerciante', onde: 'na banca da Rosa' } };
export const OFICINA_DISTANCIA = 4.5;
export const RARIDADE_CRIAR = { base: 0.06, max: 0.3, ate: 2 }; // chance de subir cada raridade e até qual (2 = Épico)
MAPA_CLAREIRA.veios = VEIOS;
