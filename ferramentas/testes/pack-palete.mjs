// Palete de packs (André 2026-11-23): na base do clã, o pack largado perto de um palete vai pra cima dele e nunca some
// (nem pelo tempo, nem no reinício); 5 por palete; no chão (base ou rua) some em 30 min.
// Uso: node ferramentas/testes/pack-palete.mjs
import { Simulacao, MAPA_CLAREIRA, PALETE, CONSTRUCOES } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
ok(CONSTRUCOES.palete && PALETE.lugar.length === 5, 'palete existe e guarda 5');
s.basesCla = { jb: { k: 'jb', x: 400, z: 200 } };
const L = { def: { id: 'L1', x0: 395, x1: 405, z0: 195, z1: 205 }, dono: 'c1', pecas: [{ id: 'p1', k: 'palete', x: 400, z: 200, r: 0 }] };
s.lotes.set('L1', L);
const j = s.adicionarJogador('z', 'Zé', 'ruiva', {}); j.conta = 'c1';
const ev = []; const e0 = s.evento.bind(s); s.evento = (e) => { ev.push(e); return e0(e); };
const largar = (x, z) => { Object.assign(j, { x, z, ry: 0 }); j.prog.pack = { k: 'couro', ox: 0, oz: 0, ra: 'chama' }; s.pack(j.id, { acao: 'largar' }); };
for (let i = 0; i < 5; i++) largar(401, 200);
ok(s.packsNoPalete('p1').length === 5 && s.packsChao.every((o) => o.fica && o.fim === Infinity), '5 packs em cima do palete, sem prazo');
largar(401, 200); ok(j.prog.pack && ev.some((e) => /Palete cheio/.test(e.texto || '')), 'palete cheio: avisa e o pack fica nas costas');
largar(395.5, 195.5);
const solto = s.packsChao.find((o) => !o.fica);
ok(!!solto && solto.fim < Infinity, 'longe do palete, dentro da base: chão comum (30 min)');
s.tempo += 1801; s.paleteT = 0; s.passoPacks();
ok(s.packsChao.length === 5, 'depois de 30 min só os do palete continuam');
const salvo = s.packsBaseParaSalvar(); ok(salvo?.length === 5 && salvo[0].pal === 'p1', 'grava os do palete');
const s2 = new Simulacao(MAPA_CLAREIRA); s2.basesCla = s.basesCla; s2.lotes.set('L1', L); s2.carregarPacksBase(JSON.parse(JSON.stringify(salvo)));
ok(s2.packsNoPalete('p1').length === 5, 'voltam depois do reinício');
s2.carregarPacksBase([{ k: 'couro', ox: 0, oz: 0, x: 400, z: 200, bk: 'jb' }]); ok(s2.packsChao.length === 5, 'o pack solto do #808 (sem palete) não volta');
// palete fora da base não guarda
s.lotes.set('L2', { def: { id: 'L2', x0: 0, x1: 10, z0: 0, z1: 10 }, dono: 'c1', pecas: [{ id: 'p2', k: 'palete', x: 800, z: 800, r: 0 }] });
largar(801, 800); ok(!s.packsNoPalete('p2').length, 'palete fora da base do clã não guarda');
// palete sumiu: os de cima viram pack comum
L.pecas = []; s.paleteT = 0; s.passoPacks();
ok(s.packsChao.filter((o) => o.fica).length === 0 && s.packsChao.some((o) => o.fim < Infinity), 'palete sumiu: os packs viram comuns (30 min)');
// André 2026-11-23: só o clã dono da base pega o pack do palete (líder e recrutas)
{
  const s3 = new Simulacao(MAPA_CLAREIRA); s3.basesCla = { jc1: { k: 'jc1', x: 400, z: 200 } };
  s3.lotes.set('L1', { def: { id: 'L1', x0: 395, x1: 405, z0: 195, z1: 205 }, dono: 'c1', pecas: [{ id: 'p1', k: 'palete', x: 400, z: 200, r: 0 }] });
  const dono = s3.adicionarJogador('a', 'Ana', 'ruiva', {}); dono.conta = 'c1';
  const fora = s3.adicionarJogador('b', 'Bia', 'ruiva', {}); fora.conta = 'c2';
  Object.assign(dono, { x: 401, z: 200, ry: 0 }); dono.prog.pack = { k: 'couro', ox: 0, oz: 0 }; s3.pack(dono.id, { acao: 'largar' });
  const g = s3.packsChao[0].g;
  Object.assign(fora, { x: 401, z: 200 }); s3.pack(fora.id, { acao: 'pegar', g });
  ok(!fora.prog.pack && s3.packsChao.length === 1, 'quem é de fora não pega do palete');
  s3.pack(dono.id, { acao: 'pegar', g }); ok(!!dono.prog.pack && !s3.packsChao.length, 'o dono da base pega');
}
