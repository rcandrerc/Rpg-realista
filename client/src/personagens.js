// Corpos 3D. Herói, outros jogadores, NPCs e bandidos usam o mesmo modelo com cores diferentes.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gunzipSync, strFromU8 } from 'fflate';
import { carregarGLTF } from './cena.js';

let BASE = null, CLIPES = {}, ESPADA = null, ESCUDO = null;

export async function carregarPersonagens() {
  const [base, espada, escudo, gz] = await Promise.all([
    carregarGLTF('assets/personagens/heroi_provisorio.glb'),
    carregarGLTF('assets/armas/espada.gltf'),
    carregarGLTF('assets/armas/escudo.gltf'),
    fetch('assets/personagens/anims.json.gz').then((r) => r.arrayBuffer()),
  ]);
  BASE = base;
  CLIPES = montarClipes(JSON.parse(strFromU8(gunzipSync(new Uint8Array(gz)))));
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

// As animações do Mixamo vêm com o quadril em Y-para-cima; o herói é Z-para-cima.
function montarClipes(cru) {
  const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const clipes = {};
  for (const nome in cru) {
    const trilhas = cru[nome].t.map(([n, t, v]) => {
      if (/Hips\.position$/.test(n)) {
        const x0 = v[0], z0 = v[2];
        for (let i = 0; i < v.length; i += 3) { const y = v[i + 1]; v[i] = x0; v[i + 1] = -z0; v[i + 2] = y; } // golpe no lugar; o jogo move o corpo
      }
      if (/Hips\.quaternion$/.test(n)) {
        const q = new THREE.Quaternion();
        for (let i = 0; i < v.length; i += 4) q.fromArray(v, i).premultiply(giro).toArray(v, i);
      }
      return /quaternion$/.test(n) ? new THREE.QuaternionKeyframeTrack(n, t, v) : new THREE.VectorKeyframeTrack(n, t, v);
    });
    clipes[nome] = new THREE.AnimationClip(nome, cru[nome].d, trilhas);
  }
  return clipes;
}

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

export class Corpo {
  constructor(scene, { cor, escala = 1, armas = 'heroi' }) {
    this.scene = scene;
    this.root = SkeletonUtils.clone(BASE.scene);
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
      if (cor) { o.material = o.material.clone(); o.material.color.setHex(cor); }
      o.material.envMapIntensity = 0.8;
    });
    this.root.scale.setScalar(escala);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.acoes = {}; this.atual = null; this.seq = -1;
    this.alvo = new THREE.Vector3(); this.alvoRy = 0; this.primeira = true;
    const mao = this.root.getObjectByName('mixamorigRightHand'), maoE = this.root.getObjectByName('mixamorigLeftHand');
    const por = (obj, osso, p, r, s) => { obj.position.set(...p); obj.rotation.set(...r); obj.scale.setScalar(s); osso.add(obj); return obj; };
    this.armas = {};
    if (armas === 'heroi') {
      this.armas.espada = [por(ESPADA.clone(), mao, [0, 8, 3], [Math.PI / 2, 0, 0], 100), por(ESCUDO.clone(), maoE, [0, 6, -4], [0, Math.PI / 2, 0], 100)];
      this.armas.cajado = [por(cajado(), mao, [0, 7, -22], [-Math.PI / 2, 0, 0], 1)];
      this.armas.arco = [por(arco(), maoE, [0, 6, 2], [0, 0, 0], 1)];
    } else if (armas === 'espada') {
      por(ESPADA.clone(), mao, [0, 8, 3], [Math.PI / 2, 0, 0], 100);
    }
    scene.add(this.root);
    this.tocarLaco('Idle');
  }
  acao(nome) {
    if (!this.acoes[nome]) { const c = CLIPES[nome]; if (!c) return null; this.acoes[nome] = this.mixer.clipAction(c); }
    return this.acoes[nome];
  }
  tocarLaco(nome, fade = 0.22) {
    if (this.atual === nome) return;
    const a = this.acao(nome); if (!a) return;
    a.reset().setLoop(THREE.LoopRepeat).setEffectiveTimeScale(1).fadeIn(fade).play();
    if (this.atual) this.acoes[this.atual].fadeOut(fade);
    this.atual = nome;
  }
  tocarUmaVez({ nome, ts, segurar }) {
    const a = this.acao(nome); if (!a) return;
    a.reset().setLoop(segurar ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).setEffectiveTimeScale(ts || 1).fadeIn(0.12).play();
    a.clampWhenFinished = true;
    if (this.atual && this.atual !== nome) this.acoes[this.atual].fadeOut(0.12);
    this.atual = nome;
  }
  mostrarArma(k) { for (const g in this.armas) this.armas[g].forEach((o) => { o.visible = g === k; }); }
  // Recebe o estado vindo da simulação
  aplicar(e) {
    this.alvo.set(e.x, 0, e.z); this.alvoRy = e.ry;
    if (this.primeira) { this.root.position.copy(this.alvo); this.root.rotation.y = e.ry; this.primeira = false; }
    if (e.acao && e.acaoSeq !== this.seq) { this.seq = e.acaoSeq; this.tocarUmaVez(e.acao); this.emAcao = true; }
    else if (!e.acao) { this.emAcao = false; this.tocarLaco(e.anim); }
    this.seq = e.acaoSeq;
  }
  atualizar(dt) {
    const k = 1 - Math.exp(-dt * 14); // suaviza o movimento entre as fotos do servidor
    this.root.position.lerp(this.alvo, k);
    const d = Math.atan2(Math.sin(this.alvoRy - this.root.rotation.y), Math.cos(this.alvoRy - this.root.rotation.y));
    this.root.rotation.y += d * k;
    this.mixer.update(dt);
    const gema = this.armas.cajado?.[0].userData.gema; if (gema) gema.rotation.y += dt * 1.5;
  }
  remover() { this.scene.remove(this.root); }
}
