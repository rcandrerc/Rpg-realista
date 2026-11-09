// Cecília, a amiga (shared/amiga.js, André 2026-11-09): entra com o dono, levanta a casa inteira, cuida da horta,
// só o dono conversa, pede ajuda e paga de volta, guarda tudo no terreno e não ocupa vaga nas Terras.
// Uso: node ferramentas/testes/amiga.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, ITENS } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('andre', 'André', 'ruiva', {});
s.adicionarJogador('outro', 'Outro', 'ruiva', {});
s.amigaEntrar('andre');
const a = s.amiga, L = s.loteDaAmiga();
ok(a && a.bot && L && L.dono === AMIGA.conta, `ela entrou com terreno ${L?.def.x0},${L?.def.z0} a ${L?.def.x1},${L?.def.z1}`);
ok(s.eventos.some((e) => e.t === 'amiga' && e.para === 'andre'), 'só o dono recebe o aviso de quem ela é');
for (let i = 0; i < 20 * 900; i++) s.passo(0.05);
ok(L.pecas.length === AMIGA.casa.length, `casa inteira: ${L.pecas.length} de ${AMIGA.casa.length} peças`);
ok(Object.keys(L.horta).length === AMIGA.horta.w * AMIGA.horta.d && Object.values(L.horta).every((t) => t.c), `horta: ${Object.keys(L.horta).length} canteiros plantados`);
const f = s.foto().jogadores.find((j) => j.id === AMIGA.id);
ok(f && f.bot === 1 && f.roupa.includes('capa2') && f.visual === 'victoria', 'na foto: bot, corpo victoria e capa');
ok(!s.inimigosDe(s.inimigos[0] || { tipo: 'lobo' }).includes(a), 'monstro não mira nela');
// conversa: o outro não recebe nada; o dono recebe
const perto = (id) => Object.assign(s.jogadores.get(id), { x: a.x + 1, z: a.z });
perto('outro'); s.eventos = []; s.conversaAmiga('outro', { acao: 'oi' });
ok(!s.eventos.some((e) => e.t === 'fala'), 'o outro jogador não conversa com ela');
perto('andre'); s.eventos = []; s.conversaAmiga('andre', { acao: 'oi' });
ok(s.eventos.some((e) => e.t === 'fala' && e.para === 'andre' && e.npc === AMIGA.id), 'o dono conversa');
// pedido e o Dar: tira da mochila do André, ela paga de volta e a amizade sobe
a.pedido = { k: 'lenha', n: 5 };
const dono = s.jogadores.get('andre');
dono.prog.mochila[0] = { k: 'lenha', n: 7 };
const ouro0 = dono.prog.ouro, amz0 = a.amizade;
s.eventos = []; s.conversaAmiga('andre', { acao: 'dar' });
const sobrou = dono.prog.mochila.filter((o) => o?.k === 'lenha').reduce((t, o) => t + o.n, 0);
ok(sobrou === 2 && a.pedido === null && a.amizade === amz0 + 1, 'Dar: 5 lenha saíram, pedido cumprido, amizade +1');
ok(dono.prog.ouro > ouro0 || dono.prog.mochila.some((o) => o && AMIGA.plantas.includes(o.k)), 'ela pagou de volta (ouro ou colheita)');
// troca e time com ela são ignorados (fases 2 e 3)
s.troca('andre', { acao: 'pedir', com: AMIGA.id });
ok(!a.pedidoTroca && !s.eventos.some((e) => e.t === 'troca' && e.para === AMIGA.id), 'pedido de troca com ela é ignorado');
// guarda no terreno e o terreno dela não conta na vaga das Terras
s.guardarAmiga();
const salvo = s.lotesParaSalvar().find((l) => l.id === L.def.id);
ok(salvo?.dados?.amiga?.prog && salvo.dados.amiga.amizade === a.amizade, 'bolsa e amizade vão junto com o terreno');
s.amigaSair('outro');
ok(s.amiga === a, 'sair de outro jogador não tira ela');
s.amigaSair('andre');
ok(!s.amiga && !s.jogadores.has(AMIGA.id), 'sai junto com o dono');
// volta com o que tinha
const s2 = new Simulacao(MAPA_CLAREIRA);
s2.carregarLotes([salvo]);
s2.adicionarJogador('andre', 'André', 'ruiva', {});
s2.amigaEntrar('andre');
ok(s2.loteDaAmiga()?.pecas.length === AMIGA.casa.length && s2.amiga.amizade === a.amizade, 'volta com a casa e a amizade');
ok(ITENS.lenha, 'itens');
