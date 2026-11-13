// Varredura das missões (André 2026-11-12: "não quero ficar descobrindo erro atrás de erro"). Para cada etapa de criar,
// juntar, pack, pesca, comprar...: começa de mochila vazia, segue o que a barrinha pede (juntando o que falta, sempre com
// um Ir que não cai na névoa), vai até o lugar do Ir e faz a ação de verdade no servidor. Tem que andar.
// Uso: node ferramentas/testes/varredura-missoes.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, RECEITAS, CONSTRUCOES, FERRAMENTAS_FAZENDA } from '../../shared/index.js';
import { etapasDe, zonaFechadaEm } from '../../shared/historia.js';
import { guardar, contar } from '../../shared/progresso.js';
const bugs = [];
for (const [i, M] of HISTORIA.entries()) etapasDe(M).forEach((E, e) => {
  if (E.ev === 'falar') return;
  const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('A', 'Ana'), p = j.prog;
  p.nivel = M.nv; p.ouro = 1e6; p.mochila.fill(null);
  for (const k of ['machado', 'picareta', 'vara']) guardar(p.mochila, { k, n: 1 });
  const lote = i >= HISTORIA.findIndex((o) => o.id === 'a12');
  if (lote) s.lotes.set('tA', { def: { id: 'tA', x0: -20, x1: -10, z0: 80, z1: 90 }, dono: j.conta, nomeDono: 'Ana', pecas: [{ id: 1, k: 'bancada', x: -15, z: 85 }, { id: 2, k: 'fogao', x: -12, z: 85 }, { id: 3, k: 'fornalha', x: -18, z: 85 }, { id: 4, k: 'bigorna', x: -15, z: 82 }], horta: {} });
  p.hist = { v: 2, p: i, ac: true, e, n: 0, m: 0 };
  const tag = `${M.id}#${e + 1} ${E.ev} ${E.k || JSON.stringify(E.itens || E.de || '')}`;
  const deu = [];
  for (let it = 0; it < 25; it++) {
    const hi = s.histInfo(j); const a = hi.alvo;
    if (a && zonaFechadaEm(p, a.x, a.z)) { bugs.push(`${tag}: Ir leva para a névoa (${a.nome})`); break; }
    const f = s.juntaDe(j, E);
    if (f?.pre) { // passo antes (2026-11-13): carrinho, barquinho, radar; faz como o jogador faria
      deu.push('pre:' + f.pre);
      if (f.pre === 'radar') j.radarAte = s.tempo + 180;
      else if (f.pre === 'barco') j.veiculo = 'barquinho';
      else if (f.pre === 'ir' && a) Object.assign(j, { x: a.x, z: a.z });
      else { bugs.push(`${tag}: passo antes "${f.pre}" sem jeito de fazer no teste`); break; }
      continue;
    }
    if (f) {
      if (!f.fonte) { bugs.push(`${tag}: falta ${f.k} ${f.tem}/${f.n} e o Ir não sabe onde achar`); break; }
      const aqui = f.fonte === 'destruir' || f.fonte === 'ouro' || (f.fonte === 'receita' && !s.estacaoDaEtapa({ k: f.k })); // na mochila, aqui mesmo
      if (!a && !aqui) { bugs.push(`${tag}: juntando ${f.k} (${f.fonte}) e o Ir está vazio`); break; }
      if (f.k === 'ouro') { p.ouro = f.n; continue; }
      deu.push(`${f.k}:${f.fonte}`);
      for (let q = f.n - f.tem; q > 0; q -= 50) guardar(p.mochila, { k: f.k, n: Math.min(50, q) }); continue;
    }
    break;
  }
  if (E.ev === 'ter') { // juntou tudo: a etapa passa sozinha
    s.checarEtapa(j); if (p.hist.e === e && !E.kit) bugs.push(`${tag}: com tudo na mochila a etapa não passou`);
  }
  if (E.ev === 'criar' || E.ev === 'pack_fez') {
    const hi = s.histInfo(j), a = hi.alvo;
    if (a) Object.assign(j, { x: a.x + (a.npc ? 1.5 : 0.8), z: a.z, y: s.terreno.altura(a.x, a.z) });
    const h0 = JSON.stringify(p.hist); const av = [];
    const k = String(E.k).replace(/^obra_/, '');
    for (let n = 0; n < (E.n || 1); n++) {
      const ev0 = s.eventos.length;
      if (E.ev === 'pack_fez') { p.pack = null; s.pack('A', { acao: 'fazer', npc: a?.npc }); }
      else if (FERRAMENTAS_FAZENDA[k] || CONSTRUCOES[k]) s.fabricarUm('A', k);
      else { const r = RECEITAS[E.k] ? E.k : Object.keys(RECEITAS).find((q) => RECEITAS[q].faz === E.k); s.criarUm('A', { r }); }
      for (let t = 0; t < 200; t++) { const l = s.passo(0.05); for (const x of l) if (x.t === 'aviso' && x.para === 'A') av.push(x.texto); }
      for (const x of s.eventos.slice(ev0)) if (x.t === 'aviso' && x.para === 'A') av.push(x.texto);
      if (E.ev === 'pack_fez' && p.pack && E.n > 1) { /* entregar? deixa nas costas: o 2º vai no carrinho */ }
    }
    if (JSON.stringify(p.hist) === h0) bugs.push(`${tag}: no lugar do Ir (${a?.nome || 'sem Ir'}) não andou | ${[...new Set(av)].slice(0, 3).join(' | ')}`);
  }
});
for (const b of bugs) console.error('FALHOU', b);
if (bugs.length) process.exitCode = 1; else console.log('ok varredura: todas as etapas de criar, juntar e pack andam seguindo o Ir');
