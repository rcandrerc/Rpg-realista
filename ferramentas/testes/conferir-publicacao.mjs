// Robô diário da publicação (ferramentas/atualizacao/conferir-publicacao.mjs): as contas de prazo e do cardápio.
import { partesDoCardapio, mesmoJson, proximoDisparo, atrasados, prazoInstalar } from '../atualizacao/conferir-publicacao.mjs';

let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? 'ok' : 'FALHOU'} ${nome}`); if (!cond) falhas++; };
const t = (s) => Date.parse(s);
const h = 3600e3;
delete process.env.JANELA_LIVRE;

const cardapio = {
  completo: { id: '2720', partes: [{ arq: 'completo-2720.parte00', tamanho: 10 }, { arq: 'completo-2720.parte01', tamanho: 5 }] },
  deltas: [{ versao: '2722', arq: 'delta-2722.pck', tamanho: 3 }],
  ponte: { completo: '2714', para: '2720', deltas: [{ versao: '2720', arq: 'delta-2720.pck', tamanho: 7 }, { versao: '2722', arq: 'delta-2722.pck', tamanho: 3 }] },
};
ok(partesDoCardapio(cardapio).map((p) => p.arq).join() === 'completo-2720.parte00,completo-2720.parte01,delta-2722.pck,delta-2720.pck', 'pedaços: completo, deltas e ponte, sem repetir');
ok(partesDoCardapio({}).length === 0 && partesDoCardapio(null).length === 0, 'cardápio vazio não quebra');
ok(mesmoJson({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 }), 'mesmo cardápio com chaves em outra ordem');
ok(!mesmoJson({ versao: '2738' }, { versao: '2739' }), 'versão diferente acusa');

ok(proximoDisparo(t('2026-11-25T09:10:00-03:00')) === t('2026-11-25T13:40:00-03:00'), 'merge às 09:10: sai no disparo das 13:40');
ok(proximoDisparo(t('2026-11-25T14:00:00-03:00')) === t('2026-11-26T04:40:00-03:00'), 'merge às 14:00: sai às 04:40 do dia seguinte');
ok(proximoDisparo(t('2026-12-22T09:00:00-03:00')) === t('2026-12-23T04:40:00-03:00'), '1ª semana do lançamento: só o das 04:40');

const as9 = t('2026-11-25T09:00:00-03:00');
const cliente = { sha: 'a'.repeat(40), quando: as9, arquivos: ['client/src/x.js'] };
ok(atrasados([cliente], as9 + 1 * h).length === 0, 'cliente publicado há 1 h: no prazo');
ok(atrasados([cliente], as9 + 2.5 * h).length === 1, 'cliente sem sair há 2,5 h: site parado');
const shared = { sha: 'b'.repeat(40), quando: as9, arquivos: ['shared/dados.js'] };
ok(atrasados([shared], t('2026-11-25T15:00:00-03:00')).length === 0, 'shared/ às 09h, 15:00: ainda na folga do disparo das 13:40');
ok(atrasados([shared], t('2026-11-25T15:20:00-03:00')).length === 1, 'shared/ às 09h, 15:20: disparo das 13:40 não publicou');
ok(atrasados([{ ...cliente, arquivos: ['LEIAME.md'] }], as9 + 48 * h).length === 0, 'só .md não publica nada: não acusa');
const antes = { sha: 'c'.repeat(40), quando: as9 - 1 * h, arquivos: ['server/index.js'] };
const fora = atrasados([antes, shared], as9 + 1.5 * h);
ok(fora.length === 1 && fora[0].sha === antes.sha, 'merge sem shared/ que devia ter saído antes do shared/: acusa só ele');
ok(atrasados([shared, { ...cliente, quando: as9 + 1 * h }], as9 + 3 * h).length === 0, 'cliente depois de shared/ espera o disparo junto: no prazo');

ok(prazoInstalar(t('2026-11-25T09:00:00-03:00')) === t('2026-11-25T14:30:00-03:00'), 'pacote às 09h: instala às 14h (prazo 14:30)');
ok(prazoInstalar(t('2026-11-25T14:20:00-03:00')) === t('2026-11-25T14:55:00-03:00'), 'pacote às 14:20: instala na janela aberta (prazo 14:55)');
ok(prazoInstalar(t('2026-11-25T09:00:00-03:00'), true) === t('2026-11-25T09:35:00-03:00'), 'urgente: instala na hora');
ok(prazoInstalar(t('2026-12-22T09:00:00-03:00')) === t('2026-12-23T05:30:00-03:00'), '1ª semana do lançamento: só às 05h');

if (falhas) { console.log(`${falhas} falha(s)`); process.exit(1); }
console.log('conferir publicação: tudo certo');
