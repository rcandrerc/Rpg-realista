// Água do regador (André 2026-11-07): 20 regas, enche no poço da vila ou na beira do lago, e avisa.
// Uso: node ferramentas/testes/regador.mjs
import { Simulacao, MAPA_CLAREIRA, HORTA, LAGOS } from '../../shared/index.js';
import { progressoValido } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
ok(HORTA.agua === 20, 'regador cheio dá 20 regas');
s.eventos = []; s.encherRegador('A');
ok(avisos().some((t) => /não tem regador/.test(t)), 'sem regador avisa');
j.prog.mochila[j.prog.mochila.indexOf(null)] = { k: 'regador', n: 1 };
s.eventos = []; s.encherRegador('A');
ok(avisos().some((t) => /já está cheio/.test(t)), 'cheio avisa');
j.prog.agua = 0; j.x = 200; j.z = 200; s.eventos = []; s.encherRegador('A');
ok(j.prog.agua === 0 && avisos().some((t) => /poço da vila/.test(t)), 'longe da água avisa: ' + avisos().join(' | '));
j.x = HORTA.poco.x + 2; j.z = HORTA.poco.z; s.eventos = []; s.encherRegador('A');
ok(j.prog.agua === 20 && s.eventos.some((e) => e.t === 'regador' && /Regador cheio/.test(e.texto)), 'no poço enche e avisa');
const L = LAGOS[0]; j.prog.agua = 3; j.x = L.x; j.z = L.z; s.eventos = []; s.encherRegador('A');
ok(j.prog.agua === 20, 'dentro/na beira do lago enche');
j.prog.agua = 0; ok(progressoValido(j.prog)?.agua === 0, 'a água vazia fica salva na conta');
