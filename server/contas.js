// Contas dos jogadores, guardadas no próprio servidor (SQLite num arquivo, sem Firebase).
// O Google só diz quem é a pessoa: o navegador manda o "crachá" do Google (ID token), aqui a assinatura
// é conferida com as chaves públicas do Google e o servidor devolve uma sessão própria que vale 60 dias.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PERSONAGENS, buildValida } from '@rpg/shared';

const DIA = 24 * 3600 * 1000;
const VALIDADE_SESSAO = 60 * DIA;
const COPIAS_GUARDADAS = 14;

const chavesGoogle = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const resumo = (token) => crypto.createHash('sha256').update(token).digest('hex');
const hoje = () => new Date().toISOString().slice(0, 10);

// Confere o ID token do Google: assinatura, emissor, validade e se foi feito para o nosso Client ID
export function verificadorGoogle(clientId) {
  return async (credencial) => {
    const { payload } = await jwtVerify(credencial, chavesGoogle, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId });
    return payload;
  };
}

export class Contas {
  constructor({ pasta, verificar }) {
    this.pasta = pasta;
    this.verificar = verificar;
    fs.mkdirSync(pasta, { recursive: true });
    this.db = new DatabaseSync(path.join(pasta, 'contas.db'));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS contas (
        id INTEGER PRIMARY KEY,
        google TEXT UNIQUE NOT NULL,
        email TEXT,
        nome TEXT NOT NULL,
        visual TEXT,
        build TEXT,
        criada INTEGER NOT NULL,
        ultimo_acesso INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessoes (
        resumo TEXT PRIMARY KEY,
        conta INTEGER NOT NULL REFERENCES contas(id),
        expira INTEGER NOT NULL
      );`);
    this.q = {
      porGoogle: this.db.prepare('SELECT * FROM contas WHERE google = ?'),
      criar: this.db.prepare('INSERT INTO contas (google, email, nome, criada, ultimo_acesso) VALUES (?, ?, ?, ?, ?)'),
      tocar: this.db.prepare('UPDATE contas SET email = ?, ultimo_acesso = ? WHERE id = ?'),
      porSessao: this.db.prepare('SELECT c.*, s.expira FROM sessoes s JOIN contas c ON c.id = s.conta WHERE s.resumo = ?'),
      novaSessao: this.db.prepare('INSERT INTO sessoes (resumo, conta, expira) VALUES (?, ?, ?)'),
      renovar: this.db.prepare('UPDATE sessoes SET expira = ? WHERE resumo = ?'),
      apagarSessao: this.db.prepare('DELETE FROM sessoes WHERE resumo = ?'),
      limpar: this.db.prepare('DELETE FROM sessoes WHERE expira < ?'),
      visual: this.db.prepare('UPDATE contas SET visual = ? WHERE id = ?'),
      build: this.db.prepare('UPDATE contas SET build = ? WHERE id = ?'),
    };
    this.copiar();
    setInterval(() => this.copiar(), 6 * 3600 * 1000).unref();
  }

  // Entrar com Google: cria a conta na primeira vez. Devolve { sessao, conta }.
  async entrar(credencial) {
    const g = await this.verificar(String(credencial || ''));
    if (!g?.sub) throw new Error('crachá do Google sem identificação');
    const agora = Date.now();
    let c = this.q.porGoogle.get(g.sub);
    if (!c) {
      const nome = String(g.given_name || g.name || 'Andarilho').slice(0, 20);
      this.q.criar.run(g.sub, g.email || null, nome, agora, agora);
      c = this.q.porGoogle.get(g.sub);
      console.log(`Conta nova: ${c.id} (${nome})`);
    } else this.q.tocar.run(g.email || c.email, agora, c.id);
    const sessao = crypto.randomBytes(32).toString('base64url');
    this.q.novaSessao.run(resumo(sessao), c.id, agora + VALIDADE_SESSAO);
    return { sessao, conta: publica(c) };
  }

  // Sessão guardada no aparelho → conta (ou null). Cada uso empurra a validade para mais 60 dias.
  porSessao(sessao) {
    if (typeof sessao !== 'string' || sessao.length < 20) return null;
    const r = resumo(sessao), c = this.q.porSessao.get(r), agora = Date.now();
    if (!c || c.expira < agora) return null;
    if (c.expira - agora < VALIDADE_SESSAO - DIA) this.q.renovar.run(agora + VALIDADE_SESSAO, r);
    this.q.tocar.run(c.email, agora, c.id);
    return publica(c);
  }

  sair(sessao) { if (typeof sessao === 'string') this.q.apagarSessao.run(resumo(sessao)); }

  salvarVisual(id, visual) { if (PERSONAGENS.some((p) => p.id === visual)) this.q.visual.run(visual, id); }
  salvarBuild(id, build) { if (buildValida(build)) this.q.build.run(JSON.stringify(build), id); }

  // Cópia de segurança uma vez por dia em dados/copias (guarda as últimas 14)
  copiar() {
    try {
      this.q.limpar.run(Date.now());
      const pasta = path.join(this.pasta, 'copias');
      fs.mkdirSync(pasta, { recursive: true });
      const arq = path.join(pasta, `contas-${hoje()}.db`);
      if (fs.existsSync(arq)) return;
      this.db.prepare('VACUUM INTO ?').run(arq);
      const velhas = fs.readdirSync(pasta).filter((f) => /^contas-.*\.db$/.test(f)).sort().slice(0, -COPIAS_GUARDADAS);
      for (const f of velhas) fs.unlinkSync(path.join(pasta, f));
    } catch (e) { console.error('Falha na cópia de segurança das contas:', e.message); }
  }
}

// O que o jogo (e o próprio jogador) pode ver da conta
function publica(c) {
  let build = null;
  try { build = c.build ? JSON.parse(c.build) : null; } catch { /* build antiga inválida: usa a padrão */ }
  return { id: c.id, nome: c.nome, visual: c.visual, build: buildValida(build) ? build : null };
}
