// Modo leve na sala de verdade (André 2026-11-25, shared/leve.js): a aba Jogar do painel entra com corpo, recebe só a
// foto pequena (nunca o mundo), o servidor anda o herói pela estrada até o destino, a venda usa a mesma regra do jogo
// (só perto de quem compra) e o jogo da mesma conta tira o modo leve. Liga o servidor com um banco temporário.
// Uso: node ferramentas/testes/leve-sala.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'colyseus.js';
import { Contas } from '../../server/contas.js';

const falhas = [];
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); falhas.push(m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'leve-sala-'));
const PORTA = 2900 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0;
const contas = new Contas({ pasta, verificar: async () => ({ sub: 'teste-leve-' + ++n, email: `t${n}@leve.invalid`, given_name: 'Teste' + n }) });
const a = await contas.entrar('x', 'criar'); contas.salvarPersonagem(a.conta.id, { nome: 'Andarilho', visual: 'ruiva', aparencia: null });
const b = await contas.entrar('y', 'criar'); // sem personagem
const mochila = Array(40).fill(null); mochila[0] = { k: 'minerio_ferro', n: 10 };
contas.salvarProgresso(a.conta.id, { nivel: 20, ouro: 100, mochila });
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
const leve = async (sessao) => {
  const sala = await cliente.joinOrCreate('clareira', { sessao, leve: true });
  Object.assign(sala, { fechou: null, fotos: [], ev: [], mapa: null, mo: null, mundo: 0, erro: null, bytes: 0 });
  sala.onLeave((c) => { sala.fechou = c; });
  sala.onMessage('leve', (d) => { sala.fotos.push(d.f); sala.ev.push(...d.ev); if (d.mo) sala.mo = d.mo; if (d.mapa) sala.mapa = d.mapa; if (d.cn) sala.cn = d.cn; sala.bytes += JSON.stringify({ ...d, cn: undefined }).length; }); // a cena de perto (cenaLeve) só vai quando muda: conta à parte
  sala.onMessage('leveMapa', (d) => { sala.mapa = d; });
  sala.onMessage('leveErro', (d) => { sala.erro = d; });
  sala.onMessage('*', (t) => { if (t === 'mundo' || t === 'mundoJ') sala.mundo++; });
  return sala;
};
const eu = (s) => s.fotos.at(-1)?.eu;
const avisos = (s) => s.ev.filter((e) => e.t === 'aviso').map((e) => e.texto);

