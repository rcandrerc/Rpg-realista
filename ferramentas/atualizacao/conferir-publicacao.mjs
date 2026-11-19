// Robô diário da publicação (frente 2, portão de 10/12; Presidente 2026-11-19): confere de fora, sem entrar em máquina
// nenhuma, se o que o jogo baixa está inteiro e em dia.
//   1. o cardápio do app (conteudo-4.7.json) é o mesmo no Pages e no balde da Oracle;
//   2. cada pedaço que o cardápio do balde lista existe no balde (e com o tamanho certo, quando não vem compactado);
//   3. o pacote do servidor é o mesmo no Pages e no balde;
//   4. o site não está parado: nada da main passou do prazo de publicar (na hora, ou no disparo das 04:40/13:40 quando
//      mexeu em shared/; ver janela-publicar.mjs);
//   5. o servidor do jogo não ficou para trás: a versão que roda (/saude) é a do último pacote, ou o pacote ainda está
//      dentro do prazo da janela de instalação (server/atualizar.js).
// Sai com 1 se algo falhou (o job fica vermelho e a ronda das 9h vê). Uso: node ferramentas/atualizacao/conferir-publicacao.mjs
// (precisa do histórico do git: checkout com fetch-depth 0).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { podeInstalar } from '../../server/atualizar.js';
import { decide } from './janela-publicar.mjs';

const BALDE = (process.env.ORACLE_URL || 'https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/').replace(/\/?$/, '/');
const PAGES = 'https://rcandrerc.github.io/Rpg-realista/';
const SERVIDOR = process.env.SERVIDOR_URL || 'https://163-176-80-126.sslip.io';
const CARDAPIO = 'conteudo-4.7.json';
const MIN = 60e3;
const FOLGA_PUBLICAR = 120 * MIN; // merge sem shared/: o site sai em minutos; 2 h cobre fila do runner e build do APK
const FOLGA_JANELA = 90 * MIN; // o disparo agendado do GitHub às vezes atrasa
const FOLGA_INSTALAR = 30 * MIN;

// Todos os pedaços que um cardápio manda baixar: completo (partes), deltas e a ponte (corrente nova).
export function partesDoCardapio(c) {
  const lista = [...(c?.completo?.partes || []), ...(c?.deltas || []), ...(c?.ponte?.deltas || [])];
  const vistos = new Map();
  for (const p of lista) if (p && typeof p.arq === 'string' && !vistos.has(p.arq)) vistos.set(p.arq, p);
  return [...vistos.values()];
}

