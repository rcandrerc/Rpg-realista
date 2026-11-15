// Robô 2 (ferramentas/robo/celular.gd): junta o que o app mediu (sem tela e com Vulkan por software), as linhas que o
// lentidao.gd do jogo mandou para o servidor local e compara com o turno anterior (perda de desempenho) e com os
// celulares de verdade (/lentidao/resumo da Oracle). Manda para a página /robo com o crachá OIDC do GitHub.
// Uso: node ferramentas/robo/celular-relatorio.mjs PASTA_DADOS_LOCAL saida-sem-tela.json [saida-vulkan.json]
import fs from 'node:fs';
import path from 'node:path';

const [pasta, ...saidas] = process.argv.slice(2);
const SERVIDOR = process.env.ROBO_HTTP || 'https://163-176-80-126.sslip.io';
const ler = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const linhas = (f) => { try { return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const mediana = (l) => { const a = l.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };

const R = { turno: `cel-${process.env.GITHUB_RUN_ID || Date.now()}`, tipo: 'celular', inicio: Number(process.env.INICIO_MS) || Date.now(), ultimo: Date.now(), ativo: false, modos: {}, problemas: [] };
for (const f of saidas) {
  const r = ler(f); if (r) { R.modos[r.modo] = r; continue; }
  // o Vulkan por software do GitHub às vezes trava no primeiro quadro (limite da máquina da nuvem, não do jogo)
  if (/vulkan/.test(path.basename(f))) R.problemas.push('Vulkan por software não desenhou desta vez (limite da máquina do GitHub, não do jogo): só a rodada sem tela valeu');
  else R.problemas.push(`O app não terminou (${path.basename(f)}): veja o log do GitHub`);
}

// o que o lentidao.gd do jogo anotou (igual ao celular): segundos ruins e o resumo de cada minuto
const lent = linhas(path.join(pasta, 'lentidao.jsonl')).filter((x) => !x.tipo);
const res = linhas(path.join(pasta, 'lentidao-resumo.jsonl'));
R.lentidao = { segundosRuins: lent.length, resumos: res.length, fps: mediana(res.map((x) => x.fps)), proc: mediana(res.map((x) => x.proc)), cpu: mediana(res.map((x) => x.cpu)),
  partes: Object.entries(lent.reduce((s, x) => { for (const [k, v] of Object.entries(x.qev || {})) s[k] = Math.max(s[k] || 0, v); return s; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8) };

// erros de script no log do app
for (const f of (process.env.LOGS || '').split(',').filter(Boolean)) {
  let txt = ''; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const erros = new Map();
  const ls = txt.split('\n');
  ls.forEach((l, i) => {
    if (!/^(SCRIPT ERROR|SHADER ERROR|ERROR):/.test(l)) return;
    // onde: o Godot põe "at: (C++)" e, no 4.5+, "GDScript backtrace ... [0] função (res://x.gd:12)" logo abaixo
    const prox = ls.slice(i + 1, i + 6), gd = prox.find((x) => /^\s+\[0\] /.test(x)), c = prox.find((x) => /^\s+at: /.test(x));
    const at = gd ? ` [${gd.trim().slice(4, 120)}]` : c ? ` [${c.trim().slice(4, 110)}]` : '';
    const k = l.slice(0, 160) + at; erros.set(k, (erros.get(k) || 0) + 1);
  });
  for (const [l, n] of [...erros].sort((a, b) => b[1] - a[1]).slice(0, 5)) R.problemas.push(`${l}${n > 1 ? ` (${n} vezes)` : ''}`);
}

const sem = R.modos['sem tela'];
if (sem) {
  for (const x of sem.travadas.piores.filter((q) => q.ms >= 250).slice(0, 6)) R.problemas.push(`Travada de ${x.ms} ms (processador) em ${x.trecho}, perto de x ${x.x} z ${x.z}, ${Math.round(x.t)} s depois de entrar`);
}

async function main() {
  // turno anterior: perda de desempenho (o mesmo passeio, a mesma máquina do GitHub)
  try {
    const lista = await (await fetch(`${SERVIDOR}/robo.json?n=60`, { signal: AbortSignal.timeout(15000) })).json();
    const antes = lista.filter((x) => x.tipo === 'celular' && x.modos?.['sem tela']).at(-1);
    const a = antes?.modos['sem tela'];
    if (a && sem) {
      R.antes = { turno: antes.turno, quando: antes.ultimo };
      for (const [n, T] of Object.entries(sem.trechos)) {
        const B = a.trechos?.[n]; if (!B) continue;
        if (T.proc > B.proc * 1.25 && T.proc - B.proc > 0.5) R.problemas.push(`Perda de desempenho em ${n}: scripts ${B.proc} → ${T.proc} ms por quadro`);
        if (T.p95 > B.p95 * 1.3 && T.p95 - B.p95 > 3) R.problemas.push(`Perda de desempenho em ${n}: 5% piores quadros ${B.p95} → ${T.p95} ms`);
      }
      if (sem.travadas.acima250 > (a.travadas?.acima250 || 0) + 3) R.problemas.push(`Mais travadas: ${a.travadas?.acima250 || 0} → ${sem.travadas.acima250} acima de 250 ms`);
      if (sem.mem_max > (a.mem_max || 0) * 1.2 && sem.mem_max - (a.mem_max || 0) > 50) R.problemas.push(`Memória subiu: ${a.mem_max} → ${sem.mem_max} MB`);
    }
  } catch (e) { console.log('sem turno anterior:', e.message); }
  // os celulares de verdade (Alta), para pôr do lado
  try {
    const rr = (await (await fetch(`${SERVIDOR}/lentidao/resumo`, { signal: AbortSignal.timeout(15000) })).json()).filter((x) => x.grafico === 2).slice(-60);
    if (rr.length) R.real = { resumos: rr.length, fps: mediana(rr.map((x) => x.fps)), proc: mediana(rr.map((x) => x.proc)), cpu: mediana(rr.map((x) => x.cpu)), gpu: mediana(rr.map((x) => x.gpu)), pior: mediana(rr.map((x) => x.pior)) };
  } catch { /* sem dados */ }
  R.ultimo = Date.now();
  fs.writeFileSync('celular-relatorio.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1).slice(0, 4000));
  resumoGithub();
  if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) return console.log('sem crachá do GitHub: relatório só no arquivo');
  try {
    const tk = await (await fetch(`${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=age-of-embers-robo`, { headers: { Authorization: `bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } })).json();
    const r = await fetch(`${SERVIDOR}/robo/relatorio`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk.value}` }, body: JSON.stringify(R), signal: AbortSignal.timeout(20000) });
    console.log('relatório:', r.status, await r.text());
  } catch (e) { console.log('relatório não foi:', e.message); }
}
function resumoGithub() {
  const f = process.env.GITHUB_STEP_SUMMARY; if (!f) return;
  const l = ['## Robô 2 · o app como no Poco X7', ''];
  for (const [m, r] of Object.entries(R.modos)) {
    l.push(`### ${m} (${r.placa})`, `FPS ${r.fps} · travadas >100 ms ${r.travadas.acima100}, >250 ms ${r.travadas.acima250}, >1 s ${r.travadas.acima1000} · memória ${r.mem_max} MB · nós ${r.nos_max}`, '', '| trecho | FPS | quadro p50 | p95 | p99 | pior | scripts ms | chamadas | mil tri |', '|---|---|---|---|---|---|---|---|---|');
    for (const [n, T] of Object.entries(r.trechos)) l.push(`| ${n} | ${T.fps} | ${T.p50} | ${T.p95} | ${T.p99} | ${T.pior} | ${T.proc} | ${T.cham} | ${T.tri} |`);
    l.push('');
  }
  l.push('### Achados', ...(R.problemas.length ? R.problemas.map((p) => `- ${p}`) : ['- nenhum']));
  try { fs.appendFileSync(f, l.join('\n') + '\n'); } catch { /* sem resumo */ }
}
main();
