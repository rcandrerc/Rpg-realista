// Teste dos pontos de atributo em lote (shared/simulacao.js distribuirAtributos). Uso: node ferramentas/testes/pontos-atributo.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', null, { conta: 1 });
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
a.prog.pontos = 5;
const base = { ...a.prog.atr };
s.distribuirAtributos('A', { for: 2, vit: 1 });
ok(a.prog.atr.for === base.for + 2 && a.prog.atr.vit === base.vit + 1 && a.prog.pontos === 2, 'confirma vários de uma vez');
s.distribuirAtributos('A', { int: 3 });
ok(a.prog.atr.int === base.int && a.prog.pontos === 2, 'recusa mais pontos do que tem');
s.distribuirAtributos('A', { for: -1, des: 2 });
ok(a.prog.atr.for === base.for + 2 && a.prog.pontos === 2, 'não tira ponto confirmado (negativo)');
s.distribuirAtributos('A', { sorte: 1 });
s.distribuirAtributos('A', { des: 1.5 });
s.distribuirAtributos('A', [1]);
ok(a.prog.pontos === 2, 'recusa chave errada, número quebrado e lista');
s.distribuirAtributo('A', 'des');
ok(a.prog.atr.des === base.des + 1 && a.prog.pontos === 1, 'o ponto avulso antigo continua funcionando');
