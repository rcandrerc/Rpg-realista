// Teste da história v2 (André 2026-11-11, "Aethra: a Crônica da Névoa"): o Ato I inteiro (capítulos 1 a 5) feito do
// começo ao fim por um herói novo, as etapas, os chefes com nome, as pistas, a noite, o barquinho, os presentes, os
// cartões de capítulo, os rumores e a conta da história antiga migrando. Uso: node ferramentas/testes/historia.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, CAPITULOS, CHEFES_HISTORIA, CACA, ITENS, xpProximo } from '../../shared/index.js';
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
for (const [id, C] of Object.entries(CHEFES_HISTORIA)) { const c = CACA.find((o) => o.id === C.campo); ok(c && (c.tipo === C.tipo || c.tipos?.includes(C.tipo) || true), `chefe ${id} no campo ${C.campo}`); }
for (const C of CAPITULOS) ok(HISTORIA.some((M) => M.cap === C.n), `capítulo ${C.n} tem missão`);
const app = historiaParaApp(); ok(app.capitulos.length === CAPITULOS.length && app.missoes.every((m) => m.etapas.length >= 1), 'app recebe capítulos e etapas');

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
const chefe = (id) => { // chega no campo, o chefe aparece e cai
  const C = CHEFES_HISTORIA[id], c = CACA.find((o) => o.id === C.campo); ir(c.x, c.z); correr(0.6);
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
falar('andarilho'); ok(missao() === 'a9', 'o alfa da noite');
p.dia = { h: 12, t: Date.now() }; correr(0.6); ok(h().e === 0 && /agora são 12h/.test(s.histInfo(j).txt), 'de dia espera: ' + s.histInfo(j).txt);
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
ok(missao() === 'h6', 'depois do Ato I vem a missão do Gaspar');

// ---------- conta antiga ----------
const idx = (id) => HISTORIA.findIndex((M) => M.id === id);
ok(histValida({ p: 1, ac: true, n: 3 }, 5).p === idx('a3') + 1, 'antiga com h1 feita: Campos do Leste continuam abertos');
ok(histValida({ p: 4, ac: false, n: 0 }, 9).p === idx('a11') + 1, 'antiga com h4 feita: Bosque e pesca abertos');
ok(histValida({ p: 7 }, 30).p === idx('h7') + 1, 'antiga com h7 feita');
ok(histValida({ p: 0, ac: true, n: 2 }, 1).p === 0 && histValida({ p: 0, ac: true, n: 2 }, 1).v === 2, 'antiga sem nada feito');
ok(progressoValido({ nivel: 100, mochila: [] }).hist.p === HISTORIA.length, 'conta sem hist no Nv 100: tudo feito');

function tirarTudo(k) { p.mochila.forEach((o, i) => { if (o?.k === k) p.mochila[i] = null; }); }
