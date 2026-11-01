// Pizarrón para la tablet (admin): dibujar con lápiz y mover palabras del texto con un recuadro de selección.
// Los trazos terminados van a pizarrones/{n}/trazos; el trazo en curso a pizarron_vivo/{n} (lo ve el proyector en vivo).
import { cargarTaller, esc } from "./slides.js";
import { codigoSesion } from "./actividades.js";
import { cargarPresentacion } from "./presentacion.js";
import { COLORES, GROSORES, textoDePizarron, maquetarTexto, cajaPalabra, simplificar, svgPizarron } from "./pizarron-comun.js";
import * as fb from "./firebase.js";
import { avisoVersion } from "./version.js";

const $app = document.getElementById("app");
const datos = await cargarTaller();
const sid = codigoSesion(datos.actividades);

const pres = await cargarPresentacion(sid, datos);
let user = await fb.usuarioActual();
if (!fb.puedeEditar(user, pres.meta)) {
  $app.innerHTML = `<div class="centro"><div class="caja">
    <div class="mono lima">// estudio taller · pizarrón</div>
    <h1>Entrá con tu cuenta de Google</h1>
    ${user && !user.isAnonymous ? `<p class="sec">Entraste como <b>${esc(user.email)}</b>, que no puede editar esta presentación.</p>` : ""}
    <div class="acciones"><button class="btn" id="g">entrar con google</button></div><p id="err" class="sec"></p></div></div>`;
  document.getElementById("g").onclick = async () => {
    try { user = await fb.entrarGoogle(); if (fb.puedeEditar(user, pres.meta)) location.reload(); else document.getElementById("err").textContent = `${user.email} no puede editar esta presentación.`; }
    catch (e) { document.getElementById("err").textContent = e.message; }
  };
  throw new Error("sin acceso");
}

const diapos = pres.diapositivas;

// ---------- estado ----------
let n = 1;                 // pizarrón que se edita acá
let enPantalla = null;     // pizarrón que está proyectado
let compartida = null;     // lo que está compartido con los celulares (sesión)
let herramienta = "lapiz"; // 'lapiz' | 'sel'
let color = "lima";
let grosor = GROSORES[1];
let trazos = [];
let palabras = [];
let seleccion = new Set();
let marco = null;
let penVisto = false;      // si hay lápiz, el dedo no dibuja (rechazo de la palma)
let penHasta = 0;          // hasta cuándo el lápiz cuenta como «cerca» (apoyado o flotando): ahí se ignora todo toque
const historial = { 1: [], 2: [], 3: [], 4: [] }; // deshacer, por pizarrón: trazos, movimientos de palabras, borrados
let arrastrando = false;
let desuscribir = [];

$app.innerHTML = `<div class="pz">
  <div class="pz-barra">
    <div class="pz-grupo">${[1, 2, 3, 4].map((k) => `<button class="pz-btn" data-pz="${k}" title="Pizarrón ${k}">${k}</button>`).join("")}</div>
    <button class="pz-btn ancho" id="proy" title="Mostrar u ocultar este pizarrón en el proyector">pantalla</button>
    <button class="pz-btn ancho" id="cel" title="Los celulares ven este pizarrón (gasta lecturas: usar solo cuando haga falta)">celulares</button>
    <i class="pz-sep"></i>
    <div class="pz-grupo">
      <button class="pz-btn" data-h="lapiz" title="Lápiz">✎</button>
      <button class="pz-btn" data-h="sel" title="Seleccionar y mover palabras">⬚</button>
    </div>
    <div class="pz-grupo">${Object.entries(COLORES).map(([k, v]) => `<button class="pz-color" data-c="${k}" style="--c:${v}" title="${k}"></button>`).join("")}</div>
    <div class="pz-grupo">${GROSORES.map((g) => `<button class="pz-btn" data-g="${g}" title="grosor ${g}"><i style="width:${g + 4}px;height:${g + 4}px"></i></button>`).join("")}</div>
    <i class="pz-sep"></i>
    <div class="pz-grupo">
      <button class="pz-btn" id="deshacer" title="Deshacer (trazos, mover palabras, borrar, reordenar)">↶</button>
      <button class="pz-btn peligro" id="borrar" title="Borrar todo el dibujo (el texto queda)">✕</button>
      <button class="pz-btn" id="reordenar" title="Volver a ordenar el texto en el medio" hidden>↺</button>
      <button class="pz-btn ancho" id="zoom" title="Volver al 100 %">100%</button>
    </div>
    <span class="rotulo" id="estado"></span>
  </div>
  <div class="pz-area" id="area"><div class="pz-hoja" id="hoja"><div class="pz-vista" id="vista"><div id="svg" class="pz-svg"></div><canvas id="cv"></canvas></div></div></div>
</div>`;

