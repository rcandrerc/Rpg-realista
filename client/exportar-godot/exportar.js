// Ferramenta: exporta a vila e os personagens anime (com animações já convertidas) em GLB para o protótipo Godot.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MAPA_CLAREIRA } from '@rpg/shared';
import { criarRenderizador, montarCena } from '../src/cena.js';
import { carregarPersonagens, Corpo } from '../src/personagens.js';

const saida = {};
window.__saida = saida;
const exportar = (obj, animations = []) => new Promise((ok, nao) => new GLTFExporter().parse(obj, (r) => ok(r), nao, { binary: true, animations, onlyVisible: true }));
const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

const boa = (t) => {
  const i = t?.image; if (!i) return null;
  const ok = (typeof HTMLImageElement !== 'undefined' && i instanceof HTMLImageElement && i.complete && i.naturalWidth > 0)
    || (typeof HTMLCanvasElement !== 'undefined' && i instanceof HTMLCanvasElement) || (typeof ImageBitmap !== 'undefined' && i instanceof ImageBitmap);
  return ok ? t : null;
};
function materialSimples(m) {
  const n = new THREE.MeshStandardMaterial({ name: m.name });
  const u = m.uniforms || {};
  n.map = boa(m.map || u.map?.value);
  n.normalMap = boa(m.normalMap);
  if (m.color) n.color.copy(m.color); else if (u.litFactor) n.color.copy(u.litFactor.value);
  n.roughness = m.roughness ?? 0.9; n.metalness = m.metalness ?? 0;
  n.transparent = !!m.transparent; n.alphaTest = m.alphaTest || 0; n.side = m.side ?? THREE.FrontSide;
  if (m.emissive) n.emissive.copy(m.emissive);
  return n;
}
function simplificar(raiz) {
  raiz.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(materialSimples) : materialSimples(o.material); });
}

async function principal() {
  const renderer = criarRenderizador(document.getElementById('c'));
  const mundo = await montarCena(renderer, MAPA_CLAREIRA);
  await new Promise((r) => setTimeout(r, 8000)); // texturas terminam de chegar
  // cenário: tudo menos grama (o Godot faz a sua), luzes e céu
  const vila = new THREE.Group();
  for (const o of [...mundo.scene.children]) {
    if (o.isLight || o === mundo.grama) continue;
    vila.add(o.clone());
  }
  simplificar(vila);
  saida.vila = b64(await exportar(vila));
  console.log('vila ok');

  await carregarPersonagens();
  const ids = ['ruiva', 'cabelo_m', 'fumiriya', 'shino', 'vivi', 'vita', 'victoria', 'shibu', 'shibu_sombrio'];
  for (const id of ids) {
    const c = new Corpo(mundo.scene, { visual: id, armas: 'nenhuma' });
    for (let i = 0; i < 600 && !c.mixer; i++) await new Promise((r) => setTimeout(r, 100));
    const vrm = c.vrm; if (!vrm) { console.log('sem vrm', id); continue; }
    // grava os ossos de verdade (não os normalizados) quadro a quadro
    const ossos = []; vrm.scene.traverse((o) => { if (o.isBone) ossos.push(o); });
    const clipes = [];
    for (const nome of ['parada', 'andar', 'corrida']) {
      const clip = c.clipes[nome]; if (!clip) continue;
      c.mixer.stopAllAction(); const a = c.mixer.clipAction(clip); a.reset().play();
      const fps = 30, n = Math.max(2, Math.round(clip.duration * fps) + 1), tempos = [];
      const qs = ossos.map(() => []), ps = ossos.map(() => []);
      for (let k = 0; k < n; k++) {
        const t = Math.min(clip.duration, k / fps); tempos.push(t);
        c.mixer.setTime(t); vrm.humanoid.update(); 
        ossos.forEach((b, j) => { qs[j].push(...b.quaternion.toArray()); ps[j].push(...b.position.toArray()); });
      }
      const trilhas = [];
      ossos.forEach((b, j) => {
        trilhas.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, tempos, qs[j]));
        if (/hips/i.test(b.name)) trilhas.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, tempos, ps[j]));
      });
      clipes.push(new THREE.AnimationClip(nome, clip.duration, trilhas));
      a.stop();
    }
    c.mixer.stopAllAction(); c.mixer.setTime(0); vrm.humanoid.update();
    const cena = vrm.scene;
    const rig = cena.children.filter((o) => /VRMHumanoidRig/.test(o.name));
    rig.forEach((r) => cena.remove(r));
    // tira as bolinhas de colisão e helpers do VRM
    cena.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
    simplificar(cena);
    const pai = cena.parent; pai?.remove(cena);
    const grupo = new THREE.Group(); grupo.name = id; grupo.add(cena);
    saida[id] = b64(await exportar(grupo, clipes));
    console.log(id, 'ok', clipes.map((x) => x.name).join(','));
  }
  saida.fim = true;
}
principal().catch((e) => { console.error(e); saida.erro = String(e.stack || e); });
