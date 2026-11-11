// Cecília, a amiga (shared/amiga.js, André 2026-11-09): entra com o dono, levanta a casa inteira, cuida da horta,
// só o dono conversa, pede ajuda e paga de volta, guarda tudo no terreno e não ocupa vaga nas Terras.
// Uso: node ferramentas/testes/amiga.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, ITENS } from '../../shared/index.js';
import { contar, guardar } from '../../shared/progresso.js';
import { PESCA } from '../../shared/dados.js';
import { noLago } from '../../shared/relevo.js';
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
ok(f && f.bot === 1 && f.roupa.includes('capa2') && f.visual === 'ruiva' && f.aparencia?.penteado === 'victoria', 'na foto: bot, corpo da Ruiva com o penteado da Victoria e capa');
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
  guardar(c.prog.mochila, { k: 'pocao', n: 3 }); // desde o #317 ela compra poção com o ouro dela: na luta pode ter bebido a única
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
  esperar(8); // a fala sai depois do "digitando" (até ~5 s)
  ok(perto < 4 && falas.some((f) => AMIGA.chat.falas.chegou.some((t) => f.texto.startsWith(t)) && AMIGA.chat.falas.chegouPergunta.some((t) => f.texto.endsWith(t))), `chegou perto dele (a ${perto.toFixed(1)} m), avisou e perguntou o que fazer`);
  // ela veio porque topou: o convite de time logo depois entra sem sorteio (nem "já te falei")
  { const rr = Math.random; Math.random = () => 0.999; s3.eventos = []; Object.assign(d, { x: c.x + 1.5, z: c.z }); s3.conversaAmiga('andre', { acao: 'time' }); Math.random = rr;
    ok(c.time && d.time === c.time, 'veio quando chamou e entrou no time sem recusar (combinado)');
    s3.conversaAmiga('andre', { acao: 'sair' }); esperar(1); c.ia.combinado = 0; c.ia.chamado = null; }
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
  // fora da troca, de longe: "tem cenoura?" -> ela oferece com preço; ao abrir a troca já vai pra mesa e o preço sugerido aparece
  Object.assign(d, { x: c.x + 20, z: c.z }); fala.length = 0; c.ia.trocaT = null;
  ok(s4.assuntoAmiga('tem cenoura?') === 'pedirItem', '"tem cenoura?" vira pedido de item quando ela tem');
  chat('tem cenoura?'); esp(5);
  ok(fala.some((t) => t.startsWith('Tenho sim: 2 cenoura')) && c.ia.reserva?.[0]?.k === 'cenoura', `ela oferece: "${fala[0]}"`);
  Object.assign(d, { x: c.x + 1.5, z: c.z }); s4.eventos = [];
  s4.troca('andre', { acao: 'pedir', com: AMIGA.id });
  const est = s4.eventos.filter((e) => e.t === 'troca' && e.para === 'andre' && e.fase === 'estado').pop();
  ok(c.troca?.of[c.id].itens[0]?.n === 2 && est?.sugestao?.sugerido > 0 && /cobra/.test(est.sugestao.texto), `abriu a troca com as cenouras na mesa e a sugestão: "${est?.sugestao?.texto}"`);
  s4.troca('andre', { acao: 'cancelar' });
}
// ---------- igual a um jogador (André 2026-11-09) ----------
{
  const s5 = new Simulacao(MAPA_CLAREIRA);
  s5.adicionarJogador('andre', 'André', 'ruiva', {});
  s5.amigaEntrar('andre');
  const c = s5.amiga, d = s5.jogadores.get('andre');
  const f5 = s5.foto().jogadores.find((j) => j.id === AMIGA.id);
  ok(Object.keys(AMIGA.equip).every((l) => c.prog.equip[l]?.r === AMIGA.justa.raridade) && f5.roupa.includes('capa2'), `peças de verdade Comuns (${Object.values(c.prog.equip).filter(Boolean).map((o) => o.k + o.r).join(',')}) e a aparência continua o look B (${f5.roupa})`);
  c.prog.mochila = c.prog.mochila.map(() => null); c.prog.ouro = 40; s5.pocoesAmiga(c);
  ok(contar(c.prog.mochila, 'pocao') === 2 && c.prog.ouro === 40 - 2 * ITENS.pocao.preco, `poção custa o ouro dela: comprou 2 e ficou com ${c.prog.ouro}`);
  // a Cura passa para o parceiro do time, mais fraca
  s5.entrarTimeAmiga(c, d);
  Object.assign(d, { x: c.x + 2, z: c.z }); d.vida = Math.round(d.vidaMax * 0.3); const v0 = d.vida; c.mana = c.manaMax; c.vida = c.vidaMax;
  for (let i = 0; i < 20 * 3; i++) s5.passo(0.05);
  ok(d.vida > v0, `ela viu o André mal e usou a Cura: +${d.vida - v0} de vida nele`);
}
// ---------- coleta junto: lenha e pesca, com a divisão (André 2026-11-09) ----------
{
  const s6 = new Simulacao(MAPA_CLAREIRA);
  s6.adicionarJogador('andre', 'André', 'ruiva', {});
  s6.amigaEntrar('andre');
  const c = s6.amiga, d = s6.jogadores.get('andre'), esp = (t) => { for (let i = 0; i < t * 20; i++) s6.passo(0.05); };
  const fala = []; s6.aoChatAmiga = (m) => fala.push(m.texto);
  const chat = (texto) => { s6.ouvirAmiga('andre', texto); s6.respostaAmiga('andre', { assunto: s6.assuntoAmiga(texto) }); };
  ok(s6.assuntoAmiga('vamos pescar?') === 'pescar' && s6.assuntoAmiga('bora minerar') === 'minerar' && s6.assuntoAmiga('bora cortar lenha') === 'lenha', 'entende "vamos pescar", "bora minerar" e "bora cortar lenha"');
  // lenha: ela faz o machado com o que tem e corta perto do André
  const arv = [...s6.coletaveis.values()].filter((n) => n.tipo === 'arvore').sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
  Object.assign(d, { x: arv.x + 4, z: arv.z, y: s6.terreno.altura(arv.x + 4, arv.z) }); Object.assign(c, { x: arv.x + 5, z: arv.z + 1, y: s6.terreno.altura(arv.x + 5, arv.z + 1) });
  guardarItem(c, 'lenha', 3); guardarItem(c, 'pedra', 2);
  const lenha0 = contar(c.prog.mochila, 'lenha') - 3, dono0 = contar(d.prog.mochila, 'lenha');
  const rr = Math.random; Math.random = () => 0.01; chat('bora cortar lenha'); Math.random = rr;
  ok(c.time && c.ia.atividade === 'lenha', 'topou cortar lenha e entrou no time');
  esp(90);
  const cortou = contar(c.prog.mochila, 'lenha') - lenha0 + contar(d.prog.mochila, 'lenha') - dono0;
  ok(contar(c.prog.mochila, 'machado') === 1 && cortou > 0, `fez o próprio machado e cortou ${cortou} lenha`);
  chat('chega de lenha');
  const parte = contar(d.prog.mochila, 'lenha') - dono0;
  ok(!c.ia.atividade && parte > 0 && parte < cortou && c.ia.reserva?.some((x) => x.k === 'lenha'), `parou, deu ${parte} de presente e oferece o resto (${c.ia.reserva?.map((x) => x.n + ' ' + x.k).join(', ')})`);
}
{ // pesca (sala nova: o vigor dela foi todo na lenha): com a vara, acha o spot perto do André e pesca sozinha
  const s6 = new Simulacao(MAPA_CLAREIRA);
  s6.adicionarJogador('andre', 'André', 'ruiva', {});
  s6.amigaEntrar('andre');
  const c = s6.amiga, d = s6.jogadores.get('andre'), esp = (t) => { for (let i = 0; i < t * 20; i++) s6.passo(0.05); };
  const chat = (texto) => { s6.ouvirAmiga('andre', texto); s6.respostaAmiga('andre', { assunto: s6.assuntoAmiga(texto) }); };
  c.ia.combinado = s6.tempo + 999;
  let sp = null; for (let i = 0; i < 400 && !sp; i++) { s6.passoSpots(); s6.tempo += 1; sp = s6.spots.find((v) => v.ativo); }
  if (sp) {
    sp.fim = s6.tempo + 9999;
    for (const v of s6.spots) if (v !== sp) v.ativo = false; // só este spot
    c.ia.ruins = new Map(); const beira = s6.acharColetaAmiga(c, { x: sp.x, z: sp.z }, 'pescar'); // a beira de onde dá pra lançar
    const bx = beira.x, bz = beira.z;
    Object.assign(d, { x: bx, z: bz, y: s6.terreno.altura(bx, bz) }); Object.assign(c, { x: bx, z: bz, y: s6.terreno.altura(bx, bz) });
    guardarItem(c, 'vara', 1);
    const peixes = () => Object.keys(PESCA.tier).reduce((t, k) => t + contar(c.prog.mochila, k) + contar(d.prog.mochila, k), 0), p0 = peixes();
    chat('vamos pescar?'); esp(120);
    ok(c.ia.atividade === 'pescar' && peixes() > p0, `pescou ${peixes() - p0} peixe(s) no spot perto do André`);
  } else ok(false, 'nenhum spot de pesca nasceu no teste');
}
function guardarItem(j, k, n) { guardar(j.prog.mochila, { k, n }); }

