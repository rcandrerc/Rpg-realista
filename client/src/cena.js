// Renderizador, céu, chão, grama e objetos do mapa.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Terreno } from '@rpg/shared';
import { mascaraVila, misturarChao, montarVila } from './vila.js';
import { anime, PALETA } from './estilo.js';

export const gltfLoader = new GLTFLoader();
export const carregarGLTF = (url) => gltfLoader.loadAsync(url);

export const RESOLUCAO_MAX = Math.min(devicePixelRatio, 1.75);

export function criarRenderizador(canvas) {
  // No estilo pintado a cena é desenhada num alvo que já tem antisserrilhado (estilo.js); a tela só recebe o passe
  // de cor por cima. Ligar o antisserrilhado da tela também gastava memória e banda à toa, todo quadro.
  const msaaNoPasse = anime && typeof WebGL2RenderingContext !== 'undefined';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !msaaNoPasse, powerPreference: 'high-performance' });
  renderer.setPixelRatio(RESOLUCAO_MAX);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export async function montarCena(renderer, mapa) {
  const scene = new THREE.Scene();

  // Céu HDRI da Poly Haven: ilumina a cena e serve de fundo
  const ceu = await new RGBELoader().loadAsync('assets/ceu/kloofendal_48d_partly_cloudy_puresky_1k.hdr');
  ceu.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(ceu).texture;
  scene.background = ceu;
  scene.fog = new THREE.FogExp2(0xc5cdd0, 0.018);

  const sol = new THREE.DirectionalLight(0xfff0d6, 2.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1536, 1536);
  Object.assign(sol.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02;
  scene.add(sol, sol.target);
  scene.add(new THREE.HemisphereLight(0xcfdde6, 0x3b3424, 0.35));

  // Chão com textura PBR (forrest_ground_01)
  const texL = new THREE.TextureLoader();
  const ladrilho = (url, rep, srgb) => {
    const t = texL.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  };
  const matChao = new THREE.MeshStandardMaterial({
    map: ladrilho('assets/cenario/chao/forrest_ground_01_diff_1k.jpg', 70, true),
    normalMap: ladrilho('assets/cenario/chao/forrest_ground_01_nor_gl_1k.jpg', 70),
    normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95, color: anime ? 0xe8f0d8 : 0xa89f8c,
  });
  // caminhos de terra e a praça de pedra entram no próprio chão (vila.js)
  const masc = mascaraVila(mapa.vila);
  misturarChao(matChao, masc);
  const chao = new THREE.Mesh(new THREE.CircleGeometry(160, 64), matChao);
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);

  const grama = criarGrama(mapa.raio, masc);
  scene.add(grama.mesh);
  const vila = montarVila(scene, mapa);
  await colocarObjetos(scene, mapa, masc);
  return { scene, sol, atualizar: (t) => { grama.uniforms.uTime.value = t; vila.atualizar(t); } };
}

function rnd(a, b) { return a + Math.random() * (b - a); }

