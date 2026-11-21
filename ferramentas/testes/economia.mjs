// Economia (André 2026-11-16, estudo em claude.ai/artifact/UWEQY9d7iWXwipr7pdXYKd): menos ouro dos monstros e na venda
// de peça para a Rosa, pack pagando mais (e a área certa em Aurora), loja mais cara (poção sobe com o nível), conserto
// com tabela própria e o livro-caixa que mede o ouro por fonte. Uso: node ferramentas/testes/economia.mjs
import { Simulacao, MAPA_CLAREIRA, LOJA, ITENS, VENDA_EQUIP, VENDA_TOMO, NIVEL_INIMIGO, ECONOMIA, PACK_REGRAS, PAGINA_PRECO, RESET_BUILD, MORTE, precoLoja, resumoCaixa, faixaCaixa } from '../../shared/index.js';
import { custoConserto } from '../../shared/progresso.js';
import { precoPack, fatorArea } from '../../shared/transporte.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

// números da tabela aprovada
ok(ECONOMIA.ouroMonstro === 0 && ECONOMIA.ouroBoss === 0, 'monstro e chefe não dão ouro (André 2026-11-17, remoção aprovada)');
ok(VENDA_EQUIP.join() === '6,25,250,700,2000' && VENDA_TOMO === 15, 'Rosa paga o mesmo de antes (6 e 25 por Comum e Rara); Tomo 15 x nível');
ok(PACK_REGRAS.k === 2.88 && PACK_REGRAS.areas.forte === 250, 'pack: multiplicador 2,88 (+20%) e área do campo mais forte a 250 m');
ok(PAGINA_PRECO.join() === '0,1000,5000,15000' && RESET_BUILD.porNivel === 30, 'páginas e reset mais caros');
const pocao = LOJA.find((o) => o.k === 'pocao'), mana = LOJA.find((o) => o.k === 'pocao_mana');
ok(precoLoja(pocao, 10) === 40 && precoLoja(pocao, 50) === 120 && precoLoja(mana, 10) === 48, 'poção sobe com o nível (Nv 10: 40 e 48)');
ok(LOJA.filter((o) => o.r === 0).every((o) => o.preco === 150) && LOJA.filter((o) => o.r === 1).every((o) => o.preco === 900), 'peça Comum 150, Rara 900');
ok(LOJA.some((o) => o.k === 'lenha' && o.preco === 200) && LOJA.some((o) => o.k === 'pedra' && o.preco === 300) && LOJA.some((o) => o.k === 'semente_cenoura'), 'lenha a 200 e pedra a 300, sementes continuam (material de pack)');
ok(ECONOMIA.semente === 2.5 && LOJA.filter((o) => o.k.startsWith('semente_')).every((o) => o.preco >= 2), 'sementes 2,5x mais caras');
ok(MORTE.consertoTabela.join() === '100,800,4000,16000,60000' && custoConserto({ k: 'peitoral', r: 1, d: 0 }) === 800 && custoConserto({ k: 'peitoral', r: 1, d: 90 }) === 80, 'conserto pesa pela raridade (André 2026-11-18, o dobro: Comum 100, Rara 800, Épico 4.000)');

// pack: Aurora deixa de pagar área 1
const M = Object.fromEntries(MAPA_CLAREIRA.npcs.filter((n) => n.funcao === 'pack').map((n) => [n.id, n]));
ok(fatorArea(M.m_brasa.x, M.m_brasa.z) > 1 && fatorArea(M.m_ervas.x, M.m_ervas.z) > 1, 'mercadores de Aurora pagam a área de lá');
const br = M.m_couro, pd = M.m_pedra;
ok(precoPack({ k: 'couro', ox: br.x, oz: br.z }, pd) > 1500, 'pack de couro do Bráulio ao Pedrão passa de 1.500');

// simulação: loja cobra pelo nível, ouro do monstro menor e o livro-caixa anota
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('C', 'Cris', null, { conta: 'cris' });
j.criando = false; j.morto = false;
const p = j.prog; p.nivel = 10; p.ouro = 1000; p.mochila = p.mochila.map(() => null);
const rosa = MAPA_CLAREIRA.npcs.find((n) => n.funcao === 'loja'); j.x = rosa.x + 1; j.z = rosa.z;
s.item('C', { acao: 'comprar', i: LOJA.indexOf(pocao), n: 2 });
ok(p.ouro === 1000 - 2 * s.precoCompra(j, pocao) && s.precoCompra(j, pocao) === 40, 'Rosa cobra 40 pela poção no Nv 10');
const e = s.criarInimigo({ tipo: 'puglin', x: j.x, z: j.z, nivel: 10 });
const antes = p.ouro; s.soltarDrops(e, j);
const ganhou = p.ouro - antes;
ok(ganhou === 0, 'Puglin não dá ouro');
p.ouro += 77; // ouro que muda por fora do caixa() vira "outros" na conferência
s.passoCaixa(10);
const r = resumoCaixa(s.livro), dia = Object.keys(r)[0], f = r[dia]?.gente?.[faixaCaixa(10)];
ok(f && f.saidas.lojaPocao === 80 && !f.entradas.monstro && f.entradas.outros === 77 && f.abates === 1 && f.jogadores === 1, 'livro-caixa: loja, monstro, outros e abates');
ok(f.guardadoMedio === p.ouro, 'livro-caixa: tempo de jogo e ouro guardado médio');
s.passoCaixa(10);
ok(resumoCaixa(s.livro)[dia].gente[faixaCaixa(10)].entradas.outros === 77, 'nada contado duas vezes');
const r2 = new Simulacao(MAPA_CLAREIRA), rb = r2.adicionarJogador('R', 'Robô', null, { conta: 'robo:testes', robo: true });
rb.criando = false; r2.caixa(rb, 'monstro', 5);
ok(Object.keys(resumoCaixa(r2.livro)[dia]).join() === 'robo', 'robô conta à parte');
ok(!JSON.stringify(resumoCaixa(s.livro)).includes('cris'), 'a página não mostra conta de ninguém');
