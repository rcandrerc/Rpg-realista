// Atualização trancada do servidor (André 2026-11-03: o código do servidor não fica mais aberto no site).
// Na máquina da Oracle o próprio servidor cria um par de chaves na primeira vez. A chave pública sai em
// /chave-do-servidor; o CI do GitHub tranca o pacote novo com ela (ferramentas/servidor/trancar.mjs) e publica
// só o pacote trancado no Pages. Só esta máquina, que guarda a chave privada, consegue abrir.
// A cada 5 minutos o servidor confere a versão; se mudou, abre o pacote, troca os arquivos e sai (o systemd liga de novo).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

const PAGINA = process.env.PAGINA_SERVIDOR || 'https://rcandrerc.github.io/Rpg-realista/servidor'; // a troca serve só para teste local
// André 2026-11-18: o jogo não pode depender do GitHub para atualizar. O CI também copia o pacote para o balde da
// Oracle (ferramentas/atualizacao/espelhar-balde.sh). O servidor olha os dois e fica com o publicado por último
// (Last-Modified): se um deles parar de ser atualizado, o outro manda. Sem PAGINA_SERVIDOR de teste, usa os dois.
const BALDE = process.env.BALDE_SERVIDOR ?? (process.env.PAGINA_SERVIDOR ? ''
  : 'https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/servidor');

// Lê a versão em cada origem e devolve a mais recente: { origem, versao } (ou null se nenhuma respondeu).
export async function versaoMaisNova(origens, buscar = fetch) {
  let melhor = null;
  for (const origem of origens) {
    try {
      const r = await buscar(`${origem}/pacote-versao.txt`, { cache: 'no-store' });
      if (!r.ok) continue;
      const versao = (await r.text()).trim();
      if (!versao) continue;
      const quando = Date.parse(r.headers?.get?.('last-modified') || '') || 0;
      if (!melhor || quando > melhor.quando) melhor = { origem, versao, quando };
    } catch { /* origem fora do ar: fica com a outra */ }
  }
  return melhor;
}

// Pacote assinado (plano de lançamento v3, portão 10/12: "pacote do servidor assinado"). O trancado acima só garante
// que ninguém LÊ o código; qualquer um com a chave pública (/chave-do-servidor) conseguiria MONTAR um pacote. Agora o
// CI assina cada pacote com uma chave Ed25519 que só existe na máquina de builds da Oracle
// (ferramentas/servidor/assinar.mjs) e o servidor só instala o que veio assinado por uma chave da lista abaixo.
// Lista vazia = ainda em transição (aceita sem assinatura). Chave nova (máquina de builds perdida): acrescente a
// pública aqui ou, sem atualização possível, numa linha de chaves-assinatura.txt ao lado do servidor.mjs.
export const CHAVES_ASSINATURA = [];

// Texto assinado: todos os campos do pacote menos a própria assinatura, em ordem fixa (campo novo já entra).
export function textoAssinado(pacote) {
  const campos = Object.keys(pacote).filter((k) => k !== 'assinatura' && k !== 'assinado_por').sort();
  return Buffer.from(JSON.stringify(campos.map((k) => [k, pacote[k]])));
}

export function idChave(publicaBase64) {
  return crypto.createHash('sha256').update(publicaBase64).digest('hex').slice(0, 16);
}

// true se alguma chave confiável assina este pacote. chaves = chaves públicas Ed25519 (SPKI DER em base64).
export function assinaturaValida(pacote, chaves) {
  if (!pacote || typeof pacote.assinatura !== 'string') return false;
  const texto = textoAssinado(pacote);
  const assinatura = Buffer.from(pacote.assinatura, 'base64');
  for (const b64 of chaves) {
    try {
      const chave = crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });
      if (chave.asymmetricKeyType !== 'ed25519') continue; // só Ed25519 (verify(null) aceitaria RSA)
      if (crypto.verify(null, texto, chave, assinatura)) return true;
    } catch { /* chave mal escrita na lista: tenta a próxima */ }
  }
  return false;
}

