// Dados do jogo. Cliente e servidor leem este mesmo arquivo:
// para criar uma habilidade, horda ou mapa novo, mexa só aqui.

import { raioNaDirecao, dentroDoMapa } from './mapa.js';
import { alturaMontanha, pertoDaAgua, beiraDosLagos, LAGOS, AGUA, MONTANHA, INGREME, usarMundo, gradeDoMundo } from './relevo.js';
import { montarMundo, alturaMundo, terraEm, LUGARES_MUNDO, ESTRADAS_MUNDO, RIOS_MUNDO, PONTES_MUNDO, defsDasCavernas, CAVERNA_MUNDO_FORMA } from './mundo.js';
import { CAVERNA, TUNEL, noTunel, noTuneis, pontoDoTunel, montarCaverna, registrarTunel } from './caverna.js';
export { LAGOS, AGUA, MONTANHA, INGREME, CAVERNA, TUNEL };

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
  // Mixamo Pro Magic Pack, Standing Idle 03 (André 2026-11-04): guarda do cajado, joelhos dobrados e a mão livre na frente
  cajado_parada: 11.167,
  // magias novas do cajado: Kevin Iglesias Magic Attack Direct 1H (direita/esquerda) e Mixamo Standing 2H Magic Attack 01,
  // 2H Magic Area Attack 01 e 2H Cast Spell 01
  mg_basico_d: 1.2, mg_basico_e: 1.2, mg_bola: 2.667, mg_gelo: 2.967, mg_meteoro: 2.167,
  // nado nos lagos fundos (André 2026-11-06): Mixamo Swimming, Treading Water e Swimming To Edge
  nadar: 4.533, boiar: 3, sair_agua: 5,
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
  // saindo do lago fundo: do nado até ficar de pé (o resto do Swimming To Edge segura numa borda de piscina)
  saiAgua: ['sair_agua', 0.34, 0.58],
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
export const SUBIDA = { degrau: 0.45, mini: 1.95, empurrar: 0.18, maoAcima: 1.53, topo: 1.6, parede: 0.32, tampoMin: 0.4, tampoMax: 1.95 }; // m: sobe andando; mini escalada até; tampoMin/tampoMax: obstáculo baixo (mesa, bancada, baú, tronco caído) com o alto entre esses dois tem tampo: pulando, o herói pousa em cima (André 2026-11-05); mini escalada até; tempo empurrando; altura das mãos acima do corpo; topo: beirada no máximo isso acima do corpo para subir no topo (a animação sobe 1,29 m); parede: distância do quadril até a parede agarrado (mãos e pés encostam)

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
  preparo: { puglin: 0.4, imp: 0.4, chefe: 0.4, lobo: 0.4, golem: 0.4, maw: 0.4, warrok: 0.4 }, preparoTs: 0.3, golpeTs: 1.1, acerto: 0.45,
  aoMesmoTempo: 99, roda: 2.9, rodaVel: 1.6, perseguir: 3.6, chegar: 2.2, chegarDist: 2.6, folga: 0, cdMin: 1.05, cdMax: 1.5,
  // (2026-11-06: aqui tinha sobrado um 'aoMesmoTempo: 2' de um merge antigo que valia por cima do 99 e deixava só 2 baterem
  // juntos; André achou fácil demais tancar 7 ou 8. Saiu para voltar a regra do Quimera que ele pediu.)
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
//    e, passando xpAlemDe níveis acima, cada nível a mais multiplica o XP por xpAlem (André 2026-11-09: sem limite de
//    nível, o castigo de XP só aumenta quanto mais acima do bicho)
//  - nome do monstro: cinza (fácil) com corFacil níveis ou menos, vermelho (perigo) com corForte ou mais, verde no meio
// folga, perde e min eram a regra de XP de antes (sem uso desde 2026-11-04, ficam por causa da regra "Nada some").
// Ajuste fino depois do teste (André 2026-11-06: "volta a regra do Quimera, testo, se achar fácil ainda modificamos"):
// forca = o dano de base dos monstros vezes isto; resistencia = a vida de base vezes isto; defesaBase + defesaNivel x nível do monstro = o quanto de defesa o herói
// precisa para segurar metade do golpe (reducaoContra em shared/progresso.js). Com forca 1 e defesaNivel 0 fica igual a
// antes (regra do Quimera). André testou a 1515 e achou fácil: ligado forca 1.5, resistencia 1.6 e defesaNivel 6
// (simulador: Nv5 com Rara aguenta 3 a 5 Puglins Nv5, com 10 morre; 10 níveis acima, mata 10 fácil).
// André 2026-11-07 ("mexe no dano dos bichos, pode aumentar mais; a defesa do equipamento igual ao Quimera"): a defesa
// segue a conta do Quimera (Gl: def / (def + 10 + 3 x nível do monstro), sem teto), o dano cresce 0.32 por nível como
// no Quimera (era 0.18) e forca 1.8 (era 1.5). Simulador: Nv5 com Rara aguenta 3 Puglins Nv5, com 5 morre.
export const NIVEL_INIMIGO = { forca: 1.8, resistencia: 1.6, defesaBase: 10, defesaNivel: 3, defesaMax: 1, vida: 0.16, dano: 0.32, xp: 0.5, ouro: 0.15, folga: 5, perde: 0.15, min: 0.1,
  danoAcima: 0.06, danoAbaixo: 0.05, danoAbaixoMin: 0.55, teto: 0.3, tetoChefe: 0.45,
  golpeFolga: 3, golpeCai: 0.06, golpeMin: 0.6, golpeSobe: 0.04, golpeMax: 1.4,
  xpSobe: 0.15, xpMax: 1.6, xpCai: 0.2, xpMin: 0.15, xpAlemDe: 7, xpAlem: 0.9, corFacil: -3, corForte: 2 };
