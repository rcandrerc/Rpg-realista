// Trava (André 2026-11-26): com o repositório PRIVADO nenhum job pode cair nas máquinas do GitHub, que gastam a cota
// de minutos dividida com os outros repositórios dele. Este teste lê todo `runs-on` de .github/workflows e calcula o
// resultado no pior caso: repositório privado e NENHUMA variável RUNNER_* definida, na main e em ramo de PR.
// Tem que sair um rótulo das máquinas da Oracle (aethra-*). Exceção conhecida: apk.yml `modelos` (Chromium não roda no
// ARM; só exporta quando os modelos mudam, 0 vezes de 19 a 26/11).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PASTA = path.join(RAIZ, '.github', 'workflows');
const EXCECOES = new Set(['apk.yml:modelos']);

function avaliar(expr, ref) {
  const js = expr
    .replace(/github\.event\.repository\.private/g, 'true')
    .replace(/inputs\.[\w-]+/g, "''")
    .replace(/vars\.\w+/g, "''")
    .replace(/github\.ref\b/g, JSON.stringify(ref));
  if (/[a-z_]\w*\.\w/i.test(js.replace(/'[^']*'/g, ''))) throw new Error(`expressão que o teste não sabe ler: ${expr}`);
  return Function(`return (${js});`)();
}

const erros = [];
let vistos = 0;
for (const arq of fs.readdirSync(PASTA).filter((f) => /\.ya?ml$/.test(f))) {
  let job = '?';
  for (const linha of fs.readFileSync(path.join(PASTA, arq), 'utf8').split('\n')) {
    const j = linha.match(/^  ([\w-]+):\s*$/);
    if (j) job = j[1];
    const m = linha.match(/^\s+runs-on:\s*(.+?)\s*$/);
    if (!m) continue;
    vistos++;
    if (EXCECOES.has(`${arq}:${job}`)) continue;
    const e = m[1].match(/^\$\{\{\s*([\s\S]+?)\s*\}\}$/);
    for (const ref of ['refs/heads/main', 'refs/pull/1/merge']) {
      const r = e ? avaliar(e[1], ref) : m[1];
      if (!r || !/^aethra-/.test(String(r))) erros.push(`${arq} job ${job} (${ref}): repositório privado sem variáveis cai em "${r || 'nada'}"`);
    }
  }
}
if (!vistos) { console.error('nenhum runs-on encontrado'); process.exit(1); }
if (erros.length) { console.error(erros.join('\n')); process.exit(1); }
console.log(`ok: ${vistos} runs-on, nenhum vai para máquina do GitHub com o repositório privado`);
