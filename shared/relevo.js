// Relevo do chão (pedido do André 2026-11-05: "o negócio está muito reto"): lagos (uns rasos, outros fundos) e uma
// montanha de verdade. O chão plano (altura 0) continua valendo em todo o resto do mapa.
// Servidor, site e Godot usam a mesma conta: o Godot recebe a grade da montanha e os lagos pelo mundo.json
// (client/exportar-godot/mundo.mjs) e repete relevo() e chaoDoRelevo() em godot-prototipo/terreno.gd.

// ---------- lagos ----------
// x, z: centro; rx, rz: raios da elipse; giro: rad; lobos: ondas na margem [[k, amplitude, fase]] (margem orgânica);
// fundo: profundidade de verdade no meio (m). Raso: dá para atravessar andando com água pelo joelho. Fundo: o leito
// fica lá embaixo (dá para mergulhar quando vier a animação de nadar); por enquanto o herói boia com a água no peito.
export const LAGOS = [
  { id: 'lago_oeste', nome: 'Lago do Oeste', x: -45, z: -12, rx: 8.5, rz: 6, giro: 0.5, fundo: 0.75, lobos: [[3, 0.08, 0.4], [5, 0.05, 2.1]] },
  { id: 'lago_raso', nome: 'Lago Raso', x: 12, z: 45, rx: 7.5, rz: 6, giro: -0.4, fundo: 0.65, lobos: [[3, 0.07, 1.3], [4, 0.05, 0.2]] },
  { id: 'lago_fundo', nome: 'Lago Fundo', x: 100, z: 78, rx: 12.5, rz: 9, giro: 0.3, fundo: 4.2, lobos: [[3, 0.09, 2.7], [5, 0.05, 0.6]] },
  { id: 'lago_montanha', nome: 'Lago da Montanha', x: 121, z: -33, rx: 10, rz: 7.5, giro: -0.6, fundo: 4.6, lobos: [[3, 0.08, 4.1], [5, 0.06, 1.7]] },
]
export const AGUA = { nivel: -0.12, peito: 1.2, lento: 0.62, raso: 0.82 }; // nível da água; mais fundo que isso o herói boia; velocidade na água funda / rasa

// raio da margem do lago na direção do ponto (elipse girada com ondas): 1 = na margem
function margemLago(L, x, z) {
  const dx = x - L.x, dz = z - L.z, c = Math.cos(L.giro), s = Math.sin(L.giro);
  const u = dx * c + dz * s, v = -dx * s + dz * c, ang = Math.atan2(v / L.rz, u / L.rx);
  let k = 1; for (const [n, a, f] of L.lobos) k *= 1 + a * Math.sin(n * ang + f);
  return Math.hypot(u / L.rx, v / L.rz) / k;
}
const suave = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
// profundidade do leito (m, positiva) e se está dentro da água. Raso: tigela suave. Fundo: margem que desce logo e meio
// fundo e quase plano (lago de verdade, não uma bacia em V)
export function noLago(x, z) {
  for (const L of LAGOS) {
    const R = Math.max(L.rx, L.rz) * 1.25;
    if (Math.abs(x - L.x) > R || Math.abs(z - L.z) > R) continue;
    const d = margemLago(L, x, z);
    if (d >= 1) continue;
    const p = L.fundo > 1.5 ? L.fundo * (0.12 * suave(1, 0.85, d) + 0.88 * suave(0.85, 0.35, d)) : L.fundo * suave(1, 0.3, d);
    return { lago: L, fundo: p, d };
  }
  return null;
}

// ---------- montanha ----------
// Uma só, a nordeste do campo de fora, depois do veio de ferro. Gerada por ruído (cristas) e depois "gasta" por chuva
// (erosão de gotas), que é o que faz parecer montanha de verdade: vales, encostas lisas e cristas, sem pedaço torto.
// Sorteio fixo: sai igual no servidor e no app. O lado oeste (de quem chega do campo de fora) desce devagar: dá para
// subir andando até o alto; o norte e o leste são paredões (fim do mapa).
export const MONTANHA = { x: 176, z: -54, tam: 150, passo: 1.5, alto: 44 };

