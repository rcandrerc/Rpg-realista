// Efeitos visuais disparados pelos eventos da simulação: círculo mágico com pentagrama ao conjurar,
// explosões de fogo, bola de fogo com rastro, campo de chamas, chuva de flechas, rastro da espada e do dash.
// Mesma receita do jogo de hábitos (New-Game-Anime): partículas de fogo somando luz e fumaça por cima.
import * as THREE from 'three';

const H = 1.65; // altura de referência de um corpo (m)
const rnd = (a, b) => a + Math.random() * (b - a);
const ADD = THREE.AdditiveBlending;

// Cores (brilho, cor) de cada habilidade (ids de HABILIDADES em shared/dados.js)
const FXCOR = {
  bola: [0xfff2b0, 0xff7a1a], explosao: [0xffe6a0, 0xff4a12], chamas: [0xffe6a0, 0xff4a12], meteoros: [0xffe0a0, 0xff5a12],
  onda: [0xbfe6ff, 0x2a7dff], cura: [0xe4ffd8, 0x36c060], barreira: [0xd8f0ff, 0x4f9cff],
  relampago: [0xfff0b0, 0xff3d0a], giro: [0xfff0b0, 0xff3d0a], salto: [0xfff0b0, 0xff3d0a],
};
const MAGIA = new Set(['bola', 'explosao', 'chamas', 'meteoros', 'onda', 'cura', 'barreira']);
const corDe = (k) => FXCOR[k] || FXCOR.bola;

