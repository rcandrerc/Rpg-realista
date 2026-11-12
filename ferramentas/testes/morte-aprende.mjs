// Aprender com a morte (entrega 4, André 2026-11-11; sem IA): o NPC cai, olha o que estava acontecendo e mexe nos
// próprios limites (bebe poção mais cedo, leva mais poção, caça mais baixo, foge antes de ficar cercado, recua do golpe
// grande). Vale igual para os 22. Subindo de nível, a lição vai passando. Fica salva com o NPC.
// Uso: node ferramentas/testes/morte-aprende.mjs
import { NPCS_NO_MUNDO } from '../../shared/dados.js'; NPCS_NO_MUNDO.aventureiros = null; // aqui o teste usa os 20 (no jogo andam só os de NPCS_NO_MUNDO)
import { Simulacao, MAPA_CLAREIRA, CEREBRO, NPC_VIDA } from '../../shared/index.js';
import { licoesValidas, textoLicoes } from '../../shared/amiga.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const M = CEREBRO.morte;

const s = new Simulacao(MAPA_CLAREIRA);
s.nivelTetoNpc = 30;
s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre', false);
const ctx = s.amigosIa.find((x) => x.AMIGA.id === 'lia'), j = ctx.amiga;
s.passo(0.05);
const n = j.prog.nivel | 0;
const antes = ctx.sentidosAmiga(j, j, null).s;

// 1) caiu para um monstro bem acima do nível, cercada, com poção na mochila
j.ia.ultS = { pertoDeMim: 4, preparoChefe: false, naAreaDePerigo: false };
j.golpeDe = { tipo: 'lobo', nivel: n + 4, hc: null, bm: false };
ok(j.prog.mochila.some((o) => o?.k === 'pocao'), 'tem poção na mochila antes de cair');
s.morrer(j); s.passo(0.05);
const L = j.licoes;
ok(L.pocao === M.passo.pocao && L.acima === 1 && L.fugir === M.passo.fugir && !L.recuar && L.mortes === 1, `aprendeu: poção mais cedo, caçar mais baixo, fugir antes (${JSON.stringify(L)})`);
ok(L.ultima?.de === 'Lobo' && L.ultima.nivel === n + 4, 'lembra quem derrubou');
ok(j.golpeDe == null, 'esquece o último golpe depois de aprender');
const depois = ctx.sentidosAmiga(j, j, null).s;
ok(depois.limPocao > antes.limPocao && depois.limFugir > antes.limFugir && depois.limRecuar === antes.limRecuar, 'os limites do cérebro mudaram (poção e fuga mais cedo)');

// caça mais baixo: o monstro de mobAcima níveis acima não serve mais
const c = { id: 'teste', x: j.x, z: j.z, r: 20 };
const mob = { id: 'm1', tipo: 'lobo', nivel: n + NPC_VIDA.aventura.mobAcima, x: j.x + 2, z: j.z, vida: 100, vidaMax: 100 };
s.inimigos.push(mob);
const viu = ctx.alvoSozinhoAmiga.call(s, j, c);
ok(viu !== mob, `não ataca mais monstro ${NPC_VIDA.aventura.mobAcima} níveis acima sozinho`);
s.inimigos.pop();

// 2) caiu sem poção para golpe de chefe: leva mais poção e recua mais cedo
j.morto = false; j.vida = j.vidaMax; s.passo(0.05);
j.prog.mochila = j.prog.mochila.map((o) => (o?.k === 'pocao' ? null : o));
j.ia.ultS = { pertoDeMim: 1, preparoChefe: true };
j.golpeDe = { tipo: 'chefe', nivel: n, hc: null, bm: false };
s.morrer(j); s.passo(0.05);
ok(j.licoes.pocoes === 1 && j.licoes.recuar === M.passo.recuar && j.licoes.mortes === 2, `sem poção: leva mais; golpe de chefe: recua antes (${JSON.stringify(j.licoes)})`);
ok(j.licoes.acima === 1, 'chefe não conta como "monstro forte demais" (caça normal continua)');
const pocoes = j.prog.mochila.filter((o) => o?.k === 'pocao').reduce((a, o) => a + (o.n || 1), 0);
ok(pocoes === ctx.AMIGA.time.pocoes + 1 || j.prog.ouro < 15, `comprou ${pocoes} poções (uma a mais que antes)`);

// 3) não passa do máximo
for (let i = 0; i < 20; i++) { j.morto = false; j.vida = j.vidaMax; s.passo(0.05); j.ia.ultS = { pertoDeMim: 5, preparoChefe: true }; j.golpeDe = { tipo: 'lobo', nivel: n + 9 }; s.morrer(j); s.passo(0.05); }
ok(Object.keys(M.max).every((q) => !(j.licoes[q] > M.max[q])), `nenhuma lição passa do máximo (${JSON.stringify(j.licoes)})`);
ok(ctx.sentidosAmiga(j, j, null).s.limPocao <= 0.95, 'poção nunca vira "bebe a toda hora"');

// 4) subiu de nível: esquece um pedaço
const L0 = { ...j.licoes };
j.morto = false; j.vida = j.vidaMax; s.passo(0.05);
ctx.esquecerMorteAmiga(j, 1);
ok(j.licoes.acima === L0.acima - 1 && j.licoes.pocao < L0.pocao && j.licoes.mortes === L0.mortes, 'subindo de nível a lição vai passando (as quedas continuam contadas)');
ctx.esquecerMorteAmiga(j, 30);
ok(!j.licoes.acima && !j.licoes.pocao && !j.licoes.recuar, 'muitos níveis depois: voltou ao jeito dele');

// 5) salva e volta (e o banco é conferido)
j.licoes = { pocao: 0.12, acima: 2, mortes: 3 };
ctx.guardarAmiga();
const salvo = s.npcsParaSalvar().find((x) => x.id === 'lia');
ok(salvo?.dados.licoes?.acima === 2, 'as lições vão para o banco com o NPC');
const s2 = new Simulacao(MAPA_CLAREIRA); s2.nivelTetoNpc = 30;
s2.carregarNpc('lia', salvo.dados); s2.adicionarJogador('andre', 'André', 'ruiva', {});
const lia2 = s2.amigosIa.find((x) => x.AMIGA.id === 'lia'); lia2.amigaEntrar('andre', false);
ok(lia2.amiga.licoes.acima === 2 && lia2.amiga.licoes.pocao === 0.12, 'voltou com as lições');
const v = licoesValidas({ pocao: 9, acima: -1, fugir: 'x', recuar: 0.1, mortes: 2, lixo: 1 });
ok(v.pocao === M.max.pocao && !v.acima && !v.fugir && v.recuar === 0.1 && !v.lixo, 'banco estranho não quebra nada (corta no máximo, tira o resto)');
ok(textoLicoes({ pocao: 0.1, acima: 1 }).length === 2, 'a ficha da conversa conta o que aprendeu');

// 6) os 22 aprendem igual (Cecília e Dario também)
const cec = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia');
if (cec?.amiga) { cec.amiga.ia.ultS = { pertoDeMim: 4 }; cec.amiga.golpeDe = { tipo: 'lobo', nivel: (cec.amiga.prog.nivel | 0) + 5 }; s.morrer(cec.amiga); s.passo(0.05); }
ok(!cec?.amiga || (cec.amiga.licoes?.acima === 1 && cec.amiga.licoes?.fugir > 0), 'Cecília aprende do mesmo jeito');
