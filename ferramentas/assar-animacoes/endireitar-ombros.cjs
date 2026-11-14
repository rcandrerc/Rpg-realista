// Endireita a clavícula (osso Shoulder) de uma animação assada de outro personagem do Mixamo.
// André 2026-11-14: nas animações que vieram de .fbx de outro personagem (Maleta, espreguiçadas) os ombros ficavam
// caídos ~55° para baixo e para frente ("os ombros estão muito pra dentro"): o descanso da clavícula do outro
// personagem é diferente do nosso. Aqui a clavícula volta para a linha dos ombros das outras paradas (Parada simples)
// e o braço recebe a rotação contrária: o braço fica igual no mundo (a pose não muda), só o ombro sobe e abre.
// Uma rotação constante por lado, medida no primeiro quadro; o movimento do ombro na animação continua.
// Rodar de novo não muda nada (o alvo é fixo).
// Uso: node ferramentas/assar-animacoes/endireitar-ombros.cjs <animacao> [<animacao>...]
const z = require('zlib'), fs = require('fs'), path = require('path');
const ARQ = path.join(__dirname, '../../client/public/assets/personagens/anims.json.gz');
const A = JSON.parse(z.gunzipSync(fs.readFileSync(ARQ)));
const R = A._rest.ossos;
const mul = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const inv = q => [-q[0], -q[1], -q[2], q[3]];
const rot = (q, v) => mul(mul(q, [...v, 0]), inv(q)).slice(0, 3);
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const entre = (a, b) => { // menor rotação que leva a em b (unitários)
  const c = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const w = 1 + a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const l = Math.hypot(c[0], c[1], c[2], w);
  return [c[0]/l, c[1]/l, c[2]/l, w/l];
};
const graus = q => 2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180 / Math.PI;
// linha dos ombros das paradas boas, no espaço do peito (Spine2): para o lado, 3° para baixo
const ALVO = sx => norm([sx * 0.995, -0.05, 0.03]);
for (const nome of process.argv.slice(2)) {
  const anim = A[nome];
  if (!anim) { console.error('animação não existe: ' + nome); process.exit(1); }
  const tr = {};
  for (const t of anim.t) tr[t[0]] = t;
  const quat = (b, f) => { const t = tr[b + '.quaternion']; if (!t) return [0, 0, 0, 1]; const k = Math.min(f, t[1].length - 1) * 4; return t[2].slice(k, k + 4); };
  for (const [lado, sx] of [['Left', 1], ['Right', -1]]) {
    const ch = ['Hips', 'Spine', 'Spine1', 'Spine2'].map(s => 'mixamorig' + s);
    const ombro = 'mixamorig' + lado + 'Shoulder', braco = 'mixamorig' + lado + 'Arm';
    let peito = R[ch[0]].slice(4, 8);
    for (const b of ch) peito = mul(peito, quat(b, 0));
    const acc = mul(peito, quat(ombro, 0));
    const alvoMundo = rot(mul(peito, R[ch[3]].slice(0, 4)), ALVO(sx));
    const v = norm(rot(R[ombro].slice(0, 4), [sx, 0, 0]));
    const u = norm(rot(inv(acc), alvoMundo));
    const K = entre(v, u);
    const to = tr[ombro + '.quaternion'], tb = tr[braco + '.quaternion'];
    if (!to || !tb) { console.error('sem trilha de ombro/braço em ' + nome); process.exit(1); }
    for (let f = 0; f < to[1].length; f++) {
      const q = mul(to[2].slice(f * 4, f * 4 + 4), K);
      for (let i = 0; i < 4; i++) to[2][f * 4 + i] = Math.round(q[i] * 1e4) / 1e4;
    }
    const Ki = inv(K);
    for (let f = 0; f < tb[1].length; f++) {
      const q = mul(Ki, tb[2].slice(f * 4, f * 4 + 4));
      for (let i = 0; i < 4; i++) tb[2][f * 4 + i] = Math.round(q[i] * 1e4) / 1e4;
    }
    console.log(`${nome} ${lado}: clavícula girada ${graus(K).toFixed(1)}°`);
  }
}
fs.writeFileSync(ARQ, z.gzipSync(JSON.stringify(A), { level: 9 }));
