// Painel do clã na sala de verdade (André 2026-11-24): a página entra sem corpo, não recebe o mundo, só manda 'painel',
// vê só o próprio clã, as ordens passam pelo servidor, não derruba o jogo da mesma conta (nem o jogo derruba ela) e
// um segundo painel da mesma conta tira o primeiro. Liga o servidor (server/index.js) com um banco temporário.
// Uso: node ferramentas/testes/painel-sala.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'colyseus.js';
import { Contas } from '../../server/contas.js';
import { CLA } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';

const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'painel-sala-'));
const PORTA = 2900 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// duas contas: a do líder (com clã e 2 recrutas, fora do jogo há 2 h) e outra sem clã
let n = 0;
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'teste-painel-' + ++n, email: `t${n}@painel.invalid`, given_name: 'Teste' + n }) });
const a = await contas.entrar('x', 'criar'); contas.salvarPersonagem(a.conta.id, { nome: 'Lider', visual: 'ruiva', aparencia: null });
const b = await contas.entrar('y', 'criar'); contas.salvarPersonagem(b.conta.id, { nome: 'Outro', visual: 'ruiva', aparencia: null });
const T = CLA.tiers[0], agora = Date.now();
const m = [sortearRecruta(Math.random, T, 10, agora), sortearRecruta(Math.random, T, 10, agora)];
m[0].fn = { k: 'grind' };
contas.salvarProgresso(a.conta.id, { nivel: 20, ouro: 100, cla: { n: 'Brasa', c: agora, cofre: 5, sem: agora + CLA.semana, m, log: [], nv: 3, saiu: agora - 2 * 3600e3 } });
const sessaoA = a.sessao, sessaoA2 = contas.novaSessaoPara(a.conta.id), sessaoB = b.sessao;
contas.db.close();

