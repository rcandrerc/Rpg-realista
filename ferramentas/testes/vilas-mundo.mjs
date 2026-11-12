// As mini vilas do mundo grande (história v2, Entrega 3; esboço aprovado pelo André 2026-11-11): casas em volta do
// totem, sólidas (parede que se escala, telhado de andar em cima), gente e estações fora das casas, árvore nenhuma
// dentro. Uso: node ferramentas/testes/vilas-mundo.mjs
import { Simulacao, MAPA_CLAREIRA, VILAS_MUNDO, TOTENS, ESTACOES_PUBLICAS, Terreno } from '../../shared/index.js';
import { MODELOS_VILA, distRuas, distRet, CALCADA } from '../../shared/vilas.js';
import { ESTRADAS_MUNDO } from '../../shared/mundo.js';
import { npcApareceu } from '../../shared/historia.js';
import { VILAS_TERRENO, HISTORIA } from '../../shared/dados.js';
import { alturaMundo } from '../../shared/mundo.js';
import { gradeDoMundo } from '../../shared/relevo.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const G = gradeDoMundo(), T = new Terreno(MAPA_CLAREIRA), s = new Simulacao(MAPA_CLAREIRA);
const dentro = (c, x, z, f = 0) => { const M = MODELOS_VILA[c.m], dx = x - c.x, dz = z - c.z, cs = Math.cos(c.ry), sn = Math.sin(c.ry);
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) < M.w / 2 + f && Math.abs(lz) < M.d / 2 + f; };
ok(VILAS_MUNDO.length === 8, '8 vilas (6 novas + Porto de Vael e Aurora)');
for (const V of VILAS_MUNDO) {
  const T0 = TOTENS.lista.find((t) => t.id === V.totem);
  ok(T0 && T0.x === V.x && T0.z === V.z, `${V.id}: o totem no meio da praça`);
  ok(V.casas.length === (V.itens || []).length + (V.cidade?.pecas.length || 0), `${V.id}: todas as ${V.itens?.length || 0} casas couberam${V.cidade ? ` (e as ${V.cidade.pecas.length} peças da cidade)` : ''}`);
  ok(!V.banca === !V.banca && (!V.banca || V.banca.x != null), `${V.id}: banca no lugar`);
  // casa sólida: no meio dela o chão é o telhado (dá para andar em cima), e o alicerce cobre o desnível
  for (const c of V.casas) {
    const M = MODELOS_VILA[c.m];
    if (M.aberta) { ok(Math.abs(T.altura(c.x, c.z, c.y + 0.5) - (c.y + 0.03)) < 0.1, `${V.id}: piso da ferraria`); continue; }
    if (M.w == null || M.portao) continue; // fonte e portão de Aurora: conferidos lá embaixo
    const h = T.altura(c.x, c.z, 50);
    ok(Math.abs(h - (c.y + M.alto + M.sobe)) < 0.05, `${V.id} ${c.m}: cumeeira sólida (${h.toFixed(2)})`);
    const baixo = Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => alturaMundo(G, c.x + a * M.w / 2 * Math.cos(c.ry) + b * M.d / 2 * Math.sin(c.ry), c.z - a * M.w / 2 * Math.sin(c.ry) + b * M.d / 2 * Math.cos(c.ry))));
    ok(c.y - baixo <= 2.4, `${V.id} ${c.m}: alicerce chega no chão (${(c.y - baixo).toFixed(2)} m)`);
    ok(MAPA_CLAREIRA.mata.every((a) => !dentro(c, a.x, a.z, 0.8)), `${V.id} ${c.m}: nenhuma árvore dentro`);
  }
  // gente e estações fora das casas, perto da praça
  for (const n of MAPA_CLAREIRA.npcs.filter((o) => o.vila === V.id)) {
    const naCidade = V.cidade && V.casas.some((c) => c.n && Math.hypot(n.x - c.x, n.z - c.z) < 12);
    ok(V.casas.every((c) => MODELOS_VILA[c.m].aberta || MODELOS_VILA[c.m].w == null || !dentro(c, n.x, n.z, 0.3)) && (Math.hypot(n.x - V.x, n.z - V.z) < V.raio + 3 || naCidade), `${V.id}: ${n.nome} fora das casas e na vila`);
    ok(Math.abs(T.altura(n.x, n.z, 50) - alturaMundo(G, n.x, n.z)) < 0.6, `${V.id}: ${n.nome} no chão (não em cima de nada)`);
  }
  for (const E of ESTACOES_PUBLICAS.filter((e) => e.vila === V.id)) ok(V.casas.every((c) => MODELOS_VILA[c.m].aberta || !dentro(c, E.x, E.z, 0.5)), `${V.id}: ${E.nome} fora das casas`);
}
// cada vila nova tem chefe, ferreiro (bigorna e forninho públicos) e loja
for (const id of ['rio_claro', 'pouso_serra', 'juncal', 'vila_mare', 'vila_veu']) {
  const N = MAPA_CLAREIRA.npcs.filter((o) => o.vila === id);
  ok(N.some((n) => n.funcao === 'loja') && N.some((n) => (n.acoes || []).includes('consertar')) && ESTACOES_PUBLICAS.some((e) => e.id === 'pub_bigorna_' + id), `${id}: loja, ferreiro e bigorna`);
}
ok(MAPA_CLAREIRA.npcs.find((n) => n.id === 'alquimista').vila === 'rio_claro', 'a Mirela mudou para o Rio Claro');
// monstro não atravessa casa da vila
const C = VILAS_MUNDO[0].casas.find((c) => !MODELOS_VILA[c.m].aberta);
const bicho = { tipo: 'lobo', x: C.x, z: C.z, y: 0 };
s.colidir(bicho);
ok(!dentro(C, bicho.x, bicho.z, 0.2), 'monstro é empurrado para fora da casa');

