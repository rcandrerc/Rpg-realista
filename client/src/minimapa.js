// Desenho do mapa do jogo visto de cima (pedido do André 2026-11-03: minimapa no canto e mapa completo ao tocar).
// Pintado num canvas a partir dos mesmos dados do servidor (shared/dados.js): mata, campos, estrada, trilhas, casas,
// pedras e as clareiras de caça. Os nomes e o herói ficam por cima no app (godot-prototipo/minimapa.gd), nítidos.
// O gerar-modelos.mjs grava o resultado em godot-prototipo/modelos/minimapa.png.
import { formasDoMapa, dentroDoMapa, raioNaDirecao } from '../../shared/mapa.js';
import { alturaMontanha, noLago, GRADE_MONTANHA, MONTANHA } from '../../shared/relevo.js';

export function desenharMinimapa(mapa) {
  const M = mapa.minimapa, T = M.px, k = T / M.tam;
  const cv = document.createElement('canvas'); cv.width = cv.height = T;
  const g = cv.getContext('2d');
  const P = (x, z) => [(x - M.x0) * k, (z - M.z0) * k];
  let sem = 77; const rnd = (a, b) => { sem = (sem * 16807) % 2147483647; return a + (sem / 2147483647) * (b - a); };
  const F = formasDoMapa(mapa);

  // fundo: copa fechada da floresta (onde não se anda)
  g.fillStyle = '#1d3522'; g.fillRect(0, 0, T, T);
  for (let i = 0; i < 2600; i++) {
    const [x, y] = [rnd(0, T), rnd(0, T)], r = rnd(4, 11) * k / 3.4;
    g.fillStyle = `hsl(${rnd(118, 135)}, ${rnd(28, 40)}%, ${rnd(12, 20)}%)`;
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  // chão onde se anda: campo (vila e campo de fora) e chão de mata, com borda macia
  const chao = (mata, cor) => {
    g.save(); g.filter = 'blur(2px)'; g.fillStyle = cor; g.beginPath();
    for (const a of F.areas) {
      if (!!a.mata !== mata) continue;
      for (let i = 0; i <= 72; i++) { const ang = i / 72 * 6.283, r = raioNaDirecao(a, ang), [x, y] = P(a.x + Math.cos(ang) * r, a.z + Math.sin(ang) * r); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath();
    }
    g.fill();
    if (mata) for (const c of F.corredores) {
      if (!c.mata) continue;
      g.lineWidth = c.larg * k; g.lineCap = 'round'; g.strokeStyle = cor; g.beginPath(); g.moveTo(...P(...c.a)); g.lineTo(...P(...c.b)); g.stroke();
    }
    g.restore();
  };
  chao(true, '#3f6a36');
  chao(false, '#6c9a4a');
  for (const c of F.corredores) if (!c.mata) { g.lineWidth = c.larg * k; g.lineCap = 'round'; g.strokeStyle = '#6c9a4a'; g.beginPath(); g.moveTo(...P(...c.a)); g.lineTo(...P(...c.b)); g.stroke(); }
  // clareiras de caça: campo aberto, mais claro
  for (const c of mapa.caca || []) {
    const [x, y] = P(c.x, c.z), gr = g.createRadialGradient(x, y, c.r * k * 0.6, x, y, c.r * k * 1.15);
    gr.addColorStop(0, '#8dbb5a'); gr.addColorStop(1, 'rgba(141,187,90,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, c.r * k * 1.15, 0, 6.283); g.fill();
  }
  // relevo (2026-11-05): a montanha com sombra de encosta (luz do noroeste) e os lagos, raso claro e fundo escuro
  {
    const G = GRADE_MONTANHA, x0 = G.x0, z0 = G.z0, lado = (G.n - 1) * G.passo;
    const [ia, ja] = P(x0, z0).map(Math.floor), [ib, jb] = P(x0 + lado, z0 + lado).map(Math.ceil);
    const i0 = Math.max(0, ia), j0 = Math.max(0, ja), i1 = Math.min(T, ib), j1 = Math.min(T, jb);
    if (i1 > i0 && j1 > j0) {
      const img = g.getImageData(i0, j0, i1 - i0, j1 - j0), d = img.data, e = 1 / k;
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const x = M.x0 + (i + 0.5) / k, z = M.z0 + (j + 0.5) / k, h = alturaMontanha(x, z);
        if (h <= 0.05) continue;
        const gx = (alturaMontanha(x + e, z) - alturaMontanha(x - e, z)) / (2 * e), gz = (alturaMontanha(x, z + e) - alturaMontanha(x, z - e)) / (2 * e);
        const luz = Math.max(0.55, Math.min(1.2, 0.9 + (gx + gz) * -0.3)), incl = Math.min(1, Math.hypot(gx, gz)), hk = h / MONTANHA.alto;
        const base = incl > 0.45 ? [128, 120, 106] : [104 + hk * 60, 128 + hk * 30, 80 + hk * 40];
        const a = Math.min(1, h / 1.2), o = ((j - j0) * (i1 - i0) + (i - i0)) * 4;
        for (let c = 0; c < 3; c++) d[o + c] = d[o + c] * (1 - a) + Math.min(255, base[c] * luz) * a;
      }
      g.putImageData(img, i0, j0);
    }
    for (const L of mapa.lagos || []) {
      const R = Math.max(L.rx, L.rz) * 1.3, [ia2, ja2] = P(L.x - R, L.z - R).map(Math.floor), [ib2, jb2] = P(L.x + R, L.z + R).map(Math.ceil);
      const img = g.getImageData(ia2, ja2, ib2 - ia2, jb2 - ja2), d = img.data;
      for (let j = ja2; j < jb2; j++) for (let i = ia2; i < ib2; i++) {
        const q = noLago(M.x0 + (i + 0.5) / k, M.z0 + (j + 0.5) / k); if (!q) continue;
        const t = Math.min(1, q.fundo / 2.5), o = ((j - ja2) * (ib2 - ia2) + (i - ia2)) * 4;
        const c = q.d > 0.9 ? [214, 236, 240] : [96 - t * 60, 178 - t * 80, 196 - t * 30];
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
      }
      g.putImageData(img, ia2, ja2);
    }
  }
  // pedras do anel (vila e campo de fora): pontinhos cinza na borda
  F.areas.forEach((a, i) => {
    if (a.mata) return;
    const R = a.rx != null ? Math.max(a.rx, a.rz) : a.r;
    for (let ang = 0; ang < 6.283; ang += 3.6 / R) {
      const r = raioNaDirecao(a, ang) + 1.6, x = a.x + Math.cos(ang) * r, z = a.z + Math.sin(ang) * r;
      if (F.areas.some((o, j) => j !== i && Math.hypot(x - o.x, z - o.z) < raioNaDirecao(o, Math.atan2(z - o.z, x - o.x)) + 1.5)) continue;
      if (dentroDoMapa({ areas: [], corredores: F.corredores.map((c) => ({ ...c, larg: c.larg + 3 })) }, x, z)) continue;
      const [px, py] = P(x, z); g.fillStyle = '#8b8a80'; g.beginPath(); g.arc(px, py, rnd(1.6, 2.6) * k / 1.7, 0, 6.283); g.fill();
      g.fillStyle = '#b3b1a4'; g.beginPath(); g.arc(px - 0.6, py - 0.6, rnd(0.8, 1.3) * k / 1.7, 0, 6.283); g.fill();
    }
  });
  // estrada, trilhas e praça
  const linha = (pts, larg, cor) => { g.lineWidth = larg; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = cor; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...P(...p)) : g.moveTo(...P(...p)))); g.stroke(); };
  for (const c of mapa.vila.caminhos) linha(c.pontos, Math.max(2, c.largura * k) + 2.2, 'rgba(60,40,20,0.45)');
  for (const c of mapa.vila.caminhos) linha(c.pontos, Math.max(1.5, c.largura * k), c.forca ? '#c8ae7a' : '#d9b77c');
  const pr = mapa.vila.praca, [px, py] = P(pr.x, pr.z);
  g.fillStyle = '#a7a194'; g.beginPath(); g.arc(px, py, pr.r * k, 0, 6.283); g.fill();
  // árvores (copa vista de cima, com luz de um lado)
  const copa = (a, r0) => {
    const [x, y] = P(a.x, a.z), r = r0 * a.s * k;
    g.fillStyle = 'rgba(10,25,12,0.45)'; g.beginPath(); g.arc(x + r * 0.25, y + r * 0.3, r, 0, 6.283); g.fill();
    g.fillStyle = `hsl(${100 + (a.v || 0) * 6}, 38%, ${24 + ((a.x * 7) % 3) * 2}%)`; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(190,230,140,0.22)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, 6.283); g.fill();
  };
  for (const a of mapa.mata || []) copa(a, 2.1);
  for (const a of mapa.vila.arvores) copa(a, 2.2);
  // casas: telhado de palha e cumeeira
  for (const c of mapa.vila.casas) {
    g.save(); g.translate(...P(c.x, c.z)); g.rotate(-c.ry);
    g.fillStyle = 'rgba(30,20,10,0.5)'; g.fillRect((-c.w / 2 + 0.4) * k, (-c.d / 2 + 0.5) * k, c.w * k, c.d * k);
    g.fillStyle = '#c9a466'; g.fillRect(-c.w / 2 * k, -c.d / 2 * k, c.w * k, c.d * k);
    g.fillStyle = '#a5803f'; g.fillRect(-c.w / 2 * k, 0, c.w * k, c.d / 2 * k);
    g.restore();
  }
  // rochas grandes da vila
  for (const r of mapa.rochas || []) { const [x, y] = P(r.x, r.z); g.fillStyle = '#7d7b72'; g.beginPath(); g.arc(x, y, Math.max(1.5, r.s * 0.9 * k), 0, 6.283); g.fill(); }
  // leve vinheta: o papel escurece nas pontas
  const v = g.createRadialGradient(T / 2, T / 2, T * 0.35, T / 2, T / 2, T * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = v; g.fillRect(0, 0, T, T);
  return cv;
}
