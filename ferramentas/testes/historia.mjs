// Teste da história v2 (André 2026-11-11, "Aethra: a Crônica da Névoa"): o Ato I inteiro (capítulos 1 a 5) feito do
// começo ao fim por um herói novo, as etapas, os chefes com nome, as pistas, a noite, o barquinho, os presentes, os
// cartões de capítulo, os rumores e a conta da história antiga migrando. Uso: node ferramentas/testes/historia.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, CAPITULOS, CHEFES_HISTORIA, CACA, ITENS, CENAS, xpProximo } from '../../shared/index.js';
import { TOTENS, TUNEIS_MUNDO } from '../../shared/dados.js';
import { noTunel } from '../../shared/caverna.js';
import { progressoValido, contar, guardar } from '../../shared/progresso.js';
import { etapasDe, liberado, zonaFechadaEm, histValida, historiaParaApp } from '../../shared/historia.js';
import { noLago } from '../../shared/relevo.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const npc = (id) => MAPA_CLAREIRA.npcs.find((n) => n.id === id);

// ---------- dados ----------
const ids = new Set();
HISTORIA.forEach((M, i) => {
  ok(!ids.has(M.id), `${M.id}: id único`); ids.add(M.id);
  ok(!!npc(M.npc), `${M.id}: NPC ${M.npc} existe`);
  ok(CAPITULOS.some((c) => c.n === M.cap), `${M.id}: capítulo ${M.cap} existe`);
  ok(!i || M.nv >= HISTORIA[i - 1].nv && M.cap >= HISTORIA[i - 1].cap, `${M.id}: em ordem de nível e capítulo`);
  for (const E of etapasDe(M)) {
    ok(typeof E.txt === 'string' && E.txt.length > 5, `${M.id}: etapa ${E.ev} tem texto`);
    if (E.npc) ok(!!npc(E.npc), `${M.id}: NPC da etapa ${E.npc}`);
    if (E.hc) ok(!!CHEFES_HISTORIA[E.hc], `${M.id}: chefe ${E.hc}`);
    for (const k of Object.keys({ ...E.entregar, ...E.itens })) ok(!!ITENS[k], `${M.id}: item ${k}`);
    for (const c of E.campos || []) ok(CACA.some((o) => o.id === c), `${M.id}: campo ${c}`);
  }
  for (const k of Object.keys({ ...M.presente, ...M.recebe })) ok(!!ITENS[k], `${M.id}: presente ${k}`);
});
for (const [id, C] of Object.entries(CHEFES_HISTORIA)) {
  if (C.sala) { const S = MAPA_CLAREIRA.dungeon.salas.find((o) => o.id === C.sala); ok(S?.monstros.some((q) => q[0] === C.tipo), `chefe ${id} na sala ${C.sala}`); continue; }
  const c = CACA.find((o) => o.id === C.campo); ok(c && (c.tipo === C.tipo || c.tipos?.includes(C.tipo)), `chefe ${id} no campo ${C.campo} (${C.tipo})`);
}
for (const C of CAPITULOS) ok(HISTORIA.some((M) => M.cap === C.n), `capítulo ${C.n} tem missão`);
const app = historiaParaApp(); ok(app.capitulos.length === CAPITULOS.length && app.missoes.every((m) => m.etapas.length >= 1), 'app recebe capítulos e etapas');

// ---------- cenas (cinematica.gd) ----------
for (const [id, C] of Object.entries(CENAS)) {
  ok(C.tomadas.length > 0 && C.tomadas.every((T) => T.d > 0 && T.de?.p?.length === 3 && T.de?.o?.length === 3 && (!T.para || (T.para.p.length === 3 && T.para.o.length === 3))), `cena ${id}: tomadas com câmera`);
  for (const n of C.npcs || []) ok(!!npc(n), `cena ${id}: NPC ${n}`);
}
for (const M of HISTORIA) for (const c of [M.cena, ...etapasDe(M).map((E) => E.cena)].filter(Boolean)) ok(!!CENAS[c], `${M.id}: cena ${c} existe`);
ok(historiaParaApp().cenas === CENAS, 'app recebe as cenas');
{ // herói novo: "Pronto" no criador leva para o lado do poço e toca a abertura
  const s0 = new Simulacao(MAPA_CLAREIRA), j0 = s0.adicionarJogador('N', 'Novo', null, { podeCriar: true });
  s0.definirCriando('N', true);
  const r = s0.concluirCriacao('N', { nome: 'Lia' }); const e0 = s0.passo(0.05);
  ok(r && e0.some((e) => e.t === 'cena' && e.para === 'N' && e.id === 'acordar'), 'criou o personagem: cena da abertura');
  ok(Math.hypot(j0.x - CENAS.acordar.heroi.pos[0], j0.z - CENAS.acordar.heroi.pos[1]) < 0.01 && e0.some((e) => e.t === 'corrigir' && e.para === 'N'), 'herói acorda do lado do poço');
}
{ // as cenas das etapas (fragmento, Presa-de-Prata, diário, memórias, Kael) e o herói protegido enquanto ela toca
  const usadas = new Set(HISTORIA.flatMap((M) => etapasDe(M).map((E) => E.cena)).filter(Boolean));
  for (const c of ['fragmento', 'presa', 'diario', 'memoria1', 'kael', 'memoria2']) ok(usadas.has(c), `cena ${c} ligada numa etapa`);
  const s1 = new Simulacao(MAPA_CLAREIRA), j1 = s1.adicionarJogador('C', 'Cena');
  s1.cena(j1, 'kael'); s1.passo(0.05);
  const v0 = j1.vida; s1.ferir(j1, 50, { tipo: 'imp', nivel: 1 }); ok(j1.vida === v0, 'na cena o herói não apanha');
  s1.tempo = j1.cenaAte + 0.1; s1.ferir(j1, 50, { tipo: 'imp', nivel: 1 }); ok(j1.vida < v0, 'acabou a cena: apanha de novo');
}

