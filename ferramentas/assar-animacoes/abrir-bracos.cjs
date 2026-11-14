// Abre os braços de uma animação (tira o braço/mão de dentro do corpo e da armadura) sem trocar a pose.
// Gira o braço (e, se pedir, dobra o cotovelo pra frente) no espaço do mundo, quadro a quadro, mantendo o resto igual.
// Uso: node ferramentas/assar-animacoes/abrir-bracos.cjs <animacao> <graus_abrir> [graus_cotovelo]
// Ex.: node ferramentas/assar-animacoes/abrir-bracos.cjs parada_esticar_pescoco 14 8
// Mexe em client/public/assets/personagens/anims.json.gz (rode uma vez só por animação: soma a cada execução).
const z = require('zlib'), fs = require('fs'), path = require('path');
const ARQ = path.join(__dirname, '../../client/public/assets/personagens/anims.json.gz');
const [nome, abrirG, cotoveloG] = [process.argv[2], parseFloat(process.argv[3] || '0'), parseFloat(process.argv[4] || '0')];
const A = JSON.parse(z.gunzipSync(fs.readFileSync(ARQ)));
if (!A[nome]) { console.error('animação não existe: ' + nome); process.exit(1); }
const R = A._rest.ossos;
const mul = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const inv = q => [-q[0], -q[1], -q[2], q[3]];
const eixo = (v, g) => { const s = Math.sin(g * Math.PI / 360), c = Math.cos(g * Math.PI / 360); return [v[0]*s, v[1]*s, v[2]*s, c]; };
const anim = A[nome], tr = {};
for (const t of anim.t) tr[t[0]] = t;
const cadeia = lado => ['Hips', 'Spine', 'Spine1', 'Spine2', lado + 'Shoulder', lado + 'Arm', lado + 'ForeArm'].map(s => 'mixamorig' + s);
const quat = (b, f) => { const t = tr[b + '.quaternion']; if (!t) return [0, 0, 0, 1]; const n = t[1].length; const k = Math.min(f, n - 1) * 4; return t[2].slice(k, k + 4); };
const n = tr['mixamorigLeftArm.quaternion'][1].length;
const novos = {};
for (const [lado, sx] of [['Left', 1], ['Right', -1]]) {
  const ch = cadeia(lado);
  const braco = ch[5], ante = ch[6];
  novos[braco] = []; novos[ante] = [];
  for (let f = 0; f < n; f++) {
    let pai = R[ch[0]].slice(4, 8);
    for (const b of ch.slice(0, 5)) pai = mul(pai, quat(b, f));
    // braço: gira em volta do eixo pra frente do mundo (Z), pra fora do corpo
    const qb = quat(braco, f);
    const Rz = eixo([0, 0, 1], sx * abrirG);
    const qb2 = mul(mul(inv(pai), mul(Rz, pai)), qb);
    novos[braco].push(...qb2);
    // cotovelo: dobra o antebraço pra frente em volta do eixo X do mundo
    const Rx = eixo([1, 0, 0], -cotoveloG); // mão vai pra frente (+Z) quando o braço aponta pra baixo
    const pa = mul(pai, qb2);
    const qa = quat(ante, f);
    novos[ante].push(...mul(mul(inv(pa), mul(Rx, pa)), qa));
  }
}
for (const b in novos) {
  const t = tr[b + '.quaternion'];
  if (!t || t[1].length !== n) { console.error('trilha diferente: ' + b); process.exit(1); }
  t[2] = novos[b].map(x => Math.round(x * 1e4) / 1e4);
}
fs.writeFileSync(ARQ, z.gzipSync(JSON.stringify(A), { level: 9 }));
console.log(`${nome}: braços abertos ${abrirG}°, cotovelo ${cotoveloG}° (${n} quadros)`);
