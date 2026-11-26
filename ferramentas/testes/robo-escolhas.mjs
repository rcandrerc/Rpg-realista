// Robô de testes (ronda 2026-11-19): com a mochila cheia de pilhas de poção ele nunca vendia nada (22 mil avisos
// "Mochila cheia" num turno). Uso: node ferramentas/testes/robo-escolhas.mjs
import { FERRAMENTAS_FAZENDA, ITENS } from '../../shared/index.js';
import { listaVenda, pocoesQueFicam } from '../robo/robo-escolhas.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const protegido = (o) => !o || !!o.cad || !!FERRAMENTAS_FAZENDA[o.k] || !!ITENS[o.k]?.usar?.veiculo;

// mochila de 40 lugares: 36 pilhas de poção de vida, 3 de mana e uma ferramenta (o que o turno de 19/11 deixou)
const ferramenta = Object.keys(FERRAMENTAS_FAZENDA)[0];
const m = [...Array.from({ length: 36 }, (_, i) => ({ k: 'pocao', n: i === 5 ? 20 : 19 })), { k: 'pocao_mana', n: 4 }, { k: 'pocao_mana', n: 20 }, { k: 'pocao_mana', n: 7 }, { k: ferramenta, n: 1 }];
const fica = pocoesQueFicam(m);
ok(fica.has(5) && fica.has(37) && fica.size === 2, 'fica a pilha maior de cada poção (vida e mana)');
const l = listaVenda(m, protegido);
ok(l.length === 37 && !l.includes(5) && !l.includes(37) && !l.includes(39), 'vende as outras 37 pilhas de poção; a maior de cada e a ferramenta ficam');
ok(listaVenda([{ k: 'pocao', n: 3 }, { k: 'pocao_mana', n: 2 }, null, null, null, null], protegido).length === 0, 'com só uma pilha de cada e lugar sobrando, não vende poção');
ok(listaVenda([{ k: 'pocao', n: 3, cad: 1 }, { k: 'pocao', n: 20, cad: 1 }], protegido).length === 0, 'poção com cadeado nunca vende');
const eq = Object.keys(ITENS).find((k) => ITENS[k].lugar);
ok(listaVenda([{ k: eq, n: 1 }, { k: 'couro', n: 50 }, { k: 'couro', n: 50 }, ...Array(6).fill(null)], protegido).join() === '0,2', 'continua vendendo a peça de equipamento e a pilha repetida');

// Ronda 2026-11-24: 175 mortes na guerra numa noite, sempre voltando ao mesmo campo
import { campoPerigoso, MORTES_TROCA } from '../robo/robo-escolhas.mjs';
const t0 = 1_000_000, min = 60e3;
const tres = [{ t: t0, campo: 'A' }, { t: t0 + 2 * min, campo: 'A' }, { t: t0 + 4 * min, campo: 'A' }];
ok(MORTES_TROCA === 3 && campoPerigoso(tres, 'A', t0 + 5 * min), '3 mortes em 10 min no mesmo campo: troca de campo');
ok(!campoPerigoso(tres.slice(0, 2), 'A', t0 + 5 * min), '2 mortes ainda não trocam');
ok(!campoPerigoso(tres, 'A', t0 + 12 * min), 'morte de mais de 10 min atrás não conta');
ok(!campoPerigoso(tres, 'B', t0 + 5 * min) && !campoPerigoso(tres, null, t0), 'morte em outro campo (ou sem campo) não conta');

