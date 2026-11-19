// Pacote do servidor assinado (portão 10/12 do plano de lançamento): o servidor só instala o que a chave da
// máquina de builds assinou. Testa ferramentas/servidor/assinar.mjs + assinaturaValida/chavesAceitas (server/atualizar.js).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assinaturaValida, chavesAceitas, emitidoAceito, CHAVES_ASSINATURA } from '../../server/atualizar.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'assinatura-'));
let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? 'ok' : 'FALHOU'} ${nome}`); if (!cond) falhas++; };
const assinar = (ambiente) => execFileSync('node', [path.join(raiz, 'ferramentas/servidor/assinar.mjs'), path.join(tmp, 'p.json')],
  { env: { ...process.env, ASSINATURA_PACOTE: path.join(tmp, 'chave.pem'), RUNNER_ENVIRONMENT: ambiente, CRIAR_CHAVE_ASSINATURA: '' } }).toString();
const ler = () => JSON.parse(fs.readFileSync(path.join(tmp, 'p.json'), 'utf8'));

fs.writeFileSync(path.join(tmp, 'p.json'), JSON.stringify({ versao: 'abc', chave: 'k', iv: 'i', tag: 't', dados: 'd' }));
ok(assinar('github-hosted').includes('SEM assinatura') && !fs.existsSync(path.join(tmp, 'chave.pem')), 'máquina do GitHub não cria chave');
const publica = assinar('self-hosted').match(/Pública: (\S+)/)[1];
const p = ler();
ok((fs.statSync(path.join(tmp, 'chave.pem')).mode & 0o777) === 0o600, 'chave criada só para o dono (600)');
ok(assinaturaValida(p, [publica]), 'pacote assinado vale');
const outra = crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
ok(!assinaturaValida(p, [outra]), 'outra chave não vale');
ok(!assinaturaValida({ ...p, dados: 'x' }, [publica]), 'dados trocados não valem');
ok(!assinaturaValida({ ...p, urgente: true }, [publica]), 'campo novo acrescentado não vale');
ok(!assinaturaValida({ ...p, assinatura: undefined }, [publica]), 'sem assinatura não vale');
ok(assinaturaValida(p, ['lixo', publica]), 'chave mal escrita na lista não derruba as outras');
fs.mkdirSync(path.join(tmp, 'srv'));
fs.writeFileSync(path.join(tmp, 'srv/chaves-assinatura.txt'), `# reserva\n${publica}\n\n`);
ok(chavesAceitas(path.join(tmp, 'srv')).includes(publica) && chavesAceitas(path.join(tmp, 'srv')).length === CHAVES_ASSINATURA.length + 1, 'chaves-assinatura.txt soma à lista');
assinar('self-hosted');
ok(assinaturaValida(ler(), [publica]), 'assinar de novo troca a assinatura sem estragar');
ok(Number(ler().emitido_em) > 0, 'pacote leva a data de emissão (emitido_em)');
const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pRsa = { versao: 'x', dados: 'd' };
const { textoAssinado } = await import('../../server/atualizar.js');
pRsa.assinatura = crypto.sign(null, textoAssinado(pRsa), rsa.privateKey).toString('base64');
ok(!assinaturaValida(pRsa, [rsa.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')]), 'chave RSA na lista não vale (só Ed25519)');
const srv = path.join(tmp, 'srv');
ok(emitidoAceito({ emitido_em: 100 }, srv) === 100, 'primeiro pacote com data passa');
fs.writeFileSync(path.join(srv, 'emitido.txt'), '100\n');
ok(emitidoAceito({ emitido_em: 100 }, srv) === null && emitidoAceito({ emitido_em: 99 }, srv) === null, 'pacote igual ou mais velho que o último não passa');
ok(emitidoAceito({ emitido_em: 101 }, srv) === 101, 'pacote mais novo passa');
ok(emitidoAceito({}, srv) === null, 'pacote sem data não passa');
// duas criações ao mesmo tempo: fica uma chave só, e as duas assinaturas batem com ela
fs.rmSync(path.join(tmp, 'chave.pem'));
const { spawn } = await import('node:child_process');
fs.writeFileSync(path.join(tmp, 'a.json'), '{"versao":"a"}'); fs.writeFileSync(path.join(tmp, 'b.json'), '{"versao":"b"}');
const roda = (arq) => new Promise((fim) => { let out = ''; const c = spawn('node', [path.join(raiz, 'ferramentas/servidor/assinar.mjs'), path.join(tmp, arq)], { env: { ...process.env, ASSINATURA_PACOTE: path.join(tmp, 'chave.pem'), RUNNER_ENVIRONMENT: 'self-hosted' } }); c.stdout.on('data', (d) => { out += d; }); c.on('close', () => fim(out)); });
await Promise.all([roda('a.json'), roda('b.json')]);
const pubFinal = crypto.createPublicKey(crypto.createPrivateKey(fs.readFileSync(path.join(tmp, 'chave.pem')))).export({ type: 'spki', format: 'der' }).toString('base64');
const lerJ = (a) => JSON.parse(fs.readFileSync(path.join(tmp, a), 'utf8'));
ok(assinaturaValida(lerJ('a.json'), [pubFinal]) && assinaturaValida(lerJ('b.json'), [pubFinal]), 'criação ao mesmo tempo fica com uma chave só');
ok(!fs.readdirSync(tmp).some((f) => f.endsWith('.tmp')), 'nenhum arquivo temporário de chave sobra');
fs.rmSync(tmp, { recursive: true, force: true });
if (falhas) { console.log(`${falhas} falha(s)`); process.exit(1); }
console.log('assinatura do pacote: tudo certo');