// ---------- Ato I do começo ao fim ----------
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
const p = j.prog, h = () => p.hist;
let ev = [];
// ---------- o robô (André 2026-11-12: "um robô para fazer todas as missões e testar") ----------
// Em cima da partida inteira abaixo, o robô vê só o que o app vê (o "hi" de cada evento prog: a barrinha da missão, o
// botão Ir e o botão "Missão" do NPC) e faz o que o jogador faz no celular: Ir até o NPC (o app abre a janela a até
// PERTO_NPC m, missao_ativa.gd), toca uma vez em "Missão" e a janela fecha (conversa.gd _missao_iniciada). Cada toque
// que não fez nada, botão que não aparece, Ir que leva para dentro da névoa ou barrinha atrasada vira FALHOU no fim.
const PERTO_NPC = 4.0, PARA_ANTES = 1.8; // godot-prototipo/missao_ativa.gd
const cli = { hi: null }, robo = { toques: 0, missoes: new Set(), bugs: new Map() };
const bug = (k, txt) => { if (!robo.bugs.has(k)) robo.bugs.set(k, txt); };
const verCliente = (lista) => {
  let veio = false;
  for (const e of lista) if (e.t === 'prog' && e.para === 'A') { cli.hi = e.hi; veio = true; }
  const a = cli.hi?.alvo, M = HISTORIA[h()?.p];
  // etapa que acontece num lugar sem o Ir: o jogador não sabe para onde ir
  const E = veio && h()?.ac ? etapa() : null, semLugar = ['montar', 'criar', 'destruir', 'reforcar', 'barra', 'atributo', 'pesca', 'noite', 'time', 'arma', 'evoluir', 'resetar', 'leilao', 'sintetizar'];
  const naMochila = semLugar.includes(cli.hi?.ev) || cli.hi?.ev === 'veiculo' || /^(.*: )?junte ouro/.test(cli.hi?.txt || ''); // o que falta se faz na mochila (destruir, criar ferramenta, radar...)
  if (E && !a && !(semLugar.includes(E.ev) && !E.alvo) && !naMochila) bug(`semIr:${M.id}:${h().e}`, `${M.id} etapa ${h().e + 1} (${E.ev}): o botão Ir não tem para onde levar`);
  if (a && M && zonaFechadaEm(p, a.x, a.z)) bug(`nevoa:${M.id}:${cli.hi.e}`, `${M.id} etapa ${cli.hi.e + 1}: o Ir leva para dentro da névoa (${a.nome})`);
  if (cli.hi?.npc && a && a.npc !== cli.hi.npc && !/entrada d/.test(a.nome)) bug(`irnpc:${M?.id}:${cli.hi.e}`, `${M?.id} etapa ${cli.hi.e + 1}: o botão Missão está no ${cli.hi.npc} mas o Ir leva a ${a.nome}`);
};
const correr = (seg) => { for (let t = 0; t < seg / 0.05; t++) { const l = s.passo(0.05); ev.push(...l); verCliente(l); } };
const avisos = () => ev.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto).join(' | ');
const ir = (x, z, y) => Object.assign(j, { x, z, y: y ?? s.terreno.altura(x, z), cliente: null, orcT: null, cenaAte: 0 }); // ir = o tempo passou (a cena de antes acabou)
// Toque em "Missão" na janela do NPC, como no app. A primeira conversa de cada missão é feita do ponto mais longe em que
// o app já abre a janela (o Ir: PERTO_NPC); as outras de onde o Ir para (PARA_ANTES), cada vez de um lado.
let lado = 0;
const falar = (id) => {
  const n = npc(id), M0 = HISTORIA[h().p], d = M0 && !robo.missoes.has(M0.id) ? PERTO_NPC - 0.05 : PARA_ANTES, a = (lado++ * 2.4) % (Math.PI * 2);
  if (M0) robo.missoes.add(M0.id);
  verCliente(s.eventos); // o que já chegou ao app antes do toque (o teste às vezes mexe direto e toca na hora)
  ir(n.x + Math.cos(a) * d, n.z + Math.sin(a) * d, s.terreno.altura(n.x, n.z, (n.y || 0) + 2));
  const botao = cli.hi?.npc === id, antes = JSON.stringify(h()), e0 = ev.length;
  s.falar('A', { npc: id, missao: true }); correr(0.1); robo.toques++;
  const mudou = JSON.stringify(h()) !== antes, novos = ev.slice(e0).filter((e) => e.para === 'A');
  const quem = `${M0?.id || 'fim'} (${M0?.nome || ''}) no ${id}`;
  if (botao && !mudou && !novos.some((e) => e.t === 'fala' || e.t === 'aviso')) bug(`nada:${quem}`, `${quem}: tocou em Missão a ${d.toFixed(1)} m e nada aconteceu`);
  if (!botao && mudou) bug(`semBotao:${quem}`, `${quem}: a missão andou num NPC sem o botão Missão na janela`);
  if (mudou && h().p < HISTORIA.length) { // a barrinha (missao_ativa.gd) já mostra a etapa nova no mesmo pacote
    const e = h().ac ? h().e : -1;
    if (cli.hi?.id !== HISTORIA[h().p].id || cli.hi?.e !== e) bug(`barra:${quem}`, `${quem}: a barrinha ficou com a etapa velha (${cli.hi?.id} ${cli.hi?.e} em vez de ${HISTORIA[h().p].id} ${e})`);
  }
  // falar de novo com o mesmo NPC logo em seguida (fecha a janela e precisa abrir de novo): o André vê como "3 cliques"
  if (mudou && h().ac && cli.hi?.npc === id && etapa()?.ev === 'falar' && !etapa().entregar) bug(`deNovo:${quem}`, `${quem}: depois do toque o mesmo NPC pede outra conversa`);
};
const missao = () => HISTORIA[h().p]?.id;
const etapa = () => etapasDe(HISTORIA[h().p])[h().e];
const dar = (k, n) => { guardar(p.mochila, { k, n }); s.avisarProg(j); }; // no jogo, ganhar item manda o progresso ao app
const subir = (nv) => { while (p.nivel < nv) s.ganharXP(j, xpProximo(p.nivel) - p.xp); correr(0.1); };
const fim = (id) => { const i = HISTORIA.findIndex((M) => M.id === id); ok(h().p === i + 1 && !h().ac, `${id} entregue (${HISTORIA[i].nome}) | ${avisos()}`); ev = []; };
const alvoOk = () => { const a = s.histInfo(j).alvo; return !etapa() || ['montar', 'criar', 'destruir', 'reforcar', 'barra', 'atributo', 'pesca', 'noite'].includes(etapa().ev) && !etapa().alvo || !!a; };
const chefe = (id) => { // chega no campo (ou na sala da caverna), o chefe aparece e cai
  const C = CHEFES_HISTORIA[id], c = C.sala ? MAPA_CLAREIRA.dungeon.salas.find((o) => o.id === C.sala).pontos[0] : CACA.find((o) => o.id === C.campo);
  ir(c.x, c.z, c.y); correr(0.6);
  const b = s.inimigos.find((e) => e.hc === id && !e.morto);
  ok(!!b && b.nome === C.nome && b.vidaMax > 100, `${C.nome} apareceu no ${C.campo} (vida ${b?.vidaMax})`);
  if (b) { b.atacantes = new Set(['A']); s.ferir(b, 1e6, j); correr(0.1); }
};

