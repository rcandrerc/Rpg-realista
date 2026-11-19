// Janela de instalação do servidor (plano de lançamento v3): 05h–07h e 14h–15h de Brasília; 1ª semana do lançamento só
// 05h–07h; 19/12 18h a 20/12 02h nada instala. Testa podeInstalar (server/atualizar.js).
import { podeInstalar } from '../../server/atualizar.js';

let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? 'ok' : 'FALHOU'} ${nome}`); if (!cond) falhas++; };
const t = (s) => Date.parse(s);
delete process.env.JANELA_LIVRE;
ok(podeInstalar(t('2026-11-25T05:00:00-03:00')), '05h00 instala');
ok(podeInstalar(t('2026-11-25T06:59:00-03:00')), '06h59 instala');
ok(!podeInstalar(t('2026-11-25T07:00:00-03:00')), '07h00 não instala');
ok(podeInstalar(t('2026-11-25T14:30:00-03:00')), '14h30 instala');
ok(!podeInstalar(t('2026-11-25T15:00:00-03:00')), '15h00 não instala');
ok(!podeInstalar(t('2026-11-25T09:10:00-03:00')), '09h10 (ronda) espera');
ok(!podeInstalar(t('2026-11-25T04:59:00-03:00')), '04h59 espera');
ok(podeInstalar(t('2026-11-25T21:00:00-03:00'), true), 'urgente instala fora da janela');
ok(!podeInstalar(t('2026-12-22T14:30:00-03:00')), '1ª semana do lançamento: 14h não instala');
ok(podeInstalar(t('2026-12-22T05:30:00-03:00')), '1ª semana do lançamento: 05h30 instala');
ok(podeInstalar(t('2026-12-27T14:30:00-03:00')), 'depois da 1ª semana: 14h volta');
ok(!podeInstalar(t('2026-12-19T19:00:00-03:00'), true), 'lançamento 19/12 19h: nem urgente');
ok(!podeInstalar(t('2026-12-20T01:59:00-03:00'), true), '20/12 01h59: nem urgente');
ok(podeInstalar(t('2026-12-20T02:00:00-03:00'), true), '20/12 02h00: urgente volta');
ok(podeInstalar(t('2026-12-19T14:30:00-03:00')), '19/12 14h30 (antes do bloqueio) instala');
ok(podeInstalar(t('2026-12-19T19:00:00-03:00'), false, true), '[furar bloqueio] instala no lançamento');
process.env.JANELA_LIVRE = '1';
ok(podeInstalar(t('2026-11-25T09:10:00-03:00')), 'JANELA_LIVRE=1 (teste local) instala sempre');
if (falhas) { console.log(`${falhas} falha(s)`); process.exit(1); }
console.log('janela do servidor: tudo certo');
