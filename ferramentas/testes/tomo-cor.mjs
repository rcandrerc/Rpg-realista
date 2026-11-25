// Tomo na cor do jogo (painel e leilão): cinza = não precisa mais, verde = usa agora, laranja = vai precisar
import { estadoTomo, COR_TOMO, usosParaSubir } from '../../shared/index.js';
let falhas = 0; const ok = (c, m) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${m}`); if (!c) falhas++; };
const p = (nv, uso, nivel = 30) => ({ nivel, habs: { corte_duplo: { nv, uso } } });
const t = { k: 'tomo', h: 'corte_duplo', nv: 6 };
ok(estadoTomo(p(6, 0), t) === 0 && estadoTomo(p(8, 0), t) === 0, 'skill já passou: cinza');
ok(estadoTomo(p(5, usosParaSubir(5)), t) === 1, 'barra cheia no nível certo: verde');
ok(estadoTomo(p(5, 0), t) === 2 && estadoTomo(p(3, 0), t) === 2, 'ainda não dá: laranja');
ok(estadoTomo(null, t) === 2 && estadoTomo(p(5, 99), { k: 'tomo', h: 'nada', nv: 6 }) === 0, 'sem progresso ou skill estranha não quebra');
ok(COR_TOMO.length === 3, 'três cores');
process.exit(falhas ? 1 : 0);
