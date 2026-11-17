// "Ir" até qualquer NPC (André 2026-11-17): a rede de estradas do servidor (shared/rota.js, a mesma do app rota.gd)
// fica inteira em cada terra, as ruas do Rio Claro e de Aurora entram nela e a Estrada do Mercador chega no Pedrão.
// O teste andando de verdade (a pé, de lobo e de carrinho, com a física do app) é ferramentas/rota/ir-npcs.gd.
// Uso: node ferramentas/testes/rota-npcs.mjs
import { readFileSync } from 'node:fs';
import { MAPA_CLAREIRA as M } from '../../shared/index.js';
import { redeDeEstradas, terraId, planejarRota } from '../../shared/rota.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const R = redeDeEstradas(M), n = R.xs.length, comp = new Int32Array(n).fill(-1), terras = new Map();
for (let i = 0, c = 0; i < n; i++) if (comp[i] < 0) {
  const q = [i]; comp[i] = c;
  for (let k = 0; k < q.length; k++) for (const v of R.viz[q[k]]) if (comp[v] < 0) { comp[v] = c; q.push(v); }
  const t = terraId(R.xs[i], R.zs[i]); terras.set(t, (terras.get(t) || 0) + 1); c++;
}
ok([...terras.values()].every((k) => k === 1), `um pedaço de estrada por terra (${JSON.stringify([...terras])})`);
const longe = (x, z) => { const b = R.maisPerto(x, z); return Math.hypot(R.xs[b] - x, R.zs[b] - z); };
const npc = (id) => M.npcs.find((o) => o.id === id);
for (const id of ['v_rosalina', 'v_benedito', 'v_marisa', 'v_anibal', 'v_jurema']) ok(longe(npc(id).x, npc(id).z) < 8, `${id}: a rua do mercado do Rio Claro passa do lado`);
ok(longe(npc('m_pedra').x, npc('m_pedra').z) < 3, 'Pedrão: a Estrada do Mercador chega nele');
const r = planejarRota(M, { x: 0, z: 1 }, npc('m_pedra'));
ok(r.pontos && r.metros < 70, `rota até o Pedrão pela estrada (${r.metros?.toFixed(0)} m)`);
const gd = readFileSync(new URL('../../godot-prototipo/rota.gd', import.meta.url), 'utf8');
ok(gd.includes('return _contornar(r)') && gd.includes('func _desvio('), 'rota.gd: o trecho que bate em algo vira desvio');
ok(gd.includes('cid.get("ruas", [])'), 'rota.gd: ruas das cidades na rede');
