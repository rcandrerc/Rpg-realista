// Corpos 3D. O herói pode ser um personagem VRoid (anime) ou o soldado realista.
// NPCs e bandidos usam o soldado com cores diferentes.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { gunzipSync, strFromU8 } from 'fflate';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarGLTF } from './cena.js';

let BASE = null, CLIPES = {}, ANIM_CRU = null, ESPADA = null, ESCUDO = null;

export async function carregarPersonagens() {
  const [base, espada, escudo, gz] = await Promise.all([
    carregarGLTF('assets/personagens/heroi_provisorio.glb'),
    carregarGLTF('assets/armas/espada.gltf'),
    carregarGLTF('assets/armas/escudo.gltf'),
    fetch('assets/personagens/anims.json.gz').then((r) => r.arrayBuffer()),
  ]);
  BASE = base;
  ANIM_CRU = JSON.parse(strFromU8(gunzipSync(new Uint8Array(gz))));
  CLIPES = clipesSoldado(ANIM_CRU);
  for (const a of base.animations) CLIPES[a.name] = a;
  ESPADA = espada.scene;
  ESPADA.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshStandardMaterial({ color: 0xc9c2b4, metalness: 0.92, roughness: 0.28 }); o.castShadow = true; } });
  ESCUDO = escudo.scene;
  ESCUDO.traverse((o) => {
    if (!o.isMesh) return;
    const metal = /Metal/.test(o.material.name);
    o.material = new THREE.MeshStandardMaterial({ color: metal ? 0x8d8a84 : 0x6e4a2c, metalness: metal ? 0.85 : 0, roughness: 0.6 });
    o.castShadow = true;
  });
}

const trilha = (n, t, v) => (/quaternion$/.test(n) ? new THREE.QuaternionKeyframeTrack(n, t, v) : new THREE.VectorKeyframeTrack(n, t, v));

// O soldado é Z-para-cima e as animações do Mixamo são Y-para-cima: gira o quadril 90° em X.
function clipesSoldado(cru) {
  const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const clipes = {}, q = new THREE.Quaternion();
  for (const nome in cru) {
    if (nome.startsWith('_')) continue;
    const trilhas = cru[nome].t.map(([n, t, v0]) => {
      const v = v0.slice();
      if (/Hips\.position$/.test(n)) {
        const x0 = v[0], z0 = v[2];
        for (let i = 0; i < v.length; i += 3) { const y = v[i + 1]; v[i] = x0; v[i + 1] = -z0; v[i + 2] = y; } // golpe no lugar; o jogo move o corpo
      }
      if (/Hips\.quaternion$/.test(n)) for (let i = 0; i < v.length; i += 4) q.fromArray(v, i).premultiply(giro).toArray(v, i);
      return trilha(n, t, v);
    });
    clipes[nome] = new THREE.AnimationClip(nome, cru[nome].d, trilhas);
  }
  return clipes;
}

// ---------- VRoid (VRM) ----------
const MIXAMO_VRM = {
  Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head',
  LeftShoulder: 'leftShoulder', LeftArm: 'leftUpperArm', LeftForeArm: 'leftLowerArm', LeftHand: 'leftHand',
  RightShoulder: 'rightShoulder', RightArm: 'rightUpperArm', RightForeArm: 'rightLowerArm', RightHand: 'rightHand',
  LeftUpLeg: 'leftUpperLeg', LeftLeg: 'leftLowerLeg', LeftFoot: 'leftFoot', LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg', RightLeg: 'rightLowerLeg', RightFoot: 'rightFoot', RightToeBase: 'rightToes',
};
for (const lado of ['Left', 'Right']) {
  const l = lado.toLowerCase();
  MIXAMO_VRM[`${lado}HandThumb1`] = `${l}ThumbMetacarpal`; MIXAMO_VRM[`${lado}HandThumb2`] = `${l}ThumbProximal`; MIXAMO_VRM[`${lado}HandThumb3`] = `${l}ThumbDistal`;
  for (const [mx, vr] of [['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Pinky', 'Little']]) {
    MIXAMO_VRM[`${lado}Hand${mx}1`] = `${l}${vr}Proximal`; MIXAMO_VRM[`${lado}Hand${mx}2`] = `${l}${vr}Intermediate`; MIXAMO_VRM[`${lado}Hand${mx}3`] = `${l}${vr}Distal`;
  }
}
// Nos personagens VRoid as animações básicas também vêm do Mixamo
const LACO_VRM = { Idle: 'parada', Walk: 'andar', Run: 'corrida' };

