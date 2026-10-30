// Corpos 3D. O herói pode ser um personagem VRoid (anime) ou o soldado realista.
// As hordas inimigas também são VRoid (personagens que o jogador não escolhe); NPCs usam o soldado.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { gunzipSync, strFromU8 } from 'fflate';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CORTES, SEM_ALTURA, SEM_AVANCO } from '@rpg/shared';
import { carregarGLTF } from './cena.js';

let BASE = null, CLIPES = {}, ANIM_CRU = null, ESPADA = null, LAMINA = null;

export async function carregarPersonagens() {
  const [base, espada, gz] = await Promise.all([
    carregarGLTF('assets/personagens/heroi_provisorio.glb'),
    carregarGLTF('assets/armas/espada.gltf'),
    fetch('assets/personagens/anims.json.gz').then((r) => r.arrayBuffer()),
  ]);
  BASE = base;
  ANIM_CRU = JSON.parse(strFromU8(gunzipSync(new Uint8Array(gz))));
  CLIPES = clipesSoldado(ANIM_CRU);
  for (const a of base.animations) CLIPES[a.name] = a;
  ESPADA = espada.scene;
  // base e ponta da lâmina (no espaço da espada), para o rastro do golpe: ao longo do lado mais comprido
  const bb = new THREE.Box3().setFromObject(ESPADA), tam = bb.getSize(new THREE.Vector3()), eixoL = tam.x > tam.y ? (tam.x > tam.z ? 'x' : 'z') : (tam.y > tam.z ? 'y' : 'z');
  const c = bb.getCenter(new THREE.Vector3()), ponta = c.clone(), cabo = c.clone(), longe = Math.abs(bb.max[eixoL]) > Math.abs(bb.min[eixoL]) ? 'max' : 'min';
  ponta[eixoL] = bb[longe][eixoL]; cabo[eixoL] = c[eixoL] + (bb[longe][eixoL] - c[eixoL]) * -0.25;
  LAMINA = { base: cabo, ponta };
  ESPADA.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}

// Espada mágica: aço com brilho próprio na cor da magia e uma película de luz em volta
const espadas = new Map();
function espadaMagica(cor) {
  if (!espadas.has(cor)) {
    const aco = new THREE.MeshStandardMaterial({ color: 0xd4dbe6, metalness: 0.9, roughness: 0.22, emissive: cor, emissiveIntensity: 0.55 });
    const brilho = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    espadas.set(cor, { aco, brilho });
  }
  const m = espadas.get(cor), e = ESPADA.clone();
  e.traverse((o) => {
    if (!o.isMesh || o.userData.pelicula) return;
    o.material = m.aco;
    const p = new THREE.Mesh(o.geometry, m.brilho); p.scale.setScalar(1.12); p.userData.pelicula = true; p.castShadow = false; o.add(p);
  });
  return e;
}
const COR_HEROI = 0x5fb4ff;

const trilha = (n, t, v) => (/quaternion$/.test(n) ? new THREE.QuaternionKeyframeTrack(n, t, v) : new THREE.VectorKeyframeTrack(n, t, v));

