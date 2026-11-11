// Cérebro por regras dos NPCs (André 2026-11-11, estilo bots do WoW): regras em ordem de prioridade, troca de espada e
// cajado pela situação, recuar do golpe carregado, proteger aliado, poção e Cura. Uso: node ferramentas/testes/cerebro.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO, CEREBRO } from '../../shared/index.js';
import { confere, decidir, ordenarRegras, limites, escolherArma } from '../../shared/cerebro.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

// ---------- motor (sem simulação) ----------
const R = ordenarRegras(CEREBRO.regras);
ok(R[0].id === 'pocao' && R[R.length - 1].id === 'atacar', 'regras em ordem de prioridade');
ok(new Set(CEREBRO.regras.map((r) => r.id)).size === CEREBRO.regras.length, 'sem regra repetida');
const J = CEREBRO.jeitos.cecilia;
const base = { ...limites(J, { pocao: 0.4, curaDono: 0.45, curaVida: 0.5, fugir: 0.2 }), vida: 1, mana: 1, temPocao: true, pocaoPronta: true, curaPronta: true, aliadoVida: 1, aliadoPerto: true, aliadoApanhando: false, apanhandoVida: 1, preparando: false, preparoChefe: false, temAlvo: true, distAlvo: 2, pertoDeMim: 1, agrupados: 1 };
const dec = (m) => decidir({ ...base, ...m }, R)?.faca;
ok(dec({}) === 'atacar', 'tudo bem: ataca');
ok(dec({ vida: 0.3 }) === 'pocao', 'pouca vida: poção');
ok(dec({ vida: 0.15, temPocao: false, curaPronta: false }) === 'fugir', 'sem poção e quase caindo: foge');
ok(dec({ aliadoVida: 0.3 }) === 'curarAliado', 'aliado mal: Cura');
ok(dec({ preparando: true, preparoChefe: true }) === 'recuar', 'chefe com o braço levantado: recua');
ok(dec({ preparando: true }) === 'atacar' && dec({ preparando: true, vida: 0.4 }) === 'recuar', 'monstro comum: corajosa só recua com pouca vida');
ok(dec({ aliadoApanhando: true, apanhandoVida: 0.5 }) === 'proteger', 'aliado apanhando: vai proteger');
ok(dec({ temAlvo: false }) === undefined, 'sem monstro: nada (segue o dono)');
ok(confere({ a: 1, b: 2 }, [['a', '<', '$b']]) && !confere({ a: 1 }, [['x', '=', true]]), 'valor $ lê outro sentido; sentido que não existe não bate');
const DJ = CEREBRO.jeitos.dario;
ok(limites(DJ, {}).limProteger > limites(J, {}).limProteger, 'Dario (cuidadoso) protege mais cedo que a Cecília');
ok(escolherArma({ ...base, distAlvo: 9 }, J, 'Espada', CEREBRO) === 'Magia', 'alvo longe: cajado');
ok(escolherArma({ ...base, distAlvo: 1.5 }, J, 'Espada', CEREBRO) === 'Espada', 'colada no monstro: espada');
ok(escolherArma({ ...base, distAlvo: 9, mana: 0.05 }, J, 'Espada', CEREBRO) === 'Espada', 'sem mana: fica na espada');

// ---------- na simulação ----------
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre');
const a = s.amiga;
const rnd = Math.random; Math.random = () => 0;
Object.assign(d, { x: a.x + 1, z: a.z }); s.conversaAmiga('andre', { acao: 'time' });
Math.random = rnd;
ok(a.time && a.time === d.time, 'Cecília no time');
const e = s.inimigos.find((o) => !o.treino && !o.morto);
// leva o monstro e o time para um lugar aberto perto da Cecília
const px = a.x, pz = a.z + 3;
Object.assign(e, { x: px + 9, z: pz, casa: { x: px + 9, z: pz }, vida: 9999, vidaMax: 9999 });
Object.assign(d, { x: px, z: pz - 1, combateAte: s.tempo + 60 });
a.ia.conversaAte = 0; // acabou de aceitar o time: não fica parada conversando
for (let i = 0; i < 20; i++) { d.combateAte = s.tempo + 60; s.passo(0.05); }
ok(a.modo === 'Magia', `monstro a ~9 m: pegou o cajado (modo ${a.modo})`);
// encosta: depois do tempo mínimo de troca, volta para a espada
Object.assign(e, { x: a.x + 1.2, z: a.z });
a.ia.armaT = 0;
let pegouEspada = false;
for (let i = 0; i < 40; i++) { d.combateAte = s.tempo + 60; Object.assign(e, { x: a.x + 1.2, z: a.z }); s.passo(0.05); if (a.modo === 'Espada') pegouEspada = true; }
ok(pegouEspada, 'monstro colado: voltou para a espada');
// golpe carregado do chefe vindo nela: recua
a.ia.cer = null; a.ia.cerT = 0;
a.trava = 0; a.fila = null; // terminou o golpe (no meio da animação ninguém recua, nem o jogador)
Object.assign(e, { x: a.x + 1.5, z: a.z, vez: a.id, preparoAte: s.tempo + 0.5, tipo: 'warrok', trava: 1 });
const x0 = a.x; s.passo(0.05); s.passo(0.05);
ok(a.ia.cer?.faca === 'recuar' && a.entrada.mx < 0, `braço levantado do chefe: recua (${a.ia.cer?.faca})`);
ok(Math.abs(a.x - x0) < 5, 'sem teleporte');
// poção com pouca vida
a.ia.cer = null; a.ia.cerT = 0; e.preparoAte = 0;
const pocoes = a.prog.mochila.filter((o) => o?.k === 'pocao').reduce((n, o) => n + (o.n || 1), 0);
a.vida = a.vidaMax * 0.2; a.ia.pocaoT = 0; a.pocaoAte = {};
s.passo(0.05); s.passo(0.05);
const depois = a.prog.mochila.filter((o) => o?.k === 'pocao').reduce((n, o) => n + (o.n || 1), 0);
ok(pocoes === 0 || depois < pocoes, `pouca vida: bebeu poção (${pocoes} -> ${depois})`);
// o Dario usa o mesmo cérebro
const b = s.amigoIaDe(DARIO.id).amiga;
ok(b && typeof s.amigoIaDe(DARIO.id).cerebroAmiga === 'function' && AMIGA.id in CEREBRO.jeitos && DARIO.id in CEREBRO.jeitos, 'Dario e Cecília com jeito próprio no mesmo cérebro');
// custo: 40 decisões de NPC
const t0 = performance.now();
for (let i = 0; i < 4000; i++) { a.ia.cerT = 0; a.ia.cer = null; s.cerebroAmiga(a, d, e); }
const ms = (performance.now() - t0) / 4000;
ok(ms < 0.2, `uma decisão custa ${ms.toFixed(4)} ms (40 NPCs x 4 por s = ${(ms * 160).toFixed(2)} ms por s)`);
