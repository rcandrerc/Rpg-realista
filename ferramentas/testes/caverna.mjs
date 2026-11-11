// Teste da primeira dungeon, a Caverna da Montanha (André 2026-11-06): túnel contínuo dentro da montanha (sem loading),
// Gaspar faz o passe com material dos monstros, o selo só deixa passar quem usou o passe, os monstros das salas só
// nascem com alguém lá dentro e somem quando a caverna esvazia. Uso: node ferramentas/testes/caverna.mjs
import { Simulacao, MAPA_CLAREIRA, CAVERNA, TUNEL, CAVERNA_DUNGEON, ITENS } from '../../shared/index.js';
import { noTunel, pontoDoTunel } from '../../shared/caverna.js';
import { alturaMontanha } from '../../shared/relevo.js';
import { dentroDoMapa } from '../../shared/mapa.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), T = s.terreno;

// 1) o túnel cabe na montanha: rocha por cima de todo o túnel depois da boca, tudo dentro do mapa
let pouca = 0;
for (const a of TUNEL.amostras) {
  if (a.s < 14) continue;
  for (const k of [-1, 0, 1]) { const p = pontoDoTunel(a.s, (a.l + 1) * k); if (alturaMontanha(p.x, p.z) < a.y + a.teto + 1) pouca++; }
}
ok(pouca === 0, `rocha por cima do túnel todo (${TUNEL.amostras.length} amostras, ${TUNEL.total} m)`);
ok(TUNEL.amostras.every((a) => dentroDoMapa(MAPA_CLAREIRA, a.x, a.z, 2.2)), 'túnel inteiro dentro do mapa andável');
ok(ITENS.passe_caverna && ITENS.fragmento, 'itens novos: passe e fragmento');

// 2) chão contínuo: andando pelo meio do túnel, de fora até o fundo, nunca tem degrau maior que um passo
let y = T.altura(TUNEL.amostras[0].x, TUNEL.amostras[0].z, 99), pior = 0;
for (let sv = 0; sv <= TUNEL.total; sv += 0.25) {
  const p = pontoDoTunel(sv), h = T.altura(p.x, p.z, y + 0.3);
  pior = Math.max(pior, Math.abs(h - y)); y = h;
}
ok(pior < 0.2, `da trilha ao fundo sem degrau (maior diferença em 25 cm: ${pior.toFixed(3)} m)`);
const meio = pontoDoTunel(40);
ok(Math.abs(T.altura(meio.x, meio.z, meio.y + 0.3) - meio.y) < 0.01, 'lá dentro o chão é o da caverna');
ok(T.altura(meio.x, meio.z) > 20, 'quem anda por cima da montanha continua na encosta (' + T.altura(meio.x, meio.z).toFixed(1) + ' m)');
const parede = pontoDoTunel(40, meio.l + 1.2);
ok(T.altura(parede.x, parede.z, meio.y + 0.3) > meio.y + 5, 'um passo para o lado é parede de rocha');
ok(T.teto(meio.x, meio.z, meio.y + 0.3) < meio.y + 8, 'a cabeça bate no teto da caverna');

// 3) Gaspar faz o passe
const j = s.adicionarJogador('A', 'Ana');
const g = MAPA_CLAREIRA.npcs.find((n) => n.id === CAVERNA_DUNGEON.npc);
ok(!!g && !noTunel(TUNEL, g.x, g.z, 0.3), 'Gaspar está fora do túnel, na boca: ' + g.x + ', ' + g.z);
Object.assign(j, { x: g.x + 1.2, z: g.z, y: T.altura(g.x + 1.2, g.z) });
s.eventos = [];
s.item('A', { acao: 'fazer_passe' });
ok(s.eventos.some((e) => /Falta/.test(e.texto || '')), 'sem material: ' + s.eventos.map((e) => e.texto).join(' | '));
for (const [k, n] of Object.entries(CAVERNA_DUNGEON.passe)) j.prog.mochila[j.prog.mochila.indexOf(null)] = { k, n };
s.eventos = [];
s.item('A', { acao: 'fazer_passe' });
ok(j.prog.mochila.some((o) => o?.k === 'passe_caverna') && !j.prog.mochila.some((o) => o?.k === 'fragmento'), 'fez o passe e gastou o material');

