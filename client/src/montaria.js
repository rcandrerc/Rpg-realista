// Montarias: o modelo (GLB com esqueleto e animações) carrega uma vez e cada jogador montado ganha a sua cópia.
// Por cima vai um contorno fino (casco invertido), como o dos personagens VRoid.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MONTARIAS } from '@rpg/shared';
import { carregarGLTF } from './cena.js';
import { anime, toon } from './estilo.js';

const modelos = new Map(); // id -> Promise<gltf>
const COR_CONTORNO = 0x1b2333;

function contorno(espessura) {
  const m = new THREE.MeshBasicMaterial({ color: COR_CONTORNO, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${espessura.toFixed(4)};`);
  };
  return m;
}

// Estados do jogador -> animação da montaria
const ANIM = { Walk: 'andar', Run: 'correr' };

export class Montaria {
  constructor(id, pai) {
    this.dados = MONTARIAS[id]; this.pai = pai;
    this.grupo = new THREE.Group(); this.grupo.scale.setScalar(this.dados.escala);
    pai.add(this.grupo);
    if (!modelos.has(id)) modelos.set(id, carregarGLTF(this.dados.modelo));
    modelos.get(id).then((g) => this.montar(g)).catch((e) => console.error('Montaria', id, e));
  }
  montar(g) {
    if (this.removido) return;
    const m = SkeletonUtils.clone(g.scene);
    const malhas = [];
    m.traverse((o) => { if (o.isSkinnedMesh) malhas.push(o); });
    for (const o of malhas) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (anime) o.material = toon(o.material);
      const borda = new THREE.SkinnedMesh(o.geometry, contorno(0.015 / this.dados.escala));
      borda.bind(o.skeleton, o.bindMatrix); borda.frustumCulled = false;
      o.parent.add(borda);
    }
    this.grupo.add(m);
    this.sela = m.getObjectByName('coluna');
    this.mixer = new THREE.AnimationMixer(m);
    this.clipes = Object.fromEntries(g.animations.map((c) => [c.name, c]));
    this.atual = null; this.tocar(this.estado || 'parado');
  }
  tocar(nome) {
    if (!this.mixer) { this.estado = nome; return; }
    if (this.atual === nome) return;
    const a = this.mixer.clipAction(this.clipes[nome]); if (!a) return;
    a.reset().fadeIn(0.2).play();
    if (this.atual) this.mixer.clipAction(this.clipes[this.atual]).fadeOut(0.2);
    this.atual = nome;
  }
  aplicar(anim) { this.tocar(ANIM[anim] || 'parado'); }
  atualizar(dt) { this.mixer?.update(dt); }
  // onde o quadril do cavaleiro fica, no espaço do pai
  posSela(alvo) {
    if (!this.sela) return null;
    this.pai.updateMatrixWorld(true);
    return this.pai.worldToLocal(this.sela.getWorldPosition(alvo));
  }
  remover() { this.removido = true; this.pai.remove(this.grupo); }
}
