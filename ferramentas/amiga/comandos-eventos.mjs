// Eventos de verdade dos comandos rápidos do time e da saída sem IA (shared/amiga.js, simulacao.js comandoTime), para as
// fotos de ferramentas/amiga/foto-comandos.gd. Uso: node ferramentas/amiga/comandos-eventos.mjs > eventos.json
const R = new URL('../../', import.meta.url).href;
const { Simulacao, MAPA_CLAREIRA } = await import(R + 'shared/index.js');
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'Ruiva', 'ruiva', { conta: 7 }), ir = s.adicionarJogador('irmao', 'Irmão', 'ruiva', { conta: 8 });
for (const x of s.amigosIa) x.amigaEntrar?.('andre', true); s.passo(0.05);
const ev = [], orig = s.evento.bind(s); s.evento = (e) => { ev.push(e); orig(e); };
const msgs = []; s.aoChatAmiga = (m) => { msgs.push(m); s.receberChat(m); };
const esp = (t) => { for (let i = 0; i < t * 20; i++) s.passo(0.05); };
const [c, d] = ['cecilia', 'dario'].map((k) => s.amigosIa.find((x) => x.AMIGA.id === k));
for (const x of [c, d]) { x.amiga.amigosDe = { [j.conta]: 1 }; x.amiga.x = j.x + 1.5; x.amiga.z = j.z; x.entrarTimeAmiga(x.amiga, j); }
j.time.membros.push(ir.id); ir.time = j.time;
const out = { ids: { cecilia: c.amiga.id, dario: d.amiga.id, irmao: ir.id } };
esp(3);
s.comandoTime('andre', { c: 'espera', para: d.amiga.id }); esp(5);
const e = s.criarInimigo({ tipo: 'puglin', x: j.x + 4, z: j.z, nivel: 1 }); j.bateuEm = { id: e.id, t: s.tempo };
s.comandoTime('andre', { c: 'ataca', para: c.amiga.id }); esp(5);
s.comandoTime('andre', { c: 'segue', para: d.amiga.id }); esp(5);
out.chat = msgs.map((m) => ({ ...m, membros: undefined }));
// o irmão (jogador de verdade) manda um comando para a Ruiva: o que aparece na tela dela
ev.length = 0; s.tempo += 5; s.comandoTime('irmao', { c: 'recua', para: j.id }); out.comando = ev.find((x) => x.t === 'comando');
out.chat2 = msgs.slice(-1).map((m) => ({ ...m, membros: undefined }));
// acabou a IA: os dois se despedem e saem
msgs.length = 0; s.iaAcabouAte = Date.now() + 3600e3; esp(80);
out.tchau = msgs.map((m) => ({ ...m, membros: undefined }));
console.log(JSON.stringify(out));
