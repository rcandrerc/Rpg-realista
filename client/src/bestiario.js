// Monstros do Bestiário (Quaternius, versão grátis: Puglin e Imp), inimigos do jogo. O tipo do inimigo
// (TIPOS_INIMIGO em shared/dados.js) usa visual 'bst:<Nome>'; o corpo (personagens.js) monta o monstro daqui.
// As animações vêm da Universal Animation Library, convertidas para o esqueleto deles (converter-bestiario.html).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gunzipSync, strFromU8 } from 'fflate';
import { A, DURACAO } from '@rpg/shared';
import { carregarGLTF } from './cena.js';
import { anime, toon } from './estilo.js';

// Nome no jogo -> animação da Universal Animation Library (mesmo esqueleto dos monstros). O kit grátis não traz
// animação própria; escolhemos as mais "de monstro" (zumbi, garra, soco) em vez das de espada.
export const ESCOLHA_ANIMS = {
  Puglin: {
    Idle: 'Zombie_Idle_Loop', Walk: 'Zombie_Walk_Fwd_Loop', Run: 'Jog_Fwd_Loop', [A.swordIdle]: 'Zombie_Idle_Loop',
    [A.slash]: 'Zombie_Scratch', [A.slash2]: 'Melee_Hook', [A.hit]: 'Hit_Chest', [A.death]: 'Death01',
  },
  Imp: {
    Idle: 'Idle_Loop', Walk: 'Walk_Loop', Run: 'Sprint_Loop', [A.swordIdle]: 'Sword_Idle',
    [A.slash]: 'Sword_Regular_A', [A.slash2]: 'Zombie_Scratch', [A.hit]: 'Hit_Chest', [A.death]: 'Death01',
  },
};

// Altura de cada um (m, do pé à cabeça). Direção de arte: Imp na altura do ombro da Ruiva (~85%), Puglin como veio.
const ALTURA = { Imp: 1.36, Puglin: null };
const cache = new Map();
function carregar(nome) {
  if (!cache.has(nome)) cache.set(nome, (async () => {
    const [g, gz] = await Promise.all([
      carregarGLTF(`assets/monstros/bestiario/${nome}.glb`),
      fetch(`assets/monstros/bestiario/anims_${nome}.json.gz`).then((r) => r.arrayBuffer()),
    ]);
    const json = JSON.parse(strFromU8(gunzipSync(new Uint8Array(gz))));
    const clipes = {};
    for (const j of json) {
      const c = THREE.AnimationClip.parse(j);
      // golpes, dano e morte: estica ou encolhe para durar o mesmo que a animação do servidor (o golpe acerta no tempo certo)
      const alvo = DURACAO[c.name];
      if (alvo && c.duration > 0) { const k = alvo / c.duration; for (const t of c.tracks) t.times = t.times.map((x) => x * k); c.duration = alvo; }
      clipes[c.name] = c;
    }
    prepararMateriais(g.scene);
    return { g, clipes };
  })());
  return cache.get(nome);
}

// Cores 25% menos saturadas (direção de arte) e material toon como o resto do mundo pintado
const pintados = new WeakMap();
function desaturar(tex, quanto) {
  if (!tex?.image || pintados.has(tex)) return pintados.get(tex) || tex;
  const img = tex.image, c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    p[i] += (l - p[i]) * quanto; p[i + 1] += (l - p[i + 1]) * quanto; p[i + 2] += (l - p[i + 2]) * quanto;
  }
  ctx.putImageData(d, 0, 0);
  const t = tex.clone(); t.image = c; t.needsUpdate = true;
  pintados.set(tex, t); return t;
}
function prepararMateriais(raiz) {
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.map) m.map = desaturar(m.map, 0.25);
    o.material = anime ? toon(m) : m;
  });
}

// Contorno escuro por fora (casca invertida), como o contorno do MToon da Ruiva
function contorno(mesh, espessura) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a1210, side: THREE.BackSide });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uEsp = { value: espessura };
    s.vertexShader = 'uniform float uEsp;\n' + s.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * uEsp;');
  };
  const c = new THREE.SkinnedMesh(mesh.geometry, mat);
  c.bind(mesh.skeleton, mesh.bindMatrix); c.frustumCulled = false; c.castShadow = false;
  mesh.parent.add(c); c.position.copy(mesh.position); c.quaternion.copy(mesh.quaternion); c.scale.copy(mesh.scale);
}

// Monta o monstro dentro do corpo (personagens.js). Devolve { cena, mixer, clipes, maos }.
export async function montarMonstro(nome) {
  const { g, clipes } = await carregar(nome);
  const cena = SkeletonUtils.clone(g.scene);
  const malhas = [];
  cena.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; malhas.push(o); } });
  // altura pela cabeça (a caixa de malha com esqueleto não serve)
  cena.updateMatrixWorld(true);
  const cabeca = cena.getObjectByName('Head');
  const h = cabeca ? cabeca.getWorldPosition(new THREE.Vector3()).y : 1; // os pés ficam no zero
  const escala = ALTURA[nome] && h > 0 ? ALTURA[nome] / (h * 1.1) : 1; // a cabeça fica ~10% abaixo do topo
  cena.scale.multiplyScalar(escala);
  cena.updateMatrixWorld(true);
  for (const m of malhas) if (m.isSkinnedMesh) contorno(m, 0.012 / m.getWorldScale(new THREE.Vector3()).x);
  const mixer = new THREE.AnimationMixer(cena);
  const maos = [cena.getObjectByName('hand_r'), cena.getObjectByName('hand_l')];
  return { cena, mixer, clipes, maos };
}
