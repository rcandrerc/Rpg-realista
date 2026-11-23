// Script de volta das contas (plano de lançamento v3, frente 2). Roda o ferramentas/servidor/voltar-contas.sh numa pasta
// de mentira, sem systemd (SERVICO= vazio): cópia diária, cópia cifrada, cópia estragada e o desfazer.
// Uso: node ferramentas/testes/voltar-contas.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { gerarCopia } from '../../server/copia-contas.js';
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const SCRIPT = new URL('../servidor/voltar-contas.sh', import.meta.url).pathname;
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'voltar-')), copias = path.join(pasta, 'copias');
fs.mkdirSync(copias);
const env = { ...process.env, PASTA: pasta, SERVICO: '', DONO: '' };
const roda = (...a) => spawnSync('bash', [SCRIPT, ...a], { env, encoding: 'utf8', input: '' });
const rodaSim = (...a) => spawnSync('bash', [SCRIPT, ...a], { env, encoding: 'utf8', input: 'SIM\n' }); // confirma a impressão digital do --pub
const banco = (arq, n) => {
  const db = new DatabaseSync(arq);
  db.exec('CREATE TABLE contas (id INTEGER PRIMARY KEY, nome TEXT, ultimo_acesso INTEGER); CREATE TABLE lotes (id INTEGER PRIMARY KEY)');
  for (let i = 1; i <= n; i++) db.prepare('INSERT INTO contas (nome, ultimo_acesso) VALUES (?, ?)').run('c' + i, Date.now());
  db.close();
};
const contas = (arq) => { const db = new DatabaseSync(arq, { readOnly: true }); const n = db.prepare('SELECT COUNT(*) n FROM contas').get().n; db.close(); return n; };

banco(path.join(pasta, 'contas.db'), 7); // o de agora
banco(path.join(copias, 'contas-2026-11-25.db'), 5); // a cópia de um dia
let r = roda('--listar');
ok(r.status === 0 && /contas-2026-11-25\.db\s+5 contas/.test(r.stdout) && /Banco de agora: 7 contas/.test(r.stdout), '--listar mostra as cópias e quantas contas');
r = roda('2026-11-25', '--sim');
ok(r.status === 0 && contas(path.join(pasta, 'contas.db')) === 7 && /nada foi mexido/.test(r.stdout), '--sim não mexe');
r = roda('2026-11-25');
ok(r.status === 0 && contas(path.join(pasta, 'contas.db')) === 5, 'volta para a cópia do dia');
const guardado = fs.readdirSync(copias).find((f) => /^antes-da-volta-.*\.db$/.test(f));
ok(guardado && contas(path.join(copias, guardado)) === 7, 'o banco de antes fica guardado (nada some)');
r = roda(path.join(copias, guardado));
ok(r.status === 0 && contas(path.join(pasta, 'contas.db')) === 7, 'desfaz: volta para o guardado');

// estragada: não mexe em nada
fs.writeFileSync(path.join(copias, 'contas-2026-11-26.db'), 'isto não é um banco');
r = roda('2026-11-26');
ok(r.status !== 0 && contas(path.join(pasta, 'contas.db')) === 7, 'cópia estragada: recusa e não mexe');
ok(roda('2026-01-01').status !== 0, 'cópia que não existe: recusa');

