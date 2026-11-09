// FASE 3, Parte 2 (André 2026-11-08): a grade do mundo (2 continentes, mar central e ilha). O mapa de hoje fica igual
// (altura 0 da grade em tudo que já existe), o mundo fica umas 4 vezes maior e o mar entre as terras dá para o navio.
// Uso: node ferramentas/testes/mundo.mjs
import { MAPA_CLAREIRA as M } from '../../shared/index.js';
import { montarMundo, alturaMundo, terraEm, TERRAS, MUNDO } from '../../shared/mundo.js';
import { VEICULOS } from '../../shared/dados.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const G = montarMundo(M);
let terra = 0; for (const t of G.terra) if (t) terra++;
const area = terra * G.passo * G.passo;
ok(area > 350000 && area < 600000, `terra do mundo: ${Math.round(area / 1000)} mil m² (o mapa de hoje tem uns 100 mil)`);
ok(TERRAS.every((T) => G.terra.includes(TERRAS.indexOf(T) + 1)), 'Vael, a Ilha do Meio e Aurora existem');
const pontos = [[0, 0], ...M.npcs.map((n) => [n.x, n.z]), ...M.caca.map((c) => [c.x, c.z]), ...M.mina.map((c) => [c.x, c.z])];
ok(pontos.every(([x, z]) => Math.abs(alturaMundo(G, x, z)) < 1e-6 && terraEm(G, x, z)?.id === 'vael'), 'o mapa de hoje fica no plano (grade 0) e em Vael');
// do litoral leste de Vael até Aurora passando pela ilha: tem mar fundo para o navio dos dois lados da ilha
const fundo = (a, b) => { let m = 0; for (let x = a; x <= b; x += 2) m = Math.min(m, alturaMundo(G, x, 40)); return m; };
ok(fundo(395, 445) < MUNDO.mar - VEICULOS.navio.fundo, 'mar fundo entre Vael e a ilha: ' + fundo(395, 445).toFixed(1));
ok(fundo(595, 640) < MUNDO.mar - VEICULOS.navio.fundo, 'mar fundo entre a ilha e Aurora: ' + fundo(595, 640).toFixed(1));
ok(terraEm(G, 520, 40)?.id === 'ilha' && terraEm(G, 830, 50)?.id === 'aurora' && terraEm(G, 500, 300) === null, 'terraEm');
// sorteio fixo: duas montagens saem iguais
const G2 = montarMundo(M); ok(G2.h.every((v, i) => v === G.h[i]), 'sorteio fixo');
