// Cadeado nos itens da mochila (André 2026-11-07): item trancado não vende (nem no "Vender vários"/"Selecionar tudo"),
// não vai para o lixo nem para a troca; o cadeado fica no item quando organiza, guarda no baú ou equipa.
// Uso: node ferramentas/testes/cadeado.mjs
import { Simulacao, MAPA_CLAREIRA, organizar, itemValido, guardar } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('C', 'Cris');
j.criando = false; j.morto = false;
s.pertoDeQuemCompra = () => true; // como se estivesse na frente da Rosa
const M = j.prog.mochila;
M[0] = { k: 'espada', r: 3 }; M[1] = { k: 'lenha', n: 20 }; M[2] = { k: 'pocao', n: 5 }; M[3] = { k: 'lenha', n: 7 };
s.item('C', { acao: 'cadeado', i: 0 }); s.item('C', { acao: 'cadeado', i: 1 });
ok(M[0].cad === 1 && M[1].cad === 1 && !M[2].cad, 'tranca o item tocado');
ok(itemValido(M[0]).cad === 1 && itemValido(M[1]).cad === 1, 'o cadeado fica gravado na conta');
const ouro0 = j.prog.ouro;
s.item('C', { acao: 'vender', i: 0 });
ok(M[0] && M[0].k === 'espada' && j.prog.ouro === ouro0, 'Vender: trancado não vende');
s.item('C', { acao: 'apagar', i: 1 });
ok(M[1] && M[1].n === 20, 'Apagar: trancado não vai para o lixo');
s.item('C', { acao: 'vender_varios', lista: [0, 1, 2, 3] }); // "Selecionar tudo"
ok(M[0]?.k === 'espada' && M[1]?.n === 20 && !M[2] && !M[3] && j.prog.ouro > ouro0, 'Vender vários: vende só os sem cadeado');
// organizar: pilha trancada não junta com a solta
M[2] = { k: 'lenha', n: 5 };
const r = organizar(M);
const lenhas = r.filter((o) => o && o.k === 'lenha');
ok(lenhas.length === 2 && lenhas.some((o) => o.cad && o.n === 20) && lenhas.some((o) => !o.cad && o.n === 5), 'Organizar: o cadeado continua na pilha certa');
// guardar (baú, coleta): o solto não entra na pilha trancada, e o trancado não perde o cadeado
const bau = [{ k: 'lenha', n: 3, cad: 1 }, null, null];
guardar(bau, { k: 'lenha', n: 2 });
ok(bau[0].n === 3 && bau[1].n === 2 && !bau[1].cad, 'guardar: solto vai para outra pilha');
guardar(bau, { k: 'lenha', n: 4, cad: 1 });
ok(bau[0].n === 7 && bau[0].cad === 1, 'guardar: trancado junta com trancado');
// equipar e tirar: o cadeado vai junto
s.item('C', { acao: 'equipar', i: 0 });
const lugar = Object.keys(j.prog.equip).find((l) => j.prog.equip[l]?.k === 'espada');
ok(lugar && j.prog.equip[lugar].cad === 1, 'equipado continua trancado');
s.item('C', { acao: 'cadeado', lugar: '__proto__' });
ok(!({}).cad, 'lugar estranho não mexe em nada');
// destrancar
const k = M.findIndex((o) => o && o.k === 'lenha' && o.cad);
s.item('C', { acao: 'cadeado', i: k });
ok(!M[k].cad, 'destranca');
s.item('C', { acao: 'apagar', i: k });
ok(!M[k], 'destrancado vai para o lixo');
// troca: item trancado não entra na oferta
const s2 = new Simulacao(MAPA_CLAREIRA);
const a = s2.adicionarJogador('A', 'Ana'), b = s2.adicionarJogador('B', 'Beto');
b.x = a.x + 1; b.z = a.z; b.y = a.y;
a.prog.mochila[0] = { k: 'espada', r: 2, cad: 1 }; a.prog.mochila[1] = { k: 'pocao', n: 3 };
s2.troca('A', { acao: 'pedir', com: 'B' }); s2.troca('B', { acao: 'aceitar', com: 'A' });
s2.troca('A', { acao: 'por', i: 0, n: 1 }); s2.troca('A', { acao: 'por', i: 1, n: 1 });
ok(a.troca && a.troca.of.A.itens.length === 1 && a.troca.of.A.itens[0].i === 1, 'Troca: trancado não entra na oferta');
