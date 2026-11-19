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
// IA ligada de novo (André 2026-11-19: "pode deixar aberta a chave pra todos"): todo jogador, só Cecília e Dario
{
  const { IA_CONVERSA } = await import('../../shared/index.js');
  ok(IA_CONVERSA.ligada === true && IA_CONVERSA.quem.join() === 'cecilia,dario', 'IA ligada só na Cecília e no Dario');
  const c = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'); c.iaPorChave = true;
  ok(c.iaAmiga('andre'), 'sem chave própria, a resposta vem da IA do servidor');
  const g = s.amigosIa.find((x) => x.AMIGA.rival && x.amiga);
  ok(!g || !g.iaAmiga('andre'), 'a Geada não tem IA');
}
// a fala da IA leva a marca de qual IA respondeu (André 2026-11-19: a ronda das 9h ajusta o Gemini primeiro)
{
  const c = s.amigosIa.find((x) => x.AMIGA.id === 'dario'), a = c.amiga, hoje = () => Object.values(a.registro).at(-1)[j.conta];
  a.ia.fonte = { ia: 'gemini-3.5-flash-lite', t: c.tempo }; c.registrarAmiga(a, j.conta, 'ela', 'resposta da IA');
  c.registrarAmiga(a, j.conta, 'ela', 'fala pronta');
  ok(hoje().at(-2).ia === 'gemini-3.5-flash-lite' && !hoje().at(-1).ia, 'o registro marca qual IA respondeu (e só aquela fala)');
}
