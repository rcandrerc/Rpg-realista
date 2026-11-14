// Idioma / Language (André 2026-11-14: jogo em inglês para divulgar em sites gringos; só Português e English, com
// bandeirinha). Trava: o dicionário abre, não tem chave repetida (em JSON a última ganha calada), o inglês tem os
// mesmos números que o português, a linha das Configurações existe com as duas bandeiras e a IA da Cecília e do Dario
// responde em inglês quando o jogador escolhe English. Uso: node ferramentas/testes/idioma.mjs
import { readFileSync, existsSync } from 'node:fs';
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
} else console.log('(sem Godot: pulando as frases montadas; GODOT=caminho para rodar)');
