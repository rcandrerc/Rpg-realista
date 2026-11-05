// Ferramenta: grava em godot-prototipo/dados/mundo.json os sólidos do mapa (pedras com a grade de alturas, casas,
// esteios, poço...) e as regras de escalada, para o Godot andar, colidir e escalar igual ao servidor (shared/terreno.js).
// Uso: node client/exportar-godot/mundo.mjs
import fs from 'node:fs';
import { Simulacao, MAPA_CLAREIRA, ESCALADA, SUBIDA, PARADO_PAREDE, DURACAO, HEROI, MOVIMENTO, A, HABS, PASSIVAS, ATRIBUTOS, PONTOS_POR_NIVEL, NIVEL_MAX, SKILL_MAX, BOTOES_PADRAO, N_BOTOES, XP_INIMIGO, ANDAR_ATIRANDO, NIVEL_SEM_TOMO, ITENS, RARIDADES, LUGARES, MOCHILA, MOCHILA_PAGINAS, PAGINA_PRECO, CONJUNTO, VENDA_EQUIP, VENDA_TOMO, ROMANO, LOJA, LOJA_DISTANCIA, TROCA, ESTAMINA, VIGOR, PROFISSOES, RANKS, PROF_MAX, MERCADOR, COLETA, COLETA_DISTANCIA, RECEITAS, OFICINA, OFICINA_DISTANCIA, RARIDADE_CRIAR, CRIADOR, NOME, RESET_BUILD, MISSOES, TIPOS_INIMIGO, TREINO, NIVEL_INIMIGO, statusInimigo, VILA_LOTES, LOTE, CONSTRUCOES, PLANTAS, VOLTA_VILA, HORTA, REGEN, FERRAMENTAS_FAZENDA, CASA, BAU, CRIAR_OBRA, MORTE, AMIGOS, TIME } from '@rpg/shared';
import { GRADES } from '../../shared/rochas.js';
import { LAGOS, AGUA, GRADE_MONTANHA, INGREME, beiraDosLagos } from '../../shared/relevo.js';
import zlib from 'node:zlib';
import { gerarLonge, copasDeFora, LONGE } from './longe.mjs';
import { RAIZ } from '@rpg/shared';

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
  magia_d: 'magiaD', magia_e: 'magiaE', bola_forte: A.bolaForte, nova_gelo: A.novaGelo, meteoro_ceu: A.meteoroCeu,
  cura: A.heal, cruzado: A.cruzado, descendente: A.descendente, onda: A.onda, vortice: A.vortice, bloqueio: A.block, rolar: A.roll, apanhar: A.hit, morrer: A.death, golpe1: A.slash, golpe2: A.slash2,
  ...Object.fromEntries(Object.entries(ESCALADA).map(([k, e]) => ['esc_' + k, e.anim])),
  ...Object.fromEntries(Object.entries(PARADO_PAREDE).map(([k, n]) => ['parede_' + k, n])),
};
// caminho do quadril das animações RAIZ (freada, meia-volta): o Godot anda e vira o herói por ele.
// x/z em alturas de quadril (o Godot multiplica pela altura do quadril do herói), giro em radianos, a 30 quadros por segundo.
const cru = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../public/assets/personagens/anims.json.gz', import.meta.url))));
const raiz = {};
for (const nome of RAIZ) {
  const a = cru[nome]; if (!a) continue;
  const tp = a.t.find(([n]) => /Hips\.position$/.test(n)), tq = a.t.find(([n]) => /Hips\.quaternion$/.test(n));
  const amostra = (tr, t, k) => { // interpolação linear na trilha [nome, tempos, valores] (k valores por chave)
    const [, ts, vs] = tr; let i = 0; while (i < ts.length - 2 && ts[i + 1] < t) i++;
    const u = ts.length < 2 ? 0 : Math.min(1, Math.max(0, (t - ts[i]) / (ts[i + 1] - ts[i] || 1)));
    return Array.from({ length: k }, (_, j) => vs[i * k + j] * (1 - u) + (vs[Math.min(ts.length - 1, i + 1) * k + j] ?? vs[i * k + j]) * u);
  };
  const h = cru._rest.alturaQuadril, n = Math.round(a.d * 30) + 1, x = [], z = [], giro = [];
  const p0 = amostra(tp, 0, 3);
  let g0 = null, gAnt = 0, volta = 0;
  for (let k = 0; k < n; k++) {
    const t = Math.min(a.d, k / 30), p = amostra(tp, t, 3), q = amostra(tq, t, 4);
    x.push(r4((p[0] - p0[0]) / h)); z.push(r4((p[2] - p0[2]) / h));
    let g = 2 * Math.atan2(q[1], q[3]); if (g0 == null) g0 = g;
    g -= g0; while (g - gAnt > Math.PI) g -= 2 * Math.PI; while (g - gAnt < -Math.PI) g += 2 * Math.PI; gAnt = g;
    giro.push(r4(g));
  }
  raiz[nome] = { d: a.d, x, z, giro };
}
const mundo = {
  anims,
  raiz,
  raio: MAPA_CLAREIRA.raio, nascimento: MAPA_CLAREIRA.nascimento,
  // mapa andável (shared/mapa.js): vila, passagem da estradinha e a clareira de fora; máscara do chão que cobre tudo
  areas: MAPA_CLAREIRA.areas, corredores: MAPA_CLAREIRA.corredores, mascara: MAPA_CLAREIRA.mascara,
  // campo de caça (regra do Quimera) e zona de mineração; o v de cada vaga é o mesmo do servidor
  // status: vida e dano de cada bicho no nível do campo (o mesmo que o servidor calcula em statusInimigo)
  caca: (MAPA_CLAREIRA.caca || []).map((c, i, L) => ({ ...c, v0: MAPA_CLAREIRA.inimigos.length + L.slice(0, i).reduce((s, o) => s + o.tipos.length, 0),
    status: Object.fromEntries([...new Set(c.tipos)].map((t) => [t, statusInimigo(t, c.nivel)])) })),
  // árvores da mata (enfeite sólido: o Godot desenha em MultiMesh e colide por uma grade) e a estrada principal (minimapa)
  mata: MAPA_CLAREIRA.mata || [], estrada: MAPA_CLAREIRA.estrada || [], minimapa: MAPA_CLAREIRA.minimapa,
  // ruínas, rochedos, troncos caídos e mato da mata (godot-prototipo/cenario.gd desenha; os sólidos entram na grade da mata)
  cenario: MAPA_CLAREIRA.cenario || { marcos: [], pecas: [], enfeites: [], solidos: [] },
  // todos os caminhos de terra (vila, saída do leste, estrada principal e as trilhas das clareiras): o "Ir para" do mapa
  // anda só por eles (godot-prototipo/rota.gd)
  caminhos: (MAPA_CLAREIRA.vila?.caminhos || []).map((c) => ({ largura: c.largura, pontos: c.pontos.map(([x, z]) => [r4(x), r4(z)]) })),
  mina: MAPA_CLAREIRA.mina || [], resetBuild: RESET_BUILD,
  // espantalhos de treino: o v vem depois das vagas dos campos de caça (igual ao servidor)
  treino: (MAPA_CLAREIRA.treino || []).map((t, k) => ({ ...t, nome: TIPOS_INIMIGO[t.tipo].nome, vida: TIPOS_INIMIGO[t.tipo].vida, volta: TREINO.volta,
    v: MAPA_CLAREIRA.inimigos.length + (MAPA_CLAREIRA.caca || []).reduce((s, c) => s + c.tipos.length, 0) + k })),
  solidos, grades,
  // relevo (2026-11-05): lagos rasos e fundos e a grade de alturas da montanha (shared/relevo.js; terreno.gd repete a conta)
  longe: LONGE, copas_fora: copasDeFora(), // máscara do chão visto de longe (longe.mjs grava relevo/longe.png)
  lagos: LAGOS, agua: AGUA, ingreme: INGREME, juncos: beiraDosLagos().filter((b) => b.tipo !== 'pedra'),
  montanha_grade: { x0: GRADE_MONTANHA.x0, z0: GRADE_MONTANHA.z0, passo: GRADE_MONTANHA.passo, n: GRADE_MONTANHA.n, h: Array.from(GRADE_MONTANHA.h, (v) => Math.round(v * 1000) / 1000) },
  casas: T.casas.map((_, i) => i), // índices em solidos que são casa (teto)
  obstaculos: sim.obstaculos.map((k) => ({ x: r4(k.x), z: r4(k.z), r: r4(k.r), ...(k.alto != null ? { alto: r4(k.alto) } : {}), ...(k.semTopo ? { semTopo: 1 } : {}) })),
  casasInimigo: sim.casas.map((k) => ({ x: r4(k.x), z: r4(k.z), cos: r4(k.cos), sin: r4(k.sin), hw: r4(k.hw), hd: r4(k.hd) })),
  rochasInimigo: sim.obstaculosRocha.map((k) => ({ x: r4(k.x), z: r4(k.z), r: r4(k.r) })),
  escadas: sim.escadas.map((e) => ({ x: e.x, z: e.z, ry: e.ry, topo: e.topo, alt: r4(e.alt) })),
  escalada: Object.fromEntries(Object.entries(ESCALADA).map(([k, e]) => [k, { dur: r4(DURACAO[e.anim] / e.ts), traj: e.traj }])),
  subida: SUBIDA, parado: PARADO_PAREDE, alturaHeroi: HEROI.altura, movimento: MOVIMENTO,
  // NPCs da vila no mesmo lugar do servidor (a loja só vende perto da Rosa)
  npcs: (MAPA_CLAREIRA.npcs || []).map((n) => ({ id: n.id, nome: n.nome, x: n.x, z: n.z, ry: n.ry, funcao: n.funcao, tinta: n.tinta, escala: n.escala, roupa: n.roupa, arma: n.arma, anciao: n.anciao, veste: n.veste, esconder: n.esconder, limpar_rosto: n.limpar_rosto, friso: n.friso, acoes: n.acoes || [], missao: n.missao ? MISSOES[n.missao]?.nome : undefined, falas: n.falas })),
  // onde se coleta (Parte 3): veios (v0...) com o giro do desenho e as árvores (a0...), com os mesmos ids do servidor
  coletaveis: [...sim.coletaveis.values()].map((c, i) => ({ ...c, r: r4(c.r), ry: MAPA_CLAREIRA.veios[i]?.ry ?? 0 })),
  // Vila dos Lotes (construção e fazenda): os lotes com a placa e a área (godot-prototipo/construcao.gd)
  // Terras da Estrada (2026-11-04): a área (elipse de borda ondulada), a estrada central e a de chegada, para o app
  // conferir o terreno marcado antes de mandar (a mesma conta de motivoTerreno no servidor)
  lotes: MAPA_CLAREIRA.lotes || [], vilaLotes: { nome: VILA_LOTES.nome, x: VILA_LOTES.area.x, z: VILA_LOTES.area.z,
    area: VILA_LOTES.area, estradas: [{ largura: 2.4, pontos: VILA_LOTES.estrada }, ...VILA_LOTES.ruas] },
};
fs.writeFileSync(new URL('../../godot-prototipo/dados/mundo.json', import.meta.url), JSON.stringify(mundo));
fs.writeFileSync(new URL('../../godot-prototipo/relevo/longe.png', import.meta.url), gerarLonge());
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
  nivelSemTomo: NIVEL_SEM_TOMO, itens: ITENS, raridades: RARIDADES.map((r) => ({ nome: r.nome, cor: cor(r.cor) })), lugares: LUGARES, mochila: MOCHILA, mochilaPaginas: MOCHILA_PAGINAS, paginaPreco: PAGINA_PRECO,
  conjunto: CONJUNTO, vendaEquip: VENDA_EQUIP, vendaTomo: VENDA_TOMO, romano: ROMANO, loja: LOJA, lojaDistancia: LOJA_DISTANCIA, troca: TROCA, amigos: AMIGOS, time: TIME,
  // criador de personagem: cores (número 0xRRGGBB, null = original), altura e formato do rosto; nome de 3 a 16 letras
  criador: CRIADOR, nome: NOME,
  // estamina, vigor e profissões (Parte 3)
  estamina: ESTAMINA, regen: REGEN, vigor: VIGOR, profissoes: PROFISSOES, ranks: RANKS, profMax: PROF_MAX, mercador: MERCADOR, coleta: COLETA,
  coletaDistancia: COLETA_DISTANCIA, receitas: RECEITAS, oficina: OFICINA, oficinaDistancia: OFICINA_DISTANCIA, raridadeCriar: RARIDADE_CRIAR,
  heroiCorrer: HEROI.correr,
  // nível dos monstros dos campos de caça (XP sobe com o nível do bicho e cai se o herói passou muito dele)
  nivelInimigo: NIVEL_INIMIGO,
  // voltar para a vila (botão da casinha no menu do topo): canalização, recarga e raio da vila
  voltaVila: VOLTA_VILA,
  // Vila dos Lotes: preço e regras do lote, peças que se constroem, plantas da horta (construcao.gd)
  lote: LOTE, construcoes: CONSTRUCOES, plantas: PLANTAS, horta: HORTA,
  // casa do Quimera (2026-11-04): grade da casa, ferramentas da fazenda (enxada, regador) e o baú
  ferramentas: FERRAMENTAS_FAZENDA, casa: CASA, bau: BAU, criarObra: CRIAR_OBRA,
  // penalidade de morte e durabilidade do equipamento (André 2026-11-05)
  morte: MORTE,
};
const faltam = Object.entries(habs.habs).flatMap(([k, h]) => [h.anim, ...(h.combo || []).map((c) => c.anim)].filter((a) => a && !anims[a]).map((a) => k + ':' + a));
if (faltam.length) console.log('ATENÇÃO, animação sem nome no Godot:', faltam.join(', '));
fs.writeFileSync(new URL('../../godot-prototipo/dados/habilidades.json', import.meta.url), JSON.stringify(habs, null, 1));
console.log('habilidades.json:', Object.keys(HABS).length, 'skills');
