// Modo leve, PR 2 (André 2026-11-25: "mais que combate quero fazer pack"): pelo modo leve o herói leva o pack nas costas
// (devagar), vê onde entregar e quanto paga, entrega no mercador com a mesma regra do jogo, põe o carrinho no chão, dirige
// pela estrada gastando combustível e desce. Liga o servidor com um banco temporário.
// Uso: node ferramentas/testes/leve-pack.mjs
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
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'leve-pack-'));
const PORTA = 3100 + Math.floor(Math.random() * 200);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const contas = new Contas({ pasta, verificar: async () => ({ sub: 'teste-leve-pack', email: 'p@leve.invalid', given_name: 'Pack' }) });
const a = await contas.entrar('x', 'criar'); contas.salvarPersonagem(a.conta.id, { nome: 'Carregador', visual: 'ruiva', aparencia: null });
const mochila = Array(40).fill(null); mochila[0] = { k: 'carrinho', n: 1 }; mochila[1] = { k: 'galao', n: 3 };
// o pack de lenha nas costas, feito no Seu Joca (m_lenha, 20/10)
contas.salvarProgresso(a.conta.id, { nivel: 20, ouro: 100, mochila, pack: { k: 'lenha', ox: 20, oz: 10, mo: 'm_lenha' } });
const sessao = a.sessao;
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
const s = await new Client(`ws://${HOST}:${PORTA}`).joinOrCreate('clareira', { sessao, leve: true });
Object.assign(s, { fechou: null, fotos: [], ev: [], mapa: null, pk: null });
s.onLeave((c) => { s.fechou = c; });
s.onMessage('leve', (d) => { s.fotos.push(d.f); s.ev.push(...d.ev); if (d.pk) s.pk = d.pk; if (d.mapa) s.mapa = d.mapa; });
s.onMessage('leveMapa', (d) => { s.mapa = d; });
s.onMessage('*', () => {});
const eu = () => s.fotos.at(-1)?.eu;
const avisos = () => s.ev.filter((e) => e.t === 'aviso').map((e) => e.texto);
// vai até (x, z) e espera chegar; devolve a maior velocidade média (m/s) em trechos de 2 s
async function ir(x, z, nome, max = 120) {
  s.ev.length = 0; s.send('leveIr', { x, z, nome });
  let vel = 0, ant = eu(), t = Date.now();
  for (let i = 0; i < max * 2 && !s.ev.some((e) => e.t === 'leveRota' && (e.chegou || (e.texto && !e.pontos.length))); i++) {
    await esperar(500);
    if (Date.now() - t < 2000) continue;
    const e2 = eu(); vel = Math.max(vel, Math.hypot(e2[0] - ant[0], e2[1] - ant[1]) / ((Date.now() - t) / 1000)); ant = e2; t = Date.now();
  }
  return { vel, chegou: s.ev.some((e) => e.t === 'leveRota' && e.chegou), txt: s.ev.filter((e) => e.t === 'leveRota' && e.texto).map((e) => e.texto).join(' | ') };
}

try {
  await esperar(2500);
  const pk = s.pk;
  ok(pk && pk.c?.[0] === 'lenha' && /Lenha/.test(pk.c[1]), `pack nas costas na página (${JSON.stringify(pk?.c)})`);
  ok(pk.tem === 1 && pk.gal === 3, `carrinho e galões na mochila (tem ${pk.tem}, galões ${pk.gal})`);
  ok(Array.isArray(pk.e) && pk.e.length >= 3 && !pk.e.some((o) => o[0] === 'm_lenha') && pk.e.every((o) => o[4] > 0), `onde entregar e quanto paga (${pk.e?.map((o) => o[1] + ' ' + o[4]).join(', ')})`);
  const joca = s.mapa.npcs.find((n) => n.id === 'm_lenha');
  ok(joca && joca.pk && joca.custo?.[0]?.[0] === 'lenha' && joca.custo[0][2] > 0, `mercador com o material do pack (${JSON.stringify(joca?.custo)})`);
  ok(eu()[9] === 1, 'a foto diz que tem pack');

  // 1) nas costas: anda devagar (x0,5 da corrida), até o Mestre Pedrão
  const pedrao = s.mapa.npcs.find((n) => n.id === 'm_pedra');
  const preco = pk.e.find((o) => o[0] === 'm_pedra')[4];
  const r = await ir(pedrao.x, pedrao.z + 2, 'Pedrão');
  ok(r.chegou, `chegou no Pedrão (${r.txt})`);
  ok(r.vel > 1.8 && r.vel < 3.3, `com pack anda devagar como no jogo (2,7 m/s) (${Math.round(r.vel * 10) / 10} m/s)`);
  // 2) entrega com a regra do jogo: perto do mercador, paga o preço mostrado
  const ouro0 = eu()[7];
  s.send('pack', { acao: 'entregar', npc: 'm_pedra', de: 'costas' });
  await esperar(1500);
  ok(eu()[7] - ouro0 === preco && !s.pk.c && eu()[9] === 0, `entregou: +${eu()[7] - ouro0} de ouro (mostrava ${preco}) ${avisos().join(' | ')}`);

  // 3) carrinho: põe no chão, sobe, dirige pela estrada gastando combustível, desce
  s.send('veiculo', { acao: 'colocar', k: 'carrinho' });
  await esperar(1200);
  ok(s.pk.car?.onde === 1, `carrinho no chão (${JSON.stringify(s.pk.car)})`);
  s.send('veiculo', { acao: 'abastecer' });
  await esperar(1200);
  const comb0 = s.pk.car.comb;
  ok(comb0 > 100 && s.pk.gal === 2, `abasteceu 1 galão (${comb0} m, sobraram ${s.pk.gal})`);
  s.send('veiculo', { acao: 'subir', k: 'carrinho' });
  await esperar(1200);
  ok(s.pk.car.onde === 2, 'dirigindo');
  const [xa, za] = eu();
  const r2 = await ir(joca.x, joca.z + 3, 'Seu Joca', 90);
  const andou = Math.hypot(eu()[0] - xa, eu()[1] - za);
  ok(andou > 20 && s.pk.car.comb < comb0 - 15, `andou de carrinho ${Math.round(andou)} m e gastou combustível (${comb0} -> ${s.pk.car.comb}) ${r2.txt}`);
  ok(r2.vel < 3.3, `na velocidade do carrinho (${Math.round(r2.vel * 10) / 10} m/s)`);
  s.send('veiculo', { acao: 'descer' });
  await esperar(1200);
  ok(s.pk.car.onde === 1, 'desceu: o carrinho ficou no chão');
  s.send('veiculo', { acao: 'recolher' });
  await esperar(1200);
  ok(s.pk.car.onde === 0, 'carrinho de volta na mochila');

  // 4) fazer pack no Seu Joca: sem material, o servidor recusa com o motivo do jogo
  s.ev.length = 0;
  s.send('pack', { acao: 'fazer', npc: 'm_lenha' });
  await esperar(1200);
  ok(avisos().some((t) => /Falta material|Packs:|Chegue perto/.test(t)) && !s.ev.some((e) => e.t === 'fabricando'), `fazer sem material: recusado (${avisos().join(' | ')})`);
  ok(!/modo leve: .* deu erro/.test(log), 'sem erro no servidor');
} catch (e) {
  console.error('FALHOU', e); process.exitCode = 1;
} finally {
  if (process.exitCode) console.log('--- servidor ---\n' + log.split('\n').slice(-40).join('\n') + '\n--- falhas ---\n' + falhas.join('\n'));
  fim(); process.exit();
}
