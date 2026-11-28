// Compara o Gêmeo Leve (A) com o Gêmeo Jogo (B) e escreve o relatório do teste dos gêmeos (gemeos.mjs).
// Cada teste traz { nome, A: {...}, B: {...}, tol?: { campo: tolerância }, ignora?: [campos], nota?, erro? }.
// tol < 1 = fração da diferença (0,2 = 20%); tol >= 1 = diferença absoluta. Sem tol: tem que ser igual.
export function comparar(resultados) {
  const achados = [];
  for (const r of resultados) {
    if (r.erro) { achados.push({ teste: r.nome, campo: '-', A: '-', B: '-', texto: `Não deu para testar: ${r.erro}` }); continue; }
    const campos = new Set([...Object.keys(r.A || {}), ...Object.keys(r.B || {})]);
    for (const k of campos) {
      if (r.ignora?.includes(k)) continue;
      const a = r.A?.[k], b = r.B?.[k], t = r.tol?.[k];
      if (igual(a, b, t)) continue;
      achados.push({ teste: r.nome, campo: k, A: a, B: b, texto: `${r.nome}: ${NOMES[k] || k} no leve = ${fmt(a)}, no jogo = ${fmt(b)}` });
    }
  }
  return achados;
}
function igual(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (t == null) return a === b;
    const d = Math.abs(a - b);
    return t >= 1 ? d <= t : d <= t * Math.max(Math.abs(a), Math.abs(b), 1e-9);
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
const fmt = (v) => (v == null ? 'nada' : v === true ? 'sim' : v === false ? 'não' : v === '' ? 'nada' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const NOMES = {
  segundos: 'tempo (s)', subiuNoLobo: 'subiu no lobo', chegou: 'chegou', distFim: 'distância do destino no fim (m)', achouNaLista: 'lugar na lista',
  golpes: 'golpes que acertaram', porSeg: 'golpes por segundo', danoMedio: 'dano médio', botaoNaTela: 'botão na tela', mirouNoMapa: 'mirou no monstro',
  saiu: 'a skill saiu', gastouMana: 'gastou mana', acertos: 'acertos', danoTotal: 'dano total', botaoApagado: 'botão apagado (espera)',
  gastou: 'poções gastas', andou: 'andou (m)', montado: 'montado', distNascimento: 'distância do nascimento (m)',
  botaoUsarBarquinho: 'botão Usar barquinho', entrouNoBarco: 'entrou no barco', tocarNoMapaNoBarco: 'tocar no mapa dentro do barco', chegouNaBeira: 'chegou na beira', remouComJoystick: 'remou com o joystick', quadroDoAlvo: 'quadrinho do alvo abriu', botaoAtacar: 'botão Atacar', chegouNoMonstro: 'chegou no monstro', recarga: 'entrou na recarga', curou: 'vida que subiu', quadro: 'quadro',
};
export function relatorioMd(rel) {
  const L = [];
  L.push(`# Teste dos gêmeos: modo leve x jogo completo`, '');
  L.push(`${new Date(rel.quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília) · ${rel.minutos} min · heróis Nv ${rel.nivel}`, '');
  L.push(rel.achados.length ? `**${rel.achados.length} diferença(s) achada(s):**` : '**Nenhuma diferença achada nos testes de hoje.**', '');
  for (const a of rel.achados) L.push(`- ${a.texto}`);
  if (rel.errosPagina.length) { L.push('', '**Erros na página do modo leve:**'); for (const e of rel.errosPagina) L.push(`- ${e}`); }
  if (rel.errosServidor.length) { L.push('', '**Erros no servidor de teste:**'); for (const e of rel.errosServidor) L.push(`- ${e.slice(0, 200)}`); }
  L.push('', '## Todos os testes', '', '| Teste | Leve | Jogo | Nota |', '|---|---|---|---|');
  const cel = (o) => Object.entries(o || {}).map(([k, v]) => `${NOMES[k] || k}: ${fmt(v)}`).join('<br>');
  for (const r of rel.resultados) L.push(`| ${r.nome} | ${r.erro ? 'erro: ' + r.erro : cel(r.A)} | ${cel(r.B)} | ${r.nota || ''} |`);
  return L.join('\n') + '\n';
}
