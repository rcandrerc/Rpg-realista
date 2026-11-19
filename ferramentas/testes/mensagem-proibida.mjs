// Revisão de segurança antes do lançamento (2026-11-19): uma mensagem do tipo '__proto__' derrubava o servidor inteiro
// (o Colyseus achava o Object.prototype na tabela de mensagens). Agora é ignorada e o jogo segue para todos.
// Também: a conta entrando em outro aparelho tira o herói antigo do mundo na hora (antes ficava até o socket fechar).
// Liga o servidor de verdade (server/index.js) com um banco numa pasta temporária e usa o cliente Colyseus.
// Uso: node ferramentas/testes/mensagem-proibida.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'colyseus.js';
import { Contas } from '../../server/contas.js';

const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'mensagem-proibida-'));
const PORTA = 2700 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// conta de teste no banco (igual a ferramentas/motor/sessao.mjs): duas sessões, uma para cada aparelho
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'teste-mensagem-proibida', email: 'teste@proibida.invalid', given_name: 'Teste' }) });
const r = await contas.entrar('x', 'criar');
contas.salvarPersonagem(r.conta.id, { nome: 'Teste', visual: 'ruiva', aparencia: null });
const pc = r.sessao, celular = contas.novaSessaoPara(r.conta.id);
contas.db.close();

const srv = spawn(process.execPath, ['index.js'], { cwd: path.join(raiz, 'server'), env: { ...process.env, DADOS: pasta, PORT: String(PORTA) }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
const fim = () => { try { srv.kill(); } catch { /* já saiu */ } fs.rmSync(pasta, { recursive: true, force: true }); };
process.on('exit', fim);
// o servidor pode ouvir só no IPv6 (::1), como na máquina do GitHub: usa o endereço que responde
let HOST = '';
// o servidor leva ~16 s para ligar (mundo, terreno, NPCs) e mais com outros testes rodando juntos: espera até 90 s
// (antes eram 15 s e o teste falhava com "Invalid URL ws://:porta", 2026-11-13)
for (let i = 0; i < 360 && !HOST; i++) {
  for (const h of ['127.0.0.1', '[::1]']) { try { if ((await fetch(`http://${h}:${PORTA}/saude`)).ok) { HOST = h; break; } } catch { /* ainda ligando */ } }
  if (!HOST) await esperar(250);
}
if (!HOST) { console.error('FALHOU o servidor não ligou em 90 s\n' + log.slice(-2000)); process.exit(1); }
const cliente = new Client(`ws://${HOST}:${PORTA}`);
const entrar = async (sessao, extra = {}) => {
  const sala = await cliente.joinOrCreate('clareira', { sessao, nome: 'Teste', json: true, aoi: true, ...extra });
  sala.fechou = null; sala.onLeave((codigo) => { sala.fechou = codigo; });
  sala.onMessage('*', () => {});
  return sala;
};
const tentar = async (fn) => { try { return { sala: await fn() }; } catch (e) { return { erro: e }; } };

try {
  const a = await entrar(pc);
  await esperar(500);
  for (const tipo of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) a.send(tipo, 1);
  await esperar(800);
  const s = await fetch(`http://${HOST}:${PORTA}/saude`).then((r) => r.json()).catch(() => null);
  ok(s?.ok === true && srv.exitCode === null, 'mensagem __proto__ não derruba o servidor');
  ok(a.fechou === 4002, `quem mandou sai da sala, como em qualquer mensagem desconhecida (fechou ${a.fechou})`);
  ok(!/is not a function/.test(log), 'nada de "is not a function" no log');

  // o PC entra de novo e depois o celular: o PC sai e o herói dele sai do mundo na hora (fica um herói só da conta)
  const a2 = await entrar(pc);
  await esperar(500);
  const b = await entrar(celular);
  let herois = null;
  b.onMessage('mundoJ', (m) => { const j = typeof m === 'string' ? JSON.parse(m) : m; const l = j?.foto?.jogadores || j?.jogadores; if (Array.isArray(l)) herois = l.filter((o) => o.nome === 'Teste').length; });
  await esperar(1500);
  ok(a2.fechou === 4001, `o PC sai quando o celular entra (fechou ${a2.fechou})`);
  ok(herois === 1, `um herói só da conta no mundo (${herois})`);
  b.leave();
  await esperar(300);
} finally {
  fim();
  process.exit(process.exitCode || 0);
}
