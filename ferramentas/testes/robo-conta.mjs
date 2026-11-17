// Robô de testes (ferramentas/robo, André 2026-11-14): a conta dele, o pular/zerar só para ele e o nível dele fora do
// teto dos NPCs. Uso: node ferramentas/testes/robo-conta.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Simulacao, MAPA_CLAREIRA, HISTORIA } from '../../shared/index.js';
import { Contas, roboCel } from '../../server/contas.js';
let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.error('FALHOU', m); } else console.log('ok', m); };

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'robo-'));
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'pessoa', email: 'p@x.invalid', given_name: 'Pessoa' }) });
const a = contas.entrarRobo();
ok(a.conta.robo === true && a.conta.visual && a.conta.nome.startsWith('Robô'), 'conta do robô já vem com personagem e marcada');
ok(contas.porSessao(a.sessao)?.robo === true, 'a sessão do robô entra');
const b = contas.entrarRobo();
ok(b.conta.id === a.conta.id, 'é sempre a mesma conta');
ok(!contas.porSessao(a.sessao) && !!contas.porSessao(b.sessao), 'turno novo: a sessão antiga sai');
const p = await contas.entrar('x', 'criar');
ok(!p.conta.robo, 'conta de gente não é robô');
contas.salvarProgresso(b.conta.id, { nivel: 40 });
contas.salvarProgresso(p.conta.id, { nivel: 7 });
ok(contas.nivelMaisAlto() === 7, 'nível do robô não puxa o teto dos NPCs');

const s = new Simulacao(MAPA_CLAREIRA);
const r = s.adicionarJogador('R', 'Robô de teste', 'cabelo_m', { conta: b.conta.id, robo: true });
const g = s.adicionarJogador('G', 'Gente', 'ruiva', { conta: p.conta.id });
s.missaoTeste('R', 'pular');
ok(r.prog.hist.p === 1 && r.prog.hist.u === HISTORIA[0].id, 'robô pula a missão da vez');
s.missaoTeste('R', 'zerar');
ok(r.prog.hist.p === 0, 'robô zera a história');
s.missaoTeste('G', 'pular');
ok(!g.prog.hist?.p, 'jogador comum não pula missão');
// celulares de verdade (Firebase Test Lab): uma conta por celular, sem derrubar o robô 1 nem um ao outro
const r1 = contas.entrarRobo(), c1 = contas.entrarRobo(roboCel(1)), c2 = contas.entrarRobo(roboCel(2));
ok(c1.conta.robo && c2.conta.robo && c1.conta.id !== c2.conta.id && c1.conta.id !== r1.conta.id, 'celulares têm conta de robô própria');
ok(!!contas.porSessao(r1.sessao) && !!contas.porSessao(c1.sessao) && !!contas.porSessao(c2.sessao), 'celulares e robô 1 jogam juntos');
fs.rmSync(pasta, { recursive: true, force: true });
if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1); }
console.log('robô: tudo certo');
process.exit(0);
