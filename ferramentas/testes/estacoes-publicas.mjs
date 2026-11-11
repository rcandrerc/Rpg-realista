// Estações públicas da vila (André 2026-11-11: "não criar no próprio NPC"): o Tomás e a Rosa não criam mais pelo
// jogador; ele cria na bigorna e no forninho da ferraria e na bancada ao lado da Rosa. Uso: node ferramentas/testes/estacoes-publicas.mjs
import { Simulacao, MAPA_CLAREIRA, ESTACOES_PUBLICAS, HISTORIA, contar, progressoValido } from '../../shared/index.js';
import { avancarForno } from '../../shared/simulacao.js';
import './_tudo-aberto.mjs';
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.prog.ouro = 5000;
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (e) => e.filter((x) => x.t === 'aviso').map((x) => x.texto).join(' | ');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const E = (id) => ESTACOES_PUBLICAS.find((o) => o.id === id);
const npc = (id) => MAPA_CLAREIRA.npcs.find((n) => n.id === id);
const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);

ok(['pub_bigorna', 'pub_fornalha', 'pub_bancada'].every(E), 'bigorna, forninho e bancada públicos existem');
ok(dist(E('pub_bigorna'), npc('ferreiro')) < 4 && dist(E('pub_fornalha'), npc('ferreiro')) < 4, 'bigorna e forninho ao lado do Tomás');
ok(dist(E('pub_bancada'), npc('comerciante')) < 3, 'bancada ao lado da Rosa');
ok(MAPA_CLAREIRA.obstaculos.some((o) => dist(o, E('pub_fornalha')) < 0.01) && MAPA_CLAREIRA.obstaculos.some((o) => dist(o, E('pub_bancada')) < 1), 'forninho e bancada são sólidos');
// nenhuma estação nova em cima de casa, pedra ou outro obstáculo
for (const id of ['pub_fornalha', 'pub_bancada']) {
  const P = E(id), r = id === 'pub_fornalha' ? 0.7 : 1;
  const bate = s.obstaculos.filter((o) => dist(o, P) > 0.6 && dist(o, P) < o.r + r - 0.05);
  ok(bate.length === 0, `${id} não encosta em outro sólido ${JSON.stringify(bate)}`);
}

// o NPC não cria mais: só a estação. Do lado do NPC, mas longe da estação, não dá
a.prog.mochila[0] = { k: 'couro', n: 10 }; a.prog.mochila[1] = { k: 'tecido', n: 10 };
const R = npc('comerciante'); a.x = R.x + 3.5; a.z = R.z - 2.2; // perto da Rosa (< 4,5 m), a mais de 3,6 m da bancada
ok(dist(a, R) < 4.5 && dist(a, E('pub_bancada')) > 3.6, 'herói do lado da Rosa e longe da bancada');
s.criarUm('A', { r: 'short' }); let e = ev();
ok(contar(a.prog.mochila, 'short') === 0 && avisos(e).includes('bancada ao lado da Rosa'), 'a Rosa não costura por você ' + avisos(e));
a.x = E('pub_bancada').x + 1.4; a.z = E('pub_bancada').z;
const alf = a.prog.prof.alf || 0;
s.criarUm('A', { r: 'short' }); e = ev();
ok(contar(a.prog.mochila, 'short') === 1 && (a.prog.prof.alf || 0) > alf, 'na bancada da Rosa você costura e ganha Alfaiate ' + avisos(e));
const criou = e.find((x) => x.t === 'criou');
ok(criou && Math.abs(criou.x - E('pub_bancada').x) < 0.01, 'a linha sai da bancada (não do NPC)');

// bigorna da ferraria: forja na hora (aba Criar)
a.x = E('pub_bigorna').x - 1.2; a.z = E('pub_bigorna').z;
a.prog.mochila[2] = { k: 'barra_ferro', n: 10 }; a.prog.mochila[3] = { k: 'barra_cobre', n: 10 }; a.prog.mochila[4] = { k: 'lenha', n: 20 }; a.prog.mochila[5] = { k: 'minerio_cobre', n: 12 };
s.criarUm('A', { r: 'espada' }); e = ev();
ok(e.some((x) => x.t === 'criou'), 'forja na bigorna da ferraria ' + avisos(e));

// forninho público: põe minério e lenha, tira as barras; cada jogador tem a sua carga
const f = E('pub_fornalha');
a.x = f.x - 1.4; a.z = f.z + 0.5;
s.forno('A', { acao: 'abrir', p: f.id }); e = ev();
ok(e.some((x) => x.t === 'forno' && x.p === f.id && x.abrir), 'abre o forninho da ferraria ' + avisos(e));
const iMin = a.prog.mochila.findIndex((o) => o?.k === 'minerio_cobre'), iLen = a.prog.mochila.findIndex((o) => o?.k === 'lenha');
s.forno('A', { acao: 'por', p: f.id, lugar: 'ent', i: iMin }); s.forno('A', { acao: 'por', p: f.id, lugar: 'comb', i: iLen }); e = ev();
const F = a.prog.fornosPub[f.id];
ok(F.ent?.k === 'minerio_cobre' && F.comb?.k === 'lenha', 'minério e lenha dentro ' + avisos(e));
avancarForno(F, F.t + 25000);
ok(F.sai?.k === 'barra_cobre' && F.sai.n === 2, 'fundiu 2 barras sozinho');
const b = s.adicionarJogador('B', 'Bia', undefined, { conta: 2 }); b.criando = false; b.x = a.x; b.z = a.z;
s.forno('B', { acao: 'abrir', p: f.id }); e = ev();
ok(e.some((x) => x.t === 'forno' && x.para === 'B' && !x.sai && !x.ent), 'a Bia vê o forninho dela vazio');
// a carga fica salva na conta
const salvo = progressoValido(JSON.parse(JSON.stringify(a.prog)));
ok(salvo.fornosPub?.[f.id]?.sai?.n === 2, 'a carga do forninho fica salva na conta');
// história: a missão do Tomás conta as barras tiradas do forninho
const i4 = HISTORIA.findIndex((M) => M.id === 'a4');
a.prog.hist = { v: 2, p: i4, ac: true, e: 1, n: 0, m: 0, u: HISTORIA[i4 - 1].id };
F.t = Date.now();
const fer = a.prog.prof.fer || 0;
s.forno('A', { acao: 'tirar', p: f.id, lugar: 'sai' }); e = ev();
ok(contar(a.prog.mochila, 'barra_cobre') === 12 && (a.prog.prof.fer || 0) > fer, 'tirou 2 barras e ganhou Ferreiro ' + avisos(e));
ok(a.prog.hist.e === 2, 'a etapa "Funda 2 barras" da missão do Tomás andou');
// o "Ir" da etapa leva até a estação, não até o NPC
a.prog.hist.e = 1;
const alvo = s.alvoHistoria(a);
ok(alvo && Math.abs(alvo.x - f.x) < 0.01 && alvo.npc === '', 'o Ir da missão leva ao forninho ' + JSON.stringify(alvo));
// longe não mexe
a.x = 0; a.z = 20;
s.forno('A', { acao: 'abrir', p: f.id }); ok(avisos(ev()).includes('Chegue perto'), 'de longe não abre');
// nenhuma etapa de criar ou evoluir manda para o NPC
const ruins = HISTORIA.flatMap((M) => (M.etapas || []).filter((x) => (x.ev === 'criar' || x.ev === 'evoluir') && String(x.alvo || '').startsWith('npc:')).map((x) => `${M.id}: ${x.txt}`));
ok(ruins.length === 0, 'nenhuma missão manda o NPC criar ' + ruins.join(' | '));
