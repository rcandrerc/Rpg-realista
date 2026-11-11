// Modelos próprios dos bosses de mundo (André 2026-11-11): o Titã (feito para o Quimera, do André) vira o Colosso
// Gélido e o dragão evoluído da Quaternius (CC0) vira o Dragão das Cinzas. Sai um .glb com os nomes de animação que
// o Godot usa nos monstros (parada, andar, corrida, golpe1, golpe2, apanhar, morrer), igual ao Bestiário.
//
// Titã: a malha (assets/monstros/tita/tita.glb, IA: FLUX.1-schnell + TRELLIS, rig no Blender) vem com os pesos já no
// esqueleto KayKit Rig_Medium (extras.bones) e o ponto de cada osso no corpo dele (extras.pts). O esqueleto e as
// animações vêm do KayKit Character Animations 1.1 (CC0, anims_kaykit.glb). Igual ao kk/tita.js do Quimera: cada osso
// vai para o ponto do modelo no 1º quadro do "parado" e a malha é presa ali. Nas animações só o quadril anda; os outros
// ossos só giram (a posição deles é a do Titã, não a do boneco KayKit).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const L = new GLTFLoader();
const paraB64 = async (cena, clipes) => {
  const bin = await new GLTFExporter().parseAsync(cena, { binary: true, animations: clipes });
  return new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result.split(',')[1]); fr.readAsDataURL(new Blob([bin])); });
};
// textura -> canvas, passando cada pixel por f(r, g, b) em 0..1 (sRGB)
function repintar(tex, f) {
  const img = tex.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const o = f(p[i] / 255, p[i + 1] / 255, p[i + 2] / 255); for (let k = 0; k < 3; k++) p[i + k] = Math.round(Math.max(0, Math.min(1, o[k])) * 255); }
  x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; return t;
}
const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const srgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

const ORDEM = ['spine', 'chest', 'head', 'upperarml', 'lowerarml', 'wristl', 'handl', 'handslotl', 'upperarmr', 'lowerarmr', 'wristr', 'handr', 'handslotr',
  'upperlegl', 'lowerlegl', 'footl', 'toesl', 'upperlegr', 'lowerlegr', 'footr', 'toesr'];
const TITA_ANIMS = { parada: 'Idle_A', espada_parada: 'Idle_A', andar: 'Walking_A', corrida: 'Walking_A', golpe1: 'Melee_1H_Attack_Slice_Diagonal',
  golpe2: 'Ranged_Magic_Raise', apanhar: 'Melee_Block', morrer: 'Death_A', rugir: 'Ranged_Magic_Summon' };

async function tita(altura) {
  const a = await L.loadAsync('assets/monstros/tita/anims_kaykit.glb');
  const t = await L.loadAsync('assets/monstros/tita/tita.glb');
  const ex = t.parser.json.extras;
  let malha = null; t.scene.traverse((o) => { if (o.isMesh && !malha) malha = o; });
  // esqueleto: os nós do Rig_Medium viram ossos de verdade (o arquivo de animação não tem pele)
  const rig = a.scene.getObjectByName('Rig_Medium');
  const ossos = [], por = {};
  const copiar = (o, pai) => {
    const b = new THREE.Bone(); b.name = o.name; b.position.copy(o.position); b.quaternion.copy(o.quaternion); b.scale.copy(o.scale);
    pai.add(b); ossos.push(b); por[b.name] = b; for (const f of o.children) copiar(f, b);
  };
  const corpo = new THREE.Group(); corpo.name = 'Tita';
  for (const f of rig.children) copiar(f, corpo);
  // pose de encaixe: 1º quadro do parado
  const mixer = new THREE.AnimationMixer(corpo), idle = a.animations.find((c) => c.name === 'Idle_A');
  mixer.clipAction(idle).play(); mixer.update(0); corpo.updateMatrixWorld(true);
  const w = new THREE.Vector3();
  for (const n of ORDEM) {
    const b = por[n], p = ex.pts[n === 'handslotl' ? 'handEndl' : n === 'handslotr' ? 'handEndr' : n]; if (!b || !p) continue;
    w.fromArray(p); corpo.localToWorld(w); b.parent.worldToLocal(w); b.position.copy(w); b.updateMatrixWorld(true);
  }
  mixer.stopAllAction();
  // pesos na ordem do esqueleto
  const geo = malha.geometry.clone(), ix = ex.bones.map((n) => ossos.findIndex((b) => b.name === n)), si = geo.attributes.skinIndex;
  for (let i = 0; i < si.count * 4; i++) si.array[i] = Math.max(0, ix[si.array[i]]);
  // tons escuros mais claros (lift 0.5 do Quimera) e o brilho próprio (rachaduras, olhos) ao quadrado
  const m0 = malha.material;
  const mat = new THREE.MeshStandardMaterial({ name: 'tita', roughness: 0.9, metalness: 0,
    map: repintar(m0.map, (r, g, b) => [r, g, b].map((v) => { const l = lin(v); return srgb(l + (Math.sqrt(l) - l) * 0.5); })) });
  if (m0.emissiveMap) { mat.emissiveMap = repintar(m0.emissiveMap, (r, g, b) => [r * r, g * g, b * b]); mat.emissive = new THREE.Color(1, 1, 1); }
  const pele = new THREE.SkinnedMesh(geo, mat); pele.name = 'TitaMalha';
  corpo.add(pele); corpo.updateMatrixWorld(true); pele.bind(new THREE.Skeleton(ossos), pele.matrixWorld);
  // clipes: quadril e raiz com posição, os outros ossos só com rotação; sem escala
  const clipes = Object.entries(TITA_ANIMS).map(([godot, orig]) => {
    const c = a.animations.find((x) => x.name === orig);
    const trilhas = c.tracks.filter((tr) => { const [osso, prop] = tr.name.split('.'); return prop === 'quaternion' || (prop === 'position' && (osso === 'hips' || osso === 'root')); }).map((tr) => tr.clone());
    return new THREE.AnimationClip(godot, c.duration, trilhas);
  });
  const raiz = new THREE.Group(); raiz.add(corpo);
  corpo.scale.setScalar(altura / ex.pts.headTop[1]);
  return paraB64(raiz, clipes);
}

const DRAGAO_ANIMS = { parada: 'Flying_Idle', espada_parada: 'Flying_Idle', andar: 'Flying_Idle', corrida: 'Fast_Flying', golpe1: 'Headbutt',
  golpe2: 'Punch', apanhar: 'HitReact', morrer: 'Death', rugir: 'Yes' };
async function dragao(altura) {
  const g = await L.loadAsync('assets/monstros/quaternius/Dragon_Evolved.gltf');
  const de = Object.fromEntries(g.animations.map((c) => [c.name, c]));
  const clipes = Object.entries(DRAGAO_ANIMS).map(([godot, orig]) => { const c = de[orig].clone(); c.name = godot; return c; });
  g.scene.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(g.scene), h = caixa.max.y - caixa.min.y;
  const raiz = new THREE.Group(); raiz.add(g.scene); g.scene.scale.multiplyScalar(altura / h);
  return paraB64(raiz, clipes);
}

// { Tita: base64, Dragao: base64 }: o gerar-modelos.mjs grava tita.glb e dragao.glb
export async function modelosBosses() {
  return { Tita: await tita(2.2), Dragao: await dragao(2.0) };
}
