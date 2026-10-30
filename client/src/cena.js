// Renderizador, céu, chão, grama e objetos do mapa.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Terreno } from '@rpg/shared';

export const gltfLoader = new GLTFLoader();
export const carregarGLTF = (url) => gltfLoader.loadAsync(url);

export function criarRenderizador(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
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
  const chao = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.MeshStandardMaterial({
    map: ladrilho('assets/cenario/chao/forrest_ground_01_diff_1k.jpg', 70, true),
    normalMap: ladrilho('assets/cenario/chao/forrest_ground_01_nor_gl_1k.jpg', 70),
    normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95, color: 0xa89f8c,
  }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);

  const grama = criarGrama(mapa.raio);
  scene.add(grama.mesh);
  await colocarObjetos(scene, mapa);
  return { scene, sol, atualizar: (t) => { grama.uniforms.uTime.value = t; } };
}

function rnd(a, b) { return a + Math.random() * (b - a); }

// Grama instanciada que balança com o vento
function criarGrama(raio) {
  const uniforms = { uTime: { value: 0 } };
  const g = new THREE.PlaneGeometry(0.06, 0.3, 1, 3); g.translate(0, 0.15, 0);
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
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * raio * 1.15;
    d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); d.rotation.set(0, Math.random() * 6.283, 0);
    const s = rnd(0.7, 1.3); d.scale.set(s, s * rnd(0.6, 1.4), s); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    cor.setHSL(rnd(0.16, 0.24), rnd(0.25, 0.45), rnd(0.16, 0.3)); mesh.setColorAt(i, cor);
  }
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}

// Pedras, samambaias e caixotes do Poly Haven, nas posições do mapa
async function colocarObjetos(scene, mapa) {
  const [pedras, samambaia, caixote, rocha] = await Promise.all([
    carregarGLTF('assets/cenario/rock_moss_set_01/rock_moss_set_01_1k.gltf'),
    carregarGLTF('assets/cenario/fern_02/fern_02_1k.gltf'),
    carregarGLTF('assets/cenario/wooden_crate_01/wooden_crate_01_1k.gltf'),
    carregarGLTF('assets/cenario/namaqualand_boulder_04/namaqualand_boulder_04_2k.gltf'),
  ]);
  const sombra = (o) => o.traverse((c) => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; } });
  const partes = []; pedras.scene.traverse((o) => { if (o.isMesh) partes.push(o); });
  let semente = 7; const srnd = (a, b) => { semente = (semente * 16807) % 2147483647; return a + (semente / 2147483647) * (b - a); };
  const pedra = (i, x, z, s) => {
    const o = partes[i % partes.length].clone(); o.position.set(x, -0.1, z); o.rotation.set(0, srnd(0, 6.28), 0);
    o.scale.setScalar(s); o.castShadow = o.receiveShadow = true; scene.add(o);
  };
  // anel de pedras que fecha a área
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * 6.283 + srnd(-0.05, 0.05), r = mapa.raio + srnd(-1, 2.5);
    pedra(i, Math.cos(a) * r, Math.sin(a) * r, srnd(2.6, 5.2));
  }
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
  for (let i = 0; i < 70; i++) { const a = srnd(0, 6.28), r = Math.sqrt(srnd(0.05, 1)) * (mapa.raio - 1.5); por(samambaia.scene, Math.cos(a) * r, Math.sin(a) * r, srnd(0.7, 1.4), srnd(0, 6.28)); }
  // canto do ferreiro
  por(caixote.scene, -3.2, -5.4, 1, 0.4); por(caixote.scene, -2.4, -6.1, 0.8, 1.1); por(caixote.scene, -3.0, -5.5, 0.7, 0.9, 0.62);
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