const $hoja = document.getElementById("hoja"), $vista = document.getElementById("vista"), $svg = document.getElementById("svg"), cv = document.getElementById("cv"), ctx = cv.getContext("2d");

// ---------- tamaño ----------
function ajustar() {
  const a = document.getElementById("area");
  const w = Math.min(a.clientWidth, (a.clientHeight * 16) / 9);
  Object.assign($hoja.style, { width: `${w}px`, height: `${(w * 9) / 16}px` });
  const dpr = devicePixelRatio || 1;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(((w * 9) / 16) * dpr);
  zoom.k = 1; zoom.tx = zoom.ty = 0;
  aplicarZoom();
}

// ---------- zoom (solo en la tablet): pellizco con dos dedos; con zoom y lápiz, un dedo mueve la vista ----------
const zoom = { k: 1, tx: 0, ty: 0 };
function aplicarZoom() {
  const W = $hoja.clientWidth, H = $hoja.clientHeight;
  zoom.k = Math.min(4, Math.max(1, zoom.k));
  zoom.tx = Math.min(0, Math.max(W - W * zoom.k, zoom.tx));
  zoom.ty = Math.min(0, Math.max(H - H * zoom.k, zoom.ty));
  $vista.style.transform = `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.k})`;
  const b = document.getElementById("zoom");
  b.textContent = `${Math.round(zoom.k * 100)}%`;
  b.classList.toggle("sel", zoom.k > 1);
}
// Zoom alrededor de un punto (en píxeles de la hoja)
function zoomEn(k, mx, my, base = { ...zoom }) {
  const bx = (mx - base.tx) / base.k, by = (my - base.ty) / base.k;
  zoom.k = Math.min(4, Math.max(1, k));
  zoom.tx = mx - bx * zoom.k;
  zoom.ty = my - by * zoom.k;
  aplicarZoom();
}
addEventListener("resize", ajustar);
ajustar();

function dibujar() {
  $svg.innerHTML = svgPizarron({ trazos, palabras }, { seleccion, marco });
}
function barra() {
  document.querySelectorAll("[data-pz]").forEach((b) => {
    b.classList.toggle("sel", +b.dataset.pz === n);
    b.classList.toggle("vivo", +b.dataset.pz === enPantalla);
  });
  document.querySelectorAll("[data-h]").forEach((b) => b.classList.toggle("sel", b.dataset.h === herramienta));
  document.querySelectorAll("[data-c]").forEach((b) => b.classList.toggle("sel", b.dataset.c === color));
  document.querySelectorAll("[data-g]").forEach((b) => b.classList.toggle("sel", +b.dataset.g === grosor));
  const proy = document.getElementById("proy");
  proy.textContent = enPantalla === n ? "● pantalla" : "pantalla";
  proy.classList.toggle("vivo", enPantalla === n);
  const cel = document.getElementById("cel"), esta = compartida?.id === `pizarron:${n}`;
  cel.textContent = esta ? "● celulares" : "celulares";
  cel.classList.toggle("vivo", esta);
  document.getElementById("reordenar").hidden = !textoDePizarron(n, diapos);
  $hoja.classList.toggle("modo-sel", herramienta === "sel");
}

// ---------- cambiar de pizarrón y escuchar sus datos ----------
function abrir(k) {
  desuscribir.forEach((f) => f());
  n = k;
  trazos = [];
  palabras = [];
  seleccion = new Set();
  marco = null;
  zoom.k = 1; zoom.tx = zoom.ty = 0;
  aplicarZoom();
  dibujar();
  barra();
  desuscribir = [
    fb.onSnapshot(fb.consultaTrazos(sid, k), (qs) => {
      trazos = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
      dibujar();
    }),
    fb.onSnapshot(fb.refPizarron(sid, k), async (snap) => {
      if (arrastrando) return;
      const d = snap.data();
      if (d?.palabras) palabras = JSON.parse(d.palabras);
      else if (!snap.metadata.hasPendingWrites && textoDePizarron(k, diapos)) {
        palabras = await maquetarTexto(textoDePizarron(k, diapos));
        guardarPalabras();
      } else palabras = [];
      seleccion = new Set([...seleccion].filter((id) => palabras.some((p) => p.id === id)));
      dibujar();
    }),
  ];
}
fb.onSnapshot(fb.refSesion(sid), (snap) => { compartida = snap.data()?.compartida || null; barra(); });
fb.onSnapshot(fb.refNav(sid), (snap) => {
  const p = snap.data()?.pizarron || null;
  const antes = enPantalla;
  enPantalla = p;
  if (p && p !== antes && p !== n) abrir(p); // la tablet sigue al pizarrón que se proyecta
  barra();
});

