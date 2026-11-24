// Dispensar recruta (André 2026-11-24: apertou "Dispensar" achando que era sair do time): 10 minutos para chamar de
// volta pagando a taxa (shared/cla.js 'chamarVolta'), a conta guarda o dispensado (claValido) e a volta única do
// dispensado sem querer (server/contas.js devolverDispensados) pega o registro da cópia de segurança.
// Uso: node ferramentas/testes/cla-dispensar.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Simulacao, MAPA_CLAREIRA, CLA, progressoValido } from '../../shared/index.js';
import { taxaVolta } from '../../shared/cla.js';
import { Contas } from '../../server/contas.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 9 });
j.criando = false; j.ciente = true;
const p = j.prog; p.nivel = 40; p.ouro = 20000;
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador');
s.cla('A', { acao: 'fundar', nome: 'Lobos do Norte' }); p.cla.nv = 3;
j.x = rec.x + 1; j.z = rec.z;
s.cla('A', { acao: 'recrutar', tier: 'veterano' });
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
ok(p.cla.m.length === 2, 'dois recrutas');
const R = p.cla.m[0], id = R.id, cabelo = R.ap.cabelo;
const taxa = taxaVolta(R);
ok(taxa === Math.max(CLA.volta.min, Math.round((40 * R.nv) * CLA.volta.parte)), `taxa: metade do preço (${taxa})`);
s.cla('A', { acao: 'dispensar', id });
ok(p.cla.m.length === 1 && p.cla.disp?.[0]?.r.id === id && !s.amigosIa.some((x) => x.AMIGA.id === id), 'dispensou: sai do mundo e fica guardado');
ok(s.claInfo(j).disp?.[0]?.id === id && s.claInfo(j).disp[0].taxa === taxa, 'o app vê o botão de chamar de volta');
const v = progressoValido(JSON.parse(JSON.stringify(p)));
ok(v.cla.disp?.[0]?.r.id === id && v.cla.disp[0].r.ap.cabelo === cabelo, 'a conta guarda o dispensado');
const ouro = p.ouro;
s.cla('A', { acao: 'chamarVolta', id });
ok(p.cla.m.some((o) => o.id === id && o.ap.cabelo === cabelo) && p.ouro === ouro - taxa && !p.cla.disp, 'chamou de volta pagando a taxa');
ok(s.recrutasNoMundo(j).some((x) => x.AMIGA.id === id), 'voltou ao mundo');
// passou dos 10 minutos: não volta
s.cla('A', { acao: 'dispensar', id });
p.cla.disp[0].ate = Date.now() - 1;
s.cla('A', { acao: 'chamarVolta', id });
ok(!p.cla.m.some((o) => o.id === id), 'depois de 10 minutos não volta');
ok(!progressoValido(JSON.parse(JSON.stringify(p))).cla.disp, 'vencido some da conta');

// a volta única: o registro vem da cópia de segurança
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dispensa-'));
const C = new Contas({ pasta, verificar: async () => null });
const agora = Date.now();
const mem = { id: 'rcbento12345', nome: 'Bento Lobo', g: 'm', tier: 'veterano', ap: { cabelo: 0x112233 }, jeito: CLA.jeitos[0], gosto: 'cacar', nv0: 20, nv: 20, desde: agora - 864e5 };
const outro = { ...mem, id: 'rcoutro12345', nome: 'Ana Brasa', g: 'f' };
const progAntes = { nivel: 40, ouro: 100, cla: { n: 'Lobos do Norte', c: agora - 9e7, cofre: 0, sem: agora + 9e7, nv: 3, m: [mem, outro], log: [] } };
const progAgora = { nivel: 40, ouro: 100, cla: { n: 'Lobos do Norte', c: agora - 9e7, cofre: 0, sem: agora + 9e7, nv: 3, m: [outro], log: [{ t: agora - 60e3, txt: 'Dispensou Bento Lobo', v: 0 }] } };
C.db.prepare('INSERT INTO contas (id, google, nome, criada, ultimo_acesso, progresso) VALUES (?, ?, ?, ?, ?, ?)').run(5, 'g5', 'André', agora, agora, JSON.stringify(progAntes));
fs.mkdirSync(path.join(pasta, 'copias'), { recursive: true });
C.db.prepare('VACUUM INTO ?').run(path.join(pasta, 'copias', 'contas-2099-01-01.db'));
C.db.prepare('UPDATE contas SET progresso = ? WHERE id = 5').run(JSON.stringify(progAgora));
C.gravarMundo('npc:rcbento12345', { t: agora - 60e3, prog: { nivel: 26, ouro: 777 } });
const n = C.devolverDispensados(agora - 3600e3, agora, 'teste_dispensa');
const depois = JSON.parse(C.db.prepare('SELECT progresso FROM contas WHERE id = 5').get().progresso);
const b = depois.cla.m.find((o) => o.id === 'rcbento12345');
ok(n === 1 && b && b.ap.cabelo === 0x112233 && b.nv === 26 && b.tier === 'veterano', `Bento voltou com aparência e nível (${JSON.stringify(b)})`);
ok(C.lerMundo('npc:rcbento12345')?.prog?.ouro === 777, 'o save dele ficou intacto');
ok(C.devolverDispensados(agora - 3600e3, agora, 'teste_dispensa') === 0, 'roda uma vez só');
// sem cópia: monta pelo save órfão amigo da conta
const progSem = { nivel: 40, ouro: 100, cla: { n: 'Clã Dois', c: agora, cofre: 0, sem: agora + 9e7, nv: 2, m: [], log: [{ t: agora - 5e6, txt: 'Contratou Hugo Ferro (Recruta Nv 1)', v: -150 }, { t: agora - 30e3, txt: 'Dispensou Hugo Ferro', v: 0 }] } };
C.db.prepare('INSERT INTO contas (id, google, nome, criada, ultimo_acesso, progresso) VALUES (?, ?, ?, ?, ?, ?)').run(6, 'g6', 'Irmão', agora, agora, JSON.stringify(progSem));
C.gravarMundo('npc:rchugo123456', { t: agora - 29e3, amizades: { c6: 10 }, prog: { nivel: 12 } });
C.devolverDispensados(agora - 3600e3, agora, 'teste_dispensa2');
const h = JSON.parse(C.db.prepare('SELECT progresso FROM contas WHERE id = 6').get().progresso).cla.m[0];
ok(h?.id === 'rchugo123456' && h.g === 'm' && h.nv === 12 && h.tier === 'recruta' && h.ap.cabelo !== 8947848, `sem cópia: montado pelo save (${JSON.stringify(h)})`);
fs.rmSync(pasta, { recursive: true, force: true });
