// Cecília (André 2026-11-17): "mais variado o jeito dela chegar em mim"; "Oi, vamos caçar, se eu não responder ela não
// manda mais mensagem até eu falar com ela ou relogar... quando eu voltar, desculpa tava ocupado, ela continua normal";
// "um botão seguir quando eu estiver perto dela... ela escolhe pra onde vai, eu aperto Seguir e meu personagem segue ela".
// O Dario fica como estava. Sem rede. Uso: node ferramentas/testes/cecilia-seguir.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO } from '../../shared/index.js';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import './_amizade-antiga.mjs'; // o jeito antigo (amizade e papo), sem o soldado de 2026-11-22
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
const { puxarAssunto, temasPuxar, TEMAS_SEM_REPETIR, mensagensConversa } = await import('../../server/ia-amiga.js');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = new URL('../../', import.meta.url).pathname, gd = (f) => readFileSync(raiz + 'godot-prototipo/' + f, 'utf8');

const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
s.passo(0.05);
const cec = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), dar = s.amigoIaDe(DARIO.id), a = cec.amiga;
a.amigosDe = { [j.conta]: 1 };

// ---------- variedade ----------
{
  const ctx = cec.contextoAmiga('andre'), vistos = [];
  ok(Array.isArray(ctx.temas) && Array.isArray(dar.contextoAmiga('andre').temas), 'os dois guardam os temas que puxaram');
  ok(temasPuxar('André').length >= 12, `${temasPuxar('André').length} jeitos de puxar assunto`);
  for (let i = 0; i < 30; i++) { puxarAssunto(ctx, null); vistos.push(ctx.temas.at(-1)); }
  let repetiu = false;
  for (let i = 1; i < vistos.length; i++) if (vistos.slice(Math.max(0, i - TEMAS_SEM_REPETIR), i).includes(vistos[i])) repetiu = true;
  ok(!repetiu && ctx.temas.length === TEMAS_SEM_REPETIR, `nunca repete um dos últimos ${TEMAS_SEM_REPETIR} temas`);
  ok(new Set(vistos).size >= 10, `em 30 vezes usou ${new Set(vistos).size} temas diferentes`);
  ok(AMIGA.chat.falas.chama.length >= 12, `${AMIGA.chat.falas.chama.length} chamadas prontas`);
  // a chamada pronta nunca sai igual duas vezes seguidas
  const falas = [];
  a.ia.chatFila = []; a.time = null; j.time = null; a.ia.vir = null; a.morto = false; j.x = a.x + 200; j.z = a.z;
  s.aoPuxarAmiga = null; // sem IA: só a chamada pronta
  for (let i = 0; i < 25; i++) {
    a.ia.espera = {}; a.ia.chamado = null; a.ia.chamaEm = s.tempo - 1; a.ia.chatFila = [];
    cec.passoChatAmiga(a); const t = a.ia.chatFila.at(-1)?.texto; if (t) falas.push(t);
  }
  ok(falas.length >= 20 && falas.every((t, i) => !i || t !== falas[i - 1]), `chamada nunca igual à anterior (${falas.length} chamadas, ${new Set(falas).size} diferentes)`);
}

