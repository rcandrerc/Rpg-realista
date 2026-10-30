// Vila do começo: casas, ferraria, poço, praça, caminhos e árvores, desenhados a partir de mapa.vila (shared/dados.js).
// As casas são montadas em código com texturas PBR da Poly Haven (CC0), em escala de metro (nada esticado),
// e juntadas por material: a vila inteira custa poucas chamadas de desenho.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PASTA = 'assets/cenario/vila/';
const texL = new THREE.TextureLoader();
let semente = 99;
const rnd = (a = 0, b = 1) => { semente = (semente * 16807) % 2147483647; return a + (semente / 2147483647) * (b - a); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CIMA = V(0, 1, 0);

export function textura(arq, srgb) {
  const t = texL.load(PASTA + arq); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  return t;
}
function pbr(nome, extra = {}, arm = true) {
  const m = new THREE.MeshStandardMaterial({ map: textura(nome + '_diff_1k.jpg', true), normalMap: textura(nome + '_nor_gl_1k.jpg'), metalness: 0, roughness: 1, ...extra });
  if (arm) m.roughnessMap = textura(nome + '_arm_1k.jpg');
  return m;
}

// ---------- chão: caminhos de terra e praça de pedra ----------
// Máscara pintada num canvas: vermelho = terra batida (caminhos e em volta das casas), verde = calçamento da praça.
// O chão mistura as texturas por ela (cena.js) e a grama não nasce onde ela marca.
const AREA = { x0: -30, z0: -34, tam: 56 };
export function mascaraVila(vila) {
  const T = 512, px = T / AREA.tam;
  const cv = document.createElement('canvas'); cv.width = cv.height = T;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, T, T);
  const P = (x, z) => [(x - AREA.x0) * px, (z - AREA.z0) * px];
  g.globalCompositeOperation = 'lighter'; g.lineCap = g.lineJoin = 'round'; g.filter = 'blur(2.5px)';
  semente = 31;
  for (const c of vila.caminhos) {
    // várias passadas tortinhas: borda irregular, como trilha de verdade
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = 'rgba(255,0,0,0.42)'; g.lineWidth = c.largura * px * rnd(0.75, 1.15);
      g.beginPath();
      c.pontos.forEach(([x, z], i) => { const [a, b] = P(x + rnd(-0.25, 0.25), z + rnd(-0.25, 0.25)); i ? g.lineTo(a, b) : g.moveTo(a, b); });
      g.stroke();
    }
  }
  // terra em volta das casas (ninguém deixa grama alta encostada na parede)
  g.fillStyle = 'rgba(255,0,0,0.9)';
  for (const c of vila.casas) {
    g.save(); g.translate(...P(c.x, c.z)); g.rotate(-c.ry);
    g.fillRect((-c.w / 2 - 0.7) * px, (-c.d / 2 - 0.7) * px, (c.w + 1.4) * px, (c.d + 1.4) * px); g.restore();
  }
  const pr = vila.praca;
  g.fillStyle = 'rgba(0,255,0,1)'; g.beginPath(); g.arc(...P(pr.x, pr.z), pr.r * px, 0, 6.283); g.fill();
  g.fillStyle = 'rgba(255,0,0,0.5)'; g.beginPath(); g.arc(...P(pr.x, pr.z), (pr.r + 1) * px, 0, 6.283); g.fill();
  const dados = g.getImageData(0, 0, T, T).data;
  const textura = new THREE.CanvasTexture(cv); textura.flipY = false;
  const peso = (x, z) => {
    const i = Math.floor((x - AREA.x0) * px), j = Math.floor((z - AREA.z0) * px);
    if (i < 0 || j < 0 || i >= T || j >= T) return 0;
    const o = (j * T + i) * 4; return Math.max(dados[o], dados[o + 1]) / 255;
  };
  return { textura, peso, area: AREA };
}