try {
  // 1) entra com corpo: o mapa fixo (lugares, totens, loja), a mochila e ~2 fotos por segundo, nunca o mundo
  const s = await leve(sessaoA);
  await esperar(3200);
  ok(s.mapa && s.mapa.npcs.length > 0 && s.mapa.totens.length > 0 && s.mapa.loja.length > 0, `lugares no mapa (${s.mapa?.npcs?.length} NPCs, ${s.mapa?.totens?.length} totens)`);
  ok(s.fotos.length >= 3 && s.fotos.length <= 12, `fotos a cada ~0,5 s (${s.fotos.length} em ~3 s)`); // folga para o GitHub com 4 testes juntos
  ok(s.mundo === 0, 'o modo leve não recebe o mundo');
  ok(s.mo?.it?.[0]?.[1] === 'minerio_ferro' && s.mo.it[0][2] === 10 && s.mo.it[0][5] > 0, `mochila com nome e preço (${JSON.stringify(s.mo?.it?.[0])})`);
  ok(s.bytes / s.fotos.length < 4000, `foto pequena (${Math.round(s.bytes / s.fotos.length)} bytes)`);
  ok(s.cn && JSON.stringify(s.cn).length < 15000, `o mundo de perto chegou (${JSON.stringify(s.cn || {}).length} bytes)`);
  const [x0, z0] = eu(s);

  // 2) vender longe de quem compra: a mesma regra do jogo
  // quem compra mais longe, até 120 m (para andar de verdade)
  const dd = (q) => Math.hypot(q.x - x0, q.z - z0);
  const compra = s.mapa.npcs.filter((q) => (q.v || q.f === 'loja') && dd(q) < 120).sort((p, q) => dd(q) - dd(p))[0];
  console.log('  destino', compra.n, Math.round(dd(compra)), 'm');
  {
    s.send('item', { acao: 'vender', i: 0, n: 2 });
    await esperar(900);
    ok(avisos(s).some((t) => /Venda com/.test(t)) && eu(s)[7] === 100, 'longe da loja: não vende');
  }

  // 3) toca no mapa: o servidor leva o herói pela estrada até quem compra (sem teleporte)
  s.ev.length = 0;
  s.send('leveIr', { x: compra.x, z: compra.z + 1.5, nome: compra.n });
  await esperar(1200);
  const rota = s.ev.find((e) => e.t === 'leveRota');
  ok(rota && rota.pontos.length >= 1, `caminho planejado (${rota?.pontos?.length} pontos)`);
  ok(s.fotos.at(-1).r && s.fotos.at(-1).r[0] > 0, `a foto mostra quanto falta (${JSON.stringify(s.fotos.at(-1).r)})`);
  // velocidade pela foto: a média de cada trecho de 2 s (uma foto atrasada na rede não conta como pulo)
  let maxPasso = 0, ant = eu(s), antT = Date.now();
  for (let i = 0; i < 160 && !s.ev.some((e) => e.t === 'leveRota' && e.chegou); i++) {
    await esperar(500);
    if (Date.now() - antT < 2000) continue;
    const e2 = eu(s); maxPasso = Math.max(maxPasso, Math.hypot(e2[0] - ant[0], e2[1] - ant[1]) / ((Date.now() - antT) / 1000) / 2); ant = e2; antT = Date.now();
  }
  const [x1, z1] = eu(s);
  ok(s.ev.some((e) => e.t === 'leveRota' && e.chegou), `chegou (${avisos(s).filter((t) => /Chegou/.test(t)).join('')}${s.ev.filter((e) => e.t === 'leveRota' && e.texto).map((e) => e.texto).join(' | ')})`);
  ok(Math.hypot(x1 - compra.x, z1 - compra.z) < 5, `perto de ${compra.n} (${Math.round(Math.hypot(x1 - compra.x, z1 - compra.z) * 10) / 10} m)`);
  ok(maxPasso < 6, `andou, não teleportou (maior passo em 0,5 s: ${Math.round(maxPasso * 10) / 10} m)`);

  // 4) perto: vende com a mensagem do jogo
  s.send('item', { acao: 'vender', i: 0, n: 3 });
  await esperar(1200);
  ok(eu(s)[7] > 100 && s.mo.it[0][2] === 7, `vendeu 3 (ouro ${eu(s)[7]}, sobrou ${s.mo.it[0]?.[2]})`);

  // 4b) viagem longa pela estrada (um totem a 100-400 m): anda na velocidade de gente, o que falta diminui
  { const [xa, za] = eu(s), d = (q) => Math.hypot(q.x - xa, q.z - za);
    const T = s.mapa.totens.filter((t) => d(t) > 100 && d(t) < 400).sort((p, q) => d(p) - d(q))[0];
    if (T) {
      s.ev.length = 0; s.send('leveIr', { x: T.x, z: T.z, nome: T.n });
      await esperar(1500); const f0 = s.fotos.at(-1).r?.[0];
      const a2 = eu(s), t2 = Date.now();
      await esperar(10000);
      const e2 = eu(s), mp = Math.hypot(e2[0] - a2[0], e2[1] - a2[1]) / ((Date.now() - t2) / 1000) / 2; // m a cada 0,5 s, na média
      const f1 = s.fotos.at(-1).r?.[0];
      ok(f0 > 0 && f1 < f0 - 10, `rumo ao totem ${T.n} (${Math.round(d(T))} m): faltava ${f0}, falta ${f1}`);
      ok(eu(s)[10] === 1, 'viagem longa: sobe no lobo sozinho, como o "Ir para" do jogo');
      ok(mp < (eu(s)[10] ? 5.2 : 4), `na velocidade do jogo (lobo 9 m/s; maior passo em 0,5 s: ${Math.round(mp * 10) / 10} m)`);
    } else console.log('  (sem totem a 100-400 m)');
  }

  // 5) parar no meio do caminho
  s.send('leveIr', { x: x0, z: z0 });
  await esperar(1500);
  s.send('leveParar');
  await esperar(800);
  const p1 = eu(s); await esperar(1000); const p2 = eu(s);
  ok(!s.fotos.at(-1).r && Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) < 0.3, 'Parar: o herói fica');
  // 5b) recall (casinha) no meio do caminho: a caminhada acaba; ao chegar na base ele não volta a andar para o destino antigo
  s.send('leveIr', { x: x0 + 40, z: z0 }); await esperar(1200);
  s.send('vila'); await esperar(1200);
  const q1 = eu(s); await esperar(1000); const q2 = eu(s);
  ok(!s.fotos.at(-1).r && Math.hypot(q2[0] - q1[0], q2[1] - q1[1]) < 0.3 && s.ev.some((e) => e.t === 'vila' && e.fase === 'comeca'), 'recall no caminho: para e canaliza');
  s.send('vila'); await esperar(400); // toca de novo: desiste do recall
  // destino absurdo: ignorado sem cair
  s.send('leveIr', { x: 'a', z: null }); s.send('leveIr', { x: 1e9, z: 0 }); s.send('leveIr', null);
  await esperar(600);
  ok(s.fechou === null && !s.fotos.at(-1).r, 'destinos estranhos: ignorados');

  // 5b) chat: chega o histórico e a própria mensagem, só o texto
  s.send('chat', { canal: 'geral', texto: 'oi do modo leve' });
  await esperar(1500);
  ok(s.ev.some((e) => e.t === 'chat' && e.x === 'oi do modo leve' && e.meu && !('hora' in e)), 'chat no modo leve (só o texto)');

  // 6) conta sem personagem: não joga pelo modo leve
  const sb = await leve(sessaoB);
  await esperar(1200);
  ok(/Crie o personagem/.test(sb.erro || ''), `sem personagem: recusado (${sb.erro})`);
  await sb.leave();

  // 7) o jogo da mesma conta entra: o modo leve sai (é o mesmo herói); leveIr do jogo é ignorado
  const jogo = await cliente.joinOrCreate('clareira', { sessao: sessaoA2, nome: 'Andarilho', json: true, aoi: true });
  jogo.fechou = null; jogo.onLeave((c) => { jogo.fechou = c; }); jogo.onMessage('*', () => {});
  await esperar(1500);
  ok(s.fechou === 4001 && jogo.fechou === null, `o jogo tira o modo leve (${s.fechou})`);
  jogo.send('leveIr', { x: 0, z: 0 });
  await esperar(500);
  await jogo.leave();
  await esperar(500);
  ok(!/passo da sala deu erro|mensagem leve\w* deu erro/.test(log), 'sem erro no servidor');
} catch (e) {
  console.error('FALHOU', e); process.exitCode = 1;
} finally {
  if (process.exitCode) console.log('--- servidor ---\n' + log.split('\n').slice(-40).join('\n') + '\n--- falhas ---\n' + falhas.join('\n'));
  fim(); process.exit();
}
