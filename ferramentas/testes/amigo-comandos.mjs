// Comandos novos da IA dos amigos (André 2026-11-16: "eles estão muito limitados... dá mais comandos para eles").
// A IA pode mandar a Cecília/Dario caçar sozinhos num campo, voltar para a vila, e a ficha leva o jogo de verdade
// (campos, chefes, loja, missão dele) para ela não inventar. Sem chave: testa o jogo, não a IA.
// Uso: node ferramentas/testes/amigo-comandos.mjs
import { Simulacao, MAPA_CLAREIRA, DARIO } from '../../shared/index.js';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
const { mensagensConversa } = await import('../../server/ia-amiga.js');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
const dario = s.amigoIaDe(DARIO.id), b = dario.amiga;
s.passo(0.05);
const dia = () => { b.prog.dia = { h: 10, t: Date.now() }; }, noite = () => { b.prog.dia = { h: 23, t: Date.now() }; };
const ultima = () => (b.ia.chatFila || []).at(-1)?.texto || '';
// a ficha sabe do jogo
dia();
const ctx = dario.contextoAmiga('andre');
ok(ctx.mapa.includes('Clareira dos Lobos') && ctx.mapa.includes('Dragão de Cinzas'), 'ficha: campos e chefes do mundo');
ok(/poção de vida 15/.test(ctx.loja), 'ficha: preço certo da poção (15)');
ok(ctx.missaoDele && ctx.sozinha?.ok === true, `ficha: missão dele (${ctx.missaoDele}) e pode sair caçar de dia`);
const msgs = mensagensConversa(ctx, 'onde upar?');
ok(/Jogo de verdade/.test(msgs[0].content) && /"cacar"/.test(msgs[0].content) && /nunca invente/.test(msgs[0].content), 'prompt: manual do jogo, ação cacar e não inventar');
// "vai caçar sozinho na Clareira dos Lobos": a IA manda cacar + lugar
Object.assign(d, { x: b.x + 2, z: b.z });
dario.respostaAmiga('andre', { assunto: 'cacar', iaAssunto: 'cacar', lugar: 'Clareira dos Lobos', fala: 'Partiu lobos!' });
ok(b.ia.av?.fase === 'ir' && b.ia.av.c && !/Lobos/.test(b.ia.av.c.nome), `nível 1: Lobos é forte, vai no campo dele (${b.ia.av?.c?.nome})`);
ok(/pesado pra mim/.test(ultima()), `avisa: "${ultima()}"`);
b.ia.av = null; b.prog.nivel = 12;
dario.respostaAmiga('andre', { assunto: 'cacar', iaAssunto: 'cacar', lugar: 'na Clareira dos Lobos', fala: 'Partiu lobos!' });
ok(b.ia.av?.fase === 'ir' && b.ia.av.c?.nome === 'Clareira dos Lobos' && b.ia.av.c.nivel === 10, `nível 12: vai na Clareira dos Lobos nv ${b.ia.av?.c?.nivel}`);
ok(ultima() === 'Partiu lobos!', 'a fala é a da IA');
for (let i = 0; i < 20 * 30; i++) s.passo(0.05);
ok(Math.hypot(b.x - d.x, b.z - d.z) > 5, 'andou para longe, rumo ao campo');
// pedir de novo: já está caçando
dario.respostaAmiga('andre', { assunto: 'cacar', iaAssunto: 'cacar', fala: 'Bora!' });
ok(b.ia.av?.fase === 'ir' || b.ia.av?.fase === 'cacar', 'pedir de novo não reinicia a caçada');
// "volta pra vila"
dario.respostaAmiga('andre', { assunto: 'voltar', iaAssunto: 'voltar', fala: 'Tô voltando!' });
ok(b.ia.av?.fase === 'voltar', 'voltar: larga a caçada e volta');
// de noite não sai: recusa com o motivo, mesmo que a IA tenha topado
b.ia.av = null; noite();
dario.respostaAmiga('andre', { assunto: 'cacar', iaAssunto: 'cacar', fala: 'Partiu!' });
ok(!b.ia.av || b.ia.av.fase !== 'ir', 'de noite não sai para caçar');
ok(/noite/.test(ultima()), `recusa explicando: "${ultima()}"`);
ok(dario.contextoAmiga('andre').sozinha?.ok === false, 'a ficha avisa a IA que de noite não dá');
// "vai caçar sozinho" tem "caçar" (regra = time), mas vale a IA (cacar)
ok(dario.regraValeSobreIaAmiga('andre', 'time', 'vai caçar sozinho', 'cacar') === false, 'regra "time" não passa por cima de "cacar" da IA');
// chat básico (sem chave de IA): perguntas com resposta de verdade, antes de "upar"/"missão" virarem convite de time
for (const [t, k, re] of [['onde da pra upar?', 'ondeUpar', /Clareira/], ['qual seu nível?', 'nivel', /nível \d+/], ['qual a minha missão?', 'missao', /missão/i]]) {
  const a = dario.assuntoAmiga(t); dario.respostaAmiga('andre', { assunto: a });
  ok(a === k && re.test(ultima()), `chat básico "${t}" -> ${a}: "${ultima()}"`);
}
ok(dario.assuntoAmiga('bora upar') === 'time', '"bora upar" continua sendo convite de time');