// Capítulo 1
falar('lider'); ok(missao() === 'a1' && h().ac, 'Aldo deu "Acordar"');
ok(ev.some((e) => e.t === 'capitulo' && e.fase === 'abre' && e.n === 1), 'cartão do Capítulo 1');
ok(alvoOk() && s.histInfo(j).npc === 'reset', 'Ir leva ao Mestre Ivo e o botão Missão aparece nele');
falar('reset'); ok(h().e === 1, 'falou com o Mestre Ivo');
const esp = s.inimigos.find((e) => e.treino);
for (let k = 0; k < 10; k++) s.ferir(esp, 5, j, null);
ok(h().e === 2, '10 golpes no espantalho');
s.ferir(esp, 5, j, { q: 'x' }); ok(h().e === 3, 'skill no espantalho');
falar('andarilho'); ok(h().e === 4, 'falou com o Bento');
ir(-3, 12.6); correr(0.6); ok(h().e === 4, 'longe da rocha não vale');
ir(-12.6, 12.6, 3.5); correr(0.6); ok(h().e === 5, 'subiu na rocha');
falar('lider'); fim('a1');
falar('lider'); ok(missao() === 'a2' && h().ac, 'Aldo deu "Ferramentas de pedra"'); ok(alvoOk(), 'Ir leva a um galho solto');
const solto = [...s.coletaveis.values()].find((n) => n.tipo === 'galho'); ir(solto.x, solto.z);
s.pegarSolto(j, solto, { da: { lenha: 1 }, volta: 30 }); ok(h().n === 1, 'galho solto conta');
s.historia(j, 'item', { k: 'pedra', n: 3, de: 'solto' }); ok(h().e === 1, '4 soltos');
dar('lenha', 10); dar('pedra', 10);
s.fabricarUm('A', 'machado'); s.fabricarUm('A', 'picareta'); correr(0.1); ok(h().e === 3, 'criou machado e picareta');
s.historia(j, 'item', { k: 'lenha', n: 5, de: 'coleta' }); s.historia(j, 'item', { k: 'pedra', n: 3, de: 'coleta' }); ok(h().e === 5, 'cortou e minerou');
falar('lider'); fim('a2');
falar('lider'); ok(missao() === 'a3', 'Aldo deu a missão dos Puglins');
const ci1 = s.cacas.findIndex((c) => c.def.id === 'caca1');
for (let k = 0; k < 6; k++) s.contarHistoria(j, { tipo: 'puglin', sp: { caca: ci1 } });
chefe('gorduncho'); correr(0.6); ok(h().e === 3, 'Gorduncho caiu e o fragmento (na clareira) foi tocado'); ok(s.histInfo(j).npc === 'lider', 'volta ao Aldo');
falar('lider'); fim('a3');
ok(liberado(p, '1b') && contar(p.mochila, 'pocao') >= 3, 'Campos do Leste abertos e as poções de presente');
// rumor do capítulo 1 no Nv 2
subir(2); ok(ev.some((e) => e.t === 'rumor' && e.quem === 'Tomás'), 'rumor do Tomás no Nv 2');
// Capítulo 2
falar('ferreiro'); ok(!h().ac, 'Tomás ainda não dá no Nv 2');
subir(3); falar('ferreiro'); ok(missao() === 'a4' && h().ac, 'Tomás deu o cobre no Nv 3');
ok(!liberado(p, 'forja'), 'forja ainda fechada');
s.historia(j, 'item', { k: 'minerio_cobre', n: 6, de: 'coleta' }); ok(liberado(p, 'forja') && h().e === 1, 'minerou: forja aberta');
dar('minerio_cobre', 6); dar('lenha', 4); ir(npc('ferreiro').x + 1, npc('ferreiro').z);
s.criarUm('A', { r: 'barra_cobre' }); s.criarUm('A', { r: 'barra_cobre' }); correr(0.1); ok(h().e === 2, 'fundiu 2 barras de cobre | ' + avisos());
falar('ferreiro'); fim('a4');
falar('comerciante'); ok(missao() === 'a5', 'Rosa deu a banca');
ok(contar(p.mochila, 'couro') >= 2 && contar(p.mochila, 'tecido') >= 1, 'a Rosa deu o couro e o tecido ao dar a missão'); // André 2026-11-11
ir(npc('comerciante').x + 1, npc('comerciante').z); s.criarUm('A', { r: 'short' }); correr(0.1); ok(h().e === 1, 'costurou o short na bancada | ' + avisos());
const iv = p.mochila.findIndex((o) => o?.k === 'lenha'); s.item('A', { acao: 'vender', i: iv }); ok(h().e === 2, 'vendeu algo');
p.ouro += 500; s.item('A', { acao: 'comprar', i: 0, n: 3 }); correr(0.1); ok(h().e === 3, 'comprou 3 poções | ' + avisos());
falar('comerciante'); fim('a5');
falar('ferreiro'); ok(missao() === 'a6', 'Tomás deu "Sua própria luta"');
s.definirBarra('A', { barra: 'espada', lista: p.barras.espada }); ok(h().e === 1, 'montou a barra');
s.distribuirAtributo('A', 'for'); ok(h().e === 2, 'gastou atributo');
falar('ferreiro'); fim('a6'); ok(p.mochila.some((o) => o?.k === 'espada' && o.r === 1), 'espada Rara de presente');
// Capítulo 3
subir(5); falar('andarilho'); ok(missao() === 'a7', 'Bento deu os uivos');
const ci3 = s.cacas.findIndex((c) => c.def.id === 'caca3');
for (let k = 0; k < 6; k++) s.contarHistoria(j, { tipo: 'lobo', sp: { caca: ci3 } });
tirarTudo('couro'); dar('couro', 4); correr(0.6); falar('andarilho'); fim('a7');
falar('andarilho'); s.historia(j, 'item', { k: 'minerio_ferro', n: 3, de: 'coleta' }); dar('minerio_ferro', 3); dar('lenha', 2);
ir(npc('ferreiro').x + 1, npc('ferreiro').z); s.criarUm('A', { r: 'barra_ferro' }); correr(0.1); ok(h().e === 2, 'barra de ferro');
falar('andarilho'); fim('a8');
p.dia = { h: 12, t: Date.now() }; // de dia antes de aceitar (sem isso o relógio da conta segue a hora real e às vezes já é noite)
falar('andarilho'); ok(missao() === 'a9', 'o alfa da noite');
 correr(0.6); ok(h().e === 0 && /agora são 12h/.test(s.histInfo(j).txt), 'de dia espera: ' + s.histInfo(j).txt);
p.dia = { h: 20, t: Date.now() }; correr(0.6); ok(h().e === 1, 'chegou a noite');
ok(liberado(p, 'lobo') === false, 'o lobo ainda não monta antes de cansar o alfa');
chefe('presa'); ok(h().e === 2 && liberado(p, 'lobo'), 'cansou Presa-de-Prata: dá para montar');
s.montar('A'); correr(0.1); ok(h().e === 3, 'montou');
j.montado = null; falar('andarilho'); fim('a9');
// Capítulo 4
subir(8); falar('curandeira'); ok(missao() === 'a10', 'Lúcia deu o caminho do lago');
const ci2 = s.cacas.findIndex((c) => c.def.id === 'caca2');
for (let k = 0; k < 8; k++) s.contarHistoria(j, { tipo: 'imp', sp: { caca: ci2 } });
chefe('brasa'); falar('curandeira'); fim('a10'); ok(liberado(p, '1c'), 'Bosque do Sul aberto');
falar('m_peixe'); ok(missao() === 'a11' && liberado(p, 'pesca'), 'Nico deu a vara e a pesca abre');
dar('couro', 1); dar('lenha', 3); s.fabricarUm('A', 'vara'); correr(0.1); ok(h().e === 1, 'criou a vara');
ok(alvoOk(), 'Ir leva a um spot de pesca');
s.historia(j, 'pesca', { k: 'lambari', n: 4 }); falar('m_peixe'); fim('a11');
falar('lider'); ok(missao() === 'a12', 'Aldo deu o terreno');
const L = { def: { id: 'tA', x0: -20, x1: -10, z0: 80, z1: 90 }, dono: j.conta, pecas: [{ k: 'bancada' }], horta: {} }; s.lotes.set('tA', L); correr(0.6);
ok(h().e === 2, 'já tinha terreno e bancada: as duas etapas passam');
L.pecas.push({ k: 'fogao' }); correr(0.6); ok(h().e === 3, 'fogão no terreno');
s.historia(j, 'criar', { k: 'peixe_assado', n: 2 }); dar('peixe_assado', 2); falar('curandeira'); fim('a12');
ok(contar(p.mochila, 'semente_cenoura') === 4, 'sementes da Cecília');
// Capítulo 5
subir(12); ok(ev.some((e) => e.t === 'rumor' && e.quem === 'Rosa'), 'rumores do capítulo 4 ao subir');
falar('comerciante'); ok(missao() === 'a13', 'Rosa deu os rastros');
for (const [x, z] of etapa().pontos) { ok(!zonaFechadaEm(p, x, z) && !noLago(x, z), `pista em (${x}, ${z}) fora da névoa e da água`); ir(x, z); correr(0.6); }
ok(h().e === 1, 'viu as 3 pistas');
chefe('sombra'); falar('comerciante'); fim('a13');
falar('m_lenha'); ok(missao() === 'a14', 'Joca deu o pack');
s.historia(j, 'pack_fez', { k: 'lenha' }); s.historia(j, 'pack', { k: 'lenha', npc: 'm_pedra' }); ok(h().e === 1, 'pack no mercador errado não conta');
s.historia(j, 'pack', { k: 'lenha', npc: 'm_horta' }); falar('comerciante'); fim('a14');
falar('ferreiro'); ok(missao() === 'a15' && contar(p.mochila, 'selo_raro') >= 1, 'Tomás deu o Selo Raro');
s.historia(j, 'destruir', {}); s.historia(j, 'evoluir', { v: 0 }); ok(h().e === 1, 'evoluir para Comum não conta');
s.historia(j, 'evoluir', { v: 1 }); s.historia(j, 'reforcar', { v: 1 }); s.historia(j, 'reforcar', { v: 2 }); falar('ferreiro'); fim('a15');
falar('m_peixe'); ok(missao() === 'a16', 'Nico deu o barquinho');
dar('barquinho', 1); correr(0.6); ok(h().e === 1, 'já tinha barquinho');
ir(-3, 198); correr(0.6); ok(h().e === 1, 'nadando não vale');
j.veiculo = 'barquinho'; correr(0.6); ok(h().e === 2, 'no meio do lago de barquinho');
s.historia(j, 'pesca', { k: 'lambari', barco: false }); ok(h().e === 2, 'pescar fora do barco não vale');
s.historia(j, 'pesca', { k: 'lambari', barco: true }); j.veiculo = null; falar('m_peixe'); fim('a16');
ok(liberado(p, '1d') && contar(p.mochila, 'radar_pesca') === 1, 'Fundo do Leste aberto e o radar de presente');
ok(missao() === 'b1', 'depois do Ato I vem o Ato II com o Aldo');

