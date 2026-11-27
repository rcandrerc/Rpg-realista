// Jogo leve: os golpes são as skills do jogo (André 2026-11-27: "uso o meteoro e os bichos continuam lá... no jogo normal
// evaporo"). habLeve manda as barras da espada e do cajado (HABS do Quimera) e leveHab usa a mesma msg habQ do jogo.
// Uso: node ferramentas/testes/leve-skills.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.nivel = 63; a.leve = true; s.aplicarStatus(a, true);
const vivos = s.inimigos.filter((o) => !o.morto).slice(0, 3); s.inimigos.length = 0; s.inimigos.push(...vivos);
for (const e of vivos) { e.ia = null; e.velocidade = 0; }
for (let i = 0; i < 5; i++) s.passo(1 / 20);
vivos.forEach((e, k) => { e.x = a.x + 5 + k * 0.6; e.z = a.z + k * 0.5; });
const hb = s.habLeve(a);
ok(hb.bs?.[0] === 'espada_basico', 'básico da espada');
ok(hb.e.some((o) => o[0] === 'giro') && hb.c.some((o) => o[0] === 'meteoro'), `as duas barras do jogo (${hb.e.length} + ${hb.c.length})`);
s.leveHab('A', 'meteoro'); for (let t = 0; t < 80; t++) s.passo(1 / 20);
ok(vivos.every((e) => e.morto), 'o Meteoro do herói Nv 63 mata os bichos Nv 1 da área, como no jogo');
ok(a.modo === 'Magia' && s.habLeve(a).bs[0] === 'cajado_basico', 'usar magia troca o básico para o do cajado');
