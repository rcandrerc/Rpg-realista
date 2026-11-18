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
// fora de combate (André 2026-11-18: duelo não começa em combate); os golpes do duelo deixam os dois em combate por alguns s
const calmo = (...os) => { for (const o of os) o.combateAte = 0; };
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
// em combate: não começa (nem quem pede, nem quem recebe)
a.combateAte = s.tempo + 5; s.eventos.length = 0; vistos = [];
s.duelo('a', { acao: 'pedir', com: 'b' });
ok(!a.duelo && evs((e) => e.t === 'aviso' && e.para === 'a' && /Você está em combate/.test(e.texto)).length, 'em combate: não pede duelo');
calmo(a); b.combateAte = s.tempo + 5; s.eventos.length = 0; vistos = [];
s.duelo('a', { acao: 'pedir', com: 'b' });
ok(!a.duelo && evs((e) => e.t === 'aviso' && e.para === 'a' && /Luísa está em combate/.test(e.texto)).length, 'o outro em combate: não pede duelo');
calmo(a, b); a.dueloPedidoT = -99;
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
{ // dano como no jogo normal: a defesa de quem apanha vale, sem igualar nível (André 2026-11-17)
  const st = b.st, red = st.reducao, v1 = b.vida; st.reducao = 0.5; b.prog.nivel = 50;
  s.ferir(b, 40, a); ok(v1 - b.vida === 20, 'defesa do outro vale (40 com 50% de defesa = 20), sem ajuste de nível');
  st.reducao = red; b.prog.nivel = 1;
}
// atordoar pega com metade do tempo
s.ferir(b, 1, a, { atordoa: 2 });
ok(b.presoAte > s.tempo && b.presoAte - s.tempo <= 2 * DUELO.travar + 0.01, 'atordoar vale metade do tempo');
// golpe enorme: para em 10% e acaba, sem morrer
s.eventos.length = 0; vistos = [];
const vidaA = a.vida, manaA = a.mana;
s.ferir(b, 1e6, a, { q: 1 });
ok(!b.morto && !a.duelo && !b.duelo, 'golpe forte: ninguém morre e o duelo acaba');
ok(b.vida > 0 && b.vida < b.vidaMax && a.vida === vidaA && a.mana === manaA, `no fim ninguém enche: a vida fica como estava (André 2026-11-18): ${b.vida}/${b.vidaMax}`);
const fimA = evs((e) => e.t === 'duelo' && e.fase === 'fim' && e.para === 'a')[0];
const fimB = evs((e) => e.t === 'duelo' && e.fase === 'fim' && e.para === 'b')[0];
ok(fimA?.ganhou === true && fimB?.ganhou === false && fimA.vencedor === 'Yukmei', 'quem ganhou e quem perdeu ficam sabendo');
ok(a.prog.duelos?.v === 1 && b.prog.duelos?.d === 1, 'placar na conta (1 vitória, 1 derrota)');
ok(a.prog.ouro === ouroA && a.prog.xp === xpA && b.prog.ouro === ouroB && b.prog.xp === xpB && JSON.stringify(b.prog.equip) === gastoB, 'sem castigo: ouro, XP e equipamento iguais');
const vDepois = b.vida; s.ferir(b, 50, a, { q: 1 });
ok(b.vida === vDepois, 'depois do duelo volta a não ferir');

// sair do círculo = perde
calmo(a, b); a.dueloPedidoT = -99; s.duelo('a', { acao: 'pedir', com: 'b' }); s.duelo('b', { acao: 'aceitar', com: 'a' });
correr(DUELO.contagem + 0.1);
s.eventos.length = 0; vistos = [];
perto(a, a.duelo.x + DUELO.raio + 2, a.duelo.z);
correr(0.1);
ok(!a.duelo && evs((e) => e.t === 'duelo' && e.fase === 'fim' && e.para === 'a' && e.ganhou === false && e.motivo === 'fora').length, 'saiu do círculo: perdeu');

// não dá montado no barco nem trocando
b.troca = {}; calmo(a, b); a.dueloPedidoT = -99; s.eventos.length = 0; vistos = [];
s.duelo('a', { acao: 'pedir', com: 'b' });
ok(!a.duelo && evs((e) => e.t === 'aviso' && /numa troca/.test(e.texto)).length, 'trocando: não duela');
b.troca = null;

// Cecília e Dario aceitam ou recusam como um jogador, sem fala pronta (André 2026-11-17)
perto(a, 0, 4);
const cec = s.amiga, dario = s.amigoIaDe(DARIO.id), dar = dario.amiga;
perto(cec, 1, 6); perto(dar, -1, 6);
const fila = (o) => (o.ia.chatFila || []).length;
const f0 = fila(cec);
calmo(a, cec, dar); a.dueloPedidoT = -99; s.eventos.length = 0; vistos = [];
sorte(0.99, () => s.duelo('a', { acao: 'pedir', com: cec.id }));
ok(!cec.duelo && evs((e) => e.t === 'aviso' && /Cecília recusou o duelo/.test(e.texto)).length, 'Cecília sem vontade: recusa');
ok(fila(cec) === f0, 'recusa sem mensagem pronta no chat');
a.dueloPedidoT = -99;
sorte(0, () => s.duelo('a', { acao: 'pedir', com: cec.id }));
ok(!cec.duelo, 'logo depois de recusar, mantém o não (humor)');
cec.ia.dueloHumor = null; a.dueloPedidoT = -99;
s.semIaAmiga = () => true; // a IA do dia acabou
sorte(0, () => s.duelo('a', { acao: 'pedir', com: cec.id }));
delete s.semIaAmiga;
ok(!cec.duelo, 'IA do dia acabou: recusa');
cec.ia.dueloHumor = null; a.dueloPedidoT = -99;
const d0 = fila(dar);
sorte(0, () => s.duelo('a', { acao: 'pedir', com: dar.id }));
ok(dar.duelo && dar.duelo === a.duelo && fila(dar) === d0, 'Dario com vontade: aceita, sem fala pronta');
correr(DUELO.contagem + 0.1);
const vA = a.vida;
correr(6);
ok(a.vida < vA || !a.duelo, 'o Dario luta de verdade no duelo');
ok(!a.duelo || a.duelo.ate === undefined, 'sem limite de tempo');
if (a.duelo) s.duelo('a', { acao: 'desistir' });
ok(!a.duelo && !dar.duelo && fila(dar) === d0, 'desistir encerra e ele não comenta no chat');