document.querySelectorAll("[data-pz]").forEach((b) => (b.onclick = () => abrir(+b.dataset.pz)));
document.querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { herramienta = b.dataset.h; seleccion = new Set(); marco = null; dibujar(); barra(); }));
document.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { color = b.dataset.c; herramienta = "lapiz"; barra(); }));
document.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => { grosor = +b.dataset.g; herramienta = "lapiz"; barra(); }));
document.getElementById("proy").onclick = () => fb.setDoc(fb.refNav(sid), { pizarron: enPantalla === n ? null : n }, { merge: true }).catch((e) => aviso(e.message));
// Compartir con celulares: por defecto no; cada trazo terminado lo leen todos los celulares conectados
document.getElementById("cel").onclick = () => {
  const esta = compartida?.id === `pizarron:${n}`;
  const nueva = esta ? null : { id: `pizarron:${n}`, json: JSON.stringify({ overlay: "pizarron", pizarron: { n } }) };
  fb.setDoc(fb.refSesion(sid), { compartida: nueva }, { merge: true }).catch((e) => aviso(e.message));
};
document.getElementById("zoom").onclick = () => { zoom.k = 1; zoom.tx = zoom.ty = 0; aplicarZoom(); };
// Rueda del mouse / trackpad (para probar en la compu)
$hoja.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  const [mx, my] = enHoja(ev.clientX, ev.clientY);
  zoomEn(zoom.k * Math.exp(-ev.deltaY * 0.002), mx, my);
}, { passive: false });
// Deshacer: lo último que se hizo en este pizarrón (trazo, mover palabras, borrar dibujo, reordenar texto)
const copiaPalabras = () => palabras.map((p) => ({ ...p }));
document.getElementById("deshacer").onclick = async () => {
  const h = historial[n].pop();
  if (!h) { const t = trazos.at(-1); if (t) fb.deleteDoc(fb.doc(fb.refTrazos(sid, n), t.id)); return; } // p. ej. después de recargar
  if (h.tipo === "trazo") fb.deleteDoc(fb.doc(fb.refTrazos(sid, n), h.id));
  if (h.tipo === "palabras") { palabras = h.antes; seleccion = new Set(); dibujar(); guardarPalabras(); }
  if (h.tipo === "borrar") {
    const b = fb.writeBatch(fb.db);
    h.trazos.forEach(({ id, ...t }) => b.set(fb.doc(fb.refTrazos(sid, n), id), t));
    await b.commit();
  }
};
document.getElementById("borrar").onclick = async () => {
  if (!trazos.length || !confirm(`¿Borrar todo lo dibujado en el pizarrón ${n}? (el texto queda; se puede deshacer)`)) return;
  historial[n].push({ tipo: "borrar", trazos: trazos.map((t) => ({ ...t })) });
  const b = fb.writeBatch(fb.db);
  trazos.forEach((t) => b.delete(fb.doc(fb.refTrazos(sid, n), t.id)));
  await b.commit();
};
document.getElementById("reordenar").onclick = async () => {
  if (!confirm("¿Volver a poner el texto ordenado en el medio?")) return;
  historial[n].push({ tipo: "palabras", antes: copiaPalabras() });
  palabras = await maquetarTexto(textoDePizarron(n, diapos));
  seleccion = new Set();
  dibujar();
  guardarPalabras();
};

