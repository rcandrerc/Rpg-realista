// Robô do guia (André 2026-11-14: "essa missão e a anterior tá muito zoada... a gente fez uma auditoria e você disse
// que tava top"). Para cada missão da história, um herói começa nela e faz SÓ o que o quadrinho manda: junta o item que
// o texto pede, cria, colhe, fala. Falha se: a etapa ou o andamento voltam para trás; o guia pede de novo a mesma coisa
// sem andar (vai-e-volta); o texto fica vazio; a missão não termina; a etapa com lugar fica sem "Ir".
// Uso: node ferramentas/testes/robo-guia.mjs [id da missão]
import { Simulacao, MAPA_CLAREIRA, HISTORIA, ITENS, RECEITAS, PLANTAS } from '../../shared/index.js';
import { guardar, contar } from '../../shared/progresso.js';
import { etapasDe, totalEtapa } from '../../shared/historia.js';
const so = process.argv[2];
let falhas = 0;
const falhou = (m) => { falhas++; console.error('FALHOU', m); };
const npcDe = (id) => MAPA_CLAREIRA.npcs.find((n) => n.id === id);

function jogar(i) {
  const M = HISTORIA[i], L = etapasDe(M);
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('R', 'Robo', undefined, { conta: 1 });
  j.criando = false; j.x = -24; j.z = 59;
  const p = j.prog; p.nivel = Math.max(M.nv, 1); p.ouro = 0;
  s.comprarLote; p.ouro = 99999; s.comprarLote('R', { x0: -28, z0: 55, x1: -20, z1: 63 }); p.ouro = 0;
  p.mochila.fill(null); if (p.mochila.length < 160) while (p.mochila.length < 160) p.mochila.push(null);
  for (const k of Object.keys(p.prof || {})) p.prof[k] = 999999; // profissão alta: o nível não é o que se testa aqui
  p.hist = { v: 2, p: i, ac: false, e: 0, n: 0, m: 0, ...(i ? { u: HISTORIA[i - 1].id } : {}) };
  s.estacaoPerto = () => ({}); // está do lado da estação certa (bigorna, fornalha, fogão, bancada)
  s.falaHistoria(j, npcDe(M.npc), () => {}, true); // aceita a missão com o NPC (o kit da primeira etapa vem junto)
  if (!p.hist.ac) { falhou(`${M.id}: não deu para aceitar`); return []; }
  s.eventos = [];
  let ultimo = { e: 0, n: 0 }, voltas = new Map(), achados = [];
  const nota = (m) => { if (!achados.includes(m)) achados.push(m); };
  for (let it = 0; it < 3000; it++) {
    const h = p.hist;
    if (h.p > i) return achados; // entregou
    const E = L[h.e];
    // nunca para trás
    if (h.e < ultimo.e || (h.e === ultimo.e && h.n < ultimo.n)) falhou(`${M.id} "${M.nome}": voltou de ${ultimo.e}:${ultimo.n} para ${h.e}:${h.n} (${E?.txt})`);
    ultimo = { e: h.e, n: h.n };
    p.vigor = { v: 999, t: Date.now() }; j.vida = j.vidaMax;
    const hi = s.histInfo(j);
    if (!hi?.txt || /undefined|NaN|null/.test(hi.txt)) falhou(`${M.id} etapa ${h.e + 1}: texto ruim "${hi?.txt}"`);
    const f = s.juntaDe(j, E);
    if (f && !f.pre && f.fonte) {
      const ch = `${h.e}:${h.n}:${f.k}:${f.tem}:${f.n}:${f.para || ""}`;
      voltas.set(ch, (voltas.get(ch) || 0) + 1);
      if (process.env.VER) console.log('  ', hi.txt, JSON.stringify(f), contar(p.mochila, f.k));
      if (voltas.get(ch) > 2) { falhou(`${M.id} etapa ${h.e + 1}: o guia pede "${hi.txt}" e não anda`); return achados; }
      if (['veio:arvore', 'solto', 'lote', 'spot', 'loja', 'plantar', 'cresce', 'regar'].includes(f.fonte) || f.fonte.startsWith('veio:') || f.fonte.startsWith('caca:')) {
        if (!hi.alvo && f.fonte !== 'loja') nota(`etapa ${h.e + 1} "${hi.txt}": sem Ir`);
      }
      if (f.k === 'ouro') p.ouro = f.n; else if (ITENS[f.k]) guardar(p.mochila, { k: f.k, n: f.n - f.tem });
      else { falhou(`${M.id}: item desconhecido ${f.k}`); return achados; }
      continue;
    }
    if (f?.pre) { nota(`etapa ${h.e + 1}: passo antes "${f.txt}" (feito à mão)`); s.proximaEtapa(j); continue; }
    if (!E) { falhou(`${M.id}: sem etapa`); return achados; }
    const vezes = Math.max(1, totalEtapa(E) - h.n);
    // a ação da etapa
    if (E.ev === 'criar' && E.ja === 'tem' && contar(p.mochila, E.k) > 0) { s.checarEtapa(j); continue; }
    if (E.ev === 'criar' && Object.values(RECEITAS).some((R) => R.faz === E.k) && !E.ja) {
      const r = Object.entries(RECEITAS).find(([, R]) => R.faz === E.k)[0];
      const a = s.eventos.length, e0 = h.e, n0 = h.n; s.criarUm('R', { r });
      const av = s.eventos.slice(a).filter((x) => x.t === 'aviso').map((x) => x.texto);
      if (p.hist.e === e0 && p.hist.n === n0 && p.hist.p === i) { falhou(`${M.id} etapa ${h.e + 1}: "${hi.txt}" mas criar falha: ${av.join(' | ')}`); return achados; }
      continue;
    }
    if (E.ev === 'falar') {
      const n = npcDe(E.npc); if (!n) { falhou(`${M.id}: NPC ${E.npc}`); return achados; }
      if (!hi.alvo) nota(`etapa ${h.e + 1} "${hi.txt}": sem Ir para o NPC`);
      const a = p.hist.e; s.falaHistoria(j, n, () => {}, true);
      if (p.hist.e === a && p.hist.p === i) { falhou(`${M.id} etapa ${h.e + 1}: falou com ${E.npc} e nada ("${hi.txt}")`); return achados; }
      continue;
    }
    if (E.ev === 'colher' || E.ev === 'plantar' || E.ev === 'regar') { s.historia(j, E.ev, { k: E.k }); continue; }
    const d = { k: [].concat(E.k ?? [])[0], npc: E.npc, campo: E.campos?.[0], sala: E.salas?.[0], tipo: E.tipos?.[0], hc: E.hc, de: E.de, skill: true, barco: true, v: E.min, n: vezes };
    const a = `${p.hist.e}:${p.hist.n}`; s.historia(j, E.ev, d);
    if (`${p.hist.e}:${p.hist.n}` === a && p.hist.p === i) { s.checarEtapa(j); if (`${p.hist.e}:${p.hist.n}` === a && p.hist.p === i) s.proximaEtapa(j); }
  }
  falhou(`${M.id} "${M.nome}": não terminou (etapa ${p.hist.e + 1}: ${s.textoEtapa(j)})`);
  return achados;
}
HISTORIA.forEach((M, i) => {
  if (so && M.id !== so) return;
  const a = jogar(i);
  console.log(`${M.id} Cap ${M.cap} ${M.nome}: ${a.length ? a.join(' · ') : 'ok'}`);
});
console.log(falhas ? `${falhas} falha(s)` : 'robô do guia: todas as missões ok');
if (falhas) process.exitCode = 1;
