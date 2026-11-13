// Montado no lobo: plantar, colher, minerar e cortar descem do lobo sozinhos (André 2026-11-13: "desmonta automático").
// Uso: node ferramentas/testes/montado-desce.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.x = -19; a.z = 60; a.prog.ouro = 5000;
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 });
// horta: montado, arar o canteiro
a.prog.mochila[a.prog.mochila.indexOf(null)] = { k: 'enxada', n: 1 };
a.x = -23; a.z = 58; a.montado = 'lobo'; s.eventos = [];
s.horta('A', { acao: 'arar', c: '-24,58' });
ok(!a.montado, 'arar montado: desceu do lobo');
ok(s.loteDe(a).horta['-24,58'], 'e arou: ' + s.eventos.filter((e) => e.t === 'aviso').map((e) => e.texto).join(' | '));
// minerar montado
const no = [...s.coletaveis.values()].find((c) => c.tipo === 'pedra');
a.prog.mochila[a.prog.mochila.indexOf(null)] = { k: 'picareta', n: 1 };
a.x = no.x + no.r + 1; a.z = no.z; a.chao = true; a.trava = 0; a.montado = 'lobo';
s.coletar('A', { no: no.id });
ok(!a.montado && a.coleta, 'minerar montado: desceu do lobo e começou');
