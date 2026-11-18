// Falas das missões com história (André 2026-11-18: "quando você está conversando com o NPC só dá ordem... modifique
// o texto dos NPCs para que cada solicitação esteja dentro de um contexto, de uma história"). Trava: toda missão tem o
// lembra (o porquê, curto); voltar ao NPC no meio da missão traz o lembra e o que falta, em vez de só a ordem; texto
// curto (André: textos do jogo super curtos); o lembra tem inglês. Uso: node ferramentas/testes/missao-lembra.mjs
import { readFileSync } from 'node:fs';
import { Simulacao, MAPA_CLAREIRA, HISTORIA } from '../../shared/index.js';
import { guardar } from '../../shared/progresso.js';
import './_relogio-fixo.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const EN = JSON.parse(readFileSync(new URL('../../godot-prototipo/dados/idioma_en.json', import.meta.url), 'utf8'));
const frases = (t) => (t.replaceAll('...', '').match(/[.!?]+(\s|$)/g) || []).length;

for (const M of HISTORIA) {
  ok(typeof M.lembra === 'string' && M.lembra.length > 10 && M.lembra.length <= 120, `${M.id}: lembra curto (${M.lembra?.length})`);
  ok(frases(M.lembra) <= 2, `${M.id}: lembra em até 2 frases`);
  ok(M.pedido.length <= 240, `${M.id}: pedido curto (${M.pedido.length})`);
  ok(typeof EN[M.lembra] === 'string' && EN[M.lembra].length > 10, `${M.id}: lembra tem inglês`);
  ok(typeof EN[M.pedido] === 'string' && EN[M.pedido].length > 10, `${M.id}: pedido tem inglês`);
}
ok(EN['Falta: {1}.'] && EN['Ainda falta: {1}.'], 'o "Falta:" e o "Ainda falta:" têm inglês');

// Tomás (a4, a bigorna): aceitar traz o pedido; voltar no meio traz o porquê e o que falta; entregar sem tudo também
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('A', 'Ana'), p = j.prog;
const i = HISTORIA.findIndex((M) => M.id === 'a4'), M = HISTORIA[i];
p.nivel = M.nv; p.hist = { v: 2, p: i, ac: false, e: 0, n: 0, m: 0 };
const n = MAPA_CLAREIRA.npcs.find((o) => o.id === 'ferreiro');
const falar = () => { Object.assign(j, { x: n.x + 1.5, z: n.z, y: s.terreno.altura(n.x, n.z) }); s.eventos.length = 0; s.falar('A', { npc: 'ferreiro', missao: true }); return s.eventos.filter((e) => e.t === 'fala' && e.para === 'A').map((e) => e.texto); };
let f = falar();
ok(f.includes(M.pedido) && p.hist.ac, `aceitou: o Tomás pede com história ("${M.pedido.slice(0, 50)}...")`);
f = falar();
ok(f.some((t) => t.startsWith(M.lembra + '\n') && /\nFalta: .*cobre/i.test(t)), `voltou no meio: o porquê e o que falta (${JSON.stringify(f)})`);
ok(!f.some((t) => t.startsWith('Primeiro:')), 'não começa mais com a ordem seca "Primeiro:"');
p.hist.e = 2; p.hist.n = 0; guardar(p.mochila, { k: 'barra_cobre', n: 1 });
f = falar();
ok(f.some((t) => t.startsWith(M.lembra + '\n') && /Ainda falta: .*1\/2/.test(t)), `entrega incompleta: o porquê e o que ainda falta (${JSON.stringify(f)})`);

// André 2026-11-18 ("os chats das missões devem aparecer em outra aba"): a fala da missão abre uma janela só dela
{
  const gd = (f) => readFileSync(new URL('../../godot-prototipo/' + f, import.meta.url), 'utf8');
  ok(/ev\.get\("missao", ""\)\) != "" and m\.missao_fala[\s\S]{0,200}missao_fala\.mostrar\(/.test(gd('online.gd')), 'fala com missão vai para a janela da missão (missao_fala.gd), não para a janela do NPC');
  ok(/MissaoFala\.new\(self\)/.test(gd('main.gd')) && /func mostrar\(npc_id: String, texto: String, missao: String\)/.test(gd('missao_fala.gd')), 'a janela da missão existe no jogo');
  ok(/missao_fala\.aberto\(\)/.test(gd('conversa.gd')), 'a janela do NPC só reabre depois do Ok da fala da missão');
}
{
  const gd = (f) => readFileSync(new URL('../../godot-prototipo/' + f, import.meta.url), 'utf8');
  ok(/fala_ui\.visible = false/.test(gd('conversa.gd')) && /missao_fala\.fala_npc\(npc,/.test(gd('conversa.gd')), 'a fala comum do NPC também sai da janela de opções (aparece em cima dela)');
}
