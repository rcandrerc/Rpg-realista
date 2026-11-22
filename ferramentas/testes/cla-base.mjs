// Base do clã (André 2026-11-22): o Baú do Clã no terreno do líder (um por clã), os recrutas guardam nele o que farmam,
// a função Fazenda planta o que o líder pede, rega e colhe; clã bot usa tudo igual.
// Uso: node ferramentas/testes/cla-base.mjs
import { Simulacao, MAPA_CLAREIRA, PLANTAS, contar } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.x = -24; a.z = 59; a.prog.ouro = 90000; a.prog.nivel = 30;
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ev();
const p = a.prog, L = s.loteDe(a);
p.mochila.fill(null);
p.mochila[0] = { k: 'obra_bau_cla', n: 2 }; p.mochila[1] = { k: 'enxada', n: 1 }; p.mochila[2] = { k: 'lenha', n: 30 };
s.construir('A', { k: 'bau_cla', x: -21.5, z: 61, r: 0 });
ok(!L.pecas.some((o) => o.k === 'bau_cla') && ev().some((e) => e.texto?.includes('Funde')), 'sem clã: não põe o Baú do Clã');
s.cla('A', { acao: 'fundar', nome: 'Base Teste' });
s.construir('A', { k: 'bau_cla', x: -21.5, z: 61, r: 0 });
ok(L.pecas.some((o) => o.k === 'bau_cla'), 'Baú do Clã no terreno');
s.construir('A', { k: 'bau_cla', x: -26, z: 61, r: 0 });
ok(L.pecas.filter((o) => o.k === 'bau_cla').length === 1, 'só um por clã');
a.x = -21.5; a.z = 60; ev();
s.bau('A', { acao: 'guardar', i: 2, cla: true });
ok(contar(L.bauCla, 'lenha') === 30 && !L.bau?.some((o) => o), 'guardar no Baú do Clã não mexe no particular');
s.bau('A', { acao: 'abrir', cla: true });
ok(ev().some((e) => e.t === 'bau' && e.cla === 1), 'abre o Baú do Clã (evento com cla)');
const salvo = s.lotesParaSalvar().find((o) => o.id === L.def.id);
ok(salvo?.dados.bauCla?.some((o) => o?.k === 'lenha'), 'o Baú do Clã vai para o banco');

// recrutas: farm vai para o baú
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = r.x + 1; a.z = r.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' }); s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const [m1, m2] = p.cla.m, x1 = s.recrutasNoMundo(a).find((x) => x.AMIGA.id === m1.id), x2 = s.recrutasNoMundo(a).find((x) => x.AMIGA.id === m2.id);
x1.amiga.prog.mochila[5] = { k: 'minerio_ferro', n: 12 };
s.depositarRecruta(x1);
ok(contar(L.bauCla, 'minerio_ferro') === 12 && contar(x1.amiga.prog.mochila, 'minerio_ferro') === 0, 'recruta guarda o que farmou no Baú do Clã');
ok(s.claInfo(a).bauCla?.minerio_ferro === 12, 'o painel mostra o Baú do Clã');

// fazenda
for (const c of ['-27,56', '-26,56', '-25,56']) { p.vigor = { v: 999, t: Date.now() }; a.x = -26; a.z = 57; s.horta('A', { acao: 'arar', c }); }
ok(Object.keys(L.horta).length === 3, 'arou 3 canteiros');
p.cla.cofre = 1000;
s.cla('A', { acao: 'funcao', id: m2.id, fn: { k: 'fazenda', s: 'rabanete' } });
const b = x2.amiga; b.x = -24; b.z = 58; b.prog.vigor = { v: 100, t: Date.now() };
for (let i = 0; i < 240; i++) s.passo(0.25);
const plantados = Object.values(L.horta).filter((t) => t.c === 'rabanete').length;
ok(plantados === 3, `Fazenda: plantou rabanete nos 3 canteiros (${plantados})`);
ok(p.cla.cofre < 1000, `comprou semente com o cofre (${p.cla.cofre})`);
for (const t of Object.values(L.horta)) { t.g = PLANTAS.rabanete.G + 1; t.w = Date.now(); t.u = Date.now(); }
b.ia.faz = null;
for (let i = 0; i < 240; i++) s.passo(0.25);
ok(contar(L.bauCla, 'rabanete') > 0, `colheu e guardou no Baú do Clã (${contar(L.bauCla, 'rabanete')})`);

// clã bot: o líder dá funções e o baú dele existe sem peça
{
  const s2 = new Simulacao(MAPA_CLAREIRA);
  const q = s2.adicionarJogador('Q', 'Quim', undefined, { conta: 12 }); q.criando = false;
  s2.carregarClasNpc(null);
  for (const ctx of s2.amigosIa) ctx.amigaEntrar('Q', false);
  const E = s2.clasNpc.geada, gael = s2.liderNpc({ lider: 'gael' });
  gael.prog.ouro = 99999; E.prox = 0;
  s2.passoClasNpc();
  ok(E.m.length === 1 && E.m[0].fn?.k, `Gael contratou e deu função (${E.m[0]?.fn?.k})`);
  const x = s2.amigosIa.find((o) => o.AMIGA.id === E.m[0].id);
  x.amiga.prog.mochila[6] = { k: 'pedra', n: 7 };
  s2.depositarRecruta(x);
  ok(contar(E.bau || [], 'pedra') === 7, 'recruta do clã bot guarda no Baú do Clã do líder');
}
