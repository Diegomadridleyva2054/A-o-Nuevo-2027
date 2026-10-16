/**
 * SERVICE WORKER MEJORADO
 * Estrategia de caché inteligente para PWA de Año Nuevo
 * Versión: 2.0
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `new-year-countdown-${CACHE_VERSION}`;

// Archivos críticos que SIEMPRE deben estar en caché
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Archivos multimedia (pueden faltar al principio)
const MULTIMEDIA_ASSETS = [
  './año-nuevo.mp3',
  './año-nuevo.mp4'
];

// Fuentes externas que queremos cachear
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Marcellus&family=Jost:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Todos los archivos a cachear
const URL_TO_CACHE = [...CRITICAL_ASSETS, ...MULTIMEDIA_ASSETS, ...EXTERNAL_ASSETS];

console.log('[SW] Service Worker inicializando...', { CACHE_NAME, URL_TO_CACHE });

/**
 * EVENT: INSTALL
 * Se ejecuta cuando el SW se instala por primera vez
 * Guardamos los archivos críticos en caché
 */
self.addEventListener('install', event => {
  console.log('[SW] Evento INSTALL');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Abriendo caché:', CACHE_NAME);

        // Primero, guardamos los archivos críticos
        return cache.addAll(CRITICAL_ASSETS)
          .then(() => {
            console.log('[SW] Archivos críticos cacheados exitosamente');

            // Luego intentamos cachear los archivos multimedia (sin fallar si no existen)
            return Promise.allSettled(
              MULTIMEDIA_ASSETS.map(url => cache.add(url))
            ).then(results => {
              results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                  console.log(`[SW] ✓ Cacheado: ${MULTIMEDIA_ASSETS[index]}`);
                } else {
                  console.warn(`[SW] ⚠ No se pudo cachear: ${MULTIMEDIA_ASSETS[index]}`);
                }
              });
            });
          })
          .then(() => {
            // Cachear recursos externos
            return Promise.allSettled(
              EXTERNAL_ASSETS.map(url => cache.add(url))
            ).then(results => {
              results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                  console.log(`[SW] ✓ Cacheado: ${EXTERNAL_ASSETS[index]}`);
                } else {
                  console.warn(`[SW] ⚠ No se pudo cachear: ${EXTERNAL_ASSETS[index]}`);
                }
              });
            });
          });
      })
      .catch(error => {
        console.error('[SW] Error durante install:', error);
      })
  );

  // Forzar activación inmediata
  self.skipWaiting();
});

/**
 * EVENT: ACTIVATE
 * Se ejecuta cuando el SW se activa
 * Limpiamos cachés viejas
 */
self.addEventListener('activate', event => {
  console.log('[SW] Evento ACTIVATE');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        console.log('[SW] Cachés existentes:', cacheNames);

        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('[SW] Eliminando caché antigua:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .catch(error => {
        console.error('[SW] Error durante activate:', error);
      })
  );

  // Tomar el control de todas las páginas inmediatamente
  self.clients.claim();
});

/**
 * EVENT: FETCH
 * Intercepta todas las peticiones de red
 * Usa diferentes estrategias según el tipo de archivo
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear peticiones a extensiones de navegador
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
    return;
  }

  // Estrategia diferente según el tipo de recurso
  if (request.method === 'GET') {
    // Para archivos HTML, CSS, JS: Cache-First con fallback a Network
    if (request.destination === 'document' || 
        request.destination === 'script' || 
        request.destination === 'style') {
      event.respondWith(cacheFirstStrategy(request));
    }
    // Para imágenes y fuentes: Cache-First
    else if (request.destination === 'image' || 
             request.destination === 'font' ||
             request.destination === 'audio' ||
             request.destination === 'video') {
      event.respondWith(cacheFirstStrategy(request));
    }
    // Para otras peticiones: Network-First
    else {
      event.respondWith(networkFirstStrategy(request));
    }
  }
});

/**
 * ESTRATEGIA: CACHE-FIRST
 * Primero intenta servir desde caché
 * Si no existe, hace petición de red y cachea el resultado
 */
