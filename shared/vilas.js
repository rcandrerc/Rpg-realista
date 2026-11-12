// Mini vilas do mundo grande (história v2, Entrega 3; André 2026-11-11, esboço aprovado:
// /mnt/project-files/historia/mini-vilas-v2.jpg). Os dados de cada vila (onde fica, quem mora, que casas tem) estão em
// shared/dados.js (VILAS_MUNDO). Aqui só a conta que arruma as casas em volta da praça, igual no servidor e no app:
// cada casa olha para a praça (o totem fica no meio), longe da estrada, do rio, do mar, dos campos e das outras casas,
// em chão que o alicerce de pedra cobre (a casa fica na altura do canto mais alto e o alicerce desce 2,4 m). Nada do
// terreno muda: as casas assentam no chão como ele é. As árvores que caíam dentro da vila vão para fora da borda
// (não somem: só mudam de lugar, como nas arenas dos bosses).

// tamanho de cada modelo (godot-prototipo/vilas3d/vilas.glb, ferramentas/vilas/pecas.mjs): w = frente (x), d = fundo
// (z), alto = do chão até o beiral, sobe = do beiral até a cumeeira; r = raio sólido dos enfeites
export const MODELOS_VILA = {
  casa_4x4: { w: 4, d: 4, alto: 3, sobe: 3.6 }, casa_4x6: { w: 4, d: 6, alto: 3, sobe: 3.6 }, casa_6x6: { w: 6, d: 6, alto: 3, sobe: 4.8 },
  pedra_4x6: { w: 4, d: 6, alto: 3, sobe: 3.6 }, pedra_6x6: { w: 6, d: 6, alto: 3, sobe: 4.8 }, comercio: { w: 6, d: 10, alto: 3, sobe: 4.8 },
  forja: { w: 4, d: 4, aberta: true },
  // Aurora viva (pedra branca, telhado de ardósia; ferramentas/vilas/pecas.mjs CIDADE_AURORA). porta = x da porta na frente
  aurora_casa: { w: 4, d: 6, alto: 3, sobe: 3.6, porta: 1 }, aurora_sobrado: { w: 4, d: 4, alto: 6, sobe: 3.6, porta: 1 },
  aurora_sobrado2: { w: 4, d: 4, alto: 6, sobe: 3.6, porta: -1 }, aurora_pousada: { w: 8, d: 12, alto: 6, sobe: 6, porta: -1 },
  aurora_templo: { w: 8, d: 12, alto: 6, sobe: 6, porta: 0 }, aurora_paco: { w: 8, d: 14, alto: 6, sobe: 6, porta: 0 },
  aurora_torre: { w: 4, d: 4, alto: 9, sobe: 0, porta: -1, longe: true }, aurora_portao: { w: 10, d: 2, portao: true, porta: 0 },
  aurora_fonte: { r: 2.6, alto: 0.85 },
  banca: { r: 1.0, alto: 2.6 }, banca_carroca: { r: 1.3, alto: 2.6 }, barris: { r: 0.85, alto: 0.9 }, barril: { r: 0.4, alto: 0.9 },
  caixotes: { r: 1.0, alto: 1.8 }, banco: { r: 0.6, alto: 0.53 }, mesa: { r: 1.45, alto: 0.81 }, estandarte: { r: 0.18 },
  carroca: { r: 1.0 }, bigorna_enfeite: { r: 0.6, alto: 0.6 }, armas: { r: 0.7, alto: 1.1 }, fogueira: { r: 0.8, alto: 0.4 },
};
const ALICERCE = 2.3; // o alicerce de pedra cobre até isso de diferença entre o canto mais alto e o mais baixo