export const statusInimigo = (tipo, nivel = 1) => {
  const t = TIPOS_INIMIGO[tipo], k = Math.max(0, (nivel || 1) - 1);
  return { vida: Math.round(t.vida * (NIVEL_INIMIGO.resistencia ?? 1) * (1 + NIVEL_INIMIGO.vida * k)), dano: Math.round(t.dano * (NIVEL_INIMIGO.forca ?? 1) * (1 + NIVEL_INIMIGO.dano * k)) };
};
// A mata andável: círculos de borda ondulada ao longo da estrada e em volta de cada clareira, ligados por corredores
// (a saída do campo de fora pelo sul e as trilhas). Sem anel de pedra (direção de arte: borda de mata fechada).
// círculos de mata aberta que ligam vila, campo de fora, Terras da Estrada e a mata (x, z, raio)
const LIGACOES = [
  [-44, -12, 16], [-40, 18, 16], [-22, -42, 16], [8, -46, 16], [32, -34, 15], // volta da vila (oeste e norte)
  [52, -36, 14], [78, -36, 15], [100, -20, 14], [104, 8, 14], // volta do campo de fora (norte e leste)
  [28, 25, 14], [18, 45, 15], [16, 72, 15], [8, 98, 16], // entre a vila, o campo de fora, as Terras e a mata
  [-18, 106, 15], [-40, 100, 15], [-46, 75, 16], [-44, 45, 15], // volta das Terras da Estrada
  [-28, 36, 12], [-36, -30, 12], [38, -16, 10], // buracos que ainda deixavam pedaço de borda na vila
  [48, 22, 12], [70, 26, 13], [90, 20, 12], // sul do campo de fora (encosta na mata da estrada)
  [38, 7, 7], [0, 40, 7], [88, -25, 7], // fecham as últimas falhas do anel de pedras (vila leste e norte, FORA oeste e sudeste)
];
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
  // Mapa aberto (André 2026-11-04: "não quero essas ilhas... o mapa tem que ser uma coisa só, fluida e aberta"): mata
  // andável em volta da vila, do campo de fora e das Terras da Estrada, encostando nelas e na mata da estrada. Assim
  // não sobra borda de ilha: sai-se da vila andando para dentro da mata aberta, e o limite do mapa fica lá no fundo,
  // na mata fechada. Vêm depois das outras áreas (as de antes não mudam de índice).
  for (const [x, z, r] of LIGACOES) {
    const n = areas.length;
    areas.push({ x, z, rx: r, rz: r, mata: true, ligacao: true, lobos: [[3, 0.07, n * 1.7], [5, 0.05, n * 0.9]] });
  }
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
  // torre de vigia caída: quatro pilares de alturas diferentes, paredes afundadas e tortas, uma tombada no chão.
  // 2026-11-04 (direção de arte, André aprovou): 1,45x maior e com um pedaço de pilar e de parede por cima, para o canto
  // mais alto passar das copas (~6 m) e o marco aparecer de longe; mais hera.
  ruina: { r: 4.6, esc: 1.45, pecas: [
    ['pilar', -2, -2, 1.2, 0.3, 1, 0.04, 0], ['parede', -1.3, -2, 0.9, 0, 1, 0, -0.12],
    ['hera1', -2.15, -1.8, 4.0, 0.3, 1], ['hera1', 1, -1.78, 1.35, 0, 0.8], ['hera4', -2.2, 1.0, 0.95, 1.57, 1], ['hera4', -1.6, -2.2, 3.7, 3.14, 1],
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
  // portal em ruínas: um arco de janela de pé entre dois pilares, a escada afundada na frente e a parede vizinha caída.
  // 2026-11-04: 1,7x maior (o arco fica com ~5 m e passa das copas de perto) e hera nos pilares.
  arco: { r: 3.6, esc: 1.7, pecas: [
    ['hera4', -1.15, 0.25, 2.55, 0, 1], ['hera1', 1.15, 0.25, 2.0, 0, 0.8], ['hera4', 2.25, 0.42, 1.0, 0, 0.9],
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
  // árvore morta gigante: marca de longe (sem folha), pedras na raiz. 2026-11-04: ~16 m (o dobro das árvores vivas)
  // e o tronco cinza-claro (ferramentas/cenario/preparar.mjs pinta a casca)
  arvore_morta: { r: 3.4, pecas: [
    ['arvore_morta3', 0, 0, 0, 0, 1.25], ['rocha2', 1.8, 1.1, 0, 0.7, 0.5], ['rocha1', -1.7, -1.4, 0, 2.3, 0.35],
    ['cogumelo', 0.9, -1.0, 0, 0.3, 0.8], ['orelha_de_pau', -0.55, 0.35, 0.7, 2.6, 0.5], ['samambaia', -1.8, 1.6, 0, 0.4, 0.7],
  ] },
  // acampamento abandonado: fogueira de pedra, tocos de banco, um tronco e a carroça largada torta
  acampamento: { r: 4.4, pecas: [
    ['fogueira', 0, 0, 0.05, 0, 1], ['toco2', 1.7, 0.4, 0, 0.5, 0.8], ['toco2', -1.2, 1.4, 0, 2.1, 0.75], ['tronco_caido', 0, -1.9, 0.02, 0.15, 0.9],
    ['carroca', 3.0, -1.6, 0.0, 0.6, 1, 0, 0.12], ['arbusto', -2.8, -1.5, 0, 0.4, 0.9], ['cogumelo', -2.0, 2.2, 0, 1.2, 0.8],
  ] },
};
// esc: o conjunto inteiro cresce (posições e peças de pedra); planta, cogumelo, arbusto e samambaia mudam só de lugar
const NAO_CRESCE = new Set(['cogumelo', 'samambaia', 'arbusto', 'arbusto_flor', 'planta', 'orelha_de_pau']);
for (const C of Object.values(CONJUNTOS)) {
  if (!C.esc) continue;
  C.r = +(C.r * C.esc).toFixed(2);
  C.pecas = C.pecas.map(([m, dx, dz, dy, ry, s, rx = 0, rz = 0]) => [m, dx * C.esc, dz * C.esc, dy * C.esc, ry, NAO_CRESCE.has(m) ? s : s * C.esc, rx, rz]);
}
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
    if (naTerras(x, z, 1.5)) continue; // as Terras da Estrada são chão de construir (a mata aberta só encosta nelas)
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
  const andavel = { areas: [{ x: 0, z: 0, r: 34 }, FORA, ...MATA.areas, T], corredores: [...MATA.corredores, P, LAGO_GRANDE_PASSAGEM] }; // 2026-11-06: + a passagem do Lago Grande
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
// (x, z) cai nas Terras da Estrada, na passagem delas ou na estrada de terra até lá (com "folga" metros a mais)?
function naTerras(x, z, folga = 0) {
  const T = VILA_LOTES.area, P = VILA_LOTES.passagem;
  return dentroDoMapa({ areas: [T], corredores: [P] }, x, z, -folga) || pertoDaLinha(VILA_LOTES.estrada, x, z).d < 2.5 + folga;
}
// Veio de cobre (zona de mineração do Quimera, só que pequena e com pouco minério, pedido do André 2026-11-02):
// "veios" pedras no círculo de raio r. O minério é de todos: quando alguém esgota uma pedra, ela some para todo mundo
// e volta em "volta" s (no Quimera a pedra minerada volta em 6 min).
// 2026-11-05 (André: "faz um de pedra maior que o de cobre e um de ferro menor, espaçados no mapa"): veio de pedra ao
// norte da vila (Minerador Nv 1, pedras grandes) e veio de ferro a leste, perto dos lobos Nv 5 (Minerador Nv 5, pedras
// menores e mais raras). Cada zona abre uma clareirinha na mata (sem árvore, mato nem pedra solta em r + 2,5 m).
export const MINA = [
  { id: 'cobre1', nome: 'Veio de cobre', tipo: 'cobre', x: 46, z: -15, r: 4.5, veios: 6, volta: 360 },
  { id: 'pedra1', nome: 'Veio de pedra', tipo: 'pedra', x: 8, z: -48, r: 6.5, veios: 7, volta: 240 },
  { id: 'ferro1', nome: 'Veio de ferro', tipo: 'ferro', x: 104, z: 8, r: 4, veios: 5, volta: 420 },
  // FASE 2 (André 2026-11-08: "pequenos spots de minério bem diluídos e espalhados por todo o mapa... já preveja o
  // cristal"): veios pequenos (3 pedras) em chão plano, longe de árvore, estrada e campo de caça, para ter pedra e cobre
  // perto de qualquer canto, ferro do meio para a frente e cristal (Minerador Nv 8) perto dos campos mais altos.
  // Ficam fora de naMina (abaixo): os lugares já não têm árvore, então o sorteio da mata não muda nada.
  ...[['pedra2', 'pedra', -48, -2], ['pedra3', 'pedra', 72, 30], ['pedra4', 'pedra', -28, 212], ['pedra5', 'pedra', 186, 150],
    ['pedra6', 'pedra', 88, -30], ['cobre2', 'cobre', 34, 24], ['cobre3', 'cobre', 82, 80], ['cobre4', 'cobre', 142, 162],
    ['cobre5', 'cobre', -26, -40], ['ferro2', 'ferro', 130, 40], ['ferro3', 'ferro', 0, 138], ['ferro4', 'ferro', 190, 108],
    ['cristal1', 'cristal', 168, 84], ['cristal2', 'cristal', 96, 156], ['cristal3', 'cristal', 174, 172],
    ['pedra7', 'pedra', 170, 50], ['cobre6', 'cobre', 140, 90], ['pedra8', 'pedra', 120, 72], ['pedra9', 'pedra', 30, 190], ['cobre7', 'cobre', 62, 114]].map(([id, tipo, x, z]) => ({
    id, nome: { pedra: 'Veio de pedra', cobre: 'Veio de cobre', ferro: 'Veio de ferro', cristal: 'Veio de cristal' }[tipo], tipo, x, z,
    r: { pedra: 4.2, cobre: 3.4, ferro: 2.8, cristal: 3.4 }[tipo], veios: 3, volta: { pedra: 240, cobre: 360, ferro: 420, cristal: 480 }[tipo], pequeno: true })),
];
// tamanho de cada pedra de veio (1 = a de cobre): a de pedra é maior, a de ferro menor. Vale para o desenho no Godot e
// para o raio sólido (VEIO_RAIO x tamanho).
export const TAMANHO_VEIO = { pedra: 1.4, cobre: 1, ferro: 0.8, cristal: 1 };
// Emendas do mapa andável (André 2026-11-05: "o jogador não consegue chegar no veio de pedra"): a vila (raio 34) e a
// mata ao norte se encostam por pouco, e com a folga de 2,2 m da borda (andar.gd limitar_ao_mapa) virava uma parede
// invisível em z ~ -32. Este círculo fica todo dentro do que já era andável e só emenda as duas áreas.
// Vêm por último na lista de áreas (as de antes não mudam de índice nem de sorteio).
const EMENDAS = [{ x: 6, z: -36, r: 12, rx: 12, rz: 12, mata: true, ligacao: true },
  // 2026-11-05: as Terras maiores deixavam dois furinhos fora do mapa entre elas e a mata (teste relevo.mjs)
  { x: -32.5, z: 53.5, r: 2.5, rx: 2.5, rz: 2.5, mata: true, ligacao: true }, { x: -35.5, z: 113.5, r: 2.5, rx: 2.5, rz: 2.5, mata: true, ligacao: true }]; // rx/rz: a grama da mata (main.gd grama_da_mata) lê rx
// Trilhas de terra até os veios novos (André 2026-11-05: "tem que liberar o caminho"): a de pedra sai da estradinha do
// leste, sobe pelo norte da vila entre as árvores e entra na mata; a de ferro sai da estrada principal e cruza o campo de
// fora para o leste. Entram nos caminhos (chão de terra, minimapa e o "Ir para" do mapa, rota.gd).
const TRILHAS_MINA = [
  { largura: 1.5, pontos: [[18, -1.9], [18.6, -9], [17.2, -15.5], [16.25, -19.3], [15.8, -22.5], [11, -28], [9, -40]] }, // pedra1
  { largura: 1.5, pontos: [[61.6, 17.8], [68, 14], [79, 10], [88.5, 3], [94, 0.3], [99.5, 5]] }, // ferro1
];
// Trilha da caverna (André 2026-11-06: "coloca um caminhozinho"): continua a trilha do veio de ferro para o leste, passa
// ao sul do Lago da Montanha e sobe a encosta até a boca da caverna (shared/caverna.js), onde fica o guardião.
const TRILHA_CAVERNA = { largura: 1.6, pontos: [[99.5, 5], [108, 2.8], [117, 1.6], [126.5, 1.2], [134.5, -3.5], [139.2, -11.5], [141.6, -18.5], [143.6, -23.2], [146, -25]] };
// Lago Grande: o campo em volta, a passagem desde o sul das Terras e a trilha (o resto fica junto de sortearMataLago)
const LAGO_GRANDE_AREA = { x: -3, z: 196, rx: 43, rz: 34, lobos: [[3, 0.06, 0.7], [5, 0.04, 2.3]], mata: true, lagoGrande: true };
const LAGO_GRANDE_PASSAGEM = { a: [-16, 128], b: [-8, 170], larg: 9, semPedras: true };
const TRILHA_LAGO = { largura: 1.8, pontos: [[-16, 132], [-15.2, 141], [-13, 150], [-10.4, 159], [-8.2, 166], [-6.6, 172], [-6.1, 175.2]] };
// Guardião da caverna: do lado esquerdo da boca, olhando para quem chega pela trilha
const GUARDA_CAVERNA = { x: 147.4, z: -23.6, ry: -1.6 };
// (x, z) dentro de uma zona de mineração da mata ou em cima da trilha dela (com folga): ali não nasce árvore, mato nem
// pedra solta
const naMina = (x, z, folga = 2.5) => MINA.some((m) => m.id !== 'cobre1' && !m.pequeno && Math.hypot(x - m.x, z - m.z) < m.r + folga)
  || TRILHAS_MINA.some((t) => pertoDaLinha(t.pontos, x, z).d < 2);
// em cima da trilha do Lago Grande (árvore da mata de antes que caía ali sai)
const naTrilhaLago = (x, z) => pertoDaLinha(TRILHA_LAGO.pontos, x, z).d < 2.4;
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
  // 2026-11-05 (André: "abrir mais essa área, com 6 jogadores já encheu"): quase o dobro, esticada para o sul (onde só
  // tinha mata). Antes: x -16, z 68,5, rx 22, rz 27. A oeste fica a beira da máscara do chão (x -38); a leste, o lago e
  // a clareira dos Imps. Os lotes antigos (LOTES_ANTIGOS) continuam dentro.
  area: { x: -13.5, z: 88, rx: 24.5, rz: 48, lobos: [[3, 0.025, 1.3], [5, 0.02, 0.4]], lotes: true, semPedras: true },
  passagem: { a: [-10, 28], b: [-15, 47], larg: 9, semPedras: true },
  // estrada de terra que sai de onde o herói nasce, passa pela passagem e vira a estrada central das terras
  estrada: [[0, 1], [-1, 10], [-2, 15], [-6.5, 21], [-10, 28], [-12.5, 35], [-14.5, 42], [-16, 48]],
  ruas: [
    { largura: 2.8, pontos: [[-16, 48], [-16, 58], [-16, 70], [-16, 92], [-16, 112], [-16, 132]] }, // estrada central (norte-sul; 2026-11-05 vai até o sul das Terras maiores)
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
// ladoMin / ladoMax: lados do terreno em metros (mínimo 6 x 6 desde 2026-11-05, André: "tem que ter um mínimo"; era 3) · areaMax: blocos no máximo · uma pessoa tem um terreno só
// folgaRua: metros livres entre o terreno e a beira da estrada · folgaBorda: metros até a borda das árvores
// alcance: até quantos metros fora do terreno o herói pode estar para construir (a câmera flutua, como no Quimera)
// pecasPorBloco: peças que cabem (mínimo pecasMin, máximo maxPecas) · estacaoDist: perto da estação para criar
// preco e placaDist eram do lote pronto de 10 x 10 (sem uso desde 2026-11-04, ficam por causa da regra "Nada some")
// 2026-11-05 (André): vender de volta para o jogo por menos (venda = fração do preço por bloco: "comprar um pouco mais
// caro, vender um pouco mais barato, para a pessoa perder dinheiro"), mudar o tamanho (aumentar paga os blocos novos;
// diminuir devolve a mesma fração), taxa semanal que chega no correio (taxaBloco de ouro por bloco a cada taxaDias dias;
// com taxaTrava contas sem pagar, não constrói nem planta) e a regra para não ficar bagunçado: entre dois terrenos ou
// encosta ou deixa pelo menos 'fresta' m (um caminho); ao marcar, a borda gruda (ímã) na estrada e no vizinho a até 'ima' m.
export const LOTE = { preco: 400, placaDist: 3, precoBloco: 4, ladoMin: 6, ladoMax: 20, areaMax: 300, folgaRua: 0.6, folgaBorda: 1.5,
  alcance: 6, pecasPorBloco: 0.4, pecasMin: 12, maxPecas: 120, estacaoDist: 3,
  venda: 0.5, taxaBloco: 1, taxaDias: 7, taxaTrava: 2, fresta: 3, ima: 1.5 };
export const vendaTerreno = (w, d) => Math.floor(Math.max(0, Math.round(w) * Math.round(d)) * LOTE.precoBloco * LOTE.venda);
// conta do correio: semanas fechadas desde 'taxa' (ms do começo da conta em aberto), valor e quando chega a próxima
export function contaTerreno(def, taxa, agora) {
  const sem = LOTE.taxaDias * 86400000, ini = Number(taxa) || agora, n = Math.max(0, Math.floor((agora - ini) / sem));
  const blocos = Math.round(def.x1 - def.x0) * Math.round(def.z1 - def.z0);
  return { semanas: n, valor: n * blocos * LOTE.taxaBloco, porSemana: blocos * LOTE.taxaBloco, proxima: ini + (n + 1) * sem };
}
export const precoTerreno = (w, d) => Math.max(0, Math.round(w) * Math.round(d)) * LOTE.precoBloco;
export const maxPecasTerreno = (w, d) => Math.max(LOTE.pecasMin, Math.min(LOTE.maxPecas, Math.round(w * d * LOTE.pecasPorBloco)));
// Peças que se constroem no lote (aba Construir do modo construção, como no Quimera). w x d = tamanho no chão (m)
// sem girar; circulos = sólidos [dx, dz, r] no espaço da peça (o herói não atravessa); alto = altura do topo (m): pulando
// dá para subir e ficar em cima (André 2026-11-05: "pular sobre as mesas de craft"); custo sai da mochila e volta
// inteiro ao desmontar. estacao: as receitas que dá para criar perto dela (mesma conta do servidor, RECEITA_ESTACAO).
// Modelos: Fantasy Props MegaKit e Medieval Village MegaKit (Quaternius, CC0, do repositório de fontes); a fornalha é
// de pedra como a forja da ferraria da vila (godot-prototipo/construcao.gd).
export const CONSTRUCOES = {
  bancada: { nome: 'Bancada de trabalho', w: 2, d: 1, circulos: [[-0.5, 0, 0.5], [0.5, 0, 0.5]], custo: { lenha: 6, pedra: 3 }, estacao: 'alf', alto: 0.89,
    desc: 'Perto dela você costura como na banca da Rosa (receitas do Alfaiate).' },
  bigorna: { nome: 'Bigorna', w: 0.8, d: 0.8, circulos: [[0, 0, 0.4]], custo: { barra_ferro: 3, lenha: 2 }, estacao: 'fer', alto: 1.18,
    desc: 'Perto dela você forja espadas, cajados, colares e armaduras (receitas do Ferreiro).' },
  fornalha: { nome: 'Fornalha', w: 1.4, d: 1.2, circulos: [[0, 0, 0.7]], custo: { pedra: 12, lenha: 2 }, estacao: 'fundir', alto: 1.16,
    desc: 'Derrete minério em barras e queima lenha em carvão.' },
  // Fogão (André 2026-11-07: "uma bancada de comida, tipo uma fogueirinha, um forno, pra fazer os pratos"): fogo de
  // pedra com o caldeirão em cima; perto dele o Cozinheiro faz os pratos de RECEITAS (prof 'coz')
  fogao: { nome: 'Fogão a lenha', w: 1.4, d: 1.2, circulos: [[0, 0, 0.65]], custo: { pedra: 8, lenha: 4, barra_ferro: 1 }, estacao: 'coz', alto: 0.9,
    desc: 'Fogo de pedra com caldeirão. Perto dele você cozinha os pratos (receitas do Cozinheiro).' },
  cerca: { nome: 'Cerca', w: 2, d: 0.3, circulos: [[-0.75, 0, 0.2], [0, 0, 0.2], [0.75, 0, 0.2]], custo: { lenha: 2 }, alto: 0.8,
    desc: 'Cerca de madeira de 2 m. Gire para mudar a direção.' },
};
// ---------- Construção completa como no Quimera (pedido do André 2026-11-04: "tem que ter todas as funções") ----------
// Cada peça agora é um item: cria-se primeiro (custo = receita; as do Quimera com needBench precisam de uma bancada
// construída perto) e coloca-se depois; desmontar devolve o item. Quimera Zv: bench 6 madeira + 3 pedra, found 4 pedra,
// wall 4 madeira, door 4 madeira, window 3 madeira + 1 pedra, roof 2 madeira + 1 pedra, chest 10 madeira,
// bed 8 madeira + 3 couro, torch 2 madeira + 1 gel (aqui carvão), fence 3 madeira, hoe 3 madeira + 2 pedra,
// can 1 barra de cobre + 2 madeira.
// Casa numa grade de CASA.grade m (as paredes do Medieval Village MegaKit têm 2 m): a fundação ocupa um quadrado,
// parede, porta e janela vão na borda de um quadrado com fundação e o telhado vai em cima do quadrado (vários juntos
// formam um telhado inclinado de verdade, que some quando você entra).
// tipo: 'movel' (padrão: fica no chão ou em cima da fundação), 'fundacao', 'borda' (parede/porta/janela), 'telhado'
// aba: em que aba do modo construção a peça aparece ('casa' ou 'moveis') · bancada: precisa de bancada perto para criar
export const CASA = { grade: 2, parede: 3.1, fundacao: 0.2, espessura: 0.3,
  // telhado das casas do jogador (2026-11-04: dá para ficar em pé em cima): sobe 0,6 m por metro até o meio, no máximo 1,8 m
  beiral: 0.45, inclina: 0.6, telhaMax: 1.8, porta: 2.2,
  // telhado em rampa (André 2026-11-05, igual ao Quimera): cada peça seguida na mesma direção (Girar) sobe telhaSobe m;
  // duas rampas de frente uma para a outra fecham a cumeeira
  telhaSobe: 1.2 };
for (const [k, v] of Object.entries(CONSTRUCOES)) Object.assign(v, { tipo: 'movel', aba: 'moveis', bancada: k !== 'bancada' });
Object.assign(CONSTRUCOES, {
  fundacao: { nome: 'Fundação de pedra', tipo: 'fundacao', aba: 'casa', w: 2, d: 2, circulos: [], custo: { pedra: 4 }, bancada: false,
    desc: 'Base da casa (2 x 2 m). Paredes, portas, janelas e telhados só vão em cima dela.' },
  parede: { nome: 'Parede', tipo: 'borda', aba: 'casa', w: 2, d: 0.3, circulos: [[-0.85, 0, 0.2], [-0.42, 0, 0.2], [0, 0, 0.2], [0.42, 0, 0.2], [0.85, 0, 0.2]],
    custo: { lenha: 4 }, bancada: true, desc: 'Vai na borda da fundação e os cantos se encaixam.' },
  porta: { nome: 'Porta', tipo: 'borda', aba: 'casa', w: 2, d: 0.3, circulos: [[-0.85, 0, 0.2], [0.85, 0, 0.2]], custo: { lenha: 4 }, bancada: true,
    desc: 'Vai na borda, como a parede. Dá para passar por ela.' },
  janela: { nome: 'Janela', tipo: 'borda', aba: 'casa', w: 2, d: 0.3, circulos: [[-0.85, 0, 0.2], [-0.42, 0, 0.2], [0, 0, 0.2], [0.42, 0, 0.2], [0.85, 0, 0.2]],
    custo: { lenha: 3, pedra: 1 }, bancada: true, desc: 'Parede com janela. Vai na borda da fundação.' },
  telhado: { nome: 'Telhado', tipo: 'telhado', aba: 'casa', w: 2, d: 2, circulos: [], custo: { lenha: 2, pedra: 1 }, bancada: true,
    desc: 'Vai em cima da fundação, com parede em volta. Vários juntos formam um telhado inclinado. Some quando você entra.' },
  bau: { nome: 'Baú', tipo: 'movel', aba: 'moveis', w: 1.3, d: 0.8, circulos: [[-0.3, 0, 0.38], [0.3, 0, 0.38]], custo: { lenha: 10 }, bancada: true, alto: 0.69,
    desc: 'Guarda até 40 pilhas de itens. Todos os seus baús guardam as mesmas coisas. Toque nele para abrir.' },
  cama: { nome: 'Cama', tipo: 'movel', aba: 'moveis', w: 1.9, d: 2.4, circulos: [[0, -0.6, 0.6], [0, 0.6, 0.6]], custo: { lenha: 8, couro: 3 }, bancada: true, alto: 0.6,
    desc: 'Você renasce nela quando cai. Deite à noite para pular até o amanhecer: vida e mana cheias e +40 de vigor (a cada 6 h).' },
  tocha: { nome: 'Tocha', tipo: 'movel', aba: 'moveis', w: 0.4, d: 0.4, circulos: [[0, 0, 0.15]], custo: { lenha: 2, carvao: 1 }, bancada: false,
    desc: 'Ilumina em volta. Coloque no chão.' },
});
// ferramentas da fazenda (Quimera: enxada para arar, regador para regar); ficam na mochila, não gastam
export const FERRAMENTAS_FAZENDA = {
  enxada: { custo: { lenha: 3, pedra: 2 }, bancada: false, para: 'arar' },
  // André 2026-11-07: picareta e machado de pedra obrigatórios desde o começo (sem bancada, como a enxada)
  picareta: { custo: { lenha: 2, pedra: 3 }, bancada: false, para: 'minerar' },
  machado: { custo: { lenha: 3, pedra: 2 }, bancada: false, para: 'cortar' },
  regador: { custo: { barra_cobre: 1, lenha: 2 }, bancada: true, para: 'regar' },
  vara: { custo: { lenha: 3, couro: 1 }, bancada: false, para: 'pescar' }, // Quimera: 3 madeira + 1 couro, na mochila
  radar_pesca: { custo: { barra_cobre: 1, cristal: 1 }, bancada: true, para: 'radar' }, // spots de pesca no mapa (André 2026-11-08)
};
// Criar peça da casa ou ferramenta (André 2026-11-05): cada uma leva de 3 a 5 s (mais material, mais tempo), com a
// barrinha carregando; dá para pedir várias de uma vez (até maxFila) e elas saem uma atrás da outra
// tempoCriar serve para peça (custo) e receita do Ferreiro/Alfaiate (usa)
export const CRIAR_OBRA = { min: 3, max: 5, porMaterial: 0.125, maxFila: 20 };
export const tempoCriar = (C) => Math.min(CRIAR_OBRA.max, Math.max(CRIAR_OBRA.min, CRIAR_OBRA.min + Object.values(C.custo || C.usa || {}).reduce((a, n) => a + n, 0) * CRIAR_OBRA.porMaterial));
export const BAU = { slots: 40, // pilhas guardadas (todos os baús do jogador são o mesmo, como no Quimera)
  // Melhorar o baú (André 2026-11-07): toque em Melhorar e ele cresce 40 → 60 → 80 lugares, sem tirar nada de dentro.
  // niveis[n] = lugares no nível n; melhorar[n] = o que custa para ir do nível n-1 para o n (ouro sai do bolso)
  niveis: [40, 60, 80],
  melhorar: [null, { lenha: 30, barra_ferro: 10, ouro: 500 }, { lenha: 60, barra_aco: 15, ouro: 2000 }] };
export const bauLugares = (nv) => BAU.niveis[Math.max(0, Math.min(BAU.niveis.length - 1, nv | 0))];
// Fornalha de verdade (André 2026-11-07: "o forno tá igual uma mesa de craft"): um lugar de combustível (lenha ou carvão)
// e um de material; ela fica queimando sozinha, mesmo com você longe ou fora do jogo, e o que fica pronto espera no
// lugar de saída até você pegar. combustivel = segundos de fogo de cada unidade; receitas pelo material posto:
// usa = quantos viram um, dur = segundos de cada um, fogo = só com esse combustível (aço: ferro com carvão),
// nivel = Ferreiro mínimo, vigor = pontos de Ferreiro (e XP) por unidade, dados quando você pega.
export const FORNALHA = {
  combustivel: { lenha: 12, carvao: 30 },
  receitas: {
    minerio_ferro: { faz: 'barra_ferro', usa: 3, dur: 12, nivel: 1, vigor: 1 },
    minerio_cobre: { faz: 'barra_cobre', usa: 3, dur: 12, nivel: 1, vigor: 1 },
    lenha: { faz: 'carvao', usa: 2, dur: 8, nivel: 1, vigor: 1 },
    barra_ferro: { faz: 'barra_aco', usa: 1, dur: 30, nivel: 5, vigor: 2, fogo: 'carvao' },
  },
};
// Plantas da horta (números do Quimera: G = horas de rega para ficar madura, y = quantos saem na colheita,
// a terra regada fica molhada por "rega" horas; sem água a planta não cresce)
// agua (André 2026-11-07): o regador cheio dá 20 regas; enche no poço da praça (poco) ou na beira de um lago, ou nadando
export const HORTA = { rega: 24, vigor: 1, agua: 20, poco: { x: PRACA.x, z: PRACA.z, r: 3.2 }, beira: 2.5 };
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
export const RECEITA_ESTACAO = (R) => (/^barra_|^carvao$/.test(R.faz) ? 'fornalha' : R.prof === 'fer' ? 'bigorna' : R.prof === 'coz' ? 'fogao' : 'bancada');
CAMINHOS.push({ largura: 2.4, pontos: VILA_LOTES.estrada }, ...VILA_LOTES.ruas);
CAMINHOS.push(...TRILHAS_MINA); // trilhas dos veios de pedra e de ferro (2026-11-05)
CAMINHOS.push(TRILHA_CAVERNA); // trilha da caverna da montanha (2026-11-06)
CAMINHOS.push(TRILHA_LAGO); // trilha das Terras até o Lago Grande (2026-11-06)

// Mapa aberto (André 2026-11-04): onde ainda sobra uma fresta entre a borda da vila, do campo de fora ou das Terras e a
// mata andável (parede invisível logo depois da borda), um círculo pequeno de mata costura os dois. Vêm por último.
(function costurarBordas() {
  const andavel = () => ({ areas: [{ x: 0, z: 0, r: 34 }, FORA, ...MATA.areas, VILA_LOTES.area], corredores: [...MATA.corredores, VILA_LOTES.passagem] });
  for (const o of [{ x: 0, z: 0, r: 34 }, FORA, VILA_LOTES.area]) {
    for (let g = 0; g < 360; g += 2) {
      const a = g * Math.PI / 180, R = raioNaDirecao(o, a);
      if (dentroDoMapa(andavel(), o.x + Math.cos(a) * (R + 1.5), o.z + Math.sin(a) * (R + 1.5))) continue;
      const n = MATA.areas.length;
      MATA.areas.push({ x: +(o.x + Math.cos(a) * (R + 5)).toFixed(2), z: +(o.z + Math.sin(a) * (R + 5)).toFixed(2), rx: 7, rz: 7, mata: true, ligacao: true, lobos: [[3, 0.07, n * 1.7], [5, 0.05, n * 0.9]] });
    }
  }
})();
// sorteadas todas (a ordem do sorteio não muda) e só depois tiradas das zonas de mineração
const ARVORES_MATA = sortearMata();

// ---------- mapa todo andável, lagos e montanha (pedido do André 2026-11-05) ----------
// "Eu quero que o mapa inteiro que está disponível seja possível caminhar... onde der pra ir, tem que poder ir." A folga
// da borda agora vale para a borda de verdade do mapa (shared/mapa.js dentroDoMapa). Sobravam buracos fechados no meio
// da mata (pedaços sem área nenhuma, cercados de mata andável): estes círculos cobrem cada um. Vêm por último na lista
// de áreas (as de antes não mudam de índice nem de sorteio de árvores).
const BURACOS = [[20, -28, 3], [44, -25, 3], [85.5, -18, 3.5], [-21, 27, 3], [42.8, 36.1, 8.5], [-37, 61, 3], [60.9, 75.6, 22.2], [-4, 106, 3], [167, 126, 3], [169, 5, 3], [-7, -46.8, 3]]
  .map(([x, z, r]) => ({ x, z, rx: r, rz: r, mata: true, ligacao: true, buraco: true }));
// Pé da montanha: mata aberta que sai do leste do campo de fora (depois do veio de ferro) e sobe a encosta oeste da
// montanha (shared/relevo.js). O paredão norte e leste é o fim do mapa (íngreme demais para subir andando).
const MONTE_AREAS = [
  { x: 120, z: -22, rx: 17, rz: 17, lobos: [[3, 0.07, 0.3], [5, 0.05, 1.1]] },
  { x: 128, z: -42, rx: 16, rz: 16, lobos: [[3, 0.07, 1.9], [5, 0.05, 0.4]] },
  { x: 144, z: -12, rx: 14, rz: 12, lobos: [[3, 0.07, 2.6], [5, 0.05, 2.2]] },
  { x: 131, z: 6.6, rx: 25, rz: 25, lobos: [[3, 0.05, 0.2], [5, 0.04, 0.9]] }, // fecha o buraco entre o pé da montanha, o campo de fora e a mata da estrada
  { x: 188, z: -62, rx: 76, rz: 76, lobos: [[3, 0.05, 0.8], [5, 0.04, 1.6]] }, // a montanha inteira: o limite é a mata depois do pé do outro lado
].map((a) => ({ ...a, mata: true, monte: true }));
// chão diferente do plano (lago ou montanha): ali não nasce árvore da mata baixa, mato, grama nem pedra solta
const noRelevo = (x, z, folga = 1.5) => pertoDaAgua(x, z, folga) || alturaMontanha(x, z) > 0.15;
// árvores do pé da montanha (sorteio próprio, vêm depois das da mata: os ids m0, m1... de antes não mudam): soltas por
// dentro da mata aberta e uma faixa fechada logo depois da borda, no plano e no pé da encosta (y = altura do chão ali)
function sortearMataMonte() {
  let sem = 5051; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const M = { areas: MONTE_AREAS, corredores: [] }, velhas = { areas: [{ x: 0, z: 0, r: 34 }, FORA, ...MATA.areas], corredores: MATA.corredores };
  const lista = [], perto = (x, z, esp) => lista.some((o) => Math.abs(o.x - x) < esp && Math.abs(o.z - z) < esp && Math.hypot(o.x - x, o.z - z) < esp);
  for (let t = 0; t < 26000; t++) {
    const x = rnd(96, 276), z = rnd(-150, 16), dentro = dentroDoMapa(M, x, z, 0);
    if (!dentro && !dentroDoMapa(M, x, z, -9)) continue;
    const hm = alturaMontanha(x, z), inc = Math.hypot(alturaMontanha(x + 1, z) - alturaMontanha(x - 1, z), alturaMontanha(x, z + 1) - alturaMontanha(x, z - 1)) / 2;
    // linha das árvores (direção de arte): sobem esparsas até ~40% da altura da montanha e vão rareando, sem corte reto
    const linha = MONTANHA.alto * 0.4, sobe = hm / linha;
    if (dentroDoMapa(velhas, x, z, -1) || pertoDaAgua(x, z, 2) || naMina(x, z, 3) || inc > 0.6 || sobe > 1 || rnd(0, 1) < sobe * sobe * 0.9) continue;
    if (CLAREIRAS.some((c) => Math.hypot(x - c.x, z - c.z) < CLAREIRA_R + 3) || pertoDaLinha(ESTRADA, x, z).d < 5.5 || TRILHAS.some((L) => pertoDaLinha(L, x, z).d < 2.2)) continue;
    const esp = (dentro ? 6.4 : 3.2) * (1 + sobe * 1.2); // mais alto, mais espaçadas
    if (perto(x, z, esp)) continue;
    lista.push({ x: +x.toFixed(2), z: +z.toFixed(2), s: +rnd(0.8, 1.4).toFixed(2), ry: +rnd(0, 6.28).toFixed(2), v: Math.floor(rnd(0, 2.999)), ...(hm > 0 ? { y: +(hm - 0.08).toFixed(2) } : {}) });
  }
  return lista;
}
// sem árvore em cima da trilha da caverna, na boca nem no túnel (2026-11-06; tirar depois do sorteio não muda as outras)
const ARVORES_MONTE = sortearMataMonte().filter((a) => pertoDaLinha(TRILHA_CAVERNA.pontos, a.x, a.z).d > 2.4 && !noTunel(TUNEL, a.x, a.z, 3.5)
  && Math.hypot(a.x - GUARDA_CAVERNA.x, a.z - GUARDA_CAVERNA.z) > 3);
// Lago Grande (André 2026-11-06: "acrescentar um lago maior... vou acrescentar pescaria, barquinho"): campo aberto ao
// sul das Terras da Estrada, com o lago no meio (shared/relevo.js LAGOS lago_grande) e a mata fechando em volta. A
// estrada central das Terras continua numa trilha de terra até a margem norte. Vêm no fim das listas (áreas, corredores
// e árvores): o que já existia não muda de índice nem de sorteio.
// árvores do Lago Grande (sorteio próprio, depois das da montanha): soltas pelo campo (nada perto da água nem na
// trilha) e uma faixa fechada logo depois da borda
function sortearMataLago() {
  let sem = 7177; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const A = LAGO_GRANDE_AREA, M = { areas: [A], corredores: [LAGO_GRANDE_PASSAGEM] };
  const velhas = { areas: [{ x: 0, z: 0, r: 34 }, FORA, ...MATA.areas, VILA_LOTES.area], corredores: [...MATA.corredores, VILA_LOTES.passagem] };
  const lista = [], perto = (x, z, esp) => lista.some((o) => Math.abs(o.x - x) < esp && Math.abs(o.z - z) < esp && Math.hypot(o.x - x, o.z - z) < esp);
  for (let t = 0; t < 14000; t++) {
    const x = rnd(A.x - A.rx - 12, A.x + A.rx + 12), z = rnd(A.z - A.rz - 12, A.z + A.rz + 12), dentro = dentroDoMapa(M, x, z, 0);
    if (!dentro && !dentroDoMapa(M, x, z, -9)) continue;
    if (dentroDoMapa(velhas, x, z, -1) || pertoDaAgua(x, z, dentro ? 7 : 3) || pertoDaLinha(TRILHA_LAGO.pontos, x, z).d < 2.4) continue;
    if (CLAREIRAS.some((c) => Math.hypot(x - c.x, z - c.z) < CLAREIRA_R + 3)) continue;
    const esp = dentro ? 8.5 : 3.2;
    if (perto(x, z, esp)) continue;
    lista.push({ x: +x.toFixed(2), z: +z.toFixed(2), s: +rnd(0.8, 1.4).toFixed(2), ry: +rnd(0, 6.28).toFixed(2), v: Math.floor(rnd(0, 2.999)) });
  }
  return lista;
}
const ARVORES_LAGO = sortearMataLago();
// ---------- mapa todo circulável (André 2026-11-07) ----------
// "Eu não quero nenhuma barreira invisível nesse mapa, nenhuma em lugar nenhum. A única barreira que vai ter é quando o
// mapa acabar." Entre as áreas andáveis sobravam baías de mata (do terreno nas Terras da Estrada até a trilha dos Lobos
// Nv10, por exemplo): dava para ver a estrada do outro lado e o herói parava numa parede invisível. Estes círculos cobrem
// cada baía (ferramentas/mapa/frestas.mjs gera a lista: fechamento de 30 m do mapa andável). Vêm no fim das áreas: as de
// antes não mudam de índice. Rodar a ferramenta de novo quando entrar área nova.
const FRESTAS = [[33.5, 79.5, 14], [29.5, 93.5, 14], [30.5, 107.5, 14], [24.5, 120.5, 14], [41.5, 116.5, 14], [20.5, 134.5, 14], [56.5, 117.5, 14], [35.5, 129.5, 14], [16.5, 148.5, 14], [169.5, 123.5, 14], [11.5, 163.5, 14], [165.5, 97.5, 14], [31.5, 143.5, 14], [6.5, 135.5, 14], [183.5, 127.5, 14], [175.5, 110.5, 14], [173.5, 85.5, 14], [2.5, 149.5, 14], [25.5, 159.5, 14], [176.5, 10.5, 14], [175.5, 43.5, 14], [181.5, 97.5, 14], [24.5, 173.5, 14], [152.5, 170.5, 14], [179.5, 24.5, 14], [106.5, -32.5, 14], [189.5, 114.5, 14], [181.5, 184.5, 14], [190.5, 11.5, 14], [203.5, 156.5, 14], [37.5, 167.5, 14], [189.5, 85.5, 14], [138.5, 167.5, 14], [-14.5, 160.5, 14], [92.5, -36.5, 13.9], [188.5, 37.5, 12.6], [113.5, -45.5, 12.3], [-46.5, 59.5, 12.3], [195.5, 101.5, 10.7], [36.5, 181.5, 9.7], [-8.5, -49.5, 9.3], [73.5, 155.5, 9.3], [143.5, 181.5, 9.1], [193.5, 25.5, 8.5], [-47.5, 30.5, 8.3], [-20.5, 147.5, 8.3], [203.5, 113.5, 8.2], [123.5, 167.5, 7.8], [65.5, -41.5, 7.5], [187.5, 197.5, 6.9], [214.5, 165.5, 6.3], [-49.5, 4.5, 6], [116.5, -57.5, 5.7], [51.5, 169.5, 5], [198.5, 45.5, 4.4], [202.5, 79.5, 4.4], [101.5, -48.5, 4.3], [205.5, 11.5, 4.3], [181.5, 201.5, 3.8], [-47.5, -27.5, 3.5], [117.5, -63.5, 3.4], [-42.5, 115.5, 3.4], [217.5, 153.5, 3.3], [-27.5, 167.5, 3.3], [-52.5, 90.5, 2.9]]
  .map(([x, z, r]) => ({ x, z, rx: r, rz: r, mata: true, ligacao: true, fresta: true }));
// árvores das baías abertas (sorteio próprio, vêm depois de todas as outras: os ids m0, m1... de antes não mudam).
// A faixa fechada que já existia logo depois da borda antiga fica (agora dá para andar entre as árvores dela); onde a
// baía era mais larga que essa faixa entra mata solta como a de dentro, e a borda nova ganha a faixa fechada dela.
function sortearMataFrestas(existentes) {
  let sem = 9091; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const velhas = { areas: [{ x: 0, z: 0, r: 34 }, FORA, ...MATA.areas, VILA_LOTES.area, ...EMENDAS, ...BURACOS, ...MONTE_AREAS, LAGO_GRANDE_AREA],
    corredores: [...MATA.corredores, VILA_LOTES.passagem, LAGO_GRANDE_PASSAGEM] };
  const novas = { areas: FRESTAS, corredores: [] }, todas = { areas: [...velhas.areas, ...FRESTAS], corredores: velhas.corredores };
  const grade = new Map(), cel = 6, chave = (i, j) => i * 10007 + j, lista = [];
  const guarda = (a) => { const k = chave(Math.floor(a.x / cel), Math.floor(a.z / cel)); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(a); };
  existentes.forEach(guarda);
  const livre = (x, z, esp) => {
    const i = Math.floor(x / cel), j = Math.floor(z / cel);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const o of grade.get(chave(a, b)) || []) if (Math.hypot(o.x - x, o.z - z) < esp) return false;
    return true;
  };
  const x0 = Math.min(...FRESTAS.map((a) => a.x - a.rx)) - 10, x1 = Math.max(...FRESTAS.map((a) => a.x + a.rx)) + 10;
  const z0 = Math.min(...FRESTAS.map((a) => a.z - a.rz)) - 10, z1 = Math.max(...FRESTAS.map((a) => a.z + a.rz)) + 10;
  const tentativas = Math.round((x1 - x0) * (z1 - z0) / 2.2);
  for (let t = 0; t < tentativas; t++) {
    const x = rnd(x0, x1), z = rnd(z0, z1);
    if (!dentroDoMapa(novas, x, z, -9)) continue; // longe das baías: nada muda
    const dentro = dentroDoMapa(todas, x, z, 0);
    if (dentroDoMapa(velhas, x, z, -9)) continue; // perto da borda antiga: a faixa de árvores dela já está lá
    if (!dentro && !dentroDoMapa(todas, x, z, -9)) continue;
    const df = Math.hypot(x - FORA.x, z - FORA.z) - raioNaDirecao(FORA, Math.atan2(z - FORA.z, x - FORA.x));
    if (df < 2 || Math.hypot(x, z) < 37 || naTerras(x, z, 1.5) || naMina(x, z, 3) || noRelevo(x, z) || naTrilhaLago(x, z)) continue;
    if (pertoDaLinha(ESTRADA, x, z).d < 5.5 || TRILHAS.some((L) => pertoDaLinha(L, x, z).d < 2.2) || pertoDaLinha(TRILHA_CAVERNA.pontos, x, z).d < 2.4 || noTunel(TUNEL, x, z, 3.5)) continue;
    if (CLAREIRAS.some((c) => Math.hypot(x - c.x, z - c.z) < CLAREIRA_R + 1.5)) continue;
    if (cenario().marcos.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 1.2)) continue;
    const esp = dentro ? 6.6 : 3.3;
    if (!livre(x, z, esp)) continue;
    const a = { x: +x.toFixed(2), z: +z.toFixed(2), s: +rnd(dentro ? 0.7 : 0.9, 1.4).toFixed(2), ry: +rnd(0, 6.28).toFixed(2), v: Math.floor(rnd(0, 2.999)) };
    lista.push(a); guarda(a);
  }
  return lista;
}
export const MAPA_CLAREIRA = {
  id: 'clareira',
  nome: 'Vila da Clareira',
  raio: 34,
  nascimento: { x: 0, z: 1 },
  // onde dá para andar: a vila (raio 34), a passagem da estradinha do leste e a clareira de fora (shared/mapa.js)
  // e a mata (MATA, pedido do André 2026-11-03): círculos ao longo da estrada e das clareiras, sem anel de pedra
  areas: [{ x: 0, z: 0, r: 34 }, FORA].concat(MATA.areas, [VILA_LOTES.area], EMENDAS, BURACOS, MONTE_AREAS, [LAGO_GRANDE_AREA], FRESTAS), // + baías abertas (2026-11-07) // + Vila dos Lotes (construção e fazenda)
  corredores: [{ a: [27, -2.7], b: [44, -3.4], larg: 9, semPedras: true }].concat(MATA.corredores, [VILA_LOTES.passagem], [LAGO_GRANDE_PASSAGEM]), // semPedras: a mata aberta em volta faz a borda (mapa aberto, André 2026-11-04)
  // máscara do chão (trilhas e praça) cobre a vila e a área de fora: x0, z0 e o tamanho do quadrado em metros
  mascara: { x0: -38, z0: -62, tam: 292, px: 2048 }, // 2026-11-03: cresceu para cobrir a mata (mesma nitidez)
  // minimapa (desenho de cima: client/src/minimapa.js -> modelos/minimapa.png): quadrado que pega o mapa todo
  minimapa: { x0: -64, z0: -146, tam: 412, px: 1024 }, // 2026-11-05: cresceu para o norte (montanha); antes x0 -64, z0 -64, tam 308
  lagos: LAGOS, // lagos rasos e fundos (shared/relevo.js)
  montanha: MONTANHA, // 2026-11-04: cresceu para a mata aberta em volta da vila e das Terras
  // inimigos parados num lugar (renascem no mesmo lugar). Dentro da vila não tem mais nenhum (pedido do André
  // 2026-11-02): os monstros ficam no campo de caça lá fora (CACA)
  inimigos: [],
  caca: CACA,
  mina: MINA,
  // espantalho de treino ao lado da ferraria, na grama entre a parede dela, os caixotes e a estrada larga (fora dos
  // caminhos), a 4,6 m do Tomás para os nomes não se encostarem (direção de arte);
  // virado para a estrada, de onde o herói chega. O v dele vem depois das vagas dos campos de caça.
  treino: [{ id: 'espantalho1', tipo: 'espantalho', x: 5, z: -1.2, ry: -0.8 }],
  // NPCs da vila: personagens anime (VRoid CC0) com cabelo, roupa e tamanho próprios.
  // roupa: peças da armadura do herói que o NPC veste (mesmo texto do servidor: peça + raridade, "peitoral0,capa3").
  // arma: 'espada' ou 'cajado' nas costas, 'cajado_mao' na mão. anciao: corpo curvado, barba e bigode (o Aldo).
  // veste: roupa de ofício para quem não luta (sem couraça): cor da túnica, saia até o joelho ou a canela, faixa,
  // corpete e avental (godot-prototipo/visual_npc.gd). esconder: malhas do modelo que somem (no Godot o Bento usa o
  // corpo vita, e o HAIR_03 dele é o fone/tiara sci-fi).
  // André 2026-11-05: NPCs da vila estavam modernos demais; agora vestem roupa de guerreiro e mago de fantasia. funcao: o que o botão Falar faz (veja Simulacao.falar e client/src/main.js)
  // acoes: o que aparece no menu do NPC no app (botão de interação, como no Quimera); 'Conversar' sempre aparece.
  // 'vender' = ele compra itens da mochila (o servidor confere: Simulacao.pertoDeQuemCompra)
  npcs: [
    { id: 'lider', nome: 'Aldo, o líder da vila', x: -6, z: -18.6, ry: 0, visual: 'fumiriya', escala: 1.03, roupa: 'peitoral0,botas0,capa3', veste: { tunica: 0x5a4a3a, saia: 0x5a4a3a, ate: 'canela', faixa: 0x8a7350 }, arma: 'cajado_mao', anciao: true, tinta: { cabelo: 0xc9c7c2, roupa: 0x5b3a24, calca: 0x3b3229 }, funcao: 'missao', missao: 'bando', acoes: ['missao'], falas: [
      'Andarilho, monstros apareceram no leste. Derrube quatro deles e a vila te deve uma.',
      'A praça foi construída pelos nossos avós. Enquanto eu viver, ela fica de pé.',
    ] },
    { id: 'ferreiro', nome: 'Tomás, o ferreiro', x: 1.5, z: -4.2, ry: -1.25, visual: 'cabelo_m', escala: 1.08, roupa: 'peitoral0,calca0,botas0', veste: { tunica: 0xb9a47e }, tinta: { cabelo: 0x4a2f1c, roupa: 0x6b4a2e, calca: 0x2f2a24 }, funcao: 'habilidades', acoes: ['vender', 'forja', 'consertar', 'habilidades'], falas: [
      'Essa espada corta e conjura. Fale comigo para escolher os seus golpes e magias.',
      'Bigorna boa é bigorna quente. Volte quando quiser trocar a build.',
    ] },
    { id: 'curandeira', nome: 'Irmã Lúcia, a curandeira', x: 1.4, z: -17.6, ry: -1, visual: 'shino', roupa: 'peitoral0,botas0,capa1', veste: { tunica: 0x3a5a8a, saia: 0x3a5a8a, ate: 'joelho', faixa: 0xe4dccb }, arma: 'cajado', tinta: { cabelo: 0xe4e0d8, roupa: 0xe8e1cf, calca: 0x6d7f8c }, funcao: 'cura', acoes: ['cura'], falas: [
      'Ferido? Fale comigo e eu cuido de você.',
      'As ervas da clareira curam quase tudo. Quase.',
    ] },
    { id: 'andarilho', nome: 'Bento, o andarilho', x: -3.5, z: 5.2, ry: 2.4, visual: 'fumiriya', escala: 0.9, roupa: 'peitoral0,calca0,botas0,capa0', arma: 'espada', esconder: ['HAIR_03'], limpar_rosto: true, tinta: { cabelo: 0x8a4a22, roupa: 0x4f5e36, calca: 0x4a3c2c }, funcao: 'dica', acoes: [], falas: [
      'Já subiu na rocha mais alta, perto daqui? Lá de cima se vê a vila inteira.',
      'A escada na rocha menor é o jeito fácil. Na grande, só escalando.',
      'Pedra baixa você sobe andando. Na alta, agarre e vá subindo. Correndo contra ela, dá até para correr pela parede.',
    ] },
    { id: 'comerciante', nome: 'Rosa, a comerciante', x: -9.6, z: -11.2, ry: 0.9, visual: 'vivi', roupa: 'peitoral0,botas0', veste: { tunica: 0xc47a3a, corpete: 0xa9622c, saia: 0x6b4a2e, ate: 'joelho', avental: 0xe8dfc8 }, tinta: { cabelo: 0x5a1e24, roupa: 0xa0563c, calca: 0x3c3a52 }, funcao: 'loja', acoes: ['comprar', 'vender', 'alfaiate'], falas: [
      'Minha carroça chega em breve com mercadoria da cidade.',
      'Tenho de tudo um pouco... quer dizer, vou ter.',
    ] },
    // Guardião da caverna da montanha (André 2026-11-06): pega o material dos monstros e faz o passe da dungeon.
    { id: 'guardiao', nome: 'Gaspar, o guardião da caverna', x: GUARDA_CAVERNA.x, z: GUARDA_CAVERNA.z, ry: GUARDA_CAVERNA.ry, visual: 'cabelo_m', escala: 1.06, roupa: 'peitoral2,calca2,botas2,capa2', arma: 'espada', tinta: { cabelo: 0x3a3632, roupa: 0x4a4038, calca: 0x2e2a26 }, funcao: 'passe', acoes: ['passe'], falas: [
      'Ninguém passa do selo sem passe. Traga o material dos monstros e eu faço um para você.',
      'Lá embaixo a pedra respira. Golens, Maws... e o Warrok no fundo. Vá preparado.',
      'O passe abre o selo uma vez. Saiu da caverna, precisa de outro.',
    ] },
    { id: 'reset', nome: 'Mestre Ivo, o instrutor', x: 2.6, z: 4.6, ry: -2.4, visual: 'cabelo_m', escala: 1.0, roupa: 'peitoral3,calca3,botas3,capa3', arma: 'espada', friso: true, tinta: { cabelo: 0x2a2622, roupa: 0x3c4a5e, calca: 0x2b2a30 }, funcao: 'resetar', acoes: ['resetar'], falas: [
      'Quer recomeçar a build? Eu devolvo seus pontos de atributo. As skills ficam, porque sobem usando.',
    ] },
    // Alquimista (André 2026-11-09): sintetiza catalisador da raridade de cima (CATALISADOR.sintese), na porta da casa3.
    { id: 'alquimista', nome: 'Mirela, a alquimista', x: 2.3, z: -12.4, ry: -1.7, visual: 'shibu', escala: 0.98, roupa: 'peitoral0,botas0,capa2', veste: { tunica: 0x3e2a5c, saia: 0x3e2a5c, ate: 'canela', faixa: 0xc9a23a, avental: 0x4a3626 }, tinta: { cabelo: 0x2f4a3c, roupa: 0x3e2a5c, calca: 0x2b2433 }, funcao: 'alquimia', acoes: ['alquimia'], falas: [
      'Dez selos fracos viram um forte, se o ouro ajudar. Alquimia é paciência e moeda.',
      'Até o Lendário eu chego. O Mítico... esse nenhum caldeirão da vila aguenta.',
      'Runa com runa, selo com selo. Misturar os dois só dá fumaça.',
    ] },
  ],
  rochas: ROCHAS,
  // escada de madeira encostada na rocha grande: pé no chão e topo na beirada
  escadas: [{ x: -7, z: 4, ry: 0, topo: { x: -7, z: 5.3 } }],
  // sólidos pequenos: poço da praça, caixotes da ferraria, banca da comerciante
  obstaculos: [{ x: PRACA.x, z: PRACA.z, r: 1.15 }, { x: 6.6, z: -2.4, r: 0.8, alto: 0.86 }, { x: -10.7, z: -12.3, r: 0.75, alto: 0.8 }], // alto: o topo (dá para pular e ficar em cima)
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
  mata: ARVORES_MATA.filter((a) => !naMina(a.x, a.z) && !noRelevo(a.x, a.z) && !naTrilhaLago(a.x, a.z)).concat(ARVORES_MONTE, ARVORES_LAGO), // as zonas de mineração e os lagos ficam limpos
  estrada: ESTRADA,
};
// árvores das baías abertas: no fim da lista (os ids das de antes não mudam)
MAPA_CLAREIRA.mata.push(...sortearMataFrestas(MAPA_CLAREIRA.mata));

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
  // corpos que o criador do app Godot mostra (sem nome, pedido do André 2026-11-03). André 2026-11-07: "vai ficar só
  // um homem e só uma mulher" como opção de personagem principal: a Ruiva e o cabelo_m. Os outros seguem nos NPCs.
  corpos: ['ruiva', 'cabelo_m'],
  // corpos que já estiveram no criador (2026-11-03 a 2026-11-07): contas antigas com eles continuam válidas no
  // servidor, e o app mostra o herói com o corpo do criador do mesmo sexo (main.gd, corpo_valido)
  // penteados (André 2026-11-07): o cabelo de outro modelo VRoid do jogo na cabeça do herói (godot penteado.gd).
  // Por corpo do criador; null = o cabelo do próprio corpo. Só cabelo de moça na moça e de rapaz no rapaz.
  penteados: { ruiva: ['vivi', 'vita', 'victoria', 'shino', 'shibu', 'shibu_sombrio'], cabelo_m: ['fumiriya'] },
  corposAntigos: { shibu: 'ruiva', shibu_sombrio: 'ruiva', fumiriya: 'cabelo_m', shino: 'ruiva', vivi: 'ruiva', vita: 'ruiva', victoria: 'ruiva' },
};
// Corpo do personagem (visual) que o servidor aceita: os do jogo HTML (PERSONAGENS) e os do criador do app Godot
export function visualValido(v) {
  return typeof v === 'string' && (PERSONAGENS.some((p) => p.id === v) || CRIADOR.corpos.includes(v) || Object.hasOwn(CRIADOR.corposAntigos, v));
}
// Aparência mandada pelo jogador: só cores da lista e altura dentro do limite (o resto vira a cor original)
export function aparenciaValida(a) {
  if (!a || typeof a !== 'object') return null;
  const r = {};
  for (const k of ['cabelo', 'olhos', 'pele', 'roupa', 'calca']) r[k] = CRIADOR[k].includes(a[k]) ? a[k] : null;
  const [min, max] = CRIADOR.altura;
  r.altura = Number.isFinite(a.altura) ? Math.round(Math.min(max, Math.max(min, a.altura)) * 100) / 100 : 1;
  for (const [k, [lo, hi]] of Object.entries(CRIADOR.rosto)) r[k] = Number.isFinite(a[k]) ? Math.round(Math.min(hi, Math.max(lo, a[k])) * 100) / 100 : 1;
  r.penteado = Object.values(CRIADOR.penteados).some((l) => l.includes(a.penteado)) ? a.penteado : null;
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
  pedra: { nome: 'Pedra', mat: true, pilha: 50, venda: 1, desc: 'Pedra comum. Sai dos veios de pedra (e, às vezes, junto quando você minera outro veio). Serve para construir e para afiar ferramentas.' },
  carvao: { nome: 'Carvão', mat: true, pilha: 50, venda: 2, desc: 'Lenha queimada na forja. Misturado ao ferro, vira aço.' },
  barra_aco: { nome: 'Barra de aço', mat: true, pilha: 50, venda: 20, desc: 'Ferro com carvão, mais duro que o ferro. Vira armadura e lâmina melhores.' },
  couro: { nome: 'Couro', mat: true, pilha: 50, venda: 3, desc: 'Couro grosso dos Puglins. O alfaiate faz botas e reforços.' },
  tecido: { nome: 'Tecido', mat: true, pilha: 50, venda: 3, desc: 'Pano encantado que os Imps carregam. O alfaiate faz calças, shorts e capas.' },
  // dungeon da montanha (2026-11-06): o fragmento cai dos monstros; o Gaspar junta e faz o passe que abre o selo
  fragmento: { nome: 'Fragmento rúnico', mat: true, pilha: 50, venda: 4, desc: 'Lasca de pedra com uma runa apagada. Os monstros carregam sem saber. O Gaspar, na boca da caverna da montanha, faz passes com ela.' },
  // carne (2026-11-07): cai dos bichos (Puglin, Lobo, Maw) e vai para o fogão
  carne: { nome: 'Carne crua', mat: true, pilha: 50, venda: 2, desc: 'Carne de caça. No fogão vira carne assada ou ensopado.' },
  // pratos do fogão (Cozinheiro): comer recupera vida/mana e dá vigor (usar.vigor = pontos); sem recarga nem limite por enquanto (André 2026-11-07)
  carne_assada: { nome: 'Carne assada', pilha: 20, comida: true, usar: { vida: 0.25, vigor: 6 }, venda: 6, desc: 'Recupera 25% da vida e 6 de vigor.' },
  sopa_legumes: { nome: 'Sopa de legumes', pilha: 20, comida: true, usar: { vida: 0.3, vigor: 10 }, venda: 8, desc: 'Recupera 30% da vida e 10 de vigor.' },
  pao_milho: { nome: 'Pão de milho', pilha: 20, comida: true, usar: { mana: 0.3, vigor: 8 }, venda: 8, desc: 'Recupera 30% da mana e 8 de vigor.' },
  ensopado: { nome: 'Ensopado de carne', pilha: 20, comida: true, usar: { vida: 0.5, vigor: 15 }, venda: 14, desc: 'Recupera 50% da vida e 15 de vigor.' },
  torta_abobora: { nome: 'Torta de abóbora', pilha: 20, comida: true, usar: { vida: 0.4, mana: 0.4, vigor: 20 }, venda: 22, desc: 'Recupera 40% da vida, 40% da mana e 20 de vigor.' },
  passe_caverna: { nome: 'Passe da Caverna', mat: true, pilha: 20, venda: 10, desc: 'Abre o selo da Caverna da Montanha uma vez. Use na porta (o botão aparece quando você chega perto).' },
  // pescaria (igual ao Quimera, André 2026-11-08): peixes crus (comer recupera um pouco; preço e vigor do Quimera) e o peixe assado do fogão
  lambari: { nome: 'Lambari', pilha: 99, comida: true, peixe: true, usar: { vida: 0.06, vigor: 1 }, venda: 3, desc: 'Peixinho de rio e lago. Asse dois no fogão.' },
  tilapia: { nome: 'Tilápia', pilha: 99, comida: true, peixe: true, usar: { vida: 0.1, vigor: 1 }, venda: 6, desc: 'Peixe de lago e rio. Vale umas moedas.' },
  traira: { nome: 'Traíra', pilha: 99, comida: true, peixe: true, usar: { vida: 0.14, vigor: 2 }, venda: 11, desc: 'Peixe bravo de água doce. Briga muito na linha!' },
  sardinha: { nome: 'Sardinha', pilha: 99, comida: true, peixe: true, usar: { vida: 0.06, vigor: 1 }, venda: 3, desc: 'Peixinho do mar.' },
  robalo: { nome: 'Robalo', pilha: 99, comida: true, peixe: true, usar: { vida: 0.14, vigor: 2 }, venda: 9, desc: 'Peixe do mar. Ótimo pra moqueca.' },
  garoupa: { nome: 'Garoupa', pilha: 99, comida: true, peixe: true, usar: { vida: 0.2, vigor: 2 }, venda: 18, desc: 'Peixe grande do mar. Vale bem.' },
  atum: { nome: 'Atum', pilha: 99, comida: true, peixe: true, usar: { vida: 0.28, vigor: 4 }, venda: 30, desc: 'Peixe enorme do mar aberto. Raro!' },
  dourado: { nome: 'Peixe-Dourado', pilha: 99, comida: true, peixe: true, usar: { vida: 0.6, vigor: 8 }, venda: 160, desc: 'Lendário! Só nas águas em volta da ilha. Vale uma fortuna.' },
  peixe_assado: { nome: 'Peixe assado', pilha: 20, comida: true, usar: { vida: 0.3, vigor: 4 }, venda: 7, desc: 'Recupera 30% da vida e 4 de vigor.' },
};
// Recarga das poções (André 2026-11-06): segundos entre uma poção e outra do mesmo tipo (vida e mana contam separado).
export const POCAO_RECARGA = 10;
export const VENDA_EQUIP = [20, 80, 250, 700, 2000]; // quanto a loja paga por raridade
// Penalidade de morte (André 2026-11-05): quem cai perde `ouro` do ouro que carrega e cada peça equipada perde `desgaste`
// de durabilidade (de durMax). Peça com 0 fica Quebrada: continua no corpo, mas não dá bônus (nem conta para o conjunto)
// até o Tomás consertar. Conserto: o que falta da durabilidade x VENDA_EQUIP da raridade x `conserto` (em ouro).
export const MORTE = { ouro: 0.1, desgaste: 10, durMax: 100, conserto: 0.3 };
// Reforço de equipamento (igual ao Quimera, André 2026-11-07): toque na peça e em "Reforçar". Cada tentativa custa ouro e
// pode falhar. Números do Quimera (index.html: Sh = chance, Th = custo, Rh = bônus, mgGNeed = atributo):
// - max: até onde cada raridade vai, igual ao Quimera (André 2026-11-07: "faz igual Quimera"): Comum não reforça,
//   Rara +10, Épica +20, Lendária +30, Mítica +40. Antes era +5/+10/+15/+20; só subiu, nenhuma peça perde reforço.
// - chance[e]: % de sair de +e para +e+1. custo: round((base + porRaridade x raridade) x sobe^e) de ouro.
// - falhou: volta 1 (+e-1), mas nunca abaixo do último múltiplo de `seguro` (+5, +10...: de +5 falhando continua +5).
// - bônus: cada + soma `bonus` (40%) dos números da peça; o crítico soma `bonusCritico` (20%).
// - atributo: de +3 em diante precisa de porNivel x (nível do reforço) de Força (espada), Inteligência (cajado) ou da
//   maior das duas (armadura e acessório). `tempo`: segundos da barrinha da janela.
export const REFORCO = {
  max: [0, 10, 20, 30, 40],
  chance: [100, 80, 75, 70, 66, 62, 59, 56, 53, 50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 29, 28, 27, 26, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25],
  custo: { base: 10, porRaridade: 12, sobe: 1.07 },
  seguro: 5, bonus: 0.4, bonusCritico: 0.2,
  atributo: { livre: 2, porNivel: 10 },
  tempo: 1.6,
};
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
export const LOJA_MAX = 999; // compra várias de uma vez (André 2026-11-07): até quantas por toque em Comprar
// Troca entre jogadores (como no Quimera, André 2026-11-04): pedir perto, cada um põe itens e ouro, tranca a oferta
// (cadeado) e, com as duas trancadas, os dois confirmam. Qualquer mudança destranca as duas. Quem decide é o servidor.
export const TROCA = { perto: 6, longe: 14, maxItens: 12, pedido: 30, entrePedidos: 3 }; // metros, metros, itens, s, s
// Amigos e time (André 2026-11-05): até 20 amigos na conta; o time junta até 5 amigos da mesma sala.
// XP e drop dos monstros valem para quem do time está a até 'perto' metros do monstro que caiu e lutou há pouco.
export const AMIGOS = { max: 20, pedido: 30, entrePedidos: 3 }; // amigos, s, s
// combate: só ganha quem lutou (bateu ou apanhou) nos últimos 10 s. bonus: +10% de XP para cada outro do time que ganhou junto
// (2 = +10%, 5 = +40%).
// Chat (André 2026-11-06: "cria um chat geral e um de amigos"; o geral pode ser silenciado no app).
// geral: todo mundo que está online, em qualquer mundo (sala). amigos: só você e seus amigos online.
// max: letras por mensagem; entre: segundos entre duas mensagens; historico: quantas o servidor guarda para quem acabou de entrar.
// pm (André 2026-11-06: "tipo um pm, private msg pra cada amigo"): conversa só entre você e um amigo; historicoPm = quantas
// mensagens privadas o servidor guarda (de todo mundo junto) para quem acabou de entrar.
export const CHAT = { max: 120, entre: 1.2, historico: 40, historicoPm: 300, canais: ['geral', 'amigos', 'pm'] };
export const TIME = { max: 5, convite: 30, entreConvites: 3, perto: 40, combate: 10, bonus: 0.1, envio: 0.5 }; // pessoas, s, s, metros, s, fração, s
// Drops: cada herói que ganhou XP com o monstro tira a sua sorte (vai direto para a mochila dele).
// ouro [mín, máx]; pocao/mana/equip/tomo = chance; raridade = chance de cada raridade da peça (Comum..Mítico)
// mat: materiais para o alfaiate { item: [chance, quantos] }
// André 2026-11-06 (remoção aprovada: "só devia dropar armadura comum e rara; épico, lendário e mítico só craftando"):
// monstro só solta peça Comum ou Rara. Épico, Lendário e Mítico saem só da criação (RARIDADE_CRIAR).
const DROP_COMUM = { ouro: [3, 7], pocao: 0.12, mana: 0.1, equip: 0.1, tomo: 0.01, raridade: [0.85, 0.15, 0, 0, 0] };
export const DROPS = {
  // fragmento: material do passe da caverna (2026-11-06), cai de todos os monstros de caça
  puglin: { ...DROP_COMUM, mat: { couro: [0.45, 1], fragmento: [0.08, 1], carne: [0.3, 1] } }, lobo: { ...DROP_COMUM, ouro: [3, 8], mat: { couro: [0.6, 1], fragmento: [0.08, 1], carne: [0.5, 1] } }, imp: { ...DROP_COMUM, ouro: [4, 9], mat: { tecido: [0.45, 1], fragmento: [0.08, 1] } }, sombrio: DROP_COMUM,
  lider: { ouro: [12, 20], pocao: 0.3, mana: 0.25, equip: 0.35, tomo: 0.08, raridade: [0.6, 0.4, 0, 0, 0] },
  chefe: { ouro: [35, 55], pocao: 0.5, mana: 0.4, equip: 1, tomo: 0.3, raridade: [0, 1, 0, 0, 0], mat: { couro: [1, 3], tecido: [1, 3], cristal: [0.5, 1], fragmento: [0.5, 1] } },
  golem: { ...DROP_COMUM, ouro: [5, 10], mat: { cristal: [0.25, 1], fragmento: [0.1, 1] } }, maw: { ...DROP_COMUM, ouro: [5, 11], mat: { couro: [0.6, 1], fragmento: [0.1, 1], carne: [0.4, 1] } },
  warrok: { ouro: [45, 70], pocao: 0.6, mana: 0.5, equip: 1, tomo: 0.35, raridade: [0, 1, 0, 0, 0], mat: { couro: [2, 3], tecido: [1, 3], cristal: [0.7, 2], fragmento: [1, 2] } },
};

// ---------- Dungeon: Caverna da Montanha (pedido do André 2026-11-06) ----------
// O túnel (forma, chão, teto, porta) fica em shared/caverna.js. Aqui o conteúdo:
// - passe: o Gaspar (NPC 'guardiao', na boca) faz um passe com estes materiais; cada entrada pelo selo gasta um passe.
//   Quem sai da caverna (volta para fora da boca), morre ou sai do jogo perde a entrada; para voltar, outro passe.
// - salas: os monstros de cada sala só NASCEM quando tem alguém lá dentro com passe chegando perto da sala (perto, em
//   metros pelo túnel). Ninguém dentro por "esvazia" s: somem todos (o servidor não gasta nada com caverna vazia).
//   Sala limpa com gente dentro: volta cheia depois de "volta" s. lado = metros para o lado do meio do túnel.
export const CAVERNA_DUNGEON = {
  npc: 'guardiao',
  passe: { fragmento: 5, couro: 2, tecido: 2 },
  perto: 4.5, // metros do Gaspar para fazer o passe
  portaPerto: 4, // metros (pelo túnel) antes do selo em que o botão de usar o passe aparece
  esvazia: 60, volta: 240, corpo: 6, avistar: 16,
  // André 2026-11-06: "se for para nível 20, tem que ser muito difícil para um nível 20 fazer sozinho; é para grupo".
  // Os monstros das salas têm vida, dano e XP vezes estes números (pensado para um time de 3 ou 4 do nível da sala).
  forte: { vida: 3, dano: 1.6, xp: 2 },
  // Só quem abre o selo paga o passe: quem é do mesmo time entra de graça enquanto alguém do time estiver lá dentro.
  passeDoTime: true,
  salas: [
    { id: 'sala1', nome: 'Galeria dos Golens', nivel: 18, monstros: [['golem', 23.5, -2.5], ['golem', 26.5, 2.5], ['golem', 30, -1], ['golem', 32.5, 3]] },
    { id: 'sala2', nome: 'Poço dos Maws', nivel: 20, monstros: [['maw', 42.5, 2.5], ['maw', 45.5, -3], ['golem', 48.5, 1.5], ['maw', 51.5, -1.5]] },
    { id: 'sala3', nome: 'Trono do Warrok', nivel: 22, monstros: [['warrok', 69.5, 0], ['golem', 65.5, -4], ['golem', 66, 4.2]] },
  ],
};
// onde cada monstro da sala fica (x, z, chão) no túnel de verdade
// os monstros das salas ganham v depois do espantalho (Simulacao.passoCaverna)
MAPA_CLAREIRA.dungeon = CAVERNA_DUNGEON;
for (const S of CAVERNA_DUNGEON.salas) S.pontos = S.monstros.map(([tipo, s, lado]) => { const p = pontoDoTunel(s, lado); return { tipo, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(3), s }; });

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
// Dia e noite (igual ao Quimera, André 2026-11-07): 1 hora do jogo = horaSeg s (o dia inteiro em 12 min). Escurece das
// 18h30 às 20h30 e clareia das 4h30 às 6h30; é "noite" (dá para dormir) das 19h às 5h. Cada conta tem o seu relógio
// (prog.dia = { h, t }: hora h no instante t, em ms); conta que nunca dormiu segue o relógio do mundo (comeco às 0 ms).
export const DIA = { horaSeg: 30, comeco: 8, noite: 19, manha: 5, escurece: [18.5, 20.5], clareia: [4.5, 6.5], acorda: 6.5 };
// Dormir na cama do seu terreno (Quimera): só à noite e sem monstro a menos de "perigo" m. Pula até as 6h30 com vida,
// mana e estamina cheias; o vigor ganha "vigor" uma vez a cada "cada" s (se ainda não deu, avisa quando volta).
export const CAMA = { vigor: 40, cada: 6 * 3600, perigo: 14 };
// Profissões (as do Quimera que cabem no mapa de agora; Pescador e Fazendeiro chegam com água e horta).
// Trabalhar gasta vigor e dá pontos na profissão: Nv = raiz(pontos / 8) + 1, até 20. Rank sobe a cada 2 níveis
// (19 e 20 têm rank próprio): rank maior gasta menos vigor (-4% por rank), trabalha mais rápido (+3,5%), dá chance
// de +1 na coleta (+2%) e, na criação, chance de a peça sair numa raridade melhor.
export const PROFISSOES = {
  min: { nome: 'Minerador', grupo: 'Coleta', desc: 'Minerar veios de ferro, cobre e cristal' },
  len: { nome: 'Lenhador', grupo: 'Coleta', desc: 'Cortar lenha das árvores' },
  fer: { nome: 'Ferreiro', grupo: 'Criação', desc: 'Barras, espadas, cajados e colares na forja do Tomás' },
  alf: { nome: 'Alfaiate', grupo: 'Criação', desc: 'Calças, shorts, capas, botas e óculos na banca da Rosa' },
  coz: { nome: 'Cozinheiro', grupo: 'Criação', desc: 'Pratos de comida no fogão do seu terreno' },
  pes: { nome: 'Pescador', grupo: 'Coleta', desc: 'Pescar nos lagos (vara de pescar)' }, // André 2026-11-08: pescaria igual à do Quimera
  mer: { nome: 'Mercador', grupo: 'Comércio', desc: 'Negociar com a Rosa: vende mais caro e compra mais barato' },
};
export const RANKS = ['Novato', 'Veterano', 'Especialista', 'Mestre', 'Autoridade', 'Campeão', 'Adepto', 'Arauto', 'Virtuoso', 'Celebridade', 'Famoso'];
export const PROF_MAX = 20;
// Mercador: no Nv 20 a Rosa paga +25% e cobra -15% (sobe aos poucos desde o Nv 1). Ganha 1 ponto a cada "pontoOuro" de ouro negociado.
export const MERCADOR = { venda: 0.25, compra: 0.15, pontoOuro: 10 };
// Veios (Minerador) e árvores (Lenhador): cada batida leva "tempo" s, gasta "vigor" e dá os itens de "da"
// (raro = chance de um item a mais). Cada veio aguenta "cargas" batidas e volta em "volta" s. Árvores e veios das
// zonas de mineração são de todos (André 2026-11-04): a árvore cai e some (fica o toco), a pedra vira cascalho, e voltam no tempo.
// A coleta continua sozinha enquanto houver carga e vigor; mexer o joystick, pular, bater ou apanhar para.
// Do chão saem 3 minérios brutos (cobre, ferro e, mais tarde, mitril) e o cristal; o resto é mistura na forja
// (aço = ferro + carvão). nivel = nível de Minerador para conseguir minerar.
export const COLETA = {
  ferro: { nome: 'Veio de ferro', prof: 'min', nivel: 5, vigor: 2, tempo: 2.4, cargas: 3, volta: 90, da: { minerio_ferro: 1 }, raro: { cristal: 0.05, pedra: 0.5 } },
  pedra: { nome: 'Veio de pedra', prof: 'min', vigor: 1, tempo: 2.0, cargas: 4, volta: 90, da: { pedra: 2 }, raro: { pedra: 0.5, minerio_cobre: 0.03 } },
  cobre: { nome: 'Veio de cobre', prof: 'min', vigor: 1.5, tempo: 2.2, cargas: 3, volta: 90, da: { minerio_cobre: 1 }, raro: { cristal: 0.04, pedra: 0.5 } },
  cristal: { nome: 'Veio de cristal', prof: 'min', nivel: 8, vigor: 3, tempo: 2.8, cargas: 2, volta: 150, da: { cristal: 1 }, raro: { cristal: 0.1, pedra: 0.4 } },
  arvore: { nome: 'Árvore', esgotado: 'esgotada', prof: 'len', vigor: 1, tempo: 2.0, cargas: 3, volta: 60, da: { lenha: 1 }, raro: { lenha: 0.25 } },
};
export const COLETA_DISTANCIA = 2.4; // metros da borda do veio ou do tronco
// Onde ficam os veios (fora da vila e longe do acampamento dos monstros). As árvores do mapa todas dão lenha.
// Dentro da vila não tem mais veio (pedido do André 2026-11-02): o cobre fica na zona de mineração lá fora (MINA).
// 2026-11-05: pedra e ferro ganharam zona também; o cristal fica para depois (COLETA continua sabendo minerá-lo).
// mina = id da zona (o minério é de todos e volta no tempo da zona); sorteio fixo, igual no servidor e no Godot.
export const veiosDaZona = (z) => {
  let sem = 777; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const lista = [];
  for (let t = 0; lista.length < z.veios && t < 500; t++) {
    const k = TAMANHO_VEIO[z.tipo] ?? 1; // pedra maior pede mais espaço entre uma e outra
    const a = rnd(0, 6.283), r = Math.sqrt(rnd(0, 1)) * (z.r - 0.9 * k), x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r;
    if (lista.some((o) => Math.hypot(o.x - x, o.z - zz) < 2.3 * k)) continue;
    lista.push({ tipo: z.tipo, x: +x.toFixed(2), z: +zz.toFixed(2), ry: +rnd(0, 6.28).toFixed(2), mina: z.id });
  }
  return lista;
};
export const VEIOS = MINA.flatMap(veiosDaZona);
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
  // Cozinheiro no fogão (2026-11-07): carne dos bichos e o que sai da horta
  carne_assada: { prof: 'coz', faz: 'carne_assada', usa: { carne: 1, lenha: 1 }, vigor: 2, nivel: 1 },
  sopa_legumes: { prof: 'coz', faz: 'sopa_legumes', usa: { cenoura: 1, batata: 1, rabanete: 1 }, vigor: 3, nivel: 1 },
  pao_milho: { prof: 'coz', faz: 'pao_milho', usa: { milho: 2, lenha: 1 }, vigor: 3, nivel: 2 },
  ensopado: { prof: 'coz', faz: 'ensopado', usa: { carne: 2, batata: 1, tomate: 1 }, vigor: 4, nivel: 3 },
  torta_abobora: { prof: 'coz', faz: 'torta_abobora', usa: { abobora: 1, milho: 1 }, vigor: 5, nivel: 5 },
  peixe_assado: { prof: 'coz', faz: 'peixe_assado', usa: { lambari: 2 }, vigor: 2, nivel: 1 }, // Quimera: 2 lambaris no forno
};
// receita de item que não existe (ex.: o manto, que virou peitoral) some sozinha
for (const k of Object.keys(RECEITAS)) if (!ITENS[RECEITAS[k].faz]) delete RECEITAS[k];
// Fogão a lenha que cozinha sozinho (André 2026-11-07: "que nem a fornalha: coloco o combustível e os itens lá e posso
// sair"): mesmo fogo da fornalha (lenha 12 s, carvão 30 s); você escolhe o prato e quantos, os ingredientes saem da
// mochila para a panela e cada prato leva dur segundos de fogo. O pronto espera na saída; pontos de Cozinheiro e XP
// quando você pega (como a fornalha). Os pratos na hora pela aba Criar continuam iguais.
// receitas[prato] = { faz, usa: 1 (cada um na panela vira um prato), dur, nivel, vigor, ing: ingredientes de um prato }
export const FOGAO = {
  combustivel: { lenha: 12, carvao: 30 },
  tempo: { carne_assada: 10, sopa_legumes: 15, pao_milho: 15, ensopado: 20, torta_abobora: 25, peixe_assado: 10 },
  receitas: {},
};
for (const [k, R] of Object.entries(RECEITAS)) if (R.prof === 'coz') FOGAO.receitas[R.faz] = { faz: R.faz, receita: k, usa: 1, dur: FOGAO.tempo[R.faz] || 15, nivel: R.nivel, vigor: R.vigor, ing: R.usa };
// Onde cada profissão de criação trabalha: perto do NPC dessa função (metros)
export const OFICINA = { fer: { npc: 'ferreiro', onde: 'na forja do Tomás' }, alf: { npc: 'comerciante', onde: 'na banca da Rosa' }, coz: { npc: '', onde: 'no seu fogão' } };
export const OFICINA_DISTANCIA = 4.5;
// chance de subir cada raridade e até qual (André 2026-11-06: era até 2 = Épico; agora até 4 = Mítico, que só sai criando).
// Cada degrau é um sorteio: no Nv 20 da profissão, Épico 9%, Lendário 2,7%, Mítico 0,8%.
export const RARIDADE_CRIAR = { base: 0.06, max: 0.3, ate: 4 };
// Catalisador (André 2026-11-07, como no Quimera): destruir uma peça da mochila dá catalisador; com ele a peça sobe
// um degrau de raridade (Comum > Raro > Épico > Lendário > Mítico). Um tipo para arma (espada, cajado: Runa) e outro
// para armadura (o resto, colar junto: Selo). arma[r - 1] / armadura[r - 1] = o catalisador que leva a peça para a raridade r.
// Só sai destruindo equipamento (André: não cai de monstro).
// destruir: Comum dá `comum`; da Rara em diante dá o catalisador da raridade de baixo (Rara e Épica dão o Raro),
//   em quantidade sorteada (`quantos`: até 8% nada, até 90% 1, até 98% 2, senão 3), e ainda `extra[r]` de chance de
//   vir 1 da própria raridade. Cada peça leva `tempoDestruir` s de barrinha; "Destruir todas" só faz os cliques.
// evoluir: peça da mochila + 1 catalisador + `usa` (por raridade de destino, arma ou armadura), perto de onde se cria
//   a peça (Ferreiro: forja do Tomás ou bigorna; Alfaiate: banca da Rosa ou bancada). Gasta `vigor`. Pode falhar
//   (`falha[r]`, cai pela metade no Nv máximo da profissão: perde o catalisador e o material, a peça fica) ou, com
//   `sorte` (de 2% a 6% com a profissão), pular uma raridade. A peça nova sai +0, inteira e com o cadeado se tinha.
export const CATALISADOR = {
  arma: ['runa_rara', 'runa_epica', 'runa_lendaria', 'runa_mitica'],
  armadura: ['selo_raro', 'selo_epico', 'selo_lendario', 'selo_mitico'],
  comum: 'barra_cobre',
  quantos: [0.08, 0.9, 0.98],
  extra: [0, 0, 0.25, 0.2, 0.15],
  tempoDestruir: 1.5,
  usa: {
    arma: [{ lenha: 4, barra_cobre: 3 }, { lenha: 6, barra_ferro: 4 }, { lenha: 8, cristal: 5 }, { lenha: 10, cristal: 6, barra_aco: 2 }],
    armadura: [{ couro: 4, barra_cobre: 3 }, { couro: 6, barra_ferro: 4 }, { couro: 8, cristal: 5 }, { couro: 10, cristal: 6, barra_aco: 2 }],
  },
  falha: [0, 0.1, 0.15, 0.2, 0.25],
  sorte: [0.02, 0.06],
  vigor: 8,
  tempoEvoluir: 3,
  // Alquimista (André 2026-11-09): a Mirela, na casa do lado leste da praça, junta `n` catalisadores de uma raridade
  // com `ouro` e faz 1 da raridade de cima, do mesmo tipo (Selo com Selo, Runa com Runa). sintese[r] = o que custa
  // fazer um catalisador da raridade r. Só até Lendário (`ate`, André: "só até lendário"); Mítico ela nunca faz.
  // Sem barrinha e sem falha. n por clique: 1 ou o máximo que dá (`lote`).
  // André 2026-11-09: 4 + 800/3000 estava fácil (no Nv 30 ele tinha uns 40 mil): "o preço e a qtd de catalizador tb".
  sintese: { npc: 'alquimista', perto: 4.5, ate: 3, lote: 20, custo: [null, null, { n: 10, ouro: 8000 }, { n: 10, ouro: 30000 }] },
};
{
  const NOME_R = ['', 'Raro', 'Épico', 'Lendário', 'Mítico'], NOME_A = ['', 'Rara', 'Épica', 'Lendária', 'Mítica'];
  const VENDA = [0, 15, 40, 120, 350];
  CATALISADOR.armadura.forEach((k, j) => { ITENS[k] = { nome: `Selo ${NOME_R[j + 1]}`, mat: true, pilha: 99, venda: VENDA[j + 1], catalisador: 'armadura', cr: j + 1,
    desc: `Catalisador de armadura: evolui capacete, camisa, calça, short, botas, capa ou colar ${j ? NOME_R[j] : 'Comum'} para ${NOME_R[j + 1]}. Sai destruindo equipamento.` }; });
  CATALISADOR.arma.forEach((k, j) => { ITENS[k] = { nome: `Runa ${NOME_A[j + 1]}`, mat: true, pilha: 99, venda: VENDA[j + 1], catalisador: 'arma', cr: j + 1,
    desc: `Catalisador de arma: evolui espada ou cajado ${j ? NOME_R[j] : 'Comum'} para ${NOME_R[j + 1]}. Sai destruindo equipamento.` }; });
}
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
// peças da construção viram itens (criar primeiro, colocar depois; desmontar devolve) e as ferramentas da fazenda
for (const [k, C] of Object.entries(CONSTRUCOES)) {
  ITENS['obra_' + k] = { nome: C.nome, pilha: 20, venda: 1, obra: k,
    desc: `${C.desc} Coloque no seu terreno pelo modo construção (martelo).` };
}
ITENS.enxada = { nome: 'Enxada', pilha: 1, venda: 2, ferramenta: 'arar', desc: 'Prepara a terra para plantar (modo construção, aba Fazenda).' };
ITENS.picareta = { nome: 'Picareta de pedra', pilha: 1, venda: 2, ferramenta: 'minerar', desc: 'Precisa dela para minerar os veios. Crie na mochila (Criar > Ferramentas), sem bancada.' };
ITENS.machado = { nome: 'Machado de pedra', pilha: 1, venda: 2, ferramenta: 'cortar', desc: 'Precisa dele para cortar árvores. Crie na mochila (Criar > Ferramentas), sem bancada.' };
// minerar pede a picareta e cortar pede o machado (o galho e a pedra soltos no chão saem com a mão)
for (const C of Object.values(COLETA)) C.ferramenta = C.prof === 'min' ? 'picareta' : 'machado';
ITENS.regador = { nome: 'Regador', pilha: 1, venda: 3, ferramenta: 'regar', desc: 'Rega as plantas (modo construção, aba Fazenda). Cada rega vale por 1 dia. Cheio dá 20 regas: encha no poço da vila ou na beira de um lago.' };
ITENS.radar_pesca = { nome: 'Radar de pesca', pilha: 1, venda: 10, ferramenta: 'radar', usar: { radar: true }, desc: 'Use na mochila: mostra no mapa todos os spots de pesca por 3 minutos. Não gasta.' };
ITENS.vara = { nome: 'Vara de pescar', pilha: 1, venda: 8, ferramenta: 'pescar', desc: 'Chegue na beira de um spot de pesca (a água borbulhando) e toque no botão de pescar. Quando a boia afundar, toque de novo rapidinho! Aguenta 150 peixes.' };
// ---------- pescaria (igual ao Quimera, André 2026-11-08) ----------
// No Quimera não tem lugar fixo (qualquer água; o tipo da água escolhe o peixe). Aqui o André pediu spots marcados (spots,
// lá embaixo): a boia cai de 2,2 a 4,4 m da beira e precisa cair dentro de um spot; o spot escolhe o peixe.
// tier: 0 e 1 vêm direto; 2 em diante brigam (toque rápido até encher a barra); 3 "Que peixão!", 4 LENDÁRIO.
// peso [min, max] kg, sai quase sempre puxando para o menor (sorteio^1.6). vigor: o que custa cada peixe (antes do Pescador).
// Tempos do Quimera: lança em 0,6 s, espera 2,5 a 7,5 s / 1,5, janela do "!" 0,95 s (0,75 no tier 3+). Briga: começa em 0,3,
// cada toque soma max(0,06; 0,13 - 0,018 x tier), cai 0,1 + 0,045 x tier por segundo, 8 s no máximo.
// folga: o celular está longe do servidor (ping), então a janela do "!" ganha esse tanto a mais no servidor.
export const PESCA = {
  tier: { lambari: 0, sardinha: 0, tilapia: 1, robalo: 1, traira: 2, garoupa: 2, atum: 3, dourado: 4 },
  peso: { lambari: [0.05, 0.18], sardinha: [0.06, 0.2], tilapia: [0.4, 1.6], robalo: [1.2, 5], traira: [0.8, 3.2], garoupa: [4, 18], atum: [20, 90], dourado: [3, 9] },
  vigor: { lambari: 0.5, sardinha: 0.5, tilapia: 1, robalo: 1, traira: 2, garoupa: 2, atum: 4, dourado: 6 },
  cor: { lambari: ['#b8c4cc', '#7a8a96'], tilapia: ['#8a9a7a', '#5a6a4a'], traira: ['#6a5a3a', '#3a2a1a'], sardinha: ['#a8c8e0', '#5a7a9a'], robalo: ['#c8d0d8', '#4a5a6a'], garoupa: ['#b06a4a', '#6a3a2a'], atum: ['#4a6a9a', '#c8d8e8'], dourado: ['#ffd040', '#c08010'] },
  vigorLancar: 0.5, // precisa ter isso de vigor para lançar
  distancias: [4, 3.4, 2.8, 2.2], // onde a boia cai (m do herói), na frente; depois procura dos lados
  lancar: 0.6, espera: [2.5, 7.5], esperaK: 1 / 1.5, janela: 0.95, janelaRaro: 0.75, folga: 0.3,
  briga: { comeco: 0.3, toque: 0.13, toqueTier: 0.018, toqueMin: 0.06, cai: 0.1, caiTier: 0.045, max: 8, toquesSeg: 14 },
  durabilidade: 150, // peixes que a vara aguenta
  dobro: 0.02, // por rank de Pescador: chance de vir mais um
  // Spots marcados (André 2026-11-08, mudou do Quimera): só se pesca dentro de um spot (a água borbulhando). O spot
  // dura "vida" s e some; "volta" s depois nasce outro no mesmo lago (em outro lugar). por = quantos ao mesmo tempo em
  // cada água (lago com pesca: true ganha "grande"). peixes[agua] = o que sai do spot nessa água. Comum: lagos, rios e
  // mar (toda hora); raro e épico: só no mar (menos e bem menos). Lambari, tilápia e traíra são só de água doce.
  raioSpot: 5, // André 2026-11-08: uns 10 m de largura
  spots: {
    comum: { nome: 'Spot comum', cor: '#7fd0ff', vida: [240, 480], volta: [5, 25], por: { doce: 1, mar: 2 }, grande: 3,
      peixes: { doce: [['lambari', 55], ['tilapia', 30], ['traira', 14]], mar: [['sardinha', 60], ['robalo', 40]] } },
    raro: { nome: 'Spot raro', cor: '#5f8cff', vida: [180, 300], volta: [180, 420], por: { mar: 1 },
      peixes: { mar: [['sardinha', 42], ['robalo', 32], ['garoupa', 17], ['atum', 9]] } },
    epico: { nome: 'Spot épico', cor: '#c070ff', vida: [120, 240], volta: [900, 1800], por: { mar: 1 },
      peixes: { mar: [['garoupa', 40], ['atum', 45], ['dourado', 15]] } },
  },
  // Radar de pesca: usado na mochila, mostra todos os spots no mapa e no minimapa por "mostra" s; recarga "recarga" s
  radar: { mostra: 180, recarga: 60 },
};
// pedra e lenha também na Rosa, para quem quer construir sem minerar tudo (no Quimera a pedra sai das rochas do mapa)
LOJA.push({ k: 'lenha', preco: 3 }, { k: 'pedra', preco: 4 });
// Botão "Organizar" da mochila e do baú (André 2026-11-07): junta as pilhas pela metade e põe em ordem de tipo (esta
// lista), depois raridade (a melhor primeiro), reforço e nome. Equipamento segue a ordem dos lugares do corpo (LUGARES).
export const ORGANIZAR = ['equip', 'consumivel', 'tomo', 'ferramenta', 'obra', 'semente', 'material', 'outro'];

