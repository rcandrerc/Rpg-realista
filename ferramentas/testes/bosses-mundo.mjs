// Teste dos bosses de mundo (André 2026-11-11): nascem na arena, avisam a skill antes, rolar escapa, efeitos no herói
// (atordoa, sangra, lento), fúria, largado volta inteiro, não sai da arena, morre, drop com catalisador, volta de 4 a 6 h
// pela hora salva e a arena limpa (sem árvore, chão plano). Uso: node ferramentas/testes/bosses-mundo.mjs
import './_tudo-aberto.mjs';
import { Simulacao, MAPA_CLAREIRA, BOSSES_MUNDO, CACA, ITENS, CATALISADOR } from '../../shared/index.js';
import { ARENAS_BOSS, alturaMundo, LUGARES_MUNDO } from '../../shared/mundo.js';
import { gradeDoMundo } from '../../shared/relevo.js';
import { contar } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

// ---------- dados e arenas ----------
const G = gradeDoMundo();
for (const A of ARENAS_BOSS) {
  const B = BOSSES_MUNDO[A.id];
  ok(!!B, `${A.id}: tem boss`);
  for (const sk of B.skills) ok(['salto', 'area', 'cone', 'investida', 'pocas', 'uivo', 'sumir', 'pedra', 'voo'].includes(sk.k) && sk.aviso >= 0.8, `${A.id}: skill ${sk.nome} conhecida e avisa antes`);
  ok(B.volta[0] >= 4 && B.volta[1] <= 6, `${A.id}: volta entre 4 e 6 h`);
  for (const k of [CATALISADOR.arma[B.drop.cat], CATALISADOR.armadura[B.drop.cat], CATALISADOR.arma[3]]) ok(!!ITENS[k], `${A.id}: catalisador ${k} existe`);
  const arv = MAPA_CLAREIRA.mata.filter((t) => Math.hypot(t.x - A.x, t.z - A.z) < A.r + 2).length;
  ok(arv === 0, `${A.id}: nenhuma árvore na arena (${arv})`);
  let mx = -1e9, mn = 1e9; for (let a = 0; a < 6.28; a += 0.3) for (const f of [0, 0.5, 1]) { const h = alturaMundo(G, A.x + Math.cos(a) * A.r * f, A.z + Math.sin(a) * A.r * f); mx = Math.max(mx, h); mn = Math.min(mn, h); }
  ok(mx - mn < 0.6, `${A.id}: chão da arena plano (${(mx - mn).toFixed(2)} m)`);
  const longe = Math.min(...LUGARES_MUNDO.filter((l) => l.tipo === 'vila').map((l) => Math.hypot(l.x - A.x, l.z - A.z) - l.r));
  ok(longe > 40, `${A.id}: longe das vilas (${longe.toFixed(0)} m)`);
}
ok(CACA.filter((c) => c.boss).length === Object.values(BOSSES_MUNDO).filter((B) => B.ativo !== false).length, 'só os bosses ativos entram nos campos');

// ---------- luta ----------
const s = new Simulacao(MAPA_CLAREIRA);
let agora = 1e12; s.relogioMs = () => agora;
let salvo = null; s.aoBosses = (e) => { salvo = e; };
const chat = []; s.aoAnuncio = (m) => chat.push(m.texto);
let ev = [];
const correr = (seg) => { for (let t = 0; t < seg / 0.05; t++) ev.push(...s.passo(0.05)); };
correr(1.2);
const boss = (id) => s.inimigos.find((e) => e.bm === id && !e.morto);
const b = boss('chifre_ferro');
ok(!!b && b.vidaMax > 20000, `Chifre-de-Ferro nasceu (vida ${b?.vidaMax})`);
ok(chat.some((t) => t.includes('Chifre-de-Ferro') && t.includes('apareceu')), 'chat geral avisa que nasceu');
ok(ev.some((e) => e.t === 'bosses' && e.l.length >= 4), 'lista dos bosses vai para o mapa');

const j = s.adicionarJogador('A', 'Ana');
Object.assign(j.prog, { nivel: 50 }); s.aplicarStatus(j); j.vida = j.vidaMax;
const A = b.arena;
const por = (x, z) => Object.assign(j, { x, z, y: s.terreno.altura(x, z), cliente: null, orcT: null });
por(A.x + 3, A.z);
ev = [];
correr(5);
const sk = ev.find((e) => e.t === 'bossSkill' && e.id === b.id);
ok(!!sk && sk.formas.length && sk.dur >= 1, `skill avisada antes (${sk?.nome}, ${sk?.dur} s)`);
ok(ev.some((e) => e.t === 'efeito' && e.id === 'A' && e.ef === 'sangra') || ev.some((e) => e.t === 'esquiva'), 'giro do machado faz sangrar');
ok(ev.some((e) => e.t === 'dano' && e.alvo === 'A' && e.dot === 'sangra'), 'sangramento tira vida por segundo');