// JSON igual sem ligar para a ordem das chaves.
export function mesmoJson(a, b) {
  const canon = (v) => (Array.isArray(v) ? v.map(canon)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

// Próximo disparo agendado (07:40 e 16:40 UTC = 04:40 e 13:40 de Brasília) que publicaria shared/, depois de t.
export function proximoDisparo(t) {
  const dia = Math.floor(t / 86400e3) * 86400e3;
  for (let d = 0; d < 4; d++) {
    for (const hm of [7 * 60 + 40, 16 * 60 + 40]) {
      const quando = dia + d * 86400e3 + hm * MIN;
      if (quando > t && decide({ evento: 'schedule', mudou: ['shared/'], agora: quando }).publicar) return quando;
    }
  }
  return t + 3 * 86400e3; // bloqueio longo: não acusa antes de 3 dias
}

// commits = merges da main ainda não publicados, do mais velho ao mais novo: [{ sha, quando (ms), arquivos }].
// Devolve os que passaram do prazo. Só .md não publica nada (paths-ignore do pages.yml): não conta.
export function atrasados(commits, agora) {
  let sharedEsperando = false;
  const fora = [];
  for (const c of commits) {
    const conta = c.arquivos.some((f) => !f.endsWith('.md'));
    if (c.arquivos.some((f) => f.startsWith('shared/'))) sharedEsperando = true;
    if (!conta) continue;
    const prazo = sharedEsperando ? proximoDisparo(c.quando) + FOLGA_JANELA : c.quando + FOLGA_PUBLICAR;
    if (agora > prazo) fora.push({ ...c, prazo });
  }
  return fora;
}

// Até quando o servidor deve ter instalado um pacote publicado em t: a primeira conferência (a cada 5 min) dentro de
// uma janela de instalação, mais folga. Pacote urgente instala na hora.
export function prazoInstalar(t, urgente = false) {
  for (let x = t + 5 * MIN; x < t + 4 * 86400e3; x += 5 * MIN) if (podeInstalar(x, urgente)) return x + FOLGA_INSTALAR;
  return t + 4 * 86400e3;
}

async function buscar(url, metodo = 'GET') {
  const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { method: metodo, cache: 'no-store' });
  return r;
}
async function texto(url) { try { const r = await buscar(url); return r.ok ? (await r.text()).trim() : null; } catch { return null; } }
async function json(url) { const t = await texto(url); try { return t ? JSON.parse(t) : null; } catch { return null; } }
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

async function conferir() {
  const problemas = [];
  const notas = [];
  const agora = Date.now();

  // 1 e 2: cardápio do app
  const [doPages, doBalde] = await Promise.all([json(`${PAGES}atualizacao/${CARDAPIO}`), json(`${BALDE}${CARDAPIO}`)]);
  if (!doPages) problemas.push(`Pages sem ${CARDAPIO}`);
  if (!doBalde) problemas.push(`balde sem ${CARDAPIO}`);
  if (doPages && doBalde && !mesmoJson(doPages, doBalde)) {
    problemas.push(`cardápio diferente: Pages versão ${doPages.versao} (${doPages.commit}), balde versão ${doBalde.versao} (${doBalde.commit})`);
  }
  if (doBalde) {
    const base = (doBalde.url_base || BALDE).replace(/\/?$/, '/');
    const partes = partesDoCardapio(doBalde);
    let faltam = 0;
    for (const p of partes) {
      let r = null;
      try { r = await buscar(`${base}${p.arq}`, 'HEAD'); } catch { /* conta como faltando */ }
      if (!r || !r.ok) { problemas.push(`balde sem o pedaço ${p.arq} (HTTP ${r?.status ?? 'sem resposta'})`); faltam++; continue; }
      const gzip = /gzip/i.test(r.headers.get('content-encoding') || '');
      const tam = Number(r.headers.get('content-length'));
      if (!gzip && p.tamanho && tam && tam !== p.tamanho) problemas.push(`pedaço ${p.arq} com ${tam} bytes no balde (cardápio diz ${p.tamanho})`);
    }
    notas.push(`cardápio ${doBalde.versao} (${doBalde.commit}): ${partes.length - faltam} de ${partes.length} pedaços no balde`);
  }

  // 3: pacote do servidor
  const [pacPages, pacBalde] = await Promise.all([texto(`${PAGES}servidor/pacote-versao.txt`), texto(`${BALDE}servidor/pacote-versao.txt`)]);
  if (!pacPages || !pacBalde) problemas.push(`pacote do servidor faltando (Pages ${pacPages ? 'ok' : 'sem'}, balde ${pacBalde ? 'ok' : 'sem'})`);
  else if (pacPages !== pacBalde) problemas.push(`pacote do servidor diferente: Pages ${pacPages.slice(0, 12)}, balde ${pacBalde.slice(0, 12)}`);

  // 4: site parado?
  const noAr = await texto(`${BALDE}publicado.txt`);
  if (!noAr || !/^[0-9a-f]{40}$/.test(noAr)) {
    notas.push('balde ainda sem publicado.txt (sai na primeira publicação depois do #680): prazo de publicar não conferido');
  } else {
    let commits = null;
    try {
      git('cat-file', '-e', `${noAr}^{commit}`);
      const linhas = git('log', '--first-parent', '--reverse', '--format=%H %ct', `${noAr}..HEAD`).split('\n').filter(Boolean);
      commits = linhas.map((l) => {
        const [sha, ct] = l.split(' ');
        return { sha, quando: Number(ct) * 1000, arquivos: git('diff', '--name-only', `${sha}^1`, sha).split('\n').filter(Boolean) };
      });
    } catch (e) {
      problemas.push(`não achei o commit no ar (${noAr.slice(0, 7)}) no histórico da main: ${e.message.split('\n')[0]}`);
    }
    if (commits) {
      const fora = atrasados(commits, agora);
      for (const c of fora) problemas.push(`site parado: ${c.sha.slice(0, 7)} (main ${new Date(c.quando).toISOString()}) devia ter saído até ${new Date(c.prazo).toISOString()}`);
      notas.push(`no ar: ${noAr.slice(0, 7)}; ${commits.length} merge(s) da main ainda não publicados, ${fora.length} fora do prazo`);
    }
  }

  // 5: servidor para trás?
  const saude = await json(`${SERVIDOR}/saude`);
  const versaoServidor = saude?.servidor?.versao;
  if (!saude) problemas.push(`servidor do jogo sem resposta em ${SERVIDOR}/saude`);
  else if (!versaoServidor) notas.push('o /saude ainda não mostra a versão do servidor (entra com o passo 2 da assinatura)');
  else {
    const ultimo = [pacBalde, pacPages].filter(Boolean)[0] || '';
    if (ultimo && !ultimo.startsWith(versaoServidor)) {
      let publicado = agora;
      try {
        const r = await buscar(`${BALDE}servidor/pacote-versao.txt`, 'HEAD');
        publicado = Date.parse(r.headers.get('last-modified') || '') || agora;
      } catch { /* sem data: conta a partir de agora */ }
      const pacote = await json(`${BALDE}servidor/pacote.json`);
      const prazo = prazoInstalar(publicado, pacote?.urgente === true);
      if (agora > prazo) problemas.push(`servidor para trás: roda ${versaoServidor}, o pacote ${ultimo.slice(0, 12)} saiu ${new Date(publicado).toISOString()} e devia ter instalado até ${new Date(prazo).toISOString()}`);
      else notas.push(`servidor roda ${versaoServidor}; pacote ${ultimo.slice(0, 12)} espera a janela (prazo ${new Date(prazo).toISOString()})`);
    } else notas.push(`servidor em dia (${versaoServidor}${saude.servidor.assinaturaExigida ? ', assinatura exigida' : ''})`);
  }
  return { problemas, notas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let r = await conferir();
  // publicação no meio do caminho (balde antes do Pages) dá diferença por alguns minutos: confere de novo uma vez
  if (r.problemas.length && process.env.SEM_SEGUNDA_VOLTA !== '1') {
    console.log(`Primeira volta: ${r.problemas.length} problema(s); confiro de novo em 10 min.`);
    await new Promise((ok) => setTimeout(ok, 10 * MIN));
    r = await conferir();
  }
  const linhas = [
    r.problemas.length ? `## Publicação: ${r.problemas.length} problema(s)` : '## Publicação: tudo certo',
    ...r.problemas.map((p) => `- ❌ ${p}`),
    ...r.notas.map((n) => `- ${n}`),
  ];
  console.log(linhas.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, linhas.join('\n') + '\n');
  for (const p of r.problemas) console.log(`::error title=Publicação::${p}`);
  process.exit(r.problemas.length ? 1 : 0);
}
