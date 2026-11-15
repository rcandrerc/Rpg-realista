// Teste do "adicionar amigo a distância" (André 2026-11-15): Multijogador > Amigos > Adicionar, busca pelo nome e pede.
// O pedido fica guardado até a outra pessoa responder (offline ou em outra sala). Uso: node ferramentas/testes/amigo-busca.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Simulacao, MAPA_CLAREIRA, AMIGOS } from '../../shared/index.js';
import { Contas } from '../../server/contas.js';
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

// ---- banco: busca por pedaço do nome, sem acento nem maiúscula; pedidos guardados ----
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'amigo-busca-'));
const db = new Contas({ pasta, verificar: async () => null });
const novo = (g, nome, visual = 'ruiva') => Number(db.db.prepare("INSERT INTO contas (google, email, nome, criada, ultimo_acesso, visual) VALUES (?, '', ?, 0, 0, ?)").run(g, nome, visual).lastInsertRowid);
const iAna = novo('g1', 'Ana'), iAndre = novo('g2', 'André'), iAndreia = novo('g3', 'Andreia Luz'), iBia = novo('g4', 'Bia');
novo('robo:testes', 'Robô Andre'); novo('g5', 'Andressa', null); // robô e conta sem personagem não aparecem
const nomes = (l) => l.map((r) => r.nome).join(',');
ok(nomes(db.buscarNomes('andre', iAna)) === 'André,Andreia Luz', 'busca sem acento acha André primeiro: ' + nomes(db.buscarNomes('andre', iAna)));
ok(nomes(db.buscarNomes('LUZ', iAna)) === 'Andreia Luz', 'pedaço do meio do nome');
ok(db.buscarNomes('ana', iAna).length === 0, 'não acha a própria conta');
db.gravarPedido(iAna, iBia);
let p = db.pedidos(iBia);
ok(p.rec.length === 1 && p.rec[0].c === 'c' + iAna && p.rec[0].nome === 'Ana', 'pedido guardado chega para Bia');
ok(db.pedidos(iAna).env[0]?.c === 'c' + iBia, 'Ana vê o pedido que mandou');
db.db.prepare('UPDATE pedidos_amizade SET quando = 0').run();
ok(db.pedidos(iBia).rec.length === 0, `pedido de mais de ${AMIGOS.pedidoDias} dias some`);

// ---- duas salas, como no servidor (server/index.js liga os ganchos) ----
const s1 = new Simulacao(MAPA_CLAREIRA), s2 = new Simulacao(MAPA_CLAREIRA);
const salas = [s1, s2];
const idc = (k) => Number(k.slice(1));
for (const s of salas) {
  s.todasSims = () => salas;
  s.buscarContas = (termo, conta) => db.buscarNomes(termo, idc(conta), AMIGOS.buscaMax).map((r) => ({ c: 'c' + r.id, nome: r.nome }));
  s.aoPedidoAmizade = (de, para, grava) => { if (!grava) { db.tirarPedido(idc(de), idc(para)); return true; } if (db.nAmigos(idc(para)) >= AMIGOS.max) return 'cheia'; db.gravarPedido(idc(de), idc(para)); return true; };
  s.aoAmizade = (a, b, junta) => (junta ? db.fazerAmizade(idc(a), idc(b), AMIGOS.max) : (db.desfazerAmizade(idc(a), idc(b)), true));
  s.onlineFora = (k) => salas.some((o) => o !== s && o.porConta(k));
}
const entrar = (s, id, nome, conta) => { const j = s.adicionarJogador(id, nome, null, { conta }); s.definirAmigos(id, db.amigos(conta).map((a) => ({ c: 'c' + a.id, nome: a.nome })), db.pedidos(conta)); return j; };
const ev = (s) => { const e = s.eventos; s.eventos = []; return e; };
const ana = entrar(s1, 'A', 'Ana', iAna);
const andre = entrar(s2, 'D', 'André', iAndre); // outra sala
ev(s1); ev(s2);
s1.amigo('A', { acao: 'buscar', nome: 'a' });
ok(ev(s1).some((e) => e.t === 'aviso' && /2 letras/.test(e.texto)), 'busca curta pede mais letras');
s1.amigo('A', { acao: 'buscar', nome: 'andre' });
const r = ev(s1).find((e) => e.t === 'amigoBusca' && e.para === 'A');
ok(r && r.lista[0].c === 'c' + iAndre && r.lista[0].on === 2, 'acha André, online em outro mundo');
ok(r && r.lista.some((x) => x.c === 'c' + iAndreia && x.on === 0), 'acha Andreia offline');
s1.amigo('A', { acao: 'pedirC', c: 'c' + iBia });
ok(!ana.pedidosEnv.size, 'não pede quem não apareceu na busca');
s1.amigo('A', { acao: 'pedirC', c: 'c' + iAndre });
ok(ana.pedidosEnv.has('c' + iAndre) && andre.pedidosRec.get('c' + iAna) === 'Ana', 'pedido chegou ao André na outra sala');
const e2 = ev(s2);
ok(e2.some((e) => e.t === 'amigo' && e.fase === 'pedidoC' && e.para === 'D' && e.c === 'c' + iAna), 'André recebe o cartão do pedido');
ok(e2.some((e) => e.t === 'amigos' && e.para === 'D' && e.pedidos?.[0]?.nome === 'Ana'), 'lista do André mostra o pedido');
ok(db.pedidos(iAndre).rec.length === 1, 'pedido guardado no banco');
s2.amigo('D', { acao: 'aceitarC', c: 'c' + iAna });
ok(ana.amigos.has('c' + iAndre) && andre.amigos.has('c' + iAna), 'aceitou: amigos nas duas salas');
ok(db.amigos(iAna).length === 1 && db.pedidos(iAndre).rec.length === 0 && !ana.pedidosEnv.size, 'amizade gravada e pedido apagado');
ok(ev(s1).some((e) => e.t === 'aviso' && e.para === 'A' && /André agora é seu amigo/.test(e.texto)), 'Ana é avisada');

