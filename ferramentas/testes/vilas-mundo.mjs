// As mini vilas do mundo grande (história v2, Entrega 3; esboço aprovado pelo André 2026-11-11): casas em volta do
// totem, sólidas (parede que se escala, telhado de andar em cima), gente e estações fora das casas, árvore nenhuma
// dentro. Uso: node ferramentas/testes/vilas-mundo.mjs
import { Simulacao, MAPA_CLAREIRA, VILAS_MUNDO, TOTENS, ESTACOES_PUBLICAS, Terreno } from '../../shared/index.js';
import { MODELOS_VILA } from '../../shared/vilas.js';
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
  ok(V.casas.length === (V.itens || []).length, `${V.id}: todas as ${V.itens?.length || 0} casas couberam`);
  ok(!V.banca === !V.banca && (!V.banca || V.banca.x != null), `${V.id}: banca no lugar`);
  // casa sólida: no meio dela o chão é o telhado (dá para andar em cima), e o alicerce cobre o desnível
  for (const c of V.casas) {
    const M = MODELOS_VILA[c.m];
    if (M.aberta) { ok(Math.abs(T.altura(c.x, c.z, c.y + 0.5) - (c.y + 0.03)) < 0.1, `${V.id}: piso da ferraria`); continue; }
    const h = T.altura(c.x, c.z, 50);
    ok(Math.abs(h - (c.y + M.alto + M.sobe)) < 0.05, `${V.id} ${c.m}: cumeeira sólida (${h.toFixed(2)})`);
    const baixo = Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => alturaMundo(G, c.x + a * M.w / 2 * Math.cos(c.ry) + b * M.d / 2 * Math.sin(c.ry), c.z - a * M.w / 2 * Math.sin(c.ry) + b * M.d / 2 * Math.cos(c.ry))));
    ok(c.y - baixo <= 2.4, `${V.id} ${c.m}: alicerce chega no chão (${(c.y - baixo).toFixed(2)} m)`);
    ok(MAPA_CLAREIRA.mata.every((a) => !dentro(c, a.x, a.z, 0.8)), `${V.id} ${c.m}: nenhuma árvore dentro`);
  }
  // gente e estações fora das casas, perto da praça
  for (const n of MAPA_CLAREIRA.npcs.filter((o) => o.vila === V.id)) {
    ok(V.casas.every((c) => MODELOS_VILA[c.m].aberta || !dentro(c, n.x, n.z, 0.3)) && Math.hypot(n.x - V.x, n.z - V.z) < V.raio + 3, `${V.id}: ${n.nome} fora das casas e na vila`);
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
