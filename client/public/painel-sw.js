// Avisos do painel do clã (André 2026-11-24): o servidor manda pelo Web Push (server/push.js) e este service worker mostra
// o aviso no celular, mesmo com a página fechada. Tocar no aviso abre o painel.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Seu clã', { body: d.corpo || 'Novidade no clã', icon: 'painel-icones/ouro.png', badge: 'painel-icones/ouro.png', tag: 'cla', renotify: true, data: { t: d.t } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const a of abas) if (a.url.includes('painel.html')) return a.focus();
    return self.clients.openWindow('painel.html');
  })());
});
