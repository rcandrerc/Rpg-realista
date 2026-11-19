// Teleporte depois de cair (Segurança 2026-11-19, Presidente): a folga da queda vale só na velocidade que o herói tem e
// por no máximo 15 s (antes usava a do lobo por até 60 s: ~700 m). E na guerra o teleporte não vale ponto: quem voltou
// da queda longe de onde caiu não fere nem tem como alvo a outra raça por GUERRA.semPontoQueda s.
// Uso: node ferramentas/testes/teleporte-queda.mjs
import { Simulacao, MAPA_CLAREIRA, HEROI, ORCAMENTO, GUERRA, MONTARIAS } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const TICK = 1 / 20;
function novo() {
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
  j.criando = false; j.x = 0; j.z = 0; j.y = s.terreno.altura(0, 0, 10);
  s.passo(TICK); s.eventos = [];
  return { s, j };
}
const volta = (seg, z, montado = null) => {
  const { s, j } = novo();
  if (montado) j.montado = montado;
  s.folgaDaQueda('A', seg);
  s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, z, 10), z, ry: 0, e: 1, c: 0 });
  const n = s.passo(TICK).filter((e) => e.t === 'corrigir' && e.para === 'A').length;
  return { n, s, j };
};
ok(ORCAMENTO.queda <= 15, `teto da queda: ${ORCAMENTO.queda} s`);
ok(volta(8, HEROI.correr * 8).n === 0, '8 s correndo a pé sem internet: ao voltar fica onde está (o que já valia)');
const lobo = MONTARIAS.lobo.correr;
ok(volta(8, lobo * 8).n === 1, `a pé, 8 s na velocidade do lobo (${(lobo * 8).toFixed(0)} m): recusado (antes passava)`);
ok(volta(8, lobo * 8, 'lobo').n === 0, 'montado no lobo, os mesmos metros valem');
ok(volta(120, HEROI.correr * 1.3 * 40).n === 1, `queda de 2 min: não aparece ${(HEROI.correr * 1.3 * 40).toFixed(0)} m longe (teto de 15 s)`);
ok(volta(120, lobo * 1.3 * 60, 'lobo').n === 1, `nem de lobo: ${(lobo * 1.3 * 60).toFixed(0)} m é recusado`);
ok(volta(120, 700, 'lobo').n === 1, 'os ~700 m da revisão: recusado');

// guerra: voltou da queda longe de onde caiu = 15 s sem ferir a outra raça
{
  const { s, j } = volta(8, HEROI.correr * 8);
  ok(j.semGuerraAte > s.tempo + GUERRA.semPontoQueda - 1, 'voltou 30+ m longe: marcado sem ponto de guerra');
  const o = s.adicionarJogador('B', 'Bia', undefined, { conta: 2 }); o.criando = false;
  Object.assign(o, { x: j.x + 2, z: j.z, y: j.y }); o.prog.raca = 'geada';
  j.guerra = o.guerra = true; // os dois na zona de guerra (a regra da zona tem o teste dela em guerra.mjs)
  s.passoGuerra = () => {}; // segura o recheque da zona neste teste
  ok(s.emGuerra(j, o), 'os dois estão em guerra');
  ok(!s.inimigosDe(j).includes(o), 'quem voltou não tem a outra raça como alvo');
  const v = o.vida; s.ferir(o, 50, j); ok(o.vida === v, 'o golpe dele não pega');
  const v2 = j.vida; s.ferir(j, 50, o); ok(j.vida < v2, 'mas ele pode ser atacado (cair de propósito não vira escudo)');
  s.tempo = j.semGuerraAte + 0.1;
  ok(s.inimigosDe(j).includes(o), `depois de ${GUERRA.semPontoQueda} s volta a valer`);
  const v3 = o.vida; s.ferir(o, 50, j); ok(o.vida < v3, 'e o golpe pega');
}
// voltou perto de onde caiu (internet piscou parado): nada muda na guerra
{
  const { s, j } = volta(5, 2);
  ok(!(j.semGuerraAte > s.tempo), 'voltou a 2 m de onde caiu: guerra normal');
}
// sessão nova nasce a pé: a montaria de quando caiu vem do servidor (montSaida) e vale só ela
{
  const { s, j } = novo();
  s.folgaDaQueda('A', 8, 'lobo');
  s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, lobo * 8, 10), z: lobo * 8, ry: 0, e: 1, c: 0 });
  ok(!s.passo(TICK).some((e) => e.t === 'corrigir' && e.para === 'A'), 'caiu montado no lobo e voltou em sessão nova: os metros do lobo valem');
  const t = novo(); t.s.folgaDaQueda('A', 8, 'dragao_que_nao_existe');
  t.s.posicaoCliente('A', { x: 0, y: t.s.terreno.altura(0, lobo * 8, 10), z: lobo * 8, ry: 0, e: 1, c: 0 });
  ok(t.s.passo(TICK).some((e) => e.t === 'corrigir' && e.para === 'A'), 'montaria que não existe não vale');
}