// cifrada (o formato da cópia de fora da máquina), assinada com Ed25519
const t = fs.mkdtempSync(path.join(os.tmpdir(), 'cifra-')), sh = (c) => execFileSync('bash', ['-c', c], { cwd: t });
banco(path.join(t, 'contas.db'), 3);
sh('openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out priv.pem 2>/dev/null && openssl pkey -in priv.pem -pubout -out pub.pem');
sh('openssl genpkey -algorithm ed25519 -out assina.pem && openssl pkey -in assina.pem -pubout -out assina.pub.pem && openssl genpkey -algorithm ed25519 -out falsa.pem');
const monta = (assina, nome) => sh(`openssl rand -hex -out k.bin 32 && openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:k.bin -in contas.db -out contas.bin && openssl pkeyutl -encrypt -pubin -inkey pub.pem -pkeyopt rsa_padding_mode:oaep -in k.bin -out chave.bin && sha256sum contas.db | cut -d" " -f1 > contas.sha256 && printf '%s\\n%s\\n%s\\n' $(sha256sum chave.bin | cut -d" " -f1) $(sha256sum contas.bin | cut -d" " -f1) $(cat contas.sha256) > msg && date -u +%FT%TZ > quando.txt && cat quando.txt >> msg && openssl pkeyutl -sign -inkey ${assina} -rawin -in msg -out assinatura.bin && tar -cf ${nome} chave.bin contas.bin contas.sha256 quando.txt assinatura.bin`);
monta('assina.pem', 'copia.tar'); monta('falsa.pem', 'forjada.tar');
const pub = ['--pub', path.join(t, 'assina.pub.pem')];
ok(rodaSim(path.join(t, 'copia.tar'), ...pub).status !== 0, 'cifrada sem --chave: recusa');
sh('openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out outra.pem 2>/dev/null');
ok(rodaSim(path.join(t, 'copia.tar'), '--chave', path.join(t, 'outra.pem'), ...pub).status !== 0 && contas(path.join(pasta, 'contas.db')) === 7, 'chave errada: recusa e não mexe');
r = rodaSim(path.join(t, 'forjada.tar'), '--chave', path.join(t, 'priv.pem'), ...pub);
ok(r.status !== 0 && /assinatura não confere/.test(r.stderr) && contas(path.join(pasta, 'contas.db')) === 7, 'cópia assinada por outra chave (forjada no balde): recusa e não mexe');
ok(roda(path.join(t, 'copia.tar'), '--chave', path.join(t, 'priv.pem')).status !== 0, 'sem a pública fixada: recusa');
r = roda(path.join(t, 'copia.tar'), '--chave', path.join(t, 'priv.pem'), ...pub);
ok(r.status !== 0 && /impressão digital/.test(r.stdout) && contas(path.join(pasta, 'contas.db')) === 7, '--pub sem digitar SIM: mostra a impressão digital e não mexe');
// cópia com link no .tar: recusa antes de extrair
sh('ln -sf /etc/passwd quando.txt && tar -cf comlink.tar chave.bin contas.bin contas.sha256 quando.txt assinatura.bin && rm quando.txt');
ok(rodaSim(path.join(t, 'comlink.tar'), '--chave', path.join(t, 'priv.pem'), ...pub).status !== 0, '.tar com link: recusa');
// a pública fixada ao lado do script vale sem --pub e sem pergunta
const fix = fs.mkdtempSync(path.join(os.tmpdir(), 'fixada-'));
fs.copyFileSync(SCRIPT, path.join(fix, 'voltar-contas.sh')); fs.copyFileSync(path.join(t, 'assina.pub.pem'), path.join(fix, 'copia-assinatura.pub.pem'));
r = spawnSync('bash', [path.join(fix, 'voltar-contas.sh'), path.join(t, 'copia.tar'), '--chave', path.join(t, 'priv.pem')], { env, encoding: 'utf8', input: '' });
ok(r.status === 0 && contas(path.join(pasta, 'contas.db')) === 3 && /Cópia feita em 20/.test(r.stdout), 'volta da cópia cifrada com a pública fixada, mostrando a hora da cópia');
fs.rmSync(fix, { recursive: true, force: true });

