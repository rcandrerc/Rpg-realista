// Repertório único de conversa (André 2026-11-18): todos os NPCs com as mesmas falas, só o gênero muda. Sem rede.
// Uso: node ferramentas/testes/repertorio.mjs
import { Simulacao, MAPA_CLAREIRA, REPERTORIO, AMIGOS_VIRTUAIS, AMIGA, DARIO } from '../../shared/index.js';
import { vozAmiga } from '../../shared/amiga.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
ok(vozAmiga('Tô {ótima|ótimo}!', 'f') === 'Tô ótima!' && vozAmiga('Tô {ótima|ótimo}!', 'm') === 'Tô ótimo!', 'feminino e masculino pelo gênero');
ok(vozAmiga('Agora tô com {nome}!', 'm') === 'Agora tô com {nome}!', '{nome} continua (não é gênero)');
for (const D of AMIGOS_VIRTUAIS) for (const k of Object.keys(REPERTORIO.falas)) if (D.chat.falas[k] !== REPERTORIO.falas[k]) { ok(false, `${D.id}: ${k} vem do repertório`); break; }
ok(AMIGOS_VIRTUAIS.length > 2, 'todos os NPCs com o mesmo repertório');
// nada some: as falas antigas da Cecília e do Dario estão no repertório (com o gênero marcado)
for (const l of ['Para, assim eu fico vermelha!', 'Hehe, você também é brabo!', 'Tranquilo. Só a espada que tá pedindo briga.', 'Isso foi charada? Explica aí.'])
  ok(Object.values(REPERTORIO.falas).flat().some((t) => vozAmiga(t, 'f') === l || vozAmiga(t, 'm') === l), `continua: "${l}"`);
// conversa: assuntos novos e o gênero de cada um
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
for (const [id, g] of [['cecilia', 'f'], ['dario', 'm']]) {
  const c = s.amigosIa.find((x) => x.AMIGA.id === id);
  for (const [t, k] of [['tá fazendo o que?', 'fazendo'], ['kkkk', 'risada'], ['te amo kkk', 'carinho'], ['kkkk hahaha', 'risada'], ['tô cansado do trabalho', 'desabafo'], ['te amo', 'carinho'], ['vc é muito fofa', 'elogio'], ['oi', 'oi']]) ok(c.assuntoAmiga(t) === k, `${id}: "${t}" = ${k}`);
  c.amiga.ia.chatFila = []; c.respostaAmiga('andre', { assunto: 'fazendo' });
  const f = c.amiga.ia.chatFila.at(-1)?.texto || '';
  ok(f && !/\{/.test(f), `${id}: "tá fazendo o quê" fala o que está fazendo de verdade (${f})`);
  c.amiga.ia.chatFila = []; for (let i = 0; i < 40; i++) c.dizerAmiga('Tô {ótima|ótimo}!');
  ok(c.amiga.ia.chatFila.every((x) => x.texto === (g === 'f' ? 'Tô ótima!' : 'Tô ótimo!')), `${id} fala no ${g === 'f' ? 'feminino' : 'masculino'}`);
}
