// Nome de NPC não pode ser nome de jogador (André 2026-11-19: "Se tiver o nome dos NPCs, não pode. Nem parecido").
// Uso: node ferramentas/testes/nome-npc.mjs
import { Simulacao, MAPA_CLAREIRA, nomeReservado, NOME } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
for (const n of ['Otávio', 'otavio', 'Otávio-x', 'x Otávio', 'xOtavio', '0tavi0', 'Оtávio', 'Ivo', 'Mestre Ivo', 'Cecília', 'Dario', 'Kira', 'Vesper', 'Bruno Silva',
  'Ｏｔａｖｉｏ', '𝐎𝐭𝐚𝐯𝐢𝐨', 'ᴏᴛᴀᴠɪᴏ', 'lvo', 'Ceci1ia', 'Otaviό', 'Dariӧ', 'Ηelena', 'Dimaѕ', 'Hugօ', 'Otavıo', 'Brunø', 'ẞruno', 'Ottávio', 'O t a v i o', 'Maíra', 'Gorduncho', 'Presa de Prata',
  'ꓓꓮꓣꓲꓳ', 'ᏦᎪᎬᏞ', 'ⲞⲦⲀⲨⲒⲞ', 'ᗪᗩᖇᛁᗝ', 'Dario2', 'Lia1', 'Cecílias', 'Ulissesx', 'Dragão de Cinzas', 'ㅤㅤㅤ', 'LIA', 'lia', 'Daɾio', 'Otavɨo', 'Kaeɫ', 'Ꞁia', 'Heiena', 'Cecllia', 'Ceieste', 'Gaidino'])
  ok(nomeReservado(n), `"${n}" é nome de NPC (${nomeReservado(n)})`);
for (const n of ['André', 'Juliana', 'Mateus', 'Akira', 'Rosario', 'Amelia', 'Melissa', 'Robô de teste', 'Andarilho 3', 'Ruiva', 'Luciano', 'Luciana', 'Coraline', 'Darion', 'Ana 814', 'Leo 730', 'João', 'Maria Eduarda', 'さくら', 'Иван', 'Lara', 'Ana Lara', 'Mei', 'Lila', 'Yuki Tanaka'])
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

// Presidente 2026-11-19: o aviso sugere um nome que passa (Bruno -> Brunão ou BrunoSilva); nunca para Cecília, Dário, Geada ou Kael
import { avisoNomeReservado, sugerirNome, nomeValido } from '../../shared/dados.js';
ok(/Que tal Brunão ou BrunoSilva\?/.test(avisoNomeReservado('Bruno', nomeReservado('Bruno'))), 'Bruno: sugere Brunão ou BrunoSilva');
for (const n of ['Cecília', 'Dário', 'Kira', 'Lis', 'Rufo', 'Kael', 'Vesper', 'Otávio', 'Mestre Bruno'])
  ok(!/Que tal/.test(avisoNomeReservado(n, nomeReservado(n))), `${n}: sem sugestão, só "escolha outro"`);
let todas = 0;
for (const npc of MAPA_CLAREIRA.npcs || []) for (const w of String(npc.nome || '').split(',')[0].split(/\s+/)) {
  for (const sug of sugerirNome(w)) { todas++; if (nomeReservado(sug) || nomeValido(sug) !== sug) ok(false, `sugestão "${sug}" para ${w} não passa na regra`); }
}
ok(todas > 10, `todas as ${todas} sugestões para nomes de NPC passam na regra`);
j.prog.ouro = NOME.troca * 2; s.eventos = [];
s.trocarNome('A', 'Hugo');
ok(evs().some((e) => /Que tal Hugão/.test(e.texto || '')), 'trocar para "Hugo": aviso sugere Hugão');
