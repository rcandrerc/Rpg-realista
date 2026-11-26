// Entregar no Baú (André 2026-11-26): "Recursos com os recrutas" só mostra o que vai para o Baú do Clã (o item da ordem);
// o botão (um recruta ou todos) faz ele largar o que faz e levar agora. A pedra que veio junto fica com ele.
// Uso: node ferramentas/testes/recruta-entregar.mjs
import { Simulacao, MAPA_CLAREIRA, contar, CLA } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
let fake = Date.now(); Date.now = () => fake;
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 'c5' });
a.criando = false; a.ciente = true; a.x = -24; a.z = 59; a.prog.ouro = 990000; a.prog.nivel = 60;
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 });
const L = s.loteDe(a); a.prog.mochila.fill(null); a.prog.mochila[0] = { k: 'obra_bau_cla', n: 1 };
s.cla('A', { acao: 'fundar', nome: 'Brasa' });
s.construir('A', { k: 'bau_cla', x: -21.5, z: 61, r: 0 });
const cla = a.prog.cla; cla.nv = 3; cla.sem = Date.now() + 9e9;
const m = sortearRecruta(Math.random, CLA.tiers[0], 60, Date.now()); m.nv = 60; m.fn = { k: 'recurso', r: 'ferro' }; cla.m.push(m);
s.removerJogador('A'); if (!s.loteDaConta('c5')) { s.lotes.set(L.def.id, L); L.dono = 'c5'; }
s.paineis.set('PN', 'c5');
s.entrarRecrutasSemLider([{ conta: 'c5', cla, raca: 'chama' }], 'PN');
const x = s.recrutasNoMundo({ conta: 'c5' })[0], b = x.amiga;
b.prog.prof = { ...b.prog.prof, min: 5000 }; b.prog.vigor = { v: 160, m: 160, t: Date.now() };
b.prog.mochila[4] = { k: 'picareta', n: 1 };
s.painelFuncao('c5', cla, 'chama', m.id, { k: 'recurso', r: 'ferro' });
const rodar = (seg) => { for (let i = 0; i < seg * 4; i++) { s.passo(0.25); fake += 250; } };
rodar(60);
b.prog.mochila[10] = { k: 'minerio_ferro', n: 7 }; b.prog.mochila[11] = { k: 'pedra', n: 9 }; // carrega ferro (da ordem) e pedra (dele)
const pi = s.painelInfo('c5', cla, 'chama');
ok(pi.com?.some((o) => o.k === 'minerio_ferro') && !pi.com.some((o) => o.k === 'pedra'), `painel: só o que vai ao Baú (${JSON.stringify(pi.com)})`);
ok(pi.m[0].lv >= 7, `botão do recruta com a quantidade (${pi.m[0].lv})`);
const antes = contar(L.bauCla || [], 'minerio_ferro');
const r = s.painelEntregar('c5', cla, 'chama', '*');
ok(/vai entregar/.test(r), `Entregar tudo: ${r}`);
rodar(240);
const depois = contar(L.bauCla || [], 'minerio_ferro');
ok(depois - antes >= 7, `ferro no Baú do Clã: ${antes} -> ${depois}`);
ok(contar(L.bauCla || [], 'pedra') === 0, 'a pedra ficou com ele');
ok(s.painelEntregar('c5', cla, 'chama', 'xx') === 'Esse recruta não está no seu clã', 'recruta de fora: recusa');
