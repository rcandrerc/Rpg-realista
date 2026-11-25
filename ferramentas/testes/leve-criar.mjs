// Modo leve: Criar (André 2026-11-25). A página lista as MESMAS receitas do jogo (leveReceitas) e cria pela mesma
// mensagem `criar`: longe da estação o servidor recusa; perto dela cria. Uso: node ferramentas/testes/leve-criar.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'colyseus.js';
import { Contas } from '../../server/contas.js';
import { ESTACOES_PUBLICAS } from '../../shared/dados.js';

const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'leve-criar-'));
const PORTA = 3300 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'teste-leve-criar', email: 'c@leve.invalid', given_name: 'Criar' }) });
const a = await contas.entrar('x', 'criar'); contas.salvarPersonagem(a.conta.id, { nome: 'Artesao', visual: 'ruiva', aparencia: null });
const mochila = Array(40).fill(null); mochila[0] = { k: 'couro', n: 4 }; mochila[1] = { k: 'tecido', n: 2 };
contas.salvarProgresso(a.conta.id, { nivel: 20, ouro: 100, mochila });
const sessao = a.sessao; contas.db.close();
const srv = spawn(process.execPath, ['index.js'], { cwd: path.join(raiz, 'server'), env: { ...process.env, DADOS: pasta, PORT: String(PORTA) }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
process.on('exit', () => { try { srv.kill(); } catch { /* já saiu */ } fs.rmSync(pasta, { recursive: true, force: true }); });
let HOST = '';
for (let i = 0; i < 360 && !HOST; i++) { for (const h of ['127.0.0.1', '[::1]']) { try { if ((await fetch(`http://${h}:${PORTA}/saude`)).ok) { HOST = h; break; } } catch { /* ligando */ } } if (!HOST) await esperar(250); }
if (!HOST) { console.error('FALHOU o servidor não ligou\n' + log.slice(-2000)); process.exit(1); }
const s = await new Client(`ws://${HOST}:${PORTA}`).joinOrCreate('clareira', { sessao, leve: true });
Object.assign(s, { fotos: [], ev: [], rc: null, mo: null });
s.onMessage('leve', (d) => { s.fotos.push(d.f); s.ev.push(...d.ev); if (d.rc) s.rc = d.rc; if (d.mo) s.mo = d.mo; });
s.onMessage('*', () => {});
const avisos = () => s.ev.filter((e) => e.t === 'aviso').map((e) => e.texto);
const rec = (r) => s.rc?.r.find((o) => o[0] === r);
const temCouro = () => (s.mo?.it || []).reduce((t, o) => t + (o[1] === 'couro' ? o[2] : 0), 0);
try {
  await esperar(2500);
  ok(!s.rc, 'sem abrir o Criar a página não recebe receitas');
  s.send('leveReceitas', { ver: true }); await esperar(1500);
  const sh = rec('short');
  ok(s.rc && sh && sh[2].some((u) => u[0] === 'couro' && u[2] === 2) && sh[3] === 'bancada', `lista as receitas do jogo (${s.rc?.r.length} receitas, short = ${JSON.stringify(sh?.[2])})`);
  ok(sh[5] === 0 && sh[6] === '', 'longe da bancada: não está perto, sem outro impedimento');
  s.ev.length = 0; s.send('criar', { r: 'short', n: 1 }); await esperar(800);
  ok(avisos().some((t) => /bancada/i.test(t)) && temCouro() === 4, `longe da estação o servidor recusa (${avisos().join(' | ')})`);
  ok(s.rc.est.some((e) => e[0] === 'bancada') && s.rc.est.some((e) => e[0] === 'bigorna'), 'a página sabe onde ficam as estações (para ir até lá)');
  const B = ESTACOES_PUBLICAS.find((e) => e.k === 'bancada');
  s.send('leveIr', { x: B.x, z: B.z + 1.5, nome: 'Bancada' });
  for (let i = 0; i < 160 && !s.ev.some((e) => e.t === 'leveRota' && e.chegou); i++) await esperar(500);
  await esperar(1500);
  ok(rec('short')[5] === 1, 'perto da bancada a página vê "perto"');
  s.ev.length = 0; s.send('criar', { r: 'short', n: 1 });
  for (let i = 0; i < 40 && temCouro() === 4; i++) await esperar(500);
  ok(temCouro() === 2, `criou o short gastando o material (couro ${temCouro()}) ${avisos().join(' | ')}`);
  s.send('leveReceitas', { ver: false });
} finally { s.leave(); }
