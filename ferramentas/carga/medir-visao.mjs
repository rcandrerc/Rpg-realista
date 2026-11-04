// Mede quanto o servidor manda por jogador com e sem a área de interesse (server/visao.js), e quanto custa por passo.
// Uso: node ferramentas/carga/medir-visao.mjs [jogadores=200]
// Os jogadores ficam espalhados: metade na vila, metade nos campos de caça (o pior caso realista).
import { Simulacao, MAPA_CLAREIRA } from '@rpg/shared';
import { Visao } from '../../server/visao.js';

const N = Number(process.argv[2] || 200);
const sim = new Simulacao(MAPA_CLAREIRA);
const cacas = MAPA_CLAREIRA.caca || [];
for (let i = 0; i < N; i++) {
  const id = 'j' + i;
  sim.adicionarJogador(id, 'Teste ' + i, 'ruiva', {});
  const j = sim.jogadores.get(id);
  if (i % 2 === 0 || !cacas.length) { j.x = (Math.random() - 0.5) * 30; j.z = (Math.random() - 0.5) * 30; }
  else { const c = cacas[i % cacas.length]; j.x = c.x + (Math.random() - 0.5) * 10; j.z = c.z + (Math.random() - 0.5) * 10; }
}
const visao = new Visao();
const PASSOS = 100;
let antes = 0, depois = 0, tSim = 0, tAntes = 0, tDepois = 0;
for (let p = 0; p < PASSOS; p++) {
  // todo mundo andando (o pior caso: posição muda em toda foto)
  for (const j of sim.jogadores.values()) { j.x += (Math.random() - 0.5) * 0.5; j.z += (Math.random() - 0.5) * 0.5; j.ry = Math.random() * 6; }
  let t = performance.now();
  const eventos = sim.passo(1 / 20);
  const foto = sim.foto();
  tSim += performance.now() - t;
  t = performance.now();
  const fj = JSON.stringify(foto);
  for (let i = 0; i < N; i++) {
    const meus = eventos.filter((e) => !e.para || e.para === 'j' + i);
    antes += `{"foto":${fj},"eventos":${JSON.stringify(meus)}}`.length;
  }
  tAntes += performance.now() - t;
  t = performance.now();
  const ctx = visao.preparar(foto, eventos);
  for (let i = 0; i < N; i++) depois += visao.paraJogador(ctx, 'j' + i).length;
  tDepois += performance.now() - t;
}
const kb = (b) => (b / N / PASSOS / 1024).toFixed(1) + ' KB';
const mbit = (b) => ((b / N / PASSOS) * 20 * 8 / 1e6).toFixed(2) + ' Mbit/s';
console.log(`${N} jogadores, ${sim.inimigos.length} monstros, ${PASSOS} passos`);
console.log(`simulação: ${(tSim / PASSOS).toFixed(2)} ms por passo`);
console.log(`ANTES  (tudo para todos): ${kb(antes)} por foto por jogador, ${mbit(antes)} por jogador, montar ${(tAntes / PASSOS).toFixed(2)} ms/passo`);
console.log(`DEPOIS (só o que está perto): ${kb(depois)} por foto por jogador, ${mbit(depois)} por jogador, montar ${(tDepois / PASSOS).toFixed(2)} ms/passo`);
console.log(`total que sai do servidor: antes ${((antes / PASSOS) * 20 * 8 / 1e6).toFixed(0)} Mbit/s, depois ${((depois / PASSOS) * 20 * 8 / 1e6).toFixed(1)} Mbit/s`);