// 4) selo: sem usar o passe, o servidor não deixa passar
const ir = (sv) => { const p = pontoDoTunel(sv); j.orc = 99; return s.posicaoCliente('A', { x: p.x, y: p.y, z: p.z, ry: 0 }); };
ok(ir(CAVERNA.porta - 2), 'chega até a frente do selo');
ok(!ir(CAVERNA.porta + 1.5), 'sem passe usado o selo segura');
s.eventos = [];
s.item('A', { acao: 'usar_passe' });
ok(!!j.caverna && !j.prog.mochila.some((o) => o?.k === 'passe_caverna'), 'usou o passe: entrada liberada e o passe gasto');
ok(s.eventos.some((e) => e.t === 'caverna' && e.aberta), 'avisa o app que o selo abriu');

// 5) monstros só nascem com gente lá dentro, e perto da sala
const v0 = s.inimigos.length;
j.vida = j.vidaMax = 1e9; // o teste não quer que os golens derrubem a Ana
for (let t = 0; t < 20; t++) s.passo(0.05);
ok(s.inimigos.length === v0, 'na porta ainda não nasce monstro nenhum');
for (let sv = CAVERNA.porta - 2; sv <= 22; sv += 1) ir(sv);
for (let t = 0; t < 4; t++) s.passo(0.05);
const sala1 = s.dungeon.salas[0];
ok(sala1.ativa && sala1.vagas.every((vg) => vg.e) && !s.dungeon.salas[2].ativa, 'chegando perto, só a primeira sala nasce');
const vs = new Set(s.inimigos.map((e) => e.v));
ok(vs.size === s.inimigos.length, 'cada monstro com um v próprio');
// monstro fica no túnel e no chão dele
for (let t = 0; t < 200; t++) { ir(22); s.passo(0.05); }
ok(sala1.vagas.every((vg) => { const c = noTunel(TUNEL, vg.e.x, vg.e.z); return c && c.s > CAVERNA.porta && Math.abs(vg.e.y - c.y) < 0.01; }), 'golens ficam dentro do túnel, no chão da caverna');
ok(sala1.vagas.some((vg) => Math.hypot(vg.e.x - j.x, vg.e.z - j.z) < 6), 'golens vêm para cima de quem entrou');

// 6) quem anda por cima da montanha não é visto pelos monstros lá de baixo
const b = s.adicionarJogador('B', 'Beto'), cima = pontoDoTunel(33);
Object.assign(b, { x: cima.x, z: cima.z, y: T.altura(cima.x, cima.z) });
ok(!s.inimigosDe(sala1.vagas[0].e).includes(b) && s.inimigosDe(sala1.vagas[0].e).includes(j), 'a rocha separa a caverna de quem está em cima');

// 7) saiu: perde a entrada; caverna vazia: os monstros somem
for (let sv = 22; sv >= -1; sv -= 1) { const p = pontoDoTunel(Math.max(0, sv)); j.orc = 99; s.posicaoCliente('A', { x: p.x - (sv < 0 ? 2 : 0), y: T.altura(p.x - (sv < 0 ? 2 : 0), p.z, p.y + 0.3), z: p.z, ry: 0 }); s.passo(0.05); }
ok(!j.caverna, 'saiu da caverna: a entrada acabou');
ok(!ir(CAVERNA.porta + 1.5), 'para entrar de novo precisa de outro passe');
for (let t = 0; t < (CAVERNA_DUNGEON.esvazia + 1) / 0.05; t++) s.passo(0.05);
ok(s.inimigos.length === v0 && !sala1.ativa, 'caverna vazia: os monstros somem');
