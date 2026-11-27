// Campos da Geada Nv 1 a 30 em volta do Juncal (André 2026-11-27): 12 campos com a mesma escada da Chama, em chão que
// já existe (nada de árvore, estrada, trilha, rio, veio nem totem dentro, 50 m+ um do outro); bot da Geada de nível
// baixo caça neles, bot da Chama nunca vai lá. Sem rede. Uso: node ferramentas/testes/campos-geada.mjs
import { Simulacao, MAPA_CLAREIRA, RIVAIS, AMIGOS_VIRTUAIS } from '../../shared/index.js';
import { CACA, TOTENS, RACAS } from '../../shared/dados.js';
import { gradeDoMundo } from '../../shared/relevo.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const G = CACA.filter((c) => c.raca === 'geada'), J = RACAS.geada.casa;
ok(G.length === 12, `12 campos da Geada (${G.length})`);
ok(JSON.stringify(G.map((c) => c.nivel).sort((a, b) => a - b)) === JSON.stringify([1, 3, 5, 5, 10, 10, 15, 15, 20, 25, 28, 30]), 'mesma escada de níveis da Chama (1 a 30)');
ok(G.every((c) => c.x > 270 && Math.hypot(c.x - J.x, c.z - J.z) < 300), 'todos no território da Geada, perto do Juncal');
ok(G.every((c) => CACA.every((o) => o === c || Math.hypot(o.x - c.x, o.z - c.z) >= 50)), 'cada um a 50 m ou mais de qualquer outro campo');
const Gr = gradeDoMundo(), est = (x, z) => Gr.estrada[Math.round((z - Gr.z0) / Gr.passo) * Gr.nx + Math.round((x - Gr.x0) / Gr.passo)] || 0;
const livre = (c) => { for (let a = 0; a < 24; a++) for (const r of [0, 4, 8, 12, 14]) if (est(c.x + Math.cos(a / 24 * 6.283) * r, c.z + Math.sin(a / 24 * 6.283) * r)) return false; return true; };
ok(G.every(livre), 'nenhuma estrada ou trilha passa dentro');
ok(G.every((c) => MAPA_CLAREIRA.mata.every((t) => Math.hypot(t.x - c.x, t.z - c.z) > c.r + 1)), 'nenhuma árvore dentro');
ok(G.every((c) => TOTENS.lista.every((t) => Math.hypot(t.x - c.x, t.z - c.z) > 40) && (MAPA_CLAREIRA.veios || []).every((v) => Math.hypot(v.x - c.x, v.z - c.z) > c.r + 5)), 'longe de totem e de veio');
// bots: Geada Nv 6 escolhe campo da Geada; Chama Nv 6 nunca
const s = new Simulacao(MAPA_CLAREIRA); s.adicionarJogador('p', 'P', 'ruiva', { conta: 9 });
for (const x of s.amigosIa) x.amigaEntrar('p', false);
const geada = s.amigosIa.find((x) => RIVAIS.some((d) => d.id === x.AMIGA.id) && x.amiga);
const chama = s.amigosIa.find((x) => AMIGOS_VIRTUAIS.some((d) => d.id === x.AMIGA.id) && x.amiga && (x.AMIGA.raca || 'chama') === 'chama');
for (const g of [geada, chama]) { g.amiga.prog.nivel = 6; g.amiga.ia.licoes = null; }
geada.amiga.x = J.x; geada.amiga.z = J.z;
const escolhas = (g) => { const v = new Set(); for (let i = 0; i < 60; i++) { const c = g.campoAmiga(g.amiga); if (c) v.add(c); } return [...v]; };
const eg = escolhas(geada), ec = escolhas(chama);
ok(eg.length && eg.every((c) => c.raca === 'geada'), `Geada Nv 6 caça perto do Juncal (${eg.map((c) => c.id).join(', ')})`);
ok(ec.length && ec.every((c) => !c.raca), `Chama Nv 6 não vai aos campos da Geada (${ec.map((c) => c.id).join(', ')})`);
const cd = s.campoDoDrop(geada.amiga, 'couro');
ok(!cd || cd.raca === 'geada' || cd.nivel > 30, `material da ordem: Geada vai ao campo da Geada (${cd?.id})`);
