// Os 20 aventureiros (André 2026-11-11): iguais à Cecília e ao Dario por dentro, vivem sozinhos no mundo (caçam no campo
// do nível, voltam para a vila, vendem, consertam, compram poção, de noite ficam na vila), sem casa, save na tabela mundo,
// nunca passam do jogador mais alto do servidor, e ganham XP devagar no tempo em que ninguém jogou.
// Uso: node ferramentas/testes/aventureiros.mjs
import { Simulacao, MAPA_CLAREIRA, AVENTUREIROS, AMIGOS_VIRTUAIS, CEREBRO, NPC_VIDA, CRIADOR, aparenciaValida } from '../../shared/index.js';
import { NPCS_NO_MUNDO } from '../../shared/dados.js'; NPCS_NO_MUNDO.aventureiros = null; // aqui o teste usa os 20 (no jogo andam só os de NPCS_NO_MUNDO)
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

ok(AVENTUREIROS.length === 20 && AMIGOS_VIRTUAIS.length === 22, '20 aventureiros + Cecília e Dario');
ok(new Set(AMIGOS_VIRTUAIS.map((d) => d.id)).size === 22 && new Set(AMIGOS_VIRTUAIS.map((d) => d.conta)).size === 22, 'ids e contas sem repetir');
ok(AVENTUREIROS.every((d) => CRIADOR.corpos.includes(d.visual)), 'todos no padrão do criador (Ruiva e cabelo_m)');
ok(AVENTUREIROS.every((d) => { const a = aparenciaValida(d.aparencia); return ['cabelo', 'olhos', 'pele', 'roupa', 'calca'].every((k) => a[k] === d.aparencia[k]) && a.penteado === (d.aparencia.penteado ?? null); }), 'cores e penteado da paleta do criador (o servidor não troca nada)');
ok(AVENTUREIROS.every((d) => d.visual === (d.genero === 'm' ? 'cabelo_m' : 'ruiva')), 'moças na Ruiva, rapazes no cabelo_m');
ok(AMIGOS_VIRTUAIS.every((d) => CEREBRO.jeitos[d.id]), 'cada um com o seu jeito no cérebro');
ok(AVENTUREIROS.every((d) => d.terreno === null && d.persona && d.nivelInicial >= 1), 'sem terreno, com persona e nível inicial');

