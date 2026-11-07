// Picareta e machado de pedra obrigatórios (André 2026-11-07) e as pedras e galhos soltos no chão para começar.
// Uso: node ferramentas/testes/soltos.mjs
import { Simulacao, MAPA_CLAREIRA as M, COLETA, SOLTOS, FERRAMENTAS_FAZENDA, ITENS, contar, guardar } from '../../shared/index.js';
import { dentroDoMapa } from '../../shared/mapa.js';
import { noLago } from '../../shared/relevo.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(M);

// ---- onde estão: muitos na vila, alguns no mapa, todos em chão livre ----
const naVila = SOLTOS.filter((o) => Math.hypot(o.x, o.z) < M.raio);
ok(naVila.filter((o) => o.tipo === 'galho').length >= 6 && naVila.filter((o) => o.tipo === 'pedrinha').length >= 6, `na vila: ${naVila.length} (galhos e pedras)`);
ok(SOLTOS.length - naVila.length >= 15, `no resto do mapa: ${SOLTOS.length - naVila.length}`);
const ruins = [];
for (const o of SOLTOS) {
  const casa = s.casas.some((c) => { const dx = o.x - c.x, dz = o.z - c.z, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos; return Math.abs(lx) < c.hw + 0.5 && Math.abs(lz) < c.hd + 0.5; });
  const solido = [...s.obstaculos, ...s.obstaculosRocha].some((b) => Math.hypot(o.x - b.x, o.z - b.z) < b.r + 0.5);
  const hs = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].map(([dx, dz]) => s.terreno.altura(o.x + dx, o.z + dz));
  const alto = Math.max(...hs) - Math.min(...hs) > 0.3; // em cima de pedra, tampo ou degrau
  if (casa || solido || noLago(o.x, o.z) || !dentroDoMapa(M, o.x, o.z, 1.5) || alto) ruins.push({ ...o, casa, solido, alto });
}
ok(!ruins.length, 'todos no chão livre (fora de casa, pedra, lago e borda) ' + JSON.stringify(ruins.slice(0, 3)));
ok(!s.obstaculos.some((b) => SOLTOS.some((o) => o.x === b.x && o.z === b.z)), 'não são sólidos');

// ---- ferramentas: sem bancada, uma de cada ----
ok(!FERRAMENTAS_FAZENDA.picareta.bancada && !FERRAMENTAS_FAZENDA.machado.bancada, 'picareta e machado sem bancada');
ok(FERRAMENTAS_FAZENDA.enxada && FERRAMENTAS_FAZENDA.regador, 'enxada e regador continuam');
const j = s.adicionarJogador('A', 'Ana'); j.ciente = true; j.prog.vigor = { v: 999, t: Date.now() };
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
const ir = (no) => Object.assign(j, { x: no.x + no.r + 1, z: no.z, chao: true, trava: 0, esc: null, arrancada: null, coleta: null });

const veio = [...s.coletaveis.values()].find((c) => c.tipo === 'pedra'), arvore = s.coletaveis.get('m5');
ir(veio); s.eventos = []; s.coletar('A', { no: veio.id });
ok(!j.coleta && avisos().some((t) => /picareta de pedra/.test(t)), 'sem picareta não minera: ' + avisos()[0]);
ir(arvore); s.eventos = []; s.coletar('A', { no: arvore.id });
ok(!j.coleta && avisos().some((t) => /machado de pedra/.test(t)), 'sem machado não corta: ' + avisos()[0]);

// ---- pegar com a mão ----
const pedra = [...s.coletaveis.values()].find((c) => c.solto && c.tipo === 'pedrinha'), galho = [...s.coletaveis.values()].find((c) => c.solto && c.tipo === 'galho');
ir(pedra); s.eventos = []; s.coletar('A', { no: pedra.id });
ok(contar(j.prog.mochila, 'pedra') === COLETA.pedrinha.da.pedra && !j.coleta, 'pegou a pedra solta na hora, sem picareta');
ok(s.eventos.some((e) => e.t === 'coletou' && e.no === pedra.id && e.cargas === 0), 'evento coletou (o Godot esconde)');
s.eventos = []; s.coletar('A', { no: pedra.id });
ok(contar(j.prog.mochila, 'pedra') === 1 && avisos().some((t) => /já pegou/.test(t)), 'a mesma não dá de novo logo');
const b = s.adicionarJogador('B', 'Beto'); Object.assign(b, { x: pedra.x + 1, z: pedra.z, chao: true }); s.eventos = []; s.coletar('B', { no: pedra.id });
ok(contar(b.prog.mochila, 'pedra') === 1, 'é de cada um: outro jogador também pega');
for (let t = 0; t < (COLETA.pedrinha.volta + 1) / 0.5; t++) s.passo(0.5);
ir(pedra); s.coletar('A', { no: pedra.id });
ok(contar(j.prog.mochila, 'pedra') === 2, 'volta depois de ' + COLETA.pedrinha.volta + ' s');
ok(COLETA.pedrinha.da.pedra * 1 < COLETA.pedra.da.pedra * COLETA.pedra.cargas && COLETA.galho.da.lenha < COLETA.arvore.da.lenha * COLETA.arvore.cargas, 'dá menos que minerar e cortar');

// ---- criar a picareta e o machado em qualquer lugar e aí sim minerar e cortar ----
guardar(j.prog.mochila, { k: 'pedra', n: 10 }); guardar(j.prog.mochila, { k: 'lenha', n: 10 });
Object.assign(j, { x: 0, z: 1 });
s.eventos = []; s.fabricarUm('A', 'picareta'); s.fabricarUm('A', 'machado');
ok(contar(j.prog.mochila, 'picareta') === 1 && contar(j.prog.mochila, 'machado') === 1, 'criou picareta e machado sem bancada');
s.eventos = []; s.fabricarUm('A', 'picareta');
ok(contar(j.prog.mochila, 'picareta') === 1 && avisos().some((t) => /Você já tem/.test(t)), 'só uma de cada');
ir(veio); s.eventos = []; s.coletar('A', { no: veio.id });
ok(j.coleta, 'com picareta minera');
s.pararColeta(j);
ir(arvore); s.eventos = []; s.coletar('A', { no: arvore.id });
ok(j.coleta, 'com machado corta');
ok(ITENS.picareta.nome === 'Picareta de pedra' && ITENS.machado.nome === 'Machado de pedra', 'nomes');
