// Cliente espera a janela quando shared/ muda (ferramentas/atualizacao/janela-publicar.mjs).
import { decide } from '../atualizacao/janela-publicar.mjs';

let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? 'ok' : 'FALHOU'} ${nome}`); if (!cond) falhas++; };
const t = (s) => Date.parse(s);
delete process.env.JANELA_LIVRE;
const as9 = t('2026-11-25T09:10:00-03:00');
ok(decide({ evento: 'push', mudou: ['godot-prototipo/ui.gd'], agora: as9 }).publicar, 'sem shared/: publica na hora');
ok(!decide({ evento: 'push', mudou: ['shared/dados.js'], agora: as9 }).publicar, 'shared/ às 09h: espera');
ok(!decide({ evento: 'push', mudou: null, agora: as9 }).publicar, 'não sabe o que mudou: espera');
ok(decide({ evento: 'push', mudou: [], agora: as9 }).publicar, 'nada mudou: publica');
ok(decide({ evento: 'schedule', mudou: ['shared/dados.js'], agora: t('2026-11-25T04:40:00-03:00') }).publicar, 'agendado 04:40: publica');
ok(decide({ evento: 'schedule', mudou: ['shared/dados.js'], agora: t('2026-11-25T13:40:00-03:00') }).publicar, 'agendado 13:40: publica');
ok(decide({ evento: 'schedule', mudou: ['shared/dados.js'], agora: t('2026-11-25T05:20:00-03:00') }).publicar, 'agendado atrasado (05:20): publica');
ok(!decide({ evento: 'schedule', mudou: ['shared/dados.js'], agora: t('2026-12-22T13:40:00-03:00') }).publicar, '1ª semana do lançamento, 13:40: espera');
ok(!decide({ evento: 'schedule', mudou: ['shared/dados.js'], agora: t('2026-12-20T00:40:00-03:00') }).publicar, 'bloqueio do lançamento: espera');
ok(decide({ evento: 'push', mensagem: 'Merge pull request #9\n\nPreço [servidor urgente]', mudou: ['shared/dados.js'], agora: as9 }).publicar, '[servidor urgente] com shared/ às 09h: publica na hora');
ok(decide({ evento: 'workflow_dispatch', forcar: true, mudou: ['shared/dados.js'], agora: as9 }).publicar, 'publicar agora (à mão): publica');
ok(decide({ evento: 'push', mensagem: 'Conserto [furar bloqueio]', mudou: ['shared/dados.js'], agora: t('2026-12-19T20:30:00-03:00') }).publicar, '[furar bloqueio]: publica');
ok(!decide({ evento: 'workflow_dispatch', mudou: ['shared/simulacao.js'], agora: as9 }).publicar, 'pages.yml chamado pelo apk.yml com shared/: espera');
ok(!decide({ evento: 'schedule', mudou: [], agora: t('2026-11-25T04:40:00-03:00') }).publicar, 'agendado sem nada esperando: não republica');
ok(!decide({ evento: 'schedule', mudou: ['client/x.js'], agora: t('2026-11-25T04:40:00-03:00') }).publicar, 'agendado só com cliente (já no ar): não republica');
if (falhas) { console.log(`${falhas} falha(s)`); process.exit(1); }
console.log('janela de publicar: tudo certo');
