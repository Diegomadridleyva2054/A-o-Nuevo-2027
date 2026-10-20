/* Service Worker v9 - Cuenta Regresiva Año Nuevo (offline completo + bandeja de notificaciones) */
const VERSION = 'v9';
const CACHE = `new-year-countdown-${VERSION}`;
const CACHE_PREFIX = 'new-year-countdown-';
const INBOX = 'ny-inbox', INBOX_URL = './__inbox.json';   // bandeja de la campanita (no se borra al actualizar)
const FB = { apiKey: "AIzaSyDNXX68-zlaijO3Me2GDUVguOB5PpNL3ts", projectId: "studio-3276495626-227e0" };
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
    const old = (await caches.keys()).filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE);
    for (const k of old) await caches.delete(k);          // la bandeja 'ny-inbox' se conserva
    try { if (self.registration.navigationPreload) await self.registration.navigationPreload.enable(); } catch {}
    await self.clients.claim();
    if (old.length) await broadcast({ type: 'SW_UPDATED', version: VERSION }); // la página avisa "nueva versión lista"
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || !/^https?:$/.test(u.protocol)) return;
  if (u.hostname === 'api.imgbb.com') return;

  if (r.mode === 'navigate') return e.respondWith(navigate(r, e.preloadResponse));
  if (r.destination === 'audio' || r.destination === 'video') return e.respondWith(media(r));
  if (u.origin === location.origin || CDN_HOSTS.includes(u.hostname)) return e.respondWith(staleWhileRevalidate(r, u));
});

// HTML: red primero (con Navigation Preload, más rápido) y, sin conexión, el index en caché.
// ignoreSearch permite que ?nombre=...&fecha=... funcionen offline.
async function navigate(r, preload) {
  try {
    const res = (await preload) || (await fetch(r));
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
  const t = e.data && e.data.type;
  if (t === 'SKIP_WAITING') self.skipWaiting();
  if (t === 'GET_VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage({ type: 'SW_READY', version: VERSION });
  if (e.ports && e.ports[0] && !t) e.ports[0].postMessage({ type: 'SW_READY', version: VERSION });
});

/* ============================================================
   BANDEJA DE NOTIFICACIONES (alimenta la campanita de la página)
   ============================================================ */
async function broadcast(msg) {
  for (const c of await clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage(msg);
}

async function inboxRead() {
  try { const r = await (await caches.open(INBOX)).match(INBOX_URL); const j = r ? await r.json() : {}; return { items: j.items || [], unread: j.unread || 0, lastCheck: j.lastCheck || 0 }; }
  catch { return { items: [], unread: 0, lastCheck: 0 }; }
}
async function inboxSave(j) {
  await (await caches.open(INBOX)).put(INBOX_URL, new Response(JSON.stringify(j), { headers: { 'Content-Type': 'application/json' } }));
}
// Devuelve false si ya existía (evita avisos duplicados cuando llega por push y por sincronización)
async function inboxAdd(it) {
  const j = await inboxRead();
  if (j.items.some(x => x.id === it.id)) return false;
  j.items.unshift(it); j.items = j.items.slice(0, 50); j.unread += 1;
  await inboxSave(j);
  try { await self.navigator.setAppBadge(j.unread); } catch {}   // globito numérico en el ícono de la app instalada
  await broadcast({ type: 'INBOX_UPDATED' });
  return true;
}

function toItem(p) {
  const n = p.notification || {}, d = p.data || {}, ts = +d.ts || Date.now();
  return { id: d.id || ('p' + ts + Math.random().toString(36).slice(2, 6)), title: n.title || d.title || 'Año Nuevo', body: n.body || d.body || '', url: d.url || '', icon: d.icon || '', ts };
}

function show(it, d = {}) {
  const o = {
    body: it.body, tag: d.tag || it.id,
    icon: './icon-192x192.png', badge: './icon-192x192.png', vibrate: [200, 100, 200],
    data: { id: it.id, url: it.url },
    actions: [{ action: 'open', title: 'Ver' }, { action: 'close', title: 'Cerrar' }]
  };
  if (/^https:\/\//.test(d.image || '')) o.image = d.image;      // imagen grande opcional
  if (d.important === '1') o.requireInteraction = true;          // no se oculta sola (ej. medianoche)
  return self.registration.showNotification(it.title, o);
}

// Avisos push (FCM): llegan con la app cerrada, se muestran y quedan guardados en la campanita
try { importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'); } catch (e) {}
if (self.firebase) {
  firebase.initializeApp({apiKey:"AIzaSyDNXX68-zlaijO3Me2GDUVguOB5PpNL3ts",authDomain:"studio-3276495626-227e0.firebaseapp.com",projectId:"studio-3276495626-227e0",storageBucket:"studio-3276495626-227e0.firebasestorage.app",messagingSenderId:"1012275718197",appId:"1:1012275718197:web:25ec226e771e5a4072a97c"});
  firebase.messaging().onBackgroundMessage(async p => {
    const it = toItem(p);
    const isNew = await inboxAdd(it);
    if (p.notification) return;           // los enviados desde la consola de Firebase ya los muestra el SDK
    if (isNew) return show(it, p.data || {});
  });
}

// Sincronización periódica (Chrome/Edge con la app instalada): revisa "announcements" aunque nadie haya enviado push.
// Requiere que las reglas de Firestore permitan leer "announcements".
self.addEventListener('periodicsync', e => { if (e.tag === 'check-announcements') e.waitUntil(checkAnnouncements()); });
async function checkAnnouncements() {
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents:runQuery?key=${FB.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'announcements' }], orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 10 } })
    });
    if (!res.ok) return;
    const rows = await res.json();
    const j = await inboxRead(), since = j.lastCheck || Date.now();
    const list = rows.filter(r => r.document).map(r => {
      const f = r.document.fields || {}, s = k => (f[k] && f[k].stringValue) || '';
      return { id: r.document.name.split('/').pop(), title: s('title'), body: s('body'), url: s('url'), icon: s('icon'),
        ts: f.createdAt && f.createdAt.timestampValue ? Date.parse(f.createdAt.timestampValue) : Date.now(), image: s('image'), important: s('important') };
    }).reverse();
    for (const it of list) if (it.title && it.ts > since && await inboxAdd(it)) await show(it, it);
    const j2 = await inboxRead(); j2.lastCheck = Date.now(); await inboxSave(j2);
  } catch {}
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  e.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    if (w) { await w.focus(); w.postMessage({ type: 'OPEN_BELL' }); return; }   // abre la campanita
    await clients.openWindow('./?bell=1');
  })());
});
