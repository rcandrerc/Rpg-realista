// Jogo leve: coleta de ponta a ponta (André 2026-11-26: "farmar um mineral, coletar madeira... já vai ser de uma ajuda
// extremamente foda"). Ir para > Recursos leva ao veio mais perto com carga; Minerar de longe anda até a borda e começa
// sozinho; as batidas dão minério; com a mochila cheia para e avisa. O mesmo 'coletar' do jogo.
// Uso: node ferramentas/testes/leve-coleta.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.nivel = 20; a.leve = true; s.inimigos.length = 0;
const avisos = []; { const o = s.evento.bind(s); s.evento = (e) => { if (e.para === 'A' && e.t === 'aviso') avisos.push(e.texto); return o(e); }; }
a.prog.mochila[0] = { k: 'picareta', n: 1 }; a.prog.mochila[1] = { k: 'machado', n: 1 };
const contar = (k) => a.prog.mochila.reduce((t, o) => t + (o?.k === k ? o.n || 1 : 0), 0);
const andar = (seg, ate) => { for (let i = 0; i < seg * 20 && !ate(); i++) s.passo(1 / 20); };
// 1) Ir para > Recursos: veio de pedra mais perto com carga
const no = [...s.coletaveis.values()].filter((o) => o.tipo === 'pedra' && o.y == null).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
ok(!!no, `tem veio de pedra (${Math.round(Math.hypot(no.x - a.x, no.z - a.z))} m)`);
s.leveIrRecurso('A', { t: 'pedra' });
ok(!!a.leveRota, 'Ir para > Recursos: anda até o veio');
// 2) Minerar de longe: chega na borda e começa sozinho
s.leveColetar('A', { no: no.id });
andar(240, () => a.coleta);
ok(a.coleta?.no === no.id, `chegou e começou a minerar (${avisos.slice(-2).join(' | ')})`);
ok(s.fotoLeve(a).co?.[0] === no.id, 'a foto mostra "Minerando"');
// 3) batidas dão pedra
const antes = contar('pedra');
andar(60, () => contar('pedra') > antes + 2);
ok(contar('pedra') > antes, `pegou pedra (${contar('pedra') - antes})`);
// 4) Parar
s.leveColetar('A', { no: no.id, parar: true });
ok(!a.coleta, 'Parar para a coleta');
// 5) mochila cheia: para e avisa
for (let i = 2; i < a.prog.mochila.length; i++) a.prog.mochila[i] = { k: 'tomate', n: 1 };
const outro = [...s.coletaveis.values()].find((o) => o.tipo === 'pedra' && o.y == null && Math.hypot(o.x - a.x, o.z - a.z) < 8 && s.cargas(a, o) > 0) || no;
avisos.length = 0; s.leveColetar('A', { no: outro.id }); andar(30, () => !a.coleta && avisos.length);
ok(!a.coleta && avisos.some((t) => /cheia/i.test(t)), `mochila cheia avisa (${avisos.join(' | ')})`);
// 6) madeira: árvore mais perto
for (let i = 2; i < a.prog.mochila.length; i++) a.prog.mochila[i] = null;
const arv = [...s.coletaveis.values()].filter((o) => o.tipo === 'arvore' && o.y == null && s.cargas(a, o) > 0).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
ok(!!arv, 'tem árvore');
avisos.length = 0; a.leveIrT = -9; s.tempo += 5; s.leveColetar('A', { no: arv.id });
andar(240, () => a.coleta);
const l0 = contar('lenha'); andar(60, () => contar('lenha') > l0);
ok(contar('lenha') > l0, `cortou lenha (${contar('lenha') - l0}) ${avisos.slice(-2).join(' | ')}`);
