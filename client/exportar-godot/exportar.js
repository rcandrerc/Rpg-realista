// Ferramenta: exporta a vila e os personagens anime (com animações já convertidas) em GLB para o protótipo Godot.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MAPA_CLAREIRA, A, ESCALADA, PARADO_PAREDE, CRIADOR } from '@rpg/shared';
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
    if (o.isInstancedMesh) { // anel de pedras e samambaias: uma cópia solta por instância (o Godot não lê instâncias do glTF)
      const m = new THREE.Matrix4();
      // árvores da mata: só o modelo (na origem, sem giro); o Godot faz as cópias em MultiMesh com mundo.mata
      if (/^mata_/.test(o.name)) { const c = new THREE.Mesh(o.geometry, o.material); c.name = o.name; vila.add(c); continue; }
      for (let i = 0; i < o.count; i++) {
        const c = new THREE.Mesh(o.geometry, o.material); o.getMatrixAt(i, m);
        m.decompose(c.position, c.quaternion, c.scale); c.name = o.name || 'instancia'; vila.add(c);
      }
      continue;
    }
    vila.add(o.clone());
  }
  simplificar(vila);
  saida.vila = b64(await exportar(vila));
  console.log('vila ok');

  await carregarPersonagens();
  // ?so=ruiva exporta só esse personagem (e pula a vila)
  const so = new URLSearchParams(location.search).get('so');
  const ids = ['ruiva', 'cabelo_m', 'fumiriya', 'shino', 'vivi', 'vita', 'victoria', 'shibu', 'shibu_sombrio'].filter((id) => !so || id === so);
  // herói: todas as animações que a HUD usa; os outros: andar, correr, atacar, apanhar e cair
  const ANIMS_HEROI = {
    parada: 'parada', andar: 'andar', corrida: 'corrida', espada_parada: A.swordIdle,
    combo1: 'combo1', combo2: 'combo2', combo3: 'combo3', combo4: 'combo4', magia1: 'magia1', magia2: 'magia2', magia3: 'magia3',
    investida: 'investida', giro: A.giro, salto: A.jump, relampago: A.raio, bola: A.bolt, raio: A.ceu, explosao: A.ground, meteoros: A.rain,
    magia_d: 'magiaD', magia_e: 'magiaE', bola_forte: A.bolaForte, nova_gelo: A.novaGelo, meteoro_ceu: A.meteoroCeu,
    cura: A.heal, cruzado: A.cruzado, descendente: A.descendente, onda: A.onda, vortice: A.vortice, bloqueio: A.block, golpe1: A.slash, // golpe1: cortar lenha
    rolar: 'rolamento', pulo: 'pulo', mortal: 'mortal', pouso: 'pouso', apanhar: A.hit, morrer: A.death, queda: 'queda',
    freada: 'freada', meia_volta: 'meia_volta', arrancada: 'arrancada', trote: 'trote', // trote: Mixamo Jogging (joystick sem o botão) // o jogo anda pelo caminho do quadril (mundo.json raiz)
    // Mixamo Pro Magic Pack: andar e correr de lado e de costas, para o mago atirar virado para o alvo (André 2026-11-04)
    lado_e_andar: 'lado_e_andar', lado_d_andar: 'lado_d_andar', tras_andar: 'tras_andar', lado_e_correr: 'lado_e_correr', lado_d_correr: 'lado_d_correr', tras_correr: 'tras_correr',
    cajado_parada: 'cajado_parada', // guarda do cajado parada (Pro Magic Pack, Standing Idle 03)
    // escalada: o quadril não anda (quem leva o corpo é o caminho ESCALADA[..].traj)
    ...Object.fromEntries(Object.entries(ESCALADA).map(([k, e]) => ['esc_' + k, e.anim])),
    ...Object.fromEntries(Object.entries(PARADO_PAREDE).map(([k, n]) => ['parede_' + k, n])),
  };
  // inimigos lutam como no servidor: guarda de espada parada e os cortes A.slash / A.slash2
  const ANIMS_OUTROS = { parada: 'parada', andar: 'andar', corrida: 'corrida', espada_parada: A.swordIdle, golpe1: A.slash, golpe2: A.slash2, apanhar: A.hit, morrer: A.death };
  const armas = {};
  for (const id of ids) {
    const heroi = id === 'ruiva';
    // corpo que o jogador pode escolher no criador do app (CRIADOR.corpos): leva todas as animações do herói e o formato do rosto
    const jogavel = heroi || CRIADOR.corpos.includes(id);
    const c = new Corpo(mundo.scene, { visual: id, armas: 'heroi' }); // todos: o lugar das armas muda de corpo para corpo
    for (let i = 0; i < 600 && !c.mixer; i++) await new Promise((r) => setTimeout(r, 100));
    const vrm = c.vrm; if (!vrm) { console.log('sem vrm', id); continue; }
    // grava os ossos de verdade (não os normalizados) quadro a quadro
    const ossos = []; vrm.scene.traverse((o) => { if (o.isBone) ossos.push(o); });
    const clipes = [];
    if (c.armasPos) {
      // armas saem em arquivos próprios; aqui só guardo onde cada uma fica presa (osso + posição local)
      const l = c.armasPos, osso = (o) => o.name;
      const dado = (x) => ({ osso: osso(x.pai), pos: x.pos.toArray(), quat: x.quat.toArray(), escala: x.escala });
      const esp = c.armas.espada[0], caj = c.cajado;
      armas[id] = { espadaMao: dado(l.espadaMao), espadaCostas: dado(l.espadaCostas), cajadoCostas: dado(l.cajadoCostas),
        cajadoMao: { osso: c.maoCajado.name, pos: [0, 0, 0], quat: [0, 0, 0, 1], escala: l.cajadoCostas.escala } };
      for (const [nome, obj] of heroi ? [['espada', esp], ['cajado', caj]] : []) {
        obj.parent?.remove(obj);
        const copia = obj.clone(); copia.position.set(0, 0, 0); copia.quaternion.identity(); copia.scale.setScalar(1);
        const tirar = []; copia.traverse((o) => { if (o.userData.pelicula) tirar.push(o); }); tirar.forEach((o) => o.parent.remove(o));
        simplificar(copia);
        saida['arma_' + nome] = b64(await exportar(copia));
      }
      if (!heroi) { [esp, caj].forEach((o) => o?.parent?.remove(o)); }
    }
    for (const [nome, fonte] of Object.entries(jogavel ? ANIMS_HEROI : ANIMS_OUTROS)) {
      const clip = c.clipes[fonte]; if (!clip) { console.log('falta anim', id, nome, fonte); continue; }
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
    // herói: o formato do rosto do criador (olhosT, narizT, bocaT) vai pronto como blend shape no GLB.
    // Mexer um pouco monta os morphs (formarRosto em personagens.js); depois volta a zero.
    if (jogavel) { c.repintar({ olhosT: 1.1, narizT: 1.1, bocaT: 1.1 }); c.repintar({}); }
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
  saida.armas_json = btoa(JSON.stringify(armas));
  saida.fim = true;
}
principal().catch((e) => { console.error(e); saida.erro = String(e.stack || e); });
