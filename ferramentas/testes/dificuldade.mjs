// Balanço da dificuldade (André 2026-11-06): todos os monstros batem juntos, defesa contra nível, drops só Comum/Raro,
// criação até Mítico, nível 200 e o teste de nível só para a conta de teste.
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { COMBATE_INIMIGO, DROPS, RARIDADE_CRIAR, NIVEL_INIMIGO } from '../../shared/dados.js';
import { NIVEL_MAX, xpProximo, reducaoContra } from '../../shared/progresso.js';
const ok = (c, t) => { if (!c) { console.error('FALHOU', t); process.exit(1); } console.log('ok', t); };
ok(COMBATE_INIMIGO.aoMesmoTempo >= 99, 'todos os monstros batem juntos');
ok(Object.values(DROPS).every((d) => d.raridade.slice(2).every((x) => x === 0)), 'monstro só solta Comum ou Rara');
ok(RARIDADE_CRIAR.ate === 4, 'criação chega até Mítico');
ok(NIVEL_MAX === 200 && xpProximo(30) === Math.round(16 * 30 ** 1.45), 'nível 200 e curva igual até o 30');
ok(NIVEL_INIMIGO.forca === 1 && reducaoContra(23, 8, NIVEL_INIMIGO) === 23 / 47, 'dano e defesa iguais ao Quimera (ajuste só depois do teste)');
const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('A', 'André', null, { testador: true });
s.adicionarJogador('B', 'Beto', null, {});
s.nivelTeste('B', 50); ok(s.jogadores.get('B').prog.nivel === 1, 'quem não é de teste não muda o nível');
s.nivelTeste('A', 20); const a = s.jogadores.get('A').prog; ok(a.nivel === 20 && a.pontos === 38, 'teste: nível 20 com 38 pontos');
s.distribuirAtributos('A', { int: 30 }); s.nivelTeste('A', 5); ok(a.atr.int === 3 && a.pontos === 8, 'desceu abaixo do gasto: pontos voltam');
s.distribuirAtributos('A', { des: 4 }); s.nivelTeste('A', 5, true); ok(a.atr.des === 3 && a.pontos === 8, 'zerar pontos de graça');
s.nivelTeste('A', 999); ok(a.nivel === 200, 'não passa do 200');