// Grama instanciada que balança com o vento (não nasce nos caminhos, na praça nem nas casas)
function criarGrama(raio, masc) {
  const uniforms = { uTime: { value: 0 } };
  const g = new THREE.PlaneGeometry(0.06, 0.3, 1, 2); g.translate(0, 0.15, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * 1.7)); p.setZ(i, y * y * 0.4); }
  const m = new THREE.MeshStandardMaterial({ color: 0x8a9450, roughness: 0.95, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = uniforms.uTime;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0., 0., 0., 1.);
      float k = position.y * position.y * 8.;
      transformed.x += sin(uTime * 1.7 + wp.x * .35 + wp.z * .2) * .09 * k;
      transformed.z += cos(uTime * 1.3 + wp.z * .4) * .05 * k;`);
  };
  const N = matchMedia('(pointer:coarse)').matches ? 22000 : 40000;
  const mesh = new THREE.InstancedMesh(g, m, N);
  const d = new THREE.Object3D(), cor = new THREE.Color();
  for (let i = 0; i < N; i++) {
    let a, r, k = 0;
    do { a = Math.random() * 6.283; r = Math.sqrt(Math.random()) * raio * 1.15; } while (masc.peso(Math.cos(a) * r, Math.sin(a) * r) > 0.2 && ++k < 20);
    d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); d.rotation.set(0, Math.random() * 6.283, 0);
    const s = rnd(0.7, 1.3); d.scale.set(s, s * rnd(0.6, 1.4), s); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    if (anime) { const [h, sa, l] = PALETA.grama; cor.setHSL(rnd(...h), rnd(...sa), rnd(...l)); } // grama de desenho: verde vivo
    else cor.setHSL(rnd(0.16, 0.24), rnd(0.25, 0.45), rnd(0.16, 0.3));
    mesh.setColorAt(i, cor);
  }
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}

// Muitas cópias do mesmo modelo viram InstancedMesh: uma chamada de desenho por parte, não por cópia
// (src = cena de um glTF, com as posições das partes; ou uma malha solta, usada como está na origem)
function instanciar(scene, src, lista, sombra = true) {
  src.updateMatrixWorld(true);
  const d = new THREE.Object3D(), m = new THREE.Matrix4(), solta = src.isMesh;
  src.traverse((o) => {
    if (!o.isMesh || !lista.length) return;
    const base = solta ? new THREE.Matrix4() : o.matrixWorld;
    const im = new THREE.InstancedMesh(o.geometry, o.material, lista.length);
    lista.forEach((p, i) => {
      d.position.set(p.x, p.y || 0, p.z); d.rotation.set(0, p.ry || 0, 0); d.scale.setScalar(p.s || 1); d.updateMatrix();
      im.setMatrixAt(i, m.multiplyMatrices(d.matrix, base));
    });
    im.castShadow = sombra; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  });
}

// Pedras, samambaias e caixotes do Poly Haven, nas posições do mapa
async function colocarObjetos(scene, mapa, masc) {
  const [pedras, pedrasLonge, samambaia, caixote, rocha, mesa, balde, toco] = await Promise.all([
    carregarGLTF('assets/cenario/rock_moss_set_01/rock_moss_set_01_leve.gltf'), // versões simplificadas: perto e longe
    carregarGLTF('assets/cenario/rock_moss_set_01/rock_moss_set_01_longe.gltf'),
    carregarGLTF('assets/cenario/fern_02/fern_02_leve.gltf'),
    carregarGLTF('assets/cenario/wooden_crate_01/wooden_crate_01_1k.gltf'),
    carregarGLTF('assets/cenario/namaqualand_boulder_04/namaqualand_boulder_04_leve.gltf'), // versão simplificada (12 mil triângulos)
    carregarGLTF('assets/cenario/wooden_table_02/wooden_table_02_1k.gltf'),
    carregarGLTF('assets/cenario/wooden_bucket_02/wooden_bucket_02_1k.gltf'),
    carregarGLTF('assets/cenario/tree_stump_01/tree_stump_01_leve.gltf'),
  ]);
  const sombra = (o) => o.traverse((c) => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; } });
  const partes = [], longe = [];
  pedras.scene.traverse((o) => { if (o.isMesh) partes.push(o); });
  pedrasLonge.scene.traverse((o) => { if (o.isMesh) longe.push(o); });
  let semente = 7; const srnd = (a, b) => { semente = (semente * 16807) % 2147483647; return a + (semente / 2147483647) * (b - a); };
  // anel de pedras que fecha a área (uma InstancedMesh por tipo de pedra)
  const anel = longe.map(() => []);
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * 6.283 + srnd(-0.05, 0.05), r = mapa.raio + srnd(-1, 2.5);
    anel[i % longe.length].push({ x: Math.cos(a) * r, y: -0.1, z: Math.sin(a) * r, ry: srnd(0, 6.28), s: srnd(2.6, 5.2) });
  }
  longe.forEach((o, i) => instanciar(scene, o, anel[i]));
  // pedras do caminho: mesma posição, giro e tamanho que o servidor usa para saber a altura (shared/terreno.js)
  let malhaRocha; rocha.scene.traverse((o) => { if (o.isMesh) malhaRocha = o; });
  for (const r of mapa.rochas) {
    const o = (r.modelo === 'boulder04' ? malhaRocha : partes[+r.modelo.slice(5)]).clone();
    o.position.set(r.x, r.y || 0, r.z); o.rotation.set(0, r.ry, 0); o.scale.setScalar(r.s);
    o.castShadow = o.receiveShadow = true; scene.add(o);
  }
  const terreno = new Terreno(mapa), texL = new THREE.TextureLoader();
  const madeira = new THREE.MeshStandardMaterial({
    map: texL.load('assets/cenario/madeira/weathered_brown_planks_diff_1k.jpg', (t) => { t.encoding = THREE.sRGBEncoding; }),
    normalMap: texL.load('assets/cenario/madeira/weathered_brown_planks_nor_gl_1k.jpg'),
    roughnessMap: texL.load('assets/cenario/madeira/weathered_brown_planks_arm_1k.jpg'), metalness: 0,
  });
  madeira.map.encoding = THREE.sRGBEncoding;
  for (const e of mapa.escadas || []) scene.add(escadaDeMadeira(e, terreno.altura(e.topo.x, e.topo.z), madeira));
  const por = (src, x, z, s, ry, y = 0) => { const o = src.clone(); o.position.set(x, y, z); o.scale.setScalar(s); o.rotation.y = ry; sombra(o); scene.add(o); };
  // samambaias: soltas pelo mapa e em volta das árvores, fora dos caminhos (sem sombra: são muitas e baixas)
  const fetos = [];
  for (let i = 0; i < 40; i++) {
    const a = srnd(0, 6.28), r = Math.sqrt(srnd(0.05, 1)) * (mapa.raio - 1.5), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (masc.peso(x, z) < 0.1) fetos.push({ x, z, s: srnd(0.7, 1.4), ry: srnd(0, 6.28) });
  }
  for (const a of mapa.vila.arvores) if (srnd(0, 1) < 0.4 && masc.peso(a.x, a.z) < 0.1) fetos.push({ x: a.x + srnd(-1, 1), z: a.z + srnd(-1, 1), s: srnd(0.6, 1.1), ry: srnd(0, 6.28) });
  instanciar(scene, samambaia.scene, fetos, false);
  // caixotes ao lado da ferraria, banca da comerciante, baldes e tocos
  for (const p of mapa.props || []) por({ caixote, mesa, balde, toco }[p.tipo].scene, p.x, p.z, p.s || 1, p.ry || 0, p.y || 0);
}

// Escada de madeira encostada na rocha: duas laterais e degraus a cada 30 cm, tudo numa malha só
function escadaDeMadeira(e, alt, material) {
  const base = new THREE.Vector3(e.x, 0, e.z), topo = new THREE.Vector3(e.topo.x, alt, e.topo.z);
  const dir = topo.clone().sub(base), comp = dir.length() + 0.45; dir.normalize(); // passa um pouco da beirada
  const lado = new THREE.Vector3(Math.cos(e.ry), 0, -Math.sin(e.ry)), frente = new THREE.Vector3().crossVectors(lado, dir).normalize();
  const giro = new THREE.Matrix4().makeBasis(lado, dir, frente);
  const peca = (larg, alt2, prof, x, y, rz = 0) => {
    const g = new THREE.BoxGeometry(larg, alt2, prof);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * larg * 0.6 + x, uv.getY(i) * alt2 * 0.6 + y); // madeira sem esticar
    g.rotateZ(rz); g.translate(x, y, 0); return g;
  };
  const partes = [peca(0.07, comp, 0.06, -0.24, comp / 2, 0.01), peca(0.07, comp, 0.06, 0.24, comp / 2, -0.01)];
  for (let y = 0.3; y < comp - 0.2; y += 0.3) partes.push(peca(0.56, 0.045, 0.045, 0, y, Math.sin(y * 7) * 0.015));
  const g = mergeGeometries(partes); g.applyMatrix4(giro);
  const m = new THREE.Mesh(g, material); m.position.copy(base); m.castShadow = m.receiveShadow = true;
  return m;
}
