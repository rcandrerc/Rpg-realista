// Amizade com a Cecília e o Dario (André 2026-11-14: "deveria subir interagindo de qq forma e com presentes tb"):
// conversa, caça junto no time, coleta junto e chefe sobem a amizade (até AMIGA.amizade.porDia por dia); presente e
// pedido entregue continuam +1, fora do limite. Teto AMIGA.amizade.max. Os bônus chegam no máximo no teto.
// Uso: node ferramentas/testes/amizade.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const Z = AMIGA.amizade;
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
d.conta ??= 'c1';
for (const x of s.amigosIa) x.amigaEntrar('andre');
const c = s.amiga, dario = s.amigoIaDe(DARIO.id), b = dario.amiga;
const zera = () => { c.amizade = 0; c.amizadeDia = {}; b.amizade = 0; b.amizadeDia = {}; };
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'andre' && /amizade \+/.test(e.texto));

// conversa: 4 falas dele e a conversa termina (pausa) -> +1
zera(); s.eventos = [];
for (let i = 0; i < Z.conversa; i++) s.ouvirAmiga('andre', 'oi tudo bem? ' + i);
s.tempo += AMIGA.memoria.pausa + 1; s.diarioAmiga();
ok(s.amizadeAmiga(d) === 1, 'conversa de verdade: amizade +1');
ok(avisos().some((e) => e.texto === 'Cecília: amizade +1'), 'aviso curto: "' + avisos()[0]?.texto + '"');
for (let i = 0; i < 2; i++) s.ouvirAmiga('andre', 'ok ' + i);
s.tempo += AMIGA.memoria.pausa + 1; s.diarioAmiga();
ok(s.amizadeAmiga(d) === 1, 'conversa curta (2 falas) não conta');

// caça junto no time: a cada 20 monstros +1; chefe +2; fora do time não conta
zera();
const time = { membros: ['andre', c.id] }; d.time = time; c.time = time;
const juntos = new Set([d, c]);
for (let i = 0; i < Z.caca - 1; i++) s.cacaJuntosAmiga(juntos, { tipo: 'lobo' });
ok(s.amizadeAmiga(d) === 0, '19 monstros ainda não');
s.cacaJuntosAmiga(juntos, { tipo: 'lobo' });
ok(s.amizadeAmiga(d) === 1, '20 monstros juntos: +1');
s.cacaJuntosAmiga(juntos, { tipo: 'lobo', bm: 'x' });
ok(s.amizadeAmiga(d) === 1 + Z.chefe, 'chefe junto: +2');
ok(dario.amizadeAmiga(d) === 0, 'o Dario não estava junto: a dele não muda');
c.time = null; for (let i = 0; i < Z.caca; i++) s.cacaJuntosAmiga(juntos, { tipo: 'lobo' });
ok(s.amizadeAmiga(d) === 1 + Z.chefe, 'ela fora do time: não conta');
c.time = time;

// limite do dia: no máximo porDia por conversa/caça/coleta
for (let k = 0; k < 10; k++) s.cacaJuntosAmiga(juntos, { tipo: 'lobo', bm: 'x' });
ok(s.amizadeAmiga(d) === Z.porDia, `limite do dia: parou em ${s.amizadeAmiga(d)}`);
// presente fura o limite
ok(s.ganharAmizadeAmiga(d, 1, false) === 1 && s.amizadeAmiga(d) === Z.porDia + 1, 'presente sobe mesmo depois do limite do dia');
// dia novo: volta a subir
c.amizadeDia[d.conta][0] = '2000-01-01';
s.cacaJuntosAmiga(juntos, { tipo: 'lobo', bm: 'x' });
ok(s.amizadeAmiga(d) === Z.porDia + 1 + Z.chefe, 'outro dia: sobe de novo');

// teto
c.amizade = Z.max - 1; s.ganharAmizadeAmiga(d, 5, false);
ok(s.amizadeAmiga(d) === Z.max, `teto ${Z.max}`);
c.amizade = 14; ok(s.ganharAmizadeAmiga(d, 1, false) === 0 && c.amizade === 14, 'quem já passou do teto não perde nada');

// coleta junto: uma rodada (coleta.dividir itens) +1
zera(); c.ia.coletaBase = {}; c.ia.coletaResto = {};
const k = AMIGA.plantas[0];
s.contagemColetaAmiga = () => ({ [k]: AMIGA.coleta.dividir });
s.dividirColetaAmiga(c);
delete s.contagemColetaAmiga;
ok(s.amizadeAmiga(d) === 1, 'rodada de coleta junto: +1');

// bônus espalhados até o teto
ok(Math.abs(AMIGA.time.porAmizade * Z.max - AMIGA.time.amizadeMax) < 1e-9, 'vontade de time: máximo no 10');
ok(Math.abs(AMIGA.coleta.presente + AMIGA.coleta.porAmizade * Z.max - AMIGA.coleta.presenteMax) < 1e-9, 'coleta: 50% no 10');
ok(Math.abs(AMIGA.troca.margem - AMIGA.troca.porAmizade * Z.max - AMIGA.troca.margemMin) < 1e-9, 'preço de amiga: mínimo no 10');

// salva junto com o terreno
s.guardarAmiga(); const L = s.loteDaAmiga();
ok(L?.amiga?.amizadeDia?.[d.conta]?.[1] === 1, 'o limite do dia vai salvo (reiniciar o servidor não zera)');