// ---------- vários amigos com chave (André 2026-11-10: irmão e irmã, cada um com a sua chave Groq) ----------
{
  const s7 = new Simulacao(MAPA_CLAREIRA);
  const d = s7.adicionarJogador('andre', 'André', 'ruiva', { conta: 1 });
  const ir = s7.adicionarJogador('irmao', 'Irmão', 'ruiva', { conta: 2 });
  s7.adicionarJogador('sem', 'Sem Chave', 'ruiva', { conta: 3 });
  s7.amigaEntrar('andre'); s7.amigaEntrar('irmao');
  const c = s7.amiga, esp = (t) => { for (let i = 0; i < t * 20; i++) s7.passo(0.05); };
  const fila = () => c.ia.chatFila || [];
  ok(s7.amigaDono === 'andre' && s7.podeAmiga('irmao') && !s7.podeAmiga('sem'), 'os dois com chave conversam; ela acompanha quem chegou primeiro');
  s7.eventos = []; s7.chat('sem', { canal: 'pm', para: AMIGA.conta, texto: 'oi' });
  ok(!s7.contextoAmiga('sem') && s7.eventos.some((e) => e.t === 'aviso' && e.para === 'sem'), 'sem chave: vê, mas não conversa');
  s7.eventos = []; s7.enviarAmigos(s7.jogadores.get('sem'));
  ok(s7.eventos.some((e) => e.t === 'amigos' && e.virtuais[0]?.ia === false), 'sem chave: a lista mostra ela com o botão de ativar');
  c.amizade = 3;
  const rr = Math.random; Math.random = () => 0.01; s7.respostaAmiga('andre', { assunto: 'time' }); Math.random = rr;
  ok(c.time && c.time === d.time, 'André chamou primeiro: ela entrou no time dele');
  s7.respostaAmiga('irmao', { assunto: 'time' });
  ok(s7.amigaDono === 'andre' && fila().at(-1)?.para === 'irmao' && fila().at(-1).texto.includes('André'), `irmão chamou depois: "${fila().at(-1)?.texto}"`);
  s7.respostaAmiga('irmao', { assunto: 'conversa', fala: 'Oi! Tudo bem por aí?' });
  ok(fila().at(-1)?.para === 'irmao' && s7.amigaDono === 'andre', 'mas conversa com o irmão ao mesmo tempo');
  esp(20);
  ok(s7.chatDeAmiga(ir).some((m) => m.de === 'ela') && !s7.chatDeAmiga(d).some((m) => m.texto === 'Oi! Tudo bem por aí?'), 'cada um tem a sua conversa');
  s7.amigaSair('andre');
  ok(s7.amiga === c && s7.amigaDono === 'irmao' && !c.time && c.amizade === 0, 'André saiu: ela fica com o irmão (amizade dele começa do zero)');
  c.amizade = 1;
  s7.guardarAmiga();
  const sv = s7.loteDaAmiga().amiga;
  ok(sv.amizades.c1 === 3 && sv.amizades.c2 === 1, `amizade separada por conta: ${JSON.stringify(sv.amizades)}`);
  s7.amigaSair('irmao');
  ok(!s7.amiga, 'o último com chave saiu: ela sai');
}
{ // save antigo (amizade era só do André): o irmão entra primeiro e a amizade do André não se perde
  const s8 = new Simulacao(MAPA_CLAREIRA);
  s8.adicionarJogador('irmao', 'Irmão', 'ruiva', { conta: 2 });
  s8.amigaEntrar('irmao');
  s8.loteDaAmiga().amiga = {}; s8.amigaSair('irmao');
  const L8 = s8.loteDaAmiga(); L8.amiga = { amizade: 7, recomeco: AMIGA.recomeco };
  s8.adicionarJogador('irmao2', 'Irmão', 'ruiva', { conta: 2 });
  s8.amigaEntrar('irmao2');
  ok(s8.amiga.amizade === 0, 'irmão começa do zero');
  s8.guardarAmiga(); s8.amigaSair('irmao2');
  const d8 = s8.adicionarJogador('andre', 'André', 'ruiva', { conta: 1, testador: true });
  s8.amigaEntrar('andre');
  ok(s8.amiga.amizade === 7 && s8.amizadeAmiga(d8) === 7, 'André continua com a amizade antiga (7)');
}

