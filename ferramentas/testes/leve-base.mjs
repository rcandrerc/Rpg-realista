// Jogo leve: sair e entrar na base do clã pelo portão (André 2026-11-26: "o personagem não está conseguindo sair da base...
// preso tentando sair pela cerca"). A rota usa a mesma linha que o app põe na rede do "Ir" (base_cla.gd _rede_rota):
// frente do Baú do Clã -> portão -> estrada da base. Nenhum trecho pode atravessar a paliçada.
// Uso: node ferramentas/testes/leve-base.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { acharLugarBase } from '../../shared/base.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const pc = acharLugarBase(-6, 1, 'chama', []);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40; a.leve = true;
a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'fundar', nome: 'Ruivas' }); a.prog.cla.nv = 3;
s.cla('A', { acao: 'base' });
const B = s.baseDe(a); s.refazerChaoBases?.();
ok(B && B.nv >= 3 && s.chaoBases?.[B.k]?.estrada?.length > 0, `base Nv ${B?.nv} com paliçada e estrada`);
const D = s.basesDesenho[B.k], hc = D.centro / 2;
// a cerca: cruzar a borda do quadrado fora do vão do portão (|x - B.x| <= 3) é atravessar a paliçada
const cruzaCerca = (pts, de) => {
  let q = de;
  for (const p of pts) {
    for (let t = 0; t <= 1; t += 0.02) {
      const x = q.x + (p.x - q.x) * t, z = q.z + (p.z - q.z) * t, x2 = q.x + (p.x - q.x) * (t + 0.02), z2 = q.z + (p.z - q.z) * (t + 0.02);
      const dentro = (X, Z) => Math.abs(X - B.x) < hc && Math.abs(Z - B.z) < hc;
      if (dentro(x, z) !== dentro(x2, z2) && !(Math.abs(x - B.x) <= 3 && z > B.z)) return true;
    }
    q = p;
  }
  return false;
};
// lá dentro, perto do baú; destino longe, do lado de trás da base
a.x = D.frente.x - 3; a.z = D.frente.z + 1; s.eventos = [];
const longe = { x: B.x, z: B.z - hc - 80 };
s.leveIr('A', longe);
const R = a.leveRota;
ok(R && R.pontos.length > 2, `saiu com rota (${R?.pontos.length} pontos)`);
ok(R && !cruzaCerca(R.pontos, a), 'a rota de saída passa pelo portão, não pela cerca');
// de fora para dentro: entra pelo portão
a.x = longe.x; a.z = longe.z; a.leveIrT = -9; s.tempo += 5;
s.leveIr('A', { x: D.frente.x - 3, z: D.frente.z + 1 });
ok(a.leveRota && !cruzaCerca(a.leveRota.pontos, a), 'a rota de entrada passa pelo portão');
