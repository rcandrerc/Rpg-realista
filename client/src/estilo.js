// Estilo visual do mundo. "anime" = mundo pintado (sombra em degraus, texturas repintadas pela paleta do jogo,
// luz clara e cores vivas), para combinar com os personagens VRoid. "atual" = cenário fotográfico de antes.
// O pintado é o padrão. Escolha: ?estilo=anime|atual na URL ou o botão Estilo do menu (fica guardado no aparelho).
import * as THREE from 'three';

// chave nova: quem só testou o botão quando o padrão era o realista volta para o pintado
const CHAVE = 'estiloMundo';
const lerGuardado = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
export const estilo = new URLSearchParams(location.search).get('estilo') || lerGuardado() || 'anime';
export const anime = estilo === 'anime';

// Texturas: no estilo anime cada foto da Poly Haven (..._diff_1k.jpg) troca pela versão pintada
// (ferramentas/pintar-texturas). Relevo e rugosidade não são usados: viram um pixel neutro e nem são baixados.
const PIXEL_NORMAL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaPgPAAODAgAApfuJAAAAAElFTkSuQmCC';
if (anime) {
  THREE.DefaultLoadingManager.setURLModifier((url) => {
    if (!url.includes('assets/cenario/')) return url;
    const arq = url.split('/').pop();
    if (/_(nor_gl|arm)_\dk\.jpg$/.test(arq)) return PIXEL_NORMAL;
    const m = arq.match(/^(.+)_diff_\dk\.jpg$/);
    if (m) return url.slice(0, url.indexOf('assets/cenario/')) + 'assets/cenario/pintado/' + m[1] + '.jpg';
    if (arq === 'folhagem.png') return url.replace(/assets\/cenario\/.*$/, 'assets/cenario/pintado/folhagem.png');
    return url;
  });
}

// Paleta usada fora das texturas (grama, névoa, luz)
export const PALETA = {
  grama: [[0.22, 0.27], [0.45, 0.62], [0.3, 0.46]], // matiz, saturação, luminosidade (faixas)
  nevoa: 0xa9c8e6, sol: 0xfff1d6, ceuLuz: 0xcfe2ff, chaoLuz: 0x7a6a4a,
};

// Sombra em três degraus: luz, meia-sombra e sombra (a sombra nunca vai ao preto, como em desenho)
function degraus() {
  const v = [118, 196, 255], d = new Uint8Array(12);
  v.forEach((x, i) => d.set([x, x, x, 255], i * 4));
  const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

// Troca os materiais do cenário por toon. Chamado de novo quando algo é posto na cena depois (é barato: usa cache).
const cache = new Map();
let grad;
const BASE = THREE.Material.prototype.onBeforeCompile;
export function toon(m) {
  if (!m || !m.isMeshStandardMaterial) return m;
  if (cache.has(m)) return cache.get(m);
  grad ||= degraus();
  const n = new THREE.MeshToonMaterial({
    map: m.map, color: m.color.clone(), gradientMap: grad, alphaTest: m.alphaTest, side: m.side, transparent: m.transparent,
    emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap, vertexColors: m.vertexColors,
  });
  // as cores de "envelhecer" a foto (casca, folhas) apagariam a pintura: puxa para o branco
  if (m.map && m.onBeforeCompile === BASE) n.color.lerp(new THREE.Color(1, 1, 1), 0.65);
  // metal continua lendo como metal: brilho mais claro na cor base
  if (m.metalness > 0.5) n.color.multiplyScalar(1.6);
  n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey;
  n.name = m.name;
  cache.set(m, n); return n;
}

export function pintarCena(scene) {
  if (!anime) return;
  scene.traverse((o) => {
    if (!o.isMesh || !o.material || o.isSkinnedMesh) return; // personagens (VRM) já são desenhados em toon
    o.material = Array.isArray(o.material) ? o.material.map(toon) : toon(o.material);
  });
}

// Luz, céu e cor final. Devolve quem desenha o quadro (ou null: desenho direto, estilo atual).
export function aplicarEstilo(renderer, scene, camera, sol) {
  if (!anime) return null;
  pintarCena(scene);
  renderer.toneMappingExposure = 0.8;
  sol.intensity = 1.7; sol.color.set(PALETA.sol);
  scene.children.filter((o) => o.isHemisphereLight).forEach((h) => { h.intensity = 1.05; h.color.set(PALETA.ceuLuz); h.groundColor.set(PALETA.chaoLuz); });
  scene.fog = new THREE.FogExp2(PALETA.nevoa, 0.0075);
  
  // Um passe só por cima do quadro: cores mais vivas e sombras puxando para o azul (barato no celular).
  // O quadro é desenhado num alvo linear com antisserrilhado (WebGL2); o filtro de cor de cinema e a conversão
  // para a tela acontecem no passe, depois da correção (assim as magias também são suavizadas e não estouram).
  const tam = renderer.getDrawingBufferSize(new THREE.Vector2());
  const alvo = new THREE.WebGLRenderTarget(tam.x, tam.y, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tQuadro: { value: alvo.texture } }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D tQuadro; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tQuadro, vUv).rgb;
        float l = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(l), c, 1.22);                                   // cores mais vivas
        c = mix(c * vec3(.9, .94, 1.08), c, smoothstep(.05, .5, l));  // sombra fria, luz quente
        float v = smoothstep(1.15, .4, length(vUv - .5));             // vinheta bem leve
        gl_FragColor = vec4(c * mix(.9, 1., v), 1.);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  }));
  const telaCena = new THREE.Scene(); telaCena.add(quad);
  const telaCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    // outra cena (o palco do criador) usa o mesmo passe: s e c trocam a cena e a câmera
    render(s = scene, c = camera) {
      renderer.getDrawingBufferSize(tam);
      if (alvo.width !== tam.x || alvo.height !== tam.y) alvo.setSize(tam.x, tam.y);
      renderer.setRenderTarget(alvo); renderer.render(s, c);
      renderer.setRenderTarget(null); renderer.render(telaCena, telaCam);
    },
  };
}

// Botão "Estilo" no menu de cima: alterna e recarrega (as texturas são escolhidas no carregamento)
export function botaoEstilo(menu) {
  if (!menu) return;
  const b = document.createElement('button');
  b.className = 'info'; b.type = 'button';
  b.textContent = anime ? 'Estilo: pintado' : 'Estilo: realista';
  b.onclick = () => {
    const novo = anime ? 'atual' : 'anime';
    try { localStorage.setItem(CHAVE, novo); } catch { /* sem armazenamento: vale a URL */ }
    const u = new URL(location.href); u.searchParams.set('estilo', novo); location.href = u.href;
  };
  menu.insertBefore(b, menu.firstChild);
}
