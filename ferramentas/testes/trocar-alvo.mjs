// Botão Trocar alvo (André 2026-11-23): o celular escolhe pelas 4 camadas e manda "b" (+ "j" para jogador/bot inimigo);
// o servidor (Simulacao.alvoTravado) mira nele, também na espada. Sem "b", tudo igual a antes.
// Uso: node ferramentas/testes/trocar-alvo.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {}); d.conta = 'c1';
for (const x of s.amigosIa) x.amigaEntrar('andre');
const kira = s.amigoIaDe('kira').amiga;
const v5 = s.cacas.find((c) => c.def.id === 'c_v5').def;
const por = (j, x, z) => Object.assign(j, { x, z, y: s.terreno.altura(x, z) });
d.prog.nivel = 40; s.aplicarStatus(d); d.vida = d.vidaMax;
por(d, v5.x, v5.z); por(kira, v5.x + 2, v5.z);
s.guerraT = 0; s.passo(0.05);
ok(s.inimigosDe(d).includes(kira), 'Kira (Geada) é inimiga do André no campo de guerra');
const esp = s.habPronta(d, 'espada_basico');
ok(s.alvoTravado(d, esp, { id: 'espada_basico', b: true, j: kira.id }) === kira, 'espada com o botão: mira na Kira pelo id');
ok(s.alvoTravado(d, esp, { id: 'espada_basico', j: kira.id }) === null, 'espada sem o botão: igual antes (mais perto)');
ok(s.alvoTravado(d, esp, 'espada_basico') === null, 'golpe mandado como texto (sem botão): igual antes');
const amigo = s.amigoIaDe('dario').amiga; por(amigo, v5.x + 1, v5.z);
ok(s.alvoTravado(d, esp, { id: 'espada_basico', b: true, j: amigo.id }) === null, 'não dá para travar em quem não é inimigo (Dario, mesma raça)');
const mob = s.inimigos.find((e) => !e.morto && !e.treino && Number.isInteger(e.v));
por(mob, d.x + 1.5, d.z);
ok(s.alvoTravado(d, esp, { id: 'espada_basico', b: true, v: mob.v }) === mob, 'espada com o botão: mira no monstro pelo v');
por(kira, v5.x + 30, v5.z);
ok(s.alvoTravado(d, esp, { id: 'espada_basico', b: true, j: kira.id }) === null, 'longe do golpe: cai no mais perto');
const mag = s.habPronta(d, 'cajado_basico');
ok(s.alvoTravado(d, mag, { id: 'cajado_basico', v: mob.v }) === mob, 'cajado sem botão: alvo travado pelo v como sempre');
