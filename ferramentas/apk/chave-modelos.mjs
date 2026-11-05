// Chave do cache dos modelos (vila, personagens, monstros, minimapa) do apk.yml.
// Antes a chave era o hash de client/** e shared/** inteiros: qualquer mudança numa regra do servidor
// (shared/simulacao.js) ou num número de dados.js que nada tem a ver com modelo fazia o build exportar tudo de novo
// no Chromium (~6 min a mais, 2026-11-05: 8 de 12 merges do dia). Agora a chave só muda com o que os modelos usam:
//  - os arquivos do client/ que a exportação carrega (seguindo os import a partir das páginas de exportação);
//    arquivo novo ou que não dá para saber entra na conta, por segurança;
//  - os arquivos de shared/ exceto dados.js, simulacao.js, progresso.js e conta.js (regras e contas, não desenho);
//  - de dados.js, só o VALOR dos nomes que a exportação importa de @rpg/shared (MAPA_CLAREIRA, A, CRIADOR...).
//    Se algum arquivo importar @rpg/shared de um jeito que não dá para ler (import * ...), entra o dados.js inteiro;
//  - package-lock.json e o próprio apk.yml não entram (o apk.yml já reconfere os modelos byte a byte).
// Uso: node ferramentas/apk/chave-modelos.mjs   → imprime o hash (e a lista do que entrou, com --lista)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (f) => path.relative(RAIZ, f).split(path.sep).join('/');
const ENTRADAS = ['client/exportar-godot/gerar-modelos.mjs', 'client/exportar-godot/index.html', 'client/exportar-godot/exportar.js', 'client/exportar-bestiario-godot.html'];
const SHARED_FORA = new Set(['dados.js', 'simulacao.js', 'progresso.js', 'conta.js', 'index.js', 'package.json']);

// 1) arquivos JS do client/ que a exportação alcança
const alcancados = new Set();
const nomesShared = new Set();
let sharedInteiro = false;
const RE_IMPORT = /(?:import|export)\s*(?:([\s\S]*?)\s*from\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
function ler(arq) {
  if (alcancados.has(arq) || !fs.existsSync(arq)) return;
  alcancados.add(arq);
  const txt = fs.readFileSync(arq, 'utf8');
  // const { X, Y } = await import('/@id/@rpg/shared') no gerar-modelos.mjs
  for (const m of txt.matchAll(/\{([^}]*)\}\s*=\s*await\s+import\(\s*['"][^'"]*@rpg\/shared['"]\s*\)/g)) m[1].split(',').forEach((n) => n.trim() && nomesShared.add(n.trim().split(/\s*:\s*/)[0]));
  for (const m of txt.matchAll(RE_IMPORT)) {
    const spec = m[2] || m[3], clausula = m[1];
    if (!spec) continue;
    if (spec.endsWith('@rpg/shared')) {
      if (m[3]) continue; // dynamic import: nomes lidos acima
      const chaves = clausula && clausula.match(/^\{([^}]*)\}$/);
      if (!chaves) { sharedInteiro = true; continue; }
      chaves[1].split(',').forEach((n) => n.trim() && nomesShared.add(n.trim().split(/\s+as\s+/)[0]));
      continue;
    }
    let alvo;
    if (spec.startsWith('.')) alvo = path.resolve(path.dirname(arq), spec);
    else if (spec.startsWith('/src/') || spec.startsWith('/exportar')) alvo = path.join(RAIZ, 'client', spec);
    else continue; // pacotes do npm (three, fflate...): entram pelo package-lock.json
    if (rel(alvo).startsWith('shared/')) continue; // shared/ entra inteiro (fora a lista SHARED_FORA)
    ler(alvo);
  }
}
for (const e of ENTRADAS) ler(path.join(RAIZ, e));
for (const n of ['src/vila.js', 'src/minimapa.js']) ler(path.join(RAIZ, 'client', n)); // importados dentro do page.evaluate

// 2) lista de arquivos: client/ inteiro menos os .js/.mjs que a exportação não alcança
function listar(dir) {
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name === 'node_modules' || d.name === 'dist' || d.name.startsWith('.')) continue;
    const f = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...listar(f)); else out.push(f);
  }
  return out;
}
const arquivos = listar(path.join(RAIZ, 'client')).filter((f) => {
  const r = rel(f);
  return !(/\.m?js$/.test(r) && r !== 'client/vite.config.js' && !alcancados.has(f)); // mundo.mjs, longe.mjs, main.js...
});
for (const f of fs.readdirSync(path.join(RAIZ, 'shared'))) if (!SHARED_FORA.has(f) || (f === 'dados.js' && sharedInteiro)) arquivos.push(path.join(RAIZ, 'shared', f));
arquivos.push(path.join(RAIZ, 'package-lock.json'));
arquivos.sort((a, b) => (rel(a) < rel(b) ? -1 : 1));

const h = crypto.createHash('sha256');
for (const f of arquivos) h.update(rel(f) + '\0').update(fs.readFileSync(f)).update('\0');

// 3) valores de dados.js que a exportação usa (função entra pelo código-fonte)
const dados = await import(pathToFileURL(path.join(RAIZ, 'shared', 'dados.js')).href);
function estavel(v, vistos = new Set()) {
  if (typeof v === 'function') return 'fn:' + v.toString();
  if (v === undefined) return 'undef';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (vistos.has(v)) return '"<ciclo>"';
  vistos.add(v);
  const s = Array.isArray(v) ? '[' + v.map((x) => estavel(x, vistos)).join(',') + ']'
    : v instanceof Map || v instanceof Set ? estavel([...v], vistos)
      : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + estavel(v[k], vistos)).join(',') + '}';
  vistos.delete(v);
  return s;
}
const usados = [...nomesShared].filter((n) => n in dados).sort();
for (const n of usados) h.update('dados.' + n + '\0' + estavel(dados[n]) + '\0');

if (process.argv.includes('--lista')) {
  console.error('arquivos:\n  ' + arquivos.map(rel).join('\n  '));
  console.error('de dados.js:', sharedInteiro ? '(arquivo inteiro)' : usados.join(', '));
  console.error('client fora:', listar(path.join(RAIZ, 'client')).filter((f) => /\.m?js$/.test(f) && !arquivos.includes(f)).map(rel).join(', '));
}
console.log(h.digest('hex'));
