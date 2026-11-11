// Teste da história v2 (André 2026-11-11, "Aethra: a Crônica da Névoa"): o Ato I inteiro (capítulos 1 a 5) feito do
// começo ao fim por um herói novo, as etapas, os chefes com nome, as pistas, a noite, o barquinho, os presentes, os
// cartões de capítulo, os rumores e a conta da história antiga migrando. Uso: node ferramentas/testes/historia.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, CAPITULOS, CHEFES_HISTORIA, CACA, ITENS, CENAS, xpProximo } from '../../shared/index.js';
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
const correr = (seg) => { for (let t = 0; t < seg / 0.05; t++) ev.push(...s.passo(0.05)); };
const avisos = () => ev.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto).join(' | ');
const ir = (x, z, y) => Object.assign(j, { x, z, y: y ?? s.terreno.altura(x, z), cliente: null, orcT: null });
const falar = (id) => { const n = npc(id); ir(n.x + 1, n.z); s.falar('A', { npc: id, missao: true }); correr(0.1); };
const missao = () => HISTORIA[h().p]?.id;
const etapa = () => etapasDe(HISTORIA[h().p])[h().e];
const dar = (k, n) => guardar(p.mochila, { k, n });
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
dar('couro', 2); dar('tecido', 1); correr(0.6); ok(h().e === 1, 'juntou couro e tecido (etapa ter)');
ir(npc('comerciante').x + 1, npc('comerciante').z); s.criarUm('A', { r: 'short' }); correr(0.1); ok(h().e === 2, 'costurou o short | ' + avisos());
const iv = p.mochila.findIndex((o) => o?.k === 'lenha'); s.item('A', { acao: 'vender', i: iv }); ok(h().e === 3, 'vendeu algo');
p.ouro += 500; s.item('A', { acao: 'comprar', i: 0, n: 3 }); correr(0.1); ok(h().e === 4, 'comprou 3 poções | ' + avisos());
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
s.historia(j, 'reforcar', { v: 5 }); ok(h().e === 1, '+5 não vale'); s.historia(j, 'reforcar', { v: 6 });
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
ok(missao() === 'h9', 'depois do Ato II vem o capítulo 9');

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
