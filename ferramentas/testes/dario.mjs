// Dario, o segundo amigo virtual (André 2026-11-11): idêntico à Cecília e separado dela (terreno, mochila, ouro, amizade,
// gostos), os dois entram juntos e podem estar no time do André ao mesmo tempo. E "não vamos caçar" não chama ninguém.
// Uso: node ferramentas/testes/dario.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO, TIME } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
const dario = s.amigoIaDe(DARIO.id), cec = s.amigoIaDe(AMIGA.id);
ok(cec === s && dario && dario !== s && dario.AMIGA === DARIO, 'dois amigos virtuais: a Cecília e o Dario');
for (const x of s.amigosIa) x.amigaEntrar('andre');
const a = s.amiga, b = dario.amiga;
ok(a && b && a !== b && a.id === AMIGA.id && b.id === DARIO.id && b.bot, 'os dois entram com o dono');
const La = cec.loteDaAmiga(), Lb = dario.loteDaAmiga();
ok(La && Lb && La !== Lb && Lb.dono === DARIO.conta && Lb.def.id === 'tdario', `terrenos separados: ${La.def.id} e ${Lb.def.id}`);
ok(Lb.def.x1 <= La.def.x0 || Lb.def.x0 >= La.def.x1 || Lb.def.z1 <= La.def.z0 || Lb.def.z0 >= La.def.z1, 'os terrenos não se sobrepõem');
ok(b.prog !== a.prog && b.prog.mochila !== a.prog.mochila, 'mochila e ouro de cada um');
const f = s.foto().jogadores.find((j) => j.id === DARIO.id);
ok(f && f.visual === 'cabelo_m' && f.bot === 1, 'na foto: corpo masculino, bot');
// cada um levanta a própria casa (começa do zero)
for (let i = 0; i < 20 * 900; i++) s.passo(0.05);
ok(La.pecas.length === AMIGA.casa.length && Lb.pecas.length === DARIO.casa.length, `casas inteiras: ${La.pecas.length} e ${Lb.pecas.length}`);
// time com os dois ao mesmo tempo
const perto = (o) => Object.assign(d, { x: o.x + 1, z: o.z });
const rnd = Math.random; Math.random = () => 0;
perto(a); s.conversaAmiga('andre', { acao: 'time' });
perto(b); dario.conversaAmiga('andre', { acao: 'time' });
Math.random = rnd;
ok(a.time && b.time && a.time === d.time && b.time === d.time && d.time.membros.length === 3 && TIME.max >= 3, `time com os dois: ${d.time?.membros.length} pessoas (máximo ${TIME.max})`);
// amizade e gostos separados
const amzA = a.amizade; dario.gostoAmiga(d, 'pescar');
ok(a.amizade === amzA && !(a.gostos?.[d.conta]?.pescar) && b.gostos[d.conta].pescar === 1, 'gostos de cada um');
// "Amigos virtuais" mostra os dois
const ev0 = s.eventos.length; s.enviarAmigos(d);
const am = s.eventos.slice(ev0).find((e) => e.t === 'amigos' && e.para === 'andre');
ok(am?.virtuais?.length === 2 && am.virtuais.some((v) => v.c === DARIO.conta && v.time), 'os dois em "Amigos virtuais", Dario no time');
// mensagem privada para o Dario vai para ele (o servidor escolhe pelo alvo)
ok(s.chat('andre', { canal: 'pm', para: DARIO.conta, texto: 'e aí' }), 'mensagem privada para o Dario');
// "não vamos caçar" (André 2026-11-11)
ok(s.assuntoAmiga('não vamos caçar') === 'naoAcao' && s.assuntoAmiga('Não, vamos caçar!') === 'time' && s.assuntoAmiga('hoje não quero pescar') === 'naoAcao' && s.assuntoAmiga('não sai do time') === 'naoAcao' && s.assuntoAmiga('bora caçar') === 'time', '"não" antes do pedido cancela a ação');
// sair do time de um não tira o outro
perto(b); dario.conversaAmiga('andre', { acao: 'sair' });
for (let i = 0; i < 20; i++) s.passo(0.05);
ok(!b.time && a.time && d.time === a.time, 'Dario saiu do time, Cecília continua');
// guarda e sai junto com o dono
for (const x of s.amigosIa) x.guardarAmiga();
const salvos = s.lotesParaSalvar();
ok(salvos.find((l) => l.id === 'tdario')?.dados?.amiga?.prog, 'o progresso do Dario vai junto com o terreno dele');
for (const x of s.amigosIa) x.amigaSair('andre');
ok(!s.amiga && !dario.amiga && !s.jogadores.has(DARIO.id), 'os dois saem com o dono');

// ---------- morte (André 2026-11-11): 5% do XP do nível atual para todos, e os amigos consertam sozinhos no Tomás ----------
{
  const { penalidadeMorte, durab } = await import('../../shared/progresso.js');
  const p = { ouro: 1000, xp: 400, nivel: 7, equip: { corpo: { k: 'peitoral', r: 1 } }, mochila: [] };
  const pen = penalidadeMorte(p);
  ok(pen.xp === 20 && p.xp === 380 && p.nivel === 7 && p.ouro === 900, `morrer: -5% do XP do nível (${pen.xp}), -10% do ouro, nível igual`);
  const p0 = { ouro: 0, xp: 0, nivel: 3, equip: {}, mochila: [] }; penalidadeMorte(p0);
  ok(p0.xp === 0 && p0.nivel === 3, 'sem XP no nível: não cai de nível');
  const s4 = new Simulacao(MAPA_CLAREIRA);
  s4.adicionarJogador('andre', 'André', 'ruiva', {});
  const dar4 = s4.amigoIaDe(DARIO.id); dar4.amigaEntrar('andre');
  const b4 = dar4.amiga;
  b4.prog.equip.corpo.d = 0; b4.prog.equip.pes.d = 60; b4.prog.ouro = 5000;
  const ouro0 = b4.prog.ouro, n = dar4.consertoAmiga(b4);
  ok(n === 2 && durab(b4.prog.equip.corpo) === 100 && durab(b4.prog.equip.pes) === 100 && b4.prog.ouro < ouro0, `Dario consertou ${n} peças com o ouro dele (${ouro0 - b4.prog.ouro})`);
  b4.prog.equip.corpo.d = 0; b4.prog.ouro = 0;
  ok(dar4.consertoAmiga(b4) === 0 && durab(b4.prog.equip.corpo) === 0, 'sem ouro não conserta (nada de graça)');
}
