// Nome de NPC não pode ser nome de jogador (André 2026-11-19: "Se tiver o nome dos NPCs, não pode. Nem parecido").
// Uso: node ferramentas/testes/nome-npc.mjs
import { Simulacao, MAPA_CLAREIRA, nomeReservado, NOME } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
for (const n of ['Otávio', 'otavio', 'Otávio-x', 'x Otávio', 'xOtavio', '0tavi0', 'Оtávio', 'Ivo', 'Mestre Ivo', 'Cecília', 'Dario', 'Kira', 'Vesper', 'Bruno Silva'])
  ok(nomeReservado(n), `"${n}" é nome de NPC (${nomeReservado(n)})`);
for (const n of ['André', 'Juliana', 'Mateus', 'Akira', 'Rosario', 'Amelia', 'Melissa', 'Robô de teste', 'Andarilho 3', 'Ruiva'])
  ok(!nomeReservado(n), `"${n}" pode`);

const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Andarilho', undefined, { podeCriar: true });
s.definirCriando('A', true);
const evs = () => s.eventos.filter((e) => e.para === 'A');
s.eventos = [];
ok(s.concluirCriacao('A', { nome: 'Otavio x', visual: 'ruiva' }) === null && j.criando, 'criador: "Otavio x" é recusado e o criador continua aberto');
ok(evs().some((e) => e.t === 'nomeUsado' && /personagem do jogo/.test(e.texto)), 'com o aviso "nome de personagem do jogo"');
ok(s.concluirCriacao('A', { nome: 'Ana Clara', visual: 'ruiva' })?.nome === 'Ana Clara', 'nome normal passa');
j.prog.ouro = NOME.troca * 2; s.eventos = [];
ok(s.trocarNome('A', 'Cecília') === null && j.prog.ouro === NOME.troca * 2, 'trocar para "Cecília": recusado e não cobra');
ok(evs().some((e) => /personagem do jogo/.test(e.texto || '')), 'com o aviso');
ok(s.trocarNome('A', 'Ana Luz') === 'Ana Luz', 'trocar para nome normal funciona');
