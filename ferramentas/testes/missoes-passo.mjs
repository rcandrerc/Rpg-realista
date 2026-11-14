// Missão leva por cada passo (André 2026-11-13: "em vez de mandar colher a madeira, depois colher a pedra... ele já joga
// direto para o craft"). Confere o que a varredura das missões não pega: entregar ao NPC sem ter tudo, minerar ferro sem o
// nível de Minerador, plantar sem semente, o pack no carrinho e a pesca no mar (barquinho + radar, spot de verdade).
// Uso: node ferramentas/testes/missoes-passo.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, ITENS, PESCA } from '../../shared/index.js';
import { etapasDe } from '../../shared/historia.js';
import { contar, guardar } from '../../shared/progresso.js';
import { noLago } from '../../shared/relevo.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
let n = 0;
const novo = (id, e) => {
  const j = s.adicionarJogador('P' + ++n, 'Passo' + n), p = j.prog, i = HISTORIA.findIndex((M) => M.id === id);
  p.nivel = Math.max(p.nivel, HISTORIA[i].nv); p.ouro = 0; p.mochila.fill(null);
  p.hist = { v: 2, p: i, ac: true, e, n: 0, m: 0 };
  return j;
};
const etapa = (id, f) => etapasDe(HISTORIA.find((M) => M.id === id)).findIndex(f);
const dar = (p, k, q = 1) => { const P = ITENS[k].pilha || 1; for (; q > 0; q -= P) guardar(p.mochila, { k, n: Math.min(P, q) }); };
const ferramentas = (p) => { for (const k of ['machado', 'picareta', 'vara']) dar(p, k); };