// ---------- Ato II ----------
// Capítulo 6
subir(15); falar('lider'); ok(missao() === 'b1' && h().ac, 'Aldo pediu a casa');
ok(ev.some((e) => e.t === 'capitulo' && e.fase === 'abre' && e.n === 6), 'cartão do Capítulo 6');
for (let k = 0; k < 3; k++) L.pecas.push({ k: 'fundacao' }); correr(0.6); ok(h().e === 0 && h().n === 3, 'conta as fundações que já estão no terreno (3/4)');
L.pecas.push({ k: 'fundacao' }); correr(0.6); ok(h().e === 1, '4 fundações');
for (const k of ['parede', 'parede', 'parede', 'parede', 'porta', 'janela', 'telhado', 'cama', 'bau']) L.pecas.push({ k });
correr(0.6); ok(etapa().ev === 'dormir', 'casa pronta: falta dormir');
s.historia(j, 'dormir'); falar('lider'); fim('b1');
falar('m_horta'); ok(missao() === 'b2' && contar(p.mochila, 'semente_batata') === 2, 'Sálvia deu as sementes');
dar('enxada', 1); dar('regador', 1); correr(0.6); ok(etapa().ev === 'plantar', 'já tinha enxada e regador');
for (let k = 0; k < 6; k++) s.historia(j, 'plantar', { k: 'cenoura' });
for (let k = 0; k < 3; k++) s.historia(j, 'regar');
for (let k = 0; k < 6; k++) s.historia(j, 'colher', { k: 'cenoura' });
s.historia(j, 'criar', { k: 'sopa_legumes', n: 3 }); ok(etapa().k === 'barra_aco', 'sopas feitas');
dar('sopa_legumes', 3); dar('barra_aco', 1); correr(0.6); ok(etapa().ev === 'falar' && etapa().npc === 'guardiao', 'aço na mochila: leva ao Gaspar');
falar('guardiao'); fim('b2'); ok(contar(p.mochila, 'barra_aco') === 0, 'o Gaspar pegou o aço');
subir(18); falar('guardiao'); ok(missao() === 'b3', 'Gaspar deu o passe');
dar('passe_caverna', 1); correr(0.6); ok(etapa().ev === 'time', 'já tinha o passe: falta o time');
const B = s.adicionarJogador('B', 'Bia'); B.time = j.time = { lider: 'A', membros: ['A', 'B'] }; correr(0.6); ok(etapa().ev === 'falar', 'com alguém no time');
falar('guardiao'); fim('b3');
subir(20); ok(!liberado(p, '1e'), 'a caverna ainda fechada');
falar('guardiao'); ok(missao() === 'h6' && liberado(p, '1e'), 'O Trono vazio: a caverna abre ao aceitar');
s.historia(j, 'passe', { k: 'usar' }); ok(h().e === 1, 'usou o passe');
j.caverna = { desde: 0 }; ok(alvoOk() && s.histInfo(j).alvo, 'Ir leva à Galeria dos Golens');
for (let k = 0; k < 4; k++) s.historia(j, 'matar', { tipo: 'golem', sala: 'sala1' });
s.historia(j, 'matar', { tipo: 'maw', sala: 'sala1' }); ok(h().e === 2, 'Galeria atravessada; Maw da sala errada não conta no Poço');
for (let k = 0; k < 3; k++) s.historia(j, 'matar', { tipo: 'maw', sala: 'sala2' });
ok(h().e === 3, 'Poço atravessado');
for (const S of s.dungeon.salas) s.encherSala(S);
chefe('velado_montanha');
const sela = etapa(); ok(sela.ev === 'pos' && sela.caverna, 'falta tocar o selo');
j.caverna = null; ir(sela.pos[0], sela.pos[1], 20); correr(0.6); ok(etapa() === sela, 'em cima da montanha, fora da caverna, não vale');
j.caverna = { desde: 0 }; ir(sela.pos[0], sela.pos[1], 1.6); correr(0.6); ok(etapa().ev === 'falar', 'tocou o selo lá dentro');
j.caverna = null; falar('guardiao'); fim('h6');
// Capítulo 7
falar('m_metal'); ok(missao() === 'b5' && ev.some((e) => e.t === 'capitulo' && e.n === 7), 'Malaquias deu o carrinho (Capítulo 7)');
dar('carrinho', 1); correr(0.6); ok(etapa().k === 'galao', 'já tinha o carrinho');
s.historia(j, 'criar', { k: 'galao', n: 4 }); s.historia(j, 'veiculo', { k: 'abastecer' });
s.historia(j, 'pack_fez', { k: 'metal' }); s.historia(j, 'pack_fez', { k: 'metal' });
s.historia(j, 'pack', { k: 'metal', npc: 'm_peixe', de: 'costas' }); ok(h().n === 0, 'pack nas costas não vale (é de carrinho)');
s.historia(j, 'pack', { k: 'metal', npc: 'm_peixe', de: 'carrinho' }); s.historia(j, 'pack', { k: 'metal', npc: 'm_peixe', de: 'carrinho' });
p.carrinho = { lv: 2, vida: 400, comb: 0, packs: [] }; correr(0.6); ok(etapa().ev === 'falar', 'carrinho já no Nv 2');
falar('m_metal'); fim('b5');
subir(25); falar('lider'); ok(missao() === 'b6', 'Aldo: os batedores');
for (const [x, z] of etapa().pontos) { ok(!zonaFechadaEm(p, x, z) && !noLago(x, z), `batedor em (${x}, ${z}) fora da névoa e da água`); ir(x, z); correr(0.6); }
const ci10 = s.cacas.findIndex((c) => c.def.id === 'caca10');
for (let k = 0; k < 8; k++) s.contarHistoria(j, { tipo: 'imp', sp: { caca: ci10 } });
chefe('cacador'); falar('lider'); fim('b6');
ok(zonaFechadaEm(p, 206, 166), 'o Bráulio ainda está atrás da névoa antes da Brasa-Antiga');
subir(27); falar('lider'); ok(missao() === 'h7' && liberado(p, '1f'), 'Brasa-Antiga: as Terras dos Golens abrem');
ok(!zonaFechadaEm(p, 206, 166), 'com a missão aceita, a névoa do Bráulio abre');
chefe('brasa_antiga'); falar('m_couro'); fim('h7'); ok(contar(p.mochila, 'galao') >= 6, '6 galões de presente');
// Capítulo 8
subir(28); falar('m_couro'); ok(missao() === 'b7', 'Bráulio: couro em troca de rodas');
s.historia(j, 'pack_fez', { k: 'lenha' }); s.historia(j, 'pack_fez', { k: 'lenha' });
s.historia(j, 'pack', { k: 'lenha', npc: 'm_couro', de: 'carrinho' }); s.historia(j, 'pack', { k: 'lenha', npc: 'm_couro', de: 'carrinho' });
correr(0.6); ok(etapa().ev === 'falar', 'carrinho inteiro: a etapa de consertar passa');
falar('m_couro'); fim('b7');
falar('ferreiro'); ok(missao() === 'b9', 'Tomás: prontos para a caçada');
s.historia(j, 'evoluir', { v: 1 }); ok(h().e === 0, 'Rara não vale'); s.historia(j, 'evoluir', { v: 2 });
s.historia(j, 'reforcar', { v: 2 }); ok(h().e === 1, '+2 não vale'); s.historia(j, 'reforcar', { v: 3 }); // +3 (auditoria 2026-11-13: +6 não dava no Nv28)
guardar(p.mochila, { k: 'colar', r: 0 }); dar('ensopado', 3); correr(0.6); falar('ferreiro'); fim('b9');
subir(30); falar('lider'); ok(missao() === 'h8', 'Warrok, o Carcereiro');
correr(0.6); ok(h().e === 1, 'o time ainda está junto');
const ci11 = s.cacas.findIndex((c) => c.def.id === 'caca11');
for (let k = 0; k < 6; k++) s.contarHistoria(j, { tipo: 'golem', sp: { caca: ci11 } });
s.contarHistoria(j, { tipo: 'warrok', sp: { caca: ci11 } }); falar('lider'); fim('h8'); ok(liberado(p, 'B1'), 'o oeste abriu');
falar('reset'); ok(missao() === 'b11', 'Mestre Ivo: você não lembra de mim');
const vivos = s.inimigos.length; chefe('kael');
ok(ev.some((e) => e.t === 'aviso' && /Ela vai gostar de saber/.test(e.texto)) && ev.some((e) => e.t === 'nevoa_some'), 'Kael para na metade, fala e some na névoa');
ok(!s.inimigos.some((e) => e.hc === 'kael'), 'o corpo do Kael sumiu');
ok(etapa().ev === 'pos', 'duelo conta como vencido');
ir(196, 202); correr(0.6); falar('reset'); fim('b11');
ok(s.histInfo(j).titulo === 'Sentinela da Ordem' && contar(p.mochila, 'peitoral') >= 1, 'título do ato e o peitoral Raro +5');
ok(missao() === 'c1', 'depois do Ato II vem o capítulo 9 (A cidade da ponte)');