// ---------- memória (André 2026-11-10: ela aprende com o dia a dia) ----------
{
  const s9 = new Simulacao(MAPA_CLAREIRA);
  const d = s9.adicionarJogador('andre', 'André', 'ruiva', { conta: 1 });
  s9.amigaEntrar('andre');
  const c = s9.amiga, esp = (t) => { for (let i = 0; i < t * 20; i++) s9.passo(0.05); };
  const pedidos = [];
  s9.aoDiarioAmiga = (dados) => { pedidos.push(dados); return Promise.resolve({ memorias: ['Ele adora pescar no lago.', 'Me ensinou a curar ele antes.'], regras: { curaCedo: true, pertinho: true, inventada: true } }); };
  s9.ouvirAmiga('andre', 'oi Cecília, bora pescar amanhã?'); s9.ouvirAmiga('andre', 'e me cura mais cedo quando eu tiver mal');
  esp(30);
  ok(!pedidos.length, 'no meio da conversa ela ainda não escreve o diário');
  esp(AMIGA.memoria.pausa);
  await new Promise((r) => setTimeout(r, 0));
  ok(pedidos.length === 1 && pedidos[0].conversa.length === 2 && pedidos[0].conta === 'c1', 'conversa parada: pediu o diário uma vez, com a conversa dele');
  ok(c.memorias.c1?.length === 2 && c.regras.c1.curaCedo && !c.regras.c1.inventada, `anotou: ${JSON.stringify(c.memorias.c1)} e regras ${JSON.stringify(c.regras.c1)}`);
  const ctx = s9.contextoAmiga('andre');
  ok(ctx.memoria.length === 2 && ctx.regras.includes(AMIGA.memoria.regras.curaCedo.texto), 'a IA recebe o que ela lembra e as dicas');
  ok(s9.regraAmiga('seguir') === AMIGA.memoria.regras.pertinho.seguir && s9.regraAmiga('curaDono') === AMIGA.memoria.regras.curaCedo.curaDono && s9.regraAmiga('pocao') === undefined, 'as dicas mudam como ela joga');
  for (let i = 0; i < AMIGA.memoria.gostoMin; i++) s9.gostoAmiga(d, 'pescar');
  ok(s9.gostoTopoAmiga(d) === 'pescar', 'o que mais fazem juntos vira o convite dela');
  c.ia.chamado = { quer: 'pescar', ate: s9.tempo + 60 }; c.ia.combinado = 0;
  s9.respostaAmiga('andre', { assunto: 'sim' });
  ok(c.ia.atividade === 'pescar', '"sim" ao convite de pescar: ela vai pescar junto');
  // ele sai no meio de outra conversa: o diário é escrito na hora e vai para o terreno mesmo com ela fora da sala
  s9.aoDiarioAmiga = () => new Promise((r) => setTimeout(() => r({ memorias: ['Ele saiu correndo hoje.'], regras: {} }), 5));
  s9.ouvirAmiga('andre', 'tenho que ir'); s9.ouvirAmiga('andre', 'tchau!');
  s9.amigaSair('andre');
  await new Promise((r) => setTimeout(r, 20));
  ok(!s9.amiga && s9.loteDaAmiga().amiga.memorias.c1[0] === 'Ele saiu correndo hoje.', 'saiu: o diário vai para o terreno dela');
  const s10 = new Simulacao(MAPA_CLAREIRA);
  s10.carregarLotes([s9.lotesParaSalvar().find((l) => l.dados?.amiga)]);
  s10.adicionarJogador('andre', 'André', 'ruiva', { conta: 1 });
  s10.amigaEntrar('andre');
  ok(s10.contextoAmiga('andre').memoria[0] === 'Ele saiu correndo hoje.' && s10.regraAmiga('seguir') === AMIGA.memoria.regras.pertinho.seguir, 'no outro dia ela lembra');
}