// ---------- texturas desenhadas no canvas ----------
const texBola = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(0.6, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
// Círculo mágico: anéis, runas e pentagrama (ou estrela de seis pontas no anel de dentro)
function texCirculo(estrela) {
  const T = 512, c = document.createElement('canvas'); c.width = c.height = T; const x = c.getContext('2d'), m = T / 2;
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 14; x.lineCap = x.lineJoin = 'round';
  const roda = (rr, w) => { x.lineWidth = w; x.beginPath(); x.arc(m, m, rr, 0, 7); x.stroke(); };
  roda(m - 10, 9); roda(m - 34, 4); roda(m * 0.56, 5); roda(m * 0.2, 3);
  const ponto = (a, rr) => [m + Math.cos(a) * rr, m + Math.sin(a) * rr];
  if (estrela) {
    x.lineWidth = 8; x.beginPath();
    for (let i = 0; i <= 5; i++) { const [px, py] = ponto(-Math.PI / 2 + i * 4 * Math.PI / 5, m - 36); i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  } else {
    x.lineWidth = 5;
    for (let k = 0; k < 2; k++) { x.beginPath(); for (let i = 0; i <= 3; i++) { const [px, py] = ponto(-Math.PI / 2 + k * Math.PI / 3 + i * 2 * Math.PI / 3, m - 36); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  }
  x.font = 'bold 30px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const RUNAS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; x.save(); x.translate(...ponto(a, m - 22)); x.rotate(a + Math.PI / 2); x.fillText(RUNAS[i], 0, 0); x.restore(); }
  for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(...ponto(i / 12 * Math.PI * 2, m * 0.38), 6, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const TEXC = [texCirculo(true), texCirculo(false)];
const texColuna = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c);
})();

// Uma camada somando luz + uma por baixo, normal, para o desenho aparecer também no chão claro
function circuloMalha(tex) {
  const camada = (blend) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: blend,
      depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    m.renderOrder = 2; return m;
  };
  const m = camada(ADD), base = camada(THREE.NormalBlending);
  m.rotation.x = -Math.PI / 2; base.position.z = -0.01; base.renderOrder = 1; m.add(base); m.userData.base = base;
  m.definir = (cor, op) => { m.material.color.set(cor); base.material.color.set(cor); m.material.opacity = op * 0.6; base.material.opacity = op; }; // de dia o chão é claro: a cor vem da camada normal
  m.descartar = () => { m.geometry.dispose(); m.material.dispose(); base.geometry.dispose(); base.material.dispose(); };
  return m;
}

// Lote de partículas: uma malha de pontos (fogo somando luz, fumaça normal)
function lote(scene, n, aditivo) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('cor', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  geo.setAttribute('tam', new THREE.BufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: texBola }, esc: { value: 600 } }, transparent: true, depthWrite: false, blending: aditivo ? ADD : THREE.NormalBlending,
    vertexShader: 'attribute vec4 cor; attribute float tam; uniform float esc; varying vec4 vc; void main(){ vc = cor; vec4 mv = modelViewMatrix * vec4(position, 1.0); float z = -mv.z; gl_PointSize = min(tam * esc / max(0.1, z), esc * 0.35); vc.a *= clamp((z - 0.6) / 1.2, 0.0, 1.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D mapa; varying vec4 vc; void main(){ float a = texture2D(mapa, gl_PointCoord).a; gl_FragColor = vec4(vc.rgb, vc.a * a); }',
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = aditivo ? 3 : 1; scene.add(pts);
  return { n, geo, mat, P: [] };
}
const _c0 = new THREE.Color(), _c1 = new THREE.Color();
function lotePasso(L, dt) {
  const pos = L.geo.attributes.position.array, cor = L.geo.attributes.cor.array, tm = L.geo.attributes.tam.array; let n = 0;
  for (let i = L.P.length - 1; i >= 0; i--) {
    const p = L.P[i]; p.t += dt; if (p.t >= p.vida) { L.P.splice(i, 1); continue; }
    const k = Math.max(0, 1 - p.arrasto * dt); p.vx *= k; p.vz *= k; p.vy = p.vy * k + p.sobe * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  for (const p of L.P) {
    const u = p.t / p.vida, f = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
    pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z; tm[n] = p.t0 + (p.t1 - p.t0) * u;
    cor[n * 4] = p.r0 + (p.r1 - p.r0) * u; cor[n * 4 + 1] = p.g0 + (p.g1 - p.g0) * u; cor[n * 4 + 2] = p.b0 + (p.b1 - p.b0) * u; cor[n * 4 + 3] = p.a * f; n++;
  }
  L.geo.setDrawRange(0, n);
  L.geo.attributes.position.needsUpdate = L.geo.attributes.cor.needsUpdate = L.geo.attributes.tam.needsUpdate = true;
}

// Faixa que segue um ponto ou a lâmina: guarda as últimas posições e some com o tempo
class Faixa {
  constructor(scene, nPontos, nAltura, cor, vida) {
    this.N = nPontos; this.V = nAltura; this.vida = vida; this.pts = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nPontos * nAltura * 3), 3));
    g.setAttribute('a', new THREE.BufferAttribute(new Float32Array(nPontos * nAltura), 1));
    const idx = []; for (let i = 0; i < nPontos - 1; i++) for (let j = 0; j < nAltura - 1; j++) { const k = i * nAltura + j; idx.push(k, k + 1, k + nAltura, k + 1, k + nAltura + 1, k + nAltura); }
    g.setIndex(idx); this.geo = g;
    this.m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: ADD,
      uniforms: { cor: { value: new THREE.Color(cor) } },
      vertexShader: 'attribute float a; varying float va; void main(){ va = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 cor; varying float va; void main(){ gl_FragColor = vec4(mix(cor, vec3(1.0), 0.3), va); }' }));
    this.m.frustumCulled = false; this.m.visible = false; scene.add(this.m);
  }
  // linha: lista de nAltura pontos (de baixo para cima) na posição atual
  passo(dt, linha, perfil, forca) {
    if (linha) this.pts.unshift({ l: linha.map((v) => v.clone()), t: 0 });
    for (const p of this.pts) p.t += dt;
    while (this.pts.length > this.N || (this.pts.length && this.pts[this.pts.length - 1].t > this.vida)) this.pts.pop();
    this.m.visible = this.pts.length > 1; if (!this.m.visible) return;
    const pos = this.geo.attributes.position.array, al = this.geo.attributes.a.array;
    for (let i = 0; i < this.N; i++) {
      const p = this.pts[Math.min(i, this.pts.length - 1)], f = (i < this.pts.length ? Math.max(0, 1 - p.t / this.vida) : 0) * (1 - i / this.N) * forca;
      for (let j = 0; j < this.V; j++) { const k = i * this.V + j, v = p.l[j]; pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z; al[k] = f * perfil[j]; }
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.a.needsUpdate = true;
  }
  remover(scene) { scene.remove(this.m); this.geo.dispose(); this.m.material.dispose(); }
}
const PERFIL_DASH = [0, 0.55, 1, 0.7, 0], PERFIL_LAMINA = [0.25, 1];

