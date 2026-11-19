// Sela uma chave (ex.: GEMINI_CHAVE da Cecília e do Dario) com a chave pública da máquina da Oracle (André 2026-11-19).
// O valor nunca aparece: lê de um arquivo, tranca com RSA-OAEP + AES-GCM (o mesmo formato do pacote, server/atualizar.js)
// e grava em server/segredos-selados.json. Só a máquina que guarda chave-privada.pem consegue abrir, então o arquivo pode
// ficar no repositório. Segredo do GitHub com o mesmo nome continua valendo e tem preferência.
// Uso: node ferramentas/servidor/selar-segredo.mjs GEMINI_CHAVE arquivo-com-a-chave.txt [chave-publica.pem]
//   (sem o .pem, baixa de $SERVIDOR_URL/chave-do-servidor). O arquivo pode ter outras linhas: vale a de "Chave:" se houver.
import fs from 'node:fs';
import crypto from 'node:crypto';

const [nome, arquivo, pem] = process.argv.slice(2);
if (!/^[A-Z_]+$/.test(nome || '') || !arquivo) { console.error('Uso: node selar-segredo.mjs NOME arquivo [publica.pem]'); process.exit(1); }
const texto = fs.readFileSync(arquivo, 'utf8');
const valor = (texto.match(/^Chave:\s*(\S+)/m)?.[1] || texto.trim().split(/\s+/)[0] || '').trim();
if (valor.length < 20) { console.error('Não achei a chave no arquivo.'); process.exit(1); }
const url = process.env.SERVIDOR_URL || 'https://163-176-80-126.sslip.io';
const publicaPem = pem ? fs.readFileSync(pem, 'utf8') : await (await fetch(`${url}/chave-do-servidor`)).text();
const publica = crypto.createPublicKey(publicaPem);
const aes = crypto.randomBytes(32), iv = crypto.randomBytes(12);
const cifra = crypto.createCipheriv('aes-256-gcm', aes, iv);
cifra.setAAD(Buffer.from(nome));
const dados = Buffer.concat([cifra.update(Buffer.from(JSON.stringify({ arquivos: { [nome]: valor } }))), cifra.final()]);
const chave = crypto.publicEncrypt({ key: publica, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, aes);
const destino = new URL('../../server/segredos-selados.json', import.meta.url);
let todos = {}; try { todos = JSON.parse(fs.readFileSync(destino, 'utf8')); } catch { /* primeiro */ }
todos[nome] = { versao: nome, chave: chave.toString('base64'), iv: iv.toString('base64'), tag: cifra.getAuthTag().toString('base64'), dados: dados.toString('base64') };
fs.writeFileSync(destino, JSON.stringify(todos, null, 2) + '\n');
console.log(`${nome} selado em server/segredos-selados.json (impressão da chave pública ${crypto.createHash('sha256').update(publica.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 12)})`);
