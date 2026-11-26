// Fornalha com 2 espaços de material (André 2026-11-26): do ferro em diante o combustível tem que ser carvão (lenha só no
// cobre e para virar carvão); aço = 1 barra de ferro (Material 1) + 2 carvões (Material 2) + carvão no combustível.
// Uso: node ferramentas/testes/fornalha-dois-espacos.mjs
import { Simulacao, MAPA_CLAREIRA, ESTACOES_PUBLICAS, FORNALHA } from '../../shared/index.js';
import { avancarForno, fornoValido } from '../../shared/simulacao.js';
import './_tudo-aberto.mjs';
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.prog.ouro = 5000; a.prog.prof.fer = 100000; // Ferreiro alto: o aço pede Nv 5
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (e) => e.filter((x) => x.t === 'aviso').map((x) => x.texto).join(' | ');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const f = ESTACOES_PUBLICAS.find((o) => o.id === 'pub_fornalha');
a.x = f.x - 1.4; a.z = f.z + 0.5;
const dar = (k, n) => { const i = a.prog.mochila.findIndex((o) => !o); a.prog.mochila[i] = { k, n }; return i; };
const por = (lugar, i, n) => { s.forno('A', { acao: 'por', p: f.id, lugar, i, ...(n ? { n } : {}) }); return ev(); };
const F = () => a.prog.fornosPub[f.id];
s.forno('A', { acao: 'abrir', p: f.id }); ev();

ok(FORNALHA.receitas.barra_ferro.ent2.k === 'carvao' && FORNALHA.receitas.barra_ferro.ent2.n === 2, 'dados: aço pede 2 carvões no 2º espaço');
ok(FORNALHA.receitas.minerio_ferro.fogo === 'carvao' && !FORNALHA.receitas.minerio_cobre.fogo, 'dados: ferro só com carvão, cobre com qualquer');

// minério de ferro com lenha no combustível: não anda
let e = por('ent', dar('minerio_ferro', 6)); e = por('comb', dar('lenha', 10));
avancarForno(F(), F().t + 60000);
ok(!F().sai, 'ferro com lenha no combustível não funde');
s.forno('A', { acao: 'abrir', p: f.id }); e = ev();
ok(e.some((x) => x.t === 'forno' && x.precisa === 'carvao'), 'a janela avisa que precisa de carvão');
// tira a lenha, põe carvão: funde
s.forno('A', { acao: 'tirar', p: f.id, lugar: 'comb' }); ev();
por('comb', dar('carvao', 10));
avancarForno(F(), F().t + 60000);
ok(F().sai?.k === 'barra_ferro' && F().sai.n === 2, '6 minérios com carvão viram 2 barras de ferro');
s.forno('A', { acao: 'tirar', p: f.id, lugar: 'sai' }); ev();

// aço: 2 barras de ferro, 2 carvões por aço no 2º espaço, carvão no combustível
s.forno('A', { acao: 'tirar', p: f.id, lugar: 'comb' }); ev();
por('ent', dar('barra_ferro', 2)); por('comb', dar('carvao', 10));
avancarForno(F(), F().t + 100000);
ok(!F().sai && F().ent?.n === 2, 'aço sem carvão no 2º espaço não anda');
s.forno('A', { acao: 'abrir', p: f.id }); e = ev();
ok(e.some((x) => x.t === 'forno' && x.pede2?.k === 'carvao' && x.pede2.n === 2), 'a janela diz que falta 2 carvões no 2º material');
e = por('ent2', dar('lenha', 4)); ok(/2º material|2 carvões/.test(avisos(e)) && !F().ent2, 'lenha não entra no 2º espaço ' + avisos(e));
por('ent2', dar('carvao', 3));
ok(F().ent2?.k === 'carvao' && F().ent2.n === 3, '3 carvões no 2º espaço');
avancarForno(F(), F().t + 100000);
ok(F().sai?.k === 'barra_aco' && F().sai.n === 1 && F().ent?.n === 1 && F().ent2?.n === 1, 'sai 1 aço: gastou 1 ferro e 2 carvões do 2º espaço');
// com lenha no combustível o aço não anda
s.forno('A', { acao: 'tirar', p: f.id, lugar: 'comb' }); ev();
F().fogo = 0; F().fogoK = '';
por('comb', dar('lenha', 5)); por('ent2', dar('carvao', 4));
avancarForno(F(), F().t + 100000);
ok(F().sai.n === 1, 'aço com lenha no combustível não anda');
// espaço 2 salva e volta
const salvo = fornoValido(JSON.parse(JSON.stringify(F())));
ok(salvo.ent2?.k === 'carvao', 'o 2º espaço fica salvo na conta');
s.forno('A', { acao: 'tirar', p: f.id, lugar: 'ent2' }); ev();
ok(!F().ent2, 'tirar do 2º espaço devolve para a mochila');
// cobre continua com lenha
s.forno('A', { acao: 'tirar', p: f.id, lugar: 'ent' }); s.forno('A', { acao: 'tirar', p: f.id, lugar: 'sai' }); ev();
por('ent', dar('minerio_cobre', 3));
F().fogo = 0; F().fogoK = '';
avancarForno(F(), F().t + 30000);
ok(F().sai?.k === 'barra_cobre', 'cobre funde com lenha');

// líder bot (fundirBauNpc): faz carvão da lenha e gasta carvão no ferro e no aço
{
  const bau = Array(40).fill(null);
  bau[0] = { k: 'minerio_ferro', n: 30 }; bau[1] = { k: 'barra_ferro', n: 40 }; bau[2] = { k: 'lenha', n: 50 };
  const E = { bau };
  s.fundirBauNpc(E, null);
  const q = (k) => bau.reduce((t, o) => t + (o?.k === k ? o.n : 0), 0);
  ok(q('barra_aco') >= 1 && q('carvao') >= 0 && q('lenha') < 50, `bot fez carvão da lenha e aço (aço ${q('barra_aco')}, carvão ${q('carvao')}, lenha ${q('lenha')})`);
  ok(q('barra_ferro') + q('barra_aco') + q('minerio_ferro') / 3 >= 40 + 10 - 1, 'bot não perdeu ferro: cada aço gastou 1 barra');
  const bau2 = Array(40).fill(null); bau2[0] = { k: 'minerio_ferro', n: 30 };
  s.fundirBauNpc({ bau: bau2 }, null);
  ok(bau2.every((o) => !o || o.k === 'minerio_ferro'), 'bot sem carvão nem lenha não funde ferro');
}
