// Formato do mapa andável: círculos (mapa.areas) ligados por corredores (mapa.corredores, cápsulas de largura "larg").
// Sem mapa.areas, vale o círculo antigo de raio mapa.raio no centro. Servidor, site e Godot usam a mesma conta
// (godot-prototipo/andar.gd tem a cópia em GDScript).

export const formasDoMapa = (mapa) => ({
  areas: mapa.areas?.length ? mapa.areas : [{ x: 0, z: 0, r: mapa.raio }],
  corredores: mapa.corredores || [],
});

// Raio da área na direção "ang" (radianos, a partir de +x para +z). Círculo: r. Área de borda orgânica: elipse rx × rz
// com ondas na borda (lobos: [[k, amplitude, fase], ...], o raio varia amplitude × sen(k·ang + fase)).
export function raioNaDirecao(a, ang) {
  if (a.rx == null) return a.r;
  const c = Math.cos(ang) / a.rx, s = Math.sin(ang) / a.rz;
  let r = 1 / Math.sqrt(c * c + s * s);
  for (const [k, amp, fase] of a.lobos || []) r *= 1 + amp * Math.sin(k * ang + fase);
  return r;
}
const raioAte = (a, x, z) => raioNaDirecao(a, Math.atan2(z - a.z, x - a.x));

// ponto mais perto de (x, z) no segmento a-b
function noSegmento(c, x, z) {
  const [ax, az] = c.a, [bx, bz] = c.b, vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
  return [ax + vx * t, az + vz * t];
}

// (x, z) cai dentro de alguma área ou corredor com "margem" metros de folga da borda DELA?
function dentroDeAlguma(F, x, z, margem) {
  for (const a of F.areas) if (Math.hypot(x - a.x, z - a.z) <= raioAte(a, x, z) - margem) return true;
  for (const c of F.corredores) { const [px, pz] = noSegmento(c, x, z); if (Math.hypot(x - px, z - pz) <= c.larg / 2 - margem) return true; }
  return false;
}
// volta de pontos (12 direções) que conferem a folga em relação ao mapa INTEIRO (a união das áreas), não a cada área
export const VOLTA_FOLGA = Array.from({ length: 12 }, (_, i) => [Math.cos(i * Math.PI / 6), Math.sin(i * Math.PI / 6)]);
// (x, z) fica dentro do mapa com "margem" metros de folga da borda?
// 2026-11-05 (André: "o mapa inteiro tem que dar para caminhar, onde der pra ir tem que poder ir"): a folga vale para a
// borda de verdade do mapa (a união de todas as áreas e corredores). Antes cada área tinha a folga dela, então onde duas
// áreas se encostavam por pouco sobrava uma parede invisível no meio da mata. Agora o ponto vale se está fundo numa
// área (como antes) ou se ele e a volta dele a "margem" metros estão todos dentro do mapa.
export function dentroDoMapa(mapa, x, z, margem = 0) {
  if (mapa.andavelMundo && mapa.andavelMundo(x, z, margem)) return true; // FASE 3: a terra dos continentes (shared/mundo.js)
  const F = formasDoMapa(mapa);
  if (dentroDeAlguma(F, x, z, margem)) return true;
  if (margem <= 0 || !dentroDeAlguma(F, x, z, 0)) return false;
  for (const [cx, cz] of VOLTA_FOLGA) if (!dentroDeAlguma(F, x + cx * margem, z + cz * margem, 0)) return false;
  return true;
}

// traz (x, z) para o ponto mais perto dentro do mapa (com margem); devolve [x, z]
export function limitarAoMapa(mapa, x, z, margem = 0) {
  if (dentroDoMapa(mapa, x, z, margem)) return [x, z];
  const F = formasDoMapa(mapa);
  let melhor = null, md = Infinity;
  const ver = (cx, cz, r) => {
    const d = Math.hypot(x - cx, z - cz), k = d > 0 ? Math.max(0, r) / d : 0, px = cx + (x - cx) * k, pz = cz + (z - cz) * k;
    const dd = Math.hypot(x - px, z - pz); if (dd < md) { md = dd; melhor = [px, pz]; }
  };
  for (const a of F.areas) ver(a.x, a.z, raioAte(a, x, z) - margem); // na borda orgânica, o ponto da borda na mesma direção
  for (const c of F.corredores) { const [px, pz] = noSegmento(c, x, z); ver(px, pz, c.larg / 2 - margem); }
  return melhor || [x, z];
}