// ---------- Atos III e IV (Entrega 4: capítulos 9 a 13) ----------
const chaoGruta = (id, x, z) => noTunel(TUNEIS_MUNDO.find((C) => C.id === id), x, z)?.y; // o chão do túnel (o terreno dá o topo do morro)
const totem = (id) => TOTENS.lista.find((t) => t.id === id);
const tocar = (id) => { const t = totem(id); ir(t.x + 2, t.z); s.tocarTotem(j, t); correr(0.6); };
const viajar = (id) => { s.chegarNoTotem(j, totem(id)); correr(0.1); };
const matarEm = (id, n, tipo) => { const ci = s.cacas.findIndex((c) => c.def.id === id); for (let k = 0; k < n; k++) s.contarHistoria(j, { tipo: tipo || s.cacas[ci].def.tipos[0], sp: { caca: ci } }); };
const entregar = (k, npcId, de, n = 1) => { for (let q = 0; q < n; q++) s.historia(j, 'pack', { k, npc: npcId, de }); };
p.ouro += 200000;
// Capítulo 9
subir(33); falar('andarilho'); ok(missao() === 'c1' && ev.some((e) => e.t === 'capitulo' && e.fase === 'abre' && e.n === 9), 'Bento: a cidade da ponte (Capítulo 9)');
s.montar('A'); correr(0.1); ok(etapa().ev === 'totem', 'montou no lobo'); j.montado = null;
ok(alvoOk(), 'Ir leva ao totem do Rio Claro');
tocar('rio_claro'); ok(etapa().npc === 'v_heitor', 'tocou o totem do Rio Claro');
falar('v_heitor'); viajar('rio_claro'); ok(etapa().ev === 'viajar' && etapa().k === 'clareira', 'viajar para o lugar errado não conta');
viajar('clareira'); viajar('rio_claro'); ok(etapa().npc === 'alquimista', 'foi e voltou de totem');
falar('alquimista'); falar('andarilho'); fim('c1');
falar('v_otavio'); ok(missao() === 'c2', 'Otávio: a Casa do Comércio');
{ const o = npc('v_otavio'); ir(o.x + 1, o.z); dar('lenha', 3); const iv = p.mochila.findIndex((x) => x?.k === 'lenha');
  s.leilaoMsg('A', { acao: 'anunciar', i: iv, n: 1, preco: 50, horas: 24 }); correr(0.1); ok(h().e === 1, 'anunciou no leilão | ' + avisos());
  const casa = s.leilao.casa[0]; s.leilaoMsg('A', { acao: 'comprar', id: casa.id }); correr(0.1); ok(h().e === 2, 'comprou da casa | ' + avisos());
  const meu = s.leilao.meus(j.conta)[0]; ok(!!meu, 'o anúncio está lá');
  const C = s.adicionarJogador('C2', 'Caio'); C.prog.ouro = 1000; Object.assign(C, { x: o.x + 1.5, z: o.z, y: j.y });
  s.leilaoMsg('C2', { acao: 'comprar', id: meu.id }); correr(0.1);
  s.leilaoMsg('A', { acao: 'retirar' }); correr(0.1); }
falar('v_otavio'); fim('c2');
subir(35); falar('m_abobora'); ok(missao() === 'c3' && contar(p.mochila, 'semente_abobora') >= 2, 'Abel deu as sementes');
for (const k of ['abobora', 'milho', 'rabanete']) s.historia(j, 'plantar', { k });
s.historia(j, 'criar', { k: 'pao_milho', n: 2 }); s.historia(j, 'pack_fez', { k: 'abobora' }); s.historia(j, 'pack_fez', { k: 'abobora' });
p.carrinho = { lv: 3, vida: 600, comb: 0, packs: [] }; correr(0.6); ok(etapa().ev === 'pack', 'carrinho já no Nv 3');
entregar('abobora', 'm_pedra', 'costas'); ok(h().n === 0, 'pack nas costas não vale');
entregar('abobora', 'm_pedra', 'carrinho', 2); falar('m_abobora'); fim('c3');
subir(36); falar('v_heitor'); ok(missao() === 'c4', 'Heitor: o rio cinza');
s.historia(j, 'pesca', { k: 'tilapia', n: 3 }); chefe('tecela'); falar('v_heitor'); fim('c4');
subir(38); falar('m_abobora'); ok(missao() === 'h9', 'A serra fechada');
matarEm('c_v3', 8); chefe('pedra_viva'); falar('m_abobora'); fim('h9');
ok(liberado(p, 'B2') && contar(p.mochila, 'runa_rara') >= 1, 'o norte abriu e a runa de presente');
// Capítulo 10
subir(40); ok(ev.some((e) => e.t === 'rumor' && e.quem === 'Dario'), 'rumor do Dario');
falar('v_ursula'); ok(missao() === 'c5', 'Úrsula: a canção da serra');
tocar('pouso_serra'); correr(0.6); ok(etapa().ev === 'matar', 'totem do Pouso tocado e o time ainda junto');
matarEm('c_v7', 8);
for (const [x, z] of etapa().pontos) { ok(!zonaFechadaEm(p, x, z) && !noLago(x, z), `pingente em (${x}, ${z}) fora da névoa e da água`); ir(x, z); correr(0.6); }
falar('v_ursula'); fim('c5');
subir(42); falar('v_ursula'); ok(missao() === 'c6', 'a gruta que canta'); correr(0.6);
matarEm('cav_serra_norte', 4);
chefe('kael2'); ok(ev.some((e) => e.t === 'aviso' && /quebra o selo assim mesmo/.test(e.texto)), 'Kael foge de novo');
const selo2 = etapa(); ok(selo2.ev === 'pos' && selo2.ate, 'falta tocar os pedaços do selo');
ir(selo2.pos[0], selo2.pos[1], 40); correr(0.6); ok(etapa() === selo2, 'em cima do morro não vale');
ir(selo2.pos[0], selo2.pos[1], chaoGruta('cav_serra_norte', selo2.pos[0], selo2.pos[1])); correr(0.6); ok(etapa().ev === 'falar', `tocou o selo no chão da gruta (y ${j.y.toFixed(1)}) | ` + avisos());
ok(ev.some((e) => e.t === 'cena' && e.id === 'memoria3'), 'memória 3');
falar('v_ursula'); fim('c6');
falar('v_iara'); ok(missao() === 'c7', 'Iara: lutar diferente');
s.distribuirAtributo('A', 'for'); { const o = npc('v_iara'); ir(o.x + 1, o.z); const ouro0 = p.ouro; s.resetarBuild('A'); correr(0.1);
  ok(h().e === 1 && p.ouro === ouro0, 'resetou de graça com a Iara | ' + avisos()); }
