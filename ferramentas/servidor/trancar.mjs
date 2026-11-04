// Tranca o pacote do servidor com a chave pública da máquina da Oracle (veja server/atualizar.js).
// Uso: node trancar.mjs chave-publica.pem versao servidor.mjs package.json saida.json
import fs from 'node:fs';
import crypto from 'node:crypto';

const [chavePem, versao, servidor, pacote, saida] = process.argv.slice(2);
const publica = crypto.createPublicKey(fs.readFileSync(chavePem));
const aes = crypto.randomBytes(32);
const iv = crypto.randomBytes(12);
const cifra = crypto.createCipheriv('aes-256-gcm', aes, iv);
cifra.setAAD(Buffer.from(String(versao)));
const claro = Buffer.from(JSON.stringify({ arquivos: { 'servidor.mjs': fs.readFileSync(servidor, 'utf8'), 'package.json': fs.readFileSync(pacote, 'utf8') } }));
const dados = Buffer.concat([cifra.update(claro), cifra.final()]);
const chave = crypto.publicEncrypt({ key: publica, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, aes);
fs.writeFileSync(saida, JSON.stringify({ versao, chave: chave.toString('base64'), iv: iv.toString('base64'), tag: cifra.getAuthTag().toString('base64'), dados: dados.toString('base64') }));
console.log(`Pacote trancado em ${saida} (${fs.statSync(saida).size} bytes)`);
