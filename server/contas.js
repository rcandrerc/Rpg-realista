// Contas dos jogadores, guardadas no próprio servidor (SQLite num arquivo, sem Firebase).
// O Google só diz quem é a pessoa: o navegador manda o "crachá" do Google (ID token), aqui a assinatura
// é conferida com as chaves públicas do Google e o servidor devolve uma sessão própria que vale 60 dias.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PERSONAGENS, visualValido, buildValida, aparenciaValida, progressoValido, RECOMECO, AMIGA } from '@rpg/shared';

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
  constructor({ pasta, verificar, ehTestador }) {
    this.pasta = pasta;
    this.ehTestador = ehTestador || testador; // os testes trocam (o e-mail de teste não fica no repositório)
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
    // chave Groq do próprio jogador (André 2026-11-10): quem conversa com a Cecília paga com a chave dele. Fica só aqui no banco.
    if (!colunas.includes('ia_chave')) this.db.exec('ALTER TABLE contas ADD COLUMN ia_chave TEXT');
    // recomeço (André 2026-11-11): a conta de teste volta ao zero uma vez por RECOMECO.data; o que tinha fica em 'antes'
    if (!colunas.includes('recomeco')) this.db.exec('ALTER TABLE contas ADD COLUMN recomeco TEXT');
    if (!colunas.includes('antes')) this.db.exec('ALTER TABLE contas ADD COLUMN antes TEXT');
    // Vila dos Lotes: dono (chave da conta: 'c' + id), nome do dono e o que tem no lote (peças e horta, em JSON)
    this.db.exec('CREATE TABLE IF NOT EXISTS lotes (id TEXT PRIMARY KEY, dono TEXT, nome TEXT, dados TEXT, atualizado INTEGER)');
    // amigos (André 2026-11-05): cada amizade fica gravada nas duas pontas (a -> b e b -> a), até 20 por conta
    // coisas do mundo que valem para todas as salas (André 2026-11-11: a hora em que cada boss de mundo volta)
    this.db.exec('CREATE TABLE IF NOT EXISTS mundo (chave TEXT PRIMARY KEY, valor TEXT)');
    this.db.exec('CREATE TABLE IF NOT EXISTS amizades (a INTEGER NOT NULL, b INTEGER NOT NULL, desde INTEGER, PRIMARY KEY (a, b))');
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
      nome: this.db.prepare('UPDATE contas SET nome = ? WHERE id = ? AND visual IS NOT NULL'),
      nomeLote: this.db.prepare('UPDATE lotes SET nome = ? WHERE dono = ?'),
      apagarSessoes: this.db.prepare('DELETE FROM sessoes WHERE conta = ?'),
      apagarConta: this.db.prepare('DELETE FROM contas WHERE id = ?'),
      build: this.db.prepare('UPDATE contas SET build = ? WHERE id = ?'),
      progresso: this.db.prepare('UPDATE contas SET progresso = ? WHERE id = ?'),
      recomecar: this.db.prepare('UPDATE contas SET antes = ?, progresso = NULL, build = NULL, recomeco = ? WHERE id = ?'),
      todasContas: this.db.prepare('SELECT id, email, progresso, build, recomeco, antes FROM contas'),
      lotesDoDono: this.db.prepare('SELECT * FROM lotes WHERE dono = ?'),
      chaveIa: this.db.prepare('SELECT ia_chave FROM contas WHERE id = ?'),
      salvarChaveIa: this.db.prepare('UPDATE contas SET ia_chave = ? WHERE id = ?'),
      lotes: this.db.prepare('SELECT * FROM lotes'),
      lote: this.db.prepare('SELECT * FROM lotes WHERE id = ?'),
      loteDoDono: this.db.prepare('SELECT * FROM lotes WHERE dono = ?'),
      gravarLote: this.db.prepare('INSERT INTO lotes (id, dono, nome, dados, atualizado) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET dono = excluded.dono, nome = excluded.nome, dados = excluded.dados, atualizado = excluded.atualizado'),
      soltarLotes: this.db.prepare("UPDATE lotes SET dono = NULL, nome = '', dados = '{}' WHERE dono = ?"),
      amigos: this.db.prepare('SELECT c.id, c.nome FROM amizades z JOIN contas c ON c.id = z.b WHERE z.a = ? ORDER BY c.nome'),
      nAmigos: this.db.prepare('SELECT COUNT(*) AS n FROM amizades WHERE a = ?'),
      amizade: this.db.prepare('INSERT OR IGNORE INTO amizades (a, b, desde) VALUES (?, ?, ?)'),
      desamizade: this.db.prepare('DELETE FROM amizades WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)'),
      apagarAmizades: this.db.prepare('DELETE FROM amizades WHERE a = ? OR b = ?'),
    };
    this.copiar();
    setInterval(() => this.copiar(), 6 * 3600 * 1000).unref();
    this.recomecar(); // depois da cópia de segurança: o banco de antes do recomeço fica na pasta de cópias
  }

  // Recomeço do zero (André 2026-11-11: "zera tudo como se a Cecília tivesse começado hoje; eu também, do zero").
  // Roda quando o servidor sobe (antes de qualquer sala carregar os terrenos), uma vez para cada RECOMECO.data:
  // - conta de teste: nível, XP, atributos, skills, build, ouro, mochila, equipamento, profissões e missões zeram, e o
  //   terreno (casa, baú, horta, fornos) volta à venda. Nome, aparência, amigos e chave da IA ficam.
  // - Cecília: o terreno dela fica vazio (ela levanta a casa de novo) e o progresso dela zera (shared/amiga.js).
  // Tudo o que tinha vai para a coluna 'antes' da conta (ou 'antes' dentro do terreno dela): dá para voltar.
  recomecar() {
    const data = RECOMECO?.data; if (!data) return;
    for (const c of this.q.todasContas.all()) {
      if (c.recomeco === data || !this.ehTestador(c.email)) continue;
      const lotes = this.q.lotesDoDono.all('c' + c.id);
      const antes = JSON.stringify({ data, em: Date.now(), progresso: c.progresso || null, build: c.build || null, lotes, antes: c.antes || null });
      this.q.recomecar.run(antes, data, c.id);
      this.q.soltarLotes.run('c' + c.id);
      console.log(`Recomeço ${data}: conta ${c.id} voltou ao Nv 1 (${lotes.length} terreno(s) à venda)`);
    }
    for (const l of this.q.lotesDoDono.all(AMIGA.conta)) {
      let d = {}; try { d = l.dados ? JSON.parse(l.dados) : {}; } catch { /* estragado: começa vazio */ }
      if (d.amiga?.recomeco === data) continue;
      const { amiga: velha, ...resto } = d;
      const antes = { ...(velha || {}), lote: resto, guardado: data }; delete antes.antes;
      const novo = { ret: d.ret, pecas: [], horta: {}, prox: 1, taxa: Date.now(), amiga: { recomeco: data, antes } };
      this.q.gravarLote.run(l.id, l.dono, l.nome, JSON.stringify(novo), Date.now());
      console.log(`Recomeço ${data}: terreno da ${AMIGA.nome} vazio, progresso dela zerado`);
    }
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
  // Nome único (André 2026-11-10): nenhuma outra conta com personagem criado usa o mesmo nome (sem diferença de
  // maiúscula; o lower do SQLite só conhece A-Z, então a conferência com acento é feita aqui)
  nomeLivre(nome, id) {
    const k = String(nome).toLocaleLowerCase('pt-BR');
    for (const c of this.db.prepare('SELECT id, nome FROM contas WHERE visual IS NOT NULL AND id != ?').iterate(id ?? -1))
      if (String(c.nome || '').toLocaleLowerCase('pt-BR') === k) return false;
    return true;
  }
  // Nome trocado pagando (o personagem já existe): a conta e a placa do terreno
  salvarNome(id, nome) { this.q.nome.run(nome, id); this.q.nomeLote.run(nome, 'c' + id); }
  apagar(id) { this.q.apagarSessoes.run(id); this.q.apagarConta.run(id); this.q.soltarLotes.run('c' + id); this.q.apagarAmizades.run(id, id); } // conta apagada: o lote volta à venda e some das listas de amigos
  salvarBuild(id, build) { if (buildValida(build)) this.q.build.run(JSON.stringify(build), id); }
  salvarProgresso(id, prog) { this.q.progresso.run(JSON.stringify(progressoValido(prog)), id); }
  // chave Groq do jogador (conversa com a Cecília): nunca vai para o celular nem para o código, só o servidor usa
  chaveIa(id) { return this.q.chaveIa.get(id)?.ia_chave || ''; }
  salvarChaveIa(id, chave) { this.q.salvarChaveIa.run(chave || null, id); }

  // ---------- amigos ----------
  amigos(id) { return this.q.amigos.all(id).map((r) => ({ id: Number(r.id), nome: r.nome })); }
  // grava a amizade nas duas pontas; false se uma das listas já está cheia
  fazerAmizade(a, b, max) {
    if (a === b || this.q.nAmigos.get(a).n >= max || this.q.nAmigos.get(b).n >= max) return false;
    const agora = Date.now();
    this.q.amizade.run(a, b, agora); this.q.amizade.run(b, a, agora);
    return true;
  }
  desfazerAmizade(a, b) { this.q.desamizade.run(a, b, b, a); }

  // ---------- Vila dos Lotes ----------
  // todos os lotes guardados (formato de Simulacao.carregarLotes)
  // o nível do jogador mais alto do servidor (André 2026-11-11: os NPCs nunca passam dele)
  // null (sem teto) se não deu para ler: melhor sem teto do que todos parados no Nv 1
  nivelMaisAlto() {
    try { return this.db.prepare("SELECT MAX(CAST(json_extract(progresso, '$.nivel') AS INTEGER)) AS n FROM contas WHERE progresso IS NOT NULL").get()?.n || null; } catch {
      try { let n = 0; for (const r of this.db.prepare('SELECT progresso FROM contas WHERE progresso IS NOT NULL').all()) { try { n = Math.max(n, JSON.parse(r.progresso)?.nivel | 0); } catch { /* conta com progresso estragado */ } } return n || null; } catch { return null; }
    }
  }
  lerMundo(chave) { try { const r = this.db.prepare('SELECT valor FROM mundo WHERE chave = ?').get(chave); return r ? JSON.parse(r.valor) : null; } catch { return null; } }
  gravarMundo(chave, valor) { this.db.prepare('INSERT INTO mundo (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(chave, JSON.stringify(valor)); }
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
  // mudar o tamanho: o mesmo dono, sem cruzar ninguém; só troca o retângulo (peças e horta ficam como estão no banco)
  mudarLote(id, dono, ret, retDe) {
    const l = this.q.lote.get(id);
    if (!l || l.dono !== dono) return false;
    for (const o of this.lotes()) {
      if (!o.dono || o.id === id) continue;
      const r = retDe(o);
      if (r && ret.x0 < r.x1 && r.x0 < ret.x1 && ret.z0 < r.z1 && r.z0 < ret.z1) return false;
    }
    const d = linhaLote(l).dados; d.ret = ret;
    this.q.gravarLote.run(id, l.dono, l.nome, JSON.stringify(d), Date.now());
    return true;
  }
  // vendido de volta para o jogo: a linha fica sem dono na hora (as outras salas já podem vender o chão)
  soltarLote(id) { this.q.gravarLote.run(id, null, '', '{}', Date.now()); }
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
  return { id: c.id, nome: c.nome, visual: c.visual, aparencia, build: buildValida(build) ? build : null, progresso, testador: testador(c.email), ia: !!c.ia_chave };
}
