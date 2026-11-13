// Balanço da dificuldade (André 2026-11-06): todos os monstros batem juntos, defesa contra nível, drops só Comum/Raro,
// criação até Mítico, nível 200 e o teste de nível só para a conta de teste.
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { COMBATE_INIMIGO, DROPS, RARIDADE_CRIAR, NIVEL_INIMIGO, CONTA_TESTE, MOCHILA } from '../../shared/dados.js';
import { NIVEL_MAX, xpProximo, reducaoContra } from '../../shared/progresso.js';
const ok = (c, t) => { if (!c) { console.error('FALHOU', t); process.exit(1); } console.log('ok', t); };
ok(COMBATE_INIMIGO.aoMesmoTempo >= 99, 'todos os monstros batem juntos');
ok(Object.values(DROPS).every((d) => d.raridade.slice(2).every((x) => x === 0)), 'monstro só solta Comum ou Rara');
ok(RARIDADE_CRIAR.ate === 4, 'criação chega até Mítico');
// curva de XP (André 2026-11-11, XP_ESCALA): igual à antiga até o Nv10 e mais lenta depois
ok(NIVEL_MAX >= 9999 && xpProximo(10) === Math.round(16 * 10 ** 1.45), 'sem limite de nível e curva igual até o 10');
ok(xpProximo(30) === Math.round(16 * 30 ** 1.45 * (1 + 20 / 50)), 'depois do 10 cada nível pede mais (XP_ESCALA)');
ok(reducaoContra(23, 8, NIVEL_INIMIGO) < reducaoContra(23, 1, NIVEL_INIMIGO), 'a defesa segura menos contra bicho de nível alto');
const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('A', 'André', null, { testador: true });
s.adicionarJogador('B', 'Beto', null, {});
s.nivelTeste('B', 50); ok(s.jogadores.get('B').prog.nivel === 1, 'quem não é de teste não muda o nível');
// André 2026-11-11: "quero ser um player normal" — atalhos desligados (o código fica, CONTA_TESTE)
ok(!CONTA_TESTE.nivel && !CONTA_TESTE.paginas, 'atalhos de teste desligados');
s.nivelTeste('A', 20); ok(s.jogadores.get('A').prog.nivel === 1, 'conta do André não muda mais o nível');
ok(s.jogadores.get('A').prog.paginas === 1, 'conta do André começa com 1 página, como todo mundo');
{ // quem já tinha as 4 de graça: volta para 1 página, itens de trás vão para a frente, nada some; só uma vez
  const mo = Array(MOCHILA * 4).fill(null); mo[0] = { k: 'pocao', n: 3 }; mo[MOCHILA * 2 + 5] = { k: 'pocao_mana', n: 2 };
  const s2 = new Simulacao(MAPA_CLAREIRA); s2.adicionarJogador('A', 'André', null, { testador: true, progresso: { nivel: 3, mochila: mo, paginas: 4 } });
  const p2 = s2.jogadores.get('A').prog;
  ok(p2.paginas === 1 && p2.mochila.length === MOCHILA && p2.mochila.filter(Boolean).length === 2 && p2.devPag === CONTA_TESTE.devolver, 'páginas de graça devolvidas sem perder item');
  const cheia = Array(MOCHILA * 4).fill(null).map((_, i) => (i < 50 ? { k: 'pocao', n: 1 } : null));
  const s3 = new Simulacao(MAPA_CLAREIRA); s3.adicionarJogador('A', 'André', null, { testador: true, progresso: { nivel: 3, mochila: cheia, paginas: 4 } });
  ok(s3.jogadores.get('A').prog.paginas === 2 && s3.jogadores.get('A').prog.mochila.filter(Boolean).length === 50, 'não cabe em 1 página: fica com 2, nada some');
  const comprada = { ...p2, paginas: 3, mochila: [...p2.mochila, ...Array(MOCHILA * 2).fill(null)] };
  const s4 = new Simulacao(MAPA_CLAREIRA); s4.adicionarJogador('A', 'André', null, { testador: true, progresso: comprada });
  ok(s4.jogadores.get('A').prog.paginas === 3, 'página comprada depois não é tirada de novo');
}
CONTA_TESTE.nivel = true; // se o André pedir de volta, liga e funciona como antes
s.nivelTeste('A', 20); const a = s.jogadores.get('A').prog; ok(a.nivel === 20 && a.pontos === 38, 'teste: nível 20 com 38 pontos');
s.distribuirAtributos('A', { int: 30 }); s.nivelTeste('A', 5); ok(a.atr.int === 3 && a.pontos === 8, 'desceu abaixo do gasto: pontos voltam');
s.distribuirAtributos('A', { des: 4 }); s.nivelTeste('A', 5, true); ok(a.atr.des === 3 && a.pontos === 8, 'zerar pontos de graça');
s.nivelTeste('A', 250); ok(a.nivel === 250, 'passa do 200 (sem limite de nível)');
CONTA_TESTE.nivel = false;
// André 2026-11-09: quanto mais acima do bicho, menos XP, sem parar no piso
import { xpNivel } from '../../shared/progresso.js';
ok(xpNivel(110, 117, NIVEL_INIMIGO) === NIVEL_INIMIGO.xpMin && xpNivel(110, 130, NIVEL_INIMIGO) < xpNivel(110, 120, NIVEL_INIMIGO) && xpNivel(110, 120, NIVEL_INIMIGO) < xpNivel(110, 117, NIVEL_INIMIGO), 'XP cai cada vez mais acima do bicho');
ok(xpNivel(10, 10, NIVEL_INIMIGO) === 1 && xpNivel(10, 13, NIVEL_INIMIGO) === 0.8, 'perto do nível do bicho fica igual a antes');

