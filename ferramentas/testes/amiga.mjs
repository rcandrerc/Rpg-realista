// Cecília, a amiga (shared/amiga.js, André 2026-11-09): entra com o dono, levanta a casa inteira, cuida da horta,
// só o dono conversa, pede ajuda e paga de volta, guarda tudo no terreno e não ocupa vaga nas Terras.
// Uso: node ferramentas/testes/amiga.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, ITENS } from '../../shared/index.js';
import { contar } from '../../shared/progresso.js';
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
// troca com ela: só o dono (fase 3); o outro jogador é ignorado
s.troca('outro', { acao: 'pedir', com: AMIGA.id });
ok(!a.pedidoTroca && !a.troca && !s.eventos.some((e) => e.t === 'troca' && e.para === AMIGA.id), 'o outro jogador não troca com ela');
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

// ---------- fase 2: time e combate ----------
{
  const s3 = new Simulacao(MAPA_CLAREIRA);
  const d = s3.adicionarJogador('andre', 'André', 'ruiva', {});
  s3.amigaEntrar('andre');
  const c = s3.amiga;
  const rnd = Math.random;
  // recusa (sorteio alto) com o motivo, e espera para chamar de novo
  Math.random = () => 0.999;
  Object.assign(d, { x: c.x + 1, z: c.z }); s3.eventos = []; s3.conversaAmiga('andre', { acao: 'time' });
  ok(!c.time && s3.eventos.some((e) => e.t === 'fala' && e.npc === AMIGA.id), 'recusou o time com um motivo');
  Math.random = () => 0; s3.eventos = []; s3.conversaAmiga('andre', { acao: 'time' });
  ok(!c.time && s3.eventos.some((e) => e.texto === AMIGA.falas.recusa.jaFalei), 'chamou de novo logo: "já te falei"');
  c.ia.recusaAte = 0; s3.conversaAmiga('andre', { acao: 'time' });
  Math.random = rnd;
  ok(c.time && d.time === c.time && c.time.membros.length === 2, 'aceitou e entrou no time do dono');
  // vontade: amizade sobe a chance, nível muito acima baixa e diz o motivo
  c.amizade = 0; const v0 = s3.vontadeAmiga(c, d).p; c.amizade = 4; const v1 = s3.vontadeAmiga(c, d).p;
  const nvC = c.prog.nivel; d.prog.nivel = 40; const v2 = s3.vontadeAmiga(c, d); d.prog.nivel = 1;
  ok(v1 > v0 && v2.motivo !== 'perigo' && c.prog.nivel === nvC, `vontade: ${v0.toFixed(2)} sem amizade, ${v1.toFixed(2)} com amizade; dono 39 níveis acima não pesa (${v2.p.toFixed(2)}, ${v2.motivo}) e ela não sobe sozinha`);
  // segue o dono
  Object.assign(d, { x: -1, z: 12, y: s3.terreno.altura(-1, 12), ry: 0 });
  for (let i = 0; i < 20 * 30; i++) s3.passo(0.05);
  ok(Math.hypot(c.x - d.x, c.z - d.z) < 5, `segue o dono (a ${Math.hypot(c.x - d.x, c.z - d.z).toFixed(1)} m)`);
  // luta: o dono para perto de um monstro e entra em combate; ela bate e ganha XP
  for (let i = 0; i < 20 * 5; i++) s3.passo(0.05);
  const m = s3.inimigos.find((e) => !e.morto && !e.treino && !e.sub);
  Object.assign(d, { x: m.x + 2, z: m.z + 2, y: m.y, vida: 1e6, vidaMax: 1e6 });
  Object.assign(c, { x: d.x + 1, z: d.z, y: d.y });
  const xp0 = c.prog.xp, nv0 = c.prog.nivel; let bateu = 0;
  const ferir = s3.ferir.bind(s3); s3.ferir = (alvo, n, de, h) => { if (de === c) bateu++; return ferir(alvo, n, de, h); };
  for (let i = 0; i < 20 * 40; i++) { d.combateAte = s3.tempo + 5; d.vida = 1e6; s3.passo(0.05); }
  ok(bateu > 3, `ela lutou: ${bateu} golpes nos monstros`);
  ok(c.prog.xp > xp0 || c.prog.nivel > nv0, `ganhou XP no time (nível ${c.prog.nivel}, XP ${c.prog.xp})`);
  // pouca vida: bebe poção
  const p0 = contar(c.prog.mochila, 'pocao'); c.vida = c.vidaMax * 0.2; c.ia.pocaoT = 0; c.pocaoAte = {}; // sem a recarga de uma poção que ela já bebeu na luta
  for (let i = 0; i < 80 && c.ia.pocaoT === 0; i++) { c.vida = c.vidaMax * 0.2; s3.passo(0.05); } // espera a habilidade em andamento acabar (trava até ~2 s)
  ok(c.ia.pocaoT > 0 && c.vida > c.vidaMax * 0.2, `bebeu poção com pouca vida (vida ${Math.round(c.vida / c.vidaMax * 100)}%)`); // pela vida: na mesma luta ela pode pegar poção do chão
  // o dono tira ela do time pela conversa
  Object.assign(d, { x: c.x + 1, z: c.z }); s3.conversaAmiga('andre', { acao: 'sair' });
  for (let i = 0; i < 20; i++) s3.passo(0.05);
  ok(!c.time && !d.time, 'saiu do time e o time acabou');
  // um monstro não mira nela fora do time
  ok(!s3.inimigosDe(m).includes(c), 'fora do time os monstros não miram nela');
  // ---------- chat de longe (amigos virtuais) ----------
  const falas = []; s3.aoChatAmiga = (msg) => falas.push(msg);
  const chat = (texto) => { const msg = s3.chat('andre', { canal: 'pm', para: AMIGA.conta, texto }); if (msg) { s3.ouvirAmiga('andre', texto); s3.respostaAmiga('andre', { assunto: s3.assuntoAmiga(texto) }); } return msg; };
  const esperar = (s) => { for (let i = 0; i < s * 20; i++) s3.passo(0.05); };
  const ev0 = s3.eventos.length; s3.enviarAmigos(d);
  const am = s3.eventos.slice(ev0).find((e) => e.t === 'amigos' && e.para === 'andre');
  ok(am?.virtuais?.[0]?.c === AMIGA.conta, 'ela aparece em "Amigos virtuais" do dono');
  ok(s3.assuntoAmiga('Vem cá!') === 'vir' && s3.assuntoAmiga('bora pro meu time?') === 'time' && s3.assuntoAmiga('Pode sair do time') === 'sairTime' && s3.assuntoAmiga('oi, tudo bem?') === 'comoVai' && s3.assuntoAmiga('xyz qwe') === 'naoEntendi', 'entende o assunto pelas palavras');
  ok(chat('Oi Cecília!'), 'o dono manda mensagem privada para ela sem ser amigo de lista');
  esperar(6);
  ok(falas.length === 1 && falas[0].c === AMIGA.conta && falas[0].alvo === d.conta && falas[0].canal === 'pm', `ela responde no privado: "${falas[0]?.texto}"`);
  // vem cá de longe: ela vai até ele
  Object.assign(d, { x: -1, z: 30, y: s3.terreno.altura(-1, 30) }); Object.assign(c, { x: -6, z: -10, y: s3.terreno.altura(-6, -10) });
  const rnd2 = Math.random; Math.random = () => 0.01; s3.tempo += 2; chat('Vem aqui comigo?'); Math.random = rnd2;
  ok(!!c.ia.vir, 'aceitou ir até ele');
  let perto = 99; for (let i = 0; i < 20 * 60 && c.ia.vir; i++) { s3.passo(0.05); perto = Math.hypot(c.x - d.x, c.z - d.z); }
  esperar(4);
  ok(perto < 4 && falas.some((f) => AMIGA.chat.falas.chegou.includes(f.texto)), `chegou perto dele (a ${perto.toFixed(1)} m) e avisou`);
  // ela chama: com ele longe, uma hora ela manda mensagem; "bora" entra no time sem sorteio
  Object.assign(d, { x: c.x + 60, z: c.z, y: s3.terreno.altura(c.x + 60, c.z) }); c.ia.conversaAte = 0; c.ia.chamaEm = s3.tempo; c.ia.recusaAte = 0;
  const n0 = falas.length; esperar(1);
  ok(falas.length === n0 + 1 && c.ia.chamado, `ela chama o André: "${falas[n0]?.texto}"`);
  c.ia.chamado.quer = 'time'; s3.tempo += 2; const rnd3 = Math.random; Math.random = () => 0.999; chat('bora!'); Math.random = rnd3;
  ok(c.time && d.time === c.time, 'respondeu "bora" ao chamado e ela entrou no time');
  s3.tempo += 2; chat('pode sair do time'); esperar(1);
  ok(!c.time, 'pelo chat ela sai do time');
}
// ---------- fase 3: mochila, ouro e troca ----------
{
  const s4 = new Simulacao(MAPA_CLAREIRA);
  s4.adicionarJogador('andre', 'André', 'ruiva', {});
  s4.amigaEntrar('andre');
  const c = s4.amiga, d = s4.jogadores.get('andre'), cp = c.prog;
  ok(cp.paginas === AMIGA.mochila.paginas && cp.mochila.length >= 4 * (d.prog.mochila.length / (d.prog.paginas || 1)), `mochila dela com ${cp.paginas} páginas (${cp.mochila.length} lugares)`);
  // arrumar: veste a peça melhor, vende cajado, a peça velha e o que não usa; guarda poção e colheita
  cp.mochila.fill(null);
  cp.mochila[0] = { k: 'peitoral', r: 3 }; cp.mochila[1] = { k: 'cajado', r: 4 }; cp.mochila[2] = { k: 'barra_ferro', n: 4 };
  cp.mochila[3] = { k: 'pocao', n: 2 }; cp.mochila[4] = { k: 'cenoura', n: 5 };
  const ouroA = cp.ouro; s4.arrumarMochilaAmiga(c);
  const tem = (k) => cp.mochila.some((o) => o?.k === k);
  ok(cp.equip.corpo?.r === 3 && !tem('peitoral') && !tem('cajado') && !tem('barra_ferro') && tem('pocao') && tem('cenoura') && cp.ouro > ouroA,
    `arrumou: vestiu o peitoral melhor, vendeu cajado, peitoral velho e barras (+${cp.ouro - ouroA} de ouro), guardou poção e cenoura`);
  // troca: o dono pede, abre na hora
  Object.assign(d, { x: c.x + 1.5, z: c.z, y: c.y });
  const esp = (t) => { for (let i = 0; i < t * 20; i++) s4.passo(0.05); };
  const chat = (texto) => { s4.ouvirAmiga('andre', texto); s4.respostaAmiga('andre', { assunto: s4.assuntoAmiga(texto) }); };
  const fala = []; s4.aoChatAmiga = (m) => fala.push(m.texto);
  s4.troca('andre', { acao: 'pedir', com: AMIGA.id });
  ok(d.troca && c.troca === d.troca, 'o dono pede troca e a janela abre para os dois');
  chat('quero 3 cenouras');
  const T = c.troca, minha = T.of[c.id], dele = T.of['andre'];
  ok(minha.itens.length === 1 && minha.itens[0].n === 3, 'pelo chat "quero 3 cenouras" ela põe 3 cenouras na mesa');
  esp(2);
  ok(!minha.tranca, 'sem ouro do outro lado ela não tranca');
  const preco = Math.ceil(3 * ITENS.cenoura.venda * Math.max(AMIGA.troca.margemMin, AMIGA.troca.margem - (c.amizade | 0) * AMIGA.troca.porAmizade));
  d.prog.ouro = 1000; s4.troca('andre', { acao: 'ouro', n: preco }); esp(2);
  ok(minha.tranca && minha.ouro === 0, `com ${preco} de ouro na mesa ela tranca`);
  s4.troca('andre', { acao: 'trancar', v: true }); s4.troca('andre', { acao: 'confirmar' }); esp(2);
  ok(!c.troca && !d.troca && contar(d.prog.mochila, 'cenoura') === 3 && contar(cp.mochila, 'cenoura') === 2 && d.prog.ouro === 1000 - preco, 'troca feita: 3 cenouras pra ele, ouro pra ela');
  // ele vende pra ela: ela paga em ouro
  d.prog.mochila[5] = { k: 'barra_ferro', n: 2 }; cp.ouro = 500;
  s4.troca('andre', { acao: 'pedir', com: AMIGA.id }); s4.troca('andre', { acao: 'por', i: 5, n: 2 }); esp(2);
  ok(c.troca.of[c.id].ouro > 0 && c.troca.of[c.id].tranca, `ele põe 2 barras e ela oferece ${c.troca.of[c.id].ouro} de ouro`);
  // vira presente: ela tira o ouro e agradece no fim (amizade +1)
  const amz = c.amizade | 0; chat('é presente'); esp(2);
  ok(c.troca.of[c.id].ouro === 0 && c.troca.of[c.id].tranca, '"é presente": ela tira o ouro');
  s4.troca('andre', { acao: 'trancar', v: true }); s4.troca('andre', { acao: 'confirmar' }); esp(2);
  ok(!c.troca && contar(cp.mochila, 'barra_ferro') === 2 && c.amizade === amz + 1, 'presente recebido: amizade +1');
}
