// Conta do jogador: login só com Google.
// O Google entrega um crachá (ID token) ao navegador; o nosso servidor confere e devolve uma sessão,
// que fica guardada no aparelho. Nas próximas visitas o jogo entra direto, sem pedir login de novo.
import { GOOGLE_CLIENT_ID } from '@rpg/shared';

const $ = (id) => document.getElementById(id);
const guardar = (v) => { try { v ? localStorage.setItem('sessao', v) : localStorage.removeItem('sessao'); } catch { /* sem armazenamento: pede login a cada visita */ } };
const lerSessao = () => { try { return localStorage.getItem('sessao'); } catch { return null; } };

// ws://host → http://host (o login é por HTTP no mesmo servidor do jogo)
const http = (servidor) => servidor.replace(/^ws/, 'http').replace(/\/$/, '');

async function pedir(servidor, caminho, { sessao, corpo } = {}) {
  const r = await fetch(http(servidor) + caminho, {
    method: corpo ? 'POST' : 'GET',
    headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(sessao ? { Authorization: 'Bearer ' + sessao } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  const dados = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, dados };
}

let gsi;
function carregarGoogle() {
  gsi ??= new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client?hl=pt-BR'; s.async = true;
    s.onload = () => ok(window.google.accounts.id); s.onerror = () => { gsi = null; falha(new Error('não abriu o Google')); };
    document.head.appendChild(s);
  });
  return gsi;
}

// Mostra a tela com dois caminhos, "Criar conta" e "Entrar" (os dois pelo Google), e espera o jogador entrar.
// Os dois botões são do próprio Google (só ele entrega o crachá); o click_listener diz qual foi tocado.
async function telaDeLogin(servidor) {
  const tela = $('entrar'), erro = $('entrarErro'), criarMesmo = $('entrarCriar');
  tela.hidden = false; erro.textContent = ''; criarMesmo.hidden = true;
  let google;
  try { google = await carregarGoogle(); }
  catch { erro.textContent = 'Não foi possível abrir o login do Google. Confira a internet e recarregue a página.'; return new Promise(() => {}); }
  return new Promise((pronto) => {
    let modo = 'entrar'; // o "Continuar como …" do Google (sem tocar em botão) conta como Entrar
    const enviar = async (credencial, m) => {
      criarMesmo.hidden = true;
      erro.textContent = m === 'criar' ? 'Criando a conta…' : 'Entrando…';
      try {
        const r = await pedir(servidor, '/conta/entrar', { corpo: { credencial, modo: m } });
        if (r.dados.semConta) {
          erro.textContent = 'Essa conta Google ainda não tem personagem. Quer criar agora?';
          criarMesmo.onclick = () => enviar(credencial, 'criar');
          criarMesmo.hidden = false;
          return;
        }
        if (!r.ok) throw new Error(r.dados.erro || 'O servidor recusou o login.');
        guardar(r.dados.sessao);
        tela.hidden = true;
        pronto({ ...r.dados, jaTinha: m === 'criar' && r.dados.nova === false });
      } catch (e) { erro.textContent = e.message === 'Failed to fetch' ? 'Servidor fora do ar. Tente de novo daqui a pouco.' : e.message; }
    };
    google.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: 'popup',
      cancel_on_tap_outside: false,
      callback: ({ credential }) => enviar(credential, modo),
    });
    const estilo = { theme: 'filled_black', size: 'large', shape: 'pill', locale: 'pt-BR', width: 230 };
    google.renderButton($('botaoCriar'), { ...estilo, text: 'signup_with', click_listener: () => { modo = 'criar'; } });
    google.renderButton($('botaoEntrar'), { ...estilo, text: 'signin_with', click_listener: () => { modo = 'entrar'; } });
    google.prompt(); // aparece o "Continuar como …" quando o Google já conhece a pessoa
  });
}

// Devolve { sessao, conta } quando o servidor usa contas, ou null (sem servidor, ou servidor sem contas: joga como antes)
export async function entrarNaConta(servidor) {
  if (!GOOGLE_CLIENT_ID || !servidor) return null;
  try {
    const saude = await pedir(servidor, '/saude');
    if (!saude.dados.contas) return null;
  } catch { return null; } // servidor fora do ar: segue para o modo solo
  const sessao = lerSessao();
  if (sessao) {
    try {
      const r = await pedir(servidor, '/conta/eu', { sessao });
      if (r.ok) return { sessao, conta: r.dados.conta };
      if (r.status === 401) guardar(null);
    } catch { /* tenta pelo login */ }
  }
  return telaDeLogin(servidor);
}

export async function sairDaConta(servidor) {
  const sessao = lerSessao();
  guardar(null);
  try { window.google?.accounts.id.disableAutoSelect(); } catch { /* Google não carregou */ }
  if (sessao) await pedir(servidor, '/conta/sair', { sessao, corpo: {} }).catch(() => {});
}

// Apaga a conta no servidor (personagem, build e sessões) e esquece a sessão deste aparelho
export async function apagarConta(servidor) {
  const sessao = lerSessao();
  if (!sessao || !servidor) throw new Error('Sem conta para apagar.');
  let r;
  try { r = await pedir(servidor, '/conta/apagar', { sessao, corpo: {} }); }
  catch { throw new Error('Servidor fora do ar. Tente de novo daqui a pouco.'); }
  if (!r.ok) throw new Error(r.dados.erro === 'login' ? 'Sessão vencida: entre de novo para apagar.' : 'Não foi possível apagar a conta.');
  guardar(null);
  try { window.google?.accounts.id.disableAutoSelect(); } catch { /* Google não carregou */ }
}

// Ligar o app do celular (APK) a esta conta: o app abre o site com ?vincular=CODIGO, a pessoa entra com o Google aqui
// e o servidor guarda uma sessão nova para o app buscar pelo código. Depois a página abre o app de novo sozinha.
export const VOLTAR_APP = 'intent://voltar#Intent;scheme=rpgaethra;package=com.rcandrerc.rpgprototipo;end';
export async function ligarApp(servidor, codigo) {
  const entrada = await entrarNaConta(servidor);
  if (!entrada) return { ok: false, texto: 'Servidor fora do ar. Tente de novo daqui a pouco.' };
  try {
    const r = await pedir(servidor, '/conta/vincular', { sessao: entrada.sessao, corpo: { codigo } });
    return r.ok ? { ok: true, texto: `Pronto, ${entrada.conta.nome}! Voltando para o jogo…` } : { ok: false, texto: 'Esse pedido venceu. Toque em Entrar no app de novo.' };
  } catch { return { ok: false, texto: 'Servidor fora do ar. Tente de novo daqui a pouco.' }; }
}
