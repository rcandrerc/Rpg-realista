// Ferramenta: grava em godot-prototipo/dados/mundo.json os sólidos do mapa (pedras com a grade de alturas, casas,
// esteios, poço...) e as regras de escalada, para o Godot andar, colidir e escalar igual ao servidor (shared/terreno.js).
// Uso: node client/exportar-godot/mundo.mjs
import fs from 'node:fs';
import { Simulacao, MAPA_CLAREIRA, ESCALADA, SUBIDA, PARADO_PAREDE, DURACAO, HEROI, MOVIMENTO, A, HABS, PASSIVAS, ATRIBUTOS, PONTOS_POR_NIVEL, NIVEL_MAX, SKILL_MAX, BOTOES_PADRAO, N_BOTOES, XP_INIMIGO, ANDAR_ATIRANDO, NIVEL_SEM_TOMO, ITENS, RARIDADES, LUGARES, MOCHILA, CONJUNTO, VENDA_EQUIP, VENDA_TOMO, ROMANO, LOJA, LOJA_DISTANCIA, ESTAMINA, VIGOR, PROFISSOES, RANKS, PROF_MAX, MERCADOR, COLETA, COLETA_DISTANCIA, RECEITAS, OFICINA, OFICINA_DISTANCIA, RARIDADE_CRIAR } from '@rpg/shared';
import { GRADES } from '../../shared/rochas.js';

const sim = new Simulacao(MAPA_CLAREIRA), T = sim.terreno;
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const nomesGrade = Object.keys(GRADES);
const solidos = T.solidos.map((r) => r.casa
  ? { casa: true, x: r4(r.x), z: r4(r.z), cos: r4(r.cos), sen: r4(r.sen), hw: r4(r.hw), hd: r4(r.hd), sobe: r4(r.sobe), y1: r4(r.y1), base: r4(r.base), R: r4(r.R) }
  : { casa: false, x: r.x, z: r.z, cos: r4(r.cos), sen: r4(r.sen), s: r.s, y0: r.y0, R: r4(r.R), base: 0, grade: nomesGrade.indexOf(r.modelo) });
const grades = nomesGrade.map((k) => { const g = GRADES[k]; return { x0: g.x0, z0: g.z0, passo: g.passo, nx: g.nx, nz: g.nz, h: Array.from(g.h) }; });
// nomes das animações: Godot -> servidor/site (o que vai no 'pos' e chega em anim/acao); o contrário é montado no Godot
const anims = {
  parada: 'Idle', andar: 'Walk', corrida: 'Run', espada_parada: A.swordIdle, queda: 'queda', pulo: 'pulo', mortal: 'mortal', pouso: 'pouso',
  combo1: 'combo1', combo2: 'combo2', combo3: 'combo3', combo4: 'combo4', magia1: 'magia1', magia2: 'magia2', magia3: 'magia3',
  investida: 'investida', giro: A.giro, salto: A.jump, relampago: A.raio, bola: A.bolt, raio: A.ceu, explosao: A.ground, meteoros: A.rain,
  cura: A.heal, cruzado: A.cruzado, descendente: A.descendente, onda: A.onda, vortice: A.vortice, bloqueio: A.block, rolar: A.roll, apanhar: A.hit, morrer: A.death, golpe1: A.slash, golpe2: A.slash2,
  ...Object.fromEntries(Object.entries(ESCALADA).map(([k, e]) => ['esc_' + k, e.anim])),
  ...Object.fromEntries(Object.entries(PARADO_PAREDE).map(([k, n]) => ['parede_' + k, n])),
};
const mundo = {
  anims,
  raio: MAPA_CLAREIRA.raio, nascimento: MAPA_CLAREIRA.nascimento,
  solidos, grades,
  casas: T.casas.map((_, i) => i), // índices em solidos que são casa (teto)
  obstaculos: sim.obstaculos.map((k) => ({ x: r4(k.x), z: r4(k.z), r: r4(k.r), ...(k.alto != null ? { alto: r4(k.alto) } : {}) })),
  casasInimigo: sim.casas.map((k) => ({ x: r4(k.x), z: r4(k.z), cos: r4(k.cos), sin: r4(k.sin), hw: r4(k.hw), hd: r4(k.hd) })),
  rochasInimigo: sim.obstaculosRocha.map((k) => ({ x: r4(k.x), z: r4(k.z), r: r4(k.r) })),
  escadas: sim.escadas.map((e) => ({ x: e.x, z: e.z, ry: e.ry, topo: e.topo, alt: r4(e.alt) })),
  escalada: Object.fromEntries(Object.entries(ESCALADA).map(([k, e]) => [k, { dur: r4(DURACAO[e.anim] / e.ts), traj: e.traj }])),
  subida: SUBIDA, parado: PARADO_PAREDE, alturaHeroi: HEROI.altura, movimento: MOVIMENTO,
  // NPCs da vila no mesmo lugar do servidor (a loja só vende perto da Rosa)
  npcs: (MAPA_CLAREIRA.npcs || []).map((n) => ({ id: n.id, nome: n.nome, x: n.x, z: n.z, ry: n.ry, funcao: n.funcao, falas: n.falas })),
  // onde se coleta (Parte 3): veios (v0...) com o giro do desenho e as árvores (a0...), com os mesmos ids do servidor
  coletaveis: [...sim.coletaveis.values()].map((c, i) => ({ ...c, r: r4(c.r), ry: MAPA_CLAREIRA.veios[i]?.ry ?? 0 })),
};
fs.writeFileSync(new URL('../../godot-prototipo/dados/mundo.json', import.meta.url), JSON.stringify(mundo));
console.log('mundo.json:', solidos.length, 'sólidos,', mundo.obstaculos.length, 'obstáculos,', grades.length, 'grades');

