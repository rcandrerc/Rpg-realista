// Teste do nome do personagem (André 2026-11-10): escolhido no criador, travado; trocar custa NOME.troca de ouro e o
// nome é único entre as contas. Uso: node ferramentas/testes/nome.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Simulacao, MAPA_CLAREIRA, NOME } from '../../shared/index.js';
import { Contas } from '../../server/contas.js';
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', null, { conta: 1 });
const b = s.adicionarJogador('B', 'Bia', null, { conta: 2 });
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
a.prog.ouro = NOME.troca - 1;
ok(s.trocarNome('A', 'Aurora') === null && a.nome === 'Ana' && a.prog.ouro === NOME.troca - 1, 'sem ouro não troca');
a.prog.ouro = NOME.troca + 50;
ok(s.trocarNome('A', 'x') === null && a.nome === 'Ana', 'nome curto não vale');
ok(s.trocarNome('A', 'Ana') === null, 'o mesmo nome não cobra');
ok(s.trocarNome('A', 'Bia', () => false) === null && a.prog.ouro === NOME.troca + 50, 'nome de outra conta não troca nem cobra');
b.amigos.set(a.conta, 'Ana');
ok(s.trocarNome('A', '  Aurora   Rubra ') === 'Aurora Rubra' && a.nome === 'Aurora Rubra' && a.prog.ouro === 50, 'troca e cobra a taxa');
ok(b.amigos.get(a.conta) === 'Aurora Rubra', 'lista de amigos de quem está na sala muda junto');
ok(s.eventos.some((e) => e.t === 'nome' && e.para === 'A' && e.nome === 'Aurora Rubra'), 'avisa o app do nome novo');
ok(avisos().length > 0, 'avisos: ' + avisos().join(' | '));
const f = s.foto();
ok(f.jogadores.find((j) => j.id === 'A')?.nome === 'Aurora Rubra' && f.jogadores.find((j) => j.id === 'A')?.nivel >= 1, 'os outros recebem nome e nível');
const c = s.adicionarJogador('C', 'Caio', null, { conta: 3, podeCriar: true }); s.definirCriando('C', true);
c.prog.ouro = NOME.troca * 2;
ok(s.trocarNome('C', 'Outro') === null, 'no criador não troca pagando');

// banco: nome único sem diferença de maiúscula (e com acento)
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nome-'));
const db = new Contas({ pasta, verificar: async () => null });
const novo = (g, nome) => db.db.prepare("INSERT INTO contas (google, email, nome, criada, ultimo_acesso, visual) VALUES (?, '', ?, 0, 0, 'ruiva')").run(g, nome).lastInsertRowid;
const i1 = novo('g1', 'André'), i2 = novo('g2', 'Bia');
ok(!db.nomeLivre('andré', i2) && !db.nomeLivre('ANDRÉ', i2), 'nome de outra conta não está livre');
ok(db.nomeLivre('André', i1), 'o próprio nome conta como livre');
ok(db.nomeLivre('Andre', i2), 'sem acento é outro nome');
db.salvarNome(i1, 'Aurora');
ok(db.db.prepare('SELECT nome FROM contas WHERE id = ?').get(i1).nome === 'Aurora' && db.nomeLivre('André', i2), 'troca grava na conta');
fs.rmSync(pasta, { recursive: true, force: true });
process.exit(process.exitCode || 0);