// rolar na hora escapa do salto
j.vida = j.vidaMax; j.dots = null; ev = [];
let viu = null;
for (let t = 0; t < 400 && !viu; t++) { const e = s.passo(0.05); ev.push(...e); viu = e.find((x) => x.t === 'bossSkill' && x.k === 'salto'); if (j.vida < j.vidaMax * 0.3) j.vida = j.vidaMax; }
ok(!!viu, "salto de guerra avisado"); if (!viu) { console.log(j.morto, j.vida, b.skillCd, b.skillI, b.trava, b.semAlvo, ev.filter(e=>e.t==="bossSkill").map(e=>e.k)); process.exit(1); }
correr(viu.dur - 0.15); j.defesa = 1; const vAntes = j.vida; correr(0.3); j.defesa = 0;
ok(!ev.slice(-20).some((e) => e.t === 'efeito' && e.id === 'A' && e.ef === 'atordoa'), 'rolou na hora: não foi atordoado');
// sem rolar: atordoa e não anda
ev = []; viu = null; j.dots = null;
for (let t = 0; t < 600 && !viu; t++) { const e = s.passo(0.05); ev.push(...e); viu = e.find((x) => x.t === 'bossSkill' && x.k === 'salto'); if (j.vida < j.vidaMax * 0.3) j.vida = j.vidaMax; }
por(viu.formas[0].x, viu.formas[0].z); correr(viu.dur + 0.1);
ok((j.presoAte || 0) > s.tempo, 'salto pegou: atordoado');
const x0 = j.x;
ok(!s.posicaoCliente('A', { x: j.x + 3, y: j.y, z: j.z, ry: 0 }) && j.x === x0, 'atordoado não anda');

// fúria e largado volta inteiro
b.vida = Math.round(b.vidaMax * 0.45); ev = []; correr(0.2);
ok(b.furia && ev.some((e) => e.t === 'furia'), 'abaixo de 50% entra em fúria');
por(A.x + A.r + 30, A.z); j.presoAte = 0; correr(8);
ok(b.vida === b.vidaMax && !b.furia, 'largado: volta com a vida cheia');
ok(Math.hypot(b.x - A.x, b.z - A.z) <= A.r + 0.01, 'não sai da arena');

// morre: drop, volta salva, nasce de novo depois
por(A.x + 2, A.z); correr(0.2);
const cats = () => [...CATALISADOR.arma, ...CATALISADOR.armadura].reduce((n, k) => n + contar(j.prog.mochila, k), 0);
const antes = cats(), ouro = j.prog.ouro;
b.atacantes = new Set(['A']); s.ferir(b, b.vida + 10, j);
ok(b.morto, 'boss morreu');
ok(cats() > antes && j.prog.ouro > ouro, 'drop: catalisador garantido e ouro');
const volta = salvo?.chifre_ferro;
ok(volta && volta - agora >= 4 * 3600e3 - 1 && volta - agora <= 6 * 3600e3, `hora de voltar salva (${((volta - agora) / 3600e3).toFixed(2)} h)`);
ok(chat.some((t) => t.includes('caiu') && t.includes('Ana')), 'chat geral avisa quem derrubou');
correr(10);
ok(!boss('chifre_ferro'), 'não nasce antes da hora');
const s2 = new Simulacao(MAPA_CLAREIRA); s2.relogioMs = () => agora + 3600e3; s2.carregarBosses(salvo);
for (let t = 0; t < 30; t++) s2.passo(0.05);
ok(!s2.inimigos.some((e) => e.bm === 'chifre_ferro'), 'servidor reiniciado: continua esperando a hora salva');
agora = volta + 1000; correr(1.5);
ok(!!boss('chifre_ferro'), 'na hora certa nasce de novo');

// Uivo-Rei chama lobos
const u = boss('uivo_rei'); por(u.arena.x + 2, u.arena.z); ev = []; j.presoAte = 0; j.vida = j.vidaMax;
for (let t = 0; t < 900 && !ev.some((e) => e.t === 'bossGolpe' && e.k === 'uivo'); t++) { ev.push(...s.passo(0.05)); if (j.vida < j.vidaMax * 0.3) j.vida = j.vidaMax; }
const c = s.cacas.find((c) => c.boss?.id === 'uivo_rei');
ok(c.vagas.slice(1).some((vg) => vg.e), 'uivo chama lobos');
ok((j.lentoH?.ate || 0) > 0, 'uivo deixa lento');
