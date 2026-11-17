// Duelo (André 2026-11-17: "opção pra chamar duelo tanto contra Dario e Cecília qt contra jogadores"), shared/duelo.js.
// Uso: node ferramentas/testes/duelo.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO, DUELO } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const sorte = (v, f) => { const r = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = r; } };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('a', 'Yukmei', 'ruiva', { conta: 1 });
const b = s.adicionarJogador('b', 'Luísa', 'ruiva', { conta: 2 });
for (const x of s.amigosIa) x.amigaEntrar('a', true);
s.passo(0.05);
const perto = (o, x, z) => { o.x = x; o.z = z; o.y = s.terreno.altura(x, z); o.montado = null; };
let vistos = []; // passo() devolve os eventos e esvazia a fila: guarda aqui também
const correr = (seg) => { for (let t = 0; t < seg; t += 0.05) vistos.push(...s.passo(0.05)); };
const evs = (f) => [...vistos, ...s.eventos].filter(f);
perto(a, 0, 4); perto(b, 2, 4);
const ouroA = a.prog.ouro, xpA = a.prog.xp, ouroB = b.prog.ouro, xpB = b.prog.xp, gastoB = JSON.stringify(b.prog.equip);

// fora do duelo jogador não acerta jogador
const vb = b.vida; s.ferir(b, 50, a, { q: 1 });
ok(b.vida === vb, 'sem duelo, um jogador não fere o outro');
ok(!s.inimigosDe(a).includes(b), 'sem duelo, o outro não é alvo');

// pedir, longe: avisa
perto(b, 20, 4); s.duelo('a', { acao: 'pedir', com: 'b' });
ok(evs((e) => e.t === 'aviso' && e.para === 'a' && /mais perto/.test(e.texto)).length, 'longe: pede para chegar perto');
perto(b, 2, 4); a.dueloPedidoT = -99;
s.eventos.length = 0; vistos = [];
s.duelo('a', { acao: 'pedir', com: 'b' });
ok(evs((e) => e.t === 'duelo' && e.para === 'b' && e.fase === 'pedido' && e.nome === 'Yukmei').length === 1, 'o outro recebe o pedido');
s.duelo('b', { acao: 'recusar', com: 'a' });
ok(!a.duelo && evs((e) => e.t === 'aviso' && e.para === 'a' && /recusou o duelo/.test(e.texto)).length, 'recusar avisa quem chamou');
a.dueloPedidoT = -99;
s.duelo('a', { acao: 'pedir', com: 'b' });
s.duelo('b', { acao: 'aceitar', com: 'a' });
ok(a.duelo && a.duelo === b.duelo && !a.duelo.luta, 'aceitou: duelo começa com a contagem');
ok(evs((e) => e.t === 'duelo' && e.fase === 'inicio' && e.r === DUELO.raio).length === 2, 'os dois recebem o início com o círculo');
const v0 = b.vida; s.ferir(b, 30, a, { q: 1 });
ok(b.vida === v0, 'na contagem ninguém fere');
correr(DUELO.contagem + 0.1);
ok(a.duelo?.luta && s.inimigosDe(a).includes(b), 'depois da contagem o outro vira alvo');
s.ferir(b, 30, a, { q: 1 });
ok(b.vida < v0, 'no duelo o golpe fere');
// atordoar pega com metade do tempo
s.ferir(b, 1, a, { atordoa: 2 });
ok(b.presoAte > s.tempo && b.presoAte - s.tempo <= 2 * DUELO.travar + 0.01, 'atordoar vale metade do tempo');
// golpe enorme: para em 10% e acaba, sem morrer
s.eventos.length = 0; vistos = [];
s.ferir(b, 1e6, a, { q: 1 });
ok(!b.morto && !a.duelo && !b.duelo, 'golpe forte: ninguém morre e o duelo acaba');
ok(b.vida === b.vidaMax && a.vida === a.vidaMax, 'no fim os dois voltam com a vida cheia');
const fimA = evs((e) => e.t === 'duelo' && e.fase === 'fim' && e.para === 'a')[0];
const fimB = evs((e) => e.t === 'duelo' && e.fase === 'fim' && e.para === 'b')[0];
ok(fimA?.ganhou === true && fimB?.ganhou === false && fimA.vencedor === 'Yukmei', 'quem ganhou e quem perdeu ficam sabendo');
ok(a.prog.duelos?.v === 1 && b.prog.duelos?.d === 1, 'placar na conta (1 vitória, 1 derrota)');
ok(a.prog.ouro === ouroA && a.prog.xp === xpA && b.prog.ouro === ouroB && b.prog.xp === xpB && JSON.stringify(b.prog.equip) === gastoB, 'sem castigo: ouro, XP e equipamento iguais');
s.ferir(b, 50, a, { q: 1 });
ok(b.vida === b.vidaMax, 'depois do duelo volta a não ferir');

