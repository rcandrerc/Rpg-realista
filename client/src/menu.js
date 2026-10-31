// Barra de cima (no jeito do Quimera): ícones de Habilidades, Status, Esboço e Menu.
// A seta recolhe os ícones (fica guardado no aparelho) e traz de volta. O Menu abre a janela do jogo.
const $ = (id) => document.getElementById(id);
const CHAVE = 'menuRecolhido';

export function montarMenu({ status, editarBotoes }) {
  const barra = $('barra'), seta = $('recolherBtn'), janela = $('menuJogo');
  const recolher = (sim) => {
    barra.classList.toggle('recolhida', sim);
    seta.setAttribute('aria-expanded', String(!sim));
    seta.setAttribute('aria-label', sim ? 'Abrir menu' : 'Recolher menu'); seta.title = seta.getAttribute('aria-label');
    try { localStorage.setItem(CHAVE, sim ? '1' : ''); } catch { /* sem armazenamento: vale só agora */ }
  };
  let guardado = false; try { guardado = localStorage.getItem(CHAVE) === '1'; } catch { /* nada guardado */ }
  recolher(guardado);
  seta.addEventListener('click', () => recolher(!barra.classList.contains('recolhida')));

  $('bolsaBtn').addEventListener('click', status);
  const fechar = () => { janela.hidden = true; };
  $('menuBtn').addEventListener('click', () => { janela.hidden = false; $('mVoltar').focus(); });
  janela.addEventListener('click', (e) => { if (e.target === janela) fechar(); }); // toque fora da caixa fecha
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !janela.hidden) fechar(); });
  // cada item fecha o menu e faz o mesmo que o ícone da barra
  const item = (id, fazer) => $(id).addEventListener('click', () => { fechar(); fazer(); });
  item('mVoltar', () => {});
  item('mStatus', status);
  item('mHab', () => $('habBtn').click());
  item('mBotoes', editarBotoes);
  item('mEsboco', () => $('infoBtn').click());
}
