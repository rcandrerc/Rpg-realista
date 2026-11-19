// Revisão de segurança antes do lançamento (2026-11-19): sem conta ninguém abre sala nem guarda lugar. Antes, qualquer um
// mandava POST /matchmake/create/clareira (sala vazia nova, ~27 ms de CPU cada) ou joinOrCreate sem sessão, e via a lista
// das salas. Agora só joinOrCreate (com sessão válida, com limite por conta) e reconnect; a lista vem vazia; corpo grande cai.
// Liga o servidor de verdade (server/index.js) com um banco numa pasta temporária e usa o cliente Colyseus.
// Uso: node ferramentas/testes/sala-sem-login.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'colyseus.js';
import { Contas } from '../../server/contas.js';

const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'sala-sem-login-'));
const PORTA = 2700 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// conta de teste no banco (igual a ferramentas/motor/sessao.mjs): duas sessões, uma para cada aparelho
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'teste-sala-sem-login', email: 'teste@salasemlogin.invalid', given_name: 'Teste' }) });
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

const mm = (metodo, corpo) => fetch(`http://${HOST}:${PORTA}/matchmake/${metodo}/clareira`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then((r) => r.json()).catch((e) => ({ falhou: e.message }));
const saude = () => fetch(`http://${HOST}:${PORTA}/saude`).then((r) => r.json());
try {
  const criar = await mm('create', {});
  ok(!criar.room && /invalid method/.test(criar.error || ''), `create não existe mais (${criar.error})`);
  for (const m of ['join', 'joinById']) { const r = await mm(m, {}); ok(!r.room, `${m} não existe mais (${r.error})`); }
  const semSessao = await mm('joinOrCreate', {});
  ok(!semSessao.room && semSessao.code === 401, `joinOrCreate sem sessão: recusado com 401 (${semSessao.code} ${semSessao.error})`);
  const falsa = await mm('joinOrCreate', { sessao: 'x'.repeat(40) });
  ok(!falsa.room && falsa.code === 401, 'sessão inventada: recusada');
  ok((await saude()).salas === 0, 'nenhuma sala foi aberta por quem não tem conta');
  const lista = await fetch(`http://${HOST}:${PORTA}/matchmake/clareira`).then((r) => r.json());
  ok(Array.isArray(lista) && lista.length === 0, 'a lista de salas vem vazia');
  const grande = await fetch(`http://${HOST}:${PORTA}/matchmake/joinOrCreate/clareira`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessao: pc, lixo: 'a'.repeat(200000) }) }).then((r) => r.json()).catch(() => null);
  ok(!grande?.room, 'pedido gigante não entra');
  const semBarra = await fetch(`http://${HOST}:${PORTA}/matchmake`, { method: 'POST', body: 'a'.repeat(3000000) }).then(() => 'leu', () => 'cortou');
  ok(semBarra === 'cortou', `pedido gigante em /matchmake (sem barra) é cortado (${semBarra})`);
  ok((await saude()).ok === true, 'o servidor continua no ar');

  // com conta: entra normal
  const a = await entrar(pc);
  await esperar(500);
  ok(a.fechou === null, 'com sessão válida a pessoa entra e joga');
  ok((await saude()).jogadores === 1, 'um jogador na sala');
  a.leave(); await esperar(400);
  // a mesma conta pedindo lugar sem parar: depois de 20 em 1 minuto espera um pouco
  let barrado = null;
  for (let i = 0; i < 25 && !barrado; i++) { const r = await mm('joinOrCreate', { sessao: celular }); if (!r.room) barrado = r; }
  ok(barrado?.code === 429, `pedir lugar sem parar: barrado com 429 (${barrado?.code} ${barrado?.error})`);
} finally {
  fim();
  process.exit(process.exitCode || 0);
}
