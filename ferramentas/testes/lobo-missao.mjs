// Lobo só depois da missão do Bento (André 2026-11-11, pela segunda vez: "até eu fazer a missão, vou a pé").
// Trava as duas pontas para não voltar: o servidor não deixa montar e o app (Godot) não mostra o botão nem chama o
// lobo no "Ir para", nem com a conexão caída. Uso: node ferramentas/testes/lobo-missao.mjs
import { readFileSync } from 'node:fs';
import { Simulacao, MAPA_CLAREIRA, HISTORIA } from '../../shared/index.js';
import { liberado } from '../../shared/historia.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const gd = (f) => readFileSync(new URL(`../../godot-prototipo/${f}`, import.meta.url), 'utf8');

// servidor: personagem novo não monta; no meio da missão do alfa (etapa "Monte no lobo") monta; depois dela também
const iLobo = HISTORIA.findIndex((M) => M.libera.includes('lobo'));
ok(iLobo >= 0, `uma missão libera o lobo (${HISTORIA[iLobo]?.nome})`);
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
const tentar = () => { j.montado = null; j.trava = 0; s.montar('A'); return !!j.montado; };
ok(!liberado(j.prog, 'lobo') && !tentar(), 'personagem novo: não monta');
for (let p = 0; p < iLobo; p++) { j.prog.hist = { v: 2, p, ac: true, e: 0, n: 0, m: 0 }; ok(!tentar(), `na missão ${HISTORIA[p].id}: não monta`); }
const M = HISTORIA[iLobo];
for (let e = 0; e < M.liberaNaEtapa; e++) { j.prog.hist = { v: 2, p: iLobo, ac: true, e, n: 0, m: 0 }; ok(!tentar(), `${M.id} etapa ${e}: ainda não monta`); }
j.prog.hist = { v: 2, p: iLobo, ac: true, e: M.liberaNaEtapa, n: 0, m: 0 }; ok(tentar(), `${M.id} etapa ${M.liberaNaEtapa} (Monte no lobo): monta`);
j.prog.hist = { v: 2, p: iLobo + 1, ac: false, e: 0, n: 0, m: 0 }; ok(tentar(), 'missão do lobo feita: monta');

// app: o botão e o "Ir para" usam a regra estrita (progresso da conta, mesmo sem conexão)
const main = gd('main.gd'), rota = gd('rota.gd'), nevoa = gd('nevoa.gd'), online = gd('online.gd');
ok(/hud\.mostrar_botao\("montar", montaria != null or nevoa == null or nevoa\.liberado\("lobo", true\)\)/.test(main), 'main.gd: botão do lobo some até liberar (estrito)');
ok(main.includes('elif nevoa and not nevoa.liberado("lobo", true):'), 'main.gd: tocar no botão sem a missão não monta');
ok(rota.includes('if m.nevoa and not m.nevoa.liberado("lobo", true):'), 'rota.gd: o "Ir para" vai a pé sem a missão');
ok(/func liberado\(k: String, estrito := false\)/.test(nevoa) && /var h: Dictionary = hist_conta\(\) if estrito else hist\(\)/.test(nevoa), 'nevoa.gd: liberado estrito usa o progresso da conta');
ok(/func hist_conta\(\)[\s\S]*?if h is Dictionary:\n\t\treturn h\n\tif tem_conta\(\):\n\t\treturn \{"p": 0/.test(nevoa), 'nevoa.gd: queda de conexão não abre o lobo');
ok(/if not sm and m\.rota and m\.rota\.ativo:[^\n]*\n\t+m\.rota\.a_pe = true/.test(online), 'online.gd: servidor recusou o lobo, o "Ir para" segue a pé (sem chamar e soltar)');
