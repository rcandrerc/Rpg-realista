// Idioma / Language (André 2026-11-14: jogo em inglês para divulgar em sites gringos; só Português e English, com
// bandeirinha). Trava: o dicionário abre, não tem chave repetida (em JSON a última ganha calada), o inglês tem os
// mesmos números que o português, a linha das Configurações existe com as duas bandeiras e a IA da Cecília e do Dario
// responde em inglês quando o jogador escolhe English. Uso: node ferramentas/testes/idioma.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mensagensConversa } from '../../server/ia-amiga.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const raiz = new URL('../../', import.meta.url).pathname;
const gd = (f) => readFileSync(raiz + 'godot-prototipo/' + f, 'utf8');

// ---------- dicionário ----------
const bruto = gd('dados/idioma_en.json');
let D = null;
try { D = JSON.parse(bruto); } catch (e) { ok(false, 'dados/idioma_en.json abre: ' + e.message); }
ok(D && Object.keys(D).length > 400, `dicionário inglês com ${D ? Object.keys(D).length : 0} frases`);
const chaves = [...bruto.matchAll(/^"((?:[^"\\]|\\.)*)":/gm)].map((r) => r[1]);
const vistas = new Set(), repetidas = chaves.filter((k) => vistas.has(k) || !vistas.add(k));
ok(repetidas.length === 0, `nenhuma chave repetida no dicionário ${repetidas.slice(0, 3).join(' | ')}`);
const formato = /%[-+0-9.]*[sdf]/g;
const ruins = [];
for (const [pt, en] of Object.entries(D || {})) {
  if (pt.startsWith('_')) continue;
  if (typeof en !== 'string' || en === '') { ruins.push(pt + ' (vazio)'); continue; }
  const n = (pt.replaceAll('%%', '').match(formato) || []).length || new Set(pt.match(/\{\d+\}/g) || []).size; // %s/%d ou {1}..{n} (frase que o servidor monta)
  if (en.includes('{1}') || pt.includes('{1}')) { // ordem trocada: {1}..{n} só dos que existem
    const usa = [...en.matchAll(/\{(\d+)\}/g)].map((r) => +r[1]);
    if (usa.some((i) => i < 1 || i > n) || (pt.includes('{1}') && new Set(usa).size !== n)) ruins.push(pt);
  } else if (n !== (en.replaceAll('%%', '').match(formato) || []).length) ruins.push(pt);
}
ok(ruins.length === 0, `inglês com os mesmos %s/%d do português ${ruins.slice(0, 3).join(' | ')}`);
for (const k of ['Configurações', 'Mochila', 'Missões', 'Nível %d', 'Mestre Ivo · Resetar build', 'Títulos'])
  ok(D?.[k], `traduz "${k}" → "${D?.[k]}"`);
ok(D?.['Mestre Ivo · Resetar build']?.startsWith('Master Ivo'), 'nome próprio fica, título traduz (Mestre Ivo = Master Ivo)');

// ---------- falas prontas dos amigos virtuais (André 2026-11-15: em inglês, o chat sem IA da Cecília vinha em português) ----------
{
  const { AMIGOS_VIRTUAIS } = await import('../../shared/dados.js');
  const faltam = new Set();
  const chave = (t) => { let n = 0; return t.replace(/\{[a-z]+\}/gi, () => '{' + ++n + '}'); };
  const pular = new Set(['assuntos', 'visual', 'aparencia', 'equip', 'nome', 'papel', 'conta', 'id', 'gosto', 'jeito', 'ficha', 'prompt', 'memoria', 'cerebro']);
  // repertório único (2026-11-18): {feminino|masculino} vira as duas frases, cada uma com o seu inglês
  const generos = (t) => (/\{[^{}|]*\|[^{}|]*\}/.test(t) ? ['f', 'm'].map((g) => t.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (m, f, mm) => (g === 'm' ? mm : f))) : [t]);
  const andar = (o) => { if (typeof o === 'string') { for (const o2 of generos(o)) if (/[a-zà-ú]/i.test(o2) && o2.includes(' ') && !(o2 in D) && !(chave(o2) in D)) faltam.add(o2); } else if (Array.isArray(o)) o.forEach(andar); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!pular.has(k)) andar(v); };
  for (const A of AMIGOS_VIRTUAIS) for (const k of ['falas', 'falasColeta', 'falasTroca', 'falasEquip', 'chat', 'falasLeva']) andar(A?.[k]);
  ok(faltam.size === 0, `toda fala pronta da Cecília, do Dario e dos aventureiros tem inglês ${[...faltam].slice(0, 3).join(' | ')}`);
  ok(/begins_with\("a:"\)[\s\S]{0,200}Idioma\.frase\(texto\)/.test(gd('chat.gd')), 'chat: fala dos amigos virtuais sai no idioma do jogo');
}

