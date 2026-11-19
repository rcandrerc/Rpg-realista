// Servidor que exige assinatura, de ponta a ponta (passo 2 da frente 2): o pacote sai trancado (trancar.mjs) e
// assinado (assinar.mjs) como no CI, e o servidor (server/atualizar.js) só instala o que uma chave aceita assinou.
// Cada instalação termina com process.exit, então o servidor roda num processo filho com uma origem local.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { idChave } from '../../server/atualizar.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'instalar-assinado-'));
let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? 'ok' : 'FALHOU'} ${nome}`); if (!cond) falhas++; };

// máquina do jogo: versão v1, chave RSA dela (2048 só para o teste ficar rápido) e a lista de chaves aceitas
const pasta = path.join(tmp, 'srv');
fs.mkdirSync(pasta);
const pacoteJson = '{"name":"teste","private":true}\n'; // igual ao do pacote: não roda npm install
fs.writeFileSync(path.join(pasta, 'versao.txt'), 'v1\n');
fs.writeFileSync(path.join(pasta, 'servidor.mjs'), '// v1\n');
fs.writeFileSync(path.join(pasta, 'package.json'), pacoteJson);
const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
fs.writeFileSync(path.join(pasta, 'chave-privada.pem'), rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(path.join(tmp, 'servidor.pub.pem'), rsa.publicKey.export({ type: 'spki', format: 'pem' }));

const novaChave = (nome) => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(tmp, nome), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
};
const pubBuilds = novaChave('builds.pem');
const pubReserva = novaChave('reserva.pem');
const pubIntrusa = novaChave('intrusa.pem');
fs.writeFileSync(path.join(pasta, 'chaves-assinatura.txt'), `# teste\n${pubBuilds}\n${pubReserva}\n`);

// "site": pacote-versao.txt + pacote.json servidos de uma pasta, como o Pages/balde
const site = path.join(tmp, 'site');
fs.mkdirSync(site);
function publicar(versao, chave) {
  fs.writeFileSync(path.join(tmp, 'servidor.mjs'), `// ${versao}\n`);
  fs.writeFileSync(path.join(tmp, 'package.json'), pacoteJson);
  execFileSync('node', [path.join(raiz, 'ferramentas/servidor/trancar.mjs'), path.join(tmp, 'servidor.pub.pem'), versao,
    path.join(tmp, 'servidor.mjs'), path.join(tmp, 'package.json'), path.join(site, 'pacote.json')], { stdio: 'pipe' });
  if (chave) {
    execFileSync('node', [path.join(raiz, 'ferramentas/servidor/assinar.mjs'), path.join(site, 'pacote.json')], {
      stdio: 'pipe',
      env: { ...process.env, ASSINATURA_PACOTE: path.join(tmp, chave), RUNNER_ENVIRONMENT: 'self-hosted', CRIAR_CHAVE_ASSINATURA: '', CHAVES_ASSINATURA_TESTE: '[]' },
    });
  }
  fs.writeFileSync(path.join(site, 'pacote-versao.txt'), `${versao}\n`);
}
const origem = http.createServer((req, res) => {
  const arq = path.join(site, path.basename(req.url.split('?')[0]));
  if (!fs.existsSync(arq)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'last-modified': new Date().toUTCString() });
  res.end(fs.readFileSync(arq));
});
await new Promise((pronto) => origem.listen(0, '127.0.0.1', pronto));
const url = `http://127.0.0.1:${origem.address().port}`;

// Liga o atualizador como na Oracle e confere uma vez. Instalou = sai com 0 (process.exit do atualizador).
const filho = `
import { ligarAtualizacaoTrancada } from ${JSON.stringify(path.join(raiz, 'server/atualizar.js'))};
const r = ligarAtualizacaoTrancada({ get() {} }, process.env.PASTA, null);
console.log('INFO ' + JSON.stringify(r.info));
await r.conferir();
console.log('NAO_INSTALOU');
process.exit(3);`;
const rodar = () => new Promise((fim) => {
  const c = spawn('node', ['--input-type=module', '-e', filho], {
    env: { ...process.env, NODE_ENV: 'production', PASTA: pasta, PAGINA_SERVIDOR: url, BALDE_SERVIDOR: '', JANELA_LIVRE: '1', ESPERA_ATUALIZAR_MS: '600000' },
  });
  let saida = '';
  c.stdout.on('data', (d) => { saida += d; });
  c.stderr.on('data', (d) => { saida += d; });
  const relogio = setTimeout(() => c.kill('SIGKILL'), 20000);
  c.on('close', (codigo) => { clearTimeout(relogio); fim({ codigo, saida, info: JSON.parse((saida.match(/^INFO (.*)$/m) || [])[1] || 'null') }); });
});
const ler = (arq) => (fs.existsSync(path.join(pasta, arq)) ? fs.readFileSync(path.join(pasta, arq), 'utf8').trim() : '');

let r = await rodar(); // nada novo no site ainda
ok(r.codigo === 3 && r.info?.assinaturaExigida === true && r.info?.versao === 'v1' && r.info?.assinadoPor === null, 'antes: /saude mostra v1, exige assinatura, sem chave conferida');

publicar('v2', null);
r = await rodar();
ok(r.codigo === 3 && /sem assinatura válida/.test(r.saida) && ler('versao.txt') === 'v1', 'pacote sem assinatura não instala');

publicar('v2', 'intrusa.pem');
r = await rodar();
ok(r.codigo === 3 && /sem assinatura válida/.test(r.saida) && ler('versao.txt') === 'v1', 'pacote assinado por chave fora da lista não instala');

publicar('v2', 'builds.pem');
r = await rodar();
ok(r.codigo === 0 && ler('versao.txt') === 'v2' && ler('servidor.mjs') === '// v2', 'pacote da chave da máquina de builds instala');
ok(r.saida.includes(`Assinatura conferida: pacote v2 (chave ${idChave(pubBuilds)})`), 'log mostra a assinatura conferida e a chave');
ok(ler('assinado.txt') === idChave(pubBuilds) && Number(ler('emitido.txt')) > 0, 'guarda a chave que assinou e a data do pacote');

r = await rodar(); // reiniciou com a v2: o /saude mostra quem assinou
ok(r.codigo === 3 && r.info?.versao === 'v2' && r.info?.assinadoPor === idChave(pubBuilds), 'depois: /saude mostra v2 e a chave da máquina de builds');

const v2Assinado = fs.readFileSync(path.join(site, 'pacote.json'), 'utf8');
publicar('v3', 'reserva.pem');
r = await rodar();
ok(r.codigo === 0 && ler('versao.txt') === 'v3' && ler('assinado.txt') === idChave(pubReserva), 'pacote da chave reserva também instala');

// reenvio do pacote v2 (assinado, mas mais velho que o último instalado) não volta
fs.writeFileSync(path.join(site, 'pacote.json'), v2Assinado);
fs.writeFileSync(path.join(site, 'pacote-versao.txt'), 'v2\n');
r = await rodar();
ok(r.codigo === 3 && /mais velho/.test(r.saida) && ler('versao.txt') === 'v3', 'pacote antigo reenviado não volta');

origem.close();
fs.rmSync(tmp, { recursive: true, force: true });
if (falhas) { console.log(`${falhas} falha(s)`); process.exit(1); }
console.log('instalação assinada: tudo certo');
