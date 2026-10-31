// Montarias: o modelo (GLB com esqueleto e animações) carrega uma vez e cada jogador montado ganha a sua cópia.
// Por cima vai um contorno fino (casco invertido), como o dos personagens VRoid.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MONTARIAS } from '@rpg/shared';
import { carregarGLTF } from './cena.js';
import { anime, toon } from './estilo.js';

const modelos = new Map(); // id -> Promise<gltf>
const COR_CONTORNO = 0x1b2333;
const TMP_V = new THREE.Vector3(), TMP_Q = new THREE.Quaternion(), TMP_Q2 = new THREE.Quaternion(), TMP_Q3 = new THREE.Quaternion();

function contorno(espessura) {
  const m = new THREE.MeshBasicMaterial({ color: COR_CONTORNO, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${espessura.toFixed(4)};`);
  };
  return m;
}

// Baixa os modelos logo no começo: tocar no lobo não espera o download (no 4G levava vários segundos)
export function prepararMontarias() {
  for (const [id, d] of Object.entries(MONTARIAS)) if (!modelos.has(id)) modelos.set(id, carregarGLTF(d.modelo));
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
      if (o.material.alphaTest > 0) continue; // mechas de pelo (cartões recortados): sem contorno
      const borda = new THREE.SkinnedMesh(o.geometry, contorno(0.015 / this.dados.escala));
      borda.bind(o.skeleton, o.bindMatrix); borda.frustumCulled = false;
      o.parent.add(borda);
    }
    this.grupo.add(m);
    this.sela = m.getObjectByName('coluna'); this.selaFrente = m.getObjectByName('peito');
    this.nuca = m.getObjectByName('cabeca'); // começo da cabeça: logo atrás das orelhas
    this.rabo = [1, 2, 3, 4, 5].map((i) => m.getObjectByName('cauda' + i)).filter(Boolean);
    this.mola = { ang: 0, vel: 0, ry: null };
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
  atualizar(dt) {
    if (!this.mixer) return;
    this.mixer.update(dt);
    this.balancarRabo(dt);
  }
  // Rabo com mola: quando o lobo vira, o rabo fica para trás e depois balança até assentar (mais solto na ponta)
  balancarRabo(dt) {
    const r = this.rabo, mo = this.mola; if (!r?.length || dt <= 0) return;
    this.grupo.getWorldQuaternion(TMP_Q); TMP_V.set(0, 0, 1).applyQuaternion(TMP_Q);
    const ry = Math.atan2(TMP_V.x, TMP_V.z);
    if (mo.ry === null) mo.ry = ry;
    const giro = Math.atan2(Math.sin(ry - mo.ry), Math.cos(ry - mo.ry)) / dt; mo.ry = ry;
    const alvo = THREE.MathUtils.clamp(-giro * 0.12, -0.5, 0.5);
    mo.vel += ((alvo - mo.ang) * 60 - mo.vel * 7) * Math.min(dt, 0.05);
    mo.ang += mo.vel * Math.min(dt, 0.05);
    if (Math.abs(mo.ang) < 1e-3) return;
    this.grupo.updateWorldMatrix(true, true);
    r.forEach((osso, i) => {
      // gira em volta do "para cima" do mundo, no espaço do pai do osso
      osso.parent.getWorldQuaternion(TMP_Q2);
      TMP_Q3.setFromAxisAngle(TMP_V.set(0, 1, 0).applyQuaternion(TMP_Q2.clone().invert()), mo.ang * (0.35 + 0.15 * i));
      osso.quaternion.premultiply(TMP_Q3);
      osso.updateWorldMatrix(false, true);
    });
  }
  // onde o quadril do cavaleiro fica (no mundo): nas costas, entre o lombo e a cernelha
  posSela(alvo) {
    if (!this.sela) return null;
    this.sela.getWorldPosition(alvo);
    if (this.selaFrente) alvo.lerp(this.selaFrente.getWorldPosition(TMP_V), this.dados.sela ?? 0.3);
    return alvo;
  }
  // ponto da juba logo atrás das orelhas, do lado do cavaleiro (lat = -1 ou 1, eixo x do lobo)
  pegada(lat, alvo) {
    this.grupo.worldToLocal(this.nuca.getWorldPosition(alvo));
    alvo.x += lat * 0.07; alvo.y += 0.05; alvo.z -= 0.04;
    return this.grupo.localToWorld(alvo);
  }
  remover() { this.removido = true; this.pai.remove(this.grupo); }
}
