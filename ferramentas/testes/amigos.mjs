// Teste das regras de amigos e time (shared/simulacao.js amigo/time). Uso: node ferramentas/testes/amigos.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGOS, TIME, NIVEL_INIMIGO, xpDoInimigo } from '../../shared/index.js';
const xpBase = (e) => xpDoInimigo(e.tipo, e.nivel, 1, NIVEL_INIMIGO);
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', null, { conta: 1 }), b = s.adicionarJogador('B', 'Beto', null, { conta: 2 }), c = s.adicionarJogador('C', 'Caio', null, { conta: 3 });
const gravou = []; s.aoAmizade = (x, y, j) => { gravou.push([x, y, j]); return true; };
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
ev();
s.time('A', { acao: 'convidar', com: 'B' }); ok(!b.conviteTime, 'não chama quem não é amigo');
s.amigo('A', { acao: 'pedir', com: 'B' });
ok(ev().some((e) => e.t === 'amigo' && e.para === 'B' && e.fase === 'pedido'), 'pedido chegou');
s.amigo('B', { acao: 'aceitar', com: 'A' });
ok(a.amigos.has('c2') && b.amigos.has('c1') && gravou.length === 1, 'viraram amigos e gravou');
const ls = ev().filter((e) => e.t === 'amigos' && e.para === 'A');
ok(ls.length && ls.at(-1).lista[0].c === 'c2' && ls.at(-1).lista[0].on === 1, 'lista mostra online');
s.time('A', { acao: 'convidar', com: 'c2' }); // pela conta (lista de amigos)
ok(b.conviteTime?.de === 'A', 'convite pela conta');
s.time('B', { acao: 'aceitar', com: 'A' });
ok(a.time && a.time === b.time && a.time.lider === 'A', 'time formado');
s.passo(0.6);
const t = s.eventos.length ? ev() : [];
// XP dividido: monstro morre perto do A, B está a 30 m (time) e C a 30 m (fora do time)
const m = s.inimigos.find((e) => !e.treino);
a.x = m.x + 2; a.z = m.z; b.x = m.x + 30; b.z = m.z; c.x = m.x - 30; c.z = m.z;
// B parado (não lutou): não ganha
let xa = a.prog.xp, xb = b.prog.xp, xc = c.prog.xp;
m.atacantes = new Set(['A']); s.morrer(m);
ok(a.prog.xp !== xa, 'A ganhou XP');
ok(b.prog.xp === xb, 'B (time, 30 m, sem lutar) não ganhou');
// B lutou há 5 s: ganha, e os dois levam o bônus do time
const mb = s.inimigos.find((e) => !e.treino && e !== m && !e.morto);
a.x = mb.x + 2; a.z = mb.z; b.x = mb.x + 30; b.z = mb.z; c.x = mb.x - 30; c.z = mb.z;
a.prog.nivel = 1; a.prog.xp = 0; b.prog.nivel = 1; b.prog.xp = 0; c.prog.xp = xc = 0;
a.lutouT = s.tempo; b.lutouT = s.tempo - 5;
const base = Math.round(xpBase(mb));
mb.atacantes = new Set(['A']); s.morrer(mb);
ok(b.prog.xp > 0, 'B (time, 30 m, lutou há 5 s) ganhou XP');
ok(a.prog.xp === Math.round(base * (1 + TIME.bonus)), `bônus do time: ${a.prog.xp} = ${base} + ${TIME.bonus * 100}%`);
ok(c.prog.xp === xc, 'C (fora do time) não ganhou');
b.lutouT = s.tempo - TIME.combate - 1;
const mc = s.inimigos.find((e) => !e.treino && e !== m && e !== mb && !e.morto); a.x = mc.x; a.z = mc.z; b.x = mc.x + 30; b.z = mc.z; c.x = mc.x + 300;
xb = b.prog.xp; mc.atacantes = new Set(['A']); s.morrer(mc);
ok(b.prog.xp === xb, 'lutou há mais de 10 s: não ganha');
b.lutouT = s.tempo;
b.x = m.x + TIME.perto + 5; const xb2 = b.prog.xp;
const m2 = s.inimigos.find((e) => !e.treino && e !== m && e !== mb && e !== mc && !e.morto); a.x = m2.x; a.z = m2.z; b.x = m2.x + TIME.perto + 5; b.z = m2.z; c.x = m2.x + 200;
m2.atacantes = new Set(['A']); s.morrer(m2);
ok(b.prog.xp === xb2, 'longe demais não ganha');
// barras de vida do time
const est = s.passo(0.6).filter((e) => e.t === 'time' && e.fase === 'estado');
ok(est.some((e) => e.para === 'B' && e.membros.length === 2 && 'mana' in e.membros[0]), 'B recebe vida e mana do time');
s.time('B', { acao: 'sair' }); ok(!a.time && !b.time, 'sobrou um: time acaba');
// lista cheia
for (let i = 0; i < AMIGOS.max; i++) c.amigos.set('c' + (100 + i), 'x' + i);
s.amigo('A', { acao: 'pedir', com: 'C' }); ok(!c.pedidoAmigo, 'lista cheia não pede');
s.amigo('A', { acao: 'remover', c: 'c2' }); ok(!a.amigos.has('c2') && !b.amigos.has('c1') && gravou.at(-1)[2] === false, 'remover tira dos dois');
// saiu do jogo dentro do time
s.amigo('A', { acao: 'pedir', com: 'B' }); s.tempo += 5; s.amigo('B', { acao: 'pedir', com: 'A' }); ok(a.amigos.has('c2'), 'os dois pediram: amigos');
s.time('B', { acao: 'convidar', com: 'A' }); s.time('A', { acao: 'aceitar', com: 'B' }); ok(a.time && a.time.lider === 'B', 'time de novo');
s.removerJogador('B'); ok(!a.time, 'saiu do jogo: time acaba');