// Caverna (André 2026-11-06): monstros de grupo e só quem abre o selo paga o passe; o time entra de graça
import { CAVERNA_DUNGEON, statusInimigo } from '../../shared/dados.js';
import { CAVERNA } from '../../shared/caverna.js';
import { pontoDoTunel } from '../../shared/caverna.js';
const c = new Simulacao(MAPA_CLAREIRA);
const A = c.adicionarJogador('A', 'Ana'), B = c.adicionarJogador('B', 'Beto'), C = c.adicionarJogador('C', 'Caio');
const g = c.criarInimigo({ tipo: 'golem', x: 0, z: 0, nivel: 18, caverna: 'sala1' }), base = statusInimigo('golem', 18);
ok(g.vidaMax === Math.round(base.vida * CAVERNA_DUNGEON.forte.vida) && g.dano === Math.round(base.dano * CAVERNA_DUNGEON.forte.dano), 'monstro da caverna é de grupo');
const T = { lider: 'A', membros: ['A', 'B'] }; A.time = T; B.time = T; A.caverna = { desde: 0 };
const p = pontoDoTunel(CAVERNA.porta - 2);
for (const j of [B, C]) { j.x = p.x; j.y = p.y; j.z = p.z; }
c.item('B', { acao: 'usar_passe' }); ok(!!B.caverna, 'do time de quem abriu: entra sem passe');
c.item('C', { acao: 'usar_passe' }); ok(!C.caverna, 'fora do time: precisa do passe');

// Recarga da poção (POCAO_RECARGA)
import { POCAO_RECARGA } from '../../shared/dados.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const q = new Simulacao(MAPA_CLAREIRA), P = q.adicionarJogador('P', 'Pia');
P.prog.mochila[0] = { k: 'pocao', n: 5 }; P.vida = 10; q.item('P', { acao: 'usar', i: 0 }); const v1 = P.vida;
q.item('P', { acao: 'usar', i: 0 }); ok(P.vida === v1 && P.prog.mochila[0].n === 4, 'poção seguida espera a recarga');
for (let t = 0; t < POCAO_RECARGA + 0.2; t += 0.1) q.passo(0.1);
P.vida = 10; q.item('P', { acao: 'usar', i: 0 }); ok(P.vida > 10 && P.prog.mochila[0].n === 3, 'depois da recarga toma de novo');
