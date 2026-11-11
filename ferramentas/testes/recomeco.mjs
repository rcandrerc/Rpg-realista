// Teste do recomeço do zero (André 2026-11-11). Uso: node ferramentas/testes/recomeco.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Contas } from '../../server/contas.js';
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
// recomeço (André 2026-11-11): quando o servidor sobe, a conta de teste volta ao Nv 1 e perde o terreno; a Cecília
// fica com o terreno vazio. Nome e aparência ficam; o antigo vai para 'antes'. Uma vez só por RECOMECO.data.
{
  const { RECOMECO, AMIGA } = await import('../../shared/index.js');
  const pasta2 = fs.mkdtempSync(path.join(os.tmpdir(), 'recomeco-'));
  const abrir = () => new Contas({ pasta: pasta2, verificar: async () => null, ehTestador: (e) => e === 'teste@x' });
  let db2 = abrir();
  const ins = (g, email) => db2.db.prepare("INSERT INTO contas (google, email, nome, criada, ultimo_acesso, visual) VALUES (?, ?, 'Fulano', 0, 0, 'ruiva')").run(g, email).lastInsertRowid;
  const t = ins('t', 'teste@x'), o = ins('o', 'outro@x');
  db2.db.prepare('UPDATE contas SET recomeco = NULL').run();
  db2.salvarProgresso(t, { nivel: 45, xp: 10 }); db2.salvarProgresso(o, { nivel: 30, xp: 10 });
  const lote = (id, dono, dados) => db2.q.gravarLote.run(id, dono, 'x', JSON.stringify(dados), 0);
  lote('t1', 'c' + t, { ret: { x0: 0, z0: 0, x1: 10, z1: 10 }, pecas: [{ id: 'p1', k: 'parede', x: 1, z: 1, r: 0 }], bau: [{ k: 'pocao', n: 5 }] });
  lote('t2', 'c' + o, { ret: { x0: 20, z0: 0, x1: 30, z1: 10 }, pecas: [{ id: 'p1', k: 'parede', x: 21, z: 1, r: 0 }] });
  lote('tcecilia', AMIGA.conta, { ret: { x0: 40, z0: 0, x1: 50, z1: 10 }, pecas: [{ id: 'p1', k: 'fundacao', x: 43, z: 3, r: 0 }], amiga: { prog: { nivel: 44 }, amizades: { 1: 9 } } });
  const s1 = db2.novaSessaoPara(t), s2 = db2.novaSessaoPara(o);
  db2.db.close(); db2 = abrir(); // o servidor sobe de novo
  const c1 = db2.porSessao(s1);
  ok(c1.progresso === null && c1.nome === 'Fulano', 'recomeço: a conta de teste volta ao Nv 1 e o nome fica');
  const linha = db2.db.prepare('SELECT antes, recomeco FROM contas WHERE id = ?').get(t), antes = JSON.parse(linha.antes);
  ok(linha.recomeco === RECOMECO.data && JSON.parse(antes.progresso).nivel === 45 && antes.lotes.length === 1, 'o progresso e o terreno antigos ficam guardados em antes');
  ok(!db2.loteDoDono('c' + t), 'o terreno dele volta à venda');
  ok(db2.porSessao(s2).progresso?.nivel === 30 && db2.loteDoDono('c' + o)?.dados.pecas.length === 1, 'conta que não é de teste não muda');
  const lc = db2.loteDoDono(AMIGA.conta).dados;
  ok(lc.pecas.length === 0 && lc.ret.x0 === 40 && lc.amiga.recomeco === RECOMECO.data && !lc.amiga.prog && lc.amiga.antes.prog.nivel === 44 && lc.amiga.antes.lote.pecas.length === 1, 'Cecília: terreno vazio, progresso zerado, o antigo guardado');
  db2.salvarProgresso(t, { nivel: 2, xp: 0 });
  db2.db.close(); db2 = abrir();
  ok(db2.porSessao(s1).progresso?.nivel === 2, 'o recomeço não repete: o que ele joga depois fica');
}
process.exit(process.exitCode || 0);