export class Efeitos {
  constructor(scene) {
    this.scene = scene; this.projeteis = new Map(); this.lista = []; this.circulos = []; this.areas = []; this.campos = [];
    this.FOGO = lote(scene, 1400, true); this.FUMA = lote(scene, 1100, false);
    // luzes fixas reaproveitadas (criar luz no meio do jogo faz o celular recompilar os materiais e engasgar)
    this.luzes = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xffffff, 0, 8, 2); scene.add(l); return { l, dono: null, int: 0, vida: 0, max: 1 }; });
    this.rastros = new Map(); // id do corpo -> { dash: Faixa, lamina: Faixa }
    this.meteoros = [];
  }

  // ---------- partículas ----------
  part(L, x, y, z, vx, vy, vz, vida, t0, t1, c0, c1, a, sobe = 0, arrasto = 0) {
    if (L.P.length >= L.n) L.P.shift(); _c0.set(c0); _c1.set(c1);
    L.P.push({ x, y, z, vx, vy, vz, t: 0, vida, t0, t1, r0: _c0.r, g0: _c0.g, b0: _c0.b, r1: _c1.r, g1: _c1.g, b1: _c1.b, a, sobe, arrasto });
  }
  fumacaChao(x, z, r, n, cor = 0x8a8496, forte = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = r * Math.sqrt(Math.random()), s = rnd(0.6, 1.6) * forte;
      this.part(this.FUMA, x + Math.cos(a) * d, 0.05, z + Math.sin(a) * d, Math.cos(a) * s, rnd(0.3, 1.1) * H * 0.4, Math.sin(a) * s, rnd(1.0, 1.8), 0.3 * H, rnd(0.7, 1.15) * H, cor, 0x4a4652, 0.62, 0.3, 1.6);
    }
  }
  labareda(x, y, z, cb, cc, s = 1) {
    const vx = rnd(-0.3, 0.3), vy = rnd(1.2, 2.4) * H * 0.5 * s, vz = rnd(-0.3, 0.3), v = rnd(0.4, 0.75);
    this.part(this.FUMA, x, y, z, vx, vy, vz, v, 0.3 * H * s, 0.06 * H, cc, 0x3a0a04, 0.75, 1.2, 0.5);
    this.part(this.FOGO, x, y, z, vx, vy, vz, v * 0.7, 0.16 * H * s, 0.03 * H, cb, cc, 0.8, 1.2, 0.5);
  }
  surto(x, y, z, n, cb, cc, vel = 5, tm = 0.12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, b = rnd(-0.2, 1.2), v = rnd(0.4, 1) * vel;
      this.part(this.FOGO, x, y, z, Math.cos(a) * Math.cos(b) * v, Math.sin(b) * v, Math.sin(a) * Math.cos(b) * v, rnd(0.4, 0.9), tm * H * rnd(0.7, 1.4), 0.01, cb, cc, 1, -4, 1.5);
    }
  }
  poeira(x, z, r, n, cb, cc) { // brasas (ou brilhos) subindo do círculo
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = r * Math.sqrt(Math.random()) * 0.95;
      const px = x + Math.cos(a) * d, py = rnd(0.02, 0.3) * H, pz = z + Math.sin(a) * d, vx = rnd(-0.3, 0.3), vy = rnd(0.6, 1.6), vz = rnd(-0.3, 0.3), v = rnd(1.0, 1.8);
      this.part(this.FUMA, px, py, pz, vx, vy, vz, v, rnd(0.1, 0.15) * H, 0.03 * H, cc, 0x2a0a04, 0.8, 0.35, 0.6);
      this.part(this.FOGO, px, py, pz, vx, vy, vz, v, 0.05 * H, 0.01 * H, cb, cc, 1, 0.35, 0.6);
    }
  }
  luz(cor, int, dist, vida, dono) {
    const l = this.luzes.find((q) => q.vida <= 0) || this.luzes.reduce((a, b) => (a.vida < b.vida ? a : b));
    l.l.color.set(cor); l.l.distance = dist; l.int = int; l.vida = l.max = vida; l.dono = dono; return l;
  }

  // ---------- eventos ----------
  evento(e, corpos) {
    switch (e.t) {
      case 'proj': return this.projetil(e);
      case 'projFim': return this.fimProjetil(e);
      case 'anel': return this.anel(e.x, e.z, e.r, e.cor, e.dur);
      case 'explosao': return this.explosao(e);
      case 'campo': return this.campo(e);
      case 'chuva': return this.chuva(e);
      case 'conjura': { const c = corpos.get(e.id); if (c) this.conjura(c.corpo, e); return; }
      case 'dash': { const c = corpos.get(e.id); if (c) this.trilhos(e.id).dashT = 0.3; return; }
      default:
    }
  }
  // Começo da habilidade: círculo no chão, coluna de luz, labaredas e fumaça
  conjura(corpo, e) {
    const [cb, cc] = corDe(e.hab), magia = MAGIA.has(e.hab);
    const r = (e.hab === 'explosao' || e.hab === 'chamas' ? 1.75 : e.hab === 'onda' ? 1.65 : magia ? 1.45 : 1.35) * H;
    const g = new THREE.Group(), a = circuloMalha(TEXC[0]), b = circuloMalha(TEXC[1]);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), new THREE.MeshBasicMaterial({ map: texColuna, color: cc, transparent: true, opacity: 0,
      blending: ADD, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    col.position.y = 0.5; col.renderOrder = 2; g.add(a, b, col); this.scene.add(g);
    const p = corpo.root.position;
    let bolha = null;
    if (e.hab === 'barreira') { // bolha de luz em volta do corpo
      bolha = new THREE.Group();
      const mat = (op, wire) => new THREE.MeshBasicMaterial({ color: cc, transparent: true, opacity: op, blending: ADD, depthWrite: false, wireframe: wire, toneMapped: false });
      bolha.add(new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mat(0.14, false)), new THREE.Mesh(new THREE.IcosahedronGeometry(1.04, 1), mat(0.4, true)));
      g.add(bolha);
    }
    this.circulos.push({ g, a, b, col, bolha, corpo, cb, cc, r, magia, t: 0, dur: e.dur, f: 0, vivo: true, luz: this.luz(cc, 1.2, 7, e.dur + 0.3, corpo) });
    this.fumacaChao(p.x, p.z, r * 0.9, 22);
    for (let i = 0; i < 36; i++) { const ang = i / 36 * 6.283; this.labareda(p.x + Math.cos(ang) * r * 0.9, 0.05, p.z + Math.sin(ang) * r * 0.9, cb, cc, 1.6); }
    for (let i = 0; i < 24; i++) { const ang = Math.random() * 6.283, d = r * Math.sqrt(Math.random()) * 0.8; this.labareda(p.x + Math.cos(ang) * d, 0.05, p.z + Math.sin(ang) * d, cb, cc, 1.2); }
    this.surto(p.x, 0.1, p.z, 40, cb, cc, 7); this.poeira(p.x, p.z, r, 40, cb, cc);
  }
  // Explosão de área: círculo gigante, fogo, fumaça, clarão
  area(x, z, r, [cb, cc], forte = 1) {
    const m = circuloMalha(TEXC[0]); m.position.set(x, 0.06, z); this.scene.add(m);
    this.areas.push({ m, t: 0, r, cc });
    this.luz(cc, 4 * forte, r * 3, 0.5).l.position.set(x, 1.2, z);
    const nf = Math.round(55 * forte);
    for (let i = 0; i < nf; i++) { const a = Math.random() * 6.283, d = r * Math.sqrt(Math.random()); this.labareda(x + Math.cos(a) * d, 0.05, z + Math.sin(a) * d, cb, cc, 1.1 + 0.5 * forte); }
    this.surto(x, 0.4 * H, z, Math.round(40 * forte), cb, cc, 9); this.fumacaChao(x, z, r * 0.8, Math.round(30 * forte), 0x77707e, 1.6);
    this.part(this.FOGO, x, 0.5 * H, z, 0, 0, 0, 0.3, r * 0.7, r * 1.4, 0xffffff, cc, 0.6);
  }
  // Habilidades de área em volta do jogador: cada uma com o seu jeito
  explosao(e) {
    const cores = corDe(e.fx), [cb, cc] = cores;
    if (e.fx === 'giro') { this.anel(e.x, e.z, e.r, cc, 0.4); this.surto(e.x, 0.9, e.z, 24, cb, cc, 7); return; }
    if (e.fx === 'onda') { // anel de gelo que corre para fora
      this.area(e.x, e.z, e.r, cores, 0.8);
      for (let i = 0; i < 80; i++) {
        const a = i / 80 * 6.283, v = e.r * 2.6;
        this.part(this.FOGO, e.x + Math.cos(a) * 0.4, 0.3 * H, e.z + Math.sin(a) * 0.4, Math.cos(a) * v, 0, Math.sin(a) * v, 0.45, 0.35 * H, 0.15 * H, cb, cc, 1, 0, 1.2);
        this.part(this.FUMA, e.x + Math.cos(a) * 0.4, 0.1, e.z + Math.sin(a) * 0.4, Math.cos(a) * v * 0.8, rnd(0.2, 0.8), Math.sin(a) * v * 0.8, 0.7, 0.25 * H, 0.5 * H, 0xdff4ff, 0x6f9fd8, 0.5, 0, 1.4);
      }
      return;
    }
    this.area(e.x, e.z, e.r, cores, e.fx === 'explosao' ? 1.5 : 1);
  }
  projetil(e) {
    let m;
    if (e.flecha) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x6b4a2c }));
      m.geometry.rotateX(Math.PI / 2);
      const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 }));
      ponta.rotation.x = Math.PI / 2; ponta.position.z = 0.44; m.add(ponta);
    } else {
      // orbe de luz com aura pulsando
      m = new THREE.Mesh(new THREE.SphereGeometry(e.tam, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }));
      const aura = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: e.cor, transparent: true, opacity: 0.5, blending: ADD, depthWrite: false, toneMapped: false }));
      aura.scale.setScalar(2); m.add(aura); m.userData.aura = aura;
    }
    m.position.set(e.x, e.y, e.z);
    const dir = new THREE.Vector3(e.dx, e.dy, e.dz);
    m.lookAt(m.position.clone().add(dir));
    this.scene.add(m);
    if (e.fogo) { this.surto(e.x, e.y, e.z, 26, 0xfff2b0, e.cor, 6); m.scale.setScalar(1.15); }
    const luz = e.flecha && !e.atravessa ? null : this.luz(e.cor, e.flecha ? 1.2 : e.fogo ? 3 : 1.6, e.fogo ? 7 : 4, 2.5, m);
    this.projeteis.set(e.id, { m, dir, vel: e.vel, vida: 2.5, e, luz, t: 0 });
  }
  fimProjetil(e) {
    const p = this.projeteis.get(e.id);
    if (p) { this.tirarProjetil(e.id, p); }
    const cor = new THREE.Color(e.cor), clara = cor.clone().lerp(new THREE.Color(0xffffff), 0.6).getHex();
    if (e.explosao) this.area(e.x, e.z, e.explosao, [clara, e.cor], 0.8);
    else if (p && !p.e.flecha) this.surto(e.x, e.y, e.z, 14, clara, e.cor, 4, 0.08);
  }
  tirarProjetil(id, p) { this.scene.remove(p.m); if (p.luz?.dono === p.m) { p.luz.vida = 0; p.luz.dono = null; } this.projeteis.delete(id); }
  anel(x, z, r, cor, dur) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 48),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: ADD }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); this.scene.add(m);
    this.lista.push({ m, vida: dur, max: dur });
  }
  // Círculo de Chamas: pentagrama aceso no chão por alguns segundos, com fogo saindo dele
  campo(e) {
    const [cb, cc] = FXCOR.chamas;
    this.area(e.x, e.z, e.r, [cb, cc], 1.2);
    const m = circuloMalha(TEXC[0]); m.position.set(e.x, 0.07, e.z); m.scale.setScalar(e.r); this.scene.add(m);
    const luz = this.luz(cc, 2.5, e.r * 3, e.dur);
    luz.l.position.set(e.x, 0.9, e.z);
    this.campos.push({ m, x: e.x, z: e.z, r: e.r, t: 0, dur: e.dur, cb, cc });
  }
  // Chuva de Meteoros: pentagrama no chão do alvo e bolas de fogo caindo em ondas
  chuva(e) {
    const [cb, cc] = FXCOR.meteoros;
    const m = circuloMalha(TEXC[0]); m.position.set(e.x, 0.07, e.z); m.scale.setScalar(e.r); this.scene.add(m);
    this.campos.push({ m, x: e.x, z: e.z, r: e.r, t: 0, dur: 0.6 + e.ondas * 0.22, cb, cc, fraco: true });
    const geo = new THREE.SphereGeometry(0.2, 12, 8);
    for (let k = 0; k < e.ondas; k++) for (let n = 0; n < 3; n++) {
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * e.r * 0.9, x = e.x + Math.cos(a) * d, z = e.z + Math.sin(a) * d;
      const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff2c8, toneMapped: false }));
      o.position.set(x + 2.5, 9, z + 1.2); o.visible = false; this.scene.add(o);
      this.meteoros.push({ o, de: o.position.clone(), para: new THREE.Vector3(x, 0, z), t: -(0.25 + k * 0.22 + n * 0.06) + 0.35, dur: 0.35, cb, cc });
    }
  }
  // ---------- rastros que seguem os corpos ----------
  trilhos(id) {
    let r = this.rastros.get(id);
    if (!r) { r = { dash: new Faixa(this.scene, 28, 5, 0x73c7ff, 0.3), lamina: new Faixa(this.scene, 14, 2, 0xbfeaff, 0.14), dashT: 0 }; this.rastros.set(id, r); }
    return r;
  }
  // chamado todo quadro para cada jogador
  corpo(id, corpo, info, dt) {
    const r = this.trilhos(id);
    const dash = info?.anim === 'dash' || r.dashT > 0; r.dashT -= dt;
    const p = corpo.root.position;
    r.dash.passo(dt, dash ? [0.12, 0.31, 0.51, 0.7, 0.9].map((k) => new THREE.Vector3(p.x, p.y + H * k, p.z)) : null, PERFIL_DASH, 0.42);
    const golpe = info?.acao?.lamina && corpo.lamina();
    r.lamina.passo(dt, golpe || null, PERFIL_LAMINA, 0.7);
  }
  esquecer(id) { const r = this.rastros.get(id); if (r) { r.dash.remover(this.scene); r.lamina.remover(this.scene); this.rastros.delete(id); } }

  atualizar(dt, t, camera, renderer) {
    this.FOGO.mat.uniforms.esc.value = this.FUMA.mat.uniforms.esc.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    // círculos de quem está conjurando
    for (let i = this.circulos.length - 1; i >= 0; i--) {
      const c = this.circulos[i], p = c.corpo.root.position, { cb, cc, r } = c;
      c.t += dt; if (c.t >= c.dur || c.corpo.removido) c.vivo = false;
      c.f = c.vivo ? Math.min(1, c.f + dt * 6) : c.f - dt * 3;
      c.g.position.set(p.x, 0.07, p.z);
      const pulso = 1 + Math.sin(c.t * 14) * 0.04, ent = 1 - Math.pow(1 - Math.min(1, c.t / 0.25), 3);
      if (c.vivo) { c.a.scale.setScalar(r * ent * pulso); c.b.scale.setScalar(r * 0.62 * ent); c.col.scale.set(r * 0.8 * ent, H * 1.5, r * 0.8 * ent); }
      else c.a.scale.multiplyScalar(1 + dt * 0.6);
      c.a.rotation.z = c.t * 0.9; c.b.rotation.z = -c.t * 1.6;
      if (c.bolha) {
        c.bolha.position.y = p.y + 0.85; c.bolha.scale.setScalar(1.05 * ent * (1 + Math.sin(c.t * 6) * 0.03)); c.bolha.rotation.y = c.t * 0.8;
        c.bolha.children.forEach((m, k) => { m.material.opacity = (k ? 0.4 : 0.14) * Math.max(0, c.f); });
      }
      c.a.definir(cc, Math.max(0, c.f)); c.b.definir(cc, Math.max(0, c.f) * 0.9); c.col.material.opacity = Math.max(0, c.f) * 0.45;
      if (c.vivo) {
        if (Math.random() < dt * 40) { const a = Math.random() * 6.283; this.labareda(p.x + Math.cos(a) * r * 0.9, 0.05, p.z + Math.sin(a) * r * 0.9, cb, cc, 0.8); }
        if (Math.random() < dt * 30) { const a = c.t * 5 + Math.random() * 0.4, d = r * rnd(0.3, 0.8); this.part(this.FOGO, p.x + Math.cos(a) * d, 0.1, p.z + Math.sin(a) * d, -Math.sin(a) * 0.8, rnd(1.5, 3), Math.cos(a) * 0.8, 0.8, 0.07 * H, 0.02 * H, 0xffffff, cc, 1, 0.5, 0.3); }
        if (Math.random() < dt * 8) this.fumacaChao(p.x, p.z, r * 0.9, 1, 0x8a8496, 0.6);
        let n = dt * 120; while (n > 0) { if (Math.random() < n) this.poeira(p.x, p.z, r, 1, cb, cc); n -= 1; }
        if (c.magia) for (const m of c.corpo.maos()) {
          this.part(this.FOGO, m.x, m.y, m.z, 0, 0, 0, 0.1, 0.3 * H, 0.18 * H, cb, cc, 0.85);
          if (Math.random() < dt * 20) this.part(this.FOGO, m.x, m.y, m.z, rnd(-1, 1), rnd(0, 1.5), rnd(-1, 1), 0.4, 0.06 * H, 0.01, 0xffffff, cc, 1, -2, 0);
        }
        c.luz.l.position.set(p.x, p.y + 0.9 * H, p.z); c.luz.int = 1 + Math.sin(c.t * 20) * 0.25;
      }
      if (c.f <= 0) {
        this.scene.remove(c.g); c.a.descartar(); c.b.descartar(); c.col.geometry.dispose(); c.col.material.dispose();
        c.bolha?.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
        this.circulos.splice(i, 1);
      }
    }
    // explosões
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const a = this.areas[i]; a.t += dt; const u = a.t / 0.9;
      if (u >= 1) { this.scene.remove(a.m); a.m.descartar(); this.areas.splice(i, 1); continue; }
      a.m.scale.setScalar(a.r * (0.3 + 0.75 * (1 - (1 - u) ** 3))); a.m.rotation.z = a.t * 1.2;
      a.m.definir(a.cc, u < 0.1 ? u * 10 : 1 - (u - 0.1) / 0.9);
    }
    // campos de fogo e a área da chuva de flechas
    for (let i = this.campos.length - 1; i >= 0; i--) {
      const f = this.campos[i]; f.t += dt;
      const op = Math.min(1, f.t * 4, (f.dur - f.t) * 2);
      f.m.rotation.z = f.t * 0.7; f.m.definir(f.cc, Math.max(0, op) * (f.fraco ? 0.7 : 0.9));
      if (!f.fraco) {
        let n = dt * 70; while (n > 0) { if (Math.random() < n) { const a = Math.random() * 6.283, d = f.r * Math.sqrt(Math.random()); this.labareda(f.x + Math.cos(a) * d, 0.05, f.z + Math.sin(a) * d, f.cb, f.cc, 1.1); } n -= 1; }
        if (Math.random() < dt * 30) this.poeira(f.x, f.z, f.r, 1, f.cb, f.cc);
      }
      if (f.t >= f.dur) { this.scene.remove(f.m); f.m.descartar(); this.campos.splice(i, 1); }
    }
    // projéteis: a bola de fogo deixa rastro de fogo e fumaça; a faísca, brilhos
    for (const [id, p] of this.projeteis) {
      p.m.position.addScaledVector(p.dir, p.vel * dt); p.vida -= dt; p.t += dt;
      const o = p.m.position;
      if (p.m.userData.aura) {
        p.m.userData.aura.scale.setScalar(2 + Math.sin(p.t * 30) * 0.3);
        const cor = p.e.cor, vx = -p.dir.x * p.vel, vz = -p.dir.z * p.vel;
        if (p.e.fogo) {
          this.part(this.FOGO, o.x, o.y, o.z, 0, 0, 0, 0.08, 0.75 * H * p.e.tam, 0.5 * H * p.e.tam, 0xfff2b0, cor, 0.9);
          for (let k = 0; k < 3; k++) this.part(this.FUMA, o.x + rnd(-0.1, 0.1), o.y + rnd(-0.1, 0.1), o.z + rnd(-0.1, 0.1), vx * 0.05 + rnd(-0.5, 0.5), rnd(0.2, 1.2), vz * 0.05 + rnd(-0.5, 0.5), rnd(0.25, 0.4), 0.42 * H * p.e.tam * 4, 0.08 * H, 0xff9a1a, 0x5a0d02, 0.85, 1.5, 0.5);
          for (let k = 0; k < 3; k++) this.part(this.FOGO, o.x + rnd(-0.08, 0.08), o.y + rnd(-0.08, 0.08), o.z + rnd(-0.08, 0.08), vx * 0.08 + rnd(-0.4, 0.4), rnd(0, 0.8), vz * 0.08 + rnd(-0.4, 0.4), rnd(0.25, 0.45), 0.3 * H * p.e.tam * 4, 0.04 * H, 0xffd27a, 0xff3a0a, 0.9, 1.5, 0.5);
        } else if (Math.random() < 0.8) this.part(this.FOGO, o.x, o.y, o.z, rnd(-0.4, 0.4), rnd(-0.2, 0.4), rnd(-0.4, 0.4), 0.3, 0.12 * H, 0.01, 0xffffff, cor, 0.9, 0, 1);
      }
      if (p.luz?.dono === p.m) { p.luz.l.position.copy(o); p.luz.vida = 1; }
      if (p.vida <= 0) this.tirarProjetil(id, p);
    }
    // meteoros: descem em diagonal deixando fogo e explodem no chão
    for (let i = this.meteoros.length - 1; i >= 0; i--) {
      const q = this.meteoros[i]; q.t += dt; if (q.t < 0) continue;
      const u = Math.min(1, q.t / q.dur); q.o.visible = true; q.o.position.lerpVectors(q.de, q.para, u * u);
      const o = q.o.position;
      for (let k = 0; k < 3; k++) this.part(this.FOGO, o.x + rnd(-0.1, 0.1), o.y + rnd(-0.1, 0.1), o.z + rnd(-0.1, 0.1), rnd(-0.4, 0.4), rnd(0, 1), rnd(-0.4, 0.4), rnd(0.25, 0.45), 0.35 * H, 0.04 * H, q.cb, q.cc, 0.9, 1.5, 0.5);
      this.part(this.FUMA, o.x, o.y, o.z, rnd(-0.3, 0.3), rnd(0, 0.6), rnd(-0.3, 0.3), 0.5, 0.25 * H, 0.45 * H, 0xff9a1a, 0x3a0a04, 0.7, 1, 0.5);
      if (u >= 1) { this.scene.remove(q.o); q.o.material.dispose(); this.meteoros.splice(i, 1); this.area(q.para.x, q.para.z, 1.1, [q.cb, q.cc], 0.45); }
    }
    // anéis e flechas caindo
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const e = this.lista[i]; e.vida -= dt; const k = Math.max(0, e.vida / e.max);
      if (e.cai) e.m.position.y = Math.max(0.2, 6 * k);
      else { e.m.material.opacity = 0.8 * k; e.m.scale.setScalar(1 + (1 - k) * 0.3); }
      if (e.vida <= 0) { this.scene.remove(e.m); e.m.geometry.dispose(); e.m.material.dispose(); this.lista.splice(i, 1); }
    }
    // luzes reaproveitadas
    for (const q of this.luzes) {
      if (q.vida > 0) { q.vida -= dt; q.l.intensity = q.int * Math.min(1, q.vida / Math.min(0.3, q.max)); } else q.l.intensity = 0;
    }
    lotePasso(this.FOGO, dt); lotePasso(this.FUMA, dt);
  }
}