// Mato e pedras soltas da mata (pedido do André 2026-11-03, junto com os marcos do CENARIO): sorteio fixo em volta das
// árvores (cogumelo no pé, orelha-de-pau no tronco, arbusto e samambaia entre elas) e pedras na beira da estrada.
// O Godot desenha em MultiMesh por pedaços (godot-prototipo/cenario.gd); só as pedras maiores são sólidas.
function sortearEnfeites(arvores) {
  let sem = 9157; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const lista = [], solidos = [], r2 = (n) => +n.toFixed(2);
  const longeDoCaminho = (x, z, d) => !naTerras(x, z, 1) && Math.hypot(x, z) > 35 && pertoDaLinha(ESTRADA, x, z).d > d && TRILHAS.every((L) => pertoDaLinha(L, x, z).d > d - 1.5)
    && CLAREIRAS.every((c) => Math.hypot(x - c.x, z - c.z) > CLAREIRA_R + 0.5) && cenario().marcos.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + 0.5);
  for (const a of arvores) {
    const sorte = rnd(0, 1), ang = rnd(0, 6.283), sa = Math.cos(ang), ca = Math.sin(ang);
    if (sorte < 0.09) { // tufo de 3 a 6 cogumelos no pé da árvore, juntinhos (direção de arte 2026-11-04: em tufos, não soltos)
      for (let k = 0, n = 3 + Math.floor(rnd(0, 3.999)); k < n; k++) {
        const d = 0.32 * a.s + rnd(0.2, 0.75), b = ang + rnd(-0.55, 0.55);
        lista.push({ m: 'cogumelo', x: r2(a.x + Math.cos(b) * d), z: r2(a.z + Math.sin(b) * d), ry: r2(rnd(0, 6.28)), s: r2(k === 0 ? rnd(1.0, 1.3) : rnd(0.45, 0.95)) });
      }
    } else if (sorte < 0.13) { // orelha-de-pau grudada no tronco, virada para fora
      const d = 0.32 * a.s * 0.75;
      lista.push({ m: 'orelha_de_pau', x: r2(a.x + sa * d), z: r2(a.z + ca * d), y: r2(rnd(0.3, 0.9)), ry: r2(Math.atan2(sa, ca)), s: r2(rnd(0.4, 0.6)) });
    }
    const outra = rnd(0, 1), d = rnd(1.6, 2.8), x = a.x + Math.cos(ang + 2) * d, z = a.z + Math.sin(ang + 2) * d;
    if (!longeDoCaminho(x, z, 3.2)) continue;
    if (outra < 0.13) lista.push({ m: outra < 0.035 ? 'arbusto_flor' : 'arbusto', x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)), s: r2(rnd(0.6, 1.0)) });
    else if (outra < 0.21) { // tufo de 3 a 5 samambaias encostado no tronco
      for (let k = 0, n = 3 + Math.floor(rnd(0, 2.999)); k < n; k++) {
        const b = ang + 2 + rnd(-0.7, 0.7), dd = 0.32 * a.s + rnd(0.5, 1.6);
        lista.push({ m: 'samambaia', x: r2(a.x + Math.cos(b) * dd), z: r2(a.z + Math.sin(b) * dd), ry: r2(rnd(0, 6.28)), s: r2(rnd(0.45, 0.8)) });
      }
    }
    else if (outra < 0.26) lista.push({ m: 'planta', x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)), s: r2(rnd(0.9, 1.4)) });
    else if (outra < 0.29) {
      const s = r2(rnd(0.22, 0.5)), m = ['rocha1', 'rocha2', 'rocha3'][Math.floor(rnd(0, 2.999))];
      lista.push({ m, x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)), s });
      if (s >= 0.38) solidos.push({ x: r2(x), z: r2(z), r: r2(1.2 * s), alto: r2(1.9 * s) });
      for (let k = 0, n = 3 + Math.floor(rnd(0, 2.999)); k < n; k++) { // cogumelos e samambaias encostados na pedra
        const b = rnd(0, 6.28), dd = 1.5 * s + rnd(0.1, 0.5);
        lista.push({ m: k % 2 ? 'samambaia' : 'cogumelo', x: r2(x + Math.cos(b) * dd), z: r2(z + Math.sin(b) * dd), ry: r2(rnd(0, 6.28)), s: r2(k % 2 ? rnd(0.4, 0.6) : rnd(0.5, 0.9)) });
      }
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
  const c = cenario(), e = sortearEnfeites(ARVORES_MATA); // a lista toda: o mato do resto da mata fica igual
  const fora = (o) => !naMina(o.x, o.z) && !noRelevo(o.x, o.z, 0.8);
  // pedras da beira dos lagos (pequenas, sem colisão; os juncos e as taboas o Godot desenha, relevo.gd) vêm no fim
  const pedrasLago = beiraDosLagos().filter((b) => b.tipo === 'pedra').map((b, i) => ({ m: ['rocha1', 'rocha2', 'rocha3'][i % 3], x: b.x, z: b.z, ry: b.ry, s: b.s, y: b.y ?? -0.06 }));
  MAPA_CLAREIRA.cenario = { marcos: c.marcos, pecas: c.pecas, enfeites: e.lista.filter(fora).concat(pedrasLago), solidos: [...c.solidos, ...e.solidos.filter(fora)] };
}

