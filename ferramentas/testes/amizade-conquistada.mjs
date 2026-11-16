// Amizade conquistada com a Cecília e o Dario (André 2026-11-16): "eu queria ter que adicionar ele na lista de amigos,
// não que ele aparecesse... se eles não quiserem, eles vivem a vida deles e eu chamo quando precisa".
// Uso: node ferramentas/testes/amizade-conquistada.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
s.passo(0.05);
const dario = s.amigoIaDe(DARIO.id), b = dario.amiga;
const lista = () => { const e0 = s.eventos.length; s.enviarAmigos(d); return s.eventos.slice(e0).find((e) => e.t === 'amigos' && e.para === 'andre')?.virtuais || []; };
const sorte = (v, f) => { const r = Math.random; Math.random = () => v; try { f(); } finally { Math.random = r; } };
ok(lista().length === 0, 'começa sem ninguém em "Amigos virtuais"');
ok(!s.chat('andre', { canal: 'pm', para: DARIO.conta, texto: 'oi' }), 'sem ser amigo, sem mensagem privada');
// sem conhecer, às vezes quer jogar junto antes (sorteio alto) e pede para esperar
sorte(0.99, () => s.amigo('andre', { acao: 'pedir', com: b.id }));
ok(!dario.ehAmigoAmiga(d) && s.eventos.some((e) => e.t === 'fala' && e.para === 'andre' && /conhec/.test(e.texto)), 'recusou: quer conhecer antes');
sorte(0, () => s.amigo('andre', { acao: 'pedir', com: b.id }));
ok(!dario.ehAmigoAmiga(d) && s.eventos.some((e) => e.t === 'aviso' && /esperar um pouco/.test(e.texto)), 'logo depois de recusar: pede para esperar');
// amizade alta (jogaram juntos): aceita sempre
b.ia.amigoNao = {}; b.amizade = 4; // quem ele acompanha guarda a amizade em a.amizade
sorte(0.99, () => s.amigo('andre', { acao: 'pedir', com: b.id }));
ok(dario.ehAmigoAmiga(d) && lista().some((v) => v.c === DARIO.conta), 'amizade 4: aceitou e aparece na lista');
ok(s.chat('andre', { canal: 'pm', para: DARIO.conta, texto: 'e aí' }), 'amigo: manda mensagem privada');
// salvo no save dele
dario.guardarAmiga();
const salvo = dario.loteDaAmiga()?.amiga;
ok(salvo?.amigosDe?.[d.conta] === 1, 'a amizade fica gravada no save dele');
// ocupada lutando: pede para depois
const c = s.amiga; c.ia.av = { fase: 'cacar', c: { id: 'caca1' } };
sorte(0, () => s.amigo('andre', { acao: 'pedir', com: c.id }));
ok(!s.ehAmigoAmiga(d) && s.eventos.some((e) => e.t === 'fala' && /ocupad|luta/.test(e.texto)), 'Cecília caçando: ocupada, pede depois');
c.ia.av = null; c.ia.amigoNao = {};
// pela busca do nome
d.buscaT = -99; s.amigo('andre', { acao: 'buscar', nome: 'Cecí' });
const bus = s.eventos.filter((e) => e.t === 'amigoBusca').at(-1);
ok(bus?.lista?.some((r) => r.c === AMIGA.conta && r.npc && !r.amigo), 'a busca acha a Cecília com o selo de NPC');
sorte(0, () => s.amigo('andre', { acao: 'pedirC', c: AMIGA.conta }));
ok(s.ehAmigoAmiga(d) && lista().length === 2, 'pediu pela busca e ela aceitou: os dois na lista');
// remover
s.amigo('andre', { acao: 'remover', c: DARIO.conta });
ok(!dario.ehAmigoAmiga(d) && !lista().some((v) => v.c === DARIO.conta), 'remover tira o Dario da lista');