// ---------- equipamento (André 2026-11-10): ver de qualquer jogador, ela liga para as peças e veste a melhor que ganhar ----------
{
  const s11 = new Simulacao(MAPA_CLAREIRA);
  const d = s11.adicionarJogador('andre', 'André', 'ruiva', { conta: 1 });
  const o = s11.adicionarJogador('outro', 'Outro', 'ruiva', { conta: 2 });
  s11.amigaEntrar('andre');
  const c = s11.amiga, esp = (t) => { for (let i = 0; i < t * 20; i++) s11.passo(0.05); };
  o.prog.equip.corpo = { k: 'peitoral', r: 2, e: 3 };
  Object.assign(o, { x: d.x + 2, z: d.z }); s11.eventos = [];
  s11.verEquip('andre', { com: 'outro' });
  const ev = s11.eventos.find((e) => e.t === 'equipVer' && e.para === 'andre');
  ok(ev && ev.nome === 'Outro' && ev.equip.corpo?.r === 2 && ev.equip.corpo.e === 3, `ver o equipamento de outro jogador perto (${Object.keys(ev?.equip || {}).join(', ')})`);
  Object.assign(o, { x: d.x + 40 }); s11.eventos = []; s11.verEquip('andre', { com: 'outro' });
  ok(!s11.eventos.some((e) => e.t === 'equipVer') && s11.eventos.some((e) => e.t === 'aviso'), 'longe: pede para chegar perto');
  Object.assign(d, { x: c.x + 1.5, z: c.z, y: c.y }); s11.eventos = []; s11.verEquip('andre', { com: AMIGA.id });
  const evc = s11.eventos.find((e) => e.t === 'equipVer');
  ok(evc && evc.equip.corpo?.k === c.prog.equip.corpo.k && evc.equip.corpo.r === c.prog.equip.corpo.r, 'ver o equipamento da Cecília (as peças de verdade, não a aparência)');
  ok(s11.assuntoAmiga('o que você tá usando?') === 'equip' && s11.falaEquipAmiga().includes('mais fraquinha'), `"o que você tá usando?": "${s11.falaEquipAmiga()}"`);
  ok(s11.pecaFracaAmiga() && s11.pedeEquipAmiga().length > 10, `pede a peça mais fraca: "${s11.pedeEquipAmiga()}"`);
  // troca: peitoral Raro (melhor que o Comum dela) ela quer e veste na hora; botas Comuns iguais às dela ela não paga
  c.prog.equip.corpo = { k: 'peitoral', r: 0 }; c.prog.equip.pes = { k: 'botas', r: 0 }; c.prog.ouro = 5000;
  d.prog.mochila.fill(null); d.prog.mochila[0] = { k: 'peitoral', r: 1 }; d.prog.mochila[1] = { k: 'botas', r: 0 };
  const falas = []; const fa = s11.falarAmiga.bind(s11); s11.falarAmiga = (t) => { falas.push(t); fa(t); };
  s11.troca('andre', { acao: 'pedir', com: AMIGA.id });
  s11.troca('andre', { acao: 'por', i: 0, n: 1 }); s11.troca('andre', { acao: 'por', i: 1, n: 1 }); esp(3);
  const T = c.troca, minha = T.of[c.id];
  ok(falas.some((t) => t.includes('Bem melhor')) && falas.some((t) => t.includes('não serve')), 'na troca ela reconhece a peça melhor e recusa pagar a pior');
  ok(minha.tranca && minha.ouro > 0, `paga preço de amigo só pelo peitoral (${minha.ouro} de ouro)`);
  s11.troca('andre', { acao: 'trancar', v: true }); s11.troca('andre', { acao: 'confirmar' }); esp(3);
  ok(!c.troca && c.prog.equip.corpo.r === 1 && falas.some((t) => t.includes('Vesti')), `vestiu na hora: "${falas.find((t) => t.includes('Vesti'))}"`);
}
// André 2026-11-10: longe dela (no time ou chamada pelo chat) ela NUNCA aparece do lado: monta no lobo e vem pela estrada
// (shared/rota.js); em outra terra (só de barco) avisa e espera
{
  const { LUGARES_MUNDO } = await import('../../shared/mundo.js');
  for (const [lugar, modo] of [['vila_vael', 'time'], ['posto_oeste', 'vir'], ['c_i1', 'time']]) {
    const s12 = new Simulacao(MAPA_CLAREIRA);
    s12.adicionarJogador('andre', 'André', 'ruiva', {}); s12.amigaEntrar('andre');
    const c = s12.amiga, d = s12.jogadores.get('andre'), L = LUGARES_MUNDO.find((l) => l.id === lugar);
    for (let i = 0; i < 40; i++) s12.passo(0.05);
    const ditos = []; const dz0 = s12.dizerAmiga.bind(s12); s12.dizerAmiga = (t, ...r) => { ditos.push(t); dz0(t, ...r); };
    const aqui = () => Object.assign(d, { x: L.x, z: L.z, y: s12.terreno.altura(L.x, L.z), vila: null, vida: d.vidaMax });
    aqui();
    if (modo === 'time') s12.entrarTimeAmiga(c, d); else c.ia.vir = { ate: s12.tempo + 120, longe: s12.tempo + 4 };
    let pulo = 0, montada = 0, px = c.x, pz = c.z, perto = 1e9; const d0 = Math.hypot(c.x - d.x, c.z - d.z);
    for (let i = 0; i < 20 * 240 && perto > 4; i++) {
      aqui(); s12.passo(0.05);
      pulo = Math.max(pulo, Math.hypot(c.x - px, c.z - pz)); px = c.x; pz = c.z;
      if (c.montado) montada += 0.05;
      perto = Math.hypot(c.x - d.x, c.z - d.z);
    }
    if (lugar === 'c_i1') ok(perto > 300 && c.ia.viagem?.bloqueio && pulo < 0.6 && ditos.some((t) => AMIGA.chat.falas.outraTerra.includes(t)), 'ele em outra terra: ela não aparece lá, avisa que sem barco não chega e espera');
    else ok(perto <= 4 && pulo < 0.6 && montada > 10, `${modo === 'time' ? 'no time' : '"vem cá"'}: veio de lobo pela estrada ${Math.round(d0)} m sem se teletransportar (maior passo ${pulo.toFixed(2)} m, ${Math.round(montada)} s montada)`);
  }
}

