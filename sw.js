/* Service Worker v3 - Cuenta Regresiva Año Nuevo (modo offline completo) */
const VERSION = 'v8';
const CACHE = `new-year-countdown-${VERSION}`;
const CORE = ['./', './index.html', './manifest.json'];
const MEDIA = ['./musicfondo.mp3', './Jazz-traditional.mp3', './Audio-Library.mp3', './Cruce-De-Sentimientos.mp3', './sinfonía-de-penas.mp3', './año-nuevo.mp4', './musica-año-nuevo.mp4', './icon-192x192.png', './icon-512x512.png', './icon-maskable-512.png'];
const EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Marcellus&family=Jost:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com', 'cdnjs.cloudflare.com', 'i.ibb.co'];
const MAX_RUNTIME_IMAGES = 80;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    // Lo demás es "mejor esfuerzo": si algo falta, no se rompe la instalación
    await Promise.allSettled([
      ...EXTERNAL.map(async u => c.put(u, await fetch(u, { mode: 'no-cors' }))),
      ...MEDIA.map(u => c.add(u))
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || !/^https?:$/.test(u.protocol)) return;
  if (u.hostname === 'api.imgbb.com') return;

  if (r.mode === 'navigate') return e.respondWith(navigate(r));
  if (r.destination === 'audio' || r.destination === 'video') return e.respondWith(media(r));
  if (u.origin === location.origin || CDN_HOSTS.includes(u.hostname)) return e.respondWith(staleWhileRevalidate(r, u));
});

// HTML: red primero (para recibir actualizaciones) y, sin conexión, el index en caché.
// ignoreSearch permite que ?nombre=...&fecha=... funcionen offline.
async function navigate(r) {
  try {
    const res = await fetch(r);
    if (res.ok && new URL(r.url).origin === location.origin) (await caches.open(CACHE)).put('./index.html', res.clone());
    return res;
  } catch {
    return (await caches.match(r, { ignoreSearch: true })) || (await caches.match('./index.html')) || Response.error();
  }
}

async function staleWhileRevalidate(r, u) {
  const c = await caches.open(CACHE);
  const hit = await c.match(r, { ignoreSearch: true });
  const net = fetch(r).then(async res => {
    if (res.ok || res.type === 'opaque') {
      await c.put(r, res.clone());
      if (u.hostname === 'i.ibb.co') trim(c);
    }
    return res;
  }).catch(() => null);
  return hit || (await net) || new Response('Sin conexión', { status: 503 });
}

async function trim(c) {
  const imgs = (await c.keys()).filter(k => new URL(k.url).hostname === 'i.ibb.co');
  for (const k of imgs.slice(0, Math.max(0, imgs.length - MAX_RUNTIME_IMAGES))) await c.delete(k);
}

// Audio/video: los navegadores piden rangos (206); se atienden desde caché cortando el archivo.
async function media(r) {
  const hit = await caches.match(r.url, { ignoreSearch: true });
  if (!hit) return fetch(r).catch(() => new Response('Sin conexión', { status: 503 }));
  const range = r.headers.get('range');
  if (!range) return hit;
  const buf = await hit.arrayBuffer(), m = /bytes=(\d+)-(\d*)/.exec(range);
  const start = +m[1], end = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.ports && e.ports[0]) e.ports[0].postMessage({ type: 'SW_READY', version: VERSION });
});

// Avisos push (FCM): el servidor envía mensajes "data" y aquí se muestran aunque la app esté cerrada
try { importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'); } catch (e) {}
if (self.firebase) {
  firebase.initializeApp({apiKey:"AIzaSyDNXX68-zlaijO3Me2GDUVguOB5PpNL3ts",authDomain:"studio-3276495626-227e0.firebaseapp.com",projectId:"studio-3276495626-227e0",storageBucket:"studio-3276495626-227e0.firebasestorage.app",messagingSenderId:"1012275718197",appId:"1:1012275718197:web:25ec226e771e5a4072a97c"});
  firebase.messaging().onBackgroundMessage(p => {
    if (p.notification) return; // los mensajes enviados desde la consola de Firebase ya los muestra el SDK
    const d = p.data || {};
    return self.registration.showNotification(d.title || 'Año Nuevo', { body: d.body || '', tag: d.tag || 'ny', icon: './icon-192x192.png', badge: './icon-192x192.png', vibrate: [200, 100, 200] });
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    return w ? w.focus() : clients.openWindow('./');
  }));
});