const srv = spawn(process.execPath, ['index.js'], { cwd: path.join(raiz, 'server'), env: { ...process.env, DADOS: pasta, PORT: String(PORTA) }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
const fim = () => { try { srv.kill(); } catch { /* já saiu */ } fs.rmSync(pasta, { recursive: true, force: true }); };
process.on('exit', fim);
let HOST = '';
for (let i = 0; i < 360 && !HOST; i++) {
  for (const h of ['127.0.0.1', '[::1]']) { try { if ((await fetch(`http://${h}:${PORTA}/saude`)).ok) { HOST = h; break; } } catch { /* ainda ligando */ } }
  if (!HOST) await esperar(250);
}
if (!HOST) { console.error('FALHOU o servidor não ligou em 90 s\n' + log.slice(-2000)); process.exit(1); }
const cliente = new Client(`ws://${HOST}:${PORTA}`);
const painel = async (sessao) => {
  const sala = await cliente.joinOrCreate('clareira', { sessao, painel: true });
  Object.assign(sala, { fechou: null, infos: [], mundo: 0 });
  sala.onLeave((c) => { sala.fechou = c; });
  sala.onMessage('painel', (d) => sala.infos.push(d));
  sala.onMessage('*', (t) => { if (t === 'mundo' || t === 'mundoJ') sala.mundo++; });
  return sala;
};
const ultima = (s) => s.infos[s.infos.length - 1];
const tentar = async (fn) => { try { return { sala: await fn() }; } catch (e) { return { erro: e }; } };

try {
  // 1) sem sessão: nem entra
  const sem = await tentar(() => painel('sessao-inventada-com-mais-de-vinte-letras'));
  ok(!!sem.erro, `sessão inventada: recusado (${sem.erro?.code})`);

  // 2) entra: recebe o clã (com os recrutas no mundo) e nunca o mundo
  const p = await painel(sessaoA);
  await esperar(2500);
  let i = ultima(p);
  ok(i?.n === 'Brasa' && i.m.length === 2, `recebe o próprio clã (${i?.n}, ${i?.m?.length} recrutas)`);
  ok(i.m.every((x) => x.on === 1), 'com o painel aberto os recrutas estão no mundo');
  ok(i.log.some((l) => /^Fora \(/.test(l.txt)), `o tempo fora (2 h) foi entregue (${i.log.map((l) => l.txt).join(' | ')})`);
  ok(p.mundo === 0, 'o painel não recebe o mundo');

  // 3) ordem pela página
  p.send('painel', { acao: 'funcao', id: m[1].id, fn: { k: 'recurso', r: 'pedra' } });
  await esperar(800);
  i = ultima(p);
  ok(i.m.find((x) => x.id === m[1].id)?.fn?.k === 'recurso' && /Farmar/.test(i.aviso || ''), `ordem Farmar pedra (${i.aviso})`);
  await esperar(600);
  p.send('painel', { acao: 'funcao', id: m[1].id, fn: { k: 'seguir' } });
  await esperar(800);
  ok(/só dá com você no jogo/.test(ultima(p).aviso || ''), 'Me seguir sem o herói: recusado');
  await esperar(600);
  const antes = p.infos.length;
  p.send('painel', { acao: 'funcao', id: 'x'.repeat(50), fn: { k: 'grind' } });
  p.send('cla', { acao: 'dispensar', id: m[0].id }); // mensagem do jogo vinda do painel: ignorada
  p.send('painel', { acao: 'funcao', id: { __proto__: 1 }, fn: null });
  await esperar(800);
  ok(p.infos.length === antes && p.fechou === null, 'pedidos estranhos: ignorados, sem cair');
  // leilão só para olhar e avisos no celular (André 2026-11-24)
  const leiloes = []; p.onMessage('painelLeilao', (d) => leiloes.push(d));
  p.send('painel', { acao: 'leilao', tipo: 'mat', ordem: 'caro' });
  await esperar(800);
  const L = leiloes.at(-1);
  ok(L && Array.isArray(L.lista) && Array.isArray(L.meus) && L.lista.every((a) => !('conta' in a) && a.nome), `leilão no painel: anúncios sem a conta de ninguém (${L?.lista?.length})`);
  await esperar(1000); p.send('painel', { acao: 'leilao', texto: 'POCÃO' });
  await esperar(1700);
  const L2 = leiloes.at(-1);
  ok(L2 !== L && L2.lista.length > 0 && L2.lista.every((a) => /po[cç][aã]o/i.test(a.nome)), `busca sem acento nem maiúscula: "POCÃO" acha poções (${L2?.lista?.length})`);
  ok(typeof ultima(p).push?.pub === 'string' && ultima(p).push.on === 0, 'o painel recebe a chave dos avisos');
  p.send('painel', { acao: 'push', sub: { endpoint: 'https://exemplo.invalid/roubar', keys: { p256dh: 'x', auth: 'y' } } });
  await esperar(800);
  ok(/não aceita/.test(ultima(p).aviso || '') && ultima(p).push.on === 0, 'aviso para endereço qualquer: recusado');
  await esperar(2100);

  // 4) a outra conta: só vê o dela (sem clã), nunca o da primeira
  const q = await painel(sessaoB);
  await esperar(1500);
  ok(ultima(q)?.sem === 1 && !JSON.stringify(q.infos).includes('Brasa'), 'outra conta não vê o clã de ninguém');
  q.send('painel', { acao: 'funcao', id: m[0].id, fn: { k: 'livre' } });
  await esperar(800);
  ok(/não tem clã/.test(ultima(q).aviso || ''), 'outra conta não manda nos recrutas dos outros');
  await q.leave();

  // 5) o jogo da mesma conta entra: ninguém derruba ninguém e as ordens passam a ir pelo herói
  const jogo = await cliente.joinOrCreate('clareira', { sessao: sessaoA2, nome: 'Lider', json: true, aoi: true });
  jogo.fechou = null; jogo.onLeave((c) => { jogo.fechou = c; }); jogo.onMessage('*', () => {});
  await esperar(1500);
  p.send('painel', { acao: 'ver' });
  await esperar(800);
  ok(p.fechou === null && jogo.fechou === null, 'jogo e painel da mesma conta juntos');
  ok(ultima(p).jogo === 1 && ultima(p).funcoes.some((F) => F.id === 'seguir'), 'com o herói no jogo: "Me seguir" aparece');
  const ligada = await (await fetch(`http://${HOST}:${PORTA}/conta/ligada`, { headers: { Authorization: 'Bearer ' + sessaoA2 } })).json();
  ok(ligada.ligada === false, 'o painel não conta como "outro aparelho" para o jogo');
  await jogo.leave();
  await esperar(800);

  // 6) segundo painel da mesma conta: o primeiro sai
  const p2 = await painel(sessaoA);
  await esperar(1000);
  ok(p.fechou === 4001 && p2.fechou === null, `um painel por conta (o primeiro fechou ${p.fechou})`);
  await p2.leave();
  await esperar(500);
  ok(!/passo da sala deu erro|mensagem painel deu erro/.test(log), 'sem erro no servidor');
} catch (e) {
  console.error('FALHOU', e); process.exitCode = 1;
} finally {
  if (process.exitCode) console.log('--- servidor ---\n' + log.split('\n').slice(-40).join('\n'));
  fim(); process.exit();
}