// sair do círculo = perde
a.dueloPedidoT = -99; s.duelo('a', { acao: 'pedir', com: 'b' }); s.duelo('b', { acao: 'aceitar', com: 'a' });
correr(DUELO.contagem + 0.1);
s.eventos.length = 0; vistos = [];
perto(a, a.duelo.x + DUELO.raio + 2, a.duelo.z);
correr(0.1);
ok(!a.duelo && evs((e) => e.t === 'duelo' && e.fase === 'fim' && e.para === 'a' && e.ganhou === false && e.motivo === 'fora').length, 'saiu do círculo: perdeu');

// tempo esgotado: vence quem tem mais vida
perto(a, 0, 4); perto(b, 2, 4);
a.dueloPedidoT = -99; s.duelo('a', { acao: 'pedir', com: 'b' }); s.duelo('b', { acao: 'aceitar', com: 'a' });
correr(DUELO.contagem + 0.1);
s.ferir(a, 40, b, { q: 1 });
s.eventos.length = 0; vistos = [];
a.duelo.ate = s.tempo; correr(0.1);
ok(evs((e) => e.t === 'duelo' && e.fase === 'fim' && e.para === 'b' && e.ganhou === true && e.motivo === 'tempo').length, 'tempo acabou: vence quem tem mais vida');

// não dá montado no barco nem trocando
b.troca = {}; a.dueloPedidoT = -99; s.eventos.length = 0; vistos = [];
s.duelo('a', { acao: 'pedir', com: 'b' });
ok(!a.duelo && evs((e) => e.t === 'aviso' && /numa troca/.test(e.texto)).length, 'trocando: não duela');
b.troca = null;

// Cecília e Dario decidem na hora
const cec = s.amiga, dario = s.amigoIaDe(DARIO.id), dar = dario.amiga;
perto(cec, 1, 6); perto(dar, -1, 6);
a.dueloPedidoT = -99; s.eventos.length = 0; vistos = [];
sorte(0.99, () => s.duelo('a', { acao: 'pedir', com: cec.id }));
ok(!cec.duelo && evs((e) => e.t === 'aviso' && /Cecília recusou o duelo/.test(e.texto)).length, 'Cecília sem vontade: recusa');
a.dueloPedidoT = -99;
sorte(0, () => s.duelo('a', { acao: 'pedir', com: cec.id }));
ok(!cec.duelo, 'logo depois de recusar, mantém o não (humor)');
cec.ia.dueloHumor = null; a.dueloPedidoT = -99;
s.semIaAmiga = () => true; // a IA do dia acabou
sorte(0, () => s.duelo('a', { acao: 'pedir', com: cec.id }));
delete s.semIaAmiga;
ok(!cec.duelo && cec.ia.chatFila?.some((m) => /ocupad/.test(m.texto)), 'IA do dia acabou: "tô ocupada"');
cec.ia.dueloHumor = null; a.dueloPedidoT = -99;
sorte(0, () => s.duelo('a', { acao: 'pedir', com: dar.id }));
ok(dar.duelo && dar.duelo === a.duelo, 'Dario com vontade: aceita');
correr(DUELO.contagem + 0.1);
const vA = a.vida;
correr(6);
ok(a.vida < vA || !a.duelo, 'o Dario luta de verdade no duelo');
if (a.duelo) s.duelo('a', { acao: 'desistir' });
ok(!a.duelo && !dar.duelo && dar.vida === dar.vidaMax, 'desistir encerra e ele volta inteiro');
ok(dar.ia.chatFila?.some((m) => DARIO.falas.duelo.ganhei.includes(m.texto)), 'o Dario comenta que ganhou');
ok(AMIGA.falas.duelo && DARIO.falas.duelo.sim[0] !== AMIGA.falas.duelo.sim[0], 'Cecília e Dario têm falas próprias de duelo');