// a cópia que o SERVIDOR faz (server/copia-contas.js, processo filho): sem chave de IA e sem sessões, assinada
const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'dados-'));
{
  const db = new DatabaseSync(path.join(dados, 'contas.db'));
  db.exec("PRAGMA journal_mode = WAL; CREATE TABLE contas (id INTEGER PRIMARY KEY, nome TEXT, ultimo_acesso INTEGER, ia_chave TEXT); CREATE TABLE sessoes (resumo TEXT PRIMARY KEY, conta INTEGER); CREATE TABLE lotes (id INTEGER PRIMARY KEY)");
  for (let i = 1; i <= 11; i++) db.prepare('INSERT INTO contas (nome, ultimo_acesso, ia_chave) VALUES (?, ?, ?)').run('c' + i, Date.now(), 'gsk_SEGREDO_' + i);
  db.prepare('INSERT INTO sessoes VALUES (?, 1)').run('SESSAO_SECRETA');
  // o servidor segue com o banco aberto enquanto o filho copia (WAL)
  const { arquivo, apagar } = await gerarCopia({ banco: path.join(dados, 'contas.db'), pastaDados: dados, chavePublica: fs.readFileSync(path.join(t, 'pub.pem'), 'utf8') });
  fs.copyFileSync(arquivo, path.join(t, 'servidor.tar')); apagar();
  ok(!fs.existsSync(path.dirname(arquivo)), 'a pasta temporária da cópia some depois');
  db.close();
}
const tarS = fs.readFileSync(path.join(t, 'servidor.tar'));
ok(!tarS.includes(Buffer.from('CREATE TABLE contas')), 'a cópia do servidor não leva nada do banco aberto');
ok((fs.statSync(path.join(dados, 'copia-assinatura.pem')).mode & 0o077) === 0, 'a chave de assinatura do servidor fica só para o dono (0600)');
// sem a pública do servidor: recusa; com ela (a pública fica em dados/, como no servidor de verdade): volta
r = spawnSync('bash', [SCRIPT, path.join(t, 'servidor.tar'), '--chave', path.join(t, 'priv.pem')], { env, encoding: 'utf8' });
ok(r.status !== 0, 'cópia do servidor sem a pública dele: recusa');
r = rodaSim(path.join(t, 'servidor.tar'), '--chave', path.join(t, 'priv.pem'), '--pub', path.join(dados, 'copia-assinatura.pub.pem'));
ok(r.status === 0 && contas(path.join(pasta, 'contas.db')) === 11, 'volta da cópia que o servidor cifrou e assinou');
{
  const db = new DatabaseSync(path.join(pasta, 'contas.db'), { readOnly: true });
  ok(db.prepare('SELECT COUNT(*) n FROM contas WHERE ia_chave IS NOT NULL').get().n === 0 && db.prepare('SELECT COUNT(*) n FROM sessoes').get().n === 0, 'a cópia não leva chave de IA nem sessão');
  db.close();
  const bruto = fs.readFileSync(path.join(pasta, 'contas.db'));
  ok(!bruto.includes(Buffer.from('gsk_SEGREDO_')) && !bruto.includes(Buffer.from('SESSAO_SECRETA')), 'nem nas páginas livres do banco');
}
let semChave = false; try { await gerarCopia({ banco: path.join(dados, 'contas.db'), pastaDados: dados, chavePublica: '' }); } catch { semChave = true; }
ok(semChave, 'sem chave pública o servidor não faz cópia');
const idx = fs.readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8');
ok(idx.includes("payload.ref === 'refs/heads/main'") && idx.includes('3600e3') && idx.includes('copiaT = 0;') && idx.includes("COPIA_CAMINHO = '/.github/workflows/contas-copia.yml@refs/heads/main'"), 'rota: só o workflow da main (caminho exato), uma vez por hora, e falha libera tentar de novo');
// a pública do servidor de verdade fixada no repositório (ronda 2026-11-23): impressão conferida por dois caminhos, o log
// do contas-copia.yml e a busca direta de /contas/copia-assinatura.pub.pem. Servidor novo gera chave nova: entra um
// arquivo novo ao lado e os antigos ficam (cópia velha só abre com a chave de quando foi feita).
const FIXADAS = { 'copia-assinatura-oracle-2026-11.pub.pem': 'b8dc8bb5abdf1c22866e91e09526a7119a2c7f3bf4601a397b7539c6d6b2fd51' };
for (const [arq, impressao] of Object.entries(FIXADAS)) {
  const p = path.join(path.dirname(SCRIPT), arq);
  const der = fs.existsSync(p) ? execFileSync('openssl', ['pkey', '-pubin', '-in', p, '-outform', 'DER']) : null;
  ok(der && createHash('sha256').update(der).digest('hex') === impressao && /ED25519/.test(execFileSync('openssl', ['pkey', '-pubin', '-in', p, '-noout', '-text']).toString()), `pública fixada ${arq} continua no repositório, Ed25519, impressão ${impressao.slice(0, 8)}`);
}
fs.rmSync(dados, { recursive: true, force: true });
fs.rmSync(pasta, { recursive: true, force: true }); fs.rmSync(t, { recursive: true, force: true });