// Chaves aceitas nesta máquina: as do código + as de chaves-assinatura.txt (uma por linha; # comenta).
export function chavesAceitas(pasta) {
  const extra = path.join(pasta, 'chaves-assinatura.txt');
  const doArquivo = fs.existsSync(extra)
    ? fs.readFileSync(extra, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean) : [];
  return [...new Set([...CHAVES_ASSINATURA, ...doArquivo])];
}

// Pacote mais velho que o último instalado (reenvio de pacote antigo assinado) não passa. Sem emitido.txt
// (primeira vez) aceita. Devolve o emitido_em do pacote para gravar depois de instalar.
export function emitidoAceito(pacote, pasta) {
  const emitido = Number(pacote?.emitido_em);
  if (!Number.isFinite(emitido) || emitido <= 0) return null;
  const arq = path.join(pasta, 'emitido.txt');
  const ultimo = fs.existsSync(arq) ? Number(fs.readFileSync(arq, 'utf8').trim()) || 0 : 0;
  return emitido > ultimo ? emitido : null;
}

// Janela de instalação (plano de lançamento v3): o servidor novo só entra em hora marcada, horário de Brasília
// (UTC-3, sem horário de verão): 05h–07h e 14h–15h. Na 1ª semana depois do lançamento (19/12 20h a 26/12 20h), só
// 05h–07h. De 19/12 18h a 20/12 02h nada instala, nem urgente. Pacote "urgente" (PR com [servidor urgente] no título;
// o campo vai assinado) instala na hora fora desse bloqueio. Fora da janela o servidor só espera: confere de novo a
// cada 5 min e instala quando a janela abrir (o pacote mais novo daquele momento).
export const JANELAS = [[5, 7], [14, 15]];
const BRASILIA = -3 * 3600e3;
const LANCAMENTO_SEMANA = [Date.parse('2026-12-19T20:00:00-03:00'), Date.parse('2026-12-26T20:00:00-03:00')];
const BLOQUEIO = [Date.parse('2026-12-19T18:00:00-03:00'), Date.parse('2026-12-20T02:00:00-03:00')];
export function podeInstalar(agora = Date.now(), urgente = false) {
  if (process.env.JANELA_LIVRE === '1') return true; // teste local
  if (agora >= BLOQUEIO[0] && agora < BLOQUEIO[1]) return false;
  if (urgente) return true;
  const hora = new Date(agora + BRASILIA).getUTCHours();
  const semana = agora >= LANCAMENTO_SEMANA[0] && agora < LANCAMENTO_SEMANA[1];
  return (semana ? JANELAS.slice(0, 1) : JANELAS).some(([de, ate]) => hora >= de && hora < ate);
}

