// Palco do criador de personagem: um lugar só dele, fora do mapa (sem inimigos, sem dano).
// O herói fica num tablado de pedra com um círculo mágico aceso, faz poses de vez em quando e gira com o dedo.
import * as THREE from 'three';
import { DURACAO, A } from '@rpg/shared';
import { Corpo } from './personagens.js';
import { texCirculo } from './efeitos.js';
import { pintarCena, PALETA } from './estilo.js';

// Poses que o herói faz entre um descanso e outro (arma na mão para mostrar o conjunto)
const POSES = [
  { nome: A.swordIdle, modo: 'Espada', vezes: 2 },
  { nome: A.heal, modo: 'Magia' },
  { nome: A.block, modo: 'Espada', vezes: 2 },
  { nome: A.ceu, modo: 'Magia' },
  { nome: A.onda, modo: 'Magia' },
];
const DESCANSO = 4.5; // segundos parado entre uma pose e outra

export class Palco {
  constructor(renderer) {
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 120);
    this.alvo = new THREE.Vector3(0, 1.0, 0); this.dist = 4.1; this.alt = 0.4; this.giro = 0;
    this.corpo = null; this.visual = null; this.aparencia = ''; this.t = 0; this.proxima = 2.5; this.i = 0; this.seq = 0;

    // céu do palco: noite azul em cima, dourado no horizonte, como um fundo pintado
    const ceu = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `varying vec3 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          float y = vP.y;
          vec3 alto = vec3(.05, .08, .22), meio = vec3(.22, .22, .5), baixo = vec3(.98, .62, .42);
          vec3 c = mix(meio, alto, smoothstep(.05, .75, y));
          c = mix(baixo, c, smoothstep(-.12, .3, y));
          // estrelas pequenas só no alto
          vec2 g = floor(vec2(atan(vP.z, vP.x) * 90., y * 90.));
          float e = step(.9965, h(g)) * smoothstep(.25, .7, y);
          c += e * .8;
          gl_FragColor = vec4(c, 1.);
          #include <encodings_fragment>
        }`,
    }));
    scene.add(ceu);
    scene.fog = new THREE.Fog(0x4a4f86, 9, 34);

    // luz: principal quente de cima, contra-luz azul que recorta o contorno, céu e chão suaves
    const sol = this.sol = new THREE.DirectionalLight(PALETA.sol, 1.0);
    // de frente, uns 40° de lado: o rosto ganha um lado de meia-sombra
    sol.position.set(3.6, 5, 4.3); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 15 });
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02;
    const contra = new THREE.DirectionalLight(0x8fb4ff, 0.55); contra.position.set(-3, 3, -4);
    scene.add(sol, contra, new THREE.HemisphereLight(PALETA.ceuLuz, 0x6a5a7a, 0.4));

    // tablado redondo de pedra (textura pintada da praça) com borda de pedra empilhada
    const tex = new THREE.TextureLoader(), lad = (url, rx, ry) => {
      const t = tex.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
    };
    const topo = new THREE.MeshStandardMaterial({ map: lad('assets/cenario/pintado/cobblestone_floor_01.jpg', 1.6, 1.6), color: 0xb8b0c4, roughness: 0.9 });
    const lado = new THREE.MeshStandardMaterial({ map: lad('assets/cenario/pintado/stacked_stone_wall.jpg', 6, 0.5), color: 0x9a92a8, roughness: 0.95 });
    const tablado = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.35, 0.35, 64), [lado, topo, lado]);
    tablado.position.y = -0.175; tablado.receiveShadow = true; scene.add(tablado);
    const degrau = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.9, 0.18, 64), [lado, topo, lado]);
    degrau.position.y = -0.44; degrau.receiveShadow = true; scene.add(degrau);
    // aro dourado na beira do tablado
    const ouro = new THREE.MeshStandardMaterial({ color: 0xd9b25a, metalness: 0.8, roughness: 0.35, emissive: 0x3a2808 });
    const aro = new THREE.Mesh(new THREE.TorusGeometry(2.24, 0.035, 8, 96), ouro);
    aro.rotation.x = Math.PI / 2; aro.position.y = 0.0; scene.add(aro);

    // círculo mágico aceso no chão, girando devagar
    const circ = this.circulo = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({
      map: texCirculo(false), color: 0x8cc4ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    circ.rotation.x = -Math.PI / 2; circ.position.y = 0.012; scene.add(circ);

    // névoa baixa em volta do tablado (o palco "flutua")
    const nevoa = new THREE.Mesh(new THREE.RingGeometry(2.6, 30, 64), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `varying vec2 vP; void main(){ float r = length(vP);
        float a = smoothstep(2.6, 4.5, r) * (1. - smoothstep(14., 30., r));
        gl_FragColor = vec4(mix(vec3(.62, .58, .85), vec3(.98, .78, .6), smoothstep(6., 22., r)), a * .85);
        #include <encodings_fragment>
      }`,
    }));
    nevoa.rotation.x = -Math.PI / 2; nevoa.position.y = -0.7; scene.add(nevoa);

    // pontinhos de luz subindo devagar em volta
    const N = 70, pos = new Float32Array(N * 3); this.fase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.4 + Math.random() * 3.2;
      pos.set([Math.cos(a) * r, Math.random() * 3.2, Math.sin(a) * r], i * 3); this.fase[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const brilho = document.createElement('canvas'); brilho.width = brilho.height = 32;
    const x = brilho.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,240,200,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    this.luzes = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, map: new THREE.CanvasTexture(brilho), color: 0xffe2a8,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    scene.add(this.luzes);

    pintarCena(scene); // pedra e ouro em toon, como o resto do mundo pintado
  }

  // Põe no palco o personagem que está sendo criado (troca o corpo se mudou a base)
  vestir(visual, aparencia) {
    if (visual !== this.visual) {
      this.corpo?.remover();
      this.corpo = new Corpo(this.scene, { armas: 'heroi', visual });
      this.visual = visual; this.aparencia = ''; this.seq = 0; this.proxima = 2.5;
      this.corpo.aplicar({ x: 0, z: 0, ry: 0, anim: 'Idle', acao: null, acaoSeq: 0, modo: 'Espada' });
    }
    const a = JSON.stringify(aparencia);
    if (a !== this.aparencia) { this.aparencia = a; this.corpo.repintar(aparencia); }
  }

  // giro: quanto o jogador girou o herói com o dedo; rosto: câmera bem perto do rosto
  atualizar(dt, giro, rosto) {
    this.t += dt;
    const c = this.corpo;
    if (c) {
      // descansa, faz uma pose, volta a descansar; mexendo no rosto ele fica parado olhando para a câmera
      this.proxima -= dt;
      if (rosto && this.pose) this.descansar();
      else if (!rosto && this.proxima <= 0) {
        if (this.pose) this.descansar();
        else {
          const p = POSES[this.i++ % POSES.length];
          this.pose = p; this.proxima = (DURACAO[p.nome] || 2) * (p.vezes || 1) - 0.15;
          c.aplicar({ x: 0, z: 0, ry: 0, anim: 'Idle', acao: { nome: p.nome, ts: 1, segurar: p.vezes > 1 }, acaoSeq: ++this.seq, modo: p.modo });
        }
      }
      c.mostrarArmas(!!this.pose); // arma só aparece na pose
      c.alvoRy = giro; c.atualizar(dt);
    }
    this.circulo.rotation.z = this.t * 0.08;
    this.circulo.material.opacity = 0.7 + Math.sin(this.t * 1.6) * 0.12;
    const p = this.luzes.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.18; if (y > 3.4) y = 0;
      p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(this.t * 0.7 + this.fase[i]) * dt * 0.05);
    }
    p.needsUpdate = true;

    // câmera de frente; no rosto, chega perto da cabeça
    const k = Math.min(1, dt * 5), cabeca = c?.vrm?.humanoid.getRawBoneNode('head');
    const altura = c ? c.root.scale.y : 1;
    if (rosto && cabeca) { cabeca.getWorldPosition(this.tmp ||= new THREE.Vector3()); this.tmp.y += 0.04; }
    const alvo = rosto && cabeca ? this.tmp : (this.tmp2 ||= new THREE.Vector3()).set(0, 0.85 * altura, 0);
    this.alvo.lerp(alvo, k);
    this.dist += ((rosto ? 0.75 : 4.1) - this.dist) * k;
    this.alt += ((rosto ? 0 : 0.4) - this.alt) * k;
    this.camera.position.set(this.alvo.x, this.alvo.y + this.alt, this.alvo.z + this.dist);
    this.camera.lookAt(this.alvo);
  }
  descansar() {
    this.pose = null; this.proxima = DESCANSO;
    this.corpo.aplicar({ x: 0, z: 0, ry: 0, anim: 'Idle', acao: null, acaoSeq: this.seq, modo: 'Espada' });
  }
}