// distância do ponto (x, z) até o retângulo girado R ({ x, z, ry, w, d }), 0 dentro
function distRet(R, x, z) {
  const dx = x - R.x, dz = z - R.z, c = Math.cos(R.ry), s = Math.sin(R.ry);
  const lx = dx * c - dz * s, lz = dx * s + dz * c; // mundo -> casa (giro em Y)
  const ex = Math.max(0, Math.abs(lx) - R.w / 2), ez = Math.max(0, Math.abs(lz) - R.d / 2);
  return Math.hypot(ex, ez);
}
// cantos do retângulo (com folga f)
function cantos(R, f = 0) {
  const c = Math.cos(R.ry), s = Math.sin(R.ry), out = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const lx = a * (R.w / 2 + f), lz = b * (R.d / 2 + f);
    out.push([R.x + lx * c + lz * s, R.z - lx * s + lz * c]);
  }
  return out;
}
// distância do retângulo até uma linha de pontos (estrada ou rio), com pontos no meio de cada trecho
function distLinha(R, L) {
  let md = Infinity;
  for (let i = 0; i < L.length; i++) {
    const [x, z] = L[i];
    if (Math.abs(x - R.x) > 60 || Math.abs(z - R.z) > 60) continue;
    md = Math.min(md, distRet(R, x, z));
    if (i + 1 < L.length) { const [x2, z2] = L[i + 1], n = Math.ceil(Math.hypot(x2 - x, z2 - z) / 1.5); for (let k = 1; k < n; k++) md = Math.min(md, distRet(R, x + (x2 - x) * k / n, z + (z2 - z) * k / n)); }
  }
  return md;
}

