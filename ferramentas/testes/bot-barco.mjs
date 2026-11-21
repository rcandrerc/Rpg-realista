// Bots e o barquinho (André 2026-11-21: "pedi pra eles fazerem o barquinho, a Cecília ignorou, o Dario disse que fez mas
// no lago ele nadou atrás de mim e não usou; quando perguntei ele disse que estava de barco"). Pedido pelo chat faz de
// verdade (ou diz o que falta), no time ele entra no barquinho quando o dono vai para a água e desce na margem, e a ficha
// da IA diz onde ele está de verdade.
// Uso: node ferramentas/testes/bot-barco.mjs
import { Simulacao, MAPA_CLAREIRA, DARIO } from '../../shared/index.js';
import { noLago, AGUA } from '../../shared/relevo.js';
import { contar } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
const dario = s.amigoIaDe(DARIO.id);
for (const x of s.amigosIa) x.amigaEntrar('andre');
const b = dario.amiga;

// 1) o assunto "barco" vem antes do "vamos" (time)
ok(dario.assuntoAmiga('faz o barquinho pra mim') === 'barco' && dario.assuntoAmiga('vamos fazer um barco?') === 'barco' && dario.assuntoAmiga('tá de barco?') === 'barco', 'pedido do barquinho é o assunto "barco"');
ok(dario.assuntoAmiga('não faz o barco') !== 'barco', '"não faz o barco" não pede');

// 2) sem material: diz o que falta e não cria nada
b.prog.mochila = b.prog.mochila.map(() => null);
let fala = dario.barcoPedidoAmiga(b);
ok(/falta/.test(fala) && contar(b.prog.mochila, 'barquinho') === 0, `sem material diz o que falta: "${fala}"`);
// 3) com material: faz de verdade e gasta o material
b.prog.mochila[0] = { k: 'lenha', n: 35 }; b.prog.mochila[1] = { k: 'couro', n: 4 };
fala = dario.barcoPedidoAmiga(b);
ok(contar(b.prog.mochila, 'barquinho') === 1 && contar(b.prog.mochila, 'lenha') === 5 && contar(b.prog.mochila, 'couro') === 0, `fez o barquinho: "${fala}"`);
ok(/já tenho/i.test(dario.barcoPedidoAmiga(b)), 'pediu de novo: já tem (não faz outro)');
// pela conversa (regras): a fala é a do jogo, nunca a da IA
b.ia.chatFila = [];
dario.respostaAmiga('andre', { assunto: 'barco', fala: 'Fiz sim, tô de barco!' });
const ditas = (b.ia.chatFila || []).map((x) => x.texto).join(' | ');
ok(ditas && !/tô de barco/.test(ditas), `a fala da IA ("tô de barco") não passa; diz: "${ditas}"`);

// 4) no time: o dono vai de barco para o meio do lago, o Dario entra no barquinho dele
Object.assign(d, { x: b.x + 1, z: b.z });
const rnd = Math.random; Math.random = () => 0; dario.conversaAmiga('andre', { acao: 'time' }); Math.random = rnd;
ok(b.time && b.time === d.time, 'Dario no time');
const margem = { x: -36, z: 200 }, meio = { x: 0, z: 200 };
ok(!(noLago(margem.x, margem.z)?.fundo > 0.05) && noLago(meio.x, meio.z)?.fundo > 1.2, 'margem seca e meio do lago fundo');
Object.assign(b, { x: margem.x, z: margem.z, y: s.terreno.altura(margem.x, margem.z), chao: true, montado: null });
Object.assign(d, { x: -22, z: 200, y: AGUA.nivel, veiculo: 'barquinho', montado: null });
let entrou = false, nadou = 0;
for (let i = 0; i < 20 * 40 && !entrou; i++) {
  if (i % 20 === 0) d.x = Math.min(meio.x, d.x + 1.5); // o dono rema para o meio
  s.passo(0.05);
  if (b.veiculo === 'barquinho') entrou = true;
  else if ((noLago(b.x, b.z)?.fundo || 0) > AGUA.peito) nadou++;
}
ok(entrou, `Dario entrou no barquinho (nadou ${nadou} passos antes)`);
ok(contar(b.prog.mochila, 'barquinho') === 0, 'o barquinho saiu da mochila (está na água)');
const veic = s.fotoCarga().veic.find((v) => v[0] === 'b' && v[1] === b.id);
ok(!!veic, 'todo mundo vê o barquinho dele (foto)');
for (let i = 0; i < 20 * 10; i++) s.passo(0.05);
ok(b.veiculo === 'barquinho' && Math.abs(b.y - AGUA.nivel) < 0.2 && b.anim === 'Idle', `no barco boia na linha d'água sentado (y ${b.y.toFixed(2)}, ${b.anim})`);
ok(Math.hypot(b.x - d.x, b.z - d.z) < 8, `foi atrás do dono de barco (${Math.hypot(b.x - d.x, b.z - d.z).toFixed(1)} m)`);
const ctx = dario.contextoAmiga('andre');
ok(/NO barquinho/.test(ctx.barco), `ficha da IA: "${ctx.barco}"`);
ok(/Tô no barquinho/.test(dario.barcoPedidoAmiga(b)), 'perguntou: diz que está no barquinho (é verdade)');

// 5) o dono volta para a margem e sai do barco: o Dario desce e o barquinho volta para a mochila
Object.assign(d, { x: margem.x - 2, z: 200, y: s.terreno.altura(margem.x - 2, 200), veiculo: null });
for (let i = 0; i < 20 * 60 && b.veiculo; i++) s.passo(0.05);
ok(!b.veiculo && contar(b.prog.mochila, 'barquinho') === 1, `desceu na margem e guardou o barquinho (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`);
const ctx2 = dario.contextoAmiga('andre');
ok(/NÃO está nele/.test(ctx2.barco), `ficha fora do barco: "${ctx2.barco}"`);

// 6) sem barquinho ele continua nadando (não inventa barco)
b.prog.mochila = b.prog.mochila.map((o) => (o?.k === 'barquinho' ? null : o));
Object.assign(d, { x: -10, z: 200, y: AGUA.nivel, veiculo: 'barquinho' });
for (let i = 0; i < 20 * 15; i++) s.passo(0.05);
ok(!b.veiculo, 'sem barquinho na mochila: não entra em barco nenhum');