s.distribuirAtributo('A', 'for'); s.definirBarra('A', { barra: 'espada', lista: p.barras.espada }); matarEm('c_v8', 6);
falar('v_iara'); fim('c7');
{ const o = npc('v_iara'); ir(o.x + 1, o.z); const ouro0 = p.ouro; s.resetarBuild('A'); ok(p.ouro < ouro0, 'depois da missão o reset cobra'); }
falar('m_metal'); ok(missao() === 'h10', 'Malaquias: a ponte dos Juncos');
dar('lenha', 40); dar('barra_ferro', 6); dar('barra_aco', 2); falar('m_metal'); falar('m_metal'); fim('h10'); ok(liberado(p, 'B3'), 'o leste abriu');
subir(43); falar('alquimista'); ok(missao() === 'c8', 'Mirela: a tinta das runas');
s.historia(j, 'sintetizar', { k: 'catalisador_raro' }); falar('alquimista'); fim('c8');
// Capítulo 11
subir(45); falar('v_tiao'); ok(missao() === 'c9', 'Tião: três pedras');
tocar('juncos'); viajar('rio_claro'); viajar('juncos'); ok(etapa().ev === 'pesca', 'duas viagens de totem');
s.historia(j, 'pesca', { k: 'traira', n: 2 }); falar('v_tiao'); fim('c9');
subir(47); falar('lider'); matarEm('c_v9', 3); matarEm('c_v6', 3); falar('lider'); fim('c10');
subir(48); falar('lider'); ok(missao() === 'h11' && !liberado(p, 'B4'), 'O Porto esquecido: o sul ainda fechado');
chefe('maira'); ok(liberado(p, 'B4'), 'Maíra caiu: o sul abre na etapa');
falar('v_odete'); fim('h11');
subir(49); falar('m_conserva'); ok(missao() === 'c11', 'Dona Marta: conservas');
s.historia(j, 'plantar', { k: 'batata' }); s.historia(j, 'plantar', { k: 'milho' });
for (let k = 0; k < 4; k++) s.historia(j, 'pack_fez', { k: 'conserva' });
entregar('conserva', 'm_abobora', 'carrinho', 4); p.mochila.fill(null, 20); falar('m_conserva'); fim('c11'); // lugar para o presente (os kits do comecinho, shared/kit.js, ocupam uns lugares)
ok(s.histInfo(j).titulo === 'Voz das Estradas' && contar(p.mochila, 'selo_epico') >= 1, 'título Voz das Estradas e o Selo Épico');
// Capítulo 12
subir(50); p.dia = { h: 12, t: Date.now() }; falar('m_conserva'); ok(missao() === 'c12', 'a gruta dos Juncos'); correr(0.6); ok(h().e === 0, 'de dia espera');
p.dia = { h: 21, t: Date.now() }; correr(0.6); matarEm('cav_juncos', 8); chefe('bocarra'); falar('m_conserva'); fim('c12');
falar('reset'); ok(missao() === 'h12', 'Mestre Ivo: segurar o selo');
const fundo = etapa(); ir(fundo.pos[0], fundo.pos[1], chaoGruta('cav_juncos', fundo.pos[0], fundo.pos[1])); correr(0.6); ok(etapa().ev === 'matar', `chegou no selo do mar (y ${j.y.toFixed(1)})`);
matarEm('cav_juncos', 10); correr(0.6); correr(0.6); ok(etapa().ev === 'falar', 'aguentou as ondas ao lado do selo e encostou a marca'); ok(ev.some((e) => e.t === 'cena' && e.id === 'memoria4'), 'memória 4'); falar('reset'); fim('h12');
ok(liberado(p, 'C'), 'a Ilha do Meio abriu');
subir(52); falar('v_odete'); ok(missao() === 'c13', 'Odete: a travessia');
const cais = etapa(); ir(cais.pos[0], cais.pos[1]); correr(0.6); ok(etapa() === cais, 'sem barco não vale');
j.veiculo = 'barquinho'; correr(0.6); ok(etapa().ev === 'pesca', 'barquinho no Cais de Vael');
s.historia(j, 'pesca', { k: 'sardinha', n: 2 }); const ilha = etapa(); ir(ilha.pos[0], ilha.pos[1]); correr(0.6); j.veiculo = null;
ok(etapa().npc === 'm_perola', 'remou até o Cais Norte da Ilha'); falar('m_perola'); fim('c13');
// Capítulo 13
subir(54); falar('v_coral'); ok(missao() === 'c14', 'Avó Coral: pérolas');
tocar('ilha'); ok(alvoOk(), 'Ir leva a um veio de cristal');
s.historia(j, 'item', { k: 'cristal', n: 2, de: 'coleta' }); s.historia(j, 'pesca', { k: 'traira', n: 3 }); s.historia(j, 'pack_fez', { k: 'perola' });
falar('v_coral'); fim('c14');
subir(60); falar('v_odete'); ok(missao() === 'c15', 'Odete: o navio');
p.navio = { porao: [], chao: { x: 101, z: 454 } }; correr(0.6); ok(etapa().ev === 'pos' && etapa().navio, 'já tinha o navio (na água)');
const c1 = etapa(); ir(c1.pos[0], c1.pos[1]); j.veiculo = 'barquinho'; correr(0.6); ok(etapa() === c1, 'de barquinho não vale');
j.veiculo = 'navio'; correr(0.6); const c2 = etapa(); ir(c2.pos[0], c2.pos[1]); correr(0.6); j.veiculo = null;
falar('v_odete'); fim('c15');
subir(62); falar('m_perola'); ok(missao() === 'c16', 'Maré: quem te carregou'); correr(0.6);
matarEm('cav_ilha', 4); chefe('kael3'); ok(ev.some((e) => e.t === 'aviso' && /insígnia/.test(e.texto)), 'Kael foge e deixa a insígnia');
const selo3 = etapa(); ir(selo3.pos[0], selo3.pos[1], chaoGruta('cav_ilha', selo3.pos[0], selo3.pos[1])); correr(0.6); ok(etapa().npc === 'reset', `tocou o selo da ilha (y ${j.y.toFixed(1)})`);
ok(ev.some((e) => e.t === 'cena' && e.id === 'memoria5'), 'memória 5');
falar('reset'); falar('m_perola'); fim('c16');
subir(64); falar('m_perola'); ok(missao() === 'h13' && !liberado(p, 'D1'), 'A outra margem');
matarEm('c_i3', 5); matarEm('c_i4', 5); chefe('abissal'); ok(liberado(p, 'D1'), 'Abissal caiu: a costa de Aurora abre');
s.historia(j, 'pack_fez', { k: 'perola' }); s.historia(j, 'pack_fez', { k: 'perola' });
entregar('perola', 'm_ervas', 'carrinho'); ok(h().n === 0, 'pérola de carrinho não vale (é no porão)');
entregar('perola', 'm_ervas', 'porao', 2); p.mochila.fill(null, 20); // mochila com lugar para o presente
falar('m_ervas');
ok(ev.some((e) => e.t === 'capitulo' && e.fase === 'fecha' && e.n === 13), 'cartão do fim do Capítulo 13'); fim('h13');
ok(s.histInfo(j).titulo === 'Vento do Mar' && contar(p.mochila, 'selo_lendario') >= 1, `título Vento do Mar e o Selo Lendário (${s.histInfo(j).titulo}, ${contar(p.mochila, 'selo_lendario')}, ${p.mochila.filter(Boolean).length}/${p.mochila.length})`);
ok(missao() === 'e1', 'depois do Ato IV vem o capítulo 14 (A cidade que esqueceu)');

