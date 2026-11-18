// Achados da ronda de 2026-11-18 (chat do André com a Cecília): "Bora caçar de novo?" duas vezes seguidas (o servidor
// reiniciou e ela esqueceu a última chamada) e "Vem comigo, sei onde tem bicho bom" repetido tocando Seguir.
// Sem rede. Uso: node ferramentas/testes/cecilia-ronda-1118.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
const c = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), a = c.amiga;
ok(c.ultimaFalaAmiga(j) === '' || typeof c.ultimaFalaAmiga(j) === 'string', 'ultimaFalaAmiga responde');
// 1) depois de reiniciar (ia.ultimaChama vazio), a última fala salva conta: não repete a chamada
{
  const G = c.AMIGA.chat.falas.chamaGosto.time;
  c.chatDeAmiga(j).push({ de: 'ela', texto: G });
  let repetiu = 0;
  for (let k = 0; k < 40; k++) {
    a.ia.ultimaChama = null; a.ia.espera = {}; a.ia.chamaEm = 0; a.ia.chamado = null; a.time = null; a.morto = false;
    c.gostoTopoAmiga = () => 'time'; c.ehAmigoAmiga = () => true; c.puxarAssuntoAmiga = () => false;
    j.x = a.x + 300; j.z = a.z; s.tempo += 1;
    const antes = c.chatDeAmiga(j).length;
    c.passoChatAmiga(a);
    for (const m of a.ia.chatFila || []) if (m.texto === G) repetiu++;
    a.ia.chatFila = []; c.chatDeAmiga(j).length = antes;
  }
  ok(repetiu === 0, `depois de reiniciar não repete "${G}" (${repetiu} vezes)`);
}
// 2) Seguir de novo: outra frase de campo
{
  const F = c.AMIGA.falasLeva.campo;
  c.campoAmiga = () => ({ nome: 'Clareira dos Puglins', x: a.x + 30, z: a.z });
  a.time = 'T1'; j.time = 'T1'; j.x = a.x + 1; j.z = a.z; c.trocarDonoAmiga = () => true;
  let iguais = 0;
  for (let k = 0; k < 20; k++) {
    a.ia.seguido = null; a.ia.chatFila = [];
    const ult = F[k % F.length].replace('{lugar}', 'Clareira dos Puglins');
    c.chatDeAmiga(j).push({ de: 'ela', texto: ult });
    c.seguirAmiga('andre', true);
    if ((a.ia.chatFila || []).some((m) => m.texto === ult)) iguais++;
  }
  ok(iguais === 0, `Seguir não repete a última frase (${iguais} vezes)`);
}