function montarMontanha() {
  const { tam, passo, alto } = MONTANHA, n = Math.round(tam / passo) + 1, h = new Float32Array(n * n);
  let sem = 90517; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  // ruído de valor suave com tabela fixa
  const P = new Float32Array(256 * 256); for (let i = 0; i < P.length; i++) P[i] = rnd();
  const val = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const g = (a, b) => P[((iz + b) & 255) * 256 + ((ix + a) & 255)];
    return (g(0, 0) * (1 - ux) + g(1, 0) * ux) * (1 - uz) + (g(0, 1) * (1 - ux) + g(1, 1) * ux) * uz;
  };
  const fbm = (x, z, o) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * val(x * f, z * f); a *= 0.5; f *= 2.03; } return s; };
  const crista = (x, z, o) => { let s = 0, a = 0.5, f = 1, w = 1; for (let i = 0; i < o; i++) { let v = 1 - Math.abs(val(x * f, z * f) * 2 - 1); v *= v * w; w = Math.min(1, v * 2); s += v * a; a *= 0.5; f *= 2.1; } return s; };
  const meio = (n - 1) / 2;
  // perfil de montanha: encosta côncava (íngreme lá em cima, suave no pé), sem ponta de agulha
  const perfil = (r) => { const u = Math.max(0, 1 - r); return u * u * (1.4 - 0.4 * u); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const lx = (i - meio) * passo, lz = (j - meio) * passo; // metros a partir do centro (+x leste, +z sul)
    // ondula a forma (domínio torcido): a base não fica um círculo
    const wx = lx + (fbm(lx * 0.016 + 3.1, lz * 0.016, 3) - 0.5) * 26, wz = lz + (fbm(lx * 0.016, lz * 0.016 + 7.7, 3) - 0.5) * 26;
    // maciço: pico um pouco a leste, ombro ao norte e uma crista que desce para sudoeste (o caminho de subida)
    const ex = wx < 0 ? wx / 1.3 : wx, pico = perfil(Math.hypot(ex - 6, wz + 2) / 50);
    const ombro = 0.62 * perfil(Math.hypot(wx - 12, wz + 30) / 30);
    const cu = (wx + 6) * 0.707 - (wz - 6) * 0.707, cv = (wx + 6) * 0.707 + (wz - 6) * 0.707; // eixo da crista sudoeste
    const crista2 = 0.38 * perfil(Math.hypot(cu / 2.2, cv) / 22);
    const base = pico + ombro * (1 - pico * 0.6) + crista2 * (1 - pico * 0.5);
    // detalhe de cristas e ravinas, mais forte no alto e nada no pé
    const det = crista(wx * 0.026 + 11, wz * 0.026 + 5, 4) - 0.35;
    h[j * n + i] = base * (1 + det * 0.24 * Math.min(1, base * 1.5));
  }
  // erosão de gotas (chuva): cada gota desce pela encosta levando terra e soltando onde perde velocidade
  const altura = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, k = iz * n + ix;
    return (h[k] * (1 - fx) + h[k + 1] * fx) * (1 - fz) + (h[k + n] * (1 - fx) + h[k + n + 1] * fx) * fz; };
  const grad = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, k = iz * n + ix;
    return [(h[k + 1] - h[k]) * (1 - fz) + (h[k + n + 1] - h[k + n]) * fz, (h[k + n] - h[k]) * (1 - fx) + (h[k + n + 1] - h[k + 1]) * fx]; };
  for (let g = 0; g < 40000; g++) {
    let x = 1 + rnd() * (n - 3), z = 1 + rnd() * (n - 3), dx = 0, dz = 0, vel = 1, agua = 1, carga = 0;
    for (let passoG = 0; passoG < 48; passoG++) {
      const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, k = iz * n + ix;
      const [gx, gz] = grad(x, z), hAnt = altura(x, z);
      dx = dx * 0.1 - gx * 0.9; dz = dz * 0.1 - gz * 0.9;
      const L = Math.hypot(dx, dz); if (L < 1e-6) break;
      dx /= L; dz /= L; x += dx; z += dz;
      if (x < 1 || z < 1 || x >= n - 2 || z >= n - 2) break;
      const dh = altura(x, z) - hAnt, cap = Math.max(-dh, 0.0004) * vel * agua * 5;
      const pesos = [(1 - fx) * (1 - fz), fx * (1 - fz), (1 - fx) * fz, fx * fz], cel = [k, k + 1, k + n, k + n + 1];
      if (carga > cap || dh > 0) {
        const solta = dh > 0 ? Math.min(dh, carga) : (carga - cap) * 0.3;
        carga -= solta; for (let q = 0; q < 4; q++) h[cel[q]] += solta * pesos[q];
      } else {
        const tira = Math.min((cap - carga) * 0.2, -dh * 0.5);
        for (let q = 0; q < 4; q++) h[cel[q]] -= tira * pesos[q];
        carga += tira;
      }
      vel = Math.min(2.2, Math.sqrt(Math.max(0, vel * vel - dh * 4))); agua *= 0.985;
    }
  }
  // desmoronamento (erosão térmica): onde a encosta passa do ângulo de repouso a pedra escorrega para baixo. Tira as
  // agulhas e deixa encosta de cascalho com paredões curtos, como montanha de verdade
  {
    let mx0 = 0; for (const v of h) mx0 = Math.max(mx0, v);
    const repouso = 0.92 * passo / alto * mx0; // diferença máxima entre vizinhos (na escala da grade antes dos metros)
    for (let it = 0; it < 60; it++) {
      for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        for (const o of [1, -1, n, -n]) {
          const d = h[k] - h[k + o];
          if (d > repouso) { const m = (d - repouso) * 0.25; h[k] -= m; h[k + o] += m; }
        }
      }
    }
  }
  // alisa de leve (tira o serrilhado da gota) e passa para metros
  let s = h;
  for (let vez = 0; vez < 2; vez++) {
    const t = new Float32Array(n * n);
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      t[k] = (s[k] * 4 + s[k - 1] + s[k + 1] + s[k - n] + s[k + n]) / 8;
    }
    s = t;
  }
  let mx = 0; for (const v of s) mx = Math.max(mx, v);
  const nada = 0.04; // o pé some no chão sem degrau
  for (let k = 0; k < s.length; k++) s[k] = Math.max(0, (s[k] / mx - nada) / (1 - nada)) * alto;
  return { x0: MONTANHA.x - tam / 2, z0: MONTANHA.z - tam / 2, passo, n, h: s };
}
export const GRADE_MONTANHA = montarMontanha();

