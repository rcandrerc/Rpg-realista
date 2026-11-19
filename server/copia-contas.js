// Cópia cifrada das contas para FORA da máquina (plano de lançamento v3, frente 2, até 27/11; desenho aprovado pelo
// Presidente em 19/11). O servidor faz a cópia do banco e cifra AQUI, com a chave PÚBLICA abaixo: ele nunca tem a
// chave privada e quem baixa (o workflow contas-copia.yml) nunca vê o banco aberto. A privada fica fora da Oracle
// (fontes chaves/servidor/copia-contas.pem e o Drive do André). Para voltar: ferramentas/servidor/voltar-contas.sh copia.tar --chave ...
//
// Revisão de segurança (frente 3, 19/11):
// - a cópia vai SEM a chave de IA dos jogadores (contas.ia_chave) e sem as sessões: se a privada vazar um dia, as cópias
//   do balde não entregam chave de ninguém (secure_delete + VACUUM: nem nas páginas livres). Quem voltar de uma cópia
//   entra de novo com o Google e põe a chave de IA de novo.
// - a cópia vai ASSINADA (Ed25519) com a chave do próprio servidor (dados/copia-assinatura.pem, criada na 1ª cópia;
//   a pública sai em /contas/copia-assinatura.pub.pem). O voltar-contas.sh (root) só confia na pública FIXADA no
//   repositório (ferramentas/servidor/copia-assinatura*.pub.pem); outra só com --pub e confirmação da impressão digital.
//   A hora da cópia vai assinada (cópia velha no lugar da nova aparece na volta).
// - tudo roda num PROCESSO FILHO (VACUUM, cifra, assinatura): as salas não travam e a memória do jogo não sobe.
//
// Formato (o mesmo que o voltar-contas.sh abre com openssl): um .tar com
//   chave.bin       a senha (64 letras hex) cifrada com RSA-OAEP (SHA-1, o padrão do openssl pkeyutl)
//   contas.bin      o banco cifrado como "openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:k.bin" (Salted__ + sal,
//                   PBKDF2-SHA256 com 10000 voltas dá chave e IV)
//   contas.sha256   o sha256 do banco aberto, para conferir depois de abrir
//   quando.txt      a hora da cópia (ISO, UTC)
//   assinatura.bin  Ed25519 sobre o texto "<sha256 de chave.bin>\n<sha256 de contas.bin>\n<conteúdo de contas.sha256><conteúdo de quando.txt>"
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