// ---------- pedras e galhos soltos no chão (André 2026-11-07) ----------
// Picareta e machado de pedra viraram obrigatórios para minerar e cortar (FERRAMENTAS_FAZENDA). Para o começo não
// travar (sem picareta não sai pedra), ficam pedras e galhos soltos no chão: muitos na vila de início e alguns na
// beira da estrada e das trilhas. Pega com a mão (botão Coletar, na hora, sem vigor nem ferramenta), cada um dá 1 e
// volta em COLETA.galho.volta s só para quem pegou. Dá menos que minerar ou cortar, para não valer a pena no fim do jogo.
// Sorteio fixo (servidor e Godot veem os mesmos): s0, s1... ferramentas/testes/soltos.mjs confere se cada um está no chão livre.
export const SOLTOS = (() => {
  let sem = 4243; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const M = MAPA_CLAREIRA, lista = [], r2 = (n) => +n.toFixed(2);
  const longe = (l, x, z, d) => l.every((o) => Math.hypot(x - o.x, z - o.z) > d(o));
  const livre = (x, z) => dentroDoMapa(M, x, z, 2) && !noRelevo(x, z, 1.5) && !naMina(x, z, 1) && !naTerras(x, z, 2)
    && Math.hypot(x - PRACA.x, z - PRACA.z) > PRACA.r + 1.5
    && CLAREIRAS.every((c) => Math.hypot(x - c.x, z - c.z) > CLAREIRA_R + 4)
    && ((x - FORA.x) / (FORA.rx + 3)) ** 2 + ((z - FORA.z) / (FORA.rz + 3)) ** 2 > 1 // o campo dos lobos fica limpo
    && longe(M.vila.casas, x, z, (c) => Math.hypot(c.w, c.d) / 2 + 1.2) && longe(M.npcs, x, z, () => 2.5)
    && longe([...M.obstaculos, ...M.props, ...M.escadas, ...M.treino], x, z, (o) => (o.r || 0.6) + 1.2)
    && longe(M.rochas, x, z, (r) => 1.9 * r.s + 1) && longe(M.vila.arvores, x, z, (a) => 0.32 * a.s + 1)
    && longe(M.mata, x, z, (a) => 0.32 * a.s + 0.9) && longe(M.cenario.solidos, x, z, (o) => o.r + 0.8)
    && longe(M.cenario.marcos, x, z, (o) => o.r + 0.5) && longe(M.veios, x, z, () => 3) && longe(lista, x, z, () => 4);
  const por = (tipo, x, z) => { if (!livre(x, z)) return false; lista.push({ tipo, x: r2(x), z: r2(z), ry: r2(rnd(0, 6.28)) }); return true; };
  // vila: 8 galhos e 8 pedras entre as casas (dá para a picareta, o machado e a enxada)
  for (const tipo of ['galho', 'pedrinha']) for (let n = 0, t = 0; n < 8 && t < 400; t++) {
    const a = rnd(0, 6.283), d = rnd(7, 31);
    if (por(tipo, Math.cos(a) * d, Math.sin(a) * d)) n++;
  }
  // mapa: na beira da estrada e das trilhas das clareiras, de 2,5 a 4,5 m do caminho (quem anda acha)
  const beira = (L, n) => {
    for (let k = 0, t = 0; k < n && t < 200; t++) {
      const i = Math.floor(rnd(0, L.length - 1.001)), f = rnd(0, 1), [ax, az] = L[i], [bx, bz] = L[i + 1];
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1, lado = rnd(0, 1) < 0.5 ? -1 : 1, off = rnd(2.5, 4.5) * lado;
      if (por(rnd(0, 1) < 0.5 ? 'galho' : 'pedrinha', ax + dx * f - (dz / len) * off, az + dz * f + (dx / len) * off)) k++;
    }
  };
  beira(ESTRADA, 16);
  for (const L of TRILHAS) beira(L, 1);
  return lista;
})();
MAPA_CLAREIRA.soltos = SOLTOS;
COLETA.galho = { nome: 'Galho no chão', mao: true, prof: 'len', vigor: 0, tempo: 0, cargas: 1, volta: 300, da: { lenha: 1 } };
COLETA.pedrinha = { nome: 'Pedra solta', mao: true, prof: 'min', vigor: 0, tempo: 0, cargas: 1, volta: 300, da: { pedra: 1 } };

