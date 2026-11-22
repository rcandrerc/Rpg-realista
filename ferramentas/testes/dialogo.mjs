// Conversa por opções e fala sozinho (André 2026-11-19: sem IA, botões; "um lance quase que de NPC natural"). Sem rede.
// Uso: node ferramentas/testes/dialogo.mjs
import fs from 'fs';
import { Simulacao, MAPA_CLAREIRA, DIALOGO, REACOES } from '../../shared/index.js';
import './_amizade-antiga.mjs'; // o jeito antigo (amizade e papo), sem o soldado de 2026-11-22
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar?.('andre', true); s.passo(0.05);
const ev = [], orig = s.evento.bind(s); s.evento = (e) => { ev.push(e); orig(e); };
const fala = () => ev.filter((e) => e.t === 'fala').at(-1);
const ids = (f) => f.opcoes.map((o) => o.id);
for (const [id, g] of [['cecilia', 'f'], ['dario', 'm']]) {
  const c = s.amigosIa.find((x) => x.AMIGA.id === id); c.amiga.amigosDe = { [j.conta]: 1 };
  c.amiga.x = j.x + 1; c.amiga.z = j.z;
  c.conversaAmiga('andre', { acao: 'menu' });
  let f = fala();
  ok(f.texto && f.quem === c.amiga.id && ids(f).includes('comoVai') && ids(f).includes('comandos') && !ids(f).includes('timeMenu'), `${id}: abre com fala e o menu inicial (fora do time: sem ordens)`);
  c.conversaAmiga('andre', { acao: 'op', op: 'comandos', menu: 'inicio' }); f = fala();
  ok(ids(f).includes('time') && ids(f).includes('inicio') && !ids(f).includes('sairTime'), `${id}: "Bora fazer algo?" abre os comandos`);
  ok(f.opcoes.find((o) => o.id === 'cacar').t === (g === 'f' ? 'Vai caçar sozinha' : 'Vai caçar sozinho'), `${id}: opção no gênero dele(a)`);
  c.conversaAmiga('andre', { acao: 'op', op: 'inicio', menu: 'comandos' }); f = fala();
  ok(f.texto === '' && ids(f).includes('piada'), `${id}: Voltar só troca o menu, sem fala`);
  c.conversaAmiga('andre', { acao: 'op', op: 'foco', menu: 'inicio' }); f = fala();
  ok(f.texto === '' && !c.amiga.ia.ordem, `${id}: opção que não está no menu não vale`);
  const reg = () => (Object.values(c.amiga.registro || {})[0] || {})[j.conta] || [];
  const n0 = reg().length; c.conversaAmiga('andre', { acao: 'op', op: 'piada', menu: 'inicio' }); f = fala();
  ok(f.texto && reg().length === n0 + 2 && reg().at(-2).texto === 'Conta uma piada' && reg().at(-1).texto === f.texto, `${id}: a opção e a resposta ficam no registro do dia (revisão das 9h)`);
  c.amiga.x = j.x + 200; c.conversaAmiga('andre', { acao: 'menu' });
  ok(ev.at(-1).t === 'aviso', `${id}: longe e fora do time não abre`);
  c.amiga.x = j.x + 1; ok(c.entrarTimeAmiga(c.amiga, j), `${id}: entra no time`);
  c.amiga.x = j.x + 200; c.conversaAmiga('andre', { acao: 'menu' }); f = fala();
  ok(f && f.texto && ids(f).includes('timeMenu') && ev.at(-1).t === 'fala', `${id}: no time abre de longe (painel do time)`);
  c.conversaAmiga('andre', { acao: 'op', op: 'timeMenu', menu: 'inicio' }); f = fala();
  ok(['foco', 'atras', 'recua', 'livre', 'sairTime'].every((k) => ids(f).includes(k)), `${id}: ordens do time`);
  c.conversaAmiga('andre', { acao: 'op', op: 'recua', menu: 'timeMenu' });
  ok(c.amiga.ia.ordem?.tipo === 'recua' && DIALOGO.falas.recua.includes(fala().texto), `${id}: "Recua!" vale e ele(a) responde`);
  ok(c.alvoAmiga(c.amiga, j) === null, `${id}: recuando não pega alvo`);
  c.conversaAmiga('andre', { acao: 'op', op: 'livre', menu: 'timeMenu' }); ok(!c.amiga.ia.ordem, `${id}: "Luta do seu jeito" desfaz a ordem`);
  c.conversaAmiga('andre', { acao: 'op', op: 'sairTime', menu: 'timeMenu' }); ok(!c.amiga.time, `${id}: sai do time pela opção, de longe`);
  c.amiga.x = j.x + 1; c.conversaAmiga('andre', { acao: 'op', op: 'tchau', menu: 'inicio' }); ok(fala().fecha === true, `${id}: Tchau fecha a janela`);
}
// fala sozinho: no time reage ao nível dele e à vida baixa, um NPC por vez
{
  const [c, d] = ['cecilia', 'dario'].map((k) => s.amigosIa.find((x) => x.AMIGA.id === k));
  for (const x of [c, d]) { x.amiga.x = j.x + 1; x.amiga.z = j.z; x.entrarTimeAmiga(x.amiga, j); }
  const msgs = []; for (const x of [c, d]) x.aoChatAmiga = (m) => msgs.push(m);
  for (let i = 0; i < 100; i++) s.passo(0.05);
  j.prog.nivel += 1; for (let i = 0; i < 300; i++) s.passo(0.05);
  const subiu = msgs.filter((m) => /\d/.test(m.texto) && m.canal === 'time');
  ok(subiu.length === 1, `subiu de nível: um NPC comenta no chat do time (${subiu.map((m) => m.nome + ': ' + m.texto).join(' | ')})`);
  j.vida = Math.round(j.vidaMax * 0.2); for (let i = 0; i < 1300; i++) s.passo(0.05);
  ok(msgs.some((m) => REACOES.falas.vidaBaixa.map((t) => t.replace('{nome}', j.nome)).includes(m.texto)), 'vida baixa: alguém avisa');
}
// inglês de tudo que é novo (os dois gêneros; {nome}/{nv} viram %s/%d)
{
  const en = JSON.parse(fs.readFileSync(new URL('../../godot-prototipo/dados/idioma_en.json', import.meta.url), 'utf8'));
  const exp = (t) => [0, 1].map((m) => t.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (x, a, b) => (m ? b : a)));
  const todas = new Set();
  for (const o of Object.values(DIALOGO.opcoes)) exp(o.t).forEach((x) => todas.add(x));
  for (const l of [...Object.values(DIALOGO.falas), ...Object.values(REACOES.falas)]) for (const t of l) exp(t).forEach((x) => todas.add(x.replace(/\{nome\}/g, '%s').replace(/\{nv\}/g, '%d')));
  const falta = [...todas].filter((x) => !(x in en));
  ok(!falta.length, `conversa por opções e fala sozinho com inglês (${falta.slice(0, 3).join(' | ')})`);
}
