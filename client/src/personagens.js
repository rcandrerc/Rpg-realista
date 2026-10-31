// Corpos 3D. O herói pode ser um personagem VRoid (anime) ou o soldado realista.
// As hordas inimigas também são VRoid (personagens que o jogador não escolhe); NPCs usam o soldado.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { gunzipSync, strFromU8 } from 'fflate';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ANIMS_ESCALADA, CORTES, SEM_ALTURA, SEM_AVANCO } from '@rpg/shared';
import { carregarGLTF } from './cena.js';
import { Montaria } from './montaria.js';

const ESCALANDO = new Set(ANIMS_ESCALADA);
let BASE = null, CLIPES = {}, ANIM_CRU = null, ESPADA = null, LAMINA = null;

export async function carregarPersonagens() {
  const [base, espada, gz] = await Promise.all([
    carregarGLTF('assets/personagens/heroi_provisorio.glb'),
    carregarGLTF('assets/armas/espada.gltf'),
    fetch('assets/personagens/anims.json.gz').then((r) => r.arrayBuffer()),
  ]);
  BASE = base;
  ANIM_CRU = ajustarEscalada(JSON.parse(strFromU8(gunzipSync(new Uint8Array(gz)))));
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

// Cajado mágico (feito no código): haste de madeira, anéis de bronze e um cristal que brilha na cor da magia.
// A origem é o ponto onde a mão segura; o cajado cresce para +Y.
const cajados = new Map();
function cajadoMagico(cor) {
  if (!cajados.has(cor)) {
    const casca = new THREE.TextureLoader().load('assets/cenario/vila/medieval_wood_diff_1k.jpg');
    casca.encoding = THREE.sRGBEncoding; casca.wrapS = casca.wrapT = THREE.RepeatWrapping;
    const madeira = new THREE.MeshStandardMaterial({ map: casca, color: 0xe0b48a, roughness: 0.7 });
    const bronze = new THREE.MeshStandardMaterial({ color: 0xb48c4c, metalness: 0.9, roughness: 0.32 });
    const cristal = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: cor, emissiveIntensity: 1.5, roughness: 0.15, metalness: 0.1 });
    const brilho = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const haste = new THREE.CylinderGeometry(0.017, 0.023, 1.5, 8, 12), p = haste.attributes.position, uv = haste.attributes.uv;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 2.3) * 0.01); uv.setXY(i, uv.getX(i) * 0.2, uv.getY(i) * 1.5); }
    haste.translate(0, 0.2, 0); haste.computeVertexNormals();
    const pecas = [haste];
    for (let k = 0; k < 3; k++) { // três garras de madeira segurando o cristal
      const a = k * 2.094, c = Math.cos(a), sn = Math.sin(a);
      const curva = new THREE.CatmullRomCurve3([[0, 0.92, 0], [0.05, 0.99, 0], [0.065, 1.08, 0], [0.03, 1.2, 0], [0.008, 1.24, 0]].map(([x, y]) => new THREE.Vector3(x * c, y, x * sn)));
      const g = new THREE.TubeGeometry(curva, 12, 0.008, 5); g.deleteAttribute('uv'); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      pecas.push(g);
    }
    const aneis = [0.9, 0.1, -0.12, -0.53].map((y) => new THREE.TorusGeometry(0.025, 0.006, 6, 14).rotateX(Math.PI / 2).translate(0, y, 0));
    const pedra = new THREE.OctahedronGeometry(0.048, 1).scale(1, 1.7, 1).translate(0, 1.08, 0);
    cajados.set(cor, { geo: { madeira: mergeGeometries(pecas.map((g) => g.toNonIndexed())), bronze: mergeGeometries(aneis), pedra }, madeira, bronze, cristal, brilho });
  }
  const m = cajados.get(cor), g = new THREE.Group();
  const madeira = new THREE.Mesh(m.geo.madeira, m.madeira), bronze = new THREE.Mesh(m.geo.bronze, m.bronze), pedra = new THREE.Mesh(m.geo.pedra, m.cristal);
  const aura = new THREE.Mesh(m.geo.pedra, m.brilho); aura.scale.set(1.6, 1.3, 1.6); aura.position.y = 1.08 - 1.08 * 1.3; // aura em volta do cristal
  for (const o of [madeira, bronze, pedra]) o.castShadow = true;
  g.add(madeira, bronze, pedra, aura);
  return g;
}
// Onde fica a arma que não está na mão: nas costas, na diagonal (no espaço do corpo olhando para +Z)
const COSTAS = {
  espada: { giro: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI - 0.5)), desloc: [0.17, 0.2, -0.15] },
  cajado: { giro: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.55)), desloc: [0.05, -0.32, -0.17] },
};

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
// Escalada: quem leva o corpo pelo caminho é o jogo (ESCALADA[...].traj), então o quadril da animação não anda para os lados
// nem para a frente (senão o corpo ia o dobro e pulava de volta no fim). As da escada vêm do Mixamo viradas de costas
// (o boneco gira 180° e anda 1 m para o lado para pegar a escada): tira o giro e ela fica sempre de frente para a escada.
function ajustarEscalada(cru) {
  const tw = new THREE.Quaternion(), q = new THREE.Quaternion();
  for (const nome of ANIMS_ESCALADA) {
    for (const [n, , v] of cru[nome]?.t || []) {
      if (/Hips\.position$/.test(n)) for (let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 2] = 0; }
      if (/ladder/.test(nome) && /Hips\.quaternion$/.test(n)) for (let i = 0; i < v.length; i += 4) {
        q.fromArray(v, i); tw.set(0, q.y, 0, q.w).normalize();
        q.premultiply(tw.invert()).toArray(v, i);
      }
    }
  }
  return cru;
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
  // escalada: o servidor sobe e desce o corpo pelo caminho do quadril, então o quadril fica na altura de quem está em pé
  const pe = clipes.parada?.tracks.find((x) => /\.position$/.test(x.name))?.values[vertical];
  for (const nome of ANIMS_ESCALADA) {
    const tr = clipes[nome]?.tracks.find((x) => /\.position$/.test(x.name)); if (!tr || pe == null) continue;
    for (let i = vertical; i < tr.values.length; i += 3) tr.values[i] = pe;
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
// Cópias do mesmo personagem (uma horda inteira, os NPCs) reaproveitam as texturas da primeira: a imagem só é decodificada uma vez
const texturasVRM = new Map(); // id -> [Texture por índice do glTF]
let lendo = null; // id do VRM sendo lido agora (um de cada vez, ver fila)
vrmLoader.register(() => ({ name: 'texturasRepetidas', loadTexture: (i) => { const t = texturasVRM.get(lendo)?.[i]; return t ? Promise.resolve(t) : null; } }));
// No celular as texturas diminuem (o personagem ocupa pouco da tela): 1024 no herói, 512 nos outros. Cada VRM chega a ~150 MB
// de textura em 2048 e o celular fechava a página ao carregar o herói, os NPCs e o bando juntos.
const CELULAR = matchMedia('(pointer: coarse)').matches;
let principal = null;
const limiteTextura = (id) => (!CELULAR ? Infinity : id === principal ? 1024 : 512);
async function encolher(tex, max) {
  const img = tex.image;
  if (!img || Math.max(img.width, img.height) <= max || typeof createImageBitmap !== 'function') return;
  const k = max / Math.max(img.width, img.height);
  try {
    tex.image = await createImageBitmap(img, { resizeWidth: Math.round(img.width * k), resizeHeight: Math.round(img.height * k), resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    img.close?.(); tex.needsUpdate = true;
  } catch { /* sem redimensionar: fica a original */ }
}
let fila = Promise.resolve();
function lerVRM(id, buf) {
  const vez = fila.then(async () => {
    lendo = id;
    const gltf = await new Promise((ok, nao) => vrmLoader.parse(buf.slice(0), '', ok, nao));
    if (!texturasVRM.has(id)) {
      const n = gltf.parser.json.textures?.length || 0, lista = [];
      for (let i = 0; i < n; i++) { lista[i] = await gltf.parser.getDependency('texture', i); await encolher(lista[i], limiteTextura(id)); }
      texturasVRM.set(id, lista);
    }
    return gltf;
  });
  fila = vez.catch(() => {});
  return vez;
}
const baixarVRM = (id) => {
  if (!cacheVRM.has(id)) cacheVRM.set(id, fetch(`assets/personagens/vrm/${id}.vrm`).then((r) => { if (!r.ok) throw new Error(`${id}.vrm: ${r.status}`); return r.arrayBuffer(); }));
  return cacheVRM.get(id);
};
// O personagem do jogador entra na frente da fila (texturas maiores e é ele que a tela de carregamento espera)
const adiantado = new Map(); // id -> gltf já lido, para o primeiro Corpo desse personagem
export function aquecerVRM(id) {
  principal = id;
  if (!texturasVRM.has(id) && !adiantado.has(id)) adiantado.set(id, baixarVRM(id).then((buf) => lerVRM(id, buf)));
}
const cacheVRM = new Map(); // id -> ArrayBuffer (baixa uma vez, cada jogador ganha a sua cópia)
const materiaisVRM = new Map(); // id -> { nome do material: material } (cópias do mesmo personagem dividem as texturas)
// O cabelo do VRoid vem em dezenas de pedacinhos (um desenho cada). Junta os que têm o mesmo material
// num só, refazendo os índices dos ossos: um personagem cai de ~130 para ~15 chamadas de desenho.
function juntarMalhas(raiz) {
  const grupos = new Map();
  raiz.traverse((o) => {
    if (!o.isSkinnedMesh || Array.isArray(o.material) || Object.keys(o.geometry.morphAttributes).length) return;
    const k = o.material.uuid + '|' + o.parent.uuid;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(o);
  });
  for (const lista of grupos.values()) {
    if (lista.length < 2 || lista.some((o) => !o.bindMatrix.equals(lista[0].bindMatrix) || !o.matrix.equals(lista[0].matrix))) continue;
    const ossos = [], inversas = [], indice = new Map();
    const geos = lista.map((o) => {
      const g = o.geometry.clone(), si = g.attributes.skinIndex;
      const mapa = o.skeleton.bones.map((b, i) => {
        if (!indice.has(b)) { indice.set(b, ossos.length); ossos.push(b); inversas.push(o.skeleton.boneInverses[i].clone()); }
        return indice.get(b);
      });
      const novo = new THREE.Uint16BufferAttribute(si.count * 4, 4), de = (i) => mapa[i] ?? 0;
      for (let i = 0; i < si.count; i++) novo.setXYZW(i, de(si.getX(i)), de(si.getY(i)), de(si.getZ(i)), de(si.getW(i)));
      g.setAttribute('skinIndex', novo);
      return g;
    });
    let junto; try { junto = mergeGeometries(geos); } catch { junto = null; }
    if (!junto) continue;
    const m = new THREE.SkinnedMesh(junto, lista[0].material);
    m.name = lista[0].name; m.castShadow = true; m.frustumCulled = false; m.matrix.copy(lista[0].matrix); m.matrix.decompose(m.position, m.quaternion, m.scale);
    lista[0].parent.add(m);
    m.bind(new THREE.Skeleton(ossos, inversas), lista[0].bindMatrix);
    for (const o of lista) o.removeFromParent();
  }
}

async function carregarVRM(id) {
  const pronto = adiantado.get(id); adiantado.delete(id); // só o primeiro Corpo usa o já lido
  const gltf = pronto ? await pronto : await lerVRM(id, await baixarVRM(id));
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.removeUnnecessaryJoints(gltf.scene);
  VRMUtils.rotateVRM0(vrm); // VRM antigo olha para -Z; o jogo usa +Z
  juntarMalhas(vrm.scene);
  // várias cópias do mesmo personagem (uma horda inteira) usam os mesmos materiais: a memória de textura não multiplica
  if (!materiaisVRM.has(id)) materiaisVRM.set(id, {});
  const mats = materiaisVRM.get(id), trocar = (m) => {
    if (!mats[m.name]) { mats[m.name] = m; return m; }
    if (mats[m.name] !== m) m.dispose(); // as texturas já são as mesmas (texturasRepetidas)
    return mats[m.name];
  };
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    o.material = Array.isArray(o.material) ? o.material.map(trocar) : trocar(o.material);
  });
  return vrm;
}

// ---------- variações de cor (NPCs e inimigos com o mesmo modelo, mas cabelo e roupa diferentes) ----------
// troca: pinta pela luminosidade (mantém mechas, dobras e costuras e troca a cor, inclusive para mais claro).
// razao: multiplica cada canal (pele: o rosado da bochecha e da boca continua, só o tom muda).
const tingidas = new Map();
function tingir(tex, cor, modo = 'troca') {
  const k = tex.uuid + ':' + cor + ':' + modo;
  if (tingidas.has(k)) return tingidas.get(k);
  const img = tex.image, lado = Math.min(1024, img.width), alto = Math.round(img.height * lado / img.width);
  const cv = document.createElement('canvas'); cv.width = lado; cv.height = alto;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0, lado, alto);
  const dados = g.getImageData(0, 0, lado, alto), px = dados.data;
  const soma = [0, 0, 0]; let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 8) { soma[0] += px[i]; soma[1] += px[i + 1]; soma[2] += px[i + 2]; n++; }
  const med = soma.map((v) => Math.max(8, v / Math.max(1, n))), lumMed = Math.max(8, med[0] * 0.3 + med[1] * 0.59 + med[2] * 0.11);
  const c = new THREE.Color(cor), alvo = [c.r * 255, c.g * 255, c.b * 255];
  for (let i = 0; i < px.length; i += 4) {
    if (modo === 'razao') { for (let k = 0; k < 3; k++) px[i + k] = Math.min(255, px[i + k] * alvo[k] / med[k]); continue; }
    const l = Math.min(1.7, (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / lumMed), f = 0.35 + 0.65 * l;
    px[i] = Math.min(255, alvo[0] * f); px[i + 1] = Math.min(255, alvo[1] * f); px[i + 2] = Math.min(255, alvo[2] * f);
  }
  g.putImageData(dados, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = tex.flipY; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  tingidas.set(k, t);
  return t;
}
// tinta = { cabelo, olhos, pele, roupa, calca } (cores 0xRRGGBB; null = cor original). Materiais tingidos são divididos entre cópias iguais.
const materiaisTingidos = new Map();
const PARTES = [[/HAIR/, 'cabelo'], [/EyeIris/, 'olhos'], [/SKIN/, 'pele'], [/Bottoms/, 'calca'], [/Tops|Accessory/, 'roupa']];
function tingirVRM(vrm, id, tinta) {
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    const troca = (atual) => {
      const m = atual.userData.base || atual; // sempre pinta a partir do material original
      const parte = PARTES.find(([re]) => re.test(m.name))?.[1];
      const cor = parte && (parte === 'calca' ? tinta.calca ?? tinta.roupa : tinta[parte]);
      if (cor == null || !m.map) return m;
      const modo = parte === 'pele' ? 'razao' : 'troca', k = id + '|' + m.name + '|' + cor;
      if (!materiaisTingidos.has(k)) {
        const novo = m.clone(), mesma = m.shadeMultiplyTexture === m.map;
        novo.userData = { base: m };
        novo.map = tingir(m.map, cor, modo);
        if (m.shadeMultiplyTexture) novo.shadeMultiplyTexture = mesma ? novo.map : tingir(m.shadeMultiplyTexture, cor, modo);
        if (novo.shadeColorFactor && modo === 'troca') novo.shadeColorFactor.set(cor).multiplyScalar(0.55).lerp(new THREE.Color(0.45, 0.4, 0.45), 0.3);
        materiaisTingidos.set(k, novo);
      }
      return materiaisTingidos.get(k);
    };
    o.material = Array.isArray(o.material) ? o.material.map(troca) : troca(o.material);
  });
}

