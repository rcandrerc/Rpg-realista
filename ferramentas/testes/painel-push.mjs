// Avisos no celular do painel do clã (server/push.js): cifra que o navegador abre (RFC 8291), JWT do VAPID válido,
// só serviços de push dos navegadores, aviso agrupado e assinatura cancelada sai da lista.
import crypto from 'node:crypto';
import { Push, assinaturaValida, cifrar, PUSH } from '../../server/push.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// o "navegador": chave dele e o segredo
const nav = crypto.createECDH('prime256v1'); nav.generateKeys();
const auth = crypto.randomBytes(16);
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: b64u(nav.getPublicKey()), auth: b64u(auth) } };
// o navegador abre (RFC 8291 do lado de quem recebe)
function abrir(corpo) {
  const sal = corpo.subarray(0, 16), idl = corpo[20], as = corpo.subarray(21, 21 + idl), cif = corpo.subarray(21 + idl);
  const comum = nav.computeSecret(as), ua = nav.getPublicKey();
  const ikm = Buffer.from(crypto.hkdfSync('sha256', comum, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(cif.subarray(cif.length - 16));
  const p = Buffer.concat([d.update(cif.subarray(0, cif.length - 16)), d.final()]);
  return p.subarray(0, p.lastIndexOf(2)).toString();
}
ok(abrir(cifrar(sub, 'Íris caiu')) === 'Íris caiu', 'o navegador abre o aviso cifrado');

ok(assinaturaValida(sub), 'assinatura do Chrome aceita');
for (const e of ['http://fcm.googleapis.com/x', 'https://exemplo.com/x', 'https://fcm.googleapis.com:8443/x', 'https://169.254.169.254/x', 'https://fcm.googleapis.com.mal.com/x'])
  ok(!assinaturaValida({ ...sub, endpoint: e }), `endereço recusado: ${e}`);
ok(!assinaturaValida({ ...sub, keys: { p256dh: 'abc', auth: b64u(auth) } }), 'chave quebrada recusada');

// banco de mentira e envio de mentira
let banco = null; const enviados = [];
const P = new Push({ ler: () => banco, gravar: (k, v) => { banco = JSON.parse(JSON.stringify(v)); }, enviar: async (url, o) => { enviados.push({ url, o }); return { status: url.includes('morto') ? 410 : 201 }; } });
ok(banco?.pub && banco.priv?.d, 'a chave do servidor nasce sozinha e fica no banco');
const P2 = new Push({ ler: () => banco, gravar: () => {} });
ok(P2.pub === P.pub, 'depois do reinício a chave é a mesma');
ok(P.assinar('c1', sub) && P.temAviso('c1'), 'liga o aviso da conta');
for (let i = 0; i < 5; i++) P.assinar('c1', { ...sub, endpoint: sub.endpoint + i });
ok(P.subs.c1.length === PUSH.porConta, `no máximo ${PUSH.porConta} celulares por conta`);
P.subs.c1 = [sub, { ...sub, endpoint: 'https://fcm.googleapis.com/fcm/send/morto' }];
P.avisar('c1', 'Íris caiu'); P.avisar('c1', 'Bia caiu'); P.avisar('c2', 'sem celular');
await P.despachar('c1');
ok(enviados.length === 2 && abrir(enviados[0].o.body).includes('Íris caiu · Bia caiu'), 'dois avisos juntos viram um só');
const h = enviados[0].o.headers, [t, k] = h.Authorization.replace('vapid ', '').split(', ');
const [cab, corpo, ass] = t.slice(2).split('.');
const chave = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(deB64u(P.pub).subarray(1, 33)), y: b64u(deB64u(P.pub).subarray(33)) }, format: 'jwk' });
ok(crypto.verify('sha256', Buffer.from(`${cab}.${corpo}`), { key: chave, dsaEncoding: 'ieee-p1363' }, deB64u(ass)) && k === 'k=' + P.pub, 'JWT do VAPID assinado com a chave do servidor');
ok(JSON.parse(deB64u(corpo)).aud === 'https://fcm.googleapis.com' && h['Content-Encoding'] === 'aes128gcm', 'aud é o serviço de push e o corpo vai cifrado');
ok(P.subs.c1.length === 1 && !P.subs.c1.some((o) => o.endpoint.includes('morto')), 'celular que cancelou (410) sai da lista');
ok(!P.fila.has('c2') && enviados.every((e) => !abrir(e.o.body).includes('sem celular')), 'conta sem celular não junta aviso');
P.sair('c1', sub.endpoint); ok(!P.temAviso('c1'), 'desligar tira o celular');
for (const f of P.fila.values()) clearTimeout(f.timer);
