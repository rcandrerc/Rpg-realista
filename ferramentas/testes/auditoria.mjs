// Consertos do conselho de auditoria (André 2026-11-13): brecha do "tirar", navio e barquinho que sumiam na gravação,
// compra da Rosa que cobrava sem entregar, briga da pesca sem o cronômetro do servidor e a missão b9 impossível no Nv28.
import { Simulacao, MAPA_CLAREIRA, progressoValido } from '../../shared/index.js';
import { HISTORIA, LOJA } from '../../shared/dados.js';
import { reforcoPrecisa } from '../../shared/progresso.js';
const ok = (c, t) => { if (!c) { console.error('FALHOU', t); process.exit(1); } console.log('ok', t); };

{ // '__proto__' no "tirar" não mexe no Object.prototype nem no item de outro jogador
  const s = new Simulacao(MAPA_CLAREIRA);
  const A = s.adicionarJogador('A', 'Ana', null, {}); s.adicionarJogador('B', 'Beto', null, {});
  s.item('A', { acao: 'tirar', lugar: '__proto__' });
  ok(!A.prog.mochila.includes(Object.prototype), 'tirar "__proto__" não põe o Object.prototype na mochila');
  for (const v of A.prog.mochila.keys()) s.item('A', { acao: 'cadeado', i: v });
  ok(({}).cad === undefined, 'nenhum objeto ganha cadeado de graça');
  const pontos = A.prog.pontos = 3; s.distribuirAtributo('A', 'constructor');
  ok(A.prog.pontos === pontos && !Object.hasOwn(A.prog.atr, 'constructor'), 'atributo "constructor" é recusado');
  s.item('A', { acao: 'tirar', lugar: 'espada' });
  ok(!A.prog.equip.espada || A.prog.mochila.some((o) => o && o.k === 'espada'), 'tirar a espada continua funcionando');
}

{ // navio: gravar no leme (reinício do servidor, sessão nova) guarda o navio ancorado onde ele está
  const s = new Simulacao(MAPA_CLAREIRA);
  const A = s.adicionarJogador('A', 'Ana', null, {}), p = A.prog;
  p.navio = { porao: [], chao: { x: A.x + 1, z: A.z, ry: 0 } };
  s.veiculo('A', { acao: 'subir', k: 'navio' });
  ok(A.veiculo === 'navio' && p.navio.chao === null, 'no leme, o navio sai do chão');
  const salvo = s.progressosParaSalvar().find((o) => o.id === 'A');
  ok(salvo && salvo.prog.navio?.chao, 'a gravação leva o navio ancorado');
  ok(A.veiculo === 'navio' && p.navio.chao === null, 'quem está no leme continua dirigindo');
  const B = s.adicionarJogador('B', 'Ana', null, { progresso: progressoValido(JSON.parse(JSON.stringify(salvo.prog))) });
  ok(B.prog.navio?.chao, 'entrando de novo, o navio está na água');
}

{ // barquinho: mochila cheia não deixa descer; morrer com a mochila cheia guarda à parte e ele volta quando abrir lugar
  const s = new Simulacao(MAPA_CLAREIRA);
  const A = s.adicionarJogador('A', 'Ana', null, {}), p = A.prog;
  A.veiculo = 'barquinho';
  const salvo = s.progressosParaSalvar().find((o) => o.id === 'A');
  ok(salvo.prog.mochila.some((o) => o && o.k === 'barquinho') && !p.mochila.some((o) => o && o.k === 'barquinho'), 'gravar no barquinho leva ele na mochila (só na cópia gravada)');
  for (let i = 0; i < p.mochila.length; i++) p.mochila[i] ||= { k: 'pedra', n: 1 };
  s.eventos.length = 0; s.veiculo('A', { acao: 'descer' });
  ok(A.veiculo === 'barquinho' && s.eventos.some((e) => e.para === 'A' && /Mochila cheia/.test(e.texto || '')), 'mochila cheia: não desce e avisa');
  s.morreuComCarga(A);
  ok(p.barcoFora === 1 && progressoValido(JSON.parse(JSON.stringify(p))).barcoFora === 1, 'morreu com a mochila cheia: o barquinho fica guardado à parte');
  p.mochila[3] = null; s.progressosParaSalvar();
  ok(!p.barcoFora && p.mochila[3]?.k === 'barquinho', 'abriu lugar: o barquinho volta para a mochila');
}

{ // Rosa: mochila cheia com poção trancada não cobra
  const s = new Simulacao(MAPA_CLAREIRA);
  const A = s.adicionarJogador('A', 'Ana', null, {}), p = A.prog;
  const rosa = s.mapa.npcs.find((n) => n.funcao === 'loja'); A.x = rosa.x + 1; A.z = rosa.z;
  p.ouro = 1000;
  for (let i = 0; i < p.mochila.length; i++) p.mochila[i] = { k: 'pedra', n: 1 };
  p.mochila[0] = { k: 'pocao', n: 3, cad: 1 };
  s.item('A', { acao: 'comprar', i: 0, n: 10 });
  ok(p.ouro === 1000 && p.mochila[0].n === 3, 'nada coube: não cobra nada');
  p.mochila[1] = null; s.item('A', { acao: 'comprar', i: 0, n: 2 });
  const pocoes = p.mochila.filter((o) => o && o.k === 'pocao' && !o.cad).reduce((a, o) => a + o.n, 0);
  ok(pocoes === 2 && p.ouro === 1000 - 2 * s.precoCompra(A, LOJA[0]), 'com lugar: entrega 2 e cobra 2');
}

{ // b9 dá para fazer no Nv28
  const b9 = HISTORIA.find((m) => m.id === 'b9'), ref = b9.etapas.find((e) => e.ev === 'reforcar'), ev = b9.etapas.find((e) => e.ev === 'evoluir');
  const maxNv28 = 3 + 27 * 2; // 54 pontos num atributo só
  ok(reforcoPrecisa({ k: 'espada' }, ref.min).n <= maxNv28 / 2 + 3, 'o reforço da b9 dá com metade dos pontos num atributo');
  ok(ev && (b9.recebe?.selo_epico | 0) >= 2, 'o Tomás dá dois Selos Épicos ao aceitar a b9');
}
console.log('auditoria: tudo certo');
