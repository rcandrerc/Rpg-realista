// Limite de grind e chance do time (André 2026-11-16): "senão esses caras vão pegar nível 150 em meio dia"; "a cada
// nível de diferença... aumentar um pouco a chance de rejeição"; "vou te ajudar porque você é meu amigo, mas... não tão grosseira".
// Uso: node ferramentas/testes/grind-limite.mjs
import { Simulacao, MAPA_CLAREIRA, DARIO, NPC_VIDA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
s.passo(0.05);
const dario = s.amigoIaDe(DARIO.id), b = dario.amiga;
b.prog.dia = { h: 10, t: Date.now() }; // de dia
// chance do time: amizade 4 = 60%, 10 = 100%; cada 5 níveis acima dele tira 5%
const p = (amz, nb, nd) => { d.prog.dia = { h: 10, t: Date.now() }; const L = dario.loteDaAmiga(); if (L) L.horta = {}; b.amizade = amz; b.prog.nivel = nb; d.prog.nivel = nd; b.vida = b.vidaMax; return Math.round(dario.vontadeAmiga(b, d).p * 100); };
ok(p(0, 10, 10) === 60 && p(4, 10, 10) === 60, `amizade 0 e 4: 60% (${p(4, 10, 10)}%)`);
ok(p(7, 10, 10) === 80 && p(10, 10, 10) === 100, `amizade 7: 80%, amizade 10: 100% (${p(10, 10, 10)}%)`);
ok(p(10, 15, 10) === 95 && p(10, 20, 10) === 90 && p(10, 25, 10) === 85 && p(10, 24, 10) === 90, `5/10/15 níveis acima: 95/90/85% (${p(10, 25, 10)}%)`);
ok(p(10, 10, 30) === 100, 'ele mais forte que o NPC: não tira nada');
// entrou no time com ele bem mais fraco: comenta de leve
b.amizade = 10; b.prog.nivel = 20; d.prog.nivel = 8; b.amigosDe = { [d.conta]: 1 };
Object.assign(d, { x: b.x + 1, z: b.z });
const f0 = (b.ia.chatFila || []).length, rr = Math.random; Math.random = () => 0;
s.time('andre', { acao: 'convidar', com: b.id }); Math.random = rr;
const fala = (b.ia.chatFila || []).slice(f0).map((x) => x.texto).join(' ');
ok(b.time && b.time === d.time && /12 níveis/.test(fala), `aceitou o time e comentou: "${fala}"`);
s.sairDoTime(b, 'teste'); b.ia.noTime = false;
// grind sozinho: no máximo NPC_VIDA.grind.segPorDia por dia real
ok(NPC_VIDA.grind.segPorDia === 7200, 'limite: 2 h de caça sozinho por dia');
ok(dario.podeSairAmiga(b, d).ok, 'antes do limite: pode sair caçar');
dario.grindHojeAmiga(b); b.grind.seg = 7200;
ok(!dario.podeSairAmiga(b, d).ok && /amanhã/.test(dario.podeSairAmiga(b, d).fala), 'no limite: não sai caçar sozinho');
b.ia.av = { fase: 'escolher' }; b.ia.fase = 'pensar';
for (let i = 0; i < 40; i++) s.passo(0.05);
ok(!b.ia.av || !['ir', 'cacar'].includes(b.ia.av.fase) || b.ia.av.coleta, `no limite: não vai caçar (fase ${b.ia.av?.fase})`);
b.grind = { dia: '2000-01-01', seg: 99999 };
ok(dario.grindHojeAmiga(b) === 0, 'dia novo: o limite zera');
// conta só caçando sozinho
b.grind.seg = 0; const c = s.cacas[0].def; b.ia.av = { fase: 'cacar', c, ate: s.tempo + 999 }; Object.assign(b, { x: c.x, z: c.z });
for (let i = 0; i < 200; i++) s.passo(0.05);
ok(b.grind.seg > 2 && b.grind.seg <= 10.01, `caçando sozinho conta (${b.grind.seg.toFixed(1)} s em 10 s)`);
// sem teto: Cecília e Dario passam do jogador mais alto
s.nivelTetoNpc = 5; b.prog.nivel = 5; b.prog.xp = 0; s.ganharXP(b, 999999);
ok(b.prog.nivel > 5, `Dario passa do teto do jogador mais alto (nível ${b.prog.nivel})`);
