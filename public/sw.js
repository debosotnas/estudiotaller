// Service worker: guarda la app en el dispositivo para que cargue aunque se corte internet.
// Con conexión siempre se usa la red (así llegan las versiones nuevas); sin conexión, o si la red tarda, lo guardado.
const CACHE = "estudiotaller-v2";
const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const PRECARGA = [
  "/", "/participar", "/presentar", "/admin", "/pizarron", "/material", "/presentaciones",
  "/css/senal.css", "/css/app.css", "/favicon.svg",
  "/data/taller_ia_slides.json", "/data/actividades.json",
  "/js/firebase.js", "/js/slides.js", "/js/actividades.js", "/js/presentacion.js", "/js/participante.js", "/js/presentar.js",
  "/js/admin.js", "/js/material.js", "/js/pizarron.js", "/js/pizarron-comun.js", "/js/presentaciones.js", "/js/editor.js",
  "/js/libre.js", "/js/plantillas-base.js", "/js/pptx.js", "/js/version.js", "/js/inicio.js", "/vendor/qrcode.mjs",
  "/fonts/space-grotesk-latin-500-normal.woff2", "/fonts/space-grotesk-latin-700-normal.woff2",
  "/fonts/space-grotesk-latin-ext-500-normal.woff2", "/fonts/space-grotesk-latin-ext-700-normal.woff2",
  "/fonts/jetbrains-mono-latin-500-normal.woff2", "/fonts/jetbrains-mono-latin-700-normal.woff2",
  "/fonts/jetbrains-mono-latin-ext-500-normal.woff2", "/fonts/jetbrains-mono-latin-ext-700-normal.woff2",
  SDK + "firebase-app.js", SDK + "firebase-auth.js", SDK + "firebase-firestore.js",
];

self.addEventListener("install", (ev) => {
  self.skipWaiting();
  // de a uno: si alguno falla, los demás igual quedan guardados
  ev.waitUntil(caches.open(CACHE).then((c) => Promise.all(PRECARGA.map((u) => c.add(u).catch(() => {})))));
});
self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const conTiempo = (p, ms) => Promise.race([p, new Promise((_, mal) => setTimeout(() => mal(new Error("lenta")), ms))]);

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // El SDK de Firebase (con versión fija): primero lo guardado
  if (url.href.startsWith(SDK)) {
    ev.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)); return res; })));
    return;
  }
  if (url.origin !== location.origin) return;                         // Firestore, autenticación, imágenes externas: directo
  if (url.pathname === "/version.json" || url.pathname.startsWith("/__/auth")) return;
  if (url.pathname.startsWith("/vendor/pptxgen")) return;               // grande y solo para exportar

  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const red = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    red.catch(() => {});
    try {
      return await conTiempo(red, 4000);
    } catch {
      const guardada = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
      if (guardada) return guardada;
      try { return await red; } catch {}                               // lenta pero sin copia: esperar a la red
      // Sin red: páginas de participantes (/<código>) y otras navegaciones usan la página principal guardada
      if (req.mode === "navigate") return (await cache.match("/participar")) || Response.error();
      return Response.error();
    }
  })());
});