// Chão de terra com os caminhos e a praça misturados por shader (uma malha só, sem emenda)
export function misturarChao(mat, masc) {
  const U = {
    uMasc: { value: masc.textura }, uArea: { value: new THREE.Vector3(AREA.x0, AREA.z0, AREA.tam) },
    uCam: { value: textura('stony_dirt_path_diff_1k.jpg', true) }, uCamN: { value: textura('stony_dirt_path_nor_gl_1k.jpg') },
    uPra: { value: textura('cobblestone_floor_01_diff_1k.jpg', true) }, uPraN: { value: textura('cobblestone_floor_01_nor_gl_1k.jpg') },
    uTint: { value: new THREE.Vector3(0.82 / mat.color.r, 0.8 / mat.color.g, 0.78 / mat.color.b) },
  };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = 'varying vec3 vMundo;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.)).xyz;');
    s.fragmentShader = 'varying vec3 vMundo;\nuniform sampler2D uMasc, uCam, uCamN, uPra, uPraN;\nuniform vec3 uArea, uTint;\nvec2 pesoVila;\n' + s.fragmentShader
      .replace('#include <map_fragment>', `
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        vec2 mk = texture2D(uMasc, (vMundo.xz - uArea.xy) / uArea.z).rg;
        vec2 wuv = vec2(vMundo.x, -vMundo.z);
        vec3 cam = texture2D(uCam, wuv / 3.2).rgb, pra = texture2D(uPra, wuv / 2.6).rgb;
        // a borda não é lisa: a própria textura decide onde a terra começa
        float lum = dot(sampledDiffuseColor.rgb, vec3(.6));
        pesoVila.x = smoothstep(.3, .62, mk.r + (lum - .12) * 1.4);
        pesoVila.y = smoothstep(.35, .6, mk.g + (dot(pra, vec3(.5)) - .15) * .8);
        sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, cam * uTint, pesoVila.x);
        sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, pra * uTint * .5, pesoVila.y);
        diffuseColor *= sampledDiffuseColor;`)
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
        mapN = mix(mapN, texture2D(uCamN, vec2(vMundo.x, -vMundo.z) / 3.2).xyz * 2. - 1., pesoVila.x);
        mapN = mix(mapN, texture2D(uPraN, vec2(vMundo.x, -vMundo.z) / 2.6).xyz * 2. - 1., pesoVila.y);`);
  };
}

// ---------- peças ----------
// Caixa com a textura em metros: tile = metros por repetição ([u, v] ou um número), veio = madeira no comprimento da peça
function caixa(w, h, d, m, { tile = 2, veio = false, fixo = false } = {}) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const [tu, tv] = Array.isArray(tile) ? tile : [tile, tile];
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]], ox = fixo ? 0 : rnd(0, 9), oy = fixo ? 0 : rnd(0, 9);
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k, [a, b] = dims[f]; let u = uv.getX(i) * a, v = uv.getY(i) * b;
    if (veio && a > b) [u, v] = [v, u];
    uv.setXY(i, u / tu + ox, v / tv + oy);
  }
  return g.applyMatrix4(m);
}
const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1));
// triângulo (empena) virado para n, textura em metros
function triangulo(a, b, c, n, tile) {
  if (new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).dot(n) < 0) [b, c] = [c, b];
  const g = new THREE.BufferGeometry(), u = Math.abs(n.x) > 0.5 ? 'z' : 'x';
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c].flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([n, n, n].flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([a, b, c].flatMap((p) => [p[u] / tile, p.y / tile]), 2));
  return g;
}
// cilindro com a textura em metros (dentro = virado para dentro)
function cilindro(r0, r1, h, lados, tile, dentro = false) {
  const g = new THREE.CylinderGeometry(r0, r1, h, lados, 1, true), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6.283 * r1 / tile, uv.getY(i) * h / tile);
  if (dentro) {
    const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return g;
}

// Junta todas as peças por material e cria uma malha por material
class Juntador {
  constructor(mats) { this.mats = mats; this.pecas = {}; this.base = new THREE.Matrix4(); }
  add(mat, g) { g.applyMatrix4(this.base); (this.pecas[mat] ||= []).push(g.index ? g.toNonIndexed() : g); }
  malhas() {
    return Object.entries(this.pecas).map(([k, gs]) => {
      gs.forEach((g) => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); });
      const m = new THREE.Mesh(mergeGeometries(gs), this.mats[k]); m.castShadow = m.receiveShadow = true; return m;
    });
  }
}

// ---------- casas ----------
// Parede vista de fora: o = centro no chão, u = direção ao longo dela, n = para fora, L = comprimento
const paredes = (w, d) => [
  { nome: 'frente', o: V(0, 0, d / 2), u: V(1, 0, 0), n: V(0, 0, 1), L: w },
  { nome: 'fundo', o: V(0, 0, -d / 2), u: V(-1, 0, 0), n: V(0, 0, -1), L: w },
  { nome: 'dir', o: V(w / 2, 0, 0), u: V(0, 0, -1), n: V(1, 0, 0), L: d },
  { nome: 'esq', o: V(-w / 2, 0, 0), u: V(0, 0, 1), n: V(-1, 0, 0), L: d },
];
// viga de madeira entre dois pontos (u, y) da parede, um pouco para fora do reboco
function viga(J, p, u0, y0, u1, y1, esp = 0.15, saida = 0.035) {
  const du = u1 - u0, dy = y1 - y0, len = Math.hypot(du, dy) + esp * 0.6;
  const A = p.u.clone().multiplyScalar(du).addScaledVector(CIMA, dy).normalize(), B = new THREE.Vector3().crossVectors(p.n, A);
  const c = p.o.clone().addScaledVector(p.u, (u0 + u1) / 2).addScaledVector(CIMA, (y0 + y1) / 2).addScaledVector(p.n, saida);
  J.add('viga', caixa(len, esp, 0.13, new THREE.Matrix4().makeBasis(A, B, p.n).setPosition(c), { tile: [0.5, 1.6], veio: true }));
}
// peça plana encostada na parede (porta, janela, veneziana)
function placa(J, mat, p, u, y, w, h, prof, saida, opc) {
  const m = new THREE.Matrix4().makeBasis(p.u, CIMA, p.n).setPosition(p.o.clone().addScaledVector(p.u, u).addScaledVector(CIMA, y).addScaledVector(p.n, saida));
  J.add(mat, caixa(w, h, prof, m, opc));
}
function janela(J, p, u, ym) {
  placa(J, 'escuro', p, u, ym + 0.45, 0.78, 0.9, 0.04, 0.0);
  viga(J, p, u, ym, u, ym + 0.9, 0.05, 0.05); viga(J, p, u - 0.39, ym + 0.45, u + 0.39, ym + 0.45, 0.05, 0.05); // cruz da janela
  for (const s of [-1, 1]) placa(J, 'janela', p, u + s * 0.62, ym + 0.46, 0.4, 0.96, 0.04, 0.08, { tile: [0.4, 1] }); // venezianas abertas
}
// enxaimel: postes, travessas e mãos-francesas, pulando portas e janelas
function enxaimel(J, p, Y0, Y1, aberturas) {
  const h = p.L / 2, Ym = Y0 + (Y1 - Y0) * 0.42;
  const livre = (u) => !aberturas.some((a) => Math.abs(u - a.u) < a.w / 2 + 0.12);
  const postes = [-h + 0.07, h - 0.07];
  const n = Math.max(1, Math.round(p.L / 1.8));
  for (let i = 1; i < n; i++) { const u = -h + (i * p.L) / n; if (livre(u)) postes.push(u); }
  for (const a of aberturas) postes.push(a.u - a.w / 2 - 0.08, a.u + a.w / 2 + 0.08);
  postes.sort((a, b) => a - b);
  for (const u of postes) viga(J, p, u, Y0, u, Y1);
  viga(J, p, -h, Y0 + 0.08, h, Y0 + 0.08); viga(J, p, -h, Y1 - 0.08, h, Y1 - 0.08);
  // travessa do meio, cortada nas portas
  let ini = -h;
  for (const a of [...aberturas.filter((a) => a.porta), { u: h + 1, w: 0 }].sort((x, y) => x.u - y.u)) {
    const fim = Math.min(h, a.u - a.w / 2 - 0.08); if (fim > ini + 0.3) viga(J, p, ini, Ym, fim, Ym); ini = a.u + a.w / 2 + 0.08;
  }
  for (const a of aberturas) viga(J, p, a.u - a.w / 2 - 0.1, a.y1 + 0.06, a.u + a.w / 2 + 0.1, a.y1 + 0.06);
  // mãos-francesas nos painéis dos cantos, se estiverem livres
  if (postes.length > 2) {
    const [a0, a1] = [postes[0], postes[1]], [b0, b1] = [postes[postes.length - 2], postes[postes.length - 1]];
    if (a1 - a0 > 0.7 && livre((a0 + a1) / 2)) viga(J, p, a0, Ym, a1, Y1 - 0.08, 0.13);
    if (b1 - b0 > 0.7 && livre((b0 + b1) / 2)) viga(J, p, b1, Ym, b0, Y1 - 0.08, 0.13);
  }
  return Ym;
}
// telhado de duas águas com a cumeeira ao longo da largura (x)
function telhado(J, w, d, Y1, { beiral = 0.5, pontas = 0.38, esp = 0.3, inclinacao = 0.82 } = {}) {
  const sobe = (d / 2) * inclinacao, a = Math.atan2(sobe, d / 2), L = (d / 2 + beiral) / Math.cos(a) + 0.1, topo = Y1 + sobe;
  for (const s of [1, -1]) {
    const base = new THREE.Matrix4().makeTranslation(0, topo, 0).multiply(new THREE.Matrix4().makeRotationX(s * a));
    J.add('telhado', caixa(w + pontas * 2, esp, L, base.clone().multiply(new THREE.Matrix4().makeTranslation(0, esp / 2, s * (L / 2 - 0.1))), { tile: [1.6, 1.6] }));
    for (const x of [-1, 1]) J.add('viga', caixa(0.13, 0.2, L, base.clone().multiply(new THREE.Matrix4().makeTranslation(x * (w / 2 + pontas - 0.1), -0.1, s * (L / 2 - 0.1))), { tile: [0.5, 1.6], veio: true }));
  }
  J.add('telhado', caixa(w + pontas * 2 + 0.06, 0.38, 0.38, M(0, topo + esp / Math.cos(a) - 0.1, 0, Math.PI / 4), { tile: 1.6 }));
  return { sobe, topo };
}

function casa(J, c) {
  const { w, d, h } = c, Y0 = c.aberta ? 0.22 : 0.42, Y1 = Y0 + h;
  J.base = M(c.x, 0, c.z, 0, c.ry);
  J.add('pedra', caixa(w + 0.3, Y0 + 0.14, d + 0.3, M(0, (Y0 - 0.14) / 2, 0), { tile: 1.6 })); // alicerce
  const ps = paredes(w, d);
  const { sobe, topo } = telhado(J, w, d, Y1);
  if (c.aberta) return ferraria(J, c, ps, Y0, Y1, sobe, topo);
  J.add('parede', caixa(w, h, d, M(0, Y0 + h / 2, 0), { tile: 2.4 }));
  const porta = { u: 0, w: 1.1, y1: Y0 + 2.05, porta: true };
  for (const p of ps) {
    const ab = [];
    if (p.nome === 'frente') { ab.push(porta); if (w >= 5) for (const s of [-1, 1]) ab.push({ u: s * Math.min(w / 4 + 0.45, w / 2 - 0.95), w: 0.8, y1: 0 }); }
    else if (p.nome === 'fundo' || p.nome === 'dir' || (p.nome === 'esq' && !c.chamine)) ab.push({ u: 0, w: 0.8, y1: 0 });
    const ym = Y0 + h * 0.42;
    for (const a of ab) if (!a.porta) a.y1 = ym + 0.9;
    enxaimel(J, p, Y0, Y1, ab);
    for (const a of ab) if (!a.porta) janela(J, p, a.u, ym);
    if (p.nome === 'dir' || p.nome === 'esq') { // empena: reboco + vigas
      const x = p.o.x, n = p.n;
      J.add('parede', triangulo(V(x, Y1, -d / 2), V(x, Y1, d / 2), V(x, topo, 0), n, 2.4));
      viga(J, p, 0, Y1, 0, topo - 0.1);
      viga(J, p, -d * 0.24, Y1 + sobe * 0.48, d * 0.24, Y1 + sobe * 0.48);
    }
  }
  const f = ps[0];
  placa(J, 'porta', f, 0, Y0 + 1.025, 1.1, 2.05, 0.08, 0.0, { tile: [1.1, 1.025], fixo: true });
  placa(J, 'ferro', f, 0.38, Y0 + 1.0, 0.05, 0.16, 0.05, 0.06); // maçaneta
  J.add('pedra', caixa(1.6, 0.22, 0.7, M(0, 0.09, d / 2 + 0.45), { tile: 1.2 })); // degrau
  if (c.chamine) {
    const alt = topo + 1.0, x = -(w / 2 + 0.42), z = -d * 0.15;
    J.add('pedra', caixa(0.86, alt, 0.96, M(x, alt / 2 - 0.1, z), { tile: 1.6 }));
    J.add('pedra', caixa(1.02, 0.14, 1.12, M(x, alt - 0.05, z), { tile: 1.2 }));
    J.add('escuro', caixa(0.42, 0.02, 0.5, M(x, alt + 0.03, z)));
  }
}

// ferraria aberta: muro de pedra no fundo, forja com brasa, bigorna
function ferraria(J, c, ps, Y0, Y1, sobe, topo) {
  const { w, d, h } = c;
  for (const p of ps) {
    for (const u of [-p.L / 2 + 0.1, p.L / 2 - 0.1]) viga(J, p, u, Y0, u, Y1, 0.2, -0.1);
    viga(J, p, -p.L / 2, Y1 - 0.1, p.L / 2, Y1 - 0.1, 0.18, -0.1);
  }
  viga(J, ps[0], 0, Y0, 0, Y1, 0.2, -0.1);
  J.add('pedra', caixa(w - 0.2, h, 0.4, M(0, Y0 + h / 2, -d / 2 + 0.25), { tile: 1.6 })); // muro do fundo
  for (const s of [-1, 1]) J.add('pedra', caixa(0.35, 1.05, d * 0.5, M(s * (w / 2 - 0.22), Y0 + 0.52, -d * 0.2), { tile: 1.6 }));
  for (const p of ps.slice(2)) J.add('janela', triangulo(V(p.o.x, Y1, -d / 2), V(p.o.x, Y1, d / 2), V(p.o.x, topo, 0), p.n, 1.4)); // empenas de tábua
  // forja e chaminé
  const fx = -w / 2 + 1.0, fz = -d / 2 + 0.95;
  J.add('pedra', caixa(1.4, 0.85, 1.1, M(fx, Y0 + 0.42, fz), { tile: 1.2 }));
  J.add('brasa', caixa(0.95, 0.06, 0.65, M(fx, Y0 + 0.86, fz + 0.05)));
  const ch = topo + 1.1 - (Y0 + 0.85);
  J.add('pedra', caixa(0.8, ch, 0.75, M(fx, Y0 + 0.85 + ch / 2, -d / 2 + 0.45), { tile: 1.4 }));
  J.add('escuro', caixa(0.4, 0.02, 0.4, M(fx, Y0 + 0.85 + ch + 0.01, -d / 2 + 0.45)));
  // bigorna num toco
  const bx = 0.55, bz = 0.15;
  J.add('viga', caixa(0.5, 0.45, 0.5, M(bx, Y0 + 0.22, bz), { tile: 0.6 }));
  J.add('ferro', caixa(0.22, 0.25, 0.2, M(bx, Y0 + 0.57, bz)));
  J.add('ferro', caixa(0.62, 0.15, 0.24, M(bx - 0.04, Y0 + 0.76, bz)));
  J.add('ferro', new THREE.ConeGeometry(0.09, 0.32, 8).applyMatrix4(M(bx + 0.42, Y0 + 0.77, bz, 0, 0, -Math.PI / 2)));
  // tina d'água para temperar
  J.add('viga', cilindro(0.36, 0.32, 0.6, 14, 0.8).applyMatrix4(M(w / 2 - 0.75, Y0 + 0.3, -d / 2 + 0.85)));
  J.add('agua', new THREE.CircleGeometry(0.33, 14).applyMatrix4(M(w / 2 - 0.75, Y0 + 0.52, -d / 2 + 0.85, -Math.PI / 2)));
}

function poco(J, pr) {
  J.base = M(pr.x, 0, pr.z, 0, 0.6);
  J.add('pedra', cilindro(1.0, 1.04, 0.9, 22, 1.6).applyMatrix4(M(0, 0.4, 0)));
  J.add('pedra', cilindro(0.74, 0.74, 0.9, 22, 1.6, true).applyMatrix4(M(0, 0.4, 0)));
  const aro = new THREE.RingGeometry(0.74, 1.04, 22, 1); const uv = aro.attributes.uv, pos = aro.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 1.2, pos.getY(i) / 1.2);
  J.add('pedra', aro.applyMatrix4(M(0, 0.85, 0, -Math.PI / 2)));
  J.add('agua', new THREE.CircleGeometry(0.75, 22).applyMatrix4(M(0, 0.25, 0, -Math.PI / 2)));
  const frente = { o: V(0, 0, 0), u: V(1, 0, 0), n: V(0, 0, 1), L: 2.4 };
  for (const s of [-1, 1]) viga(J, frente, s * 1.1, 0.75, s * 1.1, 2.35, 0.16, 0);
  viga(J, frente, -1.25, 2.2, 1.25, 2.2, 0.12, 0); // sarilho
  J.add('ferro', caixa(0.02, 1.5, 0.02, M(0.2, 1.45, 0)));
  // telhadinho
  for (const s of [1, -1]) J.add('telhado', caixa(2.9, 0.18, 1.15, M(0, 2.62, s * 0.42, s * 0.62), { tile: 1.6 }));
}

// ---------- árvores ----------
// Tronco e galhos com casca de verdade; copa de cartões com folhas recortadas (folhagem.png, das folhas CC0 da Poly Haven).
// Três modelos; cada um vira um InstancedMesh (tronco) + outro (copa).
function modeloArvore(v) {
  semente = 500 + v * 77;
  const H = [3.3, 4.1, 2.8][v], troncos = [], cartas = [], copa = V(0, H + 1.3, 0);
  const t = new THREE.CylinderGeometry(0.15, 0.3, H + 0.8, 10, 8, true), p = t.attributes.position, uv = t.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + (H + 0.8) / 2, k = y < 0.5 ? 1 + (0.5 - y) * 0.9 : 1; // pé mais largo
    p.setXYZ(i, p.getX(i) * k + Math.sin(y * 0.9 + v) * 0.1 * y / H, y - 0.15, p.getZ(i) * k + Math.cos(y * 0.7 + v * 2) * 0.08 * y / H);
    uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * (H + 0.8) / 1.3);
  }
  t.computeVertexNormals(); troncos.push(t);
  const cacho = (P, D, n, tam) => {
    for (let k = 0; k < n; k++) {
      const up = D.clone().add(V(rnd(-0.7, 0.7), rnd(-0.2, 0.6), rnd(-0.7, 0.7))).normalize();
      const lado = new THREE.Vector3().crossVectors(up, V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1))).normalize(), fr = new THREE.Vector3().crossVectors(lado, up);
      const s = tam * rnd(0.8, 1.2), g = new THREE.PlaneGeometry(s, s); g.translate(0, s / 2 - 0.2, 0);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(lado, up, fr).setPosition(P));
      // normais apontando para fora da copa: a luz cai como numa copa redonda, não em cartões
      const q = g.attributes.position, nn = g.attributes.normal;
      for (let i = 0; i < q.count; i++) { const o = V(q.getX(i), q.getY(i), q.getZ(i)).sub(copa).normalize().add(V(0, 0.35, 0)).normalize(); nn.setXYZ(i, o.x, o.y, o.z); }
      cartas.push(g);
    }
  };
  const ng = 8 + v * 2;
  for (let i = 0; i < ng; i++) {
    const ang = i * 2.4 + rnd(-0.4, 0.4), y0 = H * rnd(0.5, 0.95), len = rnd(1.6, 2.6), elev = rnd(0.25, 0.85);
    const D = V(Math.cos(ang) * Math.cos(elev), Math.sin(elev), Math.sin(ang) * Math.cos(elev));
    const g = new THREE.CylinderGeometry(0.035, 0.1, len, 6, 1, true); g.translate(0, len / 2, 0);
    const uvg = g.attributes.uv; for (let k = 0; k < uvg.count; k++) uvg.setXY(k, uvg.getX(k), uvg.getY(k) * len / 1.3);
    const P0 = V(0, y0, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(CIMA, D)).setPosition(P0));
    troncos.push(g);
    cacho(P0.clone().addScaledVector(D, len * 0.5), D, 3, 1.7);
    cacho(P0.clone().addScaledVector(D, len), D, 4, 2.1);
  }
  cacho(V(0, H + 0.6, 0), CIMA, 5, 2.2); // topo
  for (let k = 0; k < 10; k++) { // miolo: enche a copa por dentro
    const D = V(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize();
    cacho(copa.clone().addScaledVector(D, rnd(0.3, 1.3)), D, 1, 2.4);
  }
  const limpo = (gs) => mergeGeometries(gs.map((g) => { const n = g.toNonIndexed(); return n; }));
  return { tronco: limpo(troncos), copa: limpo(cartas) };
}

function arvores(scene, lista) {
  const casca = pbr('bark_brown_02', { color: 0xb0a090 });
  const mapaF = textura('folhagem.png', true);
  const folha = new THREE.MeshStandardMaterial({ map: mapaF, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: 0xa6b884 });
  const uTime = { value: 0 };
  folha.onBeforeCompile = (s) => {
    s.uniforms.uTime = uTime;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 raiz = instanceMatrix * vec4(0., 0., 0., 1.);
      float k = max(position.y - 2., 0.) * .03;
      transformed.x += sin(uTime * 1.3 + raiz.x * .3 + position.y * .7) * k;
      transformed.z += cos(uTime * 1.1 + raiz.z * .3 + position.x * .9) * k * .7;`);
    // as duas faces usam a mesma normal (a da copa): o verso não fica escuro
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  const sombraF = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mapaF, alphaTest: 0.45 });
  const d = new THREE.Object3D(), cor = new THREE.Color();
  for (let v = 0; v < 3; v++) {
    const minhas = lista.filter((a) => a.v === v); if (!minhas.length) continue;
    const m = modeloArvore(v);
    const tr = new THREE.InstancedMesh(m.tronco, casca, minhas.length), co = new THREE.InstancedMesh(m.copa, folha, minhas.length);
    co.customDepthMaterial = sombraF;
    minhas.forEach((a, i) => {
      d.position.set(a.x, 0, a.z); d.rotation.set(0, a.ry, 0); d.scale.setScalar(a.s); d.updateMatrix();
      tr.setMatrixAt(i, d.matrix); co.setMatrixAt(i, d.matrix);
      co.setColorAt(i, cor.setHSL(0.22 + (i % 5) * 0.012, 0.35, 0.62 + (i % 3) * 0.06)); // cada árvore num verde um pouco diferente
    });
    for (const o of [tr, co]) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; scene.add(o); }
  }
  return uTime;
}

