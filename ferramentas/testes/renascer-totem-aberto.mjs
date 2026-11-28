// André 2026-11-28: ao morrer renasce no totem mais perto cuja região já está liberada para o jogador (mesmo que mais longe).
// Uso: node ferramentas/testes/renascer-totem-aberto.mjs
import { Simulacao, MAPA_CLAREIRA, HEROI, TOTENS} from '../../shared/index.js';
import { zonaFechadaEm } from '../../shared/historia.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
j.prog.nivel = 25;
const fechado = TOTENS.lista.filter((t) => t.id !== 'clareira' && zonaFechadaEm(j.prog, t.x, t.z));
ok(fechado.length > 0, 'há totem em região fechada no Nv 25: ' + fechado.map((t) => t.id));
const F = fechado[0];
j.x = F.x + 3; j.z = F.z; j.vida = 1;
s.morrer(j);
for (let t = 0; t < (HEROI.renascer + 0.5) / 0.05; t++) s.passo(0.05);
ok(!j.morto, 'renasceu');
ok(!zonaFechadaEm(j.prog, j.x, j.z), `renasceu fora da região fechada (${j.x.toFixed(0)}, ${j.z.toFixed(0)})`);
