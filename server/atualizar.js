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
export function ligarAtualizacaoTrancada(app, pasta) {
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
  const conferir = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      const r = await fetch(`${PAGINA}/pacote-versao.txt`, { cache: 'no-store' });
      if (!r.ok) return;
      const nova = (await r.text()).trim();
      const atual = fs.readFileSync(path.join(pasta, 'versao.txt'), 'utf8').trim();
      if (!nova || nova === atual) return;
      const pacote = await (await fetch(`${PAGINA}/pacote.json`, { cache: 'no-store' })).json();
      if (String(pacote.versao) !== nova) return; // o site ainda está trocando os arquivos
      const { arquivos } = abrirPacote(pacote, chavePrivada);
      if (!arquivos?.['servidor.mjs'] || !arquivos?.['package.json']) throw new Error('pacote sem servidor.mjs/package.json');
      const pacoteAntigo = fs.existsSync(path.join(pasta, 'package.json')) ? fs.readFileSync(path.join(pasta, 'package.json'), 'utf8') : '';
      fs.writeFileSync(path.join(pasta, 'servidor.mjs.novo'), arquivos['servidor.mjs']);
      fs.writeFileSync(path.join(pasta, 'package.json'), arquivos['package.json']);
      if (arquivos['package.json'] !== pacoteAntigo) {
        await new Promise((ok, falha) => execFile('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: pasta, env: { ...process.env, HOME: pasta } }, (e) => (e ? falha(e) : ok())));
      }
      fs.renameSync(path.join(pasta, 'servidor.mjs.novo'), path.join(pasta, 'servidor.mjs'));
      fs.writeFileSync(path.join(pasta, 'versao.txt'), nova + '\n');
      console.log(`Servidor novo ${nova} instalado; reiniciando.`);
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
