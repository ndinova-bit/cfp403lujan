/* ==========================================================================
   SERVICE WORKER · CFP 403
   Permite instalar la plataforma como app y abrirla sin señal.
   - Los datos (Supabase) NUNCA se guardan acá: siempre van a internet.
   - La página, los estilos, los scripts y las imágenes se guardan para abrir
     rápido y para que funcione sin conexión (con la última versión descargada).
   Al cambiar este archivo, subir VERSION para que todos reciban la nueva.
   ========================================================================== */
const VERSION = 'cfp403-app-v13';
const BASICOS = ['./', './index.html', './manifest.json', './img/app/icono-192.png', './img/app/icono-512.png', './logo.png'];
const EXTERNOS_OK = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)).catch(() => null));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La página avisa "actualizar ahora" cuando el usuario toca el botón
self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismoSitio = url.origin === self.location.origin;
  if (!mismoSitio && !EXTERNOS_OK.includes(url.hostname)) return;   // Supabase y otros: directo a internet

  // Páginas: primero internet (para tener siempre la última versión); sin señal, la guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copia)); return r; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Estilos, scripts, imágenes y librerías: lo guardado al instante y se actualiza por detrás
  e.respondWith(
    caches.open(VERSION).then((c) => c.match(req).then((guardado) => {
      const red = fetch(req).then((r) => {
        if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
        return r;
      }).catch(() => guardado);
      return guardado || red;
    }))
  );
});
