// Os botões de lugar do jogo no leve (construcao.gd _botoes_estacao, caverna.gd selo, jantar.gd; André 2026-11-27:
// "Quero tudo idêntico"): perto da bancada/bigorna = Criar; do forninho = janela do forno (pôr, tirar, com nomes);
// regador vazio na beira = Encher; perto do selo = usar o passe; o jantar passa pelo servidor com o sub.
// Uso: node ferramentas/testes/leve-lugares.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { TUNEL, CAVERNA } from '../../shared/caverna.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 }); a.criando = false; a.ciente = true; a.leve = true; a.prog.nivel = 30;
for (let i = 0; i < 3; i++) s.passo(1 / 20);
const E = (k) => MAPA_CLAREIRA.estacoes.find((o) => o.k === k);
const ir = (o, dx = 1) => { a.x = o.x + dx; a.z = o.z; };
ir(E('bancada')); ok(s.fotoLeve(a).ex?.e?.[0] === 'bancada', `bancada da Rosa: Criar (${JSON.stringify(s.fotoLeve(a).ex)})`);
ir(E('bigorna'), 0.5); ok(s.fotoLeve(a).ex?.e?.[0] === 'bigorna', `bigorna da ferraria: Criar (${JSON.stringify(s.fotoLeve(a).ex)})`);
ir(E('fornalha'), 0.5); const ex = s.fotoLeve(a).ex; ok(ex?.f?.[0] === 'pub_fornalha', `forninho da ferraria: janela do forno (${JSON.stringify(ex)})`);
const ev = []; const e0 = s.evento.bind(s); s.evento = (e) => { ev.push(e); return e0(e); };
a.prog.mochila[0] = { k: 'lenha', n: 6 }; a.prog.mochila[1] = { k: 'minerio_cobre', n: 3 };
s.forno('A', { acao: 'abrir', p: 'pub_fornalha' });
let f = s.leveEvento(ev.filter((e) => e.t === 'forno').at(-1));
ok(f?.abrir && f.it.some((o) => o[1] === 'lenha' && o[4].includes('comb')) && f.it.some((o) => o[1] === 'minerio_cobre' && o[4].includes('ent')), `forno abre com o que pode ir (${JSON.stringify(f?.it)})`);
s.forno('A', { acao: 'por', p: 'pub_fornalha', lugar: 'comb', i: 0 }); s.forno('A', { acao: 'por', p: 'pub_fornalha', lugar: 'ent', i: 1 });
f = s.leveEvento(ev.filter((e) => e.t === 'forno').at(-1));
ok(f.comb?.[2] && f.ent?.[2] === 'Minério de cobre' || f.ent?.[0] === 'minerio_cobre', `pôs lenha e minério, com nome (${JSON.stringify([f.comb, f.ent, f.faz])})`);
// regador
a.prog.mochila[2] = { k: 'regador', n: 1 }; a.prog.agua = 0;
const P = MAPA_CLAREIRA.npcs.find((n) => n.id === 'comerciante'); // praça: o poço fica no meio
const { HORTA } = await import('../../shared/dados.js'); a.x = HORTA.poco.x + 0.5; a.z = HORTA.poco.z + 0.5;
ok(s.fotoLeve(a).ex?.en === 1, 'regador vazio no poço: Encher');
s.encherRegador('A'); ok(!s.fotoLeve(a).ex?.en, 'cheio: o botão some');
// selo da caverna
const A = TUNEL.amostras, alvo = A.find((o) => o.s >= CAVERNA.porta - 2);
a.x = alvo.x; a.z = alvo.z; ok(s.fotoLeve(a).ex?.sl === 1, `perto do selo: usar o passe (s ${alvo.s})`);
// jantar: o servidor deixa passar o sub (antes se perdia no filtro da mensagem 'cla')
const src = (await import('node:fs')).readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8');
ok(/acao === 'jantar' \? \{ sub:/.test(src), 'servidor: a mensagem cla do jantar leva sub/ids/i/n/s');
ok(src.includes("'forno', 'jantarInfo'"), 'servidor: forno e jantarInfo vão para o leve');
void P;
// a barra da missão da vez (missao_ativa.gd): texto e o Ir até onde se faz
const b = s.adicionarJogador('B', 'Bia', undefined, { conta: 2 }); b.criando = false; b.leve = true; s.passo(1 / 20);
const mv = s.fotoLeve(b).mv;
ok(mv && /^Cap\. 1/.test(mv[0]) && mv[1] && Number.isFinite(mv[3]), `missão da vez com o Ir (${JSON.stringify(mv)})`);
