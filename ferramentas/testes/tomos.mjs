// Tomos (André 2026-11-07): o drop sorteia entre os níveis que a skill ainda vai precisar (VI ao X),
// não só o próximo. Uso: node ferramentas/testes/tomos.mjs
import { Simulacao, MAPA_CLAREIRA, HABS } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('T', 'Teo');
j.criando = false; j.morto = false; j.prog.nivel = 30;
for (const k of Object.keys(HABS)) if (HABS[k].tomo) j.prog.habs[k] = { nv: 5, uso: 0 };
const viu = new Set(), r = Math.random;
let n = 0; Math.random = () => (n++ % 7 === 0 ? 0 : r()); // força a sorte do Tomo de vez em quando
for (let i = 0; i < 400; i++) {
  j.prog.mochila.fill(null);
  s.soltarDrops({ x: 0, z: 0, tipo: 'lobo', nivel: 5 }, j);
  for (const it of j.prog.mochila) if (it?.k === 'tomo') viu.add(it.nv);
}
Math.random = r;
console.log('níveis vistos', [...viu].sort((a, b) => a - b).join(','));
ok([...viu].every((v) => v >= 6 && v <= 10), 'só Tomo do VI ao X');
ok(viu.size >= 3, 'cai Tomo VII, VIII... e não só o VI');
// ataque básico (André 2026-11-07): estava travado no Nv 1; sobe do 1 ao 5 só usando, sem livro
const b = new Simulacao(MAPA_CLAREIRA), jb = b.adicionarJogador('B', 'Bia');
jb.criando = false; jb.morto = false;
for (let i = 0; i < 2000 && (jb.prog.habs.espada_basico?.nv || 1) < 5; i++) { jb.trava = 0; jb.cds = {}; b.usarHabQ('B', 'espada_basico'); b.passo?.(0.05); }
ok((jb.prog.habs.espada_basico?.nv || 1) === 5, 'ataque de espada chega ao Nv 5 usando');
// faixa de "Parabéns!" (André 2026-11-07): ao aprender com o Tomo o servidor manda o evento 'tomo'
{
  const t = new Simulacao(MAPA_CLAREIRA), jt = t.adicionarJogador('P', 'Pia');
  jt.criando = false; jt.morto = false;
  jt.prog.habs.corte_duplo = { nv: 6, uso: 999 };
  jt.prog.mochila[0] = { k: 'tomo', h: 'corte_duplo', nv: 7, n: 1 };
  const evs = []; const ev0 = t.evento.bind(t); t.evento = (e) => { evs.push(e); return ev0(e); };
  t.item('P', { acao: 'usar', i: 0 });
  ok(jt.prog.habs.corte_duplo.nv === 7 && evs.some((e) => e.t === 'tomo' && e.para === jt.id && e.h === 'corte_duplo' && e.nv === 7), 'aprender manda o evento da faixa de Parabéns');
}