// Arruma uma vila. V: { id, x, z (meio da praça, onde fica o totem), itens: [modelo, ...] (casas e ferraria, na ordem de
// importância), banca: true (a banca da loja na praça), enfeites: [[modelo, perto de quê], ...], rMax }.
// amb: { G, alturaMundo, terraEm, mar, estradas: [[x, z]...][], rios: [[x, z]...][], evitar: [{x, z, r}], areas: [{x, z, r}] (só
// enfeite e banca, nada de casa: terrenos dos jogadores) }. Devolve { casas: [{ m, x, z, ry, y }], banca, enfeites, raio }.
export function arrumarVila(V, amb) {
  const { G, alturaMundo, terraEm, mar } = amb;
  const chao = (x, z) => alturaMundo(G, x, z);
  const postos = []; // retângulos já ocupados (com folga)
  const casas = [];
  const livre = (R, folgaEstrada = 3.2, casa = true) => {
    for (const [x, z] of cantos(R, 0.9)) {
      if (!terraEm(G, x, z) || chao(x, z) < mar + 0.7) return false;
      if (Math.hypot(x - V.x, z - V.z) < 4.2) return false; // o totem e a volta dele
      for (const e of amb.evitar) if (Math.hypot(x - e.x, z - e.z) < e.r) return false;
      if (casa) for (const a of amb.areas || []) if (Math.hypot(x - a.x, z - a.z) < a.r) return false;
    }
    for (const L of amb.estradas) if (distLinha(R, L) < folgaEstrada) return false;
    for (const L of amb.rios) if (distLinha(R, L) < 8) return false;
    for (const P of postos) { // as outras casas: nenhum canto dentro, com 1,6 m de corredor
      const ok = cantos(R, 0).every(([x, z]) => distRet(P, x, z) > 1.6) && cantos(P, 0).every(([x, z]) => distRet(R, x, z) > 1.6);
      if (!ok) return false;
    }
    const hs = cantos(R, 0.3).map(([x, z]) => chao(x, z));
    return Math.max(...hs) - Math.min(...hs) <= ALICERCE;
  };
  const altura = (R) => +Math.max(...cantos(R, 0.3).map(([x, z]) => chao(x, z))).toFixed(2);
  // as casas: na volta da praça, cada uma o mais perto que der, espalhadas (longe das que já entraram)
  for (const m of V.itens || []) {
    const M = MODELOS_VILA[m];
    let melhor = null, nota = Infinity;
    for (let a = 0; a < 360; a += 6) {
      const ang = (a + (V.giro || 0)) * Math.PI / 180;
      for (let rr = 9 + M.d / 2; rr <= (V.rMax || 26); rr += 1) {
        const x = V.x + Math.sin(ang) * rr, z = V.z + Math.cos(ang) * rr;
        const R = { x, z, ry: Math.atan2(V.x - x, V.z - z), w: M.w, d: M.d };
        if (!livre(R)) continue;
        // perto da praça, e longe (no ângulo) das casas que já estão
        let cheio = 0;
        for (const c of casas) { const da = Math.abs(((Math.atan2(c.x - V.x, c.z - V.z) - ang) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); cheio += Math.max(0, 1.2 - da) * 14; }
        const n = rr + cheio;
        if (n < nota) { nota = n; melhor = R; }
        break; // nesse ângulo, o mais perto que deu
      }
    }
    if (!melhor) continue; // não coube: a vila fica com uma casa a menos (o teste avisa)
    postos.push(melhor);
    casas.push({ m, x: +melhor.x.toFixed(2), z: +melhor.z.toFixed(2), ry: +melhor.ry.toFixed(4), y: altura(melhor) });
  }
  // a banca da loja: na beira da praça, virada para o totem, num lado sem casa
  let banca = null;
  if (V.banca) {
    let nota = Infinity;
    for (let a = 0; a < 360; a += 10) {
      const ang = a * Math.PI / 180;
      for (const rr of [7, 8, 9, 10]) {
        const x = V.x + Math.sin(ang) * rr, z = V.z + Math.cos(ang) * rr, R = { x, z, ry: Math.atan2(V.x - x, V.z - z), w: 2.2, d: 3.4 };
        if (!livre(R, 2.6, false)) continue;
        let n = rr;
        for (const c of casas) n -= Math.min(12, Math.hypot(c.x - x, c.z - z)) * 0.6; // longe das casas
        if (n < nota) { nota = n; banca = R; }
        break;
      }
    }
    if (banca) postos.push({ ...banca });
  }
  // enfeites: ao lado de uma casa (barris, caixotes) ou na praça (estandarte, mesa, fogueira)
  const enfeites = [];
  let k = 0;
  for (const [m, onde] of V.enfeites || []) {
    const M = MODELOS_VILA[m], r = M.r || 0.6;
    const tentar = [];
    if (onde === 'praca') for (let a = 0; a < 360; a += 15) for (const rr of [5.5, 6.5, 8, 10]) { const ang = (a + k * 47) * Math.PI / 180; tentar.push([V.x + Math.sin(ang) * rr, V.z + Math.cos(ang) * rr, ang + Math.PI]); }
    else for (const c of casas.slice(k % Math.max(1, casas.length)).concat(casas)) { // do lado da casa, perto da frente
      const D = MODELOS_VILA[c.m], cs = Math.cos(c.ry), sn = Math.sin(c.ry);
      for (const [lx, lz] of [[D.w / 2 + 0.9 + r, D.d / 2 - 0.9], [-(D.w / 2 + 0.9 + r), D.d / 2 - 0.9], [D.w / 2 + 0.9 + r, -D.d / 4], [-(D.w / 2 + 0.9 + r), -D.d / 4]])
        tentar.push([c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs, c.ry]);
    }
    for (const [x, z, ry] of tentar) {
      const R = { x, z, ry, w: r * 2, d: r * 2 };
      if (!livre(R, 2.4, false)) continue;
      postos.push(R);
      enfeites.push({ m, x: +x.toFixed(2), z: +z.toFixed(2), ry: +(ry + (k * 0.7) % 1 - 0.5).toFixed(3), y: +Math.min(...cantos(R, 0).map(([a, b]) => chao(a, b))).toFixed(2) });
      break;
    }
    k++;
  }
  let raio = 10;
  for (const P of postos) raio = Math.max(raio, Math.hypot(P.x - V.x, P.z - V.z) + Math.hypot(P.w, P.d) / 2);
  const baixo = (R) => +Math.min(...cantos(R, 0).map(([x, z]) => chao(x, z))).toFixed(2);
  return { casas, banca: banca && { x: +banca.x.toFixed(2), z: +banca.z.toFixed(2), ry: +banca.ry.toFixed(4), y: baixo(banca) }, enfeites, raio: +raio.toFixed(1), postos };
}

// ponto (lx, lz) do espaço de uma peça (casa, ferraria, banca: { x, z, ry }) no mundo
export const naPeca = (P, lx, lz) => [+(P.x + lx * Math.cos(P.ry) + lz * Math.sin(P.ry)).toFixed(2), +(P.z - lx * Math.sin(P.ry) + lz * Math.cos(P.ry)).toFixed(2)];
// lugar livre na vila para um NPC (perto de (x, z), fora das casas e dos enfeites): o primeiro ponto livre em volta
export function lugarNaVila(A, x, z, folga = 0.9) {
  for (let rr = 0; rr <= 6; rr += 0.5) for (let a = 0; a < 360; a += 30) {
    const px = x + Math.sin(a * Math.PI / 180) * rr, pz = z + Math.cos(a * Math.PI / 180) * rr;
    if (A.postos.every((P) => distRet(P, px, pz) > folga)) return [+px.toFixed(2), +pz.toFixed(2)];
  }
  return [x, z];
}

// Aurora viva (André 2026-11-12, esboço aprovado): as peças da cidade de pedra branca ficam no lugar do esboço (C.pecas),
// assentadas no chão como ele é (a casa na altura do canto mais alto; o alicerce cobre até ALICERCE). Ruas e praça de
// calçada branca: as ruas seguem as estradas que já existem (C.ruas: [id da estrada, filtro dos pontos]) ou uma linha
// nova ([[x, z], [x, z]]). Devolve { pecas, ruas: [[[x, z, y]...]...], praca: { x, z, r, y }, pisos: retângulos do
// calçamento (chão de andar), postos: retângulos das peças (para os NPCs não nascerem dentro) }.
export const CALCADA = { largura: 4.4, sobe: 0.04, sobePraca: 0.06 };
export function arrumarCidade(C, amb) {
  const { G, alturaMundo } = amb, chao = (x, z) => alturaMundo(G, x, z);
  const pecas = [], postos = [];
  for (const P of C.pecas) {
    const M = MODELOS_VILA[P.m];
    const ry = P.olha ? Math.atan2(C.praca.x - P.x, C.praca.z - P.z) : P.ry;
    const R = M.r != null && M.w == null ? { x: P.x, z: P.z, ry, w: 2 * M.r, d: 2 * M.r } : { x: P.x, z: P.z, ry, w: M.w, d: M.d };
    const hs = cantos(R, 0.3).map(([x, z]) => chao(x, z));
    pecas.push({ m: P.m, n: P.n, x: P.x, z: P.z, ry: +ry.toFixed(4), y: +Math.max(...hs).toFixed(2), desnivel: +(Math.max(...hs) - Math.min(...hs)).toFixed(2) });
    postos.push(R);
  }
  // ruas: pontos de ~2 m (a estrada já vem assim), sem os que caem dentro da praça (a praça cobre o encontro)
  const ruas = [];
  for (const def of C.ruas) {
    let pts;
    if (typeof def[0] === 'string') { const E = amb.estradasPorId[def[0]]; pts = E.filter(([x, z]) => def[1](x, z)); }
    else { pts = []; const [[x0, z0], [x1, z1]] = def, n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2); for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); }
    pts = pts.filter(([x, z]) => Math.hypot(x - C.praca.x, z - C.praca.z) > C.praca.r - 1.6);
    if (pts.length > 1) ruas.push(pts.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2), +chao(x, z).toFixed(2)]));
  }
  const praca = { ...C.praca, y: +chao(C.praca.x, C.praca.z).toFixed(2) };
  // o chão de andar do calçamento: faixas de 2 m na praça e trechos de ~4 m nas ruas
  const pisos = [];
  for (let t = -C.praca.r + 1; t < C.praca.r; t += 2) pisos.push({ x: C.praca.x, z: C.praca.z + t, ry: 0, hw: +Math.sqrt(C.praca.r ** 2 - t * t).toFixed(2), hd: 1.05, y1: +(praca.y + CALCADA.sobePraca).toFixed(2) });
  for (const L of ruas) for (let i = 0; i + 1 < L.length; i += 2) {
    const a = L[i], b = L[Math.min(i + 2, L.length - 1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    pisos.push({ x: +((a[0] + b[0]) / 2).toFixed(2), z: +((a[1] + b[1]) / 2).toFixed(2), ry: +Math.atan2(b[0] - a[0], b[1] - a[1]).toFixed(4), hw: CALCADA.largura / 2, hd: +(len / 2 + 0.3).toFixed(2), y1: +(Math.max(a[2], b[2]) + CALCADA.sobe).toFixed(2) });
  }
  return { pecas, ruas, praca, pisos, postos };
}
// distância do ponto às ruas da cidade (para tirar as árvores de cima)
export function distRuas(ruas, x, z) {
  let md = Infinity;
  for (const L of ruas) for (let i = 0; i + 1 < L.length; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    md = Math.min(md, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return md;
}
export { distRet };
