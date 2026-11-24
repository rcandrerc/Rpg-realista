// Recruta com ordem no painel não faz a vida dele (André 2026-11-24: "mandei meu primeiro recruta farmar uma madeira e ele
// foi construir a casa dele... eu pensei que ele só faria essas coisas se eu deixasse ele no modo livre"): sem machado, a
// ordem "Farmar recurso: Lenha" não sai, e antes ele caía na rotina da casa. Agora espera; no modo Livre constrói.
// Uso: node ferramentas/testes/recruta-ordem-sem-casa.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { acharLugarBase } from '../../shared/base.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 }); a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('A', false);
s.cla('A', { acao: 'fundar', nome: 'Ruivas' }); a.prog.cla.nv = 3;
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = rec.x + 1; a.z = rec.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const pc = acharLugarBase(-6, 1, 'chama', []); a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'base' }); ok(s.baseDe(a), 'base do jogador fundada');
s.passoClasNpc(); s.passoBasesNpc();
const x = s.recrutasNoMundo(a)[0], j = x.amiga, m = a.prog.cla.m.find((o) => o.id === x.AMIGA.id);
const L = x.loteDaAmiga(); ok(L, 'recruta tem lote na base');
const R = x.rotinaAmiga(); j.prog.dia = { h: (R.saiDe + 1) % 24, t: Date.now() }; j.prog.vigor = { v: 100, t: Date.now() };
const fer = x.AMIGA.atividades.lenha.ferramenta;
j.prog.mochila = j.prog.mochila.map((o) => (o && o.k === fer ? null : o)); // sem machado
m.fn = { k: 'recurso', r: 'lenha' }; s.aplicarFuncao(a, x, m, true);
const p0 = L.pecas.length;
for (let i = 0; i < 10 * 600; i++) s.passo(0.1); // 10 min
ok(L.pecas.length === p0, `com ordem de lenha e sem machado não constrói a casa (${p0} -> ${L.pecas.length} peças)`);
ok(j.ia.anim !== 'construir', 'não fica trabalhando na casa');
m.fn = { k: 'livre' }; s.aplicarFuncao(a, x, m, true);
for (let i = 0; i < 15 * 600; i++) s.passo(0.1);
ok(L.pecas.length > p0, `no modo Livre volta a construir a casa (${p0} -> ${L.pecas.length} peças)`);
// sem machado (André 2026-11-24: "se tiver no baú do clã ele pega, se não tiver ele pega as pedras e madeira no chão")
{
  const K = s.claDoRecruta(x), B = s.bauDoCla(K);
  const semFer = () => { j.prog.mochila = j.prog.mochila.map((o) => (o && (o.k === fer || o.k === 'lenha' || o.k === 'pedra') ? null : o)); };
  // a) no Baú do Clã
  semFer(); m.fn = { k: 'livre' }; s.aplicarFuncao(a, x, m, true);
  if (B) { const i = B.itens.findIndex((o) => !o); B.itens[i] = { k: fer, n: 1 }; }
  m.fn = { k: 'recurso', r: 'lenha' }; s.aplicarFuncao(a, x, m, true);
  ok(j.ia.fazFer?.k === fer, 'sem machado: vai atrás da ferramenta');
  for (let i = 0; i < 3 * 600 && !j.prog.mochila.some((o) => o?.k === fer); i++) s.passo(0.1);
  ok(!B || (j.prog.mochila.some((o) => o?.k === fer) && !B.itens.some((o) => o?.k === fer)), `pegou o machado no Baú do Clã (${B ? 'tem baú' : 'sem baú'})`);
  for (let i = 0; i < 600; i++) s.passo(0.1);
  ok(j.ia.av?.coleta === 'lenha' || j.ia.encomenda, `com o machado foi cortar lenha (${s.fazendoRecruta(j, a)})`);
  // b) baú vazio: cata galho e pedra no chão e fabrica
  semFer(); m.fn = { k: 'livre' }; s.aplicarFuncao(a, x, m, true);
  m.fn = { k: 'recurso', r: 'lenha' }; s.aplicarFuncao(a, x, m, true);
  for (let i = 0; i < 8 * 600 && !j.prog.mochila.some((o) => o?.k === fer); i++) s.passo(0.1);
  ok(j.prog.mochila.some((o) => o?.k === fer), `sem nada: catou no chão e fez o machado (${s.fazendoRecruta(j, a)})`);
  for (let i = 0; i < 600; i++) s.passo(0.1);
  ok(j.ia.av?.coleta === 'lenha' || j.ia.encomenda, `e depois foi cortar lenha (${s.fazendoRecruta(j, a)})`);
}
// sem Mineração 5 para o ferro (André 2026-11-24: "treina minerando pedra e cobre"): minera o que já dá e, no nível, vai ao ferro
{
  const pk = x.AMIGA.atividades.minerar.ferramenta;
  if (!j.prog.mochila.some((o) => o?.k === pk)) j.prog.mochila[j.prog.mochila.findIndex((o) => !o)] = { k: pk, n: 1 };
  j.prog.prof.min = 0; j.prog.vigor = { v: 100, t: Date.now() };
  m.fn = { k: 'livre' }; s.aplicarFuncao(a, x, m, true);
  m.fn = { k: 'recurso', r: 'ferro' }; s.eventos = []; s.aplicarFuncao(a, x, m, true);
  for (let i = 0; i < 300; i++) s.passo(0.1);
  const chat = JSON.stringify([...x.chatDeAmiga(a), ...(j.ia.chatFila || [])].filter((e) => /Ainda não tenho/.test(e.texto)).slice(0, 1));
  ok(/Ainda não tenho nível/.test(chat), `avisa no chat (${chat.slice(0, 200)})`);
  ok(['pedra', 'cobre'].includes(j.ia.encomenda?.rec) && ['pedra', 'cobre'].includes(j.ia.levar?.r), `ferro sem nível: treina em ${j.ia.encomenda?.rec} (${s.fazendoRecruta(j, a)})`);
  j.prog.prof.min = 8 * 16 + 1; // Mineração 5
  j.ia.encomenda = null; j.ia.av = null; s.aplicarFuncao(a, x, m, false);
  ok(j.ia.encomenda?.rec === 'ferro' && j.ia.levar?.r === 'ferro', `com Mineração 5 vai ao ferro (${s.fazendoRecruta(j, a)})`);
}
