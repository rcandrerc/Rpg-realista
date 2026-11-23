// Missão do Clã: Escolta (André 2026-11-23, shared/missao-cla.js): abre no Baú do Clã com recrutas perto, leva até o
// totem mais perto a 300 m ou mais, emboscadas no nível do líder que vão nos recrutas (o líder segura batendo),
// recruta que cai sai, chegar dá XP aos recrutas de pé, ouro no cofre e alma ao líder.
// Uso: node ferramentas/testes/missao-cla.mjs
import { Simulacao, MAPA_CLAREIRA, CLA, contar } from '../../shared/index.js';
import { acharLugarBase } from '../../shared/base.js';
import { almaDe } from '../../shared/dados.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const avisos = () => { const t = s.eventos.filter((e) => e.t === 'aviso').map((e) => e.texto).join(' | '); s.eventos = []; return t; };
const q = acharLugarBase(-6, 1, 'chama', []);
const j = s.adicionarJogador('L', 'Lia', undefined, { conta: 5 });
j.criando = false; j.ciente = true; j.prog.ouro = 90000; j.prog.nivel = 60; j.x = q.x; j.z = q.z;
s.cla('L', { acao: 'fundar', nome: 'Forno' }); j.prog.cla.nv = 3;
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador');
j.x = r.x + 1; j.z = r.z;
s.cla('L', { acao: 'recrutar', tier: 'recruta' }); s.cla('L', { acao: 'recrutar', tier: 'recruta' });
j.x = q.x; j.z = q.z; s.cla('L', { acao: 'base' });
const B = s.baseDe(j), bau = s.basesDesenho[B.k].bau;
avisos();
j.x = bau.x + 30; s.cla('L', { acao: 'missao' });
ok(/Baú do Clã/.test(avisos()), 'longe do Baú do Clã não abre');
j.x = bau.x; j.z = bau.z + 2;
const recs = s.recrutasNoMundo(j).map((x) => x.amiga).filter(Boolean);
ok(recs.length === 2, 'dois recrutas no mundo');
const junto = (P) => { j.x = P.x; j.z = P.z; recs.forEach((a, i) => { if (!a.morto) { a.x = P.x + 1 + i; a.z = P.z + 1; } }); };
junto({ x: j.x, z: j.z }); recs.forEach((a) => { a.prog.nivel = 8; });
s.cla('L', { acao: 'missao' });
const M = s.missoesCla?.get(B.k);
ok(M && M.rec.size === 2 && M.nv === 60 && M.dest.d >= 300 && /Escolta/.test(avisos()), 'abre com os recrutas perto; destino a 300 m ou mais; monstros no nível do líder');
s.cla('L', { acao: 'missao' });
ok(/já está acontecendo/.test(avisos()), 'não abre duas');
// anda até 20% do caminho: primeira emboscada
const ponto = (f) => ({ x: M.x0 + (M.dest.x - M.x0) * f, z: M.z0 + (M.dest.z - M.z0) * f });
junto(ponto(0.2)); s.passoMissoesCla();
const emb = [...M.mobs];
ok(emb.length === CLA.missao.emboscadas[0].n && emb.every((e) => e.nivel === 60), 'emboscada 1 no nível do líder');
ok(s.inimigosDe(emb[0]).every((o) => o !== j) && s.inimigosDe(emb[0]).length === 2, 'o monstro vai nos recrutas, não no líder');
s.ferir(emb[0], 1, j);
ok(s.inimigosDe(emb[0])[0] === j, 'o líder bateu: o monstro vai nele (segurou)');
// um recruta cai: sai sem prêmio
recs[1].morto = true; s.passoMissoesCla();
ok(M.rec.size === 1 && /caiu/.test(avisos()), 'recruta que cai sai da escolta');
recs[1].morto = false;
const xp0 = recs[0].prog.xp | 0, nv0 = recs[0].prog.nivel, xp1 = recs[1].prog.xp | 0, cofre0 = j.prog.cla.cofre | 0, alma0 = contar(j.prog.mochila, almaDe(s.racaDe(j)));
const matar = () => { for (const m of [...M.mobs]) { m.atacantes = new Set(); s.morrer(m, null); } s.tempo += 4; for (const t of [...s.timers]) if (t.t <= s.tempo) { s.timers.splice(s.timers.indexOf(t), 1); t.fn(); } s.passoMissoesCla(); };
matar();
let txt = '';
for (const f of [0.45, 0.7, 0.9, 1]) { junto(f < 1 ? ponto(f) : { x: M.dest.x, z: M.dest.z }); s.passoMissoesCla(); txt += avisos(); matar(); s.passoMissoesCla(); }
txt += avisos();
ok(/Chefe da Emboscada/.test(txt), 'a última emboscada tem o chefe');
ok(!s.missoesCla.has(B.k) && /cumprida/.test(txt), 'chegou no totem: cumprida');
ok((recs[0].prog.nivel > nv0 || (recs[0].prog.xp | 0) > xp0), 'o recruta de pé ganhou XP');
ok((recs[1].prog.xp | 0) === xp1, 'o que caiu não ganhou');
ok((j.prog.cla.cofre | 0) > cofre0 && contar(j.prog.mochila, almaDe(s.racaDe(j))) === alma0 + 1, 'ouro no cofre e alma para o líder');
j.x = bau.x; j.z = bau.z + 2;
s.cla('L', { acao: 'missao' });
ok(/próxima missão do clã abre em/.test(avisos()), 'espera 6 h para a próxima');
ok(s.baseInfo(j).missao?.espera > 0, 'o painel mostra a espera');
// falha por tempo
B.missaoEm = 0; junto({ x: bau.x, z: bau.z + 2 });
s.cla('L', { acao: 'missao' }); const M2 = s.missoesCla.get(B.k);
junto(ponto(0.2)); s.passoMissoesCla();
s.tempo += CLA.missao.dura + 1; s.passoMissoesCla();
ok(!s.missoesCla.has(B.k) && /tempo acabou/.test(avisos()) && [...M2.mobs].every((m) => !s.inimigos.includes(m)), 'tempo acabou: falha e os monstros somem');