// Chave pública RSA 4096 da cópia (gerada fora da Oracle; a privada nunca passa por aqui). Vazia: a rota responde 503.
// SHA-256 do DER: 5e31f6816b3a605dfab1d6186d5f7eff809facfdf2c002945ed365c0c856d608 (privada: fontes chaves/servidor/copia-contas.pem)
export const CHAVE_COPIA = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAp82HLcCvZJrD8BwZmngY
wZnANSilDWJ7aDEaRJCZeLz4gx3es561GgHg+Gh5ygGpiTyyINcmqquhJy82tDF/
YLlw4DzoqjRNC1z79evcBBG4OzU8DG/BLSt+WuFjnnGl9OPm61Gre/JO+rPbA+lG
XRJlSEB96jLy7OCCkRRrm7EgiLZ1dlIB9x+mjZfrn1icSkc3bzJsfWxarC0xjHLA
JIt2O/WqsXa4OyizdVJgUFA+hv5rhsFr/r9BFqoxDb/h5aYmf+Va/xokwpfuPw58
BCJ+gy4b+HYI5e+OyZ3En0KJYV+a7C4pTzYb6nGUd8V5xgOvNZn9UAftfhSSOaLv
EUJP7RIuZAeCdHoV/4NiTq/jtfaZGKo2dvgtqhPGrYmuxIFDsx4tgjKwO7zLtmq6
kBaJAzgzVM8oMJQrSQ54r3m6REP6axnV3BZsaypz+UEa5DjbZTSzfR0rGOO2BRKI
RQv2X/pisgANiN28+cFOHfjWOrZF9FySI7jToRFXxQsr3llF4snmBQLxg9nlDmYt
zmKsQWDUxt7QHSxcClo/By0tPT8R00H8DjNYNGMZpLbdroNO2cxLvubG+gPPKMUF
BXnyaeLM7vzrRGV84kMRIazDTSJMmvXX3uR4FELb+hLIE29tACH+9jcajBSEeBvG
Ah+f6wmMjCbI+L9j4iND3h0CAwEAAQ==
-----END PUBLIC KEY-----
`;


// O filho: argumentos <banco> <pasta de saída> <chave pública RSA (arquivo)> <chave Ed25519 privada (arquivo)>.
// Escrito como texto (e não importado) porque o servidor vai empacotado num arquivo só (esbuild). Grava copia.tar na
// pasta de saída; o banco aberto só existe ali (pasta 0700) e é apagado antes de cifrar o resto.
const FILHO = String.raw`
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const [banco, saida, pubArq, assinaArq] = process.argv.slice(1);
const tmp = path.join(saida, 'aberto.db');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function tar(arquivos) {
  const blocos = [];
  for (const [nome, dados] of arquivos) {
    const h = Buffer.alloc(512);
    h.write(nome, 0, 100);
    h.write('0000600\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
    h.write(dados.length.toString(8).padStart(11, '0') + '\0', 124);
    h.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136);
    h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
    let soma = 0; for (const b of h) soma += b;
    h.write(soma.toString(8).padStart(6, '0') + '\0 ', 148);
    blocos.push(h, dados, Buffer.alloc((512 - (dados.length % 512)) % 512));
  }
  blocos.push(Buffer.alloc(1024));
  return Buffer.concat(blocos);
}
try {
  const src = new DatabaseSync(banco, { readOnly: true }); src.prepare('VACUUM INTO ?').run(tmp); src.close();
  const c = new DatabaseSync(tmp);
  c.exec('PRAGMA secure_delete = ON');
  const cols = c.prepare("SELECT name FROM pragma_table_info('contas')").all().map((x) => x.name);
  if (cols.includes('ia_chave')) c.exec('UPDATE contas SET ia_chave = NULL');
  if (c.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sessoes'").get()) c.exec('DELETE FROM sessoes');
  c.exec('VACUUM'); c.close();
  const aberto = fs.readFileSync(tmp); fs.rmSync(tmp, { force: true });
  const shaAberto = sha(aberto);
  const senha = crypto.randomBytes(32).toString('hex');
  const chave = crypto.publicEncrypt({ key: fs.readFileSync(pubArq, 'utf8'), padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, Buffer.from(senha));
  const sal = crypto.randomBytes(8), kiv = crypto.pbkdf2Sync(senha, sal, 10000, 48, 'sha256');
  const ci = crypto.createCipheriv('aes-256-cbc', kiv.subarray(0, 32), kiv.subarray(32));
  const cifrado = Buffer.concat([Buffer.from('Salted__'), sal, ci.update(aberto), ci.final()]);
  aberto.fill(0);
  const resumo = Buffer.from(shaAberto + '\n');
  const quando = Buffer.from(new Date().toISOString() + '\n'); // vai assinado: cópia velha posta no lugar da nova aparece
  const msg = Buffer.from(sha(chave) + '\n' + sha(cifrado) + '\n' + shaAberto + '\n' + quando.toString());
  const assinatura = crypto.sign(null, msg, fs.readFileSync(assinaArq, 'utf8'));
  fs.writeFileSync(path.join(saida, 'copia.tar'), tar([['chave.bin', chave], ['contas.bin', cifrado], ['contas.sha256', resumo], ['quando.txt', quando], ['assinatura.bin', assinatura]]), { mode: 0o600 });
} catch (e) { fs.rmSync(tmp, { force: true }); console.error(e.message); process.exit(1); }
`;

// Chave Ed25519 do servidor para assinar as cópias: criada uma vez na pasta de dados (0600). Devolve a pública (PEM).
export function chaveAssinaturaCopia(pastaDados, criar = true) {
  const priv = path.join(pastaDados, 'copia-assinatura.pem'), pub = path.join(pastaDados, 'copia-assinatura.pub.pem');
  if (!fs.existsSync(priv)) {
    if (!criar) return null;
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(pub, publicKey.export({ type: 'spki', format: 'pem' }));
  }
  if (!fs.existsSync(pub)) fs.writeFileSync(pub, crypto.createPublicKey(fs.readFileSync(priv, 'utf8')).export({ type: 'spki', format: 'pem' }));
  return { priv, pub: fs.readFileSync(pub, 'utf8') };
}

const PREFIXO = 'copia-contas-';
// Sobras de uma cópia que caiu no meio (servidor reiniciou): apaga ao ligar.
export function limparSobrasCopia() {
  try { for (const d of fs.readdirSync(os.tmpdir())) if (d.startsWith(PREFIXO)) fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true }); } catch { /* sem tmp: nada a limpar */ }
}

// Faz a cópia no processo filho. Devolve { arquivo, apagar }: mande o arquivo e chame apagar() depois.
export function gerarCopia({ banco, pastaDados, chavePublica = CHAVE_COPIA }) {
  if (!chavePublica.trim()) return Promise.reject(new Error('sem chave pública da cópia'));
  const { priv } = chaveAssinaturaCopia(pastaDados);
  const saida = fs.mkdtempSync(path.join(os.tmpdir(), PREFIXO)); fs.chmodSync(saida, 0o700);
  const pubArq = path.join(saida, 'pub.pem'); fs.writeFileSync(pubArq, chavePublica);
  const apagar = () => fs.rmSync(saida, { recursive: true, force: true });
  return new Promise((ok, falha) => {
    execFile(process.execPath, ['--no-warnings', '--input-type=module', '-e', FILHO, banco, saida, pubArq, priv], { timeout: 10 * 60e3, maxBuffer: 1 << 20 }, (e, _out, err) => {
      if (e) { apagar(); return falha(new Error(String(err || e.message).trim().slice(0, 300))); }
      ok({ arquivo: path.join(saida, 'copia.tar'), apagar });
    });
  });
}