// ---------- não insiste ----------
{
  a.ia.espera = {}; a.ia.chamado = null; a.ia.chamaEm = s.tempo - 1; a.ia.chatFila = [];
  cec.passoChatAmiga(a);
  ok(a.ia.chatFila.length === 1 && cec.esperandoAmiga(a, j), 'chamou ("Oi, vamos caçar") e fica esperando a resposta');
  let mais = 0;
  for (let i = 0; i < 20; i++) { s.tempo += 1800; a.ia.chamaEm = s.tempo - 1; a.ia.chamado = null; a.ia.chatFila = []; cec.passoChatAmiga(a); mais += a.ia.chatFila.length; }
  ok(mais === 0, 'sem resposta: 10 horas sem mandar mais nada');
  const puxou = []; s.aoPuxarAmiga = (id) => { puxou.push(id); return Promise.resolve(); };
  a.ia.puxaEm = s.tempo - 1; a.ia.ultimaFala = s.tempo - 9999; if (a.ia.diario?.[j.conta]) a.ia.diario[j.conta].ultima = s.tempo - 9999;
  ok(!cec.puxarAssuntoAmiga(a, j) && puxou.length === 0, 'nem puxa assunto pela IA');
  j.prog.nivel += 1; cec.passoChatAmiga(a); s.tempo += 999; cec.passoChatAmiga(a);
  ok(puxou.length === 0, 'nem quando ele sobe de nível');
  // ele volta: "desculpa, tava ocupado" -> a ficha diz para retomar numa boa
  const ctx = cec.contextoAmiga('andre');
  ok(ctx.ignorada === true, 'ele voltou depois de muito tempo: a ficha marca "ficou sem resposta"');
  const sis = mensagensConversa(ctx, 'desculpa, tava ocupado')[0].content;
  ok(/NÃO cobre, não reclame da demora/.test(sis), 'o prompt pede para continuar normal, sem cobrar');
  cec.ouvirAmiga('andre', 'desculpa, tava ocupado');
  ok(!cec.esperandoAmiga(a, j) && !cec.contextoAmiga('andre').ignorada, 'ele respondeu: ela volta ao normal');
  // relogar libera também
  cec.puxouAmiga(a, j); ok(cec.esperandoAmiga(a, j), 'puxou de novo e espera');
  a.ia.espera[j.conta].id = 'sessao-velha';
  ok(!cec.esperandoAmiga(a, j), 'ele relogou (outra sessão): ela pode chamar de novo');
  // o Dario também não insiste (André 2026-11-19: igual à Cecília)
  dar.puxouAmiga(dar.amiga, j);
  ok(dar.esperandoAmiga(dar.amiga, j), 'o Dario também espera a resposta antes de chamar de novo');
}

// ---------- Seguir ----------
{
  const evs = []; const ev0 = s.evento.bind(s); s.evento = (e) => { evs.push(e); return ev0(e); };
  a.ia.espera = {}; a.morto = false; j.morto = false;
  // longe: pede para chegar perto
  j.x = a.x + 30; j.z = a.z; cec.conversaAmiga('andre', { acao: 'seguir' });
  ok(evs.some((e) => e.t === 'aviso' && /Chegue mais perto/.test(e.texto)) && !a.ia.seguido, 'longe: "Chegue mais perto"');
  // perto e no time: ela escolhe o campo e o app começa a seguir
  j.x = a.x + 2; j.z = a.z; evs.length = 0;
  s.passo(0.05);
  if (!(a.time && a.time === j.time)) cec.entrarTimeAmiga(a, j);
  ok(a.time && a.time === j.time, 'ela está no time dele');
  a.ia.chatFila = []; cec.conversaAmiga('andre', { acao: 'seguir' });
  const S = a.ia.seguido, e = evs.find((x) => x.t === 'seguir');
  ok(S && S.id === 'andre' && S.c && e && e.para === 'andre' && e.npc === a.id && e.lugar === S.c.nome, `topou: vai pro ${S?.c?.nome} e o app recebe "seguir"`);
  const lugar = S.c.nome.replace(/\s*\([^)]*\)\s*$/, '');
  ok(AMIGA.falasLeva.campo.some((f) => f.replace('{lugar}', lugar) === a.ia.chatFila.at(-1)?.texto) && !/Destino|\(/.test(a.ia.chatFila.at(-1)?.texto), `ela diz para onde vai, sem "Destino:" nem região entre parênteses ("${a.ia.chatFila.at(-1)?.texto}")`);
  const cs = cec.contextoAmiga('andre');
  ok(cs.seguindo && cs.seguindoPara === lugar, 'a IA sabe que ele está seguindo e para onde');
  // André 2026-11-17 (print): ele respondeu "bora" e ela achou que era convite dele ("me chama no time", já no time)
  const sis = mensagensConversa(cs, 'bora')[0].content;
  ok(/está te SEGUINDO/.test(sis) && /"bora"/.test(sis) && /topando o SEU convite/.test(sis), 'o prompt diz que "bora" é ele topando o convite dela');
  ok(/JÁ estão no mesmo time: nunca peça/.test(sis), 'no time: não pede para chamar pro time');
  a.ia.chatFila = []; cec.respostaAmiga('andre', { assunto: 'conversa', fala: 'Isso, já tô pronto, cola aí!' });
  ok(a.ia.chatFila.at(-1)?.texto === 'Isso, já tô pronta, cola aí!', `gênero certo na fala da IA ("${a.ia.chatFila.at(-1)?.texto}")`);
  // ela vai na frente: anda em direção ao campo (não fica atrás dele)
  const d0 = Math.hypot(S.c.x - a.x, S.c.z - a.z);
  for (let i = 0; i < 200; i++) { s.passo(0.05); j.x = a.x - 2; j.z = a.z; } // ele vai colado atrás (ela fica uns s olhando para ele antes)
  const d1 = Math.hypot(S.c.x - a.x, S.c.z - a.z);
  ok(d1 < d0 - 2, `ela anda para o campo com ele atrás (${d0.toFixed(0)} m -> ${d1.toFixed(0)} m)`);
  // ele ficou para trás: ela espera
  j.x = a.x - 18; j.z = a.z; const px = a.x, pz = a.z;
  for (let i = 0; i < 20; i++) s.passo(0.05);
  ok(Math.hypot(a.x - px, a.z - pz) < 0.5, 'ele ficou para trás (18 m): ela para e espera');
  // ele parou de seguir
  cec.conversaAmiga('andre', { acao: 'naoSegue' });
  ok(!a.ia.seguido, 'parou de seguir: ela volta a ir atrás dele');
  // fora do time: só diz para onde está indo (a rotina é dela)
  s.sairDoTime(a, 'saiu'); a.ia.noTime = false; a.ia.chatFila = []; j.x = a.x + 2; j.z = a.z;
  cec.conversaAmiga('andre', { acao: 'seguir' });
  ok(a.ia.seguido && !a.ia.seguido.c && a.ia.chatFila.length === 1, `fora do time: topa e segue a rotina dela ("${a.ia.chatFila.at(-1)?.texto}")`);
  // o Dario também tem o botão (André 2026-11-19: igual à Cecília)
  dar.amiga.x = j.x + 1; dar.amiga.z = j.z; dar.amiga.ia.chatFila = [];
  dar.conversaAmiga('andre', { acao: 'seguir' });
  ok(DARIO.seguivel && AMIGA.seguivel && !!dar.amiga.ia.seguido, 'o Dario também é "seguível"');
}