// ---------- trava: texto novo em português precisa de inglês (André 2026-11-15: "joguei em inglês e várias janelas
// ainda vinham em português", ex.: a barrinha de criar dizia "Criando"). Três jeitos de escapar, os três travados aqui:
// 1) frase do jogo (.gd) sem chave no dicionário; 2) texto montado ("%s de %d", "a" + b) posto direto num Label/Button
// sem passar por Idioma (o Godot só traduz sozinho texto inteiro igual à chave); 3) aviso do servidor sem chave.
{
  const numerar = (t) => { let n = 0; return t.replaceAll('%%', '%').replace(/%[-+0-9.]*[sdf]/g, () => '{' + ++n + '}'); };
  const tem = (t) => t in D || numerar(t) in D || (t.includes('\n') && t.split('\n').every((l) => !l.trim() || l in D || numerar(l) in D));
  const PT = /[ãõçáéíóúâêôà]|\b(de|do|da|dos|das|para|com|não|você|seu|sua|uma|que|ao|no|na|em|pra|sem|aqui|toque|fale)\b/i;
  // fora da trava: abertura do APK (tem o inglês dela em inicio.gd), comandos de voz (palavras que o jogador fala),
  // logs de carregamento e o painel "Teste" de desempenho (só do André, números por quadro)
  const PULAR_ARQ = new Set(['inicio.gd', 'voz.gd', 'aquecer.gd', 'idioma.gd', 'lentidao.gd', 'robo_celular.gd']); // robo_celular.gd: só o robô de teste lê (log e página /robo)
  const PULAR = new Set(['Cecília', 'Português', 'LOD das malhas', 'Resolução cheia 1.0x', 'Sem sombra', 'Sem grama', 'Resolução menor 0.45x',
    'Sem mato alto', 'Sem personagens', 'Sem limite de FPS', 'Sem interface', 'Herói sem animação', 'Sem monstros',
    '%s: %.0f FPS · física %.1f · lógica %.1f · espera %.1f ms', '%s: %.0f FPS · física %.1f · lógica %.1f · desenho %.1f · espera %.1f · placa %.1f ms']);
  const arqs = readdirSync(raiz + 'godot-prototipo').filter((x) => x.endsWith('.gd'));
  const faltam = [], montados = [];
  const semString = (x) => x.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  for (const f of arqs) {
    const L = gd(f).split('\n');
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      if (/^\s*#/.test(l) || /\b(print|printerr|push_warning|push_error)\(/.test(l)) continue;
      // 1) toda frase em português do jogo tem inglês
      if (!PULAR_ARQ.has(f)) for (const r of l.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
        if (semString(l.slice(0, r.index)).includes('#')) break;
        const t = r[1].replaceAll('\\"', '"').replaceAll('\\n', '\n').replaceAll('\\t', '\t');
        if (!/[A-Za-zÀ-ú]{2}/.test(t) || !PT.test(t) || /^(res|user):\/\//.test(t) || PULAR.has(t)) continue;
        if (!t.includes(' ') && !/[ãõçáéíóúâêôà]/i.test(t)) continue; // id/chave de uma palavra
        if (/^[\s,.;:·(]|[\s(]$/.test(t)) continue; // pedaço de frase montada (a frase inteira é que tem chave)
        if (/^[a-z_]+:/.test(t) || /^b[:^]/.test(t)) continue; // chave interna (guia "b:Só esta")
        if (!tem(t)) faltam.push(`${f}:${i + 1} ${JSON.stringify(t).slice(0, 90)}`);
      }
      // 2) texto montado direto no Label/Button/dica sem Idioma
      if (!/\.(text|tooltip_text|placeholder_text|dialog_text)\s*\+?=(?!=)/.test(semString(l).split('#')[0])) continue;
      let cmd = l, j = i;
      const aberto = (x) => { x = semString(x).split('#')[0]; return (x.match(/[([{]/g) || []).length - (x.match(/[)\]}]/g) || []).length; };
      while (aberto(cmd) > 0 && j + 1 < L.length) cmd += ' ' + L[++j].trim();
      const m = cmd.match(/\.(text|tooltip_text|placeholder_text|dialog_text)\s*(\+?=)(?!=)\s*(.*)$/);
      if (!m || /Idioma\.|\btr\(/.test(m[3]) || PULAR_ARQ.has(f)) continue;
      const e = m[3];
      const lits = [...e.replace(/(get|has)\("[^"]*"/g, '').matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((r) => r[1].replace(/\[\/?[a-z]+(=[^\]]*)?\]/g, '')).filter((x) => /[A-Za-zÀ-ú]{2}/.test(x) && !PULAR.has(x.replaceAll('\\n', '\n')));
      const codigo = semString(e).split('#')[0].trim();
      if (!lits.length || codigo === '""' || (m[2] === '=' && /^""\s+if\s+.*\s+else\s+""$/.test(codigo))) continue;
      montados.push(`${f}:${i + 1} ${cmd.trim().slice(0, 100)}`);
    }
  }
  ok(faltam.length === 0, `toda frase do jogo em português tem inglês em dados/idioma_en.json (${faltam.length} sem) ${faltam.slice(0, 4).join(' | ')}`);
  ok(montados.length === 0, `texto montado no Label/Button passa por Idioma (o Godot só traduz texto inteiro) ${montados.slice(0, 3).join(' | ')}`);
  // 3) avisos do servidor (shared/ e server/): a frase vem montada em português e o app traduz pelo modelo {1}
  const semAviso = [];
  const temSrv = (t) => tem(t) || t.split(/\n|; |\. |: |, | · /).every((p) => !/[a-zà-ú]{3}/i.test(p) || p in D || p + '.' in D || /^\{\d+\}$/.test(p.trim()));
  for (const dir of ['shared', 'server']) for (const f of readdirSync(raiz + dir).filter((x) => x.endsWith('.js'))) {
    const s = readFileSync(raiz + `${dir}/${f}`, 'utf8');
    for (const r of s.matchAll(/aviso\(\s*(?:[a-z.]+,\s*)?(['`])((?:\\.|(?!\1)[^\\])*)\1(\s*\+(?!\s*\())?/g)) {
      let n = 0;
      const t = r[2].replace(/\$\{(?:[^{}]|\{[^}]*\})*\}/g, () => '{' + ++n + '}') + (r[3] ? '{' + ++n + '}' : ''); // 'Falta ' + x = "Falta {1}"
      if (/\}\{/.test(t)) continue; // montado só de pedaços ("Retirou {1}{2}{3}"): cada pedaço tem a chave dele
      if (/[a-zà-ú]{3}/i.test(t) && !/\$\{/.test(r[2].replace(/\$\{(?:[^{}]|\{[^}]*\})*\}/g, '')) && !temSrv(t))
        semAviso.push(`${dir}/${f}:${s.slice(0, r.index).split('\n').length} ${t.slice(0, 70)}`);
    }
  }
  ok(semAviso.length === 0, `todo aviso do servidor tem inglês ${semAviso.slice(0, 3).join(' | ')}`);
  // a abertura do APK (inicio.gd) não carrega o idioma do jogo: o inglês dela mora nela
  const ini = gd('inicio.gd');
  const textosIni = [...ini.matchAll(/_texto\("([^"]+)"(?:\s+if[^,]+else\s+"([^"]+)")?,\s*"([^"%]*)"/g)].flatMap((r) => [r[1], r[2], r[3]]).filter(Boolean);
  const semIni = textosIni.filter((t) => !ini.includes(`"${t}": "`));
  ok(textosIni.length > 8 && semIni.length === 0, `abertura (atualização) em inglês: ${textosIni.length} frases ${semIni.slice(0, 3).join(' | ')}`);
  // casos que o André viu (2026-11-15)
  ok(/txt_fab\.text = Idioma\.t\(/.test(gd('construcao.gd')) && D['Criando'] === 'Crafting' && D['Destruindo'] && D['Evoluindo'], 'barrinha de criar: "Crafting Iron Bar · 2 of 3"');
  ok(/l\.text = Idioma\.frase\(nome\)/.test(gd('main.gd')), 'nome em cima do monstro e do NPC: "Magma Golem  Lv 28"');
  ok(/static func _refazer\(/.test(gd('idioma.gd')) && /_refazer\(\(arvore as SceneTree\)\.root\)/.test(gd('idioma.gd')), 'trocar o idioma no meio do jogo refaz os textos que já estão na tela');
}

// ---------- Configurações > Idioma / Language ----------
const topo = gd('menu_topo.gd'), id = gd('idioma.gd');
ok(/func montar_config\(\)[\s\S]*?_idioma\(\)[\s\S]*?_qualidade_grafica\(\)/.test(topo), 'Configurações: linha Idioma / Language');
ok(id.includes('const LISTA := ["pt", "en"]'), 'só Português e English');
ok(/func bandeira\(/.test(id) && id.includes('"en"') && /Color\(0\.0, 0\.61, 0\.23\)/.test(id), 'bandeiras do Brasil e dos EUA desenhadas no jogo');
ok(id.includes('OS.get_locale_language() == "en"'), 'celular em inglês abre em English; senão Português');
ok(gd('main.gd').includes('Idioma.iniciar()'), 'main.gd carrega o idioma antes dos textos');
ok(gd('hud.gd').includes('aviso_txt = Idioma.frase(t)'), 'avisos (do jogo e do servidor) passam pelo inglês');

// ---------- IA dos NPCs amigos ----------
const ctx = { nome: 'Cecília', amigo: 'Ana', genero: 'f', fazendo: 'caçando', distancia: 3, nivel: 5, nivelAmigo: 5, amizade: 1, conversa: [] };
ok(!mensagensConversa(ctx, 'oi')[0].content.includes('plays the game in English'), 'jogo em português: IA em português');
ok(mensagensConversa({ ...ctx, idioma: 'en' }, 'hi')[0].content.includes('plays the game in English'), 'jogo em English: IA responde em inglês');
const idx = readFileSync(raiz + 'server/index.js', 'utf8');
ok(idx.includes("this.ouvir('idioma'") && idx.includes("ctx.idioma = c.userData?.idioma"), 'servidor guarda o idioma de quem joga e passa para a IA');
ok(gd('online.gd').includes('rede.enviar("idioma"'), 'app avisa o servidor do idioma ao entrar');

// ---------- motor no Godot (opcional): frases montadas e várias linhas ----------
const godot = process.env.GODOT || '';
if (godot && existsSync(godot)) {
  let saida = '';
  try { saida = execFileSync(godot, ['--headless', '--path', 'godot-prototipo', '--script', '../ferramentas/testes/idioma-godot.gd'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }); } catch (e) { saida = String(e.stdout || '') + String(e.stderr || ''); }
  const r = saida.match(/idioma: (\d+) ok, (\d+) falhas/);
  ok(r && +r[2] === 0 && +r[1] > 0 && !/SCRIPT ERROR/.test(saida), `frases montadas no Godot (${r ? r[0] : saida.slice(-300)})`);
  // o jogo inteiro aberto em English: cada janela, a mochila cheia, os NPCs, a barrinha de criar (idioma-telas.gd)
  let tela = '';
  try { tela = execFileSync(godot, ['--headless', '--path', 'godot-prototipo', '-s', '../ferramentas/testes/idioma-telas.gd'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 900000 }); } catch (e) { tela = String(e.stdout || '') + String(e.stderr || ''); }
  const fora = tela.split('\n').filter((l) => l.startsWith('ACHOU'));
  ok(/idioma-telas: \d+ textos/.test(tela) && fora.length === 0, `janelas do jogo sem texto no outro idioma (${fora.length}) ${fora.slice(0, 4).join(' | ')}`);
} else console.log('(sem Godot: pulando as frases montadas; GODOT=caminho para rodar)');
