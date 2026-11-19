// Cliente espera a janela (Presidente 2026-11-19, opção B): se algo em shared/ mudou desde o que está no ar, o site
// (cliente e servidor juntos, Pages e balde) só publica no disparo agendado das 04:40 e 13:40 de Brasília, uns 20 min
// antes da janela/reinício fixo das 05h e 14h. Assim o celular nunca fica com regras de shared/ diferentes das do
// servidor. Merge que não mexe em shared/ publica na hora, como antes (se não houver shared/ esperando).
// Grava publicar=true|false em $GITHUB_OUTPUT. Uso no CI: node ferramentas/atualizacao/janela-publicar.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { podeInstalar } from '../../server/atualizar.js';

const BALDE = (process.env.ORACLE_URL || 'https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/').replace(/\/?$/, '/');
const PAGES = 'https://rcandrerc.github.io/Rpg-realista/';

// decide(): separado para teste. ctx = { evento, forcar, mensagem, mudou (lista de arquivos ou null), agora }
export function decide({ evento, forcar, mensagem = '', mudou, agora = Date.now() }) {
  if (forcar) return { publicar: true, motivo: 'publicar agora (pedido à mão)' };
  if (mensagem.includes('[furar bloqueio]')) return { publicar: true, motivo: '[furar bloqueio]' };
  const shared = mudou === null || mudou.some((f) => f.startsWith('shared/'));
  // o agendado só existe para soltar o que esperava (shared/); sem isso não republica o site à toa (~690 MB)
  if (!shared && evento === 'schedule') return { publicar: false, motivo: 'agendado sem nada esperando' };
  if (!shared) return { publicar: true, motivo: 'nada em shared/ desde o que está no ar' };
  // agendado: publica se o servidor vai poder instalar logo (janela abre em até ~25 min ou já está aberta)
  if (evento === 'schedule' && (podeInstalar(agora) || podeInstalar(agora + 25 * 60e3)))
    return { publicar: true, motivo: 'disparo agendado antes da janela' };
  return { publicar: false, motivo: `${mudou === null ? 'não deu para saber o que mudou' : 'shared/ mudou'}: espera o disparo das 04:40 ou 13:40 de Brasília` };
}

async function textoDe(url) {
  try { const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' }); return r.ok ? (await r.text()).trim() : ''; } catch { return ''; }
}

// commit que está no ar: o publicado.txt do balde (espelhar-balde.sh) ou, sem ele, o commit do cardápio do Pages
async function commitNoAr() {
  const b = await textoDe(`${BALDE}publicado.txt`);
  if (/^[0-9a-f]{40}$/.test(b)) return b;
  try { return JSON.parse(await textoDe(`${PAGES}atualizacao/conteudo-4.7.json`)).commit || ''; } catch { return ''; }
}

function arquivosEntre(base, cabeca) {
  try {
    const saida = execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/compare/${base}...${cabeca}`,
      '--jq', '[(.files | length), (.files[].filename)] | @json'], { encoding: 'utf8' });
    const [n, ...nomes] = JSON.parse(saida);
    return n >= 300 ? null : nomes; // a comparação corta em 300 arquivos: aí não dá para saber
  } catch (e) { console.log(`::warning::não comparei ${base}...${cabeca}: ${e.message}`); return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cabeca = process.env.GITHUB_SHA;
  const base = await commitNoAr();
  const mudou = !base ? null : base.startsWith(cabeca) || cabeca.startsWith(base) ? [] : arquivosEntre(base, cabeca);
  let mensagem = '';
  try { mensagem = execFileSync('git', ['log', '-1', '--format=%B'], { encoding: 'utf8' }); } catch { /* sem checkout */ }
  const r = decide({ evento: process.env.EVENTO, forcar: process.env.FORCAR === '1' || process.env.FORCAR === 'true', mensagem, mudou });
  console.log(`No ar: ${base || '?'}; agora: ${cabeca}. ${r.publicar ? 'Publica' : 'NÃO publica agora'} (${r.motivo}).`);
  if (!r.publicar) console.log(`::notice::Novidade em shared/ espera a janela: o site (cliente e servidor) publica às 04:40 ou 13:40 de Brasília.`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `publicar=${r.publicar}\n`);
}