// ---------- entregar ao NPC sem ter tudo: junta antes (h10, Malaquias) ----------
{
  const j = novo('h10', 0), p = j.prog; ferramentas(p);
  let hi = s.histInfo(j);
  ok(hi.npc === '' && /^Para Malaquias: corte Lenha \(0\/40\)/.test(hi.txt) && hi.ev === 'item' && hi.alvo, `sem nada: corta a lenha antes de ir ao Malaquias (${hi.txt})`);
  dar(p, 'lenha', 40);
  hi = s.histInfo(j);
  ok(/minere Minério de ferro/.test(hi.txt), `depois o minério de ferro (${hi.txt})`);
  dar(p, 'lenha', 20); dar(p, 'barra_ferro', 6); dar(p, 'barra_aco', 2);
  hi = s.histInfo(j);
  ok(hi.npc === 'm_metal' && hi.txt.startsWith('Entregue 40 lenhas') && hi.alvo?.npc === 'm_metal', 'com tudo: o Ir e o botão Missão voltam para o Malaquias');
}
// ---------- ferro e cristal: a missão libera o veio (Minerador baixo) ----------
{
  const j = novo('a8', 0), p = j.prog; dar(p, 'picareta');
  const a = s.histInfo(j).alvo, no = [...s.coletaveis.values()].find((o) => o.tipo === 'ferro' && Math.hypot(o.x - a.x, o.z - a.z) < 1);
  Object.assign(j, { x: no.x + no.r + 0.5, z: no.z, y: s.terreno.altura(no.x + no.r + 0.5, no.z), chao: true });
  const e0 = s.eventos.length; s.coletar(j.id, { no: no.id });
  const av = s.eventos.slice(e0).filter((e) => e.t === 'aviso' && e.para === j.id).map((e) => e.texto);
  ok(j.coleta && !av.some((t) => /Minerador/.test(t)), `Minerador Nv 1 minera o ferro que a missão pede (${av.join(' | ') || 'sem aviso'})`);
  s.pararColeta(j, null);
  p.hist = { v: 2, p: HISTORIA.findIndex((M) => M.id === 'a7'), ac: true, e: 0, n: 0, m: 0 }; // missão que não pede ferro
  const e1 = s.eventos.length; s.coletar(j.id, { no: no.id });
  ok(!j.coleta && s.eventos.slice(e1).some((e) => e.t === 'aviso' && /Minerador Nv 5/.test(e.texto)), 'fora da missão o nível do veio continua valendo');
  ok(s.histInfo(j).livre === undefined || !s.histInfo(j).livre.includes('minerio_ferro'), 'hi.livre só com a missão que pede');
}
// ---------- plantar sem semente: compra com a Rosa ----------
{
  const j = novo('c3', 0), p = j.prog; dar(p, 'enxada'); p.ouro = 100;
  const hi = s.histInfo(j);
  ok(/compre Semente de abóbora/.test(hi.txt) && hi.ev === 'comprar' && hi.k === 'semente_abobora' && hi.alvo?.npc === 'comerciante', `sem semente: compre com a Rosa (${hi.txt})`);
  dar(p, 'semente_abobora');
  ok(s.histInfo(j).txt.startsWith('Plante abóbora'), 'com a semente: plante');
}
// ---------- sem ferramenta: cria antes ----------
{
  const j = novo('c14', etapa('c14', (E) => E.ev === 'item' && E.k === 'cristal'));
  let hi = s.histInfo(j);
  ok(/^Picareta de pedra: pegue do chão/.test(hi.txt) && hi.de === 'solto', `minerar cristal sem picareta: a picareta antes (${hi.txt})`);
  dar(j.prog, 'picareta');
  hi = s.histInfo(j);
  ok(hi.txt.startsWith('Minere 2 cristais') && hi.alvo, 'com a picareta: o veio de cristal');
}
// ---------- dois packs: o das costas vai para o carrinho, depois sobe nele ----------
{
  const j = novo('b5', etapa('b5', (E) => E.ev === 'pack_fez')), p = j.prog;
  const m = MAPA_CLAREIRA.npcs.find((o) => o.id === 'm_metal');
  Object.assign(j, { x: m.x + 2, z: m.z, y: s.terreno.altura(m.x + 2, m.z) });
  dar(p, 'carrinho'); p.carrinho = { lv: 1, comb: 500, vida: 400, quebrado: false, packs: [], chao: null };
  dar(p, 'barra_ferro', 6); dar(p, 'barra_cobre', 6);
  p.pack = { k: 'metal', ox: Math.round(m.x), oz: Math.round(m.z), mo: 'm_metal' };
  p.hist.n = 1;
  let hi = s.histInfo(j);
  ok(hi.txt === 'Ponha o carrinho no chão' && hi.ev === 'veiculo' && hi.k === 'colocar', `pack nas costas e falta outro: carrinho no chão (${hi.txt})`);
  s.veiculo(j.id, { acao: 'colocar', k: 'carrinho' });
  hi = s.histInfo(j);
  ok(hi.txt === 'Ponha o pack no carrinho' && hi.k === 'por_pack', `perto do carrinho: ponha o pack nele (${hi.txt})`);
  s.pack(j.id, { acao: 'por_carrinho' });
  hi = s.histInfo(j);
  ok(hi.txt.startsWith('Faça 2 Packs de Metal') && hi.alvo?.npc === 'm_metal', 'costas livres: volta o "Faça 2 Packs"');
  p.hist = { ...p.hist, e: etapa('b5', (E) => E.ev === 'pack'), n: 0 };
  p.carrinho.packs.push({ k: 'metal', ox: Math.round(m.x), oz: Math.round(m.z), mo: 'm_metal' });
  hi = s.histInfo(j);
  ok(hi.txt === 'Suba no carrinho' && hi.k === 'dirigir', `packs no carrinho, longe do Nico: suba nele (${hi.txt})`);
  s.veiculo(j.id, { acao: 'subir', k: 'carrinho' });
  hi = s.histInfo(j);
  ok(hi.txt.startsWith('Leve os 2 packs') && hi.alvo?.npc === 'm_peixe', 'dirigindo: o Ir leva ao Nico');
}
// ---------- pesca no mar (André 2026-11-13): spots espalhados, só de barco, achados com o radar ----------
{
  for (let t = 0; t < 200; t++) s.passo(0.05);
  const mar = s.spots.filter((v) => v.agua === 'mar' && v.ativo);
  ok(mar.length >= 10 && mar.some((v) => v.tipo === 'raro') && mar.some((v) => v.tipo === 'epico'), `spots no mar: ${mar.length} (comum, raro e épico)`);
  const M = PESCA.mar;
  ok(mar.every((v) => [0, 1, 2, 3, 4, 5, 6, 7].every((k) => noLago(v.x + Math.sin(k * 0.785) * M.margem, v.z + Math.cos(k * 0.785) * M.margem)?.lago?.mar)), 'todos longe da margem (só de barco)');
  const i = etapa('h15', (E) => E.ev === 'pesca' && E.k === 'garoupa'), j = novo('h15', i), p = j.prog;
  dar(p, 'vara'); dar(p, 'picareta');
  let hi = s.histInfo(j);
  ok(/Radar de pesca/.test(hi.txt), `sem radar: cria o radar (${hi.txt})`);
  dar(p, 'radar_pesca'); dar(p, 'barquinho');
  hi = s.histInfo(j);
  ok(hi.txt === 'Leve o barquinho a um cais' && hi.alvo, `com barquinho, em terra: vai ao cais (${hi.txt} -> ${hi.alvo?.nome})`);
  Object.assign(j, { x: hi.alvo.x, z: hi.alvo.z });
  hi = s.histInfo(j);
  ok(hi.txt === 'Ponha o barquinho na água' && hi.k === 'barco', `no cais: barquinho na água (${hi.txt})`);
  tirarDa(p, 'barquinho'); j.veiculo = 'barquinho';
  hi = s.histInfo(j);
  ok(/Radar/.test(hi.txt) && !hi.alvo && hi.k === 'radar', `no barco, sem radar ligado: sem Ir, usa o radar (${hi.txt})`);
  const r = p.mochila.findIndex((o) => o?.k === 'radar_pesca');
  s.item(j.id, { acao: 'usar', i: r });
  hi = s.histInfo(j);
  const sp = s.spots.find((v) => v.ativo && Math.hypot(v.x - hi.alvo?.x, v.z - hi.alvo?.z) < 0.1);
  ok(sp && sp.agua === 'mar' && PESCA.spots[sp.tipo].peixes.mar.some(([k]) => k === 'garoupa'), `radar ligado: o Ir leva a um spot do mar que dá garoupa (${sp?.tipo})`);
  // de barco ao lado do spot, lança de verdade
  Object.assign(j, { x: sp.x + 3, z: sp.z, y: 0 });
  const e0 = s.eventos.length; s.pescar(j.id, { acao: 'lancar', x: sp.x, z: sp.z });
  ok(j.pesca && j.pesca.lista === PESCA.spots[sp.tipo].peixes.mar, `pescou no spot do mar (${s.eventos.slice(e0).filter((e) => e.t === 'aviso').map((e) => e.texto).join(' | ') || 'lançou'})`);
}
function tirarDa(p, k) { const i = p.mochila.findIndex((o) => o?.k === k); if (i >= 0) p.mochila[i] = null; }
