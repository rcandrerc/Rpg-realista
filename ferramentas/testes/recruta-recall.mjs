// Recruta usa a casinha (recall) para levar o recurso ao Baú do Clã (André 2026-11-24: "além de totem, eles podem usar o
// recall para guardar as coisas no baú"). Longe (> CLA.recall.min m): canaliza parado VOLTA_VILA.canal s, aparece na
// frente do baú, deixa e fica com a recarga de 10 min, igual ao jogador. Perto, ou em recarga: vai andando.
// Uso: node ferramentas/testes/recruta-recall.mjs
import { Simulacao, MAPA_CLAREIRA, contar } from '../../shared/index.js';
import { CLA, VOLTA_VILA } from '../../shared/dados.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.x = -24; a.z = 59; a.prog.ouro = 90000; a.prog.nivel = 30;
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 });
const p = a.prog, L = s.loteDe(a);
p.mochila.fill(null); p.mochila[0] = { k: 'obra_bau_cla', n: 1 };
s.cla('A', { acao: 'fundar', nome: 'Recall' }); p.cla.nv = 6;
s.construir('A', { k: 'bau_cla', x: -21.5, z: 61, r: 0 });
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = r.x + 1; a.z = r.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const m = p.cla.m[0], x = s.recrutasNoMundo(a).find((o) => o.AMIGA.id === m.id), b = x.amiga;
b.prog.prof = { ...b.prog.prof, min: 5000 }; b.prog.mochila[7] = { k: 'picareta', n: 1 }; b.prog.vigor = { v: 100, t: Date.now() };
s.cla('A', { acao: 'funcao', id: m.id, fn: { k: 'recurso', r: 'ferro' } });
const P = s.lugarBauCla(s.claDoRecruta(x));
ok(!!P, 'o baú do clã está no mapa');
const levar = (dx, n) => {
  b.ia.encomenda = null; b.ia.av = { fase: 'voltar' }; b.ia.viagem = null;
  b.prog.mochila[9] = { k: 'minerio_ferro', n };
  b.x = P.x + dx; b.z = P.z; b.y = s.terreno.altura(b.x, b.z); b.chao = true;
};
// 1) longe: canaliza e aparece no baú
levar(CLA.recall.min + 60, 20);
const base = contar(L.bauCla || [], 'minerio_ferro');
let comecou = false; for (let i = 0; i < 8 && !comecou; i++) { s.passo(0.25); comecou = !!b.vila?.para; }
ok(comecou, 'longe do baú: começou a casinha');
const x0 = b.x, z0 = b.z;
let t = 0, pulo = null;
for (; t < 4 * (VOLTA_VILA.canal + 6) && contar(L.bauCla || [], 'minerio_ferro') === base; t++) {
  const px = b.x, pz = b.z; s.passo(0.25);
  if (!pulo && Math.hypot(b.x - px, b.z - pz) > 20) pulo = { t: t / 4, de: Math.hypot(px - x0, pz - z0) };
}
ok(pulo && pulo.de < 1, `ficou parado canalizando e só então foi (${pulo?.t} s)`);
ok(pulo && pulo.t >= VOLTA_VILA.canal - 0.5, 'esperou o canal inteiro');
ok(contar(L.bauCla || [], 'minerio_ferro') === base + 20, 'deixou 20 de ferro no baú');
ok((b.prog.vilaAte || 0) > Date.now() + (VOLTA_VILA.cd - 30) * 1000, 'ficou com a recarga de 10 min');
// 2) em recarga: vai andando (sem casinha)
levar(CLA.recall.min + 60, 5);
for (let i = 0; i < 8; i++) s.passo(0.25);
ok(!b.vila, 'em recarga: não usa a casinha');
// 3) perto: anda
b.prog.vilaAte = 0; levar(40, 5);
for (let i = 0; i < 8; i++) s.passo(0.25);
ok(!b.vila, `perto (40 m): vai andando`);
