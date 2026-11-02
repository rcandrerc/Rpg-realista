// Trava geral "Nada some": compara o ramo com a main e lista TUDO que já existia e o ramo apaga ou troca.
// Não depende de lista: vale para qualquer recurso que entrar no jogo, hoje ou no futuro.
//
//   - arquivo apagado (código, cena, dado, imagem, som, modelo...)
//   - asset trocado (imagem, som, modelo 3D, textura: o arquivo antigo some)
//   - função, constante, sinal, classe, método, mensagem do servidor, ação de botão apagada
//   - nó de cena (.tscn) apagado
//   - chave de dados apagada (json e tabelas do shared/dados.js)
//
// Uso: node ferramentas/protecao/nada-some.mjs [base] [ramo]     (padrão: origin/main e HEAD)
// Sai com 1 se algo sumiu. Com APROVADO=1 (etiqueta "remoção aprovada" no PR) só mostra a lista.
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const base = process.argv[2] || 'origin/main';
const ramo = process.argv[3] || 'HEAD';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const ler = (rev, f) => {
  try {
    if (f.endsWith('.json.gz')) return gunzipSync(execFileSync('git', ['show', `${rev}:${f}`], { maxBuffer: 256 * 1024 * 1024 })).toString('utf8');
    return git('show', `${rev}:${f}`);
  } catch { return null; }
};