// Aurora viva (André 2026-11-12, esboço aprovado): a cidade de pedra branca nos corredores entre os bairros
{
  const V = VILAS_MUNDO.find((v) => v.id === 'aurora'), P = V.casas.filter((c) => c.n), peca = (n) => P.find((c) => c.n === n);
  ok(P.length === 20 && ['portao', 'fonte', 'padaria', 'velas', 'tecidos', 'cristais', 'comida', 'avo', 'kael', 'pousada', 'templo', 'paco', 'torre_no', 'torre_ne', 'torre_so', 'torre_se'].every(peca), 'Aurora viva: as 20 peças do esboço no lugar');
  const bairros = VILAS_TERRENO.filter((b) => b.bairro);
  for (const c of P) {
    const M = MODELOS_VILA[c.m], R = M.w == null ? null : { x: c.x, z: c.z, ry: c.ry, w: M.w, d: M.d }, dist = (x, z) => R ? distRet(R, x, z) : Math.max(0, Math.hypot(x - c.x, z - c.z) - M.r);
    ok(c.desnivel <= 2.3, `Aurora ${c.n}: alicerce cobre o desnível (${c.desnivel} m)`);
    // nada em cima dos bairros (terrenos dos jogadores): nem um canto dentro da área de nenhum
    const cs = R ? [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c.x + a * M.w / 2 * Math.cos(c.ry) + b * M.d / 2 * Math.sin(c.ry), c.z - a * M.w / 2 * Math.sin(c.ry) + b * M.d / 2 * Math.cos(c.ry)]) : [[c.x, c.z]];
    ok(bairros.every((b) => cs.every(([x, z]) => Math.hypot(x - b.area.x, z - b.area.z) > b.area.rx + (R ? 1 : M.r + 1))), `Aurora ${c.n}: fora dos bairros dos terrenos`);
    if (!M.portao) ok(ESTRADAS_MUNDO.every((e) => e.curva.every(([x, z]) => dist(x, z) > 2.6)), `Aurora ${c.n}: fora da estrada`);
    ok(MAPA_CLAREIRA.mata.every((a) => dist(a.x, a.z) > 1), `Aurora ${c.n}: nenhuma árvore dentro`);
  }
  ok(MAPA_CLAREIRA.mata.every((a) => distRuas(V.ruas, a.x, a.z) > CALCADA.largura / 2 + 1 && Math.hypot(a.x - V.praca.x, a.z - V.praca.z) > V.praca.r + 1), 'Aurora: nenhuma árvore na praça nem nas ruas de pedra');
  // calçamento é chão de andar (servidor e app): a rua um tiquinho acima do chão, a praça um pouco mais
  ok(Math.abs(T.altura(V.praca.x + 3, V.praca.z - 4, 50) - (V.praca.y + CALCADA.sobePraca)) < 0.02, 'Aurora: a Praça das Luzes é chão de pedra');
  const r0 = V.ruas[3][10];
  ok(Math.abs(T.altura(r0[0], r0[1], 50) - (r0[2] + CALCADA.sobe)) < 0.02, 'Aurora: a rua do Paço é chão de pedra');
  const tor = peca('torre_ne');
  ok(Math.abs(T.altura(tor.x, tor.z, 50) - (tor.y + 9)) < 0.05, 'Aurora: a torre de cristal é sólida (topo a 9 m)');
  const po = peca('portao');
  ok(Math.abs(T.altura(po.x, po.z, 50) - alturaMundo(G, po.x, po.z)) < 0.1 && MAPA_CLAREIRA.obstaculos.filter((o) => Math.hypot(o.x - po.x, o.z - po.z) < 5 && o.r === 1.3).length === 2, 'Aurora: passa por baixo do Portão do Mar; os dois pilares bloqueiam');
  // a gente da cidade: só depois da Vesper (f3); a Elara muda para o Paço; o Kael mora na casa dele
  const N = MAPA_CLAREIRA.npcs.filter((n) => n.vila === 'aurora'), f3 = HISTORIA.findIndex((M) => M.id === 'f3');
  ok(N.filter((n) => n.depois === 'f3').length === 10, 'Aurora: 9 moradores e a Elara do Paço chegam depois da Vesper');
  ok(N.filter((n) => n.depois === 'f3' && n.funcao === 'loja').length === 3, 'Aurora: o mercado abre (3 lojas)');
  const ve = (n, p) => (!n.depois || npcApareceu(p, n.depois)) && (!n.ate || !npcApareceu(p, n.ate));
  const antes = { hist: { p: f3, ac: true, e: 0 } }, depois = { hist: { p: f3 + 1 } };
  const el = N.find((n) => n.id === 'v_elara'), elp = N.find((n) => n.id === 'v_elara_paco');
  ok(ve(el, antes) && !ve(elp, antes) && !ve(el, depois) && ve(elp, depois), 'Aurora: a Elara fica na praça até a Vesper e depois mora no Paço');
  ok(Math.hypot(elp.x - peca('paco').x, elp.z - peca('paco').z) < 10, 'Aurora: a Elara do Paço na porta do Paço');
  const k = N.find((n) => n.id === 'v_kael');
  ok(Math.hypot(k.x - peca('kael').x, k.z - peca('kael').z) < 6, 'Aurora: o Kael na porta da casa dele');
  const e2 = HISTORIA.find((M) => M.id === 'e2').etapas[0].pos, avo = peca('avo');
  ok(Math.hypot(e2[0] - avo.x, e2[1] - avo.z) < 6, 'Aurora: a missão da casa da avó leva à casa dela');
}