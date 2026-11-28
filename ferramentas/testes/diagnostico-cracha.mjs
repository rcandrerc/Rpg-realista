// Páginas de diagnóstico (Segurança 2026-11-19, Presidente; os BAIXOS da revisão antes do lançamento):
// - /lentidao, /lentidao/resumo e /lentidao/celulares abertos só com números gerais (sem código do aparelho nem posição);
//   o detalhe e o filtro ?inst= só com o crachá da ronda e dos robôs
// - /npcs.json: posição dos NPCs (x, z, morto, preso) só com o crachá
// - /saude: ler não zera mais nada
// - /conta/robo: trava de 5 s por conta de robô (antes uma só para todos); 50 contas de carga para o teste do QA
// Liga o servidor de verdade com ROBO_TESTE (o atalho de teste do crachá, que nunca existe na Oracle).
// Uso: node ferramentas/testes/diagnostico-cracha.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-cracha-'));
const PORTA = 2900 + Math.floor(Math.random() * 200), TESTE = 'teste-' + Math.random().toString(36).slice(2);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const linha = (inst, ap) => JSON.stringify({ servidor: Date.now(), fps: 28, x: 123, z: -45, inst, ap, versao: 'v1', placa: 'Mali-G72' });
fs.writeFileSync(path.join(pasta, 'lentidao.jsonl'), [linha('a1b2c3d4', 'Poco X7'), linha('0f0f0f0f', 'Note 10')].join('\n') + '\n');
fs.writeFileSync(path.join(pasta, 'lentidao-resumo.jsonl'), linha('a1b2c3d4', 'Poco X7') + '\n');

const srv = spawn(process.execPath, ['index.js'], { cwd: path.join(raiz, 'server'), env: { ...process.env, DADOS: pasta, PORT: String(PORTA), ROBO_TESTE: TESTE }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
const fim = () => { try { srv.kill(); } catch { /* já saiu */ } fs.rmSync(pasta, { recursive: true, force: true }); };
process.on('exit', fim);
let HOST = '';
for (let i = 0; i < 360 && !HOST; i++) {
  for (const h of ['127.0.0.1', '[::1]']) { try { if ((await fetch(`http://${h}:${PORTA}/saude`)).ok) { HOST = h; break; } } catch { /* ainda ligando */ } }
  if (!HOST) await esperar(250);
}
if (!HOST) { console.error('FALHOU o servidor não ligou em 90 s\n' + log.slice(-2000)); process.exit(1); }
const U = `http://${HOST}:${PORTA}`;
const get = async (p) => (await fetch(U + p)).json();

// /lentidao aberto: sem inst, sem x/z, e ?inst= não filtra
const l0 = await get('/lentidao');
ok(l0.length === 2 && l0.every((x) => !('inst' in x) && !('x' in x) && !('z' in x) && x.fps === 28 && x.ap), 'aberto: números gerais, sem código do aparelho nem posição');
ok((await get('/lentidao?inst=a1b2c3d4')).length === 2, 'aberto: ?inst= não separa um aparelho');
ok((await get('/lentidao?ap=Poco%20X7')).length === 2, 'aberto: ?ap= também não separa (modelo raro vira impressão digital)');
ok(l0.every((x) => !('placa' in x) && x.servidor % 3600e3 === 0), 'aberto: sem placa e com a hora arredondada');
ok((await get('/lentidao/resumo')).every((x) => !('inst' in x) && !('x' in x)), 'resumo aberto também sem código e posição');
const c0 = await get('/lentidao/celulares');
ok(c0.length === 2 && c0.every((x) => !('inst' in x) && !('ultima' in x) && x.ap), 'celulares aberto: por modelo, sem o código nem a última hora');
// com o crachá (aqui o atalho de teste): tudo
const l1 = await get(`/lentidao?inst=a1b2c3d4&teste=${TESTE}`);
ok(l1.length === 1 && l1[0].inst === 'a1b2c3d4' && l1[0].x === 123, 'com crachá: ?inst= separa o aparelho, com posição');
ok((await get(`/lentidao/celulares?teste=${TESTE}`)).some((x) => x.inst === '0f0f0f0f'), 'com crachá: celulares com o código');
ok((await get('/lentidao?teste=errado')).every((x) => !('inst' in x)), 'crachá errado: como aberto');
ok((await fetch(U + '/lentidao', { headers: { Authorization: 'Bearer a.b.c' } })).ok, 'crachá quebrado não derruba a página');

// /npcs.json: sem posição sem crachá
const n0 = await get('/npcs.json');
ok(Array.isArray(n0.npcs) && n0.npcs.every((x) => !('x' in x) && !('z' in x) && !('morto' in x) && !('evolucao' in x) && !('missao' in x)), '/npcs.json aberto: sem posição, missão nem diário dos NPCs');
ok(!('recrutas' in n0), '/npcs.json aberto: sem os recrutas dos clãs dos jogadores');
ok(!('jogadores' in n0), '/npcs.json aberto: sem o medidor de grind dos jogadores (André 2026-11-28, server/medidor.js)');
const n1 = await get(`/npcs.json?teste=${TESTE}`);
ok(Array.isArray(n1.recrutas), `/npcs.json com crachá: lista dos clãs dos jogadores (${JSON.stringify(n1.recrutas).slice(0, 80)})`);
ok(Array.isArray(n1.jogadores), `/npcs.json com crachá: o medidor de grind dos jogadores (${JSON.stringify(n1.jogadores).slice(0, 80)})`);

// /saude: ler não zera
const s1 = await get('/saude'), s2 = await get('/saude');
ok(s1.ok && 'tickPicoMs' in s1 && s2.tickPicoMs >= s1.tickPicoMs && s2.engasgos >= s1.engasgos && s2.janelaS === 60, `/saude lido duas vezes: o pico não volta a zero (${s1.tickPicoMs} -> ${s2.tickPicoMs} ms)`);

// /conta/robo: trava por conta, não global
const robo = (corpo) => fetch(U + '/conta/robo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teste: TESTE, ...corpo }) });
const r1 = await robo({}); const j1 = await r1.json();
ok(r1.ok && j1.conta?.robo, 'robô 1 entra');
ok((await robo({})).status === 429, 'o mesmo robô em menos de 5 s: devagar');
const cargas = await Promise.all([1, 2, 3, 50].map((k) => robo({ carga: k }).then(async (r) => ({ s: r.status, j: await r.json() }))));
ok(cargas.every((x) => x.s === 200 && x.j.conta?.robo), 'quatro robôs de carga entram juntos (cada um com a sua trava)');
ok(new Set(cargas.map((x) => x.j.conta.id)).size === 4 && !cargas.some((x) => x.j.conta.id === j1.conta.id), 'cada robô de carga tem conta própria');
ok(/Robô carga 50/.test(cargas[3].j.conta.nome), `nome da conta: ${cargas[3].j.conta.nome}`);
const r51 = await (await robo({ carga: 51 })).json().catch(() => null);
ok(r51?.erro === 'devagar', 'carga 51 (fora da faixa) vira o robô 1, que ainda está na trava');
ok((await fetch(U + '/conta/robo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"teste":"errado"}' })).status === 401, 'sem crachá: não é o robô');
process.exit();