// Recorta um pedaço da animação (de t0 a t1 segundos) e começa do zero
function cortar(clip, t0, t1, nome) {
  const trilhas = clip.tracks.map((tr) => {
    const n = tr.getValueSize(), it = tr.createInterpolant(), tempos = [0], valores = [...it.evaluate(t0)];
    for (let i = 0; i < tr.times.length; i++) {
      if (tr.times[i] <= t0 + 1e-4 || tr.times[i] >= t1 - 1e-4) continue;
      tempos.push(tr.times[i] - t0); for (let k = 0; k < n; k++) valores.push(tr.values[i * n + k]);
    }
    tempos.push(t1 - t0); valores.push(...it.evaluate(t1));
    return new tr.constructor(tr.name, tempos, valores);
  });
  return new THREE.AnimationClip(nome, t1 - t0, trilhas);
}
// Junta os pedaços (CORTES) e tira o sobe-desce do quadril das animações de pulo. vertical = índice da altura na posição do quadril
function completar(clipes, vertical) {
  for (const [nome, [arq, ini, fim]] of Object.entries(CORTES)) if (clipes[arq]) clipes[nome] = cortar(clipes[arq], clipes[arq].duration * ini, clipes[arq].duration * fim, nome);
  for (const nome of SEM_ALTURA) {
    const tr = clipes[nome]?.tracks.find((x) => /\.position$/.test(x.name)); if (!tr) continue;
    const y0 = tr.values[vertical]; for (let i = vertical; i < tr.values.length; i += 3) tr.values[i] = y0;
  }
  for (const nome of SEM_AVANCO) {
    const tr = clipes[nome]?.tracks.find((x) => /\.position$/.test(x.name)); if (!tr) continue;
    for (let k = 0; k < 3; k++) if (k !== vertical) for (let i = k; i < tr.values.length; i += 3) tr.values[i] = tr.values[k];
  }
  return clipes;
}

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
  return completar(clipes, 2);
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
// Estados de movimento que tocam uma vez só (os outros repetem)
const UMA_VEZ = new Set(['pulo', 'puloCorrendo', 'mortal', 'pouso']);

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
  return completar(clipes, 1);
}

const vrmLoader = new GLTFLoader();
vrmLoader.register((p) => new VRMLoaderPlugin(p));
const cacheVRM = new Map(); // id -> ArrayBuffer (baixa uma vez, cada jogador ganha a sua cópia)
const materiaisVRM = new Map(); // id -> { nome do material: material } (cópias do mesmo personagem dividem as texturas)
async function carregarVRM(id) {
  if (!cacheVRM.has(id)) cacheVRM.set(id, fetch(`assets/personagens/vrm/${id}.vrm`).then((r) => r.arrayBuffer()));
  const buf = await cacheVRM.get(id);
  const gltf = await new Promise((ok, nao) => vrmLoader.parse(buf.slice(0), '', ok, nao));
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.removeUnnecessaryJoints(gltf.scene);
  VRMUtils.rotateVRM0(vrm); // VRM antigo olha para -Z; o jogo usa +Z
  // várias cópias do mesmo personagem (uma horda inteira) usam os mesmos materiais: a memória de textura não multiplica
  if (!materiaisVRM.has(id)) materiaisVRM.set(id, {});
  const mats = materiaisVRM.get(id), trocar = (m) => {
    if (!mats[m.name]) { mats[m.name] = m; return m; }
    if (mats[m.name] !== m) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); }
    return mats[m.name];
  };
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    o.material = Array.isArray(o.material) ? o.material.map(trocar) : trocar(o.material);
  });
  return vrm;
}

const eixo = (x, y, z, ang) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z), ang);
// Posição das armas no VRM, em relação ao corpo em pose T (olhando para +Z).
// O braço ao descer gira em torno de Z, então o que aponta para +Z continua para a frente.
const ARMAS_VRM = {
  espada: { mao: 'rightHand', giro: eixo(1, 0, 0, Math.PI / 2), desloc: [0, -0.02, 0.02], escala: 1 },
};

