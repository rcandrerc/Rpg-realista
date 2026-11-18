// Conversa de exemplo com o repertório único (para ferramentas/amiga/foto-repertorio.gd). Uso: node ferramentas/amiga/conversa-repertorio.mjs > conv.json
const R = new URL('../../', import.meta.url).href;
const { Simulacao, MAPA_CLAREIRA, AMIGOS_VIRTUAIS } = await import(R + 'shared/index.js');
const s = new Simulacao(MAPA_CLAREIRA); const j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
const out = {}; let hora = Date.now() - 600000;
for (const id of ['cecilia', 'dario']) {
  const c = s.amigosIa.find((x) => x.AMIGA.id === id), D = c.AMIGA; c.amiga.amigosDe = { [j.conta]: 1 };
  const l = (out[id] = { c: D.conta, nome: D.nome, msgs: [] });
  for (const t of ['oi', 'tudo bem?', 'tá fazendo o que?', 'vc é muito brabo kkk', 'tô cansado do trabalho', 'te amo kkk', 'flw']) {
    l.msgs.push({ canal: 'pm', c: 'c7', nome: 'André', texto: t, hora: hora += 20000, alvo: D.conta, alvoNome: D.nome, meu: true });
    c.amiga.ia.chatFila = []; c.ouvirAmiga('andre', t); c.respostaAmiga('andre', { assunto: c.assuntoAmiga(t) });
    for (const f of c.amiga.ia.chatFila) l.msgs.push({ canal: 'pm', c: D.conta, nome: D.nome, texto: f.texto, hora: hora += 15000, alvo: 'c7', alvoNome: 'André' });
  }
}
console.log(JSON.stringify(out));
