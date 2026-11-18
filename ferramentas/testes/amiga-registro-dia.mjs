// André 2026-11-18: a ronda lê a conversa do dia inteiro com o Dário e a Cecília (antes só as últimas 40 falas). Sem rede.
// Uso: node ferramentas/testes/amiga-registro-dia.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
for (const id of ['cecilia', 'dario']) {
  const c = s.amigosIa.find((x) => x.AMIGA.id === id); if (!c?.amiga) { ok(false, `${id} na sala`); continue; }
  const a = c.amiga;
  for (let i = 0; i < 60; i++) { c.ouvirAmiga('andre', `oi ${i}`); c.registrarAmiga(a, j.conta, 'ela', `resposta ${i}`); }
  const dias = Object.keys(a.registro || {}), l = a.registro[dias[0]]?.[j.conta] || [];
  ok(dias.length === 1 && l.length === 120 && l[0].texto === 'oi 0' && /^\d\d:\d\d$/.test(l[0].h), `${id}: guarda as 120 falas do dia com a hora`);
  ok(c.chatDeAmiga(j).length <= c.histAmiga(), `${id}: o fio da IA continua curto`);
  a.registro['2020-01-01'] = { [j.conta]: [{ de: 'ele', texto: 'velho' }] }; c.registrarAmiga(a, j.conta, 'ele', 'novo');
  ok(!a.registro['2020-01-01'], `${id}: dia velho sai (fica só hoje e ontem)`);
}
// IA desligada (André 2026-11-18): todos respondem pelo repertório pronto e a lista não mostra o botão de ativar chave
{
  const { IA_CONVERSA } = await import('../../shared/index.js');
  ok(IA_CONVERSA.ligada === false, 'IA das conversas desligada no jogo');
  const c = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'); c.iaPorChave = true; (c.amigaFalam ||= new Set()).add('andre');
  ok(!c.iaAmiga('andre'), 'mesmo com chave, a resposta vem do repertório pronto');
}
