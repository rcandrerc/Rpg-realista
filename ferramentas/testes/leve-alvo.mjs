// Jogo leve: o alvo e a frente do herói (André 2026-11-27: "mostrar qual mob que eu tô atacando... uma setinha... no modo
// leve eu sou uma bola"). Atacar num monstro faz os golpes virarem para ele, mesmo com outro mais perto (como o Trocar
// alvo do jogo); a foto manda o alvo (al) e para onde o herói está virado (eu[13]). Sem escolher, vale o mais perto.
// Uso: node ferramentas/testes/leve-alvo.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.nivel = 20; a.leve = true;
const [perto, escolhido] = s.inimigos.filter((e) => !e.morto);
s.inimigos.length = 0; s.inimigos.push(perto, escolhido);
for (const e of [perto, escolhido]) { e.vel = 0; e.velocidade = 0; e.ia = null; }
const pos = () => { perto.x = a.x + 2; perto.z = a.z; escolhido.x = a.x; escolhido.z = a.z - 3; };
for (let i = 0; i < 5; i++) s.passo(1 / 20);
pos();
let f = s.fotoLeve(a);
ok(f.al === perto.id, 'sem escolher: o alvo é o mais perto');
ok(Number.isFinite(f.eu[13]), 'a foto manda para onde o herói está virado');
s.leveIr('A', { x: escolhido.x, z: escolhido.z, nome: 'x', alvo: escolhido.id });
s.leveParar('A', null); pos();
ok(s.fotoLeve(a).al === escolhido.id, 'Atacar num monstro: o alvo vira ele');
s.usarHabilidade('A', 0);
const vira = Math.atan2(escolhido.x - a.x, escolhido.z - a.z);
ok(Math.abs(a.ry - vira) < 0.05, `o golpe vira para o escolhido (ry ${a.ry.toFixed(2)}, esperado ${vira.toFixed(2)})`);
ok(s.fotoLeve(a).eu[13] === Math.round(a.ry * 100) / 100, 'a seta acompanha');
escolhido.morto = true;
ok(s.fotoLeve(a).al === perto.id && a.leveMira == null, 'o escolhido caiu: volta para o mais perto');
