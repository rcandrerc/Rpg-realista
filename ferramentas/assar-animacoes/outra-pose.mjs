// Uso: node ferramentas/assar-animacoes/outra-pose.mjs <anims.json.gz atual> <anims.json assado só com as novas> <saída .json.gz>
// (o three é o do projeto, depois do npm ci). Foi feito para as animações de nado (André 2026-11-06), baixadas noutro boneco.
// Passa as animações assadas num esqueleto Mixamo com outra pose de descanso para o _rest do anims.json.gz atual:
// mesma rotação de mundo (delta) por osso; dedos que faltam copiam o indicador.
import fs from 'node:fs'; import zlib from 'node:zlib';
import * as THREE from 'three';
const A = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])));
const B = JSON.parse(fs.readFileSync(process.argv[3]));
const ro = A._rest.ossos, rn = B._rest.ossos;
const Q = (a, i) => new THREE.Quaternion().fromArray(a, i);
const esc = A._rest.alturaQuadril / B._rest.alturaQuadril;
const r4 = (v) => Math.round(v * 1e4) / 1e4, r2 = (v) => Math.round(v * 100) / 100;
const saida = {};
// "Swimming To Edge" nada uns 79 cm mais alto que o "Swimming" (termina pendurado numa borda de piscina): o quadril
// desce essa diferença para o trecho que o jogo usa (nadando -> de pé) emendar com o nado
const quadrilY = (nome, t1) => { const [, ts, v] = B[nome].t.find(([n]) => /Hips\.position$/.test(n)); let s = 0, c = 0; ts.forEach((t, i) => { if (t <= t1) { s += v[i * 3 + 1]; c++; } }); return s / c; };
const desce = B.sair_agua && B.nadar ? { sair_agua: quadrilY('sair_agua', 1.5) - quadrilY('nadar', 4.5) } : {};
console.log('desce', desce);
for (const nome of Object.keys(B).filter((k) => !k.startsWith('_'))) {
  const tr = [];
  const delta = {}; // osso -> [tempos, [Quaternion de mundo delta]]
  for (const [n, ts, v] of B[nome].t) {
    const [osso, prop] = n.split('.');
    if (!ro[osso]) continue;
    const pmO = Q(ro[osso], 4), riO = Q(ro[osso], 0), pmN = Q(rn[osso], 4), riN = Q(rn[osso], 0);
    if (prop === 'position') {
      const m = pmO.clone().invert().multiply(pmN), out = [];
      for (let i = 0; i < v.length; i += 3) { const p = new THREE.Vector3(v[i], v[i + 1] - (desce[nome] || 0), v[i + 2]).applyQuaternion(m).multiplyScalar(esc); out.push(r2(p.x), r2(p.y), r2(p.z)); }
      tr.push([n, ts, out]); continue;
    }
    const out = [], ds = [];
    for (let i = 0; i < v.length; i += 4) {
      const D = pmN.clone().multiply(Q(v, i)).multiply(riN); ds.push(D);
      const q = pmO.clone().invert().multiply(D).multiply(riO.clone().invert());
      out.push(...q.toArray().map(r4));
    }
    delta[osso] = [ts, ds];
    tr.push([n, ts, out]);
  }
  for (const lado of ['Left', 'Right']) for (const dedo of ['Middle', 'Ring', 'Pinky']) for (const k of [1, 2, 3]) {
    const osso = `mixamorig${lado}Hand${dedo}${k}`, fonte = delta[`mixamorig${lado}HandIndex${k}`];
    if (!ro[osso] || !fonte || delta[osso]) continue;
    const pmO = Q(ro[osso], 4), riO = Q(ro[osso], 0), out = [];
    for (const D of fonte[1]) out.push(...pmO.clone().invert().multiply(D).multiply(riO.clone().invert()).toArray().map(r4));
    tr.push([`${osso}.quaternion`, fonte[0], out]);
  }
  saida[nome] = { d: B[nome].d, t: tr };
  console.log(nome, B[nome].d, tr.length);
}
for (const k in saida) A[k] = saida[k];
fs.writeFileSync(process.argv[4], zlib.gzipSync(JSON.stringify(A), { level: 9 }));
console.log(Object.keys(A).length, 'chaves');
