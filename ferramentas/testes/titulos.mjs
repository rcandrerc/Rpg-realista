// Teste dos títulos (André 2026-11-12): ganha pelo feito, usa um por vez, bônus só em uso e o servidor confere.
// Uso: node ferramentas/testes/titulos.mjs
import { Simulacao, MAPA_CLAREIRA, TITULOS, HISTORIA } from '../../shared/index.js';
import { progressoValido, calcularStatus, profPontos } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', null, { conta: 1 });
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
ok(a.prog.tit.tem.length === 0 && a.prog.tit.uso === '', 'conta nova sem título');
// não dá para usar título que não ganhou
s.item('A', { acao: 'titulo', id: 'rei_matilha' });
ok(a.prog.tit.uso === '', 'não usa título que não ganhou');
// caça: 100 monstros
a.prog.abates = 99;
s.titulosDaVitoria(a, { tipo: 'lobo' });
ok(a.prog.tit.tem.includes('cacador_novato') && avisos().some((t) => t.startsWith('Título novo: Caçador Novato')), 'ganha Caçador Novato no 100º monstro');
// boss de mundo
s.titulosDaVitoria(a, { tipo: 'lobo', bm: 'uivo_rei' });
ok(a.prog.tit.tem.includes('rei_matilha'), 'venceu o Uivo-Rei: Rei da Matilha');
// bônus só em uso
const critAntes = a.st.critico;
s.item('A', { acao: 'titulo', id: 'rei_matilha' });
ok(a.prog.tit.uso === 'rei_matilha' && Math.abs(a.st.critico - critAntes - 0.05) < 1e-9, 'em uso: +5% crítico');
const f = s.foto().jogadores.find((j) => j.id === 'A');
ok(f.tit === 'rei_matilha', 'os outros veem o título em uso');
s.item('A', { acao: 'titulo', id: '' });
ok(a.prog.tit.uso === '' && Math.abs(a.st.critico - critAntes) < 1e-9 && s.foto().jogadores.find((j) => j.id === 'A').tit === null, 'tirou: bônus some');
// profissão Nv 10
s.pontosProf(a, 'min', profPontos(10));
ok(a.prog.tit.tem.includes('min10'), 'Minerador Nv 10 dá o título');
// história: ato entregue (aviso só o que já existia)
const i = HISTORIA.findIndex((M) => M.id === 'b11');
a.prog.hist.p = i + 1; s.conferirTitulos(a, false, true);
ok(a.prog.tit.tem.includes('sentinela_ordem'), 'Ato II entregue: Sentinela da Ordem');
// conta salva e volta igual; lixo do cliente não passa
const p2 = progressoValido(JSON.parse(JSON.stringify({ ...a.prog, tit: { tem: [...a.prog.tit.tem, 'falso'], uso: 'falso' } })));
ok(p2.tit.tem.length === a.prog.tit.tem.length && p2.tit.uso === '' && p2.abates === 101, 'conta: guarda os ganhos e recusa título falso');
// vida e dano
p2.tit.uso = 'estrela_aethra'; p2.tit.tem.push('estrela_aethra');
const sem = calcularStatus({ ...p2, tit: { tem: [], uso: '' } }), com = calcularStatus(p2);
ok(com.vidaMax > sem.vidaMax && com.danoFisico > sem.danoFisico, 'Estrela de Aethra: + vida e + dano');
ok(Object.values(TITULOS).every((t) => t.nome && t.como && t.txt && t.r >= 0 && t.r <= 4), 'todo título tem nome, feito, bônus e brilho');
console.log(avisos().join('\n'));
