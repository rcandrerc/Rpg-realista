// O último login vale (André 2026-11-13: "minha conta estava no PC, loguei no celular... eles ficaram brigando"):
// a mesma conta entrando num segundo aparelho derruba o primeiro, e o primeiro não volta sozinho (a volta automática,
// volta: true, é recusada com "outro_aparelho"). Entrar tocando no botão continua valendo e derruba o outro.
// Liga o servidor de verdade (server/index.js) com um banco numa pasta temporária e usa o cliente Colyseus.
// Uso: node ferramentas/testes/ultimo-login.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'colyseus.js';
import { Contas } from '../../server/contas.js';

const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ultimo-login-'));
const PORTA = 2700 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// conta de teste no banco (igual a ferramentas/motor/sessao.mjs): duas sessões, uma para cada aparelho
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'teste-ultimo-login', email: 'teste@login.invalid', given_name: 'Teste' }) });
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
  // 1) PC jogando, celular entra: o PC sai com 4001 e o celular fica
  const a = await entrar(pc);
  await esperar(400);
  const b = await entrar(celular);
  await esperar(600);
  ok(a.fechou === 4001, `o PC sai quando o celular entra (fechou ${a.fechou})`);
  ok(b.fechou === null, 'o celular continua jogando');

  // 2) o PC tenta voltar sozinho (como depois de uma queda): o servidor recusa e o celular nem percebe
  const volta = await tentar(() => entrar(pc, { volta: true }));
  await esperar(500);
  ok(!volta.sala && /outro_aparelho/.test(String(volta.erro?.message)), `volta automática do PC recusada (${volta.erro?.message ?? 'entrou!'})`);
  ok(b.fechou === null, 'o celular não foi derrubado pela volta automática');

  // 3) o André toca em "Entrar" no PC: agora o PC vale e o celular sai (último login vale nos dois sentidos)
  const a2 = await entrar(pc);
  await esperar(600);
  ok(b.fechou === 4001, `o celular sai quando o PC entra de novo pelo botão (fechou ${b.fechou})`);
  ok(a2.fechou === null, 'o PC continua jogando');
  const volta2 = await tentar(() => entrar(celular, { volta: true }));
  await esperar(500);
  ok(!volta2.sala && a2.fechou === null, 'a volta automática do celular também é recusada');

  // 4) a internet do PC caiu (o servidor segura o herói 20 s) e o celular entrou nesse meio tempo: o PC não volta
  // como o mesmo herói (a espera é cancelada) nem entra de novo sozinho
  const token = a2.reconnectionToken;
  a2.connection.close(); // queda: fecha sem avisar a sala (não é saída consentida)
  await esperar(500);
  const b2 = await entrar(celular);
  await esperar(600);
  const religou = await tentar(() => cliente.reconnect(token));
  ok(!religou.sala, `o PC não religa no herói que o celular assumiu (${religou.erro?.message ?? 'religou!'})`);
  const volta3 = await tentar(() => entrar(pc, { volta: true }));
  await esperar(500);
  ok(!volta3.sala, 'e a entrada automática dele é recusada');
  ok(b2.fechou === null, 'o celular continua jogando');
  const saude = await (await fetch(`http://${HOST}:${PORTA}/saude`)).json();
  ok(saude.jogadores === 1, `só um aparelho na sala (${saude.jogadores})`);

  // 5) queda normal sem outro aparelho: a volta automática continua funcionando (nada de bloquear quem caiu sozinho)
  const tk = b2.reconnectionToken;
  b2.connection.close();
  await esperar(500);
  const rel = await tentar(() => cliente.reconnect(tk));
  ok(!!rel.sala, `queda curta sozinho: religa na mesma sessão (${rel.erro?.message ?? 'ok'})`);
  rel.sala?.onMessage('*', () => {});
  rel.sala?.connection.close();
  await esperar(500);
  const s2 = await (await fetch(`http://${HOST}:${PORTA}/saude`)).json();
  await esperar(100);
  const nova = await tentar(() => entrar(celular, { volta: true }));
  ok(!!nova.sala, `queda sem outro aparelho: a entrada automática entra (${nova.erro?.message ?? 'ok'}; ${s2.jogadores} na sala antes)`);

  // 6) o mesmo aparelho com um socket velho que o servidor ainda não viu cair (internet travada, o app largou o socket):
  // a volta automática dele entra e tira o socket velho, como antes (não é "outro aparelho")
  await esperar(300);
  const ligada = await (await fetch(`http://${HOST}:${PORTA}/conta/ligada`, { headers: { Authorization: 'Bearer ' + pc } })).json();
  const propria = await (await fetch(`http://${HOST}:${PORTA}/conta/ligada`, { headers: { Authorization: 'Bearer ' + celular } })).json();
  ok(ligada.ligada === true && propria.ligada === false, `/conta/ligada: para o PC ${ligada.ligada}, para o próprio celular ${propria.ligada}`);
  const mesma = await tentar(() => entrar(celular, { volta: true }));
  await esperar(600);
  ok(!!mesma.sala && nova.sala?.fechou === 4001, `mesmo aparelho, socket velho: entra e o velho sai (${mesma.erro?.message ?? 'ok'}, velho fechou ${nova.sala?.fechou})`);
} catch (e) {
  console.error('FALHOU', e); process.exitCode = 1;
} finally {
  if (process.exitCode) console.log('--- servidor ---\n' + log.split('\n').slice(-30).join('\n'));
  fim(); process.exit();
}
