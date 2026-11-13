// Árvore cortada é de todos: cai (evento "veio" com cargas 0 e dir), ninguém mais corta até voltar, e volta no tempo.
// Uso: node ferramentas/testes/arvore-cai.mjs
import { Simulacao, MAPA_CLAREIRA, COLETA } from '../../shared/index.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana'), b = s.adicionarJogador('B', 'Beto');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const no = s.coletaveis.get('m5');
// os monstros da clareira ficam longe: às vezes um matava o B no meio do teste e ele não cortava por estar morto (2026-11-13)
for (const e of s.inimigos) { e.x += 1e5; e.z += 1e5; }
for (const j of [a, b]) { j.ciente = true; j.prog.vigor = { v: 999, t: Date.now() }; j.prog.mochila[j.prog.mochila.indexOf(null)] = { k: 'machado', n: 1 }; } // cortar pede o machado (André 2026-11-07)
const perto = (j, dx) => { j.x = no.x + dx; j.z = no.z; s.passo(0.05); j.x = no.x + dx; j.z = no.z; };
perto(a, -(no.r + 1)); perto(b, no.r + 1);
s.eventos = [];
s.coletar('A', { no: 'm5' });
ok(a.coleta, 'A começou a cortar');
let veios = [];
for (let t = 0; t < 200 && veios.filter((e) => e.cargas === 0).length === 0; t++) veios.push(...s.passo(0.05).filter((e) => e.t === 'veio'));
const caiu = veios.find((e) => e.cargas === 0);
ok(caiu && caiu.no === 'm5' && typeof caiu.dir === 'number', 'caiu para todos: ' + JSON.stringify(caiu));
ok(Math.abs(caiu.dir - Math.atan2(no.x - a.x, no.z - a.z)) < 0.05, 'tomba para longe de quem cortou');
ok(s.cargas(b, no) === 0, 'B também vê a árvore no chão');
s.eventos = []; Object.assign(b, { x: no.x + no.r + 1, z: no.z, trava: 0, esc: null, chao: true, arrancada: null }); s.coletar('B', { no: 'm5' });
ok(!b.coleta && s.eventos.some((e) => e.t === 'aviso' && /esgotada, volta em/.test(e.texto)), 'B não corta a árvore caída');
ok(s.foto().veios.some((v) => v[0] === 'm5' && v[1] === 0), 'quem entra depois recebe na foto');
for (let t = 0; t < (COLETA.arvore.volta + 1) / 0.05; t++) s.passo(0.05);
ok(s.cargas(b, no) === COLETA.arvore.cargas, 'voltou depois de ' + COLETA.arvore.volta + ' s');
ok(!s.foto().veios.some((v) => v[0] === 'm5'), 'saiu da foto');
// veio de cobre continua de todos
ok(s.comum(s.coletaveis.get('v0')), 'veio de cobre continua de todos');
