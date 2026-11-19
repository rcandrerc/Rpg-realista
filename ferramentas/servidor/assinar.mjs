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
import { textoAssinado, idChave, CHAVES_ASSINATURA } from '../../server/atualizar.js';

const arqPacote = process.argv[2];
const arqChave = process.env.ASSINATURA_PACOTE || path.join(os.homedir(), '.aethra', 'assinatura-pacote.pem');
const naOracle = process.env.RUNNER_ENVIRONMENT === 'self-hosted';
const exigida = CHAVES_ASSINATURA.length > 0; // passo 2 em diante: o servidor só instala pacote assinado
const falhar = (msg) => { console.log(`::error::${msg} Nada publicado; veja ferramentas/runner/LEIAME.md.`); process.exit(1); };

// Cria a chave sem corrida: grava num arquivo temporário e liga no nome final só se ninguém criou antes (link falha
// com EEXIST). Um job morto no meio deixa só o temporário, nunca uma chave cortada.
function criarChave() {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.dirname(arqChave), { recursive: true, mode: 0o700 });
  const tmp = `${arqChave}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  try {
    fs.linkSync(tmp, arqChave);
    console.log(`::warning::Chave de assinatura do pacote criada em ${arqChave}. Ponha a pública em CHAVES_ASSINATURA.`);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e; // outro job criou junto: fica a dele
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

if (!fs.existsSync(arqChave)) {
  // Máquina do GitHub (atalho de emergência, LEIAME): o site sai e o servidor fica na versão que tem.
  if (!naOracle && process.env.CRIAR_CHAVE_ASSINATURA !== '1') {
    console.log(`::warning::Sem chave de assinatura nesta máquina (${arqChave}): pacote do servidor sai SEM assinatura.`);
    process.exit(0);
  }
  // Na Oracle, depois do passo 2, chave sumida (runner reinstalado, ~ apagado) NÃO cria outra sozinha: uma chave
  // nova faria o jogo atualizar e o servidor recusar. Falha e espera alguém criar de propósito.
  if (exigida && process.env.CRIAR_CHAVE_ASSINATURA !== '1') falhar(`Sem a chave de assinatura (${arqChave}) e o servidor já exige assinatura.`);
  criarChave();
}
// Chave existindo mas ilegível (arquivo estragado, sem permissão): derruba o job de propósito (set -e no empacotar.sh).
// Assim nada publica: cliente e servidor ficam juntos na versão anterior e o job vermelho avisa a ronda das 9h.
let privada;
try { privada = crypto.createPrivateKey(fs.readFileSync(arqChave)); } catch (e) {
  falhar(`Chave de assinatura ilegível (${arqChave}): ${e.message}.`);
}
const publica = crypto.createPublicKey(privada).export({ type: 'spki', format: 'der' }).toString('base64');
// Chave diferente da que o servidor aceita (outra máquina, chave trocada): mesma coisa, nada publica.
if (exigida && !CHAVES_ASSINATURA.includes(publica)) falhar(`A chave desta máquina (${idChave(publica)}) não está em CHAVES_ASSINATURA.`);
const pacote = JSON.parse(fs.readFileSync(arqPacote, 'utf8'));
delete pacote.assinatura;
delete pacote.assinado_por;
// Ordem dos pacotes (revisão de segurança): o servidor recusa pacote emitido antes do último que instalou, então
// um pacote antigo (ainda que assinado) não volta a ser instalado.
pacote.emitido_em = Date.now();
// Conserto urgente (PR com [servidor urgente] no título, ver empacotar.sh): instala fora da janela de horário.
if (process.env.URGENTE === '1') pacote.urgente = true; else delete pacote.urgente;
// [furar bloqueio] (só com o OK do Presidente escrito no PR): instala até no bloqueio do lançamento.
if (process.env.FURAR_BLOQUEIO === '1') pacote.furar_bloqueio = true; else delete pacote.furar_bloqueio;
pacote.assinado_por = idChave(publica);
pacote.assinatura = crypto.sign(null, textoAssinado(pacote), privada).toString('base64');
fs.writeFileSync(arqPacote, JSON.stringify(pacote));
console.log(`Pacote assinado (chave ${pacote.assinado_por}). Pública: ${publica}`);
