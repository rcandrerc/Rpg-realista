// Encomenda pelo chat (André 2026-11-21): "minera ferro pra mim, eu compro" -> o bot vai ao veio mais perto dele, minera
// de verdade, avisa; "vem aqui que vou trocar" -> vem e a encomenda vai pra mesa. Uso: node ferramentas/sinceros/encomenda.mjs
const R = new URL('../../', import.meta.url).href;
const { Simulacao, MAPA_CLAREIRA } = await import(R + 'shared/index.js');
const { encomendaDoTexto } = await import(R + 'shared/amiga.js');
let falhou = 0; const ok = (c, m) => { console.log(c ? 'ok ' : 'ERRO', m); if (!c) falhou++; };
ok(encomendaDoTexto('minera um pouco de ferro pra mim, eu compro')?.rec === 'ferro', 'texto: ferro');
ok(encomendaDoTexto('corta 20 de lenha pra mim')?.n === 20, 'texto: 20 de lenha');
ok(encomendaDoTexto('pesca uns peixes pra mim')?.rec === 'peixe', 'texto: peixe');
ok(!encomendaDoTexto('bora minerar?'), 'texto: convite não é encomenda');
ok(!encomendaDoTexto('bora minerar ferro junto'), 'texto: minerar ferro junto é convite');
ok(encomendaDoTexto('pega umas madeiras')?.rec === 'lenha' && encomendaDoTexto('pega umas madeiras').n === 0, 'texto: pega umas madeiras (sem número: pergunta)');
const s = new Simulacao(MAPA_CLAREIRA); const eu = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
const c = s.amigosIa.find((x) => x.AMIGA.id === 'dario'), a = c.amiga; c.amiga.amigosDe = { 7: 1 };
const falar = (t) => { a.ia.chatFila = []; c.ouvirAmiga('andre', t); c.respostaAmiga('andre', { assunto: c.assuntoAmiga(t) }); return a.ia.chatFila.map((f) => f.texto).join(' | '); };
// de dia (cada um tem o seu horário de sair)
a.prog.dia = { h: 9, t: Date.now() }; for (const p of [eu, ...s.amigosIa.map((x) => x.amiga)]) if (p) p.prog.dia = a.prog.dia;
// sem picareta: diz que não tem
a.prog.mochila = a.prog.mochila.map((o) => (o?.k === 'picareta' ? null : o));
let f = falar('minera 3 de pedra pra mim, eu compro'); ok(/picareta/i.test(f) && !a.ia.encomenda, 'sem picareta: ' + f);
// com picareta, de dia, com vigor
const livre = a.prog.mochila.findIndex((o) => !o); a.prog.mochila[livre] = { k: 'picareta', n: 1 };

const hora = (await import(R + 'shared/progresso.js')).horaDoJogo(a.prog.dia);
f = falar('minera 3 de pedra pra mim, eu compro'); ok(!!a.ia.encomenda && a.ia.av?.encomenda, `aceitou (hora ${hora.toFixed?.(1)}): ` + f);
if (a.ia.encomenda) {
  for (let k = 0; k < 20 * 60 * 600 && !a.ia.encomenda?.pronta; k++) s.passo(0.05);
  const e = a.ia.encomenda; ok(e?.pronta && e.tem >= 3, `minerou de verdade: ${e?.tem} pedra, avisos: ${a.ia.chatFila.map((x) => x.texto).join(' | ')}`);
  f = falar('vem aqui que vou trocar'); ok(!!a.ia.vir, 'vem: ' + f);
  for (let k = 0; k < 20 * 900 && a.ia.vir; k++) s.passo(0.05);
  ok(Math.hypot(a.x - eu.x, a.z - eu.z) < 4, 'chegou perto: ' + a.ia.chatFila.map((x) => x.texto).join(' | '));
  const r = c.abrirTrocaAmiga(eu); ok(r === true && a.troca?.of[a.id].itens.length > 0, 'encomenda na mesa: ' + JSON.stringify(a.troca?.of[a.id].itens));
}
// na pt (André 2026-11-21): "coleta ferro" pergunta quantos, vai sozinho e volta
if (a.troca) s.fecharTroca(a.troca, 'teste');
a.ia.encomenda = null; a.ia.av = null;
c.combinarAmiga(a); c.entrarTimeAmiga(a, eu); s.passo(0.05);
console.log('   pt:', !!(a.time && a.time === eu.time));
f = falar('coleta pedra'); ok(/quantos/i.test(f) && !a.ia.encomenda, 'pergunta quantos: ' + f);
f = falar('2'); ok(!!a.ia.encomenda && a.ia.av?.encomenda, 'com o número, vai: ' + f);
if (a.ia.encomenda && a.time) {
  for (let k = 0; k < 20 * 60 * 600 && !a.ia.encomenda?.pronta; k++) s.passo(0.05);
  ok(a.ia.encomenda?.pronta, 'na pt, coletou: ' + a.ia.chatFila.map((x) => x.texto).join(' | '));
  for (let k = 0; k < 20 * 600 && Math.hypot(a.x - eu.x, a.z - eu.z) > 6; k++) s.passo(0.05);
  ok(Math.hypot(a.x - eu.x, a.z - eu.z) <= 6, 'voltou pra perto dele na pt');
}
if (falhou) { console.log(falhou, 'falha(s)'); process.exit(1); } else console.log('tudo certo');
