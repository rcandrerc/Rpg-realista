// Chama x Geada (André 2026-11-18, fase 1): a Geada (Kira, Rufo, Lis) mora no Juncal, a mesma raça não se ataca, a outra
// raça sim fora da zona segura e acima da Trégua (Nv 30); morte de guerra não tira XP nem desgasta (2026-11-22); falas por peças com memória.
// Uso: node ferramentas/testes/guerra.mjs
import { Simulacao, MAPA_CLAREIRA, GUERRA, RIVAIS, FALAS_GUERRA, TOTENS, RACAS } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {}); d.conta = 'c1';
for (const x of s.amigosIa) x.amigaEntrar('andre');
const ctx = (id) => s.amigoIaDe(id), kira = ctx('kira').amiga, rufo = ctx('rufo').amiga, lis = ctx('lis').amiga, dario = ctx('dario').amiga;
ok(kira && rufo && lis && [kira, rufo, lis].every((o) => s.racaDe(o) === 'geada'), 'Kira, Rufo e Lis entram, da Geada');
ok(s.racaDe(d) === 'chama' && s.racaDe(dario) === 'chama' && s.racaDe(s.amiga) === 'chama', 'André, Dario e Cecília são da Chama');
ok([kira, rufo, lis].every((o) => (o.prog.nivel | 0) > GUERRA.tregua), `a Geada começa acima da Trégua: ${[kira, rufo, lis].map((o) => o.prog.nivel).join(', ')}`);
const C = RACAS.geada.casa;
ok([kira, rufo, lis].every((o) => Math.hypot(o.x - C.x, o.z - C.z) < 20), 'aparecem no Juncal');
ok(!s.eventos.some((e) => e.t === 'amiga' && ['kira', 'rufo', 'lis'].includes(e.id)), 'não viram amigo virtual (nada de evento "amiga")');
// zona segura
ok(s.zonaSeguraGuerra(TOTENS.lista[1].x + 4, TOTENS.lista[1].z) && !s.zonaSeguraGuerra(TOTENS.lista[1].x + 8, TOTENS.lista[1].z), 'totem: 4 m é seguro, 8 m é guerra (André 2026-11-22: 5 m)');
const v5 = s.cacas.find((c) => c.def.id === 'c_v5').def, caca5 = s.cacas.find((c) => c.def.id === 'caca5').def;
ok(!s.zonaSeguraGuerra(v5.x, v5.z), 'campo Nv 45 (c_v5) é zona de guerra');
ok(!s.zonaSeguraGuerra(caca5.x, caca5.z), 'campo Nv 10 não é mais seguro (André 2026-11-21: só vila, totem, terreno, mercador e cais)');
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
ok(d.morto && d.prog.xp === 1000 && (d.prog.equip.corpo.d ?? 100) === 100, `morte de guerra: XP igual (${d.prog.xp}), equipamento não desgasta (André 2026-11-22) (${d.prog.equip.corpo.d})`);
const mem = kira.guerraMem[d.conta || d.nome || d.id];
ok(mem && mem.v === 1 && !(mem.poupa > Date.now()), 'a Kira lembra que derrubou, sem trégua depois (André 2026-11-21: quem fica ali é caçado)');
ok(s.eventos.slice(ev0).some((e) => e.t === 'chat' && e.canal === 'local' && e.c === 'a:kira'), 'a Kira fala (no Local) quando derruba');
// cérebro: Rufo (coragem alta) ataca quem chega perto no campo
for (let i = 0; i < 20 * 6; i++) s.passo(0.05); // André renasce
ok(!d.morto && !s.protegido(d), 'levantou sem proteção (André 2026-11-22: renasce no totem ou na vila; saiu, pode ser atacado)');
d.protGuerraAte = 0;
nivel(d, 42); por(d, v5.x, v5.z); por(rufo, v5.x + 8, v5.z); por(kira, C.x, C.z); por(lis, C.x + 2, C.z);
rufo.ia.guerra = null; rufo.ia.falaGuerraT = -1e9; rufo.vida = rufo.vidaMax;
for (let i = 0; i < 20 * 3; i++) { d.entrada = { mx: 0, mz: 0 }; s.passo(0.05); }
ok(rufo.ia.guerra?.alvo === d.id, 'o Rufo parte para cima do André');
ok(d.vida < d.vidaMax || Math.hypot(rufo.x - d.x, rufo.z - d.z) < (rufo.modo === 'Magia' ? 9 : 3), 'e chega ou bate (de espada colado; de cajado a até 9 m)');
// André entra na zona segura (totem): o Rufo larga
const T = TOTENS.lista.find((t) => t.id === 'juncos'); por(d, T.x + 3, T.z); por(rufo, T.x + 30, T.z);
for (let i = 0; i < 20 * 2; i++) s.passo(0.05);
ok(!d.guerra && rufo.ia.guerra?.alvo !== d.id, 'no totem o André fica em paz');
// falas: peças, placeholders, sem repetir
const ck = ctx('kira'); kira.ia.ditasGuerra = [];
const ditas = new Set(); for (let i = 0; i < 6; i++) ditas.add(ck.montarFalaGuerra('mata', d));
ok(ditas.size >= 4 && [...ditas].every((t) => !/\{/.test(t)), `falas variadas e montadas: ${[...ditas].join(' | ')}`);
// André 2026-11-18: "para a Chama, os da Geada são como monstros": conversa/time pelo NPC é recusada com fala
por(kira, d.x + 2, d.z); const ev1 = s.eventos.length; ck.conversaAmiga('andre', { acao: 'time' });
ok(!kira.time && s.eventos.slice(ev1).some((e) => e.t === 'fala' && e.para === 'andre' && e.npc === 'kira'), 'Chama chamando a Kira pro time: ela recusa');
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
ok(Object.keys(FALAS_GUERRA).every((k) => ['kira', 'rufo', 'lis', 'gael', 'dario', 'lia'].includes(k)) && RIVAIS.length === 4, '4 da Geada (Kira, Rufo, Lis, Gael); falas de guerra também do Dario e da Lia');

// André 2026-11-18: "se você for do lado de Geada, aí você consegue dar trade, duelo... tudo igualzinho que eu faço com o Dário"
{
  const s2 = new Simulacao(MAPA_CLAREIRA);
  const g = s2.adicionarJogador('gelo', 'Gelo', 'ruiva', {}); g.raca = 'geada';
  for (const x of s2.amigosIa) x.amigaEntrar('gelo');
  const k2 = s2.amigoIaDe('kira').amiga, d2 = s2.amigoIaDe('dario').amiga;
  ok(!s2.outraRaca(g, k2) && s2.outraRaca(g, d2), 'jogador da Geada: a Kira é do lado dele, o Dario é inimigo');
  ok(s2.eventos.some((e) => e.t === 'amiga' && e.para === 'gelo' && e.id === 'kira') && !s2.eventos.some((e) => e.t === 'amiga' && e.para === 'gelo' && e.id === 'dario'), 'a Kira vira amigo virtual dele (como o Dario para a Chama); o Dario não');
  g.prog.nivel = 45; s2.aplicarStatus(g); Object.assign(g, { x: v5.x, z: v5.z }); Object.assign(k2, { x: v5.x + 2, z: v5.z }); Object.assign(d2, { x: v5.x + 3, z: v5.z }); d2.prog.nivel = 45;
  s2.guerraT = 0; s2.passo(0.05);
  ok(!s2.inimigosDe(g).includes(k2) && s2.inimigosDe(g).includes(d2), 'o ataque dele pega o Dario e não a Kira');
  const ev = s2.eventos.length; s2.duelo('gelo', { acao: 'pedir', com: k2.id });
  ok(!s2.eventos.slice(ev).some((e) => e.t === 'fala' && e.npc === 'kira' && /Chama|inimigos|Recuso|Nem/.test(e.texto)), 'duelo com a Kira não é recusado pela raça');
}

// ---------- chat Local (André 2026-11-18): quem está perto lê, balão em cima da cabeça, a Geada responde, duplas, feito no Geral ----------
{
  const s3 = new Simulacao(MAPA_CLAREIRA);
  const a = s3.adicionarJogador('a', 'Ana', 'ruiva', {}), b = s3.adicionarJogador('b', 'Beto', 'ruiva', {}), c = s3.adicionarJogador('c', 'Caio', 'ruiva', {});
  Object.assign(a, { conta: 'ca' }); Object.assign(b, { conta: 'cb' }); Object.assign(c, { conta: 'cc' });
  for (const x of s3.amigosIa) x.amigaEntrar('a');
  const todos = []; { const ev0 = s3.evento.bind(s3); s3.evento = (e) => { todos.push(e); return ev0(e); }; } // passo() limpa a fila de eventos: guarda tudo aqui
  const k3 = s3.amigoIaDe('kira').amiga, r3 = s3.amigoIaDe('rufo').amiga, l3 = s3.amigoIaDe('lis').amiga;
  Object.assign(a, { x: v5.x, z: v5.z }); Object.assign(b, { x: v5.x + 10, z: v5.z }); Object.assign(c, { x: v5.x + 200, z: v5.z });
  Object.assign(k3, { x: v5.x + 5, z: v5.z }); Object.assign(r3, { x: C.x, z: C.z }); Object.assign(l3, { x: C.x + 3, z: C.z });
  const msg = s3.chat('a', { canal: 'local', texto: 'cadê o Kael, Kira?' });
  ok(msg && msg.ouvem.includes('ca') && msg.ouvem.includes('cb') && !msg.ouvem.includes('cc'), 'Local: quem está a até 30 m lê; longe não');
  const e0 = s3.eventos.length; s3.receberChat(msg);
  const ev = s3.eventos.slice(e0);
  ok(ev.some((e) => e.t === 'chat' && e.para === 'b' && e.canal === 'local') && !ev.some((e) => e.para === 'c') && ev.some((e) => e.t === 'balao' && e.para === 'b' && e.id === 'a'), 'Local chega a quem está perto, com balão em cima de quem falou');
  ok(!ev.some((e) => e.t === 'chat' && 'ouvem' in e), 'a lista de quem ouve não vai para o app');
  ok(ev.some((e) => e.t === 'chat' && e.para === 'b' && e.texto === 'cadê o Kael, Kira?' && !e.lingua), 'a mesma raça lê normal');
  // língua (André 2026-11-18, "igual no ArcheAge"): a outra raça lê embaralhado, no chat e no balão
  const g = s3.adicionarJogador('g', 'Gil', 'ruiva', {}); Object.assign(g, { conta: 'cg', raca: 'geada', x: v5.x + 6, z: v5.z });
  a.chatT = -99; const eg = s3.eventos.length; s3.receberChat(s3.chat('a', { canal: 'local', texto: 'Cadê o Kael, Kira?' }));
  const cg = s3.eventos.slice(eg).find((e) => e.t === 'chat' && e.para === 'g'), bg = s3.eventos.slice(eg).find((e) => e.t === 'balao' && e.para === 'g');
  ok(cg && cg.lingua === 'chama' && cg.texto !== 'Cadê o Kael, Kira?' && /^[A-Z]\S* \S+ \S+, [A-Z]\S*\?$/.test(cg.texto) && bg?.texto === cg.texto, `a Geada lê a Chama embaralhado: "${cg?.texto}"`);
  ok(s3.linguaDe('Kael', 'chama') === s3.linguaDe('Kael', 'chama') && s3.linguaDe('Kael', 'chama') !== s3.linguaDe('Kael', 'geada'), 'a mesma palavra vira sempre a mesma, e cada raça tem a sua língua');
  const brutas = []; { const rc = s3.receberChat.bind(s3); s3.receberChat = (m) => { brutas.push(m); return rc(m); }; }
  const e1 = todos.length; s3.ouvirLocal('a', 'cadê o Kael, Kira?');
  for (let i = 0; i < 20 * 4; i++) s3.passo(0.05);
  const resp = todos.slice(e1).find((e) => e.t === 'chat' && e.canal === 'local' && e.c === 'a:kira' && e.para === 'a');
  const bruta = brutas.find((m) => m.c === 'a:kira');
  const { FALAS_GUERRA: FG } = await import('../../shared/dados.js');
  ok(bruta && FG.kira.lingua.some((f) => bruta.texto.includes(f.replace(/\{nome\}/g, 'Ana'))), `a Kira não entende a Chama e responde isso: "${bruta?.texto}"`);
  ok(resp && resp.lingua === 'geada' && resp.texto !== bruta.texto, `e a Ana lê a Kira embaralhado: "${resp?.texto}"`);
  ok(todos.slice(e1).some((e) => e.t === 'chat' && e.para === 'g' && e.c === 'a:kira' && e.texto === bruta.texto), 'o Gil (Geada) lê a Kira normal');
  ok(todos.slice(e1).some((e) => e.t === 'balao' && e.id === k3.id), 'com balão em cima dela');
  Object.assign(g, { x: v5.x + 300, z: v5.z });
  // duplas: Rufo e Lis juntos, alguém perto ouvindo
  Object.assign(b, { x: C.x + 4, z: C.z }); Object.assign(r3, { x: C.x, z: C.z }); Object.assign(l3, { x: C.x + 3, z: C.z }); s3.duplaT = 0; const e2 = todos.length;
  for (let i = 0; i < 20 * 5; i++) s3.passo(0.05);
  const falas = todos.slice(e2).filter((e) => e.t === 'chat' && e.canal === 'local' && e.para === 'b' && ['a:rufo', 'a:lis', 'a:kira', 'a:gael'].includes(e.c));
  ok(falas.length >= 2 && new Set(falas.map((e) => e.c)).size >= 2, `dois da Geada conversam entre si: ${falas.map((e) => e.nome + ': ' + e.texto).join(' / ')}`);
  // feito no Geral, no máximo 1 a cada 10 min
  let anuncios = []; s3.aoAnuncio = (m) => anuncios.push(m);
  for (const o of [a, k3]) { o.prog.nivel = 45; s3.aplicarStatus(o); }
  Object.assign(a, { x: v5.x, z: v5.z }); Object.assign(k3, { x: v5.x + 2, z: v5.z }); s3.guerraT = 0; s3.passo(0.05);
  s3.ferir(a, 1e6, k3);
  ok(anuncios.length === 1 && /Kira \(Geada\) derrubou Ana \(Chama\)/.test(anuncios[0].texto), `feito no Geral: "${anuncios[0]?.texto}"`);
  for (let i = 0; i < 20 * 6; i++) s3.passo(0.05); s3.guerraT = 0; s3.passo(0.05); s3.ferir(a, 1e6, k3);
  ok(anuncios.length === 1, 'o segundo em menos de 10 min não vai para o Geral');
}
// alerta com o inimigo dentro da vila (André 2026-11-22: "o Rufo estava na vila e eu passei fora, não acionou alarme")
{
  const s4 = new Simulacao(MAPA_CLAREIRA);
  const a = s4.adicionarJogador('a4', 'Ana', 'ruiva', {}); a.conta = 'c4';
  for (const x of s4.amigosIa) x.amigaEntrar('a4');
  const r4 = s4.amigoIaDe('rufo').amiga; const C4 = RACAS.geada.casa;
  a.prog.nivel = 40; s4.aplicarStatus(a); a.vida = a.vidaMax;
  Object.assign(r4, { x: C4.x + 3, z: C4.z }); Object.assign(a, { x: C4.x + 28, z: C4.z, y: s4.terreno.altura(C4.x + 28, C4.z) });
  const ev = []; const e0 = s4.evento.bind(s4); s4.evento = (e) => { ev.push(e); return e0(e); };
  s4.guerraT = 0; s4.passo(0.05);
  ok(a.guerra && s4.zonaSeguraGuerra(r4.x, r4.z), 'Ana fora do totem (guerra), Rufo perto do totem do Juncal (seguro)');
  ok(ev.some((e) => e.t === 'aviso' && e.para === 'a4' && /Rufo/.test(e.texto)), 'o alerta de 25 m dispara mesmo com o Rufo dentro da vila');
}
// a foto por área de interesse leva raça, zona de guerra e proteção de quem está perto (André 2026-11-22: "continuo não
// conseguindo atacar os Geada": server/visao.js não mandava guerra/prot/raca e o app nunca achava alvo)
{
  const { Visao } = await import('../../server/visao.js');
  const s5 = new Simulacao(MAPA_CLAREIRA);
  const a = s5.adicionarJogador('a5', 'Ana', 'ruiva', {}); a.conta = 'c5';
  for (const x of s5.amigosIa) x.amigaEntrar('a5');
  const k5 = s5.amigoIaDe('kira').amiga, v5b = s5.cacas.find((c) => c.def.id === 'c_v5').def;
  a.prog.nivel = 40; s5.aplicarStatus(a); a.vida = a.vidaMax;
  Object.assign(a, { x: v5b.x, z: v5b.z, y: s5.terreno.altura(v5b.x, v5b.z) }); Object.assign(k5, { x: v5b.x + 3, z: v5b.z, y: s5.terreno.altura(v5b.x + 3, v5b.z) });
  s5.guerraT = 0; s5.passo(0.05);
  const V = new Visao(), foto = s5.foto();
  const sai = JSON.parse(V.paraJogador(V.preparar(foto, s5.eventos), 'a5'));
  const kk = (sai.foto?.jogadores || []).find((o) => o.id === k5.id);
  ok(kk && kk.raca === 'geada' && kk.guerra === 1 && kk.prot === 0, `o app recebe a Kira com raça, guerra e proteção: ${JSON.stringify(kk && { raca: kk.raca, guerra: kk.guerra, prot: kk.prot })}`);
}
// Pó de rastreio (André 2026-11-22): gasta um, 5 min no mapa, 30 min de recarga gravada; 3 de presente na conta de teste
{
  const { Visao } = await import('../../server/visao.js');
  const { contar } = await import('../../shared/progresso.js');
  const s6 = new Simulacao(MAPA_CLAREIRA);
  const a = s6.adicionarJogador('a6', 'Ana', 'ruiva', { testador: true }); a.conta = 'c6';
  for (const x of s6.amigosIa) x.amigaEntrar('a6');
  ok(contar(a.prog.mochila, 'rastreio') === GUERRA.radar.presente && a.prog.rgDado === 1, `conta de teste ganha ${GUERRA.radar.presente} Pós de rastreio`);
  const b = s6.adicionarJogador('b6', 'Bia', 'ruiva', { testador: true, progresso: a.prog });
  ok(contar(b.prog.mochila, 'rastreio') === GUERRA.radar.presente, 'o presente sai uma vez só');
  s6.passo(0.05);
  const i = a.prog.mochila.findIndex((o) => o?.k === 'rastreio');
  const ev = []; const e0 = s6.evento.bind(s6); s6.evento = (e) => { ev.push(e); return e0(e); };
  s6.item('a6', { acao: 'usar', i });
  ok(contar(a.prog.mochila, 'rastreio') === GUERRA.radar.presente - 1 && a.radarGuerraAte > s6.tempo && a.prog.rgCd > Date.now() + 1700e3, 'usar gasta um e liga por 5 min');
  ok(ev.some((e) => e.t === 'aviso' && e.para === 'a6' && /Rastreio: \d+ da outra raça/.test(e.texto)), `aviso: ${ev.find((e) => e.para === 'a6' && e.t === 'aviso')?.texto}`);
  s6.passo(0.05);
  const eu = s6.foto().jogadores.find((o) => o.id === 'a6');
  ok(eu.rg > 290 && eu.rg <= 300, `a foto diz quanto falta (${eu.rg} s)`);
  ev.length = 0; s6.item('a6', { acao: 'usar', i: a.prog.mochila.findIndex((o) => o?.k === 'rastreio') });
  ok(contar(a.prog.mochila, 'rastreio') === GUERRA.radar.presente - 1 && ev.some((e) => e.t === 'aviso' && /pronto em 30 min/.test(e.texto)), 'na recarga não gasta e diz quanto falta');
  const { progressoValido } = await import('../../shared/progresso.js');
  ok(progressoValido(JSON.parse(JSON.stringify(a.prog))).rgCd === a.prog.rgCd, 'a recarga fica gravada (sair e voltar não zera)');
  for (let k = 0; k < 20 * 301; k++) s6.tempo += 0.05;
  ok(!s6.foto().jogadores.find((o) => o.id === 'a6').rg, 'depois de 5 min some');
  const V = new Visao(); V.passos = 0; const sai = JSON.parse(V.paraJogador(V.preparar(s6.foto(), []), 'a6'));
  const kira6 = s6.amigoIaDe('kira').amiga;
  ok((sai.foto.mapa || []).some((l) => l[0] === kira6.id && l[3] === 'geada'), 'a lista do mapa leva a raça (o app esconde a outra raça longe sem o rastreio)');
}