export function montarVila(scene, mapa) {
  const vila = mapa.vila;
  const mats = {
    parede: pbr('worn_mossy_plasterwall', { color: 0xf0e8dc }),
    viga: pbr('wood_shutter', { color: 0x8a6c55 }),
    telhado: pbr('thatch_roof_angled', { color: 0xd8c49a }),
    pedra: pbr('stacked_stone_wall', { color: 0xcfc6bc }),
    porta: pbr('wooden_gate'),
    janela: pbr('medieval_wood', { color: 0xb8a48e }),
    escuro: new THREE.MeshStandardMaterial({ color: 0x120e0b, roughness: 0.95 }),
    ferro: new THREE.MeshStandardMaterial({ color: 0x3a3938, metalness: 0.85, roughness: 0.42 }),
    brasa: new THREE.MeshStandardMaterial({ color: 0x1a0904, emissive: 0xff5a14, emissiveIntensity: 1.8, roughness: 1 }),
    agua: new THREE.MeshStandardMaterial({ color: 0x0c1719, roughness: 0.06, metalness: 0.3 }),
  };
  const J = new Juntador(mats);
  semente = 99;
  for (const c of vila.casas) casa(J, c);
  poco(J, vila.praca);
  for (const m of J.malhas()) scene.add(m);
  const tempo = arvores(scene, vila.arvores);
  return { atualizar: (t) => { tempo.value = t; mats.brasa.emissiveIntensity = 1.6 + Math.sin(t * 3.1) * 0.25 + Math.sin(t * 7.3) * 0.12; } };
}