// ======================================================================================================================
// FASE 1 (André 2026-11-08/09): packs e transportes, cópia do Quimera (mesma conta, mesma capacidade, mesmos upgrades).
// Pack: o mercador faz o pack com o material dele (gasta vigor) e você leva para OUTRO mercador: quanto mais longe e
// mais forte a área, mais paga. Nas costas: anda mais devagar, não corre, não monta, não teleporta (nem Voltar para a
// vila) e, se morrer, o pack cai no chão. Carrinho, barquinho e navio levam mais.
// Material: os mesmos números do Quimera, com o material equivalente do Aethra (gel = tecido, osso = carne, frutinha =
// rabanete, pão = pão de milho, presa = fragmento, obsidiana = cristal, barra de obsidiana = barra de aço; peixe do mar
// = peixe de lago enquanto o mar não existe, FASE 3). Quem ajusta o visual depois é o André.
export const PACKS = {
  lenha: { nome: 'Pack de Lenha Nobre', custo: { lenha: 20 }, base: 45, cor: '#a0703a' },
  pedra: { nome: 'Pack de Pedra Lapidada', custo: { pedra: 18, cristal: 1 }, base: 60, cor: '#a8a29a' },
  horta: { nome: 'Pack de Temperos da Horta', custo: { rabanete: 4, cenoura: 4, tomate: 3 }, base: 85, cor: '#e8742a' },
  conserva: { nome: 'Pack de Conservas', custo: { batata: 5, milho: 4, tecido: 2 }, base: 100, cor: '#c9a46a' },
  abobora: { nome: 'Pack de Doce de Abóbora', custo: { abobora: 2, rabanete: 6, pao_milho: 2 }, base: 130, cor: '#ff9a2a' },
  couro: { nome: 'Pack de Couro Curtido', custo: { couro: 8, carne: 2 }, base: 80, cor: '#8a5a34' },
  metal: { nome: 'Pack de Barras de Metal', custo: { barra_ferro: 3, barra_cobre: 3 }, base: 140, cor: '#9aa3ad' },
  peixe: { nome: 'Pack de Peixe Salgado', custo: { lambari: 4, tilapia: 2, pedra: 3 }, base: 95, cor: '#7ab8e0' },
  perola: { nome: 'Pack de Pérolas', custo: { traira: 3, cristal: 2, tecido: 3 }, base: 150, cor: '#e8e4f4' },
  ervas: { nome: 'Pack de Ervas do Pântano', custo: { rabanete: 8, tecido: 4, fragmento: 2 }, base: 160, cor: '#6a9a3a' },
  obsid: { nome: 'Pack de Obsidiana', custo: { pedra: 25, cristal: 3, barra_ferro: 2 }, base: 190, cor: '#3a3040' },
  brasa: { nome: 'Pack de Brasa Viva', custo: { cristal: 4, carvao: 6, barra_aco: 1 }, base: 220, cor: '#d0461c' },
};
// Conta do preço (Quimera UK/VK): preco = base x dist x 1,4 x Mercador x área x 1,2 x mercado cheio.
// dist: até 462 m = 0,3 + d/140 (entre 0,3 e 3,6); depois sobe devagar até 6 (3,6 + (d - 462)/500).
// perto: pack feito a menos disso do mercador não vende ali. area: o fator da área mais forte entre a de onde saiu e a
// de entrega (pelo nível dos campos de caça em volta: niveis[i] ou mais vale areas[i]; Quimera: 1 / 1,8 / 2,9 / 4,3 / 5,9).
// mercado: cada entrega do mesmo pack no mesmo mercador conta 1 (some 1 a cada "volta" s); depois de "livres", cai
// "cai" por entrega, no mínimo "minimo". mercador: Nv 20 de Mercador = -15% de material e +25% no preço.
// vigor: o que custa fazer um pack. navio: entrega que atravessou o mar no porão do navio (regra do André: a troca mais
// cara do jogo) vale "navio" vezes mais; conta se o navio andou ao menos "navioMin" m com o pack no porão.
export const PACK_REGRAS = {
  k: 1.4, extra: 1.2, perto: 40, vigor: 12,
  dist: { curto: 462, a: 0.3, porM: 1 / 140, maxCurto: 3.6, porMLongo: 1 / 500, max: 6 },
  areas: { niveis: [1, 10, 30, 50, 70], fator: [1, 1.8, 2.9, 4.3, 5.9], raio: 60 },
  mercado: { livres: 4, cai: 0.03, minimo: 0.5, volta: 360 },
  mercador: { material: 0.15, preco: 0.25 },
  navio: 1.5, navioMin: 30,
  costas: { vel: 0.68 }, // nas costas: velocidade x0,68 e sem corrida
  pegar: 2.5, // metros para pegar um pack do chão
  falar: 4, // metros do mercador para fazer ou entregar
};
// Veículos (Quimera): o carrinho anda a combustível na terra; o barquinho é a remo (leva só o pack das suas costas); o
// navio mercante leva 16 no porão e mais 1 nas costas. Ficam na mochila; "Colocar" põe no chão (carrinho) ou na água.
// Carrinho: vida 400, 2,8 m/s menos 0,05 por pack acima de 2, curva 2,4 rad/s, combustível: 1 galão = 160 m, tanque de
// 8 galões (André 2026-11-09: um lugar só de combustível que empilha até 8). Leva 2 packs no Nv 1 e +2 por melhoria (até Nv 4 = 8 packs). Apanhando dentro dele: o carrinho leva 110% do
// golpe e você 20%. Vida zero = quebra e os packs caem no chão. Não entra na água.
export const VEICULOS = {
  carrinho: { nome: 'Carrinho de carga', vida: 400, vel: 2.8, perdePorPack: 0.05, packsLivres: 2, giro: 2.4, acelera: 1.3, freia: 3.5,
    curvaFechada: 1.6, curvaK: 0.3, galao: 160, tanque: 8, capacidade: 2, nivelMax: 4,
    melhorar: [null, null, { lenha: 40, barra_ferro: 8, barra_cobre: 6, couro: 6, ouro: 2000 }, { lenha: 60, barra_ferro: 14, barra_cobre: 10, couro: 10, ouro: 8000 },
      { lenha: 100, barra_ferro: 24, barra_cobre: 16, couro: 16, ouro: 25000 }],
    golpe: 1.1, heroi: 0.2, consertoQuebrado: { lenha: 8, barra_ferro: 1 }, consertoParcial: { lenha: 4 }, perto: 3.5, entregar: 12, carregar: 8 },
  // 2026-11-09 (André: "o barco tá muito rápido"): 5,6 -> 3,2 m/s, gira mais devagar; acelera só com as pás na água
  // (acelera) e desliza parando de remar (deriva: quanto a água freia por segundo)
  barquinho: { nome: 'Barquinho', vel: 3.2, giro: 1.15, acelera: 0.8, deriva: 0.45, pessoas: 2, packs: 0, fundo: 0.35, perto: 3.5 },
  navio: { nome: 'Navio mercante', vel: 4, acelera: 0.9, giro: 0.7, porao: 16, fundo: 1.6, ancorar: 1.6, perto: 18, cabe: 4.5 },
};
// itens: galão de combustível (pilha) e os veículos (um de cada, na mochila)
ITENS.galao = { nome: 'Combustível', mat: true, pilha: 20, venda: 4, desc: 'Galão pro carrinho de carga. Cada um roda uns 160 m. Toque no carrinho pra abastecer.' };
ITENS.carrinho = { nome: 'Carrinho de carga', pilha: 1, venda: 60, ferramenta: 'carrinho', usar: { veiculo: 'carrinho' },
  desc: 'Carrinho a combustível. Leva 2 packs (melhore na bancada até 8), e você ainda leva 1 nas costas. Quebra se apanhar muito dos monstros, mas dá pra consertar. Use na mochila pra colocar no chão.' };