// ---------- formato do rosto (criador): olhos, nariz e boca maiores ou menores ----------
// O VRoid não traz esse ajuste. Aqui ele vira um morph a mais na malha do rosto: cada parte cresce a partir do seu centro
// e a pele em volta acompanha, cada vez menos com a distância. Influência = tamanho - 1 (negativa diminui).
const ROSTO = ['olhosT', 'narizT', 'bocaT'];
const nomeMat = (o) => (Array.isArray(o.material) ? o.material[0] : o.material).name; // pele vem com contorno: [material, contorno]
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function formarRosto(vrm) {
  const malhas = [];
  vrm.scene.traverse((o) => { if (o.isMesh && o.geometry.morphAttributes.position && /Face|Eye/.test(nomeMat(o))) malhas.push(o); });
  const de = (re) => malhas.filter((m) => re.test(nomeMat(m)));
  const pontos = (lista, filtro = () => true) => {
    const r = [];
    for (const m of lista) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); if (filtro(v)) r.push(v); } }
    return r;
  };
  const media = (l) => l.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(Math.max(1, l.length));
  const olho = /EyeWhite|EyeIris|EyeHighlight|EyeExtra|FaceEyeline|FaceEyelash/, boca = /FaceMouth/;
  const brancos = pontos(de(/EyeWhite/)), pele = pontos(de(/_SKIN/));
  if (!malhas.length || brancos.length < 6 || !pele.length) return null;
  const lados = [media(brancos.filter((v) => v.x > 0)), media(brancos.filter((v) => v.x <= 0))];
  const frente = vrm.meta?.metaVersion === '0' ? -1 : 1, sep = lados[0].distanceTo(lados[1]); // VRM antigo olha para -Z na malha
  const raioOlho = (c) => Math.max(...brancos.filter((v) => Math.sign(v.x) === Math.sign(c.x)).map((v) => Math.hypot(v.x - c.x, v.y - c.y)));
  const bocaPts = pontos(de(boca)), caixa = new THREE.Box3().setFromPoints(bocaPts.length ? bocaPts : [new THREE.Vector3()]);
  const cBoca = caixa.getCenter(new THREE.Vector3()), rBoca = Math.max(sep * 0.12, (caixa.max.x - caixa.min.x) / 2);
  // nariz: o ponto mais à frente da pele no meio do rosto, entre os olhos e a boca
  const yOlho = (lados[0].y + lados[1].y) / 2, yNariz = yOlho + (cBoca.y - yOlho) * 0.62;
  const meio = pele.filter((v) => Math.abs(v.x) < sep * 0.12 && Math.abs(v.y - yNariz) < Math.abs(cBoca.y - yOlho) * 0.3);
  const ponta = meio.reduce((a, v) => (!a || v.z * frente > a.z * frente ? v : a), null);
  const rNariz = sep * 0.3, cNariz = ponta ? ponta.clone().setZ(ponta.z - frente * rNariz * 0.5) : null;
  // [centro, raio cheio, raio até sumir, só no plano do rosto?, quem sempre vai junto]
  const partes = {
    olhosT: lados.map((c) => { const r = raioOlho(c); return [c, r, r * 1.6, true, olho]; }),
    narizT: cNariz ? [[cNariz, rNariz * 0.45, rNariz, false, null]] : [],
    bocaT: bocaPts.length ? [[cBoca, rBoca, rBoca * 1.8, true, boca]] : [],
  };
  const info = [];
  for (const m of malhas) {
    const g = m.geometry, p = g.attributes.position, idx = [];
    for (const k of ROSTO) {
      const d = new Float32Array(p.count * 3), v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        // a parte mais perto (cada olho só mexe no seu lado)
        const lista = partes[k].filter(([c]) => partes[k].length < 2 || Math.sign(c.x) === Math.sign(v.x || 1));
        for (const [c, r0, r1, plano, junto] of lista) {
          const w = junto?.test(nomeMat(m)) ? 1 : 1 - suave(r0, r1, v.distanceTo(c));
          if (!w) continue;
          d[i * 3] = (v.x - c.x) * w; d[i * 3 + 1] = (v.y - c.y) * w; d[i * 3 + 2] = plano ? 0 : (v.z - c.z) * w;
        }
      }
      g.morphAttributes.position.push(new THREE.BufferAttribute(d, 3));
      if (g.morphAttributes.normal) g.morphAttributes.normal.push(new THREE.BufferAttribute(new Float32Array(p.count * 3), 3));
      m.morphTargetInfluences.push(0); idx.push(m.morphTargetInfluences.length - 1);
      m.morphTargetDictionary[k] = idx[idx.length - 1];
    }
    info.push({ m, idx });
  }
  return info;
}
const rostos = new WeakMap(); // vrm -> morphs do rosto já montados
// só monta o morph quando o rosto foi mexido (NPCs e inimigos ficam como vieram)
function aplicarRosto(vrm, aparencia) {
  const vals = ROSTO.map((k) => (aparencia?.[k] ?? 1) - 1);
  if (!rostos.has(vrm)) { if (vals.every((x) => !x)) return; rostos.set(vrm, formarRosto(vrm) || []); }
  for (const { m, idx } of rostos.get(vrm)) idx.forEach((i, j) => { m.morphTargetInfluences[i] = vals[j]; });
}