// ---------- guardar ----------
// Mientras se arrastra, las posiciones van solo al proyector (pizarron_vivo); al soltar se guardan en el pizarrón
let tPal = 0;
function guardarPalabras(final = true) {
  if (final) {
    fb.setDoc(fb.refPizarron(sid, n), { palabras: JSON.stringify(palabras), actualizado: fb.serverTimestamp() }).catch((e) => aviso(e.message));
    fb.setDoc(fb.refVivo(sid, n), { p: [] }).catch(() => {});
    return;
  }
  if (Date.now() - tPal < 120) return;
  tPal = Date.now();
  fb.setDoc(fb.refVivo(sid, n), { p: [], palabras: JSON.stringify(palabras) }).catch(() => {});
}
let tVivo = 0;
function enviarVivo(t, final = false) {
  const ahora = Date.now();
  if (!final && ahora - tVivo < 120) return;
  tVivo = ahora;
  fb.setDoc(fb.refVivo(sid, n), final ? { p: [] } : { c: t.c, w: t.w, p: t.p.map(Math.round) }).catch(() => {});
}

// ---------- puntero: dibujar o seleccionar/mover ----------
const pos = (ev) => {
  const r = $vista.getBoundingClientRect(); // ya incluye el zoom
  return [((ev.clientX - r.left) / r.width) * 1920, ((ev.clientY - r.top) / r.height) * 1080];
};
let activo = null; // { id, tipo: 'trazo'|'marco'|'mover'|'mover-vista', … }
const toques = new Map(); // dedos apoyados (para el pellizco)
let pinza = null;
const enHoja = (x, y) => { const r = $hoja.getBoundingClientRect(); return [x - r.left, y - r.top]; };

// Rechazo de palma: el lápiz avisa que está cerca también al flotar sobre la pantalla (antes de tocarla).
// Mientras está cerca, y un rato después de levantarlo, cualquier toque se ignora por completo.
const LAPIZ_MS = 1500;
function marcarLapiz() {
  if (!penVisto) { penVisto = true; aviso("✎ lápiz detectado: el dedo ya no dibuja"); }
  penHasta = Date.now() + LAPIZ_MS;
}
const lapizCerca = () => Date.now() < penHasta;
["pointermove", "pointerover", "pointerdown", "pointerup"].forEach((t) =>
  document.addEventListener(t, (ev) => { if (ev.pointerType === "pen") marcarLapiz(); }, { capture: true }));
// Contacto grande = palma (si el dispositivo informa el tamaño del toque)
const esGrande = (ev) => Math.max(ev.width || 0, ev.height || 0) > 30;

// Cancela lo que se estaba haciendo (cuando aparece un segundo dedo)
function cancelar() {
  if (!activo) return;
  if (activo.tipo === "trazo") { ctx.clearRect(0, 0, cv.width, cv.height); enviarVivo(activo.t, true); }
  if (activo.tipo === "marco") marco = null;
  if (activo.tipo === "mover") { arrastrando = false; palabras = activo.antes; guardarPalabras(); }
  activo = null;
  dibujar();
}
function empezarPinza() {
  const [a, b] = [...toques.values()];
  pinza = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m0: enHoja((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), base: { ...zoom } };
}
function moverPinza() {
  const [a, b] = [...toques.values()];
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = enHoja((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  const { base, m0 } = pinza;
  // el punto del pizarrón que estaba bajo los dedos sigue bajo los dedos
  const k = Math.min(4, Math.max(1, base.k * (d / pinza.d0)));
  const bx = (m0[0] - base.tx) / base.k, by = (m0[1] - base.ty) / base.k;
  zoom.k = k;
  zoom.tx = m[0] - bx * k;
  zoom.ty = m[1] - by * k;
  aplicarZoom();
}

$hoja.addEventListener("pointerdown", (ev) => {
  if (ev.pointerType === "touch") {
    ev.preventDefault();
    // la mano mientras se escribe: ni dibuja, ni hace zoom, ni corta el trazo del lápiz
    if (lapizCerca() || activo?.lapiz || esGrande(ev)) return;
    toques.set(ev.pointerId, [ev.clientX, ev.clientY]);
    try { $hoja.setPointerCapture(ev.pointerId); } catch {}
    if (toques.size >= 2) { cancelar(); empezarPinza(); return; }
  }
  if (activo || pinza) return;
  const [x, y] = pos(ev);
  if (herramienta === "lapiz") {
    if (ev.pointerType === "touch" && penVisto) {
      // con lápiz, el dedo no dibuja: si hay zoom, mueve la vista
      if (zoom.k > 1) activo = { id: ev.pointerId, tipo: "mover-vista", cx: ev.clientX, cy: ev.clientY, tx: zoom.tx, ty: zoom.ty };
      return;
    }
    activo = { id: ev.pointerId, tipo: "trazo", lapiz: ev.pointerType === "pen", t: { c: color, w: grosor, p: [x, y] } };
    pintarSegmento(activo.t, 0);
  } else {
    const hit = [...palabras].reverse().find((p) => { const c = cajaPalabra(p); return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h; });
    if (hit) {
      if (!seleccion.has(hit.id)) seleccion = new Set([hit.id]);
      arrastrando = true;
      activo = { id: ev.pointerId, tipo: "mover", lapiz: ev.pointerType === "pen", antes: copiaPalabras(), x0: x, y0: y, orig: Object.fromEntries(palabras.filter((p) => seleccion.has(p.id)).map((p) => [p.id, [p.x, p.y]])) };
    } else {
      activo = { id: ev.pointerId, tipo: "marco", lapiz: ev.pointerType === "pen", x0: x, y0: y };
      marco = { x, y, w: 0, h: 0 };
    }
    dibujar();
  }
  try { $hoja.setPointerCapture(ev.pointerId); } catch {}
  ev.preventDefault();
});

$hoja.addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "touch" && toques.has(ev.pointerId)) toques.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (pinza) { if (toques.size >= 2) moverPinza(); return; }
  if (!activo || ev.pointerId !== activo.id) return;
  if (activo.tipo === "mover-vista") {
    zoom.tx = activo.tx + ev.clientX - activo.cx;
    zoom.ty = activo.ty + ev.clientY - activo.cy;
    return aplicarZoom();
  }
  const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
  if (activo.tipo === "trazo") {
    const t = activo.t, desde = t.p.length - 2;
    (evs.length ? evs : [ev]).forEach((e) => t.p.push(...pos(e)));
    pintarSegmento(t, desde);
    enviarVivo(t);
    return;
  }
  const [x, y] = pos(ev);
  if (activo.tipo === "marco") {
    marco = { x: Math.min(x, activo.x0), y: Math.min(y, activo.y0), w: Math.abs(x - activo.x0), h: Math.abs(y - activo.y0) };
  } else {
    const dx = x - activo.x0, dy = y - activo.y0;
    palabras.forEach((p) => { const o = activo.orig[p.id]; if (o) { p.x = Math.round(o[0] + dx); p.y = Math.round(o[1] + dy); } });
    guardarPalabras(false);
  }
  dibujar();
});

