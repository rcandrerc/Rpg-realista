// Script de volta das contas (plano de lançamento v3, frente 2). Roda o ferramentas/servidor/voltar-contas.sh numa pasta
// de mentira, sem systemd (SERVICO= vazio): cópia diária, cópia cifrada, cópia estragada e o desfazer.
// Uso: node ferramentas/testes/voltar-contas.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { copiaCifrada } from '../../server/copia-contas.js';
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const SCRIPT = new URL('../servidor/voltar-contas.sh', import.meta.url).pathname;
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'voltar-')), copias = path.join(pasta, 'copias');
fs.mkdirSync(copias);
const env = { ...process.env, PASTA: pasta, SERVICO: '', DONO: '' };
const roda = (...a) => spawnSync('bash', [SCRIPT, ...a], { env, encoding: 'utf8' });
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

// cifrada (o formato da cópia de fora da máquina)
const t = fs.mkdtempSync(path.join(os.tmpdir(), 'cifra-')), sh = (c) => execFileSync('bash', ['-c', c], { cwd: t });
banco(path.join(t, 'contas.db'), 3);
sh('openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out priv.pem 2>/dev/null && openssl pkey -in priv.pem -pubout -out pub.pem');
sh('openssl rand -out k.bin 32 && openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:k.bin -in contas.db -out contas.bin && openssl pkeyutl -encrypt -pubin -inkey pub.pem -pkeyopt rsa_padding_mode:oaep -in k.bin -out chave.bin && sha256sum contas.db | cut -d" " -f1 > contas.sha256 && tar -cf copia.tar chave.bin contas.bin contas.sha256');
ok(roda(path.join(t, 'copia.tar')).status !== 0, 'cifrada sem --chave: recusa');
sh('openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out outra.pem 2>/dev/null');
ok(roda(path.join(t, 'copia.tar'), '--chave', path.join(t, 'outra.pem')).status !== 0 && contas(path.join(pasta, 'contas.db')) === 7, 'chave errada: recusa e não mexe');
r = roda(path.join(t, 'copia.tar'), '--chave', path.join(t, 'priv.pem'));
ok(r.status === 0 && contas(path.join(pasta, 'contas.db')) === 3, 'volta da cópia cifrada com a chave certa');

// a cópia que o SERVIDOR cifra (server/copia-contas.js, sem openssl) abre no script com a chave privada
banco(path.join(t, 'servidor.db'), 11);
const dbs = new DatabaseSync(path.join(t, 'servidor.db'));
const tarS = copiaCifrada(dbs, fs.readFileSync(path.join(t, 'pub.pem'), 'utf8')); dbs.close();
fs.writeFileSync(path.join(t, 'servidor.tar'), tarS);
ok(!tarS.includes(Buffer.from('CREATE TABLE contas')), 'a cópia do servidor não leva nada do banco aberto');
r = roda(path.join(t, 'servidor.tar'), '--chave', path.join(t, 'priv.pem'));
ok(r.status === 0 && contas(path.join(pasta, 'contas.db')) === 11, 'volta da cópia que o servidor cifrou');
let semChave = false; try { copiaCifrada(new DatabaseSync(':memory:'), ''); } catch { semChave = true; }
ok(semChave, 'sem chave pública o servidor não faz cópia');
const idx = fs.readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8');
ok(/contas-copia\.yml@refs\/heads\/main/.test(idx) && idx.includes("payload.ref === 'refs/heads/main'") && idx.includes('3600e3'), 'rota: só o workflow da main e uma vez por hora');
fs.rmSync(pasta, { recursive: true, force: true }); fs.rmSync(t, { recursive: true, force: true });
