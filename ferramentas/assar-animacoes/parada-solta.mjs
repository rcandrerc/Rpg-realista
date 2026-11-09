// Parada solta (André 2026-11-09: "uma pose mais legalzinha quando fica parado, mas não retão"): sai da "parada" do
// Mixamo com giros a mais em cada osso, em eixos do mundo (Y para cima, o boneco olha para +Z, a esquerda dele é +X).
// "ossos": giro [x, y, z] em graus por cima do que o pai já girou; "mirar": aponta o osso para uma direção;
// "balanco": giro a mais que vai e volta uma vez por volta da animação; "quadril"/"quadrilBalanco": cm a mais no quadril.
// Uso (da raiz): node ferramentas/assar-animacoes/parada-solta.mjs <anims.json.gz> ferramentas/assar-animacoes/parada-solta.json <saída.json.gz> parada_solta
import fs from 'node:fs'; import zlib from 'node:zlib';
import * as THREE from 'three';
const [,, entrada, cfgArq, saida, nomeNovo] = process.argv;
const A = JSON.parse(zlib.gunzipSync(fs.readFileSync(entrada)));
const cfg = JSON.parse(fs.readFileSync(cfgArq));
const PAI = { Hips: null, Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck',
  LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm',
  RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm',
  LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot' };
const ORDEM = Object.keys(PAI);
const base = A[cfg.de || 'parada'];
const tr = {}; for (const t of base.t) tr[t[0]] = t;
const times = tr['mixamorigHips.quaternion'][1], n = times.length, D = base.d;
const raizPai = new THREE.Quaternion().fromArray(A._rest.ossos.mixamorigHips, 4);
const g = (v) => THREE.MathUtils.degToRad(v);
const giro = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(g(e[0] || 0), g(e[1] || 0), g(e[2] || 0), 'YXZ'));
const novo = JSON.parse(JSON.stringify(base));
const ntr = {}; for (const t of novo.t) ntr[t[0]] = t;
for (let i = 0; i < n; i++) {
  const fase = Math.sin((times[i] / D) * Math.PI * 2 * (cfg.ondas || 1));
  const W = {}, Wn = {};
  for (const b of ORDEM) {
    const k = 'mixamorig' + b + '.quaternion'; const t = tr[k]; if (!t) continue;
    const L = new THREE.Quaternion().fromArray(t[2], t[1].length > 1 ? i * 4 : 0);
    const p = PAI[b];
    const Pw = p ? W[p] : raizPai, Pwn = p ? Wn[p] : raizPai;
    W[b] = Pw.clone().multiply(L);
    const e = (cfg.ossos[b] || [0, 0, 0]).slice(); const bal = cfg.balanco?.[b];
    if (bal) for (let j = 0; j < 3; j++) e[j] += (bal[j] || 0) * fase;
    let R = giro(e);
    const alvo = cfg.mirar?.[b];
    if (alvo) { // aponta o osso (o +Y dele) para a direção dada, no mundo
      const atual = new THREE.Vector3(0, 1, 0).applyQuaternion(Pwn.clone().multiply(L));
      R = new THREE.Quaternion().setFromUnitVectors(atual, new THREE.Vector3(...alvo).normalize()).multiply(giro(e));
      Wn[b] = R.multiply(Pwn.clone().multiply(L));
    } else Wn[b] = R.multiply(Pwn.clone().multiply(L));
    const Ln = Pwn.clone().invert().multiply(Wn[b]);
    const nt = ntr[k];
    if (nt[1].length === 1 && n > 1) { nt[1] = times.slice(); nt[2] = Array(n * 4).fill(0); }
    Ln.toArray(nt[2], i * 4);
  }
  const hp = ntr['mixamorigHips.position'];
  const desl = (cfg.quadril || [0, 0, 0]).map((v, j) => v + (cfg.quadrilBalanco?.[j] || 0) * fase);
  for (let j = 0; j < 3; j++) hp[2][i * 3 + j] = Math.round((tr['mixamorigHips.position'][2][i * 3 + j] + desl[j]) * 100) / 100;
}
for (const t of novo.t) if (t[0].endsWith('quaternion')) t[2] = t[2].map((v) => Math.round(v * 1e4) / 1e4);
A[nomeNovo || 'parada_solta'] = novo;
fs.writeFileSync(saida, zlib.gzipSync(JSON.stringify(A), { level: 9 }));
console.log('ok', nomeNovo, D);
