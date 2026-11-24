// Avisos no celular do painel do clã (André 2026-11-24: "notificação... avisa quando um recruta morre, o clã... não
// precisaria ser um aplicativo"). Web Push do navegador (Chrome do Android abre o aviso mesmo com a página fechada),
// feito aqui com o crypto do Node, sem biblioteca nova:
// - VAPID (RFC 8292): o servidor assina um JWT ES256 com a chave dele; a chave nasce sozinha no primeiro uso e fica no
//   banco (tabela mundo, chave 'push'). Ninguém precisa cadastrar nada.
// - Conteúdo cifrado aes128gcm (RFC 8291 / 8188): só o navegador de quem assinou abre.
// Segurança: o servidor só manda para os serviços de push dos navegadores (lista PUSH.hosts), nunca para um endereço
// qualquer que a página mande; no máximo PUSH.porConta celulares por conta; aviso agrupado (um a cada PUSH.intervaloMs).
import crypto from 'node:crypto';

export const PUSH = {
  porConta: 3,
  intervaloMs: 60e3, // avisos que chegam juntos viram um só
  hosts: [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[\w-]+\.push\.apple\.com$/, /^[\w.-]+\.notify\.windows\.com$/],
  ttl: 24 * 3600,
  sub: 'https://rcandrerc.github.io/Rpg-realista/painel.html', // contato do VAPID (o site do painel)
};

const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// confere a assinatura que a página manda (PushSubscription.toJSON()); devolve a limpa ou null
export function assinaturaValida(s) {
  if (!s || typeof s !== 'object' || typeof s.endpoint !== 'string' || s.endpoint.length > 600) return null;
  let u; try { u = new URL(s.endpoint); } catch { return null; }
  if (u.protocol !== 'https:' || u.port || u.username || !PUSH.hosts.some((r) => r.test(u.hostname))) return null;
  const p256dh = s.keys?.p256dh, auth = s.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 120 || auth.length > 40) return null;
  const ua = deB64u(p256dh); if (ua.length !== 65 || ua[0] !== 4 || deB64u(auth).length !== 16) return null;
  try { const e = crypto.createECDH('prime256v1'); e.generateKeys(); e.computeSecret(ua); } catch { return null; } // ponto fora da curva: nunca abriria
  return { endpoint: u.href, keys: { p256dh, auth } };
}

// cifra o conteúdo para uma assinatura (RFC 8291): devolve o corpo do POST
export function cifrar(sub, texto) {
  const ua = deB64u(sub.keys.p256dh), segredo = deB64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const as = ecdh.getPublicKey(), comum = ecdh.computeSecret(ua), sal = crypto.randomBytes(16);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', comum, segredo, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const corpo = Buffer.concat([c.update(Buffer.concat([Buffer.from(texto), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([sal, rs, Buffer.from([as.length]), as, corpo]);
}

export class Push {
  // ler/gravar: a tabela mundo (contas.lerMundo/gravarMundo). enviar: o fetch (trocado nos testes)
  constructor({ ler, gravar, enviar = fetch } = {}) {
    this.gravar = gravar || (() => {}); this.enviar = enviar;
    const s = ler?.('push');
    if (s?.priv && s?.pub) { this.priv = crypto.createPrivateKey({ key: s.priv, format: 'jwk' }); this.pub = s.pub; }
    else { // primeira vez: a chave do servidor nasce aqui
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const j = publicKey.export({ format: 'jwk' });
      this.priv = privateKey; this.pub = b64u(Buffer.concat([Buffer.from([4]), deB64u(j.x), deB64u(j.y)]));
    }
    this.subs = s?.priv && s?.subs && typeof s.subs === 'object' ? s.subs : {}; // conta -> [assinatura] (chave nova: as antigas não valem)
    this.fila = new Map(); // conta -> { textos, timer }
    this.ultimo = new Map(); // conta -> quando mandou o último
    if (!s?.priv) this.salvar();
  }
  salvar() { this.gravar('push', { pub: this.pub, priv: this.priv.export({ format: 'jwk' }), subs: this.subs }); }
  temAviso(conta) { return !!this.subs[conta]?.length; }
  assinar(conta, bruta) {
    const s = assinaturaValida(bruta); if (!s) return false;
    const l = (this.subs[conta] || []).filter((o) => o.endpoint !== s.endpoint);
    l.push(s); this.subs[conta] = l.slice(-PUSH.porConta); this.salvar(); return true;
  }
  sair(conta, endpoint) {
    const l = this.subs[conta]; if (!l) return;
    try { endpoint = new URL(endpoint).href; } catch { return; }
    this.subs[conta] = l.filter((o) => o.endpoint !== endpoint); if (!this.subs[conta].length) delete this.subs[conta];
    this.salvar();
  }
  jwt(aud) {
    const cab = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const corpo = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH.sub }));
    const ass = crypto.sign('sha256', Buffer.from(`${cab}.${corpo}`), { key: this.priv, dsaEncoding: 'ieee-p1363' });
    return `${cab}.${corpo}.${b64u(ass)}`;
  }
  // um aviso para a conta: junta o que chegar em PUSH.intervaloMs e manda um só
  avisar(conta, texto) {
    if (!this.temAviso(conta) || typeof texto !== 'string') return;
    let f = this.fila.get(conta);
    if (!f) {
      f = { textos: [] }; this.fila.set(conta, f);
      const espera = Math.max(1500, (this.ultimo.get(conta) || 0) + PUSH.intervaloMs - Date.now()); // um aviso por minuto, no máximo
      f.timer = setTimeout(() => this.despachar(conta), espera); f.timer.unref?.();
    }
    if (f.textos.length < 6) f.textos.push(texto.slice(0, 120));
  }
  async despachar(conta) {
    const f = this.fila.get(conta); this.fila.delete(conta); if (!f?.textos.length) return;
    this.ultimo.set(conta, Date.now());
    const corpo = f.textos.length === 1 ? f.textos[0] : `${f.textos.slice(0, 3).join(' · ')}${f.textos.length > 3 ? ` (+${f.textos.length - 3})` : ''}`;
    const msg = JSON.stringify({ titulo: 'Seu clã', corpo, t: Date.now() });
    for (const s of [...(this.subs[conta] || [])]) {
      try {
        const r = await this.enviar(s.endpoint, { method: 'POST', body: cifrar(s, msg), signal: AbortSignal.timeout(10e3), redirect: 'error',
          headers: { TTL: String(PUSH.ttl), Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
            Authorization: `vapid t=${this.jwt(new URL(s.endpoint).origin)}, k=${this.pub}` } });
        r.body?.cancel?.().catch?.(() => {});
        if ([401, 403, 404, 410].includes(r.status)) this.sair(conta, s.endpoint); // cancelou ou a chave não vale mais: tira da lista
      } catch { /* sem rede agora: o próximo aviso tenta de novo */ }
    }
  }
}