// ---------- app ----------
{
  const t = gd('troca.gd'), sg = gd('seguir.gd'), on = gd('online.gd'), mn = gd('main.gd');
  ok(/func seguir_bt/.test(t) && /\["Seguir",/.test(t) && /\["Parar de seguir",/.test(t) && /amiga_segue/.test(t), 'cartão: botão Seguir (e Parar de seguir) só para quem o servidor marca');
  // André 2026-11-17: "tudo é igualzinho para um jogador e para ela" (troca, seguir, conversar, duelo)
  const ca = t.slice(t.indexOf('func cartao_acoes'), t.indexOf('func seguir_bt'));
  ok(/if not bot or achou in m\.online\.amiga_ids/.test(t) && /cartao_acoes\(achou, nome, dist > perto\(\), bot\)/.test(t), 'o mesmo cartão para outro jogador e para a Cecília');
  ok(['"Pedir troca"', '"Tirar do time"', '"Chamar pro time"', '"Mensagem"', '"Adicionar amigo"', 'seguir_bt(achou, bot)', 'duelo_bt(achou)', '"Equipamento"'].every((b) => ca.includes(b)), 'cartão: troca, time, mensagem, seguir, duelo e equipamento');
  ok(/if not bot:[\s\S]{0,120}m\.seguir\.comecar\(id, nome_de\(id\), false\)/.test(t) && /avisa_servidor/.test(sg), 'seguir outro jogador: só o app segue (sem avisar o servidor)');
  ok(/"seguir":/.test(on) && /m\.seguir\.comecar/.test(on) && /amiga_segue\[aid\] = true/.test(on), 'app: evento "seguir" começa a seguir');
  ok(/m\.rota\.ir\(m\.rota\.planejar\(mira\)/.test(sg) && /hud\.mover\.length\(\) > 0\.15/.test(sg) && /"naoSegue"/.test(sg), 'seguir.gd: vai pela rota, joystick para e avisa o servidor');
  ok(/Seguir = preload\("res:\/\/seguir\.gd"\)/.test(mn) && /seguir = Seguir\.new\(self\)/.test(mn), 'main.gd cria o seguir');
}
