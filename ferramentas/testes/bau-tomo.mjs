// Tomo entra no baú (André 2026-11-07: "os outros itens vão, menos os tomos"). Uso: node ferramentas/testes/bau-tomo.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.x = -19; a.z = 60; a.prog.ouro = 5000;
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (e) => e.filter((x) => x.t === 'aviso').map((x) => x.texto).join(' | ');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ev();
a.prog.mochila[10] = { k: 'obra_bau', n: 1 };
s.construir('A', { k: 'bau', x: -25, z: 58.5, r: 0 }); ev();
ok(s.loteDe(a).pecas.some((o) => o.k === 'bau'), 'construiu o baú');
a.x = -23.6; a.z = 58.5;
a.prog.mochila[0] = { k: 'tomo', h: 'corte_duplo', nv: 7, n: 1 };
a.prog.mochila[1] = { k: 'lenha', n: 5 };
s.bau('A', { acao: 'guardar', i: 0 }); let e = ev();
ok(!a.prog.mochila[0] && s.loteDe(a).bau.some((o) => o && o.k === 'tomo' && o.h === 'corte_duplo' && o.nv === 7), 'Tomo entrou no baú ' + avisos(e));
s.bau('A', { acao: 'guardar', i: 1 }); ev();
ok(s.loteDe(a).bau.some((o) => o && o.k === 'lenha'), 'lenha continua entrando');
const iT = s.loteDe(a).bau.findIndex((o) => o && o.k === 'tomo');
s.bau('A', { acao: 'tirar', i: iT }); e = ev();
ok(a.prog.mochila.some((o) => o && o.k === 'tomo' && o.nv === 7), 'Tomo voltou para a mochila ' + avisos(e));
// Melhorar o baú (André 2026-11-07): 40 → 60 → 80, os itens ficam dentro, custo sai da mochila e do ouro
const L = s.loteDe(a);
ok(L.bau.length === 40, 'baú começa com 40 lugares');
a.prog.mochila.fill(null); a.prog.ouro = 100;
s.bau('A', { acao: 'melhorar' }); e = ev();
ok(L.bau.length === 40 && avisos(e).includes('falta'), 'sem material não melhora: ' + avisos(e));
a.prog.ouro = 5000; a.prog.mochila[0] = { k: 'lenha', n: 50 }; a.prog.mochila[1] = { k: 'barra_ferro', n: 10 };
s.bau('A', { acao: 'melhorar' }); e = ev();
const evb = e.find((x) => x.t === 'bau');
ok(L.bau.length === 60 && L.bauNv === 1 && evb.slots === 60 && evb.proxSlots === 80, 'melhorou para 60 ' + avisos(e));
ok(a.prog.ouro === 4500 && a.prog.mochila[0].n === 20 && !a.prog.mochila[1], 'gastou 30 lenha, 10 barras de ferro e 500 de ouro');
ok(L.bau.some((o) => o && o.k === 'lenha'), 'o que estava no baú continua lá');
a.prog.mochila[0] = { k: 'lenha', n: 50 }; a.prog.mochila[2] = { k: 'lenha', n: 50 }; a.prog.mochila[1] = { k: 'barra_aco', n: 15 };
s.bau('A', { acao: 'melhorar' }); e = ev();
ok(L.bau.length === 80 && e.find((x) => x.t === 'bau').prox === null, 'melhorou para 80, o maior ' + avisos(e));
s.bau('A', { acao: 'melhorar' }); ok(avisos(ev()).includes('máximo'), 'não passa de 80');
// salva e carrega com 80 lugares
const salvo = s.lotesParaSalvar().find((x) => x.id === L.def.id);
ok(salvo && salvo.dados.bauNv === 2 && salvo.dados.bau.length === 80, 'salva o tamanho do baú');