// Skills do Quimera (shared/progresso.js) para o menu do personagem e o modo sem internet do Godot.
// A animação já vai com o nome do Godot; as cores vão em texto (#rrggbb).
const godot = Object.fromEntries(Object.entries(anims).map(([g, n]) => [n, g]));
const cor = (v) => (typeof v === 'number' ? '#' + v.toString(16).padStart(6, '0') : v);
const limpar = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'cor' ? cor(v) : k === 'anim' ? godot[v] || v : v)));
const habs = {
  habs: limpar(HABS), passivas: PASSIVAS, atributos: ATRIBUTOS, pontosPorNivel: PONTOS_POR_NIVEL, nivelMax: NIVEL_MAX,
  skillMax: SKILL_MAX, botoesPadrao: BOTOES_PADRAO, nBotoes: N_BOTOES, xpInimigo: XP_INIMIGO, andarAtirando: ANDAR_ATIRANDO,
  // mochila, equipamento e loja (shared/dados.js)
  nivelSemTomo: NIVEL_SEM_TOMO, itens: ITENS, raridades: RARIDADES.map((r) => ({ nome: r.nome, cor: cor(r.cor) })), lugares: LUGARES, mochila: MOCHILA,
  conjunto: CONJUNTO, vendaEquip: VENDA_EQUIP, vendaTomo: VENDA_TOMO, romano: ROMANO, loja: LOJA, lojaDistancia: LOJA_DISTANCIA,
  // estamina, vigor e profissões (Parte 3)
  estamina: ESTAMINA, vigor: VIGOR, profissoes: PROFISSOES, ranks: RANKS, profMax: PROF_MAX, mercador: MERCADOR, coleta: COLETA,
  coletaDistancia: COLETA_DISTANCIA, receitas: RECEITAS, oficina: OFICINA, oficinaDistancia: OFICINA_DISTANCIA, raridadeCriar: RARIDADE_CRIAR,
  heroiCorrer: HEROI.correr,
};
const faltam = Object.entries(habs.habs).flatMap(([k, h]) => [h.anim, ...(h.combo || []).map((c) => c.anim)].filter((a) => a && !anims[a]).map((a) => k + ':' + a));
if (faltam.length) console.log('ATENÇÃO, animação sem nome no Godot:', faltam.join(', '));
fs.writeFileSync(new URL('../../godot-prototipo/dados/habilidades.json', import.meta.url), JSON.stringify(habs, null, 1));
console.log('habilidades.json:', Object.keys(HABS).length, 'skills');
