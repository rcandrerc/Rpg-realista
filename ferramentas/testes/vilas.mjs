// FASE 3, Parte 7b (André 2026-11-08): vilas com no máximo 5 terrenos (Porto de Vael, Nv 50) e Aurora (Nv 100) em
// 4 bairros de 5 terrenos, a 60-80 m um do outro. Cada vila cabe os 5 terrenos no chão plano, fora das estradas, e a
// 6ª compra na mesma vila é recusada. Uso: node ferramentas/testes/vilas.mjs
import { Simulacao, MAPA_CLAREIRA, motivoTerreno, VILAS_TERRENO, vilaEm, chaoDaVila } from '../../shared/index.js';
import { relevo } from '../../shared/relevo.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const mundo = VILAS_TERRENO.filter((V) => V.mundo), bairros = mundo.filter((V) => V.bairro);
ok(mundo.length >= 5 && bairros.length >= 4 && bairros.length * 5 >= 20, `${mundo.length} vilas no mundo grande, ${bairros.length} bairros em Aurora (${bairros.length * 5} terrenos)`);
for (const a of bairros) {
  const d = Math.min(...bairros.filter((b) => b !== a).map((b) => Math.hypot(a.area.x - b.area.x, a.area.z - b.area.z)));
  ok(d >= 60 && d <= 80, `${a.nome}: vizinho a ${d.toFixed(0)} m`);
}
// 5 terrenos de 12 x 12 cabem em cada vila (procura gulosa), no plano
const s = new Simulacao(MAPA_CLAREIRA);
for (const V of mundo) {
  const achados = [];
  for (let z = Math.round(V.area.z - V.area.rz); z < V.area.z + V.area.rz && achados.length < 5; z++)
    for (let x = Math.round(V.area.x - V.area.rx); x < V.area.x + V.area.rx && achados.length < 5; x++) {
      const R = { x0: x, z0: z, x1: x + 12, z1: z + 12 };
      if (!motivoTerreno(R, achados)) achados.push(R);
    }
  ok(achados.length === 5, `${V.nome}: cabem ${achados.length} terrenos de 12 x 12`);
  let alt = [Infinity, -Infinity];
  for (const R of achados) for (let x = R.x0; x <= R.x1; x += 2) for (let z = R.z0; z <= R.z1; z += 2) { const h = relevo(x, z); alt = [Math.min(alt[0], h), Math.max(alt[1], h)]; }
  ok(alt[0] > 0.5 && alt[1] - alt[0] < 0.6, `${V.nome}: terrenos no plano (de ${alt[0].toFixed(2)} a ${alt[1].toFixed(2)} m)`);
  ok(Math.abs(chaoDaVila(achados[0].x0 + 3, achados[0].z0 + 3) - relevo(achados[0].x0 + 3, achados[0].z0 + 3)) < 0.01, `${V.nome}: a casa fica no chão do platô`);
  // 5 compram, o 6º não
  const avisos = () => { const e = s.eventos; s.eventos = []; return e.filter((q) => q.t === 'aviso').map((q) => q.texto).join(' | '); };
  let comprados = 0, recusa = '';
  for (let i = 0; i < 6; i++) {
    const id = `${V.id}_${i}`, j = s.adicionarJogador(id, 'J' + i, undefined, { conta: id });
    const R = i < 5 ? achados[i] || null : null;
    j.criando = false; j.prog.ouro = 99999;
    if (i < 5) { if (!R) continue; j.x = R.x0 - 2; j.z = R.z0; s.comprarLote(id, R); avisos(); if (s.loteDe(j)) comprados++; }
    else {
      // o 6º tenta um pedaço que sobrou (sem encostar nos outros)
      let livre = null;
      for (let z = Math.round(V.area.z - V.area.rz); z < V.area.z + V.area.rz && !livre; z++) for (let x = Math.round(V.area.x - V.area.rx); x < V.area.x + V.area.rx && !livre; x++) { const Q = { x0: x, z0: z, x1: x + 6, z1: z + 6 }; if (!motivoTerreno(Q, achados.slice(0, 5))) livre = Q; }
      if (livre) { j.x = livre.x0; j.z = livre.z0; s.comprarLote(id, livre); recusa = avisos(); ok(!s.loteDe(j) && /já tem 5 terrenos/.test(recusa), `${V.nome}: o 6º terreno é recusado (${recusa})`); }
      else ok(true, `${V.nome}: não sobra chão para um 6º terreno`);
    }
  }
  ok(comprados === 5, `${V.nome}: ${comprados} terrenos comprados`);
}
ok(vilaEm(-13.5, 88)?.id === 'terras', 'as Terras da Estrada continuam sendo a vila de terrenos do começo');
ok(chaoDaVila(-13.5, 88) === 0, 'no mapa de hoje o chão das casas continua 0');

// cais de madeira em cada porto: o tablado sai da praia e chega na água funda, e o herói anda por cima dele
import { noLago } from '../../shared/relevo.js';
for (const C of MAPA_CLAREIRA.cais) {
  const dx = Math.sin(C.ry), dz = Math.cos(C.ry), ponta = (t) => [C.x + dx * t * C.d / 2, C.z + dz * t * C.d / 2];
  const [xi, zi] = ponta(-0.95), [xf, zf] = ponta(0.95);
  ok(relevo(xi, zi) > -0.3 && relevo(xf, zf) < -1.5, `${C.nome}: sai da praia (${relevo(xi, zi).toFixed(2)} m) e chega no fundo (${relevo(xf, zf).toFixed(2)} m)`);
  ok(Math.abs(s.terreno.altura(xf, zf, 1) - C.y1) < 0.01 && noLago(xf, zf), `${C.nome}: o chão na ponta é o tablado (${s.terreno.altura(xf, zf, 1).toFixed(2)} m), em cima do mar`);
  const id = 'cais_' + C.id, j = s.adicionarJogador(id, 'Cais', undefined, { conta: id });
  j.criando = false; j.x = xf; j.z = zf; j.y = C.y1; j.orc = 10; j.orcT = s.tempo;
  ok(s.posicaoCliente(id, { x: xf + dx * 0.3, y: C.y1, z: zf + dz * 0.3, ry: 0 }) !== false, `${C.nome}: o servidor aceita o herói em pé na ponta`);
}
