// Dica vira regra (André 2026-11-11): a IA devolve uma regra com a lista fechada de sentidos e ações; o jogo confere,
// guarda no NPC (vale para todos), troca a dica que fala da mesma situação e segue no cérebro. Sem rede: a "IA" aqui é
// a regra pronta. Uso: node ferramentas/testes/dicas.mjs
import { Simulacao, MAPA_CLAREIRA, CEREBRO, DARIO } from '../../shared/index.js';
import { validarRegra, juntarDica, decidir, ordenarRegras } from '../../shared/cerebro.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

// conferência da regra
const boa = { quando: [['preparando', '=', true], ['preparoChefe', '=', true]], faca: 'recuar', por: 1.2, texto: 'recuar quando o chefe levantar o braço' };
const v = validarRegra(boa, CEREBRO);
ok(v && v.pri === CEREBRO.dicas.pri && v.faca === 'recuar', 'regra boa passa (prioridade da dica)');
ok(!validarRegra({ ...boa, faca: 'voar' }, CEREBRO), 'ação fora da lista: recusa');
ok(!validarRegra({ ...boa, quando: [['xp', '>', 3]] }, CEREBRO), 'sentido fora da lista: recusa');
ok(!validarRegra({ ...boa, quando: [['vida', '=', true]] }, CEREBRO), 'operação errada para número: recusa');
ok(!validarRegra({ ...boa, quando: [] }, CEREBRO) && !validarRegra({ ...boa, quando: Array(9).fill(['vida', '<', 0.5]) }, CEREBRO), 'sem condição ou condição demais: recusa');
ok(validarRegra({ ...boa, pri: 1000, por: 99 }, CEREBRO).pri === CEREBRO.dicas.priMax && validarRegra({ ...boa, por: 99 }, CEREBRO).por === CEREBRO.dicas.por[1], 'prioridade e tempo com teto');
ok(validarRegra({ ...boa, pri: 1000 }, CEREBRO).pri < CEREBRO.regras.find((r) => r.id === 'pocao').pri, 'dica nunca passa na frente da poção');
// troca a que contradiz
const caj = validarRegra({ quando: [['alvoChefe', '=', true]], faca: 'usarCajado', texto: 'usar cajado no chefe' }, CEREBRO);
const esp = validarRegra({ quando: [['alvoChefe', '=', true]], faca: 'usarEspada', texto: 'usar espada no chefe' }, CEREBRO);
let r = juntarDica([caj, v], esp, 12);
ok(r.trocou && r.lista.length === 2 && r.lista.includes(esp) && !r.lista.includes(caj), 'espada no chefe troca cajado no chefe');
r = juntarDica([], v, 12);
const nums = Object.entries(CEREBRO.sentidos).filter(([, S]) => S.tipo === 'n').map(([k]) => k);
for (let i = 0; i < 14; i++) r = juntarDica(r.lista, validarRegra({ quando: [[nums[i % nums.length], i < nums.length ? '<' : '>', 0.5]], faca: 'pocao' }, CEREBRO), 12);
ok(r.lista.length === 12 && !r.lista.includes(v), 'no máximo 12: sai a mais velha');
// no cérebro: a dica ganha do atacar
const s0 = { limPocao: 0.4, limCura: 0.45, limCuraSi: 0.5, limFugir: 0.2, limRecuar: 0.45, limProteger: 0.6, vida: 1, mana: 1, temPocao: true, pocaoPronta: true, curaPronta: true, aliadoVida: 1, aliadoPerto: true, aliadoApanhando: false, apanhandoVida: 1, preparando: false, preparoChefe: false, naAreaDePerigo: false, temAlvo: true, alvoChefe: true, alvoAcima: 0, arma: 'Espada', distAlvo: 2, pertoDeMim: 1, agrupados: 1 };
ok(decidir(s0, ordenarRegras([...CEREBRO.regras, esp]))?.faca === 'usarEspada' && decidir(s0, ordenarRegras(CEREBRO.regras))?.faca === 'atacar', 'dica "espada no chefe" muda a decisão');

// o que é dica no chat
const sim = new Simulacao(MAPA_CLAREIRA);
const d = sim.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of sim.amigosIa) x.amigaEntrar('andre');
const a = sim.amiga;
ok(sim.tipoDicaAmiga('recua quando o chefe levantar o braço') === 'dica' && sim.tipoDicaAmiga('Sempre usa o cajado contra chefe!') === 'dica', 'reconhece dica');
ok(sim.tipoDicaAmiga('bora caçar') === null && sim.tipoDicaAmiga('oi, tudo bem?') === null && sim.tipoDicaAmiga('vem cá') === null, 'conversa normal não é dica');
ok(sim.tipoDicaAmiga('esquece a última dica') === 'esquecer' && sim.tipoDicaAmiga('o que você aprendeu?') === 'listar', 'esquecer e listar');
// aprende, guarda e volta depois de sair e entrar
ok(sim.aprenderDicaAmiga('andre', boa, 'recua quando o chefe levantar o braço') && a.dicas.length === 1 && a.dicas[0].autor, 'aprendeu a dica (com quem ensinou anotado)');
ok(!sim.aprenderDicaAmiga('andre', { quando: [['xp', '>', 1]], faca: 'voar' }, 'voa') && a.dicas.length === 1, 'dica que não dá: não muda nada');
ok(a.ia.chatFila?.some((m) => m.texto.includes('recuar quando o chefe')), 'ela confirma no chat');
sim.guardarAmiga();
const L = sim.loteDaAmiga();
ok(L.amiga.dicas?.length === 1, 'vai para o banco junto com o terreno');
sim.amigaSair('andre'); for (const x of sim.amigosIa) x.amigaEntrar('andre');
ok(sim.amiga.dicas?.length === 1 && sim.amiga.dicas[0].faca === 'recuar', 'voltou com a dica');
// vale para todo mundo: outra pessoa no time dela também
const dario = sim.amigoIaDe(DARIO.id);
ok(!(dario.amiga.dicas || []).length, 'cada NPC tem as próprias dicas (o Dario não aprendeu)');
sim.comandoDicaAmiga('andre', 'listar', 'o que você aprendeu');
ok(sim.amiga.ia.chatFila.some((m) => m.texto.startsWith('O que eu aprendi')), 'lista o que aprendeu');
sim.comandoDicaAmiga('andre', 'esquecer', 'esquece todas as dicas');
ok(sim.amiga.dicas.length === 0, 'esqueceu');
// usar cajado por dica: força a arma na luta
{
  const j = sim.amiga; Object.assign(d, { x: j.x + 1, z: j.z }); const rnd = Math.random; Math.random = () => 0; sim.conversaAmiga('andre', { acao: 'time' }); Math.random = rnd; j.ia.conversaAte = 0;
  sim.aprenderDicaAmiga('andre', { quando: [['temAlvo', '=', true]], faca: 'usarCajado', por: 8, texto: 'usar sempre o cajado' }, 'usa sempre o cajado');
  const e = sim.inimigos.find((o) => !o.treino && !o.morto);
  Object.assign(e, { x: j.x + 1.2, z: j.z, casa: { x: j.x + 1.2, z: j.z }, vida: 9999, vidaMax: 9999 });
  for (let i = 0; i < 20; i++) { d.combateAte = sim.tempo + 60; Object.assign(e, { x: j.x + 1.2, z: j.z }); sim.passo(0.05); }
  ok(j.modo === 'Magia', `dica "usa sempre o cajado": mesmo com o monstro colado, cajado (${j.modo})`);
}
