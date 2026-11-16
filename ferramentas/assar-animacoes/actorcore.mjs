// Passa animações do ActorCore (.fbx, esqueleto CC_Base, Z para cima) para o formato do anims.json (Mixamo)
// pela diferença de rotação de mundo de cada osso em relação à pose de descanso do arquivo (pose em T, igual à do Mixamo).
// Uso: node actorcore.mjs <anims.json.gz atual> <saída.json> <arquivo.fbx:nome> ...
import fs from 'fs'; import zlib from 'zlib';
globalThis.self = globalThis; globalThis.window = globalThis;
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
const console_warn = console.warn; console.warn = () => {};
const A = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])));
const rest = A._rest.ossos, alt = A._rest.alturaQuadril;
const MAP = { CC_Base_Hip: 'Hips', CC_Base_Waist: 'Spine', CC_Base_Spine01: 'Spine1', CC_Base_Spine02: 'Spine2', CC_Base_NeckTwist01: 'Neck', CC_Base_Head: 'Head' };
const PAI = { CC_Base_Waist: 'CC_Base_Hip', CC_Base_Spine01: 'CC_Base_Waist', CC_Base_Spine02: 'CC_Base_Spine01', CC_Base_NeckTwist01: 'CC_Base_Spine02', CC_Base_Head: 'CC_Base_NeckTwist01' };
for (const [s, S] of [['L', 'Left'], ['R', 'Right']]) {
  const b = (n) => `CC_Base_${s}_${n}`;
  Object.assign(MAP, { [b('Clavicle')]: S + 'Shoulder', [b('Upperarm')]: S + 'Arm', [b('Forearm')]: S + 'ForeArm', [b('Hand')]: S + 'Hand',
    [b('Thigh')]: S + 'UpLeg', [b('Calf')]: S + 'Leg', [b('Foot')]: S + 'Foot', [b('ToeBase')]: S + 'ToeBase' });
  Object.assign(PAI, { [b('Clavicle')]: 'CC_Base_Spine02', [b('Upperarm')]: b('Clavicle'), [b('Forearm')]: b('Upperarm'), [b('Hand')]: b('Forearm'),
    [b('Thigh')]: 'CC_Base_Hip', [b('Calf')]: b('Thigh'), [b('Foot')]: b('Calf'), [b('ToeBase')]: b('Foot') });
  for (const [d, D] of [['Thumb', 'Thumb'], ['Index', 'Index'], ['Mid', 'Middle'], ['Ring', 'Ring'], ['Pinky', 'Pinky']])
    for (const k of [1, 2, 3]) { MAP[b(d + k)] = `${S}Hand${D}${k}`; PAI[b(d + k)] = k === 1 ? b('Hand') : b(d + (k - 1)); }
}
// mundo do ActorCore (Z para cima, olha para -Y) -> mundo do Mixamo no three (Y para cima, olha para +Z): -90° em X
const C = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), Ci = C.clone().invert();
const q4 = (a) => new THREE.Quaternion(a[0], a[1], a[2], a[3]);
function carregar(f) {
  const buf = fs.readFileSync(f);
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const ossos = {}; obj.traverse((o) => { if (o.isBone) ossos[o.name] = o; });
  return { obj, ossos, clip: obj.animations[0] };
}
function mundo(ossos) {
  const W = {}, P = {};
  for (const n in MAP) { const o = ossos[n]; W[n] = o.getWorldQuaternion(new THREE.Quaternion()); P[n] = o.getWorldPosition(new THREE.Vector3()); }
  return { W, P };
}
const out = {};
for (const spec of process.argv.slice(4)) {
  const [f, nome] = spec.split(':');
  const { obj, ossos, clip } = carregar(f);
  obj.updateMatrixWorld(true);
  const ref = mundo(ossos);
  const hipref = ref.P.CC_Base_Hip.z;
  const mix = new THREE.AnimationMixer(obj); const ac = mix.clipAction(clip); ac.play();
  const d = clip.duration, fps = 30, n = Math.round(d * fps) + 1;
  const ts = [], tr = {};
  for (let i = 0; i < n; i++) {
    const t = Math.min(i / fps, d); ts.push(+(i / fps).toFixed(4));
    mix.setTime(t); obj.updateMatrixWorld(true);
    const P = mundo(ossos);
    const delta = (b) => C.clone().multiply(P.W[b].clone().multiply(ref.W[b].clone().invert())).multiply(Ci);
    for (const b in MAP) {
      const o = 'mixamorig' + MAP[b]; if (!rest[o]) continue;
      let D = delta(b);
      if (PAI[b]) D = delta(PAI[b]).invert().multiply(D);
      const ri = q4(rest[o].slice(0, 4)), pm = q4(rest[o].slice(4, 8));
      const q = pm.clone().invert().multiply(D).multiply(ri.clone().invert());
      (tr[o + '.quaternion'] ||= []).push(q);
    }
    const p = P.P.CC_Base_Hip.clone().applyQuaternion(C).multiplyScalar(alt / hipref);
    (tr['mixamorigHips.position'] ||= []).push(p);
  }
  const t = [];
  for (const k in tr) {
    let fl = [];
    if (k.endsWith('quaternion')) { let prev = null; for (const q of tr[k]) { if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); prev = q; fl.push(...q.toArray().map((x) => +x.toFixed(4))); } }
    else for (const v of tr[k]) fl.push(...v.toArray().map((x) => +x.toFixed(2)));
    t.push([k, ts, fl]);
  }
  out[nome] = { d: +d.toFixed(3), t };
  console.log(nome, out[nome].d, t.length, 'quadril', tr['mixamorigHips.position'][0].toArray().map((x) => x.toFixed(1)).join(','));
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