ITENS.barquinho = { nome: 'Barquinho', pilha: 1, venda: 40, ferramenta: 'barquinho', usar: { veiculo: 'barquinho' },
  desc: 'Barco de madeira pra 2 pessoas, a remo. Chegue na beira da água e use na mochila. Leva só o pack das suas costas.' };
ITENS.navio = { nome: 'Navio mercante', pilha: 1, venda: 4000, ferramenta: 'navio', usar: { veiculo: 'navio' },
  desc: 'Leva 16 packs no porão (mais 1 nas costas). Na beira de água funda, use na mochila pra pôr na água; você pilota e ancora em qualquer margem. Fazer custa 40.000 de ouro e precisa Nv 60.' };
// receitas (Quimera: na bancada). varios: dá para ter mais de um (o galão). nivel e ouro: o navio pede Nv 60 e 40.000.
FERRAMENTAS_FAZENDA.galao = { custo: { carvao: 2, tecido: 1 }, bancada: true, para: 'abastecer', varios: true };
FERRAMENTAS_FAZENDA.carrinho = { custo: { lenha: 30, barra_ferro: 6, barra_cobre: 4, couro: 4 }, bancada: true, para: 'carrinho' };
FERRAMENTAS_FAZENDA.barquinho = { custo: { lenha: 30, couro: 4 }, bancada: true, para: 'barquinho' };
FERRAMENTAS_FAZENDA.navio = { custo: { lenha: 400, barra_ferro: 40, barra_cobre: 30, couro: 40 }, bancada: true, para: 'navio', nivel: 60, ouro: 40000 };
// Mercadores de pack (FASE 1: poucos, só para testar a economia no mapa de hoje; a FASE 2 espalha de novo, mais longe).
// FASE 2 (André 2026-11-08: "reduzir a quantidade de mercadores... spots mais distantes para valorizar a viagem e o
// combustível"): 6 mercadores (o Quimera tinha 12), nos cantos do mapa: Pedrão no noroeste, Malaquias ao pé da montanha,
// Sálvia no sul do meio, Bráulio no sudeste (perto dos campos Nv 28-30, paga mais), Joca na vila e Nico no Lago Grande.
// Humanos com o corpo do herói e roupa medieval (CLAUDE.md). merch = o pack que ele faz; todos compram os packs dos outros.
export const MERCADORES_PACK = [
  { id: 'm_lenha', nome: 'Seu Joca', merch: 'lenha', x: 20, z: 10, ry: -1.6, visual: 'cabelo_m', veste: { tunica: 0x6b4a2e, faixa: 0x3a2616 }, tinta: { cabelo: 0x5a3a22, roupa: 0x6b4a2e, calca: 0x3a3028 } },
  { id: 'm_pedra', nome: 'Mestre Pedrão', merch: 'pedra', x: -40, z: -30, ry: -1.2, visual: 'cabelo_m', escala: 1.1, veste: { tunica: 0x8a8580, faixa: 0x4a4640 }, tinta: { cabelo: 0x3a3a3a, roupa: 0x7a756e, calca: 0x3a3630 } },
  { id: 'm_metal', nome: 'Malaquias', merch: 'metal', x: 104, z: -30, ry: 0.8, visual: 'cabelo_m', veste: { tunica: 0x5a6068, faixa: 0x2a2a2a }, tinta: { cabelo: 0x2a2420, roupa: 0x5a6068, calca: 0x2f2a24 } },
  { id: 'm_horta', nome: 'Dona Sálvia', merch: 'horta', x: 56, z: 126, ry: 2.6, visual: 'vivi', veste: { tunica: 0x5f8f3a, saia: 0x5f8f3a, ate: 'canela', faixa: 0xe8742a }, tinta: { cabelo: 0x6a4a2a, roupa: 0x6f9a44, calca: 0x4a3c2c } },
  { id: 'm_peixe', nome: 'Pescador Nico', merch: 'peixe', x: -14, z: 172, ry: 2.8, visual: 'cabelo_m', veste: { tunica: 0x3a5a7a, faixa: 0xd9d2c6 }, tinta: { cabelo: 0xd9d2c6, roupa: 0x3a5a7a, calca: 0x2f4a6a } },
  { id: 'm_couro', nome: 'Bráulio Curtidor', merch: 'couro', x: 206, z: 166, ry: -2.2, visual: 'cabelo_m', escala: 1.05, veste: { tunica: 0x8a5a34, faixa: 0x3a2616 }, tinta: { cabelo: 0x3a2616, roupa: 0x8a5a34, calca: 0x3a2a20 } },
];
// os mercadores de pack entram na lista de NPCs do mapa (depois do sorteio das árvores e dos soltos, para nada mudar de
// lugar; as posições acima foram conferidas longe de árvore, pedra, veio e solto)
MAPA_CLAREIRA.npcs.push(...MERCADORES_PACK.map((n) => ({ ...n, nome: `${n.nome}, mercador`, roupa: 'peitoral0,calca0,botas0', funcao: 'pack', acoes: ['pack'],
  falas: [`Eu faço o ${PACKS[n.merch].nome}. Traga o material e leve pra bem longe: quanto mais longe, mais paga!`,
    'Pack de outro mercador? Me entregue que eu pago bem. Pack feito aqui eu não compro.'] })));

