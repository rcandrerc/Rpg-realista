// Teste dos totens de teleporte (André 2026-11-10): descobrir passando perto, ir de um para outro pagando a taxa,
// renascer no último tocado, área segura (monstro não bate) e o progresso guardando tudo. Uso: node ferramentas/testes/totens.mjs
import { Simulacao, MAPA_CLAREIRA, TOTENS, taxaTotem, HEROI } from '../../shared/index.js';
import { progressoValido } from '../../shared/progresso.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
const T = (id) => TOTENS.lista.find((t) => t.id === id);
const correr = (seg) => { const ev = []; for (let t = 0; t < seg / 0.05; t++) ev.push(...s.passo(0.05)); return ev; };
const avisos = (ev) => ev.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto).join(' | ');
ok(TOTENS.lista.length === 7, '7 totens');
ok(taxaTotem(T('clareira')) === 50 && taxaTotem(T('rio_claro')) === 350 && taxaTotem(T('aurora')) === 1000, 'taxas da proposta');
// todos em terra firme, fora dos campos de caça e sem árvore em cima
for (const t of TOTENS.lista) {
  ok(MAPA_CLAREIRA.mata.every((a) => Math.hypot(a.x - t.x, a.z - t.z) > TOTENS.raio + 1), `${t.id}: nenhuma árvore em cima`);
  ok(s.mapa.inimigos.every((sp) => Math.hypot(sp.x - t.x, sp.z - t.z) > TOTENS.seguro + 8), `${t.id}: longe dos monstros`);
}
// passa perto do totem da vila: descobre
const C = T('clareira');
Object.assign(j, { x: C.x + 6, z: C.z, y: s.terreno.altura(C.x + 6, C.z) });
let ev = correr(0.2);
ok(j.prog.totens?.includes('clareira') && j.prog.totem === 'clareira', 'descobriu o totem da vila passando a 6 m: ' + avisos(ev));
j.x = C.x + 3; // do lado da pedra
correr(0.1);
// não visitou o Rio Claro: não vai
s.irTotem('A', 'rio_claro'); ev = correr(0.1);
ok(/ainda não visitou/.test(avisos(ev)), 'não descoberto não vai');
// descoberto, sem ouro: não vai
j.prog.totens.push('rio_claro'); j.prog.ouro = 100;
s.irTotem('A', 'rio_claro'); ev = correr(0.1);
ok(/Faltam 250 de ouro/.test(avisos(ev)), 'sem ouro não vai');
// com ouro: canaliza e chega, paga 350
j.prog.ouro = 1000;
s.irTotem('A', 'rio_claro'); ev = correr(TOTENS.canal + 0.3);
const R = T('rio_claro');
ok(Math.hypot(j.x - R.x, j.z - R.z) < 5 && j.prog.ouro === 650 && j.prog.totem === 'rio_claro', `chegou no Rio Claro e pagou: ${j.prog.ouro} | ` + avisos(ev));
ok(ev.some((e) => e.t === 'vila' && e.fase === 'chegou' && e.totem === 'rio_claro'), 'evento de chegada para o app');
// andar cancela
Object.assign(j, { x: R.x + 3, z: R.z });
s.irTotem('A', 'clareira'); correr(1); j.x += 2; ev = correr(TOTENS.canal);
ok(Math.hypot(j.x - R.x, j.z - R.z) < 6 && j.prog.ouro === 650, 'andou: cancelou sem cobrar | ' + avisos(ev));
// área segura: monstro do lado não bate
const b = s.inimigos.find((e) => !e.morto);
Object.assign(j, { x: R.x + 3, z: R.z, y: s.terreno.altura(R.x + 2, R.z), vida: j.vidaMax });
Object.assign(b, { x: R.x + 4, z: R.z, y: j.y, casa: { x: R.x + 4, z: R.z } });
correr(5);
ok(j.vida === j.vidaMax, 'monstro não bate na área segura');
// renasce no último totem tocado (Rio Claro), não na vila
Object.assign(j, { x: 0, z: 1, y: 0 });
s.morrer(j); correr(HEROI.renascer + 0.5);
ok(!j.morto && Math.hypot(j.x - R.x, j.z - R.z) < 5, `renasceu no Rio Claro (${j.x.toFixed(1)}, ${j.z.toFixed(1)})`);
// o progresso guarda (e limpa id que não existe)
const p = progressoValido({ ...j.prog, totens: ['clareira', 'rio_claro', 'nada'], totem: 'rio_claro' });
ok(p.totens.join() === 'clareira,rio_claro' && p.totem === 'rio_claro', 'progresso guarda os totens');
