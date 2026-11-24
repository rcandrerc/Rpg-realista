// Comandos rápidos do time e saída quando a IA do dia acaba (André 2026-11-19). Sem rede.
// Uso: node ferramentas/testes/comandos-time.mjs
import fs from 'fs';
import { Simulacao, MAPA_CLAREIRA, COMANDOS_TIME, DESCULPAS_SAIR } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 }), irmao = s.adicionarJogador('irmao', 'Irmão', 'ruiva', { conta: 8 });
for (const x of s.amigosIa) x.amigaEntrar?.('andre', true); s.passo(0.05);
const ev = [], orig = s.evento.bind(s); s.evento = (e) => { ev.push(e); orig(e); };
const chats = []; s.aoChatAmiga = (m) => { chats.push(m); s.receberChat(m); };
const esp = (t) => { for (let i = 0; i < t * 20; i++) s.passo(0.05); };
ok(COMANDOS_TIME.lista.length === 4 && COMANDOS_TIME.lista.map((c) => c.id).join() === 'espera,segue,ataca,recua', 'só 4 comandos: Espera aqui, Me segue, Ataca meu alvo, Recua');
const dario = s.amigosIa.find((x) => x.AMIGA.id === 'dario'), d = dario.amiga;
d.amigosDe = { [j.conta]: 1 }; d.x = j.x + 1; d.z = j.z;
ok(dario.entrarTimeAmiga(d, j), 'Dario entra no time');
// jogador de verdade no mesmo time
j.time.membros.push(irmao.id); irmao.time = j.time;
// fora do time não vale
const sozinho = s.adicionarJogador('outro', 'Outro', 'ruiva', { conta: 9 });
s.comandoTime('outro', { c: 'espera', para: d.id }); ok(!d.ia.ordem && !chats.length, 'quem não está no time não manda');
// Espera aqui: fica onde está mesmo com o dono longe
s.comandoTime('andre', { c: 'espera', para: d.id });
ok(d.ia.ordem?.tipo === 'espera' && chats.at(-1)?.canal === 'time' && chats.at(-1).texto === 'Dario, espera aqui!', 'Espera aqui: ordem e o pedido no chat do time');
const x0 = d.x, z0 = d.z; Object.assign(j, { x: j.x + 25 }); esp(5);
ok(Math.hypot(d.x - x0, d.z - z0) < 1.5, `esperando: não seguiu o dono (andou ${Math.hypot(d.x - x0, d.z - z0).toFixed(1)} m)`);
ok(chats.some((m) => m.c === dario.AMIGA.conta && COMANDOS_TIME.falas.espera.includes(m.texto)), 'ele responde no chat do time');
// anti-spam
const n0 = chats.length; s.comandoTime('andre', { c: 'recua', para: d.id }); ok(chats.length === n0 + 1, 'mandou outro depois de um tempo: vale');
s.comandoTime('andre', { c: 'segue', para: d.id }); ok(chats.length === n0 + 1, 'dois seguidos em menos de 1,5 s: o segundo não vale');
esp(2);
// Me segue: desfaz a ordem e volta a seguir
s.comandoTime('andre', { c: 'segue', para: d.id }); ok(!d.ia.ordem, 'Me segue desfaz a ordem'); esp(10);
ok(Math.hypot(d.x - j.x, d.z - j.z) < 6, `Me segue: veio até o dono (${Math.hypot(d.x - j.x, d.z - j.z).toFixed(1)} m)`);
esp(2);
// Ataca meu alvo: sem alvo, pergunta; com alvo, foca nele
s.comandoTime('andre', { c: 'ataca', para: d.id }); esp(4);
ok(!d.ia.ordem && chats.some((m) => COMANDOS_TIME.falas.semAlvo.includes(m.texto)), 'Ataca sem alvo: pergunta qual');
const e1 = s.criarInimigo({ tipo: 'puglin', x: j.x + 4, z: j.z, nivel: 1 }), e2 = s.criarInimigo({ tipo: 'puglin', x: d.x - 2, z: d.z, nivel: 1 });
j.bateuEm = { id: e1.id, t: s.tempo };
s.comandoTime('andre', { c: 'ataca', para: d.id });
ok(d.ia.ordem?.tipo === 'foco' && d.ia.ordem.alvo === e1.id && dario.alvoAmiga(d, j)?.id === e1.id, 'Ataca meu alvo: foca no monstro que ele bateu, não no mais perto');
esp(2);
// Recua
s.comandoTime('andre', { c: 'recua', para: d.id }); ok(d.ia.ordem?.tipo === 'recua' && dario.alvoAmiga(d, j) === null, 'Recua: larga a briga');
esp(2);
// jogador de verdade recebe o aviso na tela
ev.length = 0; s.comandoTime('andre', { c: 'segue', para: irmao.id });
const cm = ev.find((e) => e.t === 'comando');
ok(cm && cm.para === irmao.id && cm.texto === 'Me segue' && cm.nome === 'André', 'jogador recebe o comando na tela');
ok(chats.at(-1).texto === 'Irmão, me segue!' && chats.at(-1).membros.includes(irmao.conta), 'e o pedido aparece no chat do time');
// cliente: menu do painel do time e o aviso
const am = fs.readFileSync(new URL('../../godot-prototipo/amigos.gd', import.meta.url), 'utf8'), on = fs.readFileSync(new URL('../../godot-prototipo/online.gd', import.meta.url), 'utf8');
ok(am.includes('m.rede("comando"') && am.includes('_abrir_comandos(') && COMANDOS_TIME.lista.every((c) => am.includes(`"${c.t}"`)), 'cliente: tocar na barra do time abre os 4 comandos');
ok(on.includes('"comando":') && on.includes('m.hud.comando('), 'cliente: o comando aparece em destaque na tela');
const en = JSON.parse(fs.readFileSync(new URL('../../godot-prototipo/dados/idioma_en.json', import.meta.url), 'utf8'));
const faltaEn = [...COMANDOS_TIME.lista.map((c) => c.t), ...Object.values(COMANDOS_TIME.falas).flat().flatMap((t) => (/\{[^}]*\|/.test(t) ? [t.replace(/\{([^|}]*)\|[^}]*\}/g, '$1'), t.replace(/\{[^|}]*\|([^}]*)\}/g, '$1')] : [t])), ...Object.values(DESCULPAS_SAIR).flatMap((g) => [...g.normal, ...g.cheio])].filter((t) => !en[t]);
ok(!faltaEn.length, `inglês de todos os comandos e desculpas (${faltaEn.slice(0, 3).join(' | ')})`);

