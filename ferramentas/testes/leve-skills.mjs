// Jogo leve: os golpes são as skills do jogo (André 2026-11-27: "uso o meteoro e os bichos continuam lá... no jogo normal
// evaporo"). habLeve manda as barras da espada e do cajado (HABS do Quimera) e leveHab usa a mesma msg habQ do jogo.
// Uso: node ferramentas/testes/leve-skills.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.nivel = 63; a.leve = true; s.aplicarStatus(a, true);
const vivos = s.inimigos.filter((o) => !o.morto).slice(0, 3); s.inimigos.length = 0; s.inimigos.push(...vivos);
for (const e of vivos) { e.ia = null; e.velocidade = 0; }
for (let i = 0; i < 5; i++) s.passo(1 / 20);
vivos.forEach((e, k) => { e.x = a.x + 5 + k * 0.6; e.z = a.z + k * 0.5; });
const hb = s.habLeve(a);
ok(hb.bs?.[0] === 'espada_basico', 'básico da espada');
ok(hb.e.some((o) => o[0] === 'giro') && hb.c.some((o) => o[0] === 'meteoro'), `as duas barras do jogo (${hb.e.length} + ${hb.c.length})`);
s.leveHab('A', 'meteoro'); for (let t = 0; t < 80; t++) s.passo(1 / 20);
ok(vivos.every((e) => e.morto), 'o Meteoro do herói Nv 63 mata os bichos Nv 1 da área, como no jogo');
ok(a.modo === 'Magia' && s.habLeve(a).bs[0] === 'cajado_basico', 'usar magia troca o básico para o do cajado');
// Personagem > Golpes do leve = as barras do jogo (prog.barras, msg 'barra'), não a build antiga
const pe = s.personagemLeve(a);
ok(pe.ba?.espada?.length === 6 && pe.ba?.cajado?.length === 6 && !pe.bd, 'Golpes mostram as barras do jogo (6 + 6)');
const fora = pe.hs.find((h) => (h[2] === 'espada' || h[2] === 'geral') && !pe.ba.espada.includes(h[0]) && h[4] <= 63);
if (fora) { const lista = [...pe.ba.espada]; lista[0] = fora[0]; s.definirBarra('A', { barra: 'espada', lista }); ok(s.personagemLeve(a).ba.espada[0] === fora[0] && s.habLeve(a).e.some((o) => o[0] === fora[0]), `trocar golpe no leve muda a barra do jogo (${fora[1]})`); }
// buffs e debuffs no leve (como o buffs.gd do jogo): os meus e os do alvo, com os segundos que faltam
a.escudo = { ate: s.tempo + 8, n: 50 }; const al = s.inimigos.find((e) => !e.morto) || vivos[0]; al.morto = false; al.vuln = { ate: s.tempo + 4, k: 0.06 }; al.x = a.x + 3; al.z = a.z; al.vida = al.vidaMax; a.leveAlvo = al.id; a.leveMira = al.id;
const fl = s.fotoLeve(a), esc = fl.bf?.find((b) => b[0] === 'escudo');
ok(esc && esc[1] > 7 && esc[1] <= 8 && esc[2] === 50, `escudo no leve com o tempo que falta (${JSON.stringify(fl.bf)})`);
ok(fl.ba?.some((b) => b[0] === 'vuln'), `o alvo mostra o Quebrado (${JSON.stringify(fl.ba)})`);
a.prog.buff = { k: 'carne_assada', ate: Date.now() + 60000 }; const co = s.fotoLeve(a).bf.find((b) => b[0] === 'co');
ok(co && co[2] === 'Carne assada' && /dano/.test(co[3]) && co[1] > 50, `comida com nome e o que dá (${JSON.stringify(co)})`);
// efeitos da luta no leve (fxLeve): dano em cima do bicho, a área do meteoro e o projétil, só perto do herói
const bicho = s.inimigos.find((e) => !e.morto); bicho.x = a.x + 4; bicho.z = a.z;
const fd = s.fxLeve(a, { t: 'dano', alvo: bicho.id, n: 120, crit: true }), fm = s.fxLeve(a, { t: 'meteoro', x: a.x + 5, z: a.z, r: 6 }), fp = s.fxLeve(a, { t: 'proj', id: 7, x: a.x, z: a.z, dx: 1, dy: 0, dz: 0, vel: 18, vida: 0.9, cor: 0xff8a3a });
ok(fd?.[0] === 'd' && fd[3] === 120 && fd[4] === 1 && fm?.[0] === 'a' && fm[4] === 'meteoro' && fm[3] === 6 && fp?.[0] === 'p' && fp[3] === 18 && fp[7] === 7, `efeitos: ${JSON.stringify([fd, fm, fp])}`);
ok(s.fxLeve(a, { t: 'meteoro', x: a.x + 500, z: a.z, r: 6 }) === null, 'efeito longe do herói não vai');