{ // recomeço (André 2026-11-11): o que ela jogou volta ao zero, o save antigo fica guardado em 'antes'
  const s9 = new Simulacao(MAPA_CLAREIRA);
  s9.adicionarJogador('andre', 'André', 'ruiva', { conta: 1, testador: true });
  s9.amigaEntrar('andre');
  const L9 = s9.loteDaAmiga(), velho = { ...s9.amiga.prog, nivel: 44, ouro: 9999 };
  s9.amigaSair('andre'); L9.amiga = { prog: velho, amizade: 9, amizades: { 1: 9 }, memorias: { 1: ['pescamos'] }, justa: 1 };
  s9.adicionarJogador('andre2', 'André', 'ruiva', { conta: 1, testador: true });
  s9.amigaEntrar('andre2');
  const a9 = s9.amiga;
  ok(a9.prog.nivel === 1 && a9.prog.ouro < 9999 && a9.amizade === 0 && !Object.keys(a9.amizades).length && !Object.keys(a9.memorias).length, 'recomeço: ela volta ao Nv 1, sem ouro, amizade nem diário');
  s9.guardarAmiga();
  ok(L9.amiga.recomeco === AMIGA.recomeco && L9.amiga.antes?.prog?.nivel === 44 && L9.amiga.antes.amizades?.[1] === 9, 'o save antigo fica em antes e o recomeço não repete');
  s9.amiga.prog.nivel = 3; s9.guardarAmiga(); s9.amigaSair('andre2');
  s9.adicionarJogador('andre3', 'André', 'ruiva', { conta: 1, testador: true }); s9.amigaEntrar('andre3');
  ok(s9.amiga.prog.nivel === 3 && s9.loteDaAmiga().amiga.antes?.prog?.nivel === 44, 'depois do recomeço ela guarda o que joga de novo');
}
