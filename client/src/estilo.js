// PRÉVIA de direção de arte (?estilo=anime). Não muda nada sem o parâmetro na URL.
// Troca os materiais PBR do cenário por toon (sombra em degraus), clareia a luz ambiente,
// tira o filtro de cinema (ACES) e põe uma correção de cor + brilho (bloom) por cima.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export const estilo = new URLSearchParams(location.search).get('estilo');

function degraus(n) {
  const d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = [150, 215, 255][i] ?? 255; d.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(d, n, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

export function aplicarEstilo(renderer, scene, camera, sol) {
  if (estilo !== 'anime') return null;
  const grad = degraus(3), cache = new Map();
  const toon = (m) => {
    if (!m || !m.isMeshStandardMaterial) return m;
    if (cache.has(m)) return cache.get(m);
    const n = new THREE.MeshToonMaterial({
      map: m.map, color: m.color, gradientMap: grad, alphaTest: m.alphaTest, side: m.side, transparent: m.transparent,
      emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap,
    });
    n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey;
    cache.set(m, n); return n;
  };
  scene.traverse((o) => { if (o.isMesh && o.material) o.material = Array.isArray(o.material) ? o.material.map(toon) : toon(o.material); });
  renderer.toneMappingExposure = 0.95;
  scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  sol.intensity = 1.9; sol.color.set(0xfff4e0);
  scene.children.filter((o) => o.isHemisphereLight).forEach((h) => { h.intensity = 1.1; h.color.set(0xd6e8ff); h.groundColor.set(0x6a6248); });
  scene.fog = new THREE.FogExp2(0xbcd6ec, 0.012);

  const comp = new EffectComposer(renderer);
  comp.addPass(new RenderPass(scene, camera));
  comp.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.22, 0.4, 0.95));
  comp.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(l), c, 1.35);                 // cores mais vivas
        c = (c - .5) * 1.06 + .5 + vec3(.01, .015, .03); // contraste leve, sombras puxando para o azul
        float v = smoothstep(1.1, .35, length(vUv - .5)); // vinheta suave
        gl_FragColor = vec4(c * mix(.85, 1., v), 1.);
      }`,
  }));
  return comp;
}
