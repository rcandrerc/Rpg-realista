// Pack guardado na terra do clã (André 2026-11-23): dentro da base do clã não some (nem 30 min, nem limite, nem reinício).
// Fora dali, some em 30 min como antes. Uso: node ferramentas/testes/pack-terra-cla.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
s.basesCla = { jteste: { k: 'jteste', x: 400, z: 200 } };
const pk = { k: 'couro', ox: 0, oz: 0, ra: 'chama' };
ok(s.packNoChao(pk, 410, 205) === true, 'dentro da base: fica');
ok(s.packNoChao(pk, 600, 600) === false, 'longe da base: some como antes');
s.tempo += 1801; s.passoPacks();
ok(s.packsChao.length === 1 && s.packsChao[0].fica, 'depois de 30 min só o da base continua');
for (let i = 0; i < 210; i++) s.packNoChao(pk, 700, 700 + i * 0.01);
ok(s.packsChao.some((o) => o.fica), 'o limite de 200 não tira o da base');
const salvo = s.packsBaseParaSalvar(); ok(salvo?.length === 1 && salvo[0].x === 410, 'grava o da base');
ok(s.packsBaseParaSalvar() === null, 'sem mudança, não grava de novo');
const s2 = new Simulacao(MAPA_CLAREIRA); s2.basesCla = s.basesCla; s2.carregarPacksBase(JSON.parse(JSON.stringify(salvo)));
ok(s2.packsChao.length === 1 && s2.packsChao[0].fim === Infinity && s2.packsChao[0].ra === 'chama', 'volta depois do reinício');
s2.packsChao.splice(0, 1); ok(s2.packsBaseParaSalvar()?.length === 0, 'alguém pegou: grava a lista vazia');
// até 100 por base, fora do limite de 200 do mundo aberto (André 2026-11-23)
{
  const s3 = new Simulacao(MAPA_CLAREIRA); s3.basesCla = { jb: { k: 'jb', x: 400, z: 200 } };
  for (let i = 0; i < 100; i++) s3.packNoChao(pk, 401, 201);
  ok(s3.packsNaBase('jb') === 100 && s3.packNoChao(pk, 401, 201) === false, '100 na base: o 101º não fica guardado');
  for (let i = 0; i < 200; i++) s3.packNoChao(pk, 800, 800);
  ok(s3.packsNaBase('jb') === 100 && s3.packsChao.filter((o) => !o.fica).length === 200, 'os 100 da base ficam fora dos 200 do mundo');
  const j = s3.adicionarJogador('z', 'Zé', 'ruiva', {}); Object.assign(j, { x: 401, z: 201, ry: 0 }); j.prog.pack = { ...pk };
  const ev = []; const e0 = s3.evento.bind(s3); s3.evento = (e) => { ev.push(e); return e0(e); };
  s3.pack?.(j.id, { acao: 'largar' });
  ok(j.prog.pack && ev.some((e) => /não cabe mais/.test(e.texto || '')), 'base cheia: largar não deixa e avisa');
}
