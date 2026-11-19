// Assina o pacote trancado do servidor (veja CHAVES_ASSINATURA em server/atualizar.js).
// Uso: node ferramentas/servidor/assinar.mjs client/dist/servidor/pacote.json
// A chave privada Ed25519 fica SÓ na máquina de builds da Oracle: $ASSINATURA_PACOTE ou ~/.aethra/assinatura-pacote.pem
// (usuário runner, permissão 600). Se ainda não existe e o job roda na Oracle (runner próprio), cria e mostra a
// pública no log; numa máquina do GitHub (descartável) não cria: o pacote sai sem assinatura e o servidor que já
// exige assinatura simplesmente não instala esse (fica na versão que tem).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { textoAssinado, idChave } from '../../server/atualizar.js';

const arqPacote = process.argv[2];
const arqChave = process.env.ASSINATURA_PACOTE || path.join(os.homedir(), '.aethra', 'assinatura-pacote.pem');
const naOracle = process.env.RUNNER_ENVIRONMENT === 'self-hosted' || process.env.CRIAR_CHAVE_ASSINATURA === '1';

if (!fs.existsSync(arqChave)) {
  if (!naOracle) {
    console.log(`::warning::Sem chave de assinatura nesta máquina (${arqChave}): pacote do servidor sai SEM assinatura.`);
    process.exit(0);
  }
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.dirname(arqChave), { recursive: true, mode: 0o700 });
  fs.writeFileSync(arqChave, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log(`::warning::Chave de assinatura do pacote criada em ${arqChave}. Ponha a pública em CHAVES_ASSINATURA.`);
}
const privada = crypto.createPrivateKey(fs.readFileSync(arqChave));
const publica = crypto.createPublicKey(privada).export({ type: 'spki', format: 'der' }).toString('base64');
const pacote = JSON.parse(fs.readFileSync(arqPacote, 'utf8'));
delete pacote.assinatura;
delete pacote.assinado_por;
pacote.assinado_por = idChave(publica);
pacote.assinatura = crypto.sign(null, textoAssinado(pacote), privada).toString('base64');
fs.writeFileSync(arqPacote, JSON.stringify(pacote));
console.log(`Pacote assinado (chave ${pacote.assinado_por}). Pública: ${publica}`);
