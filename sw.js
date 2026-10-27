// Service worker приложения «Дом»: оболочка открывается без связи с хабом,
// уведомления о тревогах приходят, даже когда приложение закрыто.

const CACHE = 'dom-shell-v3';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './demo.js',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Оболочка: сначала сеть (чтобы обновления доходили сразу), без сети — из кэша.
// cache: 'no-cache' — сверяемся с сервером всегда: GitHub Pages отдаёт max-age=600, и без этого
// телефон до 10 минут открывал бы старую версию даже после обновления.
// API и WebSocket не трогаем: устаревшее состояние дома хуже, чем честное «нет связи».
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/') || url.pathname.endsWith('/ws')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(e.request)) ?? (await caches.match('./index.html'))),
  );
});

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data?.json() ?? {};
  } catch {
    data = { title: 'Дом', body: e.data?.text() };
  }
  const critical = data.level === 'critical';
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'Дом', {
      body: data.body ?? '',
      tag: data.tag ?? 'dom',
      renotify: true,
      requireInteraction: critical, // тревога висит, пока её не увидят
      vibrate: critical ? [400, 150, 400, 150, 400] : [200],
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: self.registration.scope },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === location.origin);
      return open ? open.focus() : self.clients.openWindow(e.notification.data?.url ?? self.registration.scope);
    }),
  );
});