// ---------- Ato V e o final (Entrega 5: capítulos 14 a 16, Nv 68 a 100) ----------
// Capítulo 14
subir(68); p.dia = { h: 12, t: Date.now() }; falar('m_ervas'); ok(missao() === 'e1' && ev.some((e) => e.t === 'capitulo' && e.fase === 'abre' && e.n === 14), 'Sálvio: a cidade que esqueceu (Capítulo 14)');
tocar('aurora'); ok(etapa().ev === 'noite', 'totem de Aurora tocado: espera a noite');
p.dia = { h: 22, t: Date.now() }; correr(0.6);
for (const [x, z] of etapa().pontos) { ok(!zonaFechadaEm(p, x, z) && !noLago(x, z), `eco em (${x}, ${z}) fora da névoa e da água`); ir(x, z); correr(0.6); }
ok(/Vesper/.test(avisos()), 'a carta da Vesper');
falar('v_elara'); falar('m_obsid'); fim('e1');
ok(!!npc('v_kael'), 'o Kael está na lista de NPCs de Aurora');
{ const k = npc('v_kael'); ir(k.x + 1, k.z); ev = []; s.falar('A', { npc: 'v_kael' }); correr(0.1); ok(!ev.some((e) => e.t === 'fala' && e.npc === 'v_kael'), 'antes da missão o Kael não está em Aurora'); }
subir(72); falar('v_elara'); ok(missao() === 'e2', 'Elara: a casa da avó');
const casa = etapa(); ok(!zonaFechadaEm(p, casa.pos[0], casa.pos[1]) && !noLago(casa.pos[0], casa.pos[1]), 'a casa da avó fora da névoa e da água'); ir(casa.pos[0], casa.pos[1]); correr(0.6);
s.historia(j, 'criar', { k: 'obra_parede', n: 3 }); s.historia(j, 'criar', { k: 'obra_janela' }); dar('obra_parede', 3); dar('obra_janela', 1);
falar('v_elara'); fim('e2'); ok(p.mochila.some((o) => o?.k === 'colar' && o.r === 2), 'Colar de Estrela Épico');
subir(76); falar('alquimista'); ok(missao() === 'e3', 'Mirela: o Catalisador da Memória');
s.historia(j, 'pack_fez', { k: 'obsid' }); s.historia(j, 'pack_fez', { k: 'ervas' });
entregar('obsid', 'm_abobora', 'carrinho'); entregar('ervas', 'm_abobora', 'carrinho'); dar('cristal', 6); dar('barra_aco', 2);
falar('alquimista'); fim('e3'); ok(contar(p.mochila, 'catalisador_memoria') === 1, 'Catalisador da Memória na mochila');
subir(80); falar('v_elara'); ok(missao() === 'h14' && !liberado(p, 'D2'), 'Kael: o leste ainda fechado'); correr(0.6);
ok(etapa().ev === 'matar', 'com o catalisador e o time, entra na gruta');
matarEm('cav_aurora', 4); chefe('kael4'); ok(ev.some((e) => e.t === 'aviso' && /Dario\?/.test(e.texto)), 'o catalisador: "Dario?"');
const selo6 = etapa(); ir(selo6.pos[0], selo6.pos[1], chaoGruta('cav_aurora', selo6.pos[0], selo6.pos[1])); correr(0.6);
ok(etapa().npc === 'v_kael' && liberado(p, 'D2'), `segurou o selo com o Kael e o leste abriu (y ${j.y.toFixed(1)})`);
ok(ev.some((e) => e.t === 'cena' && e.id === 'memoria6'), 'memória 6');
falar('v_kael'); fim('h14'); ok(contar(p.mochila, 'catalisador_memoria') === 0 && p.mochila.some((o) => o?.k === 'espada' && o.r === 1 && o.e === 10), 'o Kael pegou o catalisador e deu a espada Rara +10');
// Capítulo 15
subir(84); ok(ev.some((e) => e.t === 'rumor' && e.quem === 'Kael'), 'rumor do Kael');
falar('m_brasa'); ok(missao() === 'e4', 'Fagulha: brasa viva');
falar('v_bras'); tocar('posto_leste'); s.historia(j, 'pack_fez', { k: 'brasa' }); s.historia(j, 'pack_fez', { k: 'brasa' });
entregar('brasa', 'm_pedra', 'carrinho', 2); falar('m_brasa'); fim('e4');
subir(88); falar('ferreiro'); ok(missao() === 'e5', 'Tomás: a estrela na lâmina');
p.equip.espada = { k: 'espada', r: 2, e: 0 }; correr(0.6); ok(etapa().ev === 'arma', 'arma Épica não vale');
p.equip.espada = { k: 'espada', r: 3, e: 4 }; correr(0.6); ok(etapa().ev === 'falar', 'arma Lendária equipada');
dar('barra_aco', 10); dar('cristal', 10); falar('ferreiro'); falar('ferreiro'); fim('e5'); ok(p.equip.espada.e === 5, 'a estrela gravada: +1 de reforço');
subir(92); falar('v_kael'); ok(missao() === 'e6', 'Kael: o Véu');
matarEm('c_a7', 10); chefe('arauto');
{ const a = etapa(); ok(a.ev === 'pos' && !j.morto, `falta subir o morro (morto ${j.morto}, arauto vivo ${s.inimigos.some((e) => e.hc === 'arauto' && !e.morto)})`); ir(a.pos[0], a.pos[1]); correr(0.6); ok(etapa().marca && ev.some((e) => e.t === 'cena' && e.id === 'vesper_veu'), `no alto do Morro do Véu (y ${j.y.toFixed(1)}): a Vesper aparece`);
  correr(0.6); ok(etapa().marca && !ev.some((e) => e.t === 'cena' && e.id === 'memoria7'), 'durante a cena da Vesper a etapa seguinte espera');
  correr(j.cenaAte - s.tempo + 0.6); ok(etapa().npc === 'v_kael' && ev.some((e) => e.t === 'cena' && e.id === 'memoria7'), 'memória 7: a verdade'); }
falar('v_kael'); fim('e6');
subir(95); falar('reset'); ok(missao() === 'h15', 'Mestre Ivo: a bênção da Ordem');
s.historia(j, 'pesca', { k: 'garoupa' }); s.historia(j, 'pesca', { k: 'atum' }); dar('garoupa', 1); dar('atum', 1); falar('curandeira');
matarEm('c_a8', 12); falar('reset'); fim('h15'); ok(liberado(p, 'D3') && s.histInfo(j).titulo === 'Luz de Aurora', 'o Pico abriu e o título Luz de Aurora');
// Final
subir(98); falar('lider'); ok(missao() === 'f1' && ev.some((e) => e.t === 'capitulo' && e.fase === 'abre' && e.n === 16), 'Aldo: todos juntos (o final)');
for (const n of ['ferreiro', 'curandeira', 'andarilho', 'comerciante', 'guardiao', 'alquimista']) falar(n);
correr(0.6); ok(etapa().ev === 'totem', 'despediu de todos e o time está junto');
tocar('ultimo_pouso'); falar('v_celeste'); p.mochila.fill(null, 10); falar('lider'); fim('f1');
subir(100); falar('v_rui'); ok(missao() === 'f2', 'Rui: a Gruta da Névoa');
matarEm('cav_nevoa', 6);
{ const C = CHEFES_HISTORIA.sentinela, c = CACA.find((o) => o.id === C.campo); ir(c.x, c.z, c.y); correr(0.6);
  const b = s.inimigos.find((e) => e.hc === 'sentinela' && !e.morto); ok(!!b && b.hcSk, 'o Sentinela de Cristal apareceu com golpes');
  const vm = j.vidaMax; j.vidaMax = j.vida = 1e9; // o teste não quer morrer: só ver os golpes
  for (let k = 0; k < 12; k++) { ir(b.x + 1, b.z, b.y); correr(0.5); } // no túnel o teste segura o herói no chão dele
  ok(ev.some((e) => e.t === 'bossSkill' && e.id === b.id), 'o Sentinela lança golpe com aviso no chão');
  ok(!j.morto, 'o herói segue de pé'); ir(b.x + 1, b.z, b.y); b.atacantes = new Set(['A']); s.ferir(b, 1e9, j); correr(0.1); j.vidaMax = j.vida = vm; }
falar('v_rui'); fim('f2');
falar('v_rui'); ok(missao() === 'f3', 'Rui: Vesper');
{ const C = CHEFES_HISTORIA.vesper, c = CACA.find((o) => o.id === C.campo), vm = j.vidaMax; j.vidaMax = j.vida = 1e9; ir(c.x, c.z, c.y); correr(0.6);
  const b = s.inimigos.find((e) => e.hc === 'vesper' && !e.morto); ok(!!b && b.nome === C.nome, 'a Vesper apareceu no Coração');
  const D = s.adicionarJogador('D', 'Dani'); D.bot = true; Object.assign(D, { x: j.x + 1, z: j.z, y: j.y }); j.time = { lider: 'A', membros: ['A', 'D'] }; D.time = j.time;
  b.vida = Math.round(b.vidaMax * 0.55); ev = []; correr(0.6);
  ok(ev.some((e) => e.t === 'esquecer' && e.para === 'A' && e.ids.includes('D')) && (D.presoAte || 0) > s.tempo, 'fase 2: a Névoa faz o time esquecer (o amigo para)');
  correr(8.5); ok(ev.some((e) => e.t === 'aviso' && /Eu prometi que ia lembrar/.test(e.texto)), 'a Cecília lembra primeiro');
  const esc0 = b.esc; b.vida = Math.round(b.vidaMax * 0.2); correr(0.6); ok(b.esc > esc0 && ev.some((e) => e.t === 'aviso' && /se funde ao Coração/.test(e.texto)), 'fase 3: a Vesper se funde ao Coração e cresce');
  ir(b.x + 1, b.z, b.y); b.atacantes = new Set(['A']); s.ferir(b, 1e9, j); correr(0.1); j.vidaMax = j.vida = vm; }