// Converte as animações do esqueleto do Mixamo para o esqueleto normalizado do VRM
function clipesVRM(vrm) {
  const rest = ANIM_CRU._rest, vrm0 = vrm.meta?.metaVersion === '0';
  const v3 = new THREE.Vector3();
  const alturaVrm = Math.abs(vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(v3).y - vrm.scene.getWorldPosition(new THREE.Vector3()).y);
  const escala = alturaVrm / rest.alturaQuadril;
  const qA = new THREE.Quaternion(), restInv = new THREE.Quaternion(), paiMundo = new THREE.Quaternion();
  const clipes = {};
  for (const nome in ANIM_CRU) {
    if (nome.startsWith('_')) continue;
    const trilhas = [];
    for (const [n, t, v0] of ANIM_CRU[nome].t) {
      const [osso, prop] = n.split('.');
      const no = vrm.humanoid.getNormalizedBoneNode(MIXAMO_VRM[osso.replace('mixamorig', '')]);
      const r = rest.ossos[osso];
      if (!no || !r) continue;
      const v = v0.slice();
      if (prop === 'quaternion') {
        restInv.fromArray(r, 0); paiMundo.fromArray(r, 4);
        for (let i = 0; i < v.length; i += 4) qA.fromArray(v, i).premultiply(paiMundo).multiply(restInv).toArray(v, i);
        trilhas.push(new THREE.QuaternionKeyframeTrack(`${no.name}.quaternion`, t, v.map((x, i) => (vrm0 && i % 2 === 0 ? -x : x))));
      } else if (prop === 'position') {
        const x0 = v[0], z0 = v[2];
        for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } // golpe no lugar; o jogo move o corpo
        trilhas.push(new THREE.VectorKeyframeTrack(`${no.name}.position`, t, v.map((x, i) => (vrm0 && i % 3 !== 1 ? -x : x) * escala)));
      }
    }
    clipes[nome] = new THREE.AnimationClip(nome, ANIM_CRU[nome].d, trilhas);
  }
  return clipes;
}

const vrmLoader = new GLTFLoader();
vrmLoader.register((p) => new VRMLoaderPlugin(p));
const cacheVRM = new Map(); // id -> ArrayBuffer (baixa uma vez, cada jogador ganha a sua cópia)
async function carregarVRM(id) {
  if (!cacheVRM.has(id)) cacheVRM.set(id, fetch(`assets/personagens/vrm/${id}.vrm`).then((r) => r.arrayBuffer()));
  const buf = await cacheVRM.get(id);
  const gltf = await new Promise((ok, nao) => vrmLoader.parse(buf.slice(0), '', ok, nao));
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.removeUnnecessaryJoints(gltf.scene);
  VRMUtils.rotateVRM0(vrm); // VRM antigo olha para -Z; o jogo usa +Z
  vrm.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return vrm;
}

// ---------- armas montadas à mão ----------
function cajado() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.7, 165, 8), new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.8 })));
  const anel = new THREE.Mesh(new THREE.TorusGeometry(5, 1.3, 8, 16), new THREE.MeshStandardMaterial({ color: 0x8a6b3c, metalness: 0.6, roughness: 0.4 }));
  anel.position.y = 86; g.add(anel);
  const gema = new THREE.Mesh(new THREE.OctahedronGeometry(4.2), new THREE.MeshStandardMaterial({ color: 0x8fd0ff, emissive: 0x2f8fff, emissiveIntensity: 2.2, roughness: 0.15 }));
  gema.position.y = 86; g.add(gema); g.userData.gema = gema;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function arco() {
  const g = new THREE.Group();
  const curva = new THREE.CatmullRomCurve3([[0, -62, 0], [0, -40, 10], [0, 0, 14], [0, 40, 10], [0, 62, 0]].map((p) => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 2.2, 7), new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.6 })));
  const pega = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 }));
  pega.position.z = 14; g.add(pega);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 124, 4), new THREE.MeshBasicMaterial({ color: 0xddd6c6 })));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const eixo = (x, y, z, ang) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z), ang);
