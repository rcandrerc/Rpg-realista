// Confere que nenhum recurso que já está no jogo sumiu (lista em recursos.json).
// Uso: node ferramentas/protecao/conferir.mjs            -> confere a pasta atual
//      node ferramentas/protecao/conferir.mjs --main      -> também avisa se a lista perdeu linhas em relação à origin/main
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lista = JSON.parse(readFileSync(join(raiz, 'ferramentas/protecao/recursos.json'), 'utf8')).recursos;
const faltando = [];
for (const r of lista) {
  const caminho = join(raiz, r.arquivo);
  if (!existsSync(caminho)) { faltando.push(`${r.nome}: o arquivo ${r.arquivo} sumiu`); continue; }
  const texto = readFileSync(caminho, 'utf8');
  for (const t of r.contem) if (!texto.includes(t)) faltando.push(`${r.nome}: falta "${t}" em ${r.arquivo}`);
}

let tirados = [];
if (process.argv.includes('--main')) {
  try {
    const daMain = JSON.parse(execSync('git show origin/main:ferramentas/protecao/recursos.json', { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).recursos;
    const agora = new Set(lista.map((r) => r.nome));
    tirados = daMain.filter((r) => !agora.has(r.nome)).map((r) => r.nome);
  } catch { /* main ainda sem a lista */ }
}

if (tirados.length) {
  console.log('Atenção: este PR tira recursos da lista protegida. Só pode se o André pediu:');
  for (const n of tirados) console.log(`  - ${n}`);
  if (process.env.GITHUB_ACTIONS) for (const n of tirados) console.log(`::warning::Recurso tirado da lista protegida: ${n}`);
}
if (faltando.length) {
  console.log(`\n${faltando.length} recurso(s) que já estavam no jogo sumiram:`);
  for (const f of faltando) console.log(`  - ${f}`);
  console.log('\nSe foi sem querer (merge ou conflito resolvido para um lado só), traga o código de volta.');
  console.log('Se o André pediu para mudar ou tirar, atualize ferramentas/protecao/recursos.json no mesmo PR e diga isso na descrição.');
  process.exit(1);
}
console.log(`Tudo no lugar: ${lista.length} recursos conferidos.`);