const coracao = etapa(), vm0 = j.vidaMax; j.vidaMax = j.vida = 1e9; // os Maws e Golens que a Vesper chamou ainda estão na gruta (às vezes derrubavam o herói e o teste falhava)
ir(coracao.pos[0], coracao.pos[1], chaoGruta('cav_nevoa', coracao.pos[0], coracao.pos[1])); correr(0.6); j.vidaMax = j.vida = vm0;
ok(etapa().npc === 'reset' && ev.some((e) => e.t === 'cena' && e.id === 'final'), 'encostou a marca no Coração: a cena final');
p.mochila.fill(null, 10); falar('reset');
ok(ev.some((e) => e.t === 'capitulo' && e.fase === 'fecha' && e.n === 16), 'cartão do fim'); fim('f3');
ok(liberado(p, 'fim') && s.histInfo(j) === null, 'a história acabou: o céu limpa');
ok(contar(p.mochila, 'runa_mitica') === 1 && contar(p.mochila, 'selo_mitico') === 1, 'Runa Mítica e Selo Mítico de presente');

// ---------- o que o robô achou ----------
ok(robo.missoes.size === HISTORIA.length, `robô passou pelas ${robo.missoes.size} de ${HISTORIA.length} missões (${robo.toques} toques em Missão)`);
for (const t of robo.bugs.values()) ok(false, 'robô: ' + t);
ok(robo.bugs.size === 0, `robô: ${robo.bugs.size} problemas no fluxo das missões`);
{ // a janela do NPC: toque em "Missão" a até 4,5 m vale; mais longe avisa; nunca cai em outro NPC do lado
  const s3 = new Simulacao(MAPA_CLAREIRA), j3 = s3.adicionarJogador('R', 'Robô'), N = npc('lider'), R = npc('comerciante');
  const ev3 = () => s3.passo(0.05).filter((e) => e.para === 'R');
  Object.assign(j3, { x: N.x + 4.4, z: N.z, y: s3.terreno.altura(N.x + 4.4, N.z) }); s3.falar('R', { npc: 'lider', missao: true });
  ok(j3.prog.hist.ac && ev3().some((e) => e.t === 'fala' && e.npc === 'lider'), 'a 4,4 m do Aldo (janela aberta pelo Ir) o toque em Missão vale');
  const s4 = new Simulacao(MAPA_CLAREIRA), j4 = s4.adicionarJogador('R', 'Robô');
  Object.assign(j4, { x: R.x + 0.5, z: R.z, y: s4.terreno.altura(R.x + 0.5, R.z) }); s4.falar('R', { npc: 'lider', missao: true });
  const e4 = s4.passo(0.05).filter((e) => e.para === 'R');
  ok(!j4.prog.hist.ac && !e4.some((e) => e.t === 'fala') && e4.some((e) => e.t === 'aviso' && /mais perto de Aldo/.test(e.texto)), 'longe do Aldo e do lado da Rosa: avisa "chegue mais perto", a Rosa não responde no lugar dele');
  // lag: dois toques chegam juntos (a janela ainda não tinha fechado no celular): aceita uma vez e não dá presente duas vezes
  const s5 = new Simulacao(MAPA_CLAREIRA), j5 = s5.adicionarJogador('R', 'Robô'), i5 = HISTORIA.findIndex((M) => M.recebe);
  const M5 = HISTORIA[i5]; Object.assign(j5.prog, { nivel: M5.nv }); j5.prog.hist = { v: 2, p: i5, ac: false, e: 0, n: 0, m: 0, u: HISTORIA[i5 - 1].id };
  const N5 = npc(M5.npc); Object.assign(j5, { x: N5.x + 1.8, z: N5.z, y: s5.terreno.altura(N5.x + 1.8, N5.z) });
  const [k5, n5] = Object.entries(M5.recebe)[0], antes5 = contar(j5.prog.mochila, k5);
  s5.falar('R', { npc: M5.npc, missao: true }); s5.falar('R', { npc: M5.npc, missao: true }); s5.passo(0.05);
  ok(j5.prog.hist.ac && j5.prog.hist.p === i5 && contar(j5.prog.mochila, k5) === antes5 + (typeof n5 === 'number' ? n5 : 1), `${M5.id}: dois toques juntos aceitam uma vez só (${k5} não vem dobrado)`);
}

// ---------- conta antiga ----------
const idx = (id) => HISTORIA.findIndex((M) => M.id === id);
ok(histValida({ p: 1, ac: true, n: 3 }, 5).p === idx('a3') + 1, 'antiga com h1 feita: Campos do Leste continuam abertos');
ok(histValida({ p: 4, ac: false, n: 0 }, 9).p === idx('a11') + 1, 'antiga com h4 feita: Bosque e pesca abertos');
ok(histValida({ p: 7 }, 30).p === idx('h7') + 1, 'antiga com h7 feita');
// contas da Entrega 1 (v2 sem u): a posição vira o id e a lista nova não desloca ninguém
ok(histValida({ v: 2, p: 17, ac: true, e: 0 }, 20).p === idx('h6') + 1, 'v2 com h6 entregue pula o capítulo 6 novo');
ok(histValida({ v: 2, p: 16, ac: true, e: 0 }, 18).p === idx('a16') + 1 && HISTORIA[idx('a16') + 1].id === 'b1', 'v2 fazendo o h6 começa o capítulo 6 novo');
ok(histValida({ v: 2, p: 19, ac: false }, 40).p === idx('h8') + 1, 'v2 com h8 entregue');
{ const h2 = histValida({ v: 2, p: idx('b2') + 1, ac: true, e: 2, n: 1, u: 'b2' }, 16); ok(h2.p === idx('b2') + 1 && h2.ac && h2.e === 2 && h2.u === 'b2', 'conta nova com u fica onde está'); }
ok(histValida({ p: 0, ac: true, n: 2 }, 1).p === 0 && histValida({ p: 0, ac: true, n: 2 }, 1).v === 2, 'antiga sem nada feito');
ok(progressoValido({ nivel: 100, mochila: [] }).hist.p === HISTORIA.length, 'conta sem hist no Nv 100: tudo feito');

function tirarTudo(k) { p.mochila.forEach((o, i) => { if (o?.k === k) p.mochila[i] = null; }); }
{ // "Ir" para a gruta: de fora vai até a boca; lá dentro vai até o ponto
  const s2 = new Simulacao(MAPA_CLAREIRA), j2 = s2.adicionarJogador('G', 'Gil'); const M = HISTORIA.find((o) => o.id === 'c16');
  Object.assign(j2.prog, { nivel: 62 }); j2.prog.hist = { ...j2.prog.hist, p: HISTORIA.indexOf(M), ac: true, e: 3, n: 0, m: 0 };
  const T = TUNEIS_MUNDO.find((C) => C.id === 'cav_ilha');
  Object.assign(j2, { x: 0, z: 0, y: 0 }); const fora = s2.histInfo(j2).alvo;
  ok(fora && /entrada da Gruta da Ilha/.test(fora.nome) && Math.hypot(fora.x - T.def.linha[0][0], fora.z - T.def.linha[0][1]) < 0.1, `de fora, Ir leva à boca da gruta (${fora?.nome})`);
  const pe = M.etapas[3].pos; Object.assign(j2, { x: pe[0], z: pe[1] + 0.5, y: noTunel(T, pe[0], pe[1] + 0.5)?.y ?? 0 });
  const dentro = s2.histInfo(j2).alvo; ok(dentro && Math.hypot(dentro.x - pe[0], dentro.z - pe[1]) < 0.1, 'dentro do túnel, Ir leva ao selo');
}