// ---- pedido para quem está offline: chega quando entrar ----
s1.tempo += 5; s1.amigo('A', { acao: 'buscar', nome: 'luz' }); s1.amigo('A', { acao: 'pedirC', c: 'c' + iAndreia });
ok(ana.pedidosEnv.has('c' + iAndreia), 'pedido para offline guardado');
const andreia = entrar(s2, 'L', 'Andreia Luz', iAndreia);
ok(andreia.pedidosRec.has('c' + iAna) && ev(s2).some((e) => e.t === 'aviso' && e.para === 'L' && /Pedidos de amizade: 1/.test(e.texto)), 'ao entrar, Andreia vê o pedido');
s2.amigo('L', { acao: 'recusarC', c: 'c' + iAna });
ok(!andreia.pedidosRec.size && !ana.pedidosEnv.size && db.pedidos(iAna).env.length === 0, 'recusou: some dos dois e do banco');
ok(ev(s1).some((e) => e.t === 'aviso' && e.para === 'A' && /recusou/.test(e.texto)), 'Ana sabe que recusou');

// ---- os dois pediram: o segundo pedido já vira amizade ----
const bia = entrar(s1, 'B', 'Bia', iBia);
s1.tempo += 5; s1.amigo('B', { acao: 'buscar', nome: 'luz' }); s1.amigo('B', { acao: 'pedirC', c: 'c' + iAndreia });
s2.tempo += 5; s2.amigo('L', { acao: 'buscar', nome: 'bia' }); s2.amigo('L', { acao: 'pedirC', c: 'c' + iBia });
ok(bia.amigos.has('c' + iAndreia) && andreia.amigos.has('c' + iBia), 'pedido cruzado vira amizade');

// ---- o jeito antigo (tocar no jogador) continua e limpa o pedido guardado ----
const s = s1; ev(s);
s.tempo += 5; s.amigo('A', { acao: 'buscar', nome: 'bia' }); s.amigo('A', { acao: 'pedirC', c: 'c' + iBia });
ok(bia.pedidosRec.has('c' + iAna), 'Bia tem o pedido a distância da Ana');
s.tempo += 5; s.amigo('B', { acao: 'pedir', com: 'A' }); s.amigo('A', { acao: 'aceitar', com: 'B' });
ok(ana.amigos.has('c' + iBia) && !bia.pedidosRec.size && db.pedidos(iBia).rec.length === 0, 'tocar no mundo ainda faz amizade e limpa o pedido');

// ---- já é amigo / lista cheia ----
ev(s); s.tempo += 5; s.amigo('A', { acao: 'buscar', nome: 'bia' });
const rb = ev(s).find((e) => e.t === 'amigoBusca');
ok(rb?.lista[0]?.amigo === true, 'busca marca quem já é amigo');
s.tempo += 5; s.amigo('A', { acao: 'pedirC', c: 'c' + iBia });
ok(ev(s).some((e) => e.t === 'aviso' && /já é seu amigo/.test(e.texto)), 'não pede quem já é amigo');

fs.rmSync(pasta, { recursive: true, force: true });
process.exit(process.exitCode || 0);