// ---------- acabou a IA do dia: despede e desloga (André 2026-11-19) ----------
ok(DESCULPAS_SAIR.f.normal.length >= 50 && DESCULPAS_SAIR.m.normal.length >= 50 && DESCULPAS_SAIR.f.cheio.length >= 10 && DESCULPAS_SAIR.m.cheio.length >= 10, '50 desculpas de cada e as de saco cheio');
ok(new Set(DESCULPAS_SAIR.f.normal).size === DESCULPAS_SAIR.f.normal.length && new Set(DESCULPAS_SAIR.m.normal).size === DESCULPAS_SAIR.m.normal.length, 'nenhuma desculpa repetida');
const cec = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), geada = s.amigosIa.filter((x) => x.AMIGA.rival && x.amiga);
const temDario = () => [...s.jogadores.values()].some((o) => o.conta === dario.AMIGA.conta);
chats.length = 0; s.iaAcabouAte = Date.now() + 3600e3;
// a saída é sorteada (3-28 s) e espera o fim da briga (até +40 s): espera os dois saírem, sem depender da sorte
// André 2026-11-23 ("esses nunca somem"): o Dario é líder de clã (LIDERES_CLA) e fica; a Cecília sai com a desculpa
for (let i = 0; i < 120 && cec.amiga; i++) esp(1);
ok(!cec.amiga && dario.amiga && temDario(), 'acabou Gemini e Groq: a Cecília sai do jogo; o Dario (líder) fica');
const tchau = chats.filter((m) => m.c === cec.AMIGA.conta).at(-1)?.texto;
ok([...DESCULPAS_SAIR.f.normal, ...DESCULPAS_SAIR.f.cheio].includes(tchau), `Cecília se despede com uma desculpa: "${tchau}"`);
ok(!chats.some((m) => m.c === dario.AMIGA.conta && [...DESCULPAS_SAIR.m.normal, ...DESCULPAS_SAIR.m.cheio].includes(m.texto)), 'o Dario não se despede');
ok(geada.every((x) => x.amiga), 'a Geada não tem IA e continua no mundo');
cec.amigaEntrar('irmao', true); ok(!cec.amiga, 'quem entra enquanto a IA está fora não traz a Cecília de volta');
s.iaAcabouAte = 0;
// volta na conferência seguinte: até 30 s depois de sair (amigaFora.chk), e a saída pode atrasar até 40 s se ela estava lutando
for (let i = 0; i < 45 && !cec.amiga; i++) esp(1);
ok(dario.amiga && cec.amiga && temDario(), 'a IA voltou: a Cecília loga de novo');
ok(dario.amigaDono === 'andre', 'o Dario continua acompanhando quem estava com ele');
