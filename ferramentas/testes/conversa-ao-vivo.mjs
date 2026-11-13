// Conversa AO VIVO com a IA dos NPCs (André 2026-11-13: "eles estão respondendo coisa sem lógica").
// Passa pelo mesmo caminho do servidor (pensarAmiga + regras de server/index.js falarComAmigoIa) e mostra quem respondeu:
// a IA (qual modelo) ou as falas prontas. Precisa de rede e de uma chave Groq em GROQ_CHAVE.
// Uso: GROQ_CHAVE=gsk_... node ferramentas/testes/conversa-ao-vivo.mjs [cecilia|dario] [time]
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
const { pensarAmiga } = await import('../../server/ia-amiga.js');
const chave = process.env.GROQ_CHAVE; if (!chave) { console.error('falta GROQ_CHAVE'); process.exit(1); }
const quem = process.argv[2] || 'cecilia', noTime = process.argv.includes('time');
// registra cada chamada ao Groq (modelo, status, tempo) sem mudar nada
const real = globalThis.fetch, log = [];
globalThis.fetch = async (url, op) => {
  const b = JSON.parse(op.body), t0 = Date.now(); const r = await real(url, op);
  log.push({ modelo: b.model, status: r.status, ms: Date.now() - t0, tam: b.messages.map((m) => m.content).join('').length });
  if (r.status === 400 && process.env.VER400) console.log('   400:', (await r.clone().text()).slice(0, 400));
  return r;
};
const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
const amg = s.amigosIa.find((x) => x.AMIGA.id === quem);
s.passo(0.05);
if (noTime) { amg.amiga.time = 'tz'; s.jogadores.get('andre').time = 'tz'; }
const frases = (process.env.FRASES || 'e aí, beleza?|o que você tá pensando em fazer hoje?|pô, tu tá forte hoje, hein|tô com equipamento legal, bora caçar monstro?|o que você acha dessa vila?|ontem foi tenso aquela caçada né|e você, tá precisando de alguma coisa?|haha você é engraçada').split('|');
for (const f of frases) {
  log.length = 0;
  const ctx = amg.contextoAmiga('andre'); amg.ouvirAmiga('andre', f);
  const t0 = Date.now(); const r = await pensarAmiga(ctx, f, chave); const ms = Date.now() - t0;
  // o mesmo que server/index.js faz depois
  const regra = amg.assuntoAmiga(f);
  let acao = ['time', 'sairTime', 'vir', 'pescar', 'minerar', 'lenha', 'pararAtividade', 'naoAcao'].includes(regra) ? regra : r?.assunto === 'conversa' && ['sim', 'nao'].includes(regra) ? regra : r?.assunto;
  if (r && acao === regra && regra !== r.assunto && !amg.regraValeSobreIaAmiga('andre', regra, f, r.assunto)) acao = amg.acaoSemEfeitoAmiga('andre', r.assunto) ? 'conversa' : r.assunto;
  if (r && acao === r.assunto && amg.acaoSemEfeitoAmiga('andre', acao)) acao = 'conversa';
  const fila0 = (amg.amiga.ia.chatFila || []).length;
  if (['presente', 'pedirItem'].includes(regra)) amg.respostaAmiga('andre', { assunto: regra });
  else amg.respostaAmiga('andre', r ? { assunto: acao, fala: acao === r.assunto || acao === 'conversa' || r.assunto === 'conversa' ? r.fala : '' } : { assunto: regra });
  const fila = amg.amiga.ia.chatFila || [], resp = fila.slice(fila0).map((e) => e.texto).join(' / ');
  const veio = r ? (resp === r.fala ? 'IA' : 'IA trocada pelas regras') : 'FALA PRONTA';
  console.log(`\nAndré: ${f}\n${amg.AMIGA.nome}: ${resp}\n   [${veio}; ia="${r?.fala || ''}" ação ${r?.assunto || '-'} regra ${regra}; ${ms} ms; ${log.map((l) => `${l.modelo} ${l.status} ${l.ms}ms ${l.tam}c`).join(' | ')}]`);
  // a fala vai para o histórico como no jogo
  s.tempo += 30; amg.passoChatAmiga(amg.amiga);
  await new Promise((ok) => setTimeout(ok, Number(process.env.PAUSA || 8) * 1000)); // como gente digitando (e o limite por minuto do Groq)
}