// Abre o pacote trancado. Formato: { versao, chave (AES embrulhada em RSA-OAEP), iv, tag, dados } em base64.
export function abrirPacote(pacote, chavePrivada) {
  const aes = crypto.privateDecrypt({ key: chavePrivada, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(pacote.chave, 'base64'));
  const decifra = crypto.createDecipheriv('aes-256-gcm', aes, Buffer.from(pacote.iv, 'base64'));
  decifra.setAAD(Buffer.from(String(pacote.versao)));
  decifra.setAuthTag(Buffer.from(pacote.tag, 'base64'));
  const claro = Buffer.concat([decifra.update(Buffer.from(pacote.dados, 'base64')), decifra.final()]);
  return JSON.parse(claro.toString('utf8')); // { arquivos: { 'servidor.mjs': '...', 'package.json': '...' } }
}

// Liga a atualização trancada só na máquina instalada (pasta com versao.txt ao lado do servidor.mjs).
// antesDeSair (server/index.js): aviso na tela + contagem e gravar todo mundo; o arquivo novo já está no lugar.
export function ligarAtualizacaoTrancada(app, pasta, antesDeSair) {
  if (process.env.NODE_ENV !== 'production' || !fs.existsSync(path.join(pasta, 'versao.txt'))) return false;
  const arqPrivada = path.join(pasta, 'chave-privada.pem');
  if (!fs.existsSync(arqPrivada)) {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
    fs.writeFileSync(arqPrivada, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    console.log('Chave do servidor criada (a privada nunca sai desta máquina).');
  }
  const chavePrivada = crypto.createPrivateKey(fs.readFileSync(arqPrivada));
  const publica = crypto.createPublicKey(chavePrivada).export({ type: 'spki', format: 'pem' });
  app.get('/chave-do-servidor', (_req, res) => res.type('text/plain').send(publica));

  let ocupado = false;
  let esperando = '';
  const conferir = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      const achou = await versaoMaisNova([BALDE, PAGINA].filter(Boolean));
      if (!achou) return;
      const nova = achou.versao;
      const atual = fs.readFileSync(path.join(pasta, 'versao.txt'), 'utf8').trim();
      if (!nova || nova === atual) return;
      const pacote = await (await fetch(`${achou.origem}/pacote.json`, { cache: 'no-store' })).json();
      if (String(pacote.versao) !== nova) return; // o site ainda está trocando os arquivos
      const chaves = chavesAceitas(pasta);
      if (chaves.length && !assinaturaValida(pacote, chaves)) throw new Error(`pacote ${nova} sem assinatura válida (assinado_por=${pacote.assinado_por || 'ninguém'}): não instalo`);
      const emitido = chaves.length ? emitidoAceito(pacote, pasta) : null;
      if (chaves.length && !emitido) throw new Error(`pacote ${nova} mais velho que o último instalado (ou sem data): não instalo`);
      if (!podeInstalar(Date.now(), pacote.urgente === true)) {
        if (esperando !== nova) console.log(`Servidor novo ${nova} pronto; instala na próxima janela (05h–07h ou 14h–15h de Brasília).`);
        esperando = nova;
        return;
      }
      const { arquivos } = abrirPacote(pacote, chavePrivada);
      if (!arquivos?.['servidor.mjs'] || !arquivos?.['package.json']) throw new Error('pacote sem servidor.mjs/package.json');
      const pacoteAntigo = fs.existsSync(path.join(pasta, 'package.json')) ? fs.readFileSync(path.join(pasta, 'package.json'), 'utf8') : '';
      fs.writeFileSync(path.join(pasta, 'servidor.mjs.novo'), arquivos['servidor.mjs']);
      fs.writeFileSync(path.join(pasta, 'package.json'), arquivos['package.json']);
      if (typeof arquivos['segredos.json'] === 'string') fs.writeFileSync(path.join(pasta, 'segredos.json'), arquivos['segredos.json'], { mode: 0o600 }); // chaves (só desta máquina)
      if (arquivos['package.json'] !== pacoteAntigo) {
        await new Promise((ok, falha) => execFile('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: pasta, env: { ...process.env, HOME: pasta } }, (e) => (e ? falha(e) : ok())));
      }
      fs.renameSync(path.join(pasta, 'servidor.mjs.novo'), path.join(pasta, 'servidor.mjs'));
      fs.writeFileSync(path.join(pasta, 'versao.txt'), nova + '\n');
      if (emitido) fs.writeFileSync(path.join(pasta, 'emitido.txt'), emitido + '\n');
      console.log(`Servidor novo ${nova} instalado; reiniciando.`);
      if (antesDeSair) await antesDeSair();
      process.exit(0); // o systemd (Restart=always) liga de novo com o arquivo novo
    } catch (e) {
      console.warn('Atualização trancada falhou:', e.message);
    } finally {
      ocupado = false;
    }
  };
  setTimeout(conferir, Number(process.env.ESPERA_ATUALIZAR_MS || 60 * 1000));
  setInterval(conferir, 5 * 60 * 1000);
  return true;
}