export function alturaMontanha(x, z) {
  const G = GRADE_MONTANHA, fx = (x - G.x0) / G.passo, fz = (z - G.z0) / G.passo;
  if (fx < 0 || fz < 0 || fx >= G.n - 1 || fz >= G.n - 1) return 0;
  const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz, k = iz * G.n + ix, h = G.h;
  return (h[k] * (1 - ax) + h[k + 1] * ax) * (1 - az) + (h[k + G.n] * (1 - ax) + h[k + G.n + 1] * ax) * az;
}

// altura de verdade do chão (o desenho): montanha em cima, leito do lago embaixo (somados: a margem não dá degrau)
export function relevo(x, z) {
  const L = noLago(x, z);
  return alturaMontanha(x, z) - (L ? L.fundo : 0);
}
// onde os pés ficam: igual ao relevo, menos na água funda (o herói boia com a água no peito até vir a natação)
export function chaoDoRelevo(x, z) {
  const L = noLago(x, z), m = alturaMontanha(x, z);
  return L ? Math.max(m - L.fundo, Math.min(m, AGUA.nivel) - AGUA.peito) : m;
}
// encosta íngreme demais para subir andando (tangente da inclinação): paredão da montanha
export const INGREME = 1.0;

// (x, z) na água ou a menos de "folga" metros da margem de algum lago (árvore, mato e pedra não nascem ali)
export function pertoDaAgua(x, z, folga = 0) {
  for (const L of LAGOS) {
    const R = Math.max(L.rx, L.rz) + folga + 2;
    if (Math.abs(x - L.x) > R || Math.abs(z - L.z) > R) continue;
    if (margemLago(L, x, z) < 1 + folga / Math.min(L.rx, L.rz)) return true;
  }
  return false;
}