// arquivos que mudam sozinhos a cada versão: não contam
const IGNORAR = [/\.apk$/, /\.import$/, /\.uid$/, /^package-lock\.json$/, /(^|\/)\.godot\//];
const ASSET = /\.(png|jpe?g|webp|svg|ogg|mp3|wav|glb|gltf|bin|vrm|fbx|obj|gz|ttf|otf|aar|jar)$/i;

// O que conta como "definição" em cada tipo de arquivo
function definicoes(arquivo, texto) {
  const d = new Set();
  const add = (tipo, nome) => d.add(`${tipo} ${nome}`);
  const linhas = texto.split('\n');
  if (/\.gd$/.test(arquivo)) {
    for (const l of linhas) {
      let m;
      if ((m = l.match(/^\s*(?:static\s+)?func\s+(\w+)/))) add('função', m[1]);
      else if ((m = l.match(/^(?:@\w+(?:\([^)]*\))?\s+)*(const|var|signal|enum|class)\s+(\w+)/))) add(m[1], m[2]);
      else if ((m = l.match(/^\t+"([\w:.-]+)"\s*(?:,\s*"[\w:.-]+"\s*)*:\s*(?:#.*)?$/))) add('ação', m[1]); // ramo de match
    }
  } else if (/\.(m?js|cjs)$/.test(arquivo)) {
    for (const l of linhas) {
      let m;
      if ((m = l.match(/\bfunction\s*\*?\s*(\w+)\s*\(/))) add('função', m[1]);
      if ((m = l.match(/^(?:export\s+)?(?:const|let|var|class)\s+(\w+)/))) add('definição', m[1]);
      if ((m = l.match(/^\s{2,4}(?:async\s+|static\s+|get\s+|set\s+)*(\w+)\s*\([^)]*\)\s*\{/)) && !/^(if|for|while|switch|catch|function)$/.test(m[1])) add('método', m[1]);
      for (const k of l.matchAll(/\bouvir\(\s*'(\w+)'/g)) add('mensagem', k[1]);
      for (const k of l.matchAll(/\.(?:on|onMessage)\(\s*['"](\w+)['"]/g)) add('mensagem', k[1]);
      if ((m = l.match(/^\s{2}(\w+)\s*:\s*[\[{'"\d-]/))) add('chave', m[1]); // tabelas do shared/dados.js
    }
  } else if (/\.tscn$/.test(arquivo)) {
    for (const m of texto.matchAll(/\[node name="([^"]+)"(?:[^\]]*parent="([^"]*)")?/g)) add('nó', (m[2] ? m[2] + '/' : '') + m[1]);
  } else if (/\.gdshader$/.test(arquivo)) {
    for (const l of linhas) {
      let m;
      if ((m = l.match(/^\s*uniform\s+\w+\s+(\w+)/))) add('uniform', m[1]);
      else if ((m = l.match(/^\w+\s+(\w+)\s*\([^;]*$/))) add('função', m[1]);
    }
  } else if (/\.json(\.gz)?$/.test(arquivo)) {
    try {
      const andar = (o, cam, prof) => {
        if (prof > 3 || o === null || typeof o !== 'object') return;
        if (Array.isArray(o)) { for (const it of o) if (it && typeof it === 'object' && 'id' in it) add('item', `${cam}[id=${it.id}]`); return; }
        for (const [k, v] of Object.entries(o)) { const c = cam ? `${cam}.${k}` : k; add('chave', c); andar(v, c, prof + 1); }
      };
      andar(JSON.parse(texto), '', 0);
    } catch { /* json inválido: o build acusa */ }
  }
  return d;
}

// 1) arquivos apagados, trocados ou renomeados
const sumiu = [];
const mudados = [];
for (const linha of git('diff', '--name-status', '-M', base, ramo).split('\n').filter(Boolean)) {
  const [st, a, b] = linha.split('\t');
  if (IGNORAR.some((r) => r.test(a))) continue;
  if (st === 'D') sumiu.push(`arquivo apagado: ${a}`);
  else if (st.startsWith('R')) { if (st !== 'R100' && ASSET.test(a)) sumiu.push(`asset trocado ao mudar de lugar: ${a} -> ${b}`); mudados.push([a, b]); }
  else if (st === 'M' && a.endsWith('.json.gz')) mudados.push([a, a]); // dados compactados: confere as chaves de dentro
  else if (st === 'M') { if (ASSET.test(a)) sumiu.push(`asset trocado (o antigo some): ${a}`); else mudados.push([a, a]); }
}

// 2) definições que existiam e sumiram (se só mudou de arquivo, não conta)
const perdidas = [];
for (const [a, b] of mudados) {
  if (ASSET.test(a) && !a.endsWith('.json.gz')) continue;
  const antes = ler(base, a); const depois = ler(ramo, b);
  if (antes == null || depois == null) continue;
  const da = definicoes(a, antes); if (!da.size) continue;
  const dd = definicoes(b, depois);
  for (const x of da) if (!dd.has(x)) perdidas.push([a, x]);
}
if (perdidas.length) {
  // a definição pode ter ido para outro arquivo do mesmo tipo: procura no ramo inteiro
  const ext = (f) => f.slice(f.lastIndexOf('.'));
  const exts = new Set(perdidas.map(([f]) => ext(f)));
  const todas = new Map();
  for (const f of git('ls-tree', '-r', '--name-only', ramo).split('\n')) {
    if (!exts.has(ext(f))) continue;
    if (!todas.has(ext(f))) todas.set(ext(f), new Set());
    const t = ler(ramo, f); if (t) for (const x of definicoes(f, t)) todas.get(ext(f)).add(x);
  }
  for (const [f, x] of perdidas) if (!todas.get(ext(f))?.has(x)) sumiu.push(`${x} sumiu de ${f}`);
}

const titulo = `Nada some: ${sumiu.length ? sumiu.length + ' coisa(s) que já existiam somem com este ramo' : 'nada que já existia foi apagado ou trocado'}`;
console.log(titulo);
for (const s of sumiu) console.log('  - ' + s);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${titulo}\n${sumiu.map((s) => `- ${s}`).join('\n')}\n`);
}
if (sumiu.length) {
  if (process.env.APROVADO === '1') { console.log('\nEtiqueta "remoção aprovada" no PR: o André pediu essas remoções. Liberado.'); process.exit(0); }
  console.log('\nSe foi sem querer (merge, conflito resolvido para um lado só, ramo velho), traga de volta.');
  console.log('Se o André pediu para tirar ou trocar, coloque a etiqueta "remoção aprovada" no PR e cite o pedido dele na descrição.');
  process.exit(1);
}