// Ronda 2026-11-24: merge do Ato do Clã (k1-k4) no meio do turno; no servidor a e3 foi da posição 51 para a 55
import { listaMudou } from '../robo/robo-escolhas.mjs';
const velha = [{ id: 'a1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e6' }], nova = [{ id: 'a1' }, { id: 'k1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e6' }];
ok(!listaMudou(velha, { p: 2, u: 'e2' }) && !listaMudou(nova, { p: 3, u: 'e2' }), 'mesma lista do servidor: segue normal');
ok(listaMudou(velha, { p: 3, u: 'e2' }), 'servidor com missão nova no meio: o robô percebe e não lê a e6 no lugar da e3');
ok(listaMudou(velha, { p: 5, u: 'e6' }), 'servidor com mais missões que o robô: não zera a história');
ok(!listaMudou(velha, { p: 0 }) && !listaMudou(velha, null) && !listaMudou(velha, { p: 2 }), 'começo da história, sem história ou save sem u: nunca dá lista mudada');

// Ronda 2026-11-25: o robô 1 passou o dia no Nv 74 em Vael (campo máximo Nv 48) com a Aurora aberta. Sem campo do nível
// na terra dele, vai de totem (já visitado) para a terra que tem; sem totem de lá, diz o que falta
import { CACA, TOTENS } from '../../shared/index.js';
import { terraDoCampo, terraEm, totemDaTerra, outraTerraParaCacar, GANHO_OUTRA_TERRA } from '../robo/robo-escolhas.mjs';
const terraDoTotem = (id) => { const t = TOTENS.lista.find((o) => o.id === id); return t ? terraEm(CACA, t.x, t.z) : '?'; };
ok(['clareira', 'rio_claro', 'juncos', 'porto_vael', 'pouso_serra'].every((id) => terraDoTotem(id) === 'vael') && terraDoTotem('ilha') === 'ilha'
  && ['aurora', 'posto_leste', 'ultimo_pouso'].every((id) => terraDoTotem(id) === 'aurora'), 'cada totem cai na terra certa (Vael, Ilha do Meio, Aurora)');
ok(['vael', 'ilha', 'aurora'].every((T) => CACA.some((c) => !c.boss && terraDoCampo(c) === T)), 'as três terras têm campo de caça pelo nome');
const deTerra = (T) => TOTENS.lista.filter((t) => terraEm(CACA, t.x, t.z) === T).map((t) => t.id);
const aguenta = (nv) => (c) => !c.boss && (c.nivel || 1) <= nv && !/^Covil/.test(c.nome || '');
const aberto = () => false;
const o74 = outraTerraParaCacar({ minha: 'vael', campos: CACA, totens: TOTENS.lista, visitados: [...deTerra('vael'), ...deTerra('ilha'), ...deTerra('aurora')], ok: aguenta(74), fechado: aberto });
const maisPerto = (c, ids) => ids.map((id) => TOTENS.lista.find((t) => t.id === id)).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
ok(o74 && !o74.semTotem && o74.terra === 'aurora' && o74.campo.nivel === 74 && o74.totem.id === maisPerto(o74.campo, deTerra('aurora')).id,
  `Nv 74 em Vael com os totens visitados: vai caçar no campo Nv 74 da Aurora pelo totem mais perto dele (${o74?.totem?.id})`);
