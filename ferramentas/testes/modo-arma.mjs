// André 2026-11-24: a arma na mão (Espada/Magia) vai para a conta e volta no login.
// Uso: node ferramentas/testes/modo-arma.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), a = s.adicionarJogador('A', 'Ana');
ok(a.modo === 'Espada', 'conta nova começa de espada');
s.trocarModo('A', 'Magia');
const g = s.progressosParaSalvar().find((r) => r.id === 'A');
ok(g && g.prog.modo === 'Magia', 'trocar para magia grava na conta');
const s2 = new Simulacao(MAPA_CLAREIRA), b = s2.adicionarJogador('B', 'Ana', undefined, { progresso: g.prog });
ok(b.modo === 'Magia', 'entrou de novo: continua mago');
s2.trocarModo('B', 'Espada');
ok(s2.progressosParaSalvar().find((r) => r.id === 'B')?.prog.modo === 'Espada', 'volta para espada e grava');
const c = s2.adicionarJogador('C', 'Cia', undefined, { progresso: { modo: 'lixo' } });
ok(c.modo === 'Espada', 'valor inválido vira espada');