export const TUNEIS_MUNDO = []; // túneis das cavernas do mundo grande (shared/caverna.js montarCaverna)
// FASE 3, Parte 3 (André 2026-11-08): o mundo grande (shared/mundo.js) em volta do mapa de hoje. A grade sai das áreas
// andáveis de hoje (ali ela vale 0, nada muda); depois disso a terra dos continentes também é andável (até a água pela
// cintura na praia) e o mar vira água de verdade (relevo.js noLago). andavelMundo não vai para o JSON (não enumerável).
{
  const G = montarMundo(MAPA_CLAREIRA);
  usarMundo(G);
  // Parte 8: os túneis das cavernas do mundo grande (shared/mundo.js CAVERNAS_MUNDO): chão e teto de cada uma valem
  // para todo mundo (shared/terreno.js altura e teto)
  for (const def of defsDasCavernas()) TUNEIS_MUNDO.push(registrarTunel(montarCaverna((x, z) => alturaMundo(G, x, z), def)));
  const seco = (x, z) => alturaMundo(G, x, z) > -0.9 && terraEm(G, x, z);
  Object.defineProperty(MAPA_CLAREIRA, 'andavelMundo', { enumerable: false, value: (x, z, margem = 0) => seco(x, z)
    && (margem <= 0 || (seco(x + margem, z) && seco(x - margem, z) && seco(x, z + margem) && seco(x, z - margem))) });
}

// FASE 3, Parte 5 (André 2026-11-08: "spots de grind do 1 ao 100"): campos de caça novos nos lugares planos do mundo
// grande (shared/mundo.js LUGARES_MUNDO), mesma regra do Quimera dos campos de hoje (11 monstros, um deles chefe).
// Os bichos são os que já temos, mais fortes pelo nível (statusInimigo); em Vael misturam dois tipos por campo, na ilha
// e em Aurora também, e o chefe é sempre o Warrok. mundo: true = o app só monta os modelos quando o herói chega perto.
{
  const PAR = { vael: [['lobo', 'golem'], ['maw', 'lobo'], ['golem', 'imp'], ['maw', 'golem']], ilha: [['maw', 'lobo'], ['golem', 'maw']], aurora: [['golem', 'maw'], ['lobo', 'maw'], ['maw', 'golem']] };
  const REGIAO = { vael: 'Vael', ilha: 'Ilha do Meio', aurora: 'Aurora' };
  const NOME = { lobo: 'Lobos', golem: 'Golens', maw: 'Maws', imp: 'Imps', puglin: 'Puglins' };
  // os veios pequenos de cada campo (shared/mundo.js lugaresDeMina) entram nas zonas de mineração, depois das de hoje
  const NOME_VEIO = { pedra: 'Veio de pedra', cobre: 'Veio de cobre', ferro: 'Veio de ferro', cristal: 'Veio de cristal' };
  const VOLTA_VEIO = { pedra: 240, cobre: 360, ferro: 420, cristal: 480 };
  for (const L of LUGARES_MUNDO.filter((l) => l.tipo === 'mina')) {
    const z = { id: L.id, nome: NOME_VEIO[L.minerio], tipo: L.minerio, x: L.x, z: L.z, r: L.r, veios: 3, volta: VOLTA_VEIO[L.minerio], pequeno: true, mundo: true };
    MINA.push(z); VEIOS.push(...veiosDaZona(z));
  }
  let n = 0;
  for (const L of LUGARES_MUNDO.filter((l) => l.tipo === 'caca')) {
    const [a, b] = PAR[L.terra][n++ % PAR[L.terra].length];
    CACA.push({ id: L.id, nome: `Campo dos ${NOME[a]} e ${NOME[b]} (${REGIAO[L.terra]})`, nivel: L.nivel, bicho: a, x: L.x, z: L.z, r: L.r - 2, mundo: true,
      n: 11, tipos: [...Array(5).fill(a), ...Array(5).fill(b), 'warrok'], passo: 0.35, rapido: 0.3, normal: 1.5, longe: 6, corpo: 2.2, ate: 0.85 });
  }
  // Parte 8 (André 2026-11-09): dentro de cada caverna do mundo grande, a primeira sala é um covil (monstros de pedra
  // e de sombra do nível da região, um pouco acima do campo de fora, e um Warrok) e a segunda tem o minério bom da
  // região (ferro em Vael, cristal na ilha e em Aurora), mais farto que os veios de fora. tunel = id da caverna: o
  // monstro e a pedra ficam no chão dela (o servidor prende o monstro no túnel, Simulacao.prenderNoTunel).
  const FORMA = CAVERNA_MUNDO_FORMA;
  for (const C of TUNEIS_MUNDO) {
    const L = LUGARES_MUNDO.find((l) => l.id === C.id), [s1, s2] = FORMA.salas, p1 = pontoDoTunel(s1.s, 0, C), p2 = pontoDoTunel(s2.s, 0, C);
    CACA.push({ id: C.id, nome: `Covil da ${L.nome} (${REGIAO[L.terra]})`, nivel: L.nivel, bicho: 'golem', x: +p1.x.toFixed(2), z: +p1.z.toFixed(2), r: 6, tunel: C.id, mundo: true,
      n: 6, tipos: ['golem', 'golem', 'maw', 'maw', 'golem', 'warrok'], passo: 0.35, rapido: 0.4, normal: 2, longe: 5, corpo: 2.2, ate: 1 });
    const tipo = L.terra === 'vael' ? 'ferro' : 'cristal';
    const z = { id: `m_${C.id}`, nome: `${NOME_VEIO[tipo]} da caverna`, tipo, x: +p2.x.toFixed(2), z: +p2.z.toFixed(2), r: 4.6, veios: 4, volta: VOLTA_VEIO[tipo], pequeno: true, mundo: true, tunel: C.id };
    MINA.push(z);
    VEIOS.push(...veiosDaZona(z).map((v) => ({ ...v, y: +noTunel(C, v.x, v.z).y.toFixed(3) })));
  }
}

// FASE 3, Parte 6 (André 2026-11-08: "reduzir a quantidade de mercadores... spots mais distantes"; 2026-11-09: "6 muito
// pra uma região"): o mundo grande ganha 6 mercadores de pack, poucos por região, com os 6 packs que faltavam. Vael
// (anel novo): 2, no Porto de Vael e no Posto do Oeste. Ilha do Meio: 1, no cais oeste (pérolas). Aurora: 3, no cais,
// na vila e no Posto do Leste. Pack que cruza o mar no porão do navio paga 1,5x (PACK_REGRAS.navio).
export const MERCADORES_MUNDO = [
  { id: 'm_conserva', nome: 'Dona Marta', merch: 'conserva', lugar: 'vila_vael', dx: -6, dz: 8, ry: 2.4, visual: 'vivi', veste: { tunica: 0x8a3a2e, saia: 0x8a3a2e, ate: 'canela', faixa: 0xe0c070 }, tinta: { cabelo: 0x3a2616, roupa: 0x8a3a2e, calca: 0x4a3c2c } },
  { id: 'm_abobora', nome: 'Seu Abel', merch: 'abobora', lugar: 'posto_oeste', dx: 3, dz: 5, ry: 3.6, visual: 'cabelo_m', veste: { tunica: 0xc0702a, faixa: 0x5a3a1a }, tinta: { cabelo: 0x6a4a2a, roupa: 0xc0702a, calca: 0x3a3028 } },
  { id: 'm_perola', nome: 'Maré', merch: 'perola', lugar: 'porto_ilha_o', dx: 2, dz: 6, ry: -1.6, visual: 'vivi', veste: { tunica: 0x3a7a9a, saia: 0x3a7a9a, ate: 'joelho', faixa: 0xe8e4f4 }, tinta: { cabelo: 0x1a2a3a, roupa: 0x3a7a9a, calca: 0x2f4a6a } },
  { id: 'm_ervas', nome: 'Velho Sálvio', merch: 'ervas', lugar: 'porto_aurora', dx: 3, dz: 5, ry: -1.6, visual: 'cabelo_m', escala: 0.98, veste: { tunica: 0x4a7a3a, faixa: 0x2a3a1a }, tinta: { cabelo: 0xd9d2c6, roupa: 0x4a7a3a, calca: 0x3a3028 } },
  { id: 'm_obsid', nome: 'Ônix', merch: 'obsid', lugar: 'vila_aurora', dx: 10, dz: -10, ry: 0.8, visual: 'cabelo_m', escala: 1.08, veste: { tunica: 0x3a3040, faixa: 0x8a6ad0 }, tinta: { cabelo: 0x1a1a1a, roupa: 0x3a3040, calca: 0x2a2a2a } },
  { id: 'm_brasa', nome: 'Fagulha', merch: 'brasa', lugar: 'posto_leste', dx: -3, dz: 5, ry: 3.4, visual: 'vivi', veste: { tunica: 0xb8401e, saia: 0xb8401e, ate: 'joelho', faixa: 0xffb040 }, tinta: { cabelo: 0xb83a1a, roupa: 0xb8401e, calca: 0x3a2a20 } },
];
for (const n of MERCADORES_MUNDO) {
  const L = LUGARES_MUNDO.find((l) => l.id === n.lugar);
  n.x = L.x + n.dx; n.z = L.z + n.dz; n.mundo = true;
  MERCADORES_PACK.push(n);
  MAPA_CLAREIRA.npcs.push({ ...n, nome: `${n.nome}, mercador`, roupa: 'peitoral0,calca0,botas0', funcao: 'pack', acoes: ['pack'], mundo: true,
    falas: [`Eu faço o ${PACKS[n.merch].nome}. Leve pra bem longe, do outro lado do mar paga muito mais!`,
      'Pack de outro mercador? Me entregue que eu pago bem. Pack feito aqui eu não compro.'] });
}

// FASE 3, Parte 7a: mata nas terras novas (direção de arte: nada de chão pelado). Bosques e árvores soltas pelos morros,
// mais ralas que a mata de hoje (campo aberto entre os bosques), longe da praia, das estradas, dos lugares planos e das
// encostas fortes. Entram no fim de mata (as árvores de hoje não mudam de índice: o "a" de cada uma continua igual) e
// todas dão lenha, como as outras. y = altura do chão do mundo grande.
{
  const G = gradeDoMundo();
  let sem = 20261109; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  const P = new Float32Array(64 * 64); for (let i = 0; i < P.length; i++) P[i] = rnd();
  const val = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, g = (a, b) => P[((iz + b) & 63) * 64 + ((ix + a) & 63)];
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return (g(0, 0) * (1 - ux) + g(1, 0) * ux) * (1 - uz) + (g(0, 1) * (1 - ux) + g(1, 1) * ux) * uz; };
  const rotas = ESTRADAS_MUNDO.map((E) => E.curva);
  const pertoDaEstrada = (x, z) => rotas.some((C) => C.some(([px, pz]) => Math.abs(px - x) < 7 && Math.abs(pz - z) < 7 && Math.hypot(px - x, pz - z) < 6.5));
  const novas = [], PASSO = 6.5;
  for (let z = G.z0 + 4; z < G.z0 + (G.nz - 1) * G.passo - 4; z += PASSO) for (let x = G.x0 + 4; x < G.x0 + (G.nx - 1) * G.passo - 4; x += PASSO) {
    const bosque = val(x / 48, z / 48) * 0.7 + val(x / 13, z / 13) * 0.3; // manchas de bosque
    if (rnd() > (bosque > 0.52 ? 0.85 : 0.07)) continue;
    const ax = x + (rnd() - 0.5) * PASSO * 0.8, az = z + (rnd() - 0.5) * PASSO * 0.8, y = alturaMundo(G, ax, az);
    // o mapa de hoje (altura 0 exata) e a praia ficam sem; 2026-11-09 (André: "dá para perceber as árvores... um
    // quadrado perfeito que era o mapa antigo"): a mata chega até a borda do mapa de hoje, sem o anel pelado em volta
    if (y === 0 || !terraEm(G, ax, az)) continue;
    if (y < 1.4 && [[10, 0], [-10, 0], [0, 10], [0, -10], [7, 7], [-7, -7], [7, -7], [-7, 7]].some(([dx, dz]) => alturaMundo(G, ax + dx, az + dz) < -0.05)) continue;
    let inc = 0; for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) inc = Math.max(inc, Math.abs(alturaMundo(G, ax + dx, az + dz) - y) / 1.5);
    if (inc > 0.55 || y > 42) continue; // paredão e cume de montanha: pedra pelada
    if (LUGARES_MUNDO.some((l) => Math.hypot(l.x - ax, l.z - az) < l.r + 7) || pertoDaEstrada(ax, az)) continue;
    if (MERCADORES_PACK.some((n) => Math.hypot(n.x - ax, n.z - az) < 5)) continue;
    if (RIOS_MUNDO.some((R) => R.curva.some(([px, pz]) => Math.abs(px - ax) < 8 && Math.abs(pz - az) < 8 && Math.hypot(px - ax, pz - az) < 7.5))) continue; // o leito do rio (Parte 4b)
    novas.push({ x: +ax.toFixed(2), z: +az.toFixed(2), s: +(0.75 + rnd() * 0.6).toFixed(2), ry: +(rnd() * 6.28).toFixed(2), v: Math.floor(rnd() * 3), y: +y.toFixed(2), mundo: true });
  }
  MAPA_CLAREIRA.mata.push(...novas);
}