const eixo = (x, y, z, ang) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z), ang);
// Posição das armas no VRM, em relação ao corpo em pose T (olhando para +Z).
// O braço ao descer gira em torno de Z, então o que aponta para +Z continua para a frente.
const ARMAS_VRM = {
  espada: { mao: 'rightHand', giro: eixo(1, 0, 0, Math.PI / 2), desloc: [0, -0.02, 0.02], escala: 1 },
};

// ritmo do balanço montado (ciclo em segundos, igual ao das animações do lobo) e quanto o corpo mexe
const MONTADO_PASSO = { parado: { ciclo: 2, forca: 0.3 }, andar: { ciclo: 0.5, forca: 0.6 }, correr: { ciclo: 0.6, forca: 1.4 } };
const TMP_A = new THREE.Vector3(), TMP_B = new THREE.Vector3(), TMP_Q = new THREE.Quaternion(), TMP_EULER = new THREE.Euler();

export class Corpo {
  // visual: 'soldado' (padrão), id de um VRM, ou cor para NPC/bandido
  // armas: 'heroi' (espada mágica azul), 'inimigo' (espada mágica na cor do brilho) ou 'nenhuma'; bravo: cara de raiva
  // tinta: cores novas de cabelo e roupa para o VRM (NPCs e inimigos variados)
  constructor(scene, { cor, escala = 1, armas = 'heroi', visual = 'soldado', brilho = COR_HEROI, bravo = false, tinta = null }) {
    this.scene = scene; this.visual = visual; this.brilho = brilho; this.bravo = bravo; this.tinta = tinta; this.escalaBase = escala;
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
    if (armas === 'heroi') this.prepararCajado(corpo.getObjectByName('mixamorigSpine2'), mao, corpo);
    this.pronto();
  }
  // Herói: cajado nas costas (modo espada) ou na mão (modo magia); a espada faz o caminho contrário
  prepararCajado(costas, mao, raiz) {
    if (!costas || !mao) return;
    raiz.updateMatrixWorld(true);
    const qRoot = this.root.getWorldQuaternion(new THREE.Quaternion());
    // preso rígido num osso, com giro e posição dados no espaço do corpo (na pose de descanso, agora)
    const fixo = (obj, cfg) => {
      const qOsso = costas.getWorldQuaternion(new THREE.Quaternion()), escala = 1 / costas.getWorldScale(new THREE.Vector3()).x;
      const p = costas.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...cfg.desloc).applyQuaternion(qRoot));
      return { pos: costas.worldToLocal(p), quat: qOsso.invert().multiply(qRoot).multiply(cfg.giro), escala: escala * this.root.scale.x };
    };
    const esp = this.armas.espada[0];
    this.armasPos = {
      espadaMao: { pai: esp.parent, pos: esp.position.clone(), quat: esp.quaternion.clone(), escala: esp.scale.x },
      espadaCostas: { pai: costas, ...fixo(esp, COSTAS.espada) },
      cajadoCostas: { pai: costas, ...fixo(null, COSTAS.cajado) },
    };
    this.cajado = cajadoMagico(this.brilho); this.maoCajado = mao;
    this.modo = null; this.armar('Espada');
  }
  armar(modo) {
    if (!this.cajado || modo === this.modo) return;
    this.modo = modo;
    const por = (obj, l) => { l.pai.add(obj); obj.position.copy(l.pos); obj.quaternion.copy(l.quat); obj.scale.setScalar(l.escala); };
    const P = this.armasPos, esp = this.armas.espada[0];
    if (modo === 'Escalada') { por(esp, P.espadaCostas); por(this.cajado, P.cajadoCostas); } // escalando: as duas nas costas, mãos livres
    else if (modo === 'Magia') { por(esp, P.espadaCostas); this.maoCajado.add(this.cajado); this.cajado.scale.setScalar(1 / this.maoCajado.getWorldScale(new THREE.Vector3()).x * this.root.scale.x); }
    else { por(esp, P.espadaMao); por(this.cajado, P.cajadoCostas); }
  }
  // cajado na mão: segue a mão, mas fica em pé (levemente inclinado para a frente), seja qual for a animação
  segurarCajado() {
    if (this.modo !== 'Magia' || !this.cajado) return;
    const mao = this.maoCajado, q = this.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, -0.08)));
    this.cajado.position.set(0, 0, 0);
    this.cajado.quaternion.copy(mao.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
  }
  montarVRM(vrm, armas) {
    if (this.removido) { VRMUtils.deepDispose(vrm.scene); return; }
    if (this.tinta) { tingirVRM(vrm, this.visual, this.tinta); aplicarRosto(vrm, this.tinta); }
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
    if (armas === 'heroi') this.prepararCajado(vrm.humanoid.getRawBoneNode('upperChest') || vrm.humanoid.getRawBoneNode('chest'), vrm.humanoid.getRawBoneNode('rightHand'), vrm.scene);
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
    const deNovo = this.atual === nome && a.isRunning(); // a mesma animação emendada (escalar, subir a escada): recomeça sem passar pela pose de descanso
    a.reset().setLoop(segurar ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).setEffectiveTimeScale(ts || 1);
    if (deNovo) a.stopFading().setEffectiveWeight(1); else a.fadeIn(0.12);
    a.play();
    a.clampWhenFinished = true;
    if (this.atual && this.atual !== nome) this.acao(this.atual)?.fadeOut(0.12);
    this.atual = nome;
  }
  // Criador de personagem: troca as cores e a altura na hora, sem recarregar o modelo
  repintar(aparencia) {
    this.tinta = aparencia || {};
    this.root.scale.setScalar(this.escalaBase * (aparencia?.altura || 1));
    if (this.vrm) { tingirVRM(this.vrm, this.visual, this.tinta); aplicarRosto(this.vrm, this.tinta); }
  }
  // Montaria: o lobo vai embaixo do herói, que senta na sela (quadril preso no osso das costas do lobo)
  montar(id) {
    if (id === this.montadoId) return;
    this.montaria?.remover(); this.montaria = null; this.montadoId = id;
    if (id) this.montaria = new Montaria(id, this.root);
    else this.inclina.position.set(0, 0, 0);
  }
  // Montado: pernas abertas em volta do lobo, corpo agachado para a frente e mãos no pelo do pescoço.
  // O tronco balança no ritmo do lobo (mais forte correndo). Vai por cima da animação parada.
  sentar(dt) {
    const h = this.vrm?.humanoid; if (!h) return;
    const f = this.vrm.meta?.metaVersion === '0' ? -1 : 1; // VRM antigo olha para -Z nos ossos
    const osso = (n) => h.getNormalizedBoneNode(n);
    const por = (n, x, y, z, ordem = 'XYZ') => osso(n)?.quaternion.setFromEuler(TMP_EULER.set(x * f, y, z * f, ordem));
    const passo = MONTADO_PASSO[this.montaria.atual] || MONTADO_PASSO.parado;
    this.balanco = ((this.balanco || 0) + dt / passo.ciclo) % 1;
    const s = Math.sin(this.balanco * Math.PI * 2), b = passo.forca;
    for (const [lado, l] of [['left', 1], ['right', -1]]) {
      por(lado + 'UpperLeg', -1.25, 0, 0.55 * l, 'ZXY');
      por(lado + 'LowerLeg', 1.5 + 0.15 * b * s, 0, 0);
      por(lado + 'Foot', -0.3, 0, 0);
      // braços para a frente e para baixo, cotovelo dobrado, mãos agarrando o pelo
      por(lado + 'UpperArm', 0, -1.25 * l, -0.35 * l, 'YZX');
      por(lado + 'LowerArm', 0, -0.5 * l - 0.1 * b * s * l, -0.35 * l, 'XYZ');
      por(lado + 'Hand', 0, 0, -0.35 * l);
    }
    por('spine', 0.6 + 0.08 * b * s, 0, 0);
    por('chest', 0.4 + 0.06 * b * s, 0, 0);
    por('upperChest', 0.15, 0, 0);
    por('neck', -0.5 - 0.06 * b * s, 0, 0);
    por('head', -0.4, 0, 0);
  }
  // Recebe o estado vindo da simulação
  // t: hora do servidor em que essa foto foi tirada (online). Com ela o corpo desliza entre as fotos em vez de pular.
  aplicar(e, t = null) {
    this.alvo.set(e.x, e.y || 0, e.z); this.alvoRy = e.ry; this.anim = e.anim;
    if (t != null) {
      const a = this.amostras ||= [];
      if (!a.length || t > a[a.length - 1].t) a.push({ t, x: e.x, y: e.y || 0, z: e.z, ry: e.ry });
      if (a.length > 12) a.shift();
    } else this.amostras = null;
    if ('montado' in e) this.montar(e.montado);
    // montado: o lobo anda e o herói fica sentado; enquanto o lobo não aparece, o herói anda normal
    if (this.montaria) { this.montaria.aplicar(e.anim); if (this.montaria.mixer) e = { ...e, anim: 'Idle' }; }
    if (this.primeira) { this.root.position.copy(this.alvo); this.root.rotation.y = e.ry; this.primeira = false; }
    if (!this.mixer) { this.estado = e; return; }
    const escalando = ESCALANDO.has(e.acao?.nome) || ESCALANDO.has(e.anim);
    const modo = escalando || this.montaria ? 'Escalada' : e.modo || (this.modo === 'Escalada' ? 'Espada' : null);
    if (modo) this.armar(modo); // escalando ou montado: espada e cajado nas costas, mãos livres
    if (e.acao && e.acaoSeq !== this.seq) this.tocarUmaVez(e.acao);
    else if (!e.acao) this.tocarLaco(e.anim);
    this.seq = e.acaoSeq;
  }
  // Acha as duas fotos em volta de tVer e liga uma na outra. Se a próxima foto atrasar, segue um pouco na mesma direção
  // (até 0,1 s) e depois espera parado, em vez de pular.
  interpolar(tVer) {
    const a = this.amostras;
    while (a.length > 2 && a[1].t <= tVer) a.shift();
    let p, q;
    if (a.length === 1 || tVer <= a[0].t) { p = q = a[0]; }
    else { p = a[0]; q = a[1]; }
    let k = q.t > p.t ? (tVer - p.t) / (q.t - p.t) : 0;
    k = Math.max(0, Math.min(k, 1 + 0.1 / Math.max(0.05, q.t - p.t)));
    if (Math.hypot(q.x - p.x, q.z - p.z) > 6) k = k < 1 ? 0 : 1; // teleporte de verdade (renasceu): não atravessa o mapa deslizando
    if (k > 1 && a.length === 1) k = 1;
    const d = Math.atan2(Math.sin(q.ry - p.ry), Math.cos(q.ry - p.ry));
    this.alvo.set(p.x + (q.x - p.x) * k, p.y + (q.y - p.y) * k, p.z + (q.z - p.z) * k);
    this.alvoRy = p.ry + d * Math.min(k, 1);
    return true;
  }
  // tVer: hora do servidor que a tela está mostrando agora (um pouco no passado, para sempre ter duas fotos para ligar)
  atualizar(dt, tVer = null) {
    if (tVer != null && this.amostras?.length && this.interpolar(tVer)) {
      this.root.position.copy(this.alvo); this.root.rotation.y = this.alvoRy;
    } else {
      // previsto (o meu herói) ou modo solo: segue o alvo com uma suavização curta
      const k = 1 - Math.exp(-dt * (this.previsto ? 30 : 14));
      this.root.position.lerp(this.alvo, k);
      const d = Math.atan2(Math.sin(this.alvoRy - this.root.rotation.y), Math.cos(this.alvoRy - this.root.rotation.y));
      this.root.rotation.y += d * k;
    }
    this.inclina.rotation.x += ((this.anim === 'dash' ? 0.42 : 0) - this.inclina.rotation.x) * Math.min(1, dt * 18);
    this.mixer?.update(dt);
    if (this.montaria) this.assentar(dt);
    if (this.vrm) {
      // piscar de vez em quando
      this.piscar -= dt;
      const p = this.piscar < 0 ? Math.max(0, 1 - Math.abs(this.piscar + 0.08) / 0.08) : 0;
      if (this.piscar < -0.16) this.piscar = 2 + Math.random() * 4;
      this.vrm.expressionManager?.setValue('blink', p);
      if (this.bravo) this.vrm.expressionManager?.setValue('angry', 0.8); // inimigo: cara de raiva
      this.vrm.update(dt);
    }
    this.segurarCajado();
  }
  assentar(dt) {
    const m = this.montaria;
    m.grupo.scale.setScalar(m.dados.escala / this.root.scale.x); // o lobo não cresce junto com a altura do herói
    m.atualizar(dt);
    const quadril = this.vrm?.humanoid.getNormalizedBoneNode('hips'), sela = m.sela?.getWorldPosition(TMP_A);
    if (!quadril || !sela) return; // o lobo ainda está carregando
    this.sentar(dt);
    this.root.updateMatrixWorld(true);
    sela.y += 0.2 * m.dados.escala / 1.9; // da coluna até o lombo
    // quanto falta para o quadril chegar na sela, no espaço do corpo
    const d = sela.sub(quadril.getWorldPosition(TMP_B)).applyQuaternion(this.root.getWorldQuaternion(TMP_Q).invert()).divideScalar(this.root.scale.x);
    this.inclina.position.add(d);
  }
  // posição das mãos no mundo (para o brilho da magia)
  maos() { return this.maosOssos.filter(Boolean).map((o) => o.getWorldPosition(new THREE.Vector3())); }
  // base e ponta da lâmina no mundo, se a espada estiver na mão
  lamina() {
    const e = this.armas.espada?.[0]; if (!e || !e.visible || !LAMINA || this.modo === 'Magia' || this.modo === 'Escalada') return null; // nas costas não deixa rastro
    return [e.localToWorld(LAMINA.base.clone()), e.localToWorld(LAMINA.ponta.clone())];
  }
  // criador aberto: guarda as armas (a câmera chega perto do rosto)
  mostrarArmas(v) {
    for (const a of [...(this.armas.espada || []), this.cajado]) if (a) a.visible = v;
  }
  remover() {
    this.montaria?.remover();
    this.removido = true; this.scene.remove(this.root);
    if (this.vrm) this.vrm.scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); // materiais ficam: outras cópias usam
  }
}