function cacheFirstStrategy(request) {
  return caches.match(request)
    .then(response => {
      // Si está en caché, devolverlo
      if (response) {
        console.log('[SW] Cache Hit:', request.url);
        return response;
      }

      // Si no, hacer petición de red
      return fetch(request)
        .then(response => {
          // Validar que la respuesta sea válida
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clonar la respuesta para poder cachearla
          const responseToCache = response.clone();

          // Cachear en segundo plano
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
              console.log('[SW] Cacheado:', request.url);
            })
            .catch(error => {
              console.warn('[SW] Error cacheando:', request.url, error);
            });

          return response;
        })
        .catch(error => {
          console.error('[SW] Error de red:', request.url, error);

          // Si falla la red, intentar devolver algo de caché
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }

              // Si no hay caché, devolver página de error offline
              if (request.destination === 'document') {
                return caches.match('./index.html');
              }

              // Para otros recursos, devolver respuesta vacía
              return new Response('No disponible offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
        });
    });
}

/**
 * ESTRATEGIA: NETWORK-FIRST
 * Primero intenta de red
 * Si falla, sirve desde caché
 */
function networkFirstStrategy(request) {
  return fetch(request)
    .then(response => {
      // Validar respuesta
      if (!response || response.status !== 200 || response.type === 'error') {
        return response;
      }

      // Clonar para cachear
      const responseToCache = response.clone();

      // Cachear en segundo plano
      caches.open(CACHE_NAME)
        .then(cache => {
          cache.put(request, responseToCache);
        })
        .catch(error => {
          console.warn('[SW] Error cacheando:', request.url);
        });

      return response;
    })
    .catch(error => {
      console.warn('[SW] Error de red, intentando caché:', request.url);

      // Si falla la red, intentar caché
      return caches.match(request)
        .then(response => {
          return response || new Response('No disponible offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
    });
}

/**
 * EVENT: MESSAGE
 * Recibe mensajes desde el cliente
 */
self.addEventListener('message', event => {
  console.log('[SW] Mensaje recibido:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Responder al cliente
  event.ports[0].postMessage({
    type: 'SW_READY',
    version: CACHE_VERSION
  });
});

/**
 * EVENT: SYNC (Background Sync)
 * Sincronizar datos cuando hay conexión
 */
self.addEventListener('sync', event => {
  console.log('[SW] Evento SYNC:', event.tag);

  if (event.tag === 'sync-resolutions') {
    event.waitUntil(syncResolutions());
  }

  if (event.tag === 'sync-photos') {
    event.waitUntil(syncPhotos());
  }
});

/**
 * SYNC: Sincronizar resoluciones
 */
function syncResolutions() {
  return new Promise((resolve, reject) => {
    // Aquí podrías enviar las resoluciones a un servidor
    console.log('[SW] Sincronizando resoluciones...');
    resolve();
  });
}

/**
 * SYNC: Sincronizar fotos
 */
function syncPhotos() {
  return new Promise((resolve, reject) => {
    // Aquí podrías enviar las fotos a un servidor
    console.log('[SW] Sincronizando fotos...');
    resolve();
  });
}

/**
 * EVENT: PUSH
 * Notificaciones push
 */
self.addEventListener('push', event => {
  console.log('[SW] Push recibido');

  const title = 'Año Nuevo Countdown';
  const options = {
    body: event.data ? event.data.text() : 'Notificación de Año Nuevo',
    icon: './icon-192x192.png',
    badge: './badge-72x72.png',
    tag: 'new-year-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * EVENT: NOTIFICATION CLICK
 * Cuando el usuario hace clic en una notificación
 */
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notificación clickeada');

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Si la app ya está abierta, traerla al frente
        for (let client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }

        // Si no está abierta, abrirla
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
  );
});

/**
 * INFO: Registrar que el SW está activo
 */
console.log('[SW] Service Worker script cargado exitosamente');