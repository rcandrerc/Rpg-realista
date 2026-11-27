// Jogo leve: o carrinho na mochila tem o mesmo botão do jogo (menu.gd): "Colocar no chão" e, no mundo, "Guardar carrinho"
// (André 2026-11-27). O botão manda a msg 'item' usar, igual ao jogo.
// Uso: node ferramentas/testes/leve-carrinho.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.leve = true;
const i = a.prog.mochila.indexOf(null); a.prog.mochila[i] = { k: 'carrinho', n: 1 };
for (let t = 0; t < 5; t++) s.passo(1 / 20);
const linha = () => s.mochilaLeve(a).it.find((o) => o[1] === 'carrinho');
ok(linha()?.[7] === 'u' && linha()[10] === 'Colocar no chão', `na mochila: ${linha()?.[10]}`);
s.item('A', { acao: 'usar', i });
ok(a.prog.carrinho?.chao && linha()[10] === 'Guardar carrinho', `no chão: ${linha()?.[10]}`);
s.item('A', { acao: 'usar', i });
ok(!a.prog.carrinho?.chao && linha()[10] === 'Colocar no chão', 'guardou de volta');
