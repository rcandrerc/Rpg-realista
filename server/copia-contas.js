// Cópia cifrada das contas para FORA da máquina (plano de lançamento v3, frente 2, até 27/11; desenho aprovado pelo
// Presidente em 19/11). O servidor faz a cópia do banco e cifra AQUI, com a chave PÚBLICA abaixo: ele nunca tem a
// chave privada e quem baixa (o workflow contas-copia.yml) nunca vê o banco aberto. A privada fica fora da Oracle
// (fontes chaves/copia-contas.pem e o Drive do André). Para voltar: ferramentas/servidor/voltar-contas.sh copia.tar --chave ...
//
// Formato (o mesmo que o voltar-contas.sh abre com openssl): um .tar com
//   chave.bin      a senha (64 letras hex) cifrada com RSA-OAEP (SHA-1, o padrão do openssl pkeyutl)
//   contas.bin     o banco cifrado como "openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:k.bin" (Salted__ + sal,
//                  PBKDF2-SHA256 com 10000 voltas dá chave e IV)
//   contas.sha256  o sha256 do banco aberto, para conferir depois de abrir
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

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

// openssl enc -aes-256-cbc -pbkdf2 -salt (padrões: SHA-256, 10000 voltas)
export function cifrarComoOpenssl(dados, senha) {
  const sal = crypto.randomBytes(8);
  const kiv = crypto.pbkdf2Sync(senha, sal, 10000, 48, 'sha256');
  const c = crypto.createCipheriv('aes-256-cbc', kiv.subarray(0, 32), kiv.subarray(32));
  return Buffer.concat([Buffer.from('Salted__'), sal, c.update(dados), c.final()]);
}

// .tar (ustar) mínimo, só arquivos pequenos e comuns
export function tar(arquivos) {
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

// db: o DatabaseSync das contas. Devolve o .tar cifrado (Buffer). O banco aberto só existe por um instante num arquivo
// temporário só do servidor, apagado logo em seguida.
export function copiaCifrada(db, chavePublica = CHAVE_COPIA) {
  if (!chavePublica.trim()) throw new Error('sem chave pública da cópia');
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'copia-'));
  const arq = path.join(pasta, 'contas.db');
  try {
    db.prepare('VACUUM INTO ?').run(arq);
    const aberto = fs.readFileSync(arq);
    const senha = crypto.randomBytes(32).toString('hex');
    const chave = crypto.publicEncrypt({ key: chavePublica, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, Buffer.from(senha));
    return tar([
      ['chave.bin', chave],
      ['contas.bin', cifrarComoOpenssl(aberto, senha)],
      ['contas.sha256', Buffer.from(crypto.createHash('sha256').update(aberto).digest('hex') + '\n')],
    ]);
  } finally { fs.rmSync(pasta, { recursive: true, force: true }); }
}
