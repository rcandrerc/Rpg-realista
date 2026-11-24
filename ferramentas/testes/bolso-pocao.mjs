// André 2026-11-24: slot de poção (vida/mana) é uma bag extra: não ocupa mochila, "vender tudo" não toca, enche da mochila ao gastar
import { Simulacao, MAPA_CLAREIRA, contar } from '../../shared/index.js';
import './_tudo-aberto.mjs';
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok ' : 'FALHOU ') + m); if (!c) falhas++; };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 }), p = a.prog; a.criando = false;
ok(p.bolso.pocao === 3 && p.bolso.pocao_mana === 2 && contar(p.mochila, 'pocao') === 0, 'ao entrar, as poções da mochila vão para o bolso');
p.mochila[5] = { k: 'pocao', n: 20 }; p.mochila[6] = { k: 'pocao', n: 5, cad: 1 };
s.item('A', { acao: 'vender_varios', lista: [5, 6] }); // longe da Rosa: não vende, mas o bolso não entra na conta
ok(p.bolso.pocao === 3, 'bolso intacto');
a.x = 0; s.pertoDeQuemCompra = () => true;
s.item('A', { acao: 'vender_varios', lista: [5, 6] });
ok(p.bolso.pocao === 3 && p.bolso.pocao_mana === 2, 'vender tudo não mexe no bolso');
ok(p.mochila[6] && p.mochila[6].cad, 'trancada continua');
a.vida = 1; s.item('A', { acao: 'usar', bolso: 'pocao' });
ok(p.bolso.pocao === 2 && a.vida > 1, 'bebe do bolso');
p.mochila[1] = { k: 'pocao', n: 9 }; a.pocaoAte = {}; a.vida = 1; p.bolso.pocao = 1;
s.item('A', { acao: 'usar', bolso: 'pocao' });
ok(p.bolso.pocao === 9 + 0 && p.mochila[1] === null, 'bolso gastou: enche da mochila ' + p.bolso.pocao);
console.log(falhas ? `${falhas} falhas` : 'tudo certo'); process.exit(falhas ? 1 : 0);