// Câmera não entra nas casas: se a linha herói -> câmera passa por dentro de uma, a câmera chega mais perto
export function cameraForaDasCasas(vila) {
  const caixas = vila.casas.map((c) => ({ x: c.x, z: c.z, cos: Math.cos(c.ry), sin: Math.sin(c.ry), hw: c.w / 2 + 0.6, hd: c.d / 2 + 0.7, alt: (c.aberta ? 0.22 : 0.42) + c.h + (c.d / 2) * 0.82 + 0.4 }));
  const dentro = (x, y, z) => caixas.some((k) => {
    const dx = x - k.x, dz = z - k.z;
    return y < k.alt && Math.abs(dx * k.cos - dz * k.sin) < k.hw && Math.abs(dx * k.sin + dz * k.cos) < k.hd;
  });
  return (camera, alvo) => {
    const p = camera.position, dx = p.x - alvo.x, dy = p.y - alvo.y, dz = p.z - alvo.z;
    for (let t = 0.15; t <= 1; t += 0.05) {
      if (dentro(alvo.x + dx * t, alvo.y + dy * t, alvo.z + dz * t)) { const k = Math.max(0.12, t - 0.08); p.set(alvo.x + dx * k, alvo.y + dy * k, alvo.z + dz * k); return; }
    }
  };
}
