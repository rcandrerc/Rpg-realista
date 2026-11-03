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

// (x, z) fica dentro do mapa com "margem" metros de folga da borda?
export function dentroDoMapa(mapa, x, z, margem = 0) {
  const F = formasDoMapa(mapa);
  for (const a of F.areas) if (Math.hypot(x - a.x, z - a.z) <= raioAte(a, x, z) - margem) return true;
  for (const c of F.corredores) { const [px, pz] = noSegmento(c, x, z); if (Math.hypot(x - px, z - pz) <= c.larg / 2 - margem) return true; }
  return false;
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
