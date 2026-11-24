// Robô de testes fora da guerra (André 2026-11-24: "se quiser deixar um bot imune a PVP, pode ser também... ele vai
// morrer o tempo todo"). Na noite de 23/11 o robô 1 morreu 175 vezes para a Geada. Conta de robô ('robo:', j.robo):
// ninguém da outra raça ataca e ele não ataca ninguém; a zona de guerra (j.guerra) continua valendo para a história e
// monstro continua batendo. Jogador de verdade segue igual.
// Uso: node ferramentas/testes/guerra-robo.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { RACAS } from '../../shared/dados.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {}); d.conta = 'c1';
const r = s.adicionarJogador('robo', 'Robô de teste', 'cabelo_m', { robo: true }); r.conta = 'c2';
for (const x of s.amigosIa) x.amigaEntrar('andre');
const ctx = (id) => s.amigoIaDe(id), kira = ctx('kira').amiga, rufo = ctx('rufo').amiga, lis = ctx('lis').amiga;
const geada = [kira, rufo, lis, ctx('gael')?.amiga, ctx('kael')?.amiga].filter(Boolean);
const nivel = (j, n) => { j.prog.nivel = n; s.aplicarStatus(j); j.vida = j.vidaMax; };
const por = (j, x, z) => Object.assign(j, { x, z, y: s.terreno.altura(x, z), vy: 0, chao: true });
const parados = () => { d.entrada = { mx: 0, mz: 0 }; r.entrada = { mx: 0, mz: 0 }; };
const passos = (seg) => { for (let i = 0; i < seg * 20; i++) { parados(); s.passo(0.05); } };
const v5 = s.cacas.find((c) => c.def.id === 'c_v5').def; // campo Nv 45: zona de guerra
const longe = (j) => por(j, RACAS.geada.casa.x, RACAS.geada.casa.z);

for (const b of geada) { longe(b); b.ia.guerra = null; }
nivel(r, 45); nivel(d, 45); nivel(rufo, 42);
r.protGuerraAte = 0; d.protGuerraAte = 0;

// o robô no campo de guerra, o André longe: o Rufo a 20 m não parte para cima do robô
longe(d); por(r, v5.x, v5.z); por(rufo, v5.x + 20, v5.z);
s.guerraT = 0; passos(1.5);
ok(r.guerra === true, 'o robô continua "na zona de guerra" (etapa da história que pede a guerra ainda fecha)');
ok(!s.emGuerra(rufo, r, true) && !s.emGuerra(r, rufo, true) && !s.emGuerra(rufo, r), 'robô e Geada nunca estão em guerra, nos dois sentidos');
ok(rufo.ia.guerra?.alvo !== r.id, 'a 20 m o Rufo não parte para cima do robô');
ok(!s.inimigosDe(rufo).includes(r) && !s.inimigosDe(r).some((o) => o.tipo === 'jogador'), 'o robô não entra na lista de alvos da Geada, e a dele só tem monstro');
const vr = r.vida; s.ferir(r, 100, rufo);
ok(r.vida === vr && !r.morto, 'golpe da Geada não tira vida do robô');
const vf = rufo.vida; s.ferir(rufo, 100, r);
ok(rufo.vida === vf, 'golpe do robô não tira vida da Geada');
const m = s.inimigos.find((e) => !e.morto && !e.treino);
s.ferir(r, 50, m);
ok(r.vida < vr, 'monstro continua batendo no robô');

// controle: o André no mesmo lugar é atacado como sempre (o robô fica longe)
r.vida = r.vidaMax; longe(r); rufo.ia.guerra = null; rufo.vida = rufo.vidaMax;
por(d, v5.x, v5.z); por(rufo, v5.x + 20, v5.z);
s.guerraT = 0; passos(1.5);
ok(s.emGuerra(rufo, d, true) && rufo.ia.guerra?.alvo === d.id, 'controle: o André no mesmo campo continua em guerra e o Rufo parte para cima dele');
// o Rufo já pode ter batido (e até matado) o André durante os passos: o golpe de controle parte de vida cheia
d.morto = false; d.vida = d.vidaMax;
const vd = d.vida; s.ferir(d, 100, rufo);
ok(d.vida < vd, 'controle: golpe da Geada no André tira vida');
