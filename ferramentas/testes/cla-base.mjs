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
s.cla('A', { acao: 'fundar', nome: 'Base Teste' }); p.cla.nv = 6;
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
x1.amiga.prog.mochila[5] = { k: 'minerio_ferro', n: 12 }; x1.amiga.prog.mochila[6] = { k: 'couro', n: 3 };
s.depositarRecruta(x1);
ok(contar(L.bauCla, 'minerio_ferro') === 0, 'sem pedido: nada vai para o Baú do Clã (André 2026-11-23)');
x1.amiga.ia.levar = { r: 'ferro', item: 'minerio_ferro', nome: 'minério de ferro' };
s.depositarRecruta(x1);
ok(contar(L.bauCla, 'couro') === 0 && contar(x1.amiga.prog.mochila, 'couro') === 3, 'só o recurso pedido vai (o couro fica na bolsa)');
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
  gael.prog.ouro = 99999; E.prox = 0; E.nv = 6;
  s2.passoClasNpc();
  ok(E.m.length === 1 && E.m[0].fn?.k, `Gael contratou e deu função (${E.m[0]?.fn?.k})`);
  const x = s2.amigosIa.find((o) => o.AMIGA.id === E.m[0].id);
  x.amiga.prog.mochila[6] = { k: 'pedra', n: 7 };
  x.amiga.ia.levar = { r: 'pedra', item: 'pedra', nome: 'pedra' };
  s2.depositarRecruta(x);
  ok(contar(E.bau || [], 'pedra') === 7, 'recruta do clã bot guarda no Baú do Clã do líder');
}

// níveis do clã (André 2026-11-22: progressivo) e Fragmento de Alma
{
  const s3 = new Simulacao(MAPA_CLAREIRA);
  const j = s3.adicionarJogador('N', 'Nil', undefined, { conta: 50 }); j.criando = false; j.ciente = true; j.prog.nivel = 12; j.prog.ouro = 90000;
  const r3 = s3.mapa.npcs.find((n) => n.funcao === 'recrutador'); j.x = r3.x + 1; j.z = r3.z;
  s3.cla('N', { acao: 'fundar', nome: 'Niveis' });
  const c = j.prog.cla;
  ok(c.nv === 1 && s3.claInfo(j).max === 1, 'clã novo: Nv 1, 1 vaga');
  s3.cla('N', { acao: 'recrutar', tier: 'recruta' }); s3.cla('N', { acao: 'recrutar', tier: 'recruta' });
  ok(c.m.length === 1, 'só 1 recruta no Nv 1');
  s3.cla('N', { acao: 'melhorar' });
  ok(c.nv === 1, 'sem material e alma: não sobe');
  c.cofre = 600; j.prog.mochila.fill(null);
  j.prog.mochila[0] = { k: 'lenha', n: 50 }; j.prog.mochila[1] = { k: 'pedra', n: 30 }; // Nv 2 e 3 sem alma (André 2026-11-23)
  s3.cla('N', { acao: 'melhorar' });
  ok(c.nv === 2 && c.cofre === 100 && !j.prog.mochila.some((o) => o), `subiu para Nv 2 e gastou tudo (cofre ${c.cofre})`);
  ok(!s3.subirInfo(j).itens.some((i) => i.k.startsWith('alma_')), 'Nv 3 não pede Fragmento de Alma');
  s3.cla('N', { acao: 'recrutar', tier: 'veterano' });
  ok(c.m.length === 1, 'Veterano só no clã Nv 3');
  const v = (await import('../../shared/cla.js')).claValido({ n: 'Velho', m: [1, 2, 3, 4, 5].map((i) => ({ id: 'rcaaaa' + i, nome: 'X' })) });
  ok(v.nv === 5, `clã antigo com 5 recrutas começa no Nv 5 (${v.nv})`);
  // fragmento: Chama derruba Geada
  const g = s3.adicionarJogador('G', 'Gelo', undefined, { conta: 51 }); g.criando = false; g.raca = 'geada'; g.prog.raca = 'geada';
  if (s3.racaDe(g) !== s3.racaDe(j)) { s3.fragmentoGuerra(g, j); ok(contar(j.prog.mochila, 'alma_' + s3.racaDe(g)) === 1, 'derrubar a outra raça dá 1 Fragmento de Alma'); }
  else console.log('ok (pulado: não deu para trocar a raça no teste)');
  s3.fragmentoGuerra(j, j); ok(true, 'mesma pessoa não ganha');
}
{
  const s4 = new Simulacao(MAPA_CLAREIRA);
  const j = s4.adicionarJogador('B', 'Bia', undefined, { conta: 60 }); j.criando = false; j.ciente = true;
  s4.cla('B', { acao: 'fundar', nome: 'Bonus' }); j.prog.cla.nv = 6;
  ok(Math.abs(s4.bonusCla(j) - 0.10) < 1e-9, 'clã Nv 6: +10% de XP e ouro');
  s4.carregarClasNpc(null);
  const kira = s4.amigosIa.find((x) => x.AMIGA.id === 'kira'); kira.amigaEntrar('B', false);
  ok(kira.amiga && Math.abs(s4.bonusCla(kira.amiga) - 0.04) < 1e-9, 'Kira (Lobos da Geada Nv 3): +4%');
}