// ---------- no mundo ----------
const s = new Simulacao(MAPA_CLAREIRA);
s.nivelTetoNpc = 12; // o jogador mais alto do servidor
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre', false); // sem chave: vê todos, não conversa
const aventureiros = s.amigosIa.filter((x) => !x.AMIGA.terreno);
ok(aventureiros.length === 20 && aventureiros.every((x) => x.amiga && s.jogadores.has(x.AMIGA.id)), 'os 20 entram no mundo junto com qualquer jogador');
ok(aventureiros.every((x) => !x.amigaFalam.has('andre') && x.amigaDono == null), 'sem chave: nenhum vira "dono" de ninguém');
ok(aventureiros.every((x) => x.amiga.prog.nivel <= 12) && aventureiros.find((x) => x.AMIGA.id === 'helena').amiga.prog.nivel === 12 && aventureiros.find((x) => x.AMIGA.id === 'lia').amiga.prog.nivel === 3, 'nível da lista, sem passar do jogador mais alto (Helena 20 -> 12)');
ok(aventureiros.every((x) => x.amiga.prog.equip.cajado && x.amiga.prog.equip.espada), 'espada e cajado, como todo herói');
const lia = aventureiros.find((x) => x.AMIGA.id === 'lia'), isolda = aventureiros.find((x) => x.AMIGA.id === 'isolda');
for (let i = 0; i < 3; i++) s.passo(0.05);
ok(isolda.amiga.prog.atr.int > lia.amiga.prog.atr.int, `pontos pelo jeito: Isolda (cajado) Int ${isolda.amiga.prog.atr.int}, Lia Int ${lia.amiga.prog.atr.int}`);
const M0 = NPC_VIDA.moradia[0];
ok(aventureiros.every((x) => Math.hypot(x.amiga.x - M0.x, x.amiga.z - M0.z) <= M0.r + 0.5), 'nascem espalhados na vila');
// algumas horas de jogo (de dia): saem para caçar, matam, ganham XP, voltam
const xp0 = aventureiros.map((x) => x.amiga.prog.nivel * 1e6 + x.amiga.prog.xp);
const t0 = performance.now(); let passos = 0;
const fases = new Set(), longe = new Set(), dia = { h: 12, t: Date.now() };
for (let i = 0; i < 20 * 60 * 6; i++) { // 6 minutos
  for (const x of aventureiros) x.amiga.prog.dia = dia; // meio-dia fixo (a hora do jogo segue o relógio de verdade)
  s.passo(0.05); passos++;
  if (i % 200 === 0) for (const x of aventureiros) { if (x.amiga.ia.av) fases.add(x.amiga.ia.av.fase); if (Math.hypot(x.amiga.x - M0.x, x.amiga.z - M0.z) > 40) longe.add(x.AMIGA.id); }
}
const ms = (performance.now() - t0) / passos;
const ganhou = aventureiros.filter((x, i) => x.amiga.prog.nivel * 1e6 + x.amiga.prog.xp > xp0[i]).length;
console.log('fases vistas:', [...fases].join(', '), '| longe da vila:', longe.size, '| ganharam XP:', ganhou, '| ms por passo:', ms.toFixed(2));
ok(fases.has('ir') && fases.has('cacar'), 'saem para o campo e caçam sozinhos');
ok(longe.size >= 10, `andam pelo mundo (${longe.size} de 20 saíram da vila)`);
ok(ganhou >= 5, `ganham XP caçando (${ganhou} de 20)`);
ok(aventureiros.every((x) => x.amiga.prog.nivel <= 12), 'ninguém passou do jogador mais alto');
ok(ms < 8, `custo: ${ms.toFixed(2)} ms por passo com 22 NPCs (o servidor tem 50 ms)`);
// save na tabela mundo e volta
for (const x of aventureiros) x.guardarAmiga();
const salvos = s.npcsParaSalvar();
ok(salvos.length === 20 && salvos.every((n) => n.dados.prog && n.dados.t), 'o progresso dos 20 vai para o banco (tabela mundo)');
ok(!s.lotesParaSalvar().some((l) => l.dono?.startsWith('a:') && !['a:cecilia', 'a:dario'].includes(l.dono)), 'nenhum terreno criado para aventureiro');
// todos saem com o último jogador
for (const x of s.amigosIa) x.amigaSair('andre');
ok(s.amigosIa.every((x) => !x.amiga), 'o último jogador saiu: todos saem (e param de gastar servidor)');
// volta com o que tinha + 2 dias fora: sobe devagar, sem passar do teto
const s2 = new Simulacao(MAPA_CLAREIRA); s2.nivelTetoNpc = 12;
for (const n of salvos) s2.carregarNpc(n.id, { ...n.dados, t: Date.now() - 2 * 24 * 3600 * 1000 });
s2.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s2.amigosIa) x.amigaEntrar('andre', false);
const lune = s2.amigosIa.find((x) => x.AMIGA.id === 'lune').amiga, lune0 = salvos.find((n) => n.id === 'lune').dados.prog;
ok(lune.prog.nivel * 1e6 + lune.prog.xp > lune0.nivel * 1e6 + lune0.xp && lune.prog.nivel <= 12, `2 dias fora: Lune subiu devagar (Nv ${lune0.nivel} -> ${lune.prog.nivel})`);
ok(s2.amigosIa.every((x) => !x.amiga || x.amiga.prog.nivel <= 12), 'offline também não passa do teto');
// com chave: conversa, e o aventureiro acompanha quem tem a chave
const s3 = new Simulacao(MAPA_CLAREIRA);
s3.adicionarJogador('sem', 'Sem', 'ruiva', {}); s3.adicionarJogador('com', 'Com', 'ruiva', {});
for (const x of s3.amigosIa) { x.amigaEntrar('sem', false); x.amigaEntrar('com', true); }
const bia = s3.amigosIa.find((x) => x.AMIGA.id === 'bia');
ok(bia.podeAmiga('com') && !bia.podeAmiga('sem') && bia.amigaDono === 'com', 'quem tem chave conversa; quem não tem só vê');
bia.amigaSair('com'); s3.removerJogador('com');
ok(bia.amiga && bia.amigaDono == null, 'quem tinha a chave saiu: ela continua vivendo no mundo');
// no celular: no máximo VISAO.maxBots corpos de NPC (os mais perto), o resto fica só no mapa
{
  const { Visao, VISAO } = await import('../../server/visao.js');
  const s4 = new Simulacao(MAPA_CLAREIRA);
  const eu = s4.adicionarJogador('eu', 'Eu', 'ruiva', {});
  for (const x of s4.amigosIa) x.amigaEntrar('eu', false);
  for (const x of s4.amigosIa) Object.assign(x.amiga, { x: eu.x + Math.random() * 10, z: eu.z + Math.random() * 10 }); // todos juntos na praça
  const v = new Visao(), msg = JSON.parse(v.paraJogador(v.preparar(s4.foto(), []), 'eu'));
  const lista = msg.foto?.jogadores || [];
  const nBots = lista.filter((o) => s4.jogadores.get(o.id)?.bot).length;
  ok(nBots === VISAO.maxBots && lista.some((o) => o.id === 'eu'), `22 NPCs na praça: o celular recebe ${nBots} corpos (máximo ${VISAO.maxBots})`);
}
// André 2026-11-11 (ping de 29 mil): no jogo andam só os aventureiros de NPCS_NO_MUNDO; a lista dos 20 continua guardada
{
  NPCS_NO_MUNDO.aventureiros = ['lia', 'tome', 'ravi', 'bia'];
  const s5 = new Simulacao(MAPA_CLAREIRA);
  const ids = s5.amigosIa.map((x) => x.AMIGA.id);
  ok(ids.length === 6 && ['cecilia', 'dario', 'lia', 'tome', 'ravi', 'bia'].every((id) => ids.includes(id)) && AVENTUREIROS.length === 20, `no mundo só ${ids.join(', ')}; a lista dos 20 fica guardada`);
  NPCS_NO_MUNDO.aventureiros = null;
}