export class Corpo {
  // visual: 'soldado' (padrão), id de um VRM, ou cor para NPC/bandido
  // armas: 'heroi' (espada mágica azul), 'inimigo' (espada mágica na cor do brilho) ou 'nenhuma'; bravo: cara de raiva
  constructor(scene, { cor, escala = 1, armas = 'heroi', visual = 'soldado', brilho = COR_HEROI, bravo = false }) {
    this.scene = scene; this.visual = visual; this.brilho = brilho; this.bravo = bravo;
    this.root = new THREE.Group(); this.root.scale.setScalar(escala);
    this.acoes = {}; this.atual = null; this.seq = -1; this.estado = null;
    this.alvo = new THREE.Vector3(); this.alvoRy = 0; this.primeira = true;
    this.armas = {}; this.piscar = 2 + Math.random() * 3;
    this.inclina = new THREE.Group(); this.root.add(this.inclina); // o corpo inclina para a frente no dash
    this.anim = null; this.maosOssos = [];
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
    this.inclina.add(corpo);
    this.mixer = new THREE.AnimationMixer(corpo); this.clipes = CLIPES;
    const mao = corpo.getObjectByName('mixamorigRightHand'), maoE = corpo.getObjectByName('mixamorigLeftHand');
    this.maosOssos = [mao, maoE];
    const por = (obj, osso, p, r, s) => { obj.position.set(...p); obj.rotation.set(...r); obj.scale.setScalar(s); osso.add(obj); return obj; };
    if (armas !== 'nenhuma') this.armas.espada = [por(espadaMagica(this.brilho), mao, [0, 8, 3], [Math.PI / 2, 0, 0], 100)];
    this.pronto();
  }
  montarVRM(vrm, armas) {
    if (this.removido) { VRMUtils.deepDispose(vrm.scene); return; }
    this.vrm = vrm;
    this.inclina.add(vrm.scene);
    this.maosOssos = [vrm.humanoid.getRawBoneNode('rightHand'), vrm.humanoid.getRawBoneNode('leftHand')];
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
    if (armas !== 'nenhuma') this.armas.espada = [prender(espadaMagica(this.brilho), ARMAS_VRM.espada)];
    this.pronto();
  }
  pronto() {
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
    let ts = 1;
    if (nome === 'dash') { nome = 'Run'; ts = 1.9; fade = 0.05; } // dash: corrida acelerada com o corpo inclinado
    if (UMA_VEZ.has(nome)) fade = 0.08;
    if (this.atual === nome) { this.acao(nome)?.setEffectiveTimeScale(ts); return; }
    const a = this.acao(nome); if (!a) return;
    a.reset().setLoop(UMA_VEZ.has(nome) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity).setEffectiveTimeScale(ts).fadeIn(fade).play();
    a.clampWhenFinished = true;
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
  // Recebe o estado vindo da simulação
  aplicar(e) {
    this.alvo.set(e.x, e.y || 0, e.z); this.alvoRy = e.ry; this.anim = e.anim;
    if (this.primeira) { this.root.position.copy(this.alvo); this.root.rotation.y = e.ry; this.primeira = false; }
    if (!this.mixer) { this.estado = e; return; }
    if (e.acao && e.acaoSeq !== this.seq) this.tocarUmaVez(e.acao);
    else if (!e.acao) this.tocarLaco(e.anim);
    this.seq = e.acaoSeq;
  }
  atualizar(dt) {
    const k = 1 - Math.exp(-dt * 14); // suaviza o movimento entre as fotos do servidor
    this.root.position.lerp(this.alvo, k);
    this.inclina.rotation.x += ((this.anim === 'dash' ? 0.42 : 0) - this.inclina.rotation.x) * Math.min(1, dt * 18);
    const d = Math.atan2(Math.sin(this.alvoRy - this.root.rotation.y), Math.cos(this.alvoRy - this.root.rotation.y));
    this.root.rotation.y += d * k;
    this.mixer?.update(dt);
    if (this.vrm) {
      // piscar de vez em quando
      this.piscar -= dt;
      const p = this.piscar < 0 ? Math.max(0, 1 - Math.abs(this.piscar + 0.08) / 0.08) : 0;
      if (this.piscar < -0.16) this.piscar = 2 + Math.random() * 4;
      this.vrm.expressionManager?.setValue('blink', p);
      if (this.bravo) this.vrm.expressionManager?.setValue('angry', 0.8); // inimigo: cara de raiva
      this.vrm.update(dt);
    }
  }
  // posição das mãos no mundo (para o brilho da magia)
  maos() { return this.maosOssos.filter(Boolean).map((o) => o.getWorldPosition(new THREE.Vector3())); }
  // base e ponta da lâmina no mundo, se a espada estiver na mão
  lamina() {
    const e = this.armas.espada?.[0]; if (!e || !e.visible || !LAMINA) return null;
    return [e.localToWorld(LAMINA.base.clone()), e.localToWorld(LAMINA.ponta.clone())];
  }
  remover() {
    this.removido = true; this.scene.remove(this.root);
    if (this.vrm) this.vrm.scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); // materiais ficam: outras cópias usam
  }
}
