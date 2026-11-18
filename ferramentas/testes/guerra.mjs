// Chama x Geada (André 2026-11-18, fase 1): a Geada (Kira, Rufo, Lis) mora no Juncal, a mesma raça não se ataca, a outra
// raça sim fora da zona segura e acima da Trégua (Nv 30); morte de guerra só desgasta; falas por peças com memória.
// Uso: node ferramentas/testes/guerra.mjs
import { Simulacao, MAPA_CLAREIRA, GUERRA, RIVAIS, FALAS_GUERRA, TOTENS, RACAS } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre');
const ctx = (id) => s.amigoIaDe(id), kira = ctx('kira').amiga, rufo = ctx('rufo').amiga, lis = ctx('lis').amiga, dario = ctx('dario').amiga;
ok(kira && rufo && lis && [kira, rufo, lis].every((o) => s.racaDe(o) === 'geada'), 'Kira, Rufo e Lis entram, da Geada');
ok(s.racaDe(d) === 'chama' && s.racaDe(dario) === 'chama' && s.racaDe(s.amiga) === 'chama', 'André, Dario e Cecília são da Chama');
ok([kira, rufo, lis].every((o) => (o.prog.nivel | 0) > GUERRA.tregua), `a Geada começa acima da Trégua: ${[kira, rufo, lis].map((o) => o.prog.nivel).join(', ')}`);
const C = RACAS.geada.casa;
ok([kira, rufo, lis].every((o) => Math.hypot(o.x - C.x, o.z - C.z) < 20), 'aparecem no Juncal');
ok(!s.eventos.some((e) => e.t === 'amiga' && ['kira', 'rufo', 'lis'].includes(e.id)), 'não viram amigo virtual (nada de evento "amiga")');
// zona segura
ok(s.zonaSeguraGuerra(TOTENS.lista[1].x + 20, TOTENS.lista[1].z), 'totem: 20 m é seguro');
const v5 = s.cacas.find((c) => c.def.id === 'c_v5').def, caca5 = s.cacas.find((c) => c.def.id === 'caca5').def;
ok(!s.zonaSeguraGuerra(v5.x, v5.z), 'campo Nv 45 (c_v5) é zona de guerra');
ok(s.zonaSeguraGuerra(caca5.x, caca5.z), 'campo Nv 10 é seguro');
// no campo c_v5: André Nv 40 e a Kira
const nivel = (j, n) => { j.prog.nivel = n; s.aplicarStatus(j); j.vida = j.vidaMax; };
const por = (j, x, z) => Object.assign(j, { x, z, y: s.terreno.altura(x, z) });
nivel(d, 40); por(d, v5.x, v5.z); por(kira, v5.x + 3, v5.z);
s.guerraT = 0; s.passo(0.05);
ok(d.guerra && kira.guerra && s.emGuerra(d, kira), 'no campo Nv 45 os dois estão em guerra');
ok(s.inimigosDe(d).includes(kira) && s.inimigosDe(kira).includes(d), 'um é alvo do outro');
ok(!s.inimigosDe(kira).includes(rufo) && !s.emGuerra(kira, rufo), 'a mesma raça não se ataca');
const v0 = kira.vida; s.ferir(kira, 50, d); ok(kira.vida < v0, 'o golpe da outra raça pega');
const r0 = rufo.vida; por(rufo, v5.x + 2, v5.z + 1); s.ferir(rufo, 50, kira); ok(rufo.vida === r0, 'golpe na mesma raça não pega');
// na Trégua: nada
nivel(d, 25); s.guerraT = 0; s.passo(0.05);
ok(!d.guerra && !s.emGuerra(d, kira) && !s.inimigosDe(kira).includes(d), 'Nv 25: Trégua, ninguém bate');
const v1 = d.vida; s.ferir(d, 50, kira); ok(d.vida === v1, 'na Trégua o golpe não pega');
// morte de guerra: só desgaste, sem XP; quem matou lembra e poupa
nivel(d, 40); d.prog.xp = 1000; d.prog.equip.corpo = { k: 'peitoral', r: 1 }; s.guerraT = 0; s.passo(0.05);
const ev0 = s.eventos.length;
s.ferir(d, 1e6, kira);
ok(d.morto && d.prog.xp === 1000 && d.prog.equip.corpo.d < 100, `morte de guerra: XP igual (${d.prog.xp}), equipamento desgastou (${d.prog.equip.corpo.d})`);
const mem = kira.guerraMem[d.conta || d.nome || d.id];
ok(mem && mem.v === 1 && mem.poupa > Date.now(), 'a Kira lembra que derrubou e vai poupar por um tempo');
ok(s.eventos.slice(ev0).some((e) => e.t === 'fala' && e.npc === 'kira'), 'a Kira fala quando derruba');
// cérebro: Rufo (coragem alta) ataca quem chega perto no campo
for (let i = 0; i < 20 * 6; i++) s.passo(0.05); // André renasce
nivel(d, 42); por(d, v5.x, v5.z); por(rufo, v5.x + 8, v5.z); por(kira, C.x, C.z); por(lis, C.x + 2, C.z);
rufo.ia.guerra = null; rufo.ia.falaGuerraT = -1e9; rufo.vida = rufo.vidaMax;
for (let i = 0; i < 20 * 3; i++) { d.entrada = { mx: 0, mz: 0 }; s.passo(0.05); }
ok(rufo.ia.guerra?.alvo === d.id, 'o Rufo parte para cima do André');
ok(d.vida < d.vidaMax || Math.hypot(rufo.x - d.x, rufo.z - d.z) < 3, 'e chega ou bate');
// André entra na zona segura (totem): o Rufo larga
const T = TOTENS.lista.find((t) => t.id === 'juncos'); por(d, T.x + 5, T.z); por(rufo, T.x + 30, T.z);
for (let i = 0; i < 20 * 2; i++) s.passo(0.05);
ok(!d.guerra && rufo.ia.guerra?.alvo !== d.id, 'no totem o André fica em paz');
// falas: peças, placeholders, sem repetir
const ck = ctx('kira'); kira.ia.ditasGuerra = [];
const ditas = new Set(); for (let i = 0; i < 6; i++) ditas.add(ck.montarFalaGuerra('mata', d));
ok(ditas.size >= 4 && [...ditas].every((t) => !/\{/.test(t)), `falas variadas e montadas: ${[...ditas].join(' | ')}`);
// conversar: tocou e escolheu Conversar
por(kira, d.x + 2, d.z); const ev1 = s.eventos.length; ck.conversaAmiga('andre', { acao: 'conversa' });
ok(s.eventos.slice(ev1).some((e) => e.t === 'fala' && e.para === 'andre' && e.npc === 'kira'), 'Conversar com a Kira: ela responde');
// bloqueios: time, troca, duelo com a outra raça
const ev2 = s.eventos.length;
s.time('andre', { acao: 'convidar', com: kira.id }); s.troca('andre', { acao: 'pedir', com: kira.id }); s.duelo('andre', { acao: 'pedir', com: kira.id });
ok(!kira.time && !kira.troca && !kira.duelo && s.eventos.slice(ev2).filter((e) => e.npc === 'kira').length >= 1, 'time, troca e duelo com a Geada: recusado');
ok(!s.chat('andre', { canal: 'pm', para: 'a:kira', texto: 'oi' }), 'mensagem privada para a Geada não vai');
// foto: a raça vai para o app
const f = s.foto().jogadores;
ok(f.find((o) => o.id === kira.id)?.raca === 'geada' && !f.find((o) => o.id === 'andre')?.raca, 'na foto: raca=geada só para quem não é da Chama');
// save: a memória vai junto
ck.guardarAmiga(); ok(s.npcSalvos.get('kira')?.guerra?.[d.conta || d.nome || d.id]?.v === 1, 'o placar vai para o save');
ok(Object.keys(FALAS_GUERRA).every((k) => ['kira', 'rufo', 'lis', 'dario'].includes(k)) && RIVAIS.length === 3, '3 contra 3');