function terminar(ev) {
  toques.delete(ev.pointerId);
  if (pinza) { if (toques.size < 2) pinza = null; return; }
  if (!activo || ev.pointerId !== activo.id) return;
  const a = activo;
  activo = null;
  if (a.tipo === "mover-vista") return;
  if (a.tipo === "trazo") {
    const p = simplificar(a.t.p);
    enviarVivo(a.t, true);
    const ref = fb.doc(fb.refTrazos(sid, n));
    historial[n].push({ tipo: "trazo", id: ref.id });
    fb.setDoc(ref, { c: a.t.c, w: a.t.w, p, o: Date.now() }).catch((e) => aviso(e.message));
    setTimeout(() => ctx.clearRect(0, 0, cv.width, cv.height), 60);
  } else if (a.tipo === "marco") {
    const m = marco;
    seleccion = new Set(palabras.filter((p) => { const c = cajaPalabra(p); return c.x < m.x + m.w && c.x + c.w > m.x && c.y < m.y + m.h && c.y + c.h > m.y; }).map((p) => p.id));
    marco = null;
    dibujar();
  } else {
    arrastrando = false;
    if (JSON.stringify(a.antes) !== JSON.stringify(palabras)) historial[n].push({ tipo: "palabras", antes: a.antes });
    guardarPalabras();
  }
}
$hoja.addEventListener("pointerup", terminar);
$hoja.addEventListener("pointercancel", terminar);

// El trazo en curso se pinta en un canvas encima (rápido); al terminar pasa al SVG
function pintarSegmento(t, desde) {
  const k = cv.width / 1920;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.strokeStyle = COLORES[t.c];
  ctx.lineWidth = t.w;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  const p = t.p;
  ctx.moveTo(p[Math.max(0, desde)], p[Math.max(0, desde) + 1]);
  for (let i = Math.max(0, desde); i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  if (p.length === 2) ctx.lineTo(p[0] + 0.01, p[1]);
  ctx.stroke();
}

function aviso(msg) {
  const e = document.getElementById("estado");
  e.textContent = msg;
  setTimeout(() => (e.textContent = ""), 4000);
}

barra();
abrir(1);
avisoVersion();
