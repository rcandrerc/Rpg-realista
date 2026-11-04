// Contas dos jogadores, guardadas no próprio servidor (SQLite num arquivo, sem Firebase).
// O Google só diz quem é a pessoa: o navegador manda o "crachá" do Google (ID token), aqui a assinatura
// é conferida com as chaves públicas do Google e o servidor devolve uma sessão própria que vale 60 dias.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PERSONAGENS, visualValido, buildValida, aparenciaValida, progressoValido } from '@rpg/shared';

const DIA = 24 * 3600 * 1000;
const VALIDADE_SESSAO = 60 * DIA;
const COPIAS_GUARDADAS = 14;

const chavesGoogle = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const resumo = (token) => crypto.createHash('sha256').update(token).digest('hex');
const hoje = () => new Date().toISOString().slice(0, 10);
// Contas de teste (o e-mail vai só como resumo sha256, para não ficar exposto no código): ganham as 4 páginas da
// mochila sem pagar. André 2026-11-03: "pra mim já deixa liberado, porque eu quero testar".
const TESTADORES = new Set(['33e46272579a8148b16df7e1c429d644cb3e590d43337f83a88670f88e2cac48']);
const testador = (email) => !!email && TESTADORES.has(crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex'));

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
        aparencia TEXT,
        criada INTEGER NOT NULL,
        ultimo_acesso INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessoes (
        resumo TEXT PRIMARY KEY,
        conta INTEGER NOT NULL REFERENCES contas(id),
        expira INTEGER NOT NULL
      );`);
    // bancos criados antes da coluna aparencia
    // bancos criados antes das colunas aparencia e progresso (nível, atributos e skills)
    const colunas = this.db.prepare('PRAGMA table_info(contas)').all().map((c) => c.name);
    if (!colunas.includes('aparencia')) this.db.exec('ALTER TABLE contas ADD COLUMN aparencia TEXT');
    if (!colunas.includes('progresso')) this.db.exec('ALTER TABLE contas ADD COLUMN progresso TEXT');
    // Vila dos Lotes: dono (chave da conta: 'c' + id), nome do dono e o que tem no lote (peças e horta, em JSON)
    this.db.exec('CREATE TABLE IF NOT EXISTS lotes (id TEXT PRIMARY KEY, dono TEXT, nome TEXT, dados TEXT, atualizado INTEGER)');
    this.q = {
      porGoogle: this.db.prepare('SELECT * FROM contas WHERE google = ?'),
      criar: this.db.prepare('INSERT INTO contas (google, email, nome, criada, ultimo_acesso) VALUES (?, ?, ?, ?, ?)'),
      tocar: this.db.prepare('UPDATE contas SET email = ?, ultimo_acesso = ? WHERE id = ?'),
      porSessao: this.db.prepare('SELECT c.*, s.expira FROM sessoes s JOIN contas c ON c.id = s.conta WHERE s.resumo = ?'),
      novaSessao: this.db.prepare('INSERT INTO sessoes (resumo, conta, expira) VALUES (?, ?, ?)'),
      renovar: this.db.prepare('UPDATE sessoes SET expira = ? WHERE resumo = ?'),
      apagarSessao: this.db.prepare('DELETE FROM sessoes WHERE resumo = ?'),
      limpar: this.db.prepare('DELETE FROM sessoes WHERE expira < ?'),
      personagem: this.db.prepare('UPDATE contas SET nome = ?, visual = ?, aparencia = ? WHERE id = ? AND visual IS NULL'),
      aparencia: this.db.prepare('UPDATE contas SET aparencia = ? WHERE id = ? AND visual IS NOT NULL'),
      visual: this.db.prepare('UPDATE contas SET visual = ? WHERE id = ? AND visual IS NOT NULL'),
      apagarSessoes: this.db.prepare('DELETE FROM sessoes WHERE conta = ?'),
      apagarConta: this.db.prepare('DELETE FROM contas WHERE id = ?'),
      build: this.db.prepare('UPDATE contas SET build = ? WHERE id = ?'),
      progresso: this.db.prepare('UPDATE contas SET progresso = ? WHERE id = ?'),
      lotes: this.db.prepare('SELECT * FROM lotes'),
      lote: this.db.prepare('SELECT * FROM lotes WHERE id = ?'),
      loteDoDono: this.db.prepare('SELECT * FROM lotes WHERE dono = ?'),
      gravarLote: this.db.prepare('INSERT INTO lotes (id, dono, nome, dados, atualizado) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET dono = excluded.dono, nome = excluded.nome, dados = excluded.dados, atualizado = excluded.atualizado'),
      soltarLotes: this.db.prepare("UPDATE lotes SET dono = NULL, nome = '', dados = '{}' WHERE dono = ?"),
    };
    this.copiar();
    setInterval(() => this.copiar(), 6 * 3600 * 1000).unref();
  }

  // Login com Google. modo 'entrar' só entra em conta que já existe (sem conta → erro semConta);
  // 'criar' (ou sem modo) cria a conta na primeira vez. Devolve { sessao, conta, nova }.
  async entrar(credencial, modo) {
    const g = await this.verificar(String(credencial || ''));
    if (!g?.sub) throw new Error('crachá do Google sem identificação');
    const agora = Date.now();
    let c = this.q.porGoogle.get(g.sub);
    const nova = !c;
    if (!c && modo === 'entrar') throw Object.assign(new Error('sem conta'), { semConta: true });
    if (!c) {
      const nome = String(g.given_name || g.name || 'Andarilho').slice(0, 20);
      this.q.criar.run(g.sub, g.email || null, nome, agora, agora);
      c = this.q.porGoogle.get(g.sub);
      console.log(`Conta nova: ${c.id} (${nome})`);
    } else this.q.tocar.run(g.email || c.email, agora, c.id);
    const sessao = crypto.randomBytes(32).toString('base64url');
    this.q.novaSessao.run(resumo(sessao), c.id, agora + VALIDADE_SESSAO);
    return { sessao, conta: publica(c), nova };
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

  // Sessão nova para a mesma conta (ligar o app do celular a partir do login feito no site)
  novaSessaoPara(id) {
    const sessao = crypto.randomBytes(32).toString('base64url');
    this.q.novaSessao.run(resumo(sessao), id, Date.now() + VALIDADE_SESSAO);
    return sessao;
  }

  sair(sessao) { if (typeof sessao === 'string') this.q.apagarSessao.run(resumo(sessao)); }

  // Personagem criado (uma vez só: depois que a conta tem visual, não muda mais)
  salvarPersonagem(id, { nome, visual, aparencia }) {
    if (visualValido(visual)) this.q.personagem.run(nome, visual, JSON.stringify(aparencia), id);
  }
  // Aparência mudada depois de criado (só cores, altura e rosto)
  salvarAparencia(id, aparencia) { this.q.aparencia.run(JSON.stringify(aparencia), id); }
  // Corpo trocado depois de criado (só os da lista: visualValido)
  salvarVisual(id, visual) { if (visualValido(visual)) this.q.visual.run(visual, id); }
  apagar(id) { this.q.apagarSessoes.run(id); this.q.apagarConta.run(id); this.q.soltarLotes.run('c' + id); } // conta apagada: o lote volta à venda
  salvarBuild(id, build) { if (buildValida(build)) this.q.build.run(JSON.stringify(build), id); }
  salvarProgresso(id, prog) { this.q.progresso.run(JSON.stringify(progressoValido(prog)), id); }

  // ---------- Vila dos Lotes ----------
  // todos os lotes guardados (formato de Simulacao.carregarLotes)
  lotes() { return this.q.lotes.all().map(linhaLote); }
  lote(id) { const l = this.q.lote.get(id); return l ? linhaLote(l) : null; }
  loteDoDono(dono) { const l = this.q.loteDoDono.get(dono); return l ? linhaLote(l) : null; }
  // compra: o jogador não tem outro terreno e o pedaço (ret) não encosta no de ninguém (vale entre salas diferentes
  // do servidor). retDe(linha) diz o retângulo de um terreno guardado (Terras: dados.ret; lotes antigos: o chão de antes)
  reservarLote(id, dono, nome, ret, retDe) {
    const outro = this.q.loteDoDono.get(dono);
    if (outro && outro.id !== id) return false;
    const l = this.q.lote.get(id);
    if (l?.dono && l.dono !== dono) return false;
    if (ret && retDe) {
      for (const o of this.lotes()) {
        if (!o.dono || o.id === id) continue;
        const r = retDe(o);
        if (r && ret.x0 < r.x1 && r.x0 < ret.x1 && ret.z0 < r.z1 && r.z0 < ret.z1) return false;
      }
    }
    this.q.gravarLote.run(id, dono, nome, JSON.stringify({ ret: ret || undefined, pecas: [], horta: {}, prox: 1 }), Date.now());
    return true;
  }
  salvarLote({ id, dono, nome, dados }) { this.q.gravarLote.run(id, dono, nome || '', JSON.stringify(dados || {}), Date.now()); }

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

function linhaLote(l) {
  let dados = {};
  try { dados = l.dados ? JSON.parse(l.dados) : {}; } catch { /* estragado: lote vazio */ }
  return { id: l.id, dono: l.dono || null, nome: l.nome || '', dados };
}

// O que o jogo (e o próprio jogador) pode ver da conta
function publica(c) {
  let build = null;
  try { build = c.build ? JSON.parse(c.build) : null; } catch { /* build antiga inválida: usa a padrão */ }
  let aparencia = null;
  try { aparencia = c.aparencia ? aparenciaValida(JSON.parse(c.aparencia)) : null; } catch { /* inválida: usa a padrão */ }
  let progresso = null;
  try { progresso = c.progresso ? progressoValido(JSON.parse(c.progresso)) : null; } catch { /* inválido: começa do nível 1 */ }
  return { id: c.id, nome: c.nome, visual: c.visual, aparencia, build: buildValida(build) ? build : null, progresso, testador: testador(c.email) };
}
