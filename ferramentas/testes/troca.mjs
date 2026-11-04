// Teste das regras da troca entre jogadores (shared/simulacao.js troca). Uso: node ferramentas/testes/troca.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana'), b = s.adicionarJogador('B', 'Beto');
b.x = a.x + 1; b.z = a.z; b.y = a.y;
a.prog.mochila[0] = { k: 'pocao', n: 10 }; a.prog.mochila[1] = { k: 'espada', r: 2 }; a.prog.ouro = 100;
b.prog.mochila[0] = { k: 'minerio_ferro', n: 5 }; b.prog.ouro = 50;
let salvou = 0; s.aoTrocar = () => salvou++;
const ev = () => { const e = s.eventos; s.eventos = []; return e.filter(x=>x.t==='troca'||x.t==='aviso').map(x=>x.t+':'+(x.fase||x.texto)+'@'+x.para); };
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
s.troca('A', { acao: 'pedir', com: 'B' }); console.log(ev());
s.troca('B', { acao: 'aceitar', com: 'A' }); ok(a.troca && a.troca === b.troca, 'abriu'); ev();
s.troca('A', { acao: 'por', i: 0, n: 3 }); s.troca('A', { acao: 'por', i: 0, n: 30 }); ok(a.troca.of.A.itens[0].n === 10, 'limita ao que tem');
s.troca('A', { acao: 'por', i: 1 }); s.troca('A', { acao: 'ouro', n: 40 });
s.troca('B', { acao: 'por', i: 0, n: 5 });
s.troca('A', { acao: 'confirmar' }); ok(!a.troca.of.A.ok, 'confirmar sem trancar não vale');
s.troca('A', { acao: 'trancar', v: true }); s.troca('B', { acao: 'trancar', v: true });
s.troca('B', { acao: 'ouro', n: 1 }); ok(a.troca.of.B.ouro === 0, 'trancado não muda');
s.troca('B', { acao: 'trancar', v: false }); s.troca('B', { acao: 'ouro', n: 10 }); ok(!a.troca.of.A.tranca, 'mudança destranca o outro');
s.troca('A', { acao: 'trancar', v: true }); s.troca('B', { acao: 'trancar', v: true });
// A usa uma poção depois de trancar: tentativa de enganar
a.prog.mochila[0].n = 9; s.passo(0.05); ok(!a.troca.of.A.tranca && a.troca.of.A.itens.length === 1, 'item sumiu destranca e tira da oferta');
s.troca('A', { acao: 'por', i: 0, n: 9 });
s.troca('A', { acao: 'trancar', v: true }); s.troca('B', { acao: 'trancar', v: true });
s.troca('A', { acao: 'confirmar' }); s.troca('B', { acao: 'confirmar' }); ev();
ok(!a.troca && !b.troca, 'fechou');
ok(a.prog.ouro === 70 && b.prog.ouro === 80, 'ouro ' + a.prog.ouro + ' ' + b.prog.ouro);
ok(b.prog.mochila.some((o) => o?.k === 'pocao' && o.n === 9) && b.prog.mochila.some((o) => o?.k === 'espada' && o.r === 2) && !b.prog.mochila.some((o) => o?.k === 'minerio_ferro'), 'B recebeu ' + JSON.stringify(b.prog.mochila.filter(Boolean)));
ok(a.prog.mochila.some((o) => o?.k === 'minerio_ferro' && o.n === 5) && !a.prog.mochila.some((o) => o?.k === 'espada'), 'A recebeu ' + JSON.stringify(a.prog.mochila.filter(Boolean)));
ok(salvou === 1, 'gravou');
// mochila cheia
s.troca('A', { acao: 'pedir', com: 'B' }); s.troca('B', { acao: 'pedir', com: 'A' }); ok(a.troca, 'os dois pediram: abre');
for (let i = 0; i < b.prog.mochila.length; i++) b.prog.mochila[i] ||= { k: 'espada', r: 0 };
s.troca('A', { acao: 'por', i: 0, n: 5 }); s.troca('A', { acao: 'trancar', v: true }); s.troca('B', { acao: 'trancar', v: true });
s.troca('A', { acao: 'confirmar' }); s.troca('B', { acao: 'confirmar' }); ok(a.troca && a.prog.mochila[0].n === 5, 'mochila cheia não troca nem some');
b.x += 20; s.passo(0.05); ok(!a.troca && !b.troca, 'longe fecha');
s.troca('A', { acao: 'pedir', com: 'B' }); ok(!b.pedidoTroca || true, 'longe');
console.log(ev());
s.removerJogador('B');