// FASE 3, Parte 7b (André 2026-11-08: vilas pequenas de no máximo 5 terrenos; a grande do Nv 100 em bairros de ~5
// terrenos a 60-80 m um do outro, 20-25 terrenos). Cada vila é uma área onde se compra terreno, com as mesmas regras
// das Terras da Estrada (LOTE). A primeira é a de hoje, igual (a área e as estradas são as mesmas objetos); as do mundo
// grande ficam nos platôs das vilas (shared/mundo.js) e não podem pegar as estradas do mundo. max: terrenos com dono.
const curvaRua = (id) => ({ largura: 4, pontos: ESTRADAS_MUNDO.find((e) => e.id === id).curva });
const VAEL = LUGARES_MUNDO.find((l) => l.id === 'vila_vael'), AURORA = LUGARES_MUNDO.find((l) => l.id === 'vila_aurora');
// a praça da vila (onde fica o mercador) entra como "estrada": terreno nenhum em cima dela
const praca = (x, z, r) => ({ largura: 2 * r, pontos: [[x - 0.05, z], [x + 0.05, z]] });
export const VILAS_TERRENO = [
  { id: 'terras', nome: VILA_LOTES.nome, area: VILA_LOTES.area, estradas: [{ largura: 2.4, pontos: VILA_LOTES.estrada }, ...VILA_LOTES.ruas], max: 5 },
  { id: 'vila_vael', nome: 'Porto de Vael', nivel: 50, mundo: true, area: { x: VAEL.x, z: VAEL.z, rx: VAEL.r - 3, rz: VAEL.r - 3 },
    estradas: [curvaRua('e_leste'), curvaRua('e_norte'), praca(MERCADORES_MUNDO[0].x, MERCADORES_MUNDO[0].z, 4)], max: 5 },
  // Aurora: a praça no meio (mercador, encontro de todo mundo) e 4 bairros nas diagonais, a 48 m do centro (68 m entre
  // os vizinhos); cada bairro é uma área de 5 terrenos
  ...[['no', 'Bairro do Noroeste', -1, -1], ['ne', 'Bairro do Nordeste', 1, -1], ['so', 'Bairro do Sudoeste', -1, 1], ['se', 'Bairro do Sudeste', 1, 1]].map(([s, nome, dx, dz]) => ({
    id: `aurora_${s}`, nome: `Aurora, ${nome}`, nivel: 100, mundo: true, bairro: true,
    area: { x: AURORA.x + dx * 34, z: AURORA.z + dz * 34, rx: 24, rz: 24 }, estradas: [curvaRua('e_aurora')], max: 5 })),
];
// a vila de um ponto (o meio do terreno), ou null
export function vilaEm(x, z) {
  for (const V of VILAS_TERRENO) if (Math.hypot(x - V.area.x, z - V.area.z) <= raioNaDirecao(V.area, Math.atan2(z - V.area.z, x - V.area.x))) return V;
  return null;
}
// o chão de um terreno: 0 no mapa de hoje (como sempre foi); nas vilas do mundo grande, o platô
export const chaoDaVila = (x, z) => (vilaEm(x, z)?.mundo ? Math.max(0, alturaMontanha(x, z)) : 0);

// FASE 3, Parte 7b: cais de madeira em cada porto do mundo grande (André 2026-11-08: barco e navio saem do cais). Sai da
// praia para o lado mais fundo, 3 m de largura, com o tablado a 0,6 m (acima da água, o herói anda por cima).
{
  const G = gradeDoMundo();
  MAPA_CLAREIRA.cais = LUGARES_MUNDO.filter((l) => l.tipo === 'porto').map((L) => {
    let melhor = 0, hMin = Infinity;
    for (let k = 0; k < 48; k++) { const a = k / 48 * 2 * Math.PI, h = alturaMundo(G, L.x + Math.sin(a) * 22, L.z + Math.cos(a) * 22); if (h < hMin) { hMin = h; melhor = a; } }
    const dx = Math.sin(melhor), dz = Math.cos(melhor);
    let t0 = 0; while (t0 < 40 && alturaMundo(G, L.x + dx * t0, L.z + dz * t0) > 0.25) t0 += 0.5;
    const ini = t0 - 3, fim = t0 + 15;
    return { id: 'cais_' + L.id, nome: L.nome, x: +(L.x + dx * (ini + fim) / 2).toFixed(2), z: +(L.z + dz * (ini + fim) / 2).toFixed(2), ry: +melhor.toFixed(4), w: 3, d: fim - ini, y1: 0.6 };
  });
}

// FASE 3, Parte 4b: as pontes de madeira onde os rios cruzam as estradas (shared/mundo.js abrirRios) são chão de
// verdade (shared/terreno.js), e os rios vão para o app desenhar a água e as cachoeiras (mundo_grade.json)
MAPA_CLAREIRA.pontes = PONTES_MUNDO;
export { RIOS_MUNDO, PONTES_MUNDO };

// ---------- Cecília, a amiga (André 2026-11-07 e 2026-11-09) ----------
// Uma "jogadora" que vive no servidor (shared/amiga.js): guerreira brincalhona, amiga de igual para igual, não ajudante.
// Mora num terreno das Terras da Estrada, constrói a casa dela peça por peça e cuida da horta. Só o André conversa com
// ela (contas de teste, server/contas.js); os outros veem ela andando e trabalhando, mas tocar nela não abre nada.
// Visual escolhido pelo André (opção B, 2026-11-09): corpo victoria, cabelo preto, olhos vermelhos, vinho e capa roxa.
// Fase 1: corpo, casa, horta, passeio pela vila e conversa por botões. Fase 2: time e combate. Troca de verdade vem na fase 3.
export const AMIGA = {
  id: 'cecilia', nome: 'Cecília', conta: 'a:cecilia', papel: 'a guerreira',
  visual: 'victoria',
  aparencia: { cabelo: 0x1c1a1f, olhos: 0xc02a2a, roupa: 0x6e1e2a, calca: 0x222226, altura: 1 },
  equip: { corpo: { k: 'peitoral', r: 2 }, pernas: { k: 'short', r: 2 }, pes: { k: 'botas', r: 2 }, capa: { k: 'capa', r: 2 }, espada: { k: 'espada', r: 1 } },
  terreno: { w: 10, d: 10 }, // tamanho do terreno dela (procura o primeiro lugar livre perto da entrada das Terras)
  // a casa (6 x 4 m, a 2 m da borda, porta para o sul) e a horta, relativas ao canto do terreno (x0, z0); a grade é a de CASA.grade
  // b: lado da borda de um quadrado de fundação ('n','s','l','o'); a casa sai peça por peça, nesta ordem
  casa: [
    ['fundacao', 3, 3], ['fundacao', 5, 3], ['fundacao', 7, 3], ['fundacao', 3, 5], ['fundacao', 5, 5], ['fundacao', 7, 5],
    ['parede', 3, 3, 'n'], ['janela', 5, 3, 'n'], ['parede', 7, 3, 'n'], ['parede', 3, 3, 'o'], ['parede', 3, 5, 'o'],
    ['parede', 7, 3, 'l'], ['janela', 7, 5, 'l'], ['parede', 3, 5, 's'], ['porta', 5, 5, 's'], ['parede', 7, 5, 's'],
    ['telhado', 3, 3, 0], ['telhado', 5, 3, 0], ['telhado', 7, 3, 0], ['telhado', 3, 5, 2], ['telhado', 5, 5, 2], ['telhado', 7, 5, 2],
    ['cama', 3.4, 4.3, 1], ['bau', 7, 5.2, 0], ['tocha', 4.1, 6.6, 0],
  ],
  dentro: [2, 2, 8, 6], // o retângulo da casa (relativo ao canto do terreno): dentro dele ela entra e sai pela porta
  porta: [5, 6.7], // em pé na frente da porta, do lado de fora
  horta: { x: 2, z: 7, w: 6, d: 3 }, // canteiros de 1 m na frente da casa
  plantas: ['cenoura', 'rabanete', 'batata'],
  passo: { obra: 14, canteiro: 6, passeio: 40 }, // segundos entre uma peça e outra, um canteiro e outro, e quanto passeia
  conversa: 25, // segundos parada olhando para o André depois do último botão
  // Fase 2 (André 2026-11-09): time e combate. Ela decide por regras com sorteio (sem IA paga): a vontade começa em
  // base e muda com a amizade, o cansaço, a horta, a noite e a diferença de nível; depois sorteia. Recusou: espera
  // 'esperaRecusa' s para ser chamada de novo. No time ela segue o dono, luta de espada (golpe e as 4 skills de espada),
  // bebe poção com pouca vida e foge para perto dele quando não tem poção.
  time: { base: 0.6, porAmizade: 0.08, amizadeMax: 0.35, cansada: 0.35, horta: 0.2, noite: 0.2, nivelLivre: 6, porNivel: 0.05, perigoMax: 0, // André 2026-11-09: ele dá "powerlevel" nela; nível alto dele não pesa mais contra (antes 0.4)
    min: 0.05, max: 0.95, esperaRecusa: 45, seguir: 2.6, correr: 6, longe: 45, ajudar: 12, pocao: 0.4, fugir: 0.2, skill: 5, pocoes: 3 },
  // o que ela pede ao André (e paga de volta com o que colheu, ou em ouro)
  pedidos: [{ k: 'lenha', n: 5 }, { k: 'pedra', n: 4 }, { k: 'couro', n: 2 }, { k: 'semente_cenoura', n: 3 }, { k: 'minerio_cobre', n: 3 }],
  falas: {
    oi: ['Ei, você! Veio me ver ou veio filar uma cenoura?', 'Olha quem apareceu! Tava com saudade, sabia?', 'Opa! Chegou na hora certa, eu tava precisando de companhia.'],
    obra: ['Tô levantando minha casinha, peça por peça. Ficando linda, né?', 'Mais umas peças e eu durmo debaixo de telhado de verdade!', 'Parede, porta, janela... quem diria que espada também serve de martelo.'],
    pronta: ['Minha casa ficou pronta! Pode entrar, só não repara a bagunça.', 'Casa pronta, horta plantada. Agora só falta aventura!'],
    horta: ['Essa horta é meu orgulho. Cenoura daqui é outro nível.', 'Plantar é fácil, difícil é não comer tudo antes de colher.'],
    time: ['Bora! Tô no seu time. Vai na frente que eu cuido das suas costas.', 'Fechou! Time formado. Quem cair primeiro paga o jantar!', 'Partiu! Espada afiada e cenoura no bolso.'],
    jaNoTime: ['Ué, eu já tô no seu time! Bora caçar!'],
    recusa: {
      cansada: 'Ai, tô moída... deixa eu descansar um pouco antes, tá?',
      horta: 'Agora não, minha horta tá precisando de mim. Me chama daqui a pouco!',
      noite: 'De noite? Prefiro ficar em casa. Amanhã cedo a gente vai!',
      perigo: 'Hmm, você tá forte demais pra mim. Lá eu ia só atrapalhar...',
      cheio: 'Seu time tá lotado! Não cabe mais ninguém.',
      vontade: 'Hoje não tô no clima, desculpa! Me chama mais tarde?',
      jaFalei: 'Já te falei, daqui a pouco! Paciência, guerreiro.',
    },
    caiu: 'Ai... essa doeu. Vou pra casa me recuperar.',
    voltou: 'Valeu pela caçada! Vou cuidar da minha horta.',
    dungeon: ['Caverna? Adoro! Mas lá embaixo o Warrok morde. Primeiro eu me equipo melhor, combinado?', 'Dungeon comigo vai ser divertido. Ainda não, mas logo!'],
    troca: ['Troca? Ainda tô juntando minhas coisas. Quando eu tiver mais, a gente negocia.', 'Hmm, tenho pouca coisa ainda. Volta quando a horta render!'],
    pedido: ['Pra falar a verdade, preciso sim: {item}. Você tem aí? Eu te pago!', 'Tô precisando de {item}. Se você me arrumar, fico te devendo uma.'],
    semPedido: ['Agora não preciso de nada, mas valeu por perguntar!', 'Tô tranquila. Se precisar, eu grito!'],
    obrigada: ['Valeu demais! Toma {paga}, foi o que eu tinha. Amigo é pra isso!', 'Você é demais! Fica com {paga} de presente.'],
    falta: ['Você não tem {item} na mochila. Tudo bem, sem pressa!'],
    ocupada: ['Peraí, já já eu falo com você!'],
    tchau: ['Até mais! Passa aqui de novo.', 'Tchau! Cuidado com os lobos.'],
  },
  // Fase 3 (André 2026-11-09: "quero que ela tenha inventário e gold próprio", "mesma qtd de slots que eu tenho, as 4
  // páginas", "o que não for de interesse pra ela ela vende, o que for interessante ela guarda ou usa").
  // Mochila: 4 páginas como a do jogador. De tempos em tempos (fora do time) ela arruma: veste peça melhor, guarda poção,
  // semente, colheita e o que costuma pedir, e vende o resto (cajado ela não usa: é guerreira).
  // Troca: pela janela normal de troca. Ela não põe nada sozinha; o André pede no chat ("quero 3 cenouras") ou põe o que
  // tem pra ela. Ela cobra o valor de venda x margem (menos com amizade) e paga em ouro o que ele põe na mesa
  // (ou nada, se ele disser que é presente). Tranca e confirma sozinha quando a conta fecha.
  mochila: { paginas: 4, arrumar: 30, pocoes: 10 },
  troca: { margem: 1.5, porAmizade: 0.05, margemMin: 1.1, pensar: 1.2, longe: 6 },
  falasTroca: {
    abre: ['Bora negociar! Me diz o que você quer ("quero 3 cenouras") ou põe na mesa o que tem pra mim.', 'Troca? Adoro! Fala o que você quer ou mostra o que trouxe.'],
    longe: 'Chega mais perto que a gente troca! Toca em mim e escolhe Troca.',
    ocupada: 'Agora não dá, tô no meio de uma coisa! Daqui a pouco a gente troca.',
    pus: 'Coloquei na mesa: {item}. Sai por {preco} de ouro.',
    naoTenho: 'Hmm, isso eu não tenho aqui na mochila.',
    falta: 'Assim não fecha, hein! Põe mais {falta} de ouro que eu topo.',
    pago: 'Gostei! Te pago {ouro} de ouro por isso.',
    presente: 'Presente?! Ai, que fofo! Vou guardar com carinho.',
    feita: ['Negócio fechado! Bom fazer troca com você.', 'Feito! Volta sempre, freguês!'],
    obrigada: 'Obrigada pelo presente! Você é demais.',
  },
  // Chat de longe (André 2026-11-09: "falar com ela no chat como uma pessoa normal", "ter ela na lista de amigos",
  // "amigos reais e amigos virtuais, como eu fiz no Quimera", "de longe eu trocar ideia com ela e chamar ela, ou até ela
  // me chamar"). Ela fica em "Amigos virtuais" na lista do Multijogador e conversa pela mensagem privada do chat.
  // Quem responde: a IA grátis (Gemini, só se o servidor tiver a chave GEMINI_CHAVE, até 'iaPorDia' respostas por dia)
  // e, sem IA, as regras abaixo (palavras -> assunto -> fala + o que ela faz). A IA também só escolhe entre as mesmas ações.
  chat: {
    digitando: [1.2, 3], // segundos até a resposta (parece gente digitando)
    iaPorDia: 150,
    chamar: { primeiro: [240, 480], entre: [600, 1200], longe: 30, espera: 150 }, // ela chama o André: s até a 1ª, s entre uma e outra, m de distância, s esperando resposta
    // assunto: palavras que contam (sem acento, minúsculas)
    assuntos: {
      sairTime: ['sai do time', 'sair do time', 'pode ir pra casa', 'pode voltar pra casa', 'volta pra casa', 'te libero'],
      time: ['time', 'vamos', 'partiu', 'cacar', 'caca', 'upar', 'grind', 'lutar', 'aventura', 'me ajuda a matar', 'missao'],
      vir: ['vem ca', 'vem aqui', 'vem pra ca', 'vem me ver', 'cola aqui', 'chega aqui', 'aparece', 'vem comigo', 'onde voce', 'cade voce', 'cade vc', 'onde vc', 'onde ce'],
      sim: ['sim', 'claro', 'pode ser', 'fechou', 'beleza', 'blz', 'ok', 'vou', 'to indo', 'ja vou', 'bora', 'simbora', 'demorou'],
      nao: ['nao', 'agora nao', 'depois', 'mais tarde', 'nem', 'to ocupado', 'nao da'],
      oi: ['oi', 'ola', 'e ai', 'eai', 'opa', 'bom dia', 'boa tarde', 'boa noite', 'salve', 'fala'],
      comoVai: ['como vai', 'como voce ta', 'como vc ta', 'tudo bem', 'td bem', 'como esta', 'beleza?', 'suave', 'de boa'],
      casa: ['casa', 'obra', 'construi', 'construcao'],
      horta: ['horta', 'planta', 'cenoura', 'rabanete', 'batata', 'colheita', 'fazenda'],
      ajuda: ['precisa de algo', 'precisa de alguma', 'quer alguma coisa', 'posso ajudar', 'te ajudo', 'precisa de ajuda', 'quer ajuda'],
      dungeon: ['dungeon', 'caverna', 'masmorra', 'chefe', 'boss', 'warrok'],
      troca: ['troca', 'trocar', 'vende', 'vender', 'compra', 'comprar', 'item', 'tem '],
      // só valem com a janela de troca aberta (fase 3)
      presente: ['presente', 'de graca', 'pra voce', 'e seu', 'e sua', 'toma'],
      pedirItem: ['quero', 'me vende', 'vende', 'me ve', 'tem ', 'me da', 'preciso de', 'compro'],
      obrigado: ['obrigado', 'obrigada', 'valeu', 'vlw', 'brigado', 'agradeco'],
      elogio: ['linda', 'bonita', 'legal', 'gosto de voce', 'te adoro', 'melhor amiga', 'incrivel', 'top'],
      piada: ['piada', 'conta uma', 'me faz rir', 'algo engracado'],
      tchau: ['tchau', 'falou', 'flw', 'ate mais', 'ate logo', 'fui', 'boa noite cecilia', 'vou dormir', 'vou sair'],
    },
    falas: {
      oi: ['Oii! Tava pensando em você agora mesmo, sério.', 'Ei! Que bom que mandou mensagem, tava entediada.', 'Opa! Fala, aventureiro!'],
      comoVai: ['Tô ótima! A horta tá linda e eu tô cheia de energia.', 'Tudo certo por aqui! E você, matou muito lobo hoje?', 'Bem! Meio suja de terra, mas feliz.'],
      vir: ['Tô indo aí! Me espera que eu já chego.', 'Já vou! Não sai daí, hein?', 'Partiu! Chego num instante.'],
      chegou: ['Cheguei! Sentiu minha falta?', 'Pronto, tô aqui! Que foi?'],
      naoVir: ['Agora não dá, tô no meio de uma coisa aqui. Daqui a pouco!', 'Ai, agora não consigo... me chama mais tarde?'],
      perto: ['Ué, eu tô do seu lado! Olha pra trás.', 'Tô aqui pertinho, bobo!'],
      chamaRespostaSim: ['Eba! Tô indo aí!', 'Isso! Já tô a caminho.'],
      chamaRespostaNao: ['Tudo bem, fica pra próxima!', 'Poxa... tá bom, mais tarde então.'],
      elogio: ['Para, assim eu fico vermelha!', 'Hehe, você também é demais!', 'Eu sei, eu sei. Mas obrigada mesmo assim!'],
      obrigado: ['De nada! Amigo é pra isso.', 'Imagina! Você faria o mesmo por mim.'],
      piada: ['Sabe por que o lobo não joga cartas? Porque sempre tem um lobo na manga... tá, essa foi ruim.', 'Minha cenoura falou que me ama. Ela é bem raiz!', 'Por que o esqueleto não briga? Porque ele não tem estômago pra isso!'],
      naoEntendi: ['Hmm, não entendi direito. Fala de outro jeito?', 'Hã? Tô aqui regando a horta, me explica melhor!', 'Hehe, você tá falando enigma? Me explica!'],
      tchau: ['Tchau! Me chama quando quiser.', 'Até mais! Cuidado por aí.', 'Falou! Vou voltar pra minha horta.'],
      semIa: 'Tô meio cansada de conversar hoje, mas me chama pra caçar que eu topo!',
      // ela chama o André (sozinha, de vez em quando, quando ele está longe e fora do time)
      chama: [
        { texto: 'Ei! Bora caçar uns lobos? Tô entediada aqui.', quer: 'time' },
        { texto: 'Vem ver minha horta! As cenouras tão enormes.', quer: 'vir' },
        { texto: 'Tô precisando de uma ajudinha... passa aqui?', quer: 'ajuda' },
        { texto: 'Cadê você? Faz tempo que não aparece!', quer: 'vir' },
        { texto: 'Bora fazer alguma coisa juntos? Me chama pro time!', quer: 'time' },
      ],
    },
  },
};