const sem = outraTerraParaCacar({ minha: 'vael', campos: CACA, totens: TOTENS.lista, visitados: deTerra('vael'), ok: aguenta(74), fechado: aberto });
ok(sem?.semTotem && sem.terra === 'aurora' && sem.campo.nivel === 74 && !sem.totem, 'sem totem da Aurora visitado: não viaja e diz qual terra teria o campo (para anotar o que falta)');
const nevoa = outraTerraParaCacar({ minha: 'vael', campos: CACA, totens: TOTENS.lista, visitados: [...deTerra('vael'), ...deTerra('aurora')], ok: aguenta(74), fechado: (t) => deTerra('aurora').includes(t.id) });
ok(nevoa?.semTotem && nevoa.terra === 'aurora', 'totem da Aurora na névoa conta como sem totem');
const ilha = outraTerraParaCacar({ minha: 'vael', campos: CACA, totens: TOTENS.lista, visitados: [...deTerra('vael'), ...deTerra('ilha')], ok: aguenta(74), fechado: aberto });
ok(ilha && !ilha.semTotem && ilha.terra === 'ilha' && ilha.campo.nivel === 64, 'só a Ilha visitada: vai para o campo Nv 64 da Ilha do Meio (melhor que o Nv 48 de Vael)');
ok(!outraTerraParaCacar({ minha: 'aurora', campos: CACA, totens: TOTENS.lista, visitados: TOTENS.lista.map((t) => t.id), ok: aguenta(74), fechado: aberto }), 'já na Aurora: o campo Nv 74 de lá basta, não viaja');
const pouco = outraTerraParaCacar({ minha: 'vael', campos: CACA, totens: TOTENS.lista, visitados: TOTENS.lista.map((t) => t.id), ok: aguenta(53), fechado: aberto });
ok(GANHO_OUTRA_TERRA === 6 && !pouco, `Nv 53: a Ilha (Nv 52) não ganha ${GANHO_OUTRA_TERRA} níveis sobre Vael (Nv 48), fica`);
const volta = totemDaTerra(TOTENS.lista, CACA, 'vael', deTerra('vael'), aberto, 0, 0);
ok(volta && terraDoTotem(volta.id) === 'vael' && !totemDaTerra(TOTENS.lista, CACA, 'ilha', deTerra('vael'), aberto, 0, 0), 'volta para Vael pelo totem de lá; para a Ilha sem visitar, nenhum');

// Ronda 2026-11-26: cada morte gasta 10% da peça e peça quebrada não dá bônus; o robô nunca consertava e morria até no
// campo Nv 56 da Ilha. Conserta com o ouro que tem: as quebradas primeiro, cada peça inteira ou nada
import { pecasParaConsertar, CONSERTA_ABAIXO } from '../robo/robo-escolhas.mjs';
import { custoConserto, LUGARES } from '../../shared/index.js';
const peca = (l) => Object.keys(ITENS).find((k) => ITENS[k].lugar === l);
const [kCorpo, kCabeca, kPes] = ['corpo', 'cabeca', 'pes'].map(peca);
ok(kCorpo && kCabeca && kPes && LUGARES.includes('corpo'), 'há peça de corpo, cabeça e pés para o teste');
ok(pecasParaConsertar({ corpo: { k: kCorpo, r: 1 }, pes: { k: kPes, r: 1 } }, 5000) === null, 'tudo inteiro: não vai ao ferreiro');
ok(pecasParaConsertar({ corpo: { k: kCorpo, r: 1, d: CONSERTA_ABAIXO + 10 } }, 5000) === null, `gasta mas acima de ${CONSERTA_ABAIXO}%: ainda não vale a viagem`);
const gasto = { corpo: { k: kCorpo, r: 1, d: 0 }, cabeca: { k: kCabeca, r: 1, d: 35 }, pes: { k: kPes, r: 1, d: 90 } };
const cCorpo = custoConserto(gasto.corpo), cCabeca = custoConserto(gasto.cabeca), cPes = custoConserto(gasto.pes);
const tudo = pecasParaConsertar(gasto, 1e9);
ok(tudo && tudo.lista.length === 3 && tudo.custo === cCorpo + cCabeca + cPes && tudo.quebradas === 1 && tudo.menor === 0 && tudo.ficam === 0,
  `com ouro sobrando conserta as 3 peças gastas por ${tudo?.custo} (a quebrada conta)`);
const pouco2 = pecasParaConsertar(gasto, cCorpo + 1);
ok(pouco2 && pouco2.lista.length === 1 && pouco2.lista[0].lugar === 'corpo' && pouco2.custo === cCorpo && pouco2.ficam === 2,
  'com ouro só para uma: conserta primeiro a quebrada');
const nada = pecasParaConsertar(gasto, 0);
ok(nada && nada.lista.length === 0 && nada.ficam === 3, 'sem ouro: lista vazia (o robô anota no relatório em vez de ir ao ferreiro)');