// Posição das armas no VRM, em relação ao corpo em pose T (olhando para +Z).
// O braço ao descer gira em torno de Z, então o que aponta para +Z continua para a frente.
const ARMAS_VRM = {
  espada: { mao: 'rightHand', giro: eixo(1, 0, 0, Math.PI / 2), desloc: [0, -0.02, 0.02], escala: 1 },
  escudo: { mao: 'leftHand', giro: eixo(0, 0, 1, Math.PI / 2).multiply(eixo(0, 1, 0, Math.PI / 2)), desloc: [0, 0, 0], escala: 0.65 },
  // cajado e arco são presos já na pose parada, em pé, para ficarem na vertical ao lado do corpo
  cajado: { mao: 'rightHand', parado: true, giro: new THREE.Quaternion(), desloc: [0, 0.3, 0.02], escala: 0.01 },
  arco: { mao: 'leftHand', parado: true, giro: new THREE.Quaternion(), desloc: [0, 0.05, 0.03], escala: 0.01 },
};

export class Corpo {
  // visual: 'soldado' (padrão), id de um VRM, ou cor para NPC/bandido
  constructor(scene, { cor, escala = 1, armas = 'heroi', visual = 'soldado' }) {
    this.scene = scene; this.visual = visual;
    this.root = new THREE.Group(); this.root.scale.setScalar(escala);
    this.acoes = {}; this.atual = null; this.seq = -1; this.estado = null;
    this.alvo = new THREE.Vector3(); this.alvoRy = 0; this.primeira = true;
    this.armas = {}; this.piscar = 2 + Math.random() * 3;
    scene.add(this.root);
    if (visual !== 'soldado') {
      carregarVRM(visual).then((vrm) => this.montarVRM(vrm, armas)).catch((e) => { console.error('VRM', visual, e); this.montarSoldado(cor, 'heroi'); });
    } else this.montarSoldado(cor, armas);
  }
  montarSoldado(cor, armas) {
    const corpo = SkeletonUtils.clone(BASE.scene);
    corpo.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
      if (cor) { o.material = o.material.clone(); o.material.color.setHex(cor); }
      o.material.envMapIntensity = 0.8;
    });
    this.root.add(corpo);
    this.mixer = new THREE.AnimationMixer(corpo); this.clipes = CLIPES;
    const mao = corpo.getObjectByName('mixamorigRightHand'), maoE = corpo.getObjectByName('mixamorigLeftHand');
    const por = (obj, osso, p, r, s) => { obj.position.set(...p); obj.rotation.set(...r); obj.scale.setScalar(s); osso.add(obj); return obj; };
    if (armas === 'heroi') {
      this.armas.espada = [por(ESPADA.clone(), mao, [0, 8, 3], [Math.PI / 2, 0, 0], 100), por(ESCUDO.clone(), maoE, [0, 6, -4], [0, Math.PI / 2, 0], 100)];
      this.armas.cajado = [por(cajado(), mao, [0, 7, -22], [-Math.PI / 2, 0, 0], 1)];
      this.armas.arco = [por(arco(), maoE, [0, 6, 2], [0, 0, 0], 1)];
    } else if (armas === 'espada') por(ESPADA.clone(), mao, [0, 8, 3], [Math.PI / 2, 0, 0], 100);
    this.pronto();
  }
  montarVRM(vrm, armas) {
    if (this.removido) { VRMUtils.deepDispose(vrm.scene); return; }
    this.vrm = vrm;
    this.root.add(vrm.scene);
    vrm.update(0); this.root.updateMatrixWorld(true);
    // as armas são presas na pose T, antes de qualquer animação
    const prender = (obj, cfg) => {
      const osso = vrm.humanoid.getRawBoneNode(cfg.mao);
      const qOsso = osso.getWorldQuaternion(new THREE.Quaternion());
      const qRoot = this.root.getWorldQuaternion(new THREE.Quaternion());
      obj.quaternion.copy(qOsso.invert().multiply(qRoot).multiply(cfg.giro));
      const p = osso.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...cfg.desloc));
      obj.position.copy(osso.worldToLocal(p));
      obj.scale.setScalar(cfg.escala);
      osso.add(obj); return obj;
    };
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.clipes = clipesVRM(vrm);
    if (armas === 'heroi') {
      this.armas.espada = [prender(ESPADA.clone(), ARMAS_VRM.espada), prender(ESCUDO.clone(), ARMAS_VRM.escudo)];
      // põe o corpo na pose parada por um instante para prender cajado e arco
      const parado = this.mixer.clipAction(this.clipes.parada).play();
      this.mixer.update(0); vrm.update(0); this.root.updateMatrixWorld(true);
      this.armas.cajado = [prender(cajado(), ARMAS_VRM.cajado)];
      this.armas.arco = [prender(arco(), ARMAS_VRM.arco)];
      parado.stop(); this.mixer.update(0);
    }
    this.pronto();
  }
  pronto() {
    if (this.armaVisivel) this.mostrarArma(this.armaVisivel);
    this.atual = null;
    if (this.estado) { const e = this.estado; this.estado = null; this.seq = -1; this.aplicar(e); } else this.tocarLaco('Idle');
  }
  acao(nome) {
    if (!this.mixer) return null;
    if (this.vrm && LACO_VRM[nome]) nome = LACO_VRM[nome];
    if (!this.acoes[nome]) { const c = this.clipes[nome]; if (!c) return null; this.acoes[nome] = this.mixer.clipAction(c); }
    return this.acoes[nome];
  }
  tocarLaco(nome, fade = 0.22) {
    if (this.atual === nome) return;
    const a = this.acao(nome); if (!a) return;
    a.reset().setLoop(THREE.LoopRepeat).setEffectiveTimeScale(1).fadeIn(fade).play();
    if (this.atual) this.acao(this.atual)?.fadeOut(fade);
    this.atual = nome;
  }
  tocarUmaVez({ nome, ts, segurar }) {
    const a = this.acao(nome); if (!a) return;
    a.reset().setLoop(segurar ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).setEffectiveTimeScale(ts || 1).fadeIn(0.12).play();
    a.clampWhenFinished = true;
    if (this.atual && this.atual !== nome) this.acao(this.atual)?.fadeOut(0.12);
    this.atual = nome;
  }
  mostrarArma(k) { this.armaVisivel = k; for (const g in this.armas) this.armas[g].forEach((o) => { o.visible = g === k; }); }
  // Recebe o estado vindo da simulação
  aplicar(e) {
    this.alvo.set(e.x, 0, e.z); this.alvoRy = e.ry;
    if (this.primeira) { this.root.position.copy(this.alvo); this.root.rotation.y = e.ry; this.primeira = false; }
    if (!this.mixer) { this.estado = e; return; }
    if (e.acao && e.acaoSeq !== this.seq) this.tocarUmaVez(e.acao);
    else if (!e.acao) this.tocarLaco(e.anim);
    this.seq = e.acaoSeq;
  }
  atualizar(dt) {
    const k = 1 - Math.exp(-dt * 14); // suaviza o movimento entre as fotos do servidor
    this.root.position.lerp(this.alvo, k);
    const d = Math.atan2(Math.sin(this.alvoRy - this.root.rotation.y), Math.cos(this.alvoRy - this.root.rotation.y));
    this.root.rotation.y += d * k;
    this.mixer?.update(dt);
    if (this.vrm) {
      // piscar de vez em quando
      this.piscar -= dt;
      const p = this.piscar < 0 ? Math.max(0, 1 - Math.abs(this.piscar + 0.08) / 0.08) : 0;
      if (this.piscar < -0.16) this.piscar = 2 + Math.random() * 4;
      this.vrm.expressionManager?.setValue('blink', p);
      this.vrm.update(dt);
    }
    const gema = this.armas.cajado?.[0].userData.gema; if (gema) gema.rotation.y += dt * 1.5;
  }
  remover() {
    this.removido = true; this.scene.remove(this.root);
    if (this.vrm) VRMUtils.deepDispose(this.vrm.scene);
  }
}
