// Skills dos NPCs = skills do jogador (André 2026-11-11: "as skills de mágico das meninas dos NPCs estão no estilo antigo...
// é pra deixar igual ao que eu uso"). Os 22 usam as skills do Quimera (HABS, usarHabQ): Ataque de espada, Faísca, Bola
// de Fogo, Meteoro, Nova de Gelo, Cura da Floresta... e nunca as antigas (build/HABILIDADES/usarHabilidade).
// Uso: node ferramentas/testes/npc-skills.mjs
import { Simulacao, MAPA_CLAREIRA, HABS } from '../../shared/index.js';
import { NPCS_NO_MUNDO } from '../../shared/dados.js'; NPCS_NO_MUNDO.aventureiros = null; // aqui o teste usa os 20 (no jogo andam só os de NPCS_NO_MUNDO)
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
s.nivelTetoNpc = 20;
s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre', false);
const velhas = [];
const usarVelha = s.usarHabilidade.bind(s); s.usarHabilidade = (id, i) => { velhas.push([id, i]); return usarVelha(id, i); };
const novas = [];
let quem = null; // só as skills da Isolda (os outros 21 também lutam no mundo)
const usarNova = s.usarHabQ.bind(s); s.usarHabQ = (id, k) => { if (id === quem) novas.push(typeof k === 'string' ? k : k.id); return usarNova(id, k); };

const isolda = s.amigosIa.find((x) => x.AMIGA.id === 'isolda'), j = isolda.amiga; quem = j.id;
ok(j.prog.barras.cajado.includes('bola_fogo') && j.prog.barras.cajado.includes('cura_floresta') && j.prog.barras.espada.includes('corte_duplo'), 'barras com as skills novas (e a Cura da Floresta)');
// um monstro de verdade do mapa, imortal para o teste; ela a 6 m dele, de cajado
const alvo = s.inimigos.find((e) => !e.treino && !e.morto && !e.bm && !e.hc && e.tipo !== 'chefe');
Object.assign(alvo, { vida: 1e7, vidaMax: 1e7 });
const perto = () => { j.x = alvo.x + 6; j.z = alvo.z; j.y = s.terreno.altura(j.x, j.z); j.chao = true; if (j.vida < j.vidaMax * 0.6) j.vida = j.vidaMax; j.morto = false; };
const eventos = [];
const ev0 = s.evento.bind(s); s.evento = (e) => { if (e.t === 'conjura' && e.id === j.id) eventos.push(e.hab); return ev0(e); };
j.modo = 'Magia'; j.mana = j.manaMax;
for (let i = 0; i < 20 * 40; i++) { j.ia.cer = null; j.ia.av = null; if (i % 40 === 0) perto(); isolda.atacarAmiga(j, alvo, { s: { pertoDeMim: 1, agrupados: 3 }, jeito: { cajado: 1, coragem: 0.5, cuidado: 0.5 } }); j.ia.armaT = 1e9; s.passo(0.05); if (j.mana < 20) j.mana = j.manaMax; }
const usadas = new Set(novas);
console.log('skills usadas:', [...usadas].join(', '), '| conjura:', [...new Set(eventos)].join(', '));
ok(velhas.length === 0, 'nunca usa o sistema antigo de skill');
ok(usadas.has('cajado_basico'), 'Faísca (o básico do cajado do jogador)');
ok([...usadas].some((k) => HABS[k] && !HABS[k].basico && HABS[k].arvore !== 'espada'), 'usa skills de cajado da barra');
ok([...usadas].every((k) => HABS[k]), 'só skills que existem para o jogador');
ok(eventos.every((h) => HABS[h]), 'o celular recebe as skills novas (mesmo efeito e som do jogador)');
// espada
j.ia.armaForcada = { modo: 'Espada', ate: 1e9 }; for (let i = 0; i < 60; i++) s.passo(0.05); j.fila = null; s.trocarModo(j.id, 'Espada'); novas.length = 0;
for (let i = 0; i < 20 * 20; i++) { if (j.vida < j.vidaMax * 0.6) j.vida = j.vidaMax; j.x = alvo.x + 1.5; j.z = alvo.z; j.y = s.terreno.altura(j.x, j.z); isolda.atacarAmiga(j, alvo, { s: { pertoDeMim: 3, agrupados: 3 }, jeito: { cajado: 0, coragem: 0.5, cuidado: 0.5 } }); j.ia.armaT = 1e9; s.passo(0.05); if (j.mana < 30) j.mana = j.manaMax; }
ok(novas.includes('espada_basico') && novas.some((k) => HABS[k]?.arvore === 'espada' && !HABS[k].basico), `espada: ataque de espada e skills de espada (${[...new Set(novas)].join(', ')})`);
// cura: a do jogador (libera no Nv 6)
novas.length = 0;
j.vida = j.vidaMax * 0.3; j.mana = j.manaMax; j.cds = {}; j.trava = 0; j.canal = null; j.ia.cer = null; j.ia.cerT = 0;
const v = isolda.sentidosAmiga(j, j, null).s;
ok(v.curaPronta === (j.prog.nivel >= HABS.cura_floresta.libera), `cura pronta segue o nível da Cura da Floresta (Nv ${j.prog.nivel})`);
const lune = s.amigosIa.find((x) => x.AMIGA.id === 'lune').amiga;
ok(lune.prog.nivel < 6 && !s.amigosIa.find((x) => x.AMIGA.id === 'lune').sentidosAmiga(lune, lune, null).s.curaPronta, 'Nv 1: ainda não tem a cura (igual ao jogador)');
