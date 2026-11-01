// Vista de los participantes (celular): se une a la sesión, ve lo que el presentador comparte y responde la actividad abierta.
import { cargarTaller, renderSlide, montar, encajar, esc } from "./slides.js";
import { vigilarVersion } from "./version.js";
import { codigoSesion, urlParticipante, resolverActividades, actividadPorId } from "./actividades.js";
import { cargarPresentacion, armarPresentacion, TALLER } from "./presentacion.js";
import { entrarAnonimo, refSesion, refRespuesta, refContenido, leerContenido, refPizarron, consultaTrazos, onSnapshot, setDoc, getDoc, serverTimestamp } from "./firebase.js";

const $app = document.getElementById("app");
const $quien = document.getElementById("quien");
const $comp = document.getElementById("compartida");
const $vst = document.getElementById("vst");
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

const datos = await cargarTaller();
const sid = codigoSesion(datos.actividades);
const pres = await cargarPresentacion(sid, datos);
const def = pres.def;
const base = { bloques: pres.bloques, joinUrl: urlParticipante(sid) };
const GRUPOS = Object.keys(datos.plantilla.grupos); // ["A", "B", "C", "D"]
let acts = resolverActividades(def, pres.diapositivas);
if (!pres.meta && sid !== TALLER) {
  $app.innerHTML = `<h1>Este enlace no existe<span class="lima blink">_</span></h1><p class="sec">Revisá el código que te pasaron o volvé a escanear el QR.</p>`;
  throw new Error("presentación inexistente");
}

let user = null;
let nombre = ls.get("et_nombre") || "";
let vista = null; // clave de lo que se está mostrando, para no pisar lo que el usuario escribe
let estado = {};
let escuchando = false;

const franja = `<div class="franja">${["lima", "fucsia", "celeste", "verde"].map((c) => `<i style="background:var(--${c})"></i>`).join("")}</div>`;
const quien = () => (nombre ? nombre : "sin nombre");

function pintar(html) {
  $app.innerHTML = html;
}

try {
  user = await entrarAnonimo();
} catch (e) {
  console.error(e);
  pintar(`<h1>Sin señal<span class="lima blink">_</span></h1><p class="sec">Para entrar hace falta conexión una vez. Apenas vuelva la señal, esta página se conecta sola.</p><div class="acciones"><button class="btn" onclick="location.reload()">reintentar ahora</button></div>${franja}`);
  // reintenta sola al volver la conexión (y cada 10 s por si el aviso del navegador no llega)
  addEventListener("online", () => location.reload(), { once: true });
  let estabaSinRed = !navigator.onLine;
  setInterval(() => { if (!navigator.onLine) estabaSinRed = true; else if (estabaSinRed) location.reload(); }, 5000);
  throw e;
}

// Versión nueva publicada: se recarga sola, pero solo cuando está esperando (nunca en medio de una respuesta)
let versionNueva = false;
vigilarVersion(() => { versionNueva = true; if (vista === "espera" || vista === "bienvenida") location.reload(); });

if (ls.get(`et_unido_${sid}`)) escuchar();
else bienvenida();

function bienvenida() {
  vista = "bienvenida";
  $quien.textContent = sid;
  pintar(`<h1>${esc(pres.titulo)}<span class="lima blink">_</span></h1>
    <p class="sec">Desde acá vas a responder las actividades del taller y ver lo que se comparta de la pantalla. Cuando haya algo, aparece solo.</p>
    <form id="f" style="margin-top:20px">
      <div class="campo">
        <label for="nombre">Tu nombre o apodo <span class="sec" style="font-weight:500">(opcional)</span></label>
        <input id="nombre" maxlength="40" autocomplete="nickname" enterkeyhint="go" value="${esc(nombre)}" placeholder="Podés dejarlo vacío">
      </div>
      <p class="sec" style="font-size:14px;margin-top:-8px">Las preguntas marcadas como <span class="etq sec-etq">anónimo</span> nunca guardan tu nombre.</p>
      <div class="acciones"><button class="btn" type="submit">entrar →</button></div>
    </form>${franja}`);
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    nombre = document.getElementById("nombre").value.trim().slice(0, 40);
    ls.set("et_nombre", nombre);
    ls.set(`et_unido_${sid}`, "1");
    vista = null;
    escuchar();
  };
}

function escuchar() {
  $quien.textContent = quien();
  if (escuchando) return render();
  escuchando = true;
  render();
  const caida = (err) => {
    console.error(err);
    pintar(`<h1>Se cortó la conexión</h1><p class="sec">Volvé a cargar la página.</p><div class="acciones"><button class="btn" onclick="location.reload()">recargar</button></div>${franja}`);
  };
  // Aviso de «sin señal» (con una pequeña espera para no parpadear al abrir)
  let tSenal = null;
  onSnapshot(refSesion(sid), { includeMetadataChanges: true }, (snap) => {
    clearTimeout(tSenal);
    if (!snap.metadata.fromCache) { $quien.textContent = quien(); $quien.classList.remove("sin-senal"); return; }
    tSenal = setTimeout(() => { $quien.textContent = "sin señal · reconectando…"; $quien.classList.add("sin-senal"); }, 2500);
  }, () => {});
  onSnapshot(refSesion(sid), (snap) => {
    estado = snap.data() || {};
    compartida();
    render();
  }, caida);
  // Si el presentador edita las diapositivas, las preguntas de las actividades se actualizan solas
  onSnapshot(refContenido(sid), (snap) => {
    const p = armarPresentacion(sid, datos, leerContenido(snap), pres.meta);
    acts = resolverActividades(p.def, p.diapositivas);
    render();
  }, (err) => console.warn(err));
}

// ---------- vista compartida desde la pantalla ----------
function compartida() {
  const c = estado.compartida;
  $comp.hidden = !c;
  document.body.classList.toggle("con-compartida", !!c);
  const v = c ? JSON.parse(c.json) : null;
  escucharPizarron(v?.overlay === "pizarron" ? v.pizarron.n : null);
  if (!c) { cerrarGrande(); return; }
  if (v.overlay !== "pizarron") montar($vst, renderSlide(v.s, { ...base, ...v }));
  ajustarGrande();
}
// Pizarrón compartido: se escuchan sus palabras y trazos terminados mientras esté compartido
let pzN = null, pzDatos = {}, pzStop = [];
function escucharPizarron(k) {
  if (k === pzN) return;
  pzStop.forEach((f) => f());
  pzStop = [];
  pzN = k;
  pzDatos = {};
  if (!k) return;
  const pintarPz = () => { montar($vst, renderSlide(null, { ...base, overlay: "pizarron", pizarron: pzDatos })); ajustarGrande(); };
  pintarPz();
  pzStop = [
    onSnapshot(refPizarron(sid, k), (snap) => { pzDatos.palabras = snap.data()?.palabras ? JSON.parse(snap.data().palabras) : []; pintarPz(); }),
    onSnapshot(consultaTrazos(sid, k), (qs) => { pzDatos.trazos = qs.docs.map((d) => d.data()); pintarPz(); }),
  ];
}
const ampliar = document.getElementById("ampliar");
ampliar.onclick = async () => {
  if ($comp.classList.contains("ampliada")) return cerrarGrande();
  $comp.classList.add("ampliada");
  ampliar.textContent = "cerrar ✕";
  ajustarGrande();
  // Pantalla completa y horizontal donde el navegador lo permite (Android); si no, se gira la diapositiva
  try {
    if ($comp.requestFullscreen) await $comp.requestFullscreen();
    screen.orientation?.lock?.("landscape").catch(() => {});
  } catch {}
  setTimeout(ajustarGrande, 300);
};
function cerrarGrande() {
  if (!$comp.classList.contains("ampliada")) return;
  $comp.classList.remove("ampliada");
  ampliar.textContent = "ver en grande ⤢";
  try { screen.orientation?.unlock?.(); } catch {}
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  ajustarGrande();
}
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) cerrarGrande(); });
// En grande y con el celular vertical, la diapositiva se gira para aprovechar toda la pantalla
function ajustarGrande() {
  const girar = $comp.classList.contains("ampliada") && innerHeight > innerWidth;
  $comp.classList.toggle("girada", girar);
  if (girar) Object.assign($vst.style, { width: `${innerHeight}px`, height: `${innerWidth}px` });
  else $vst.style.width = $vst.style.height = "";
  encajar($vst);
}
addEventListener("resize", ajustarGrande);
addEventListener("orientationchange", () => setTimeout(ajustarGrande, 200));

// ---------- actividades ----------
function render() {
  const act = estado.abierta ? actividadPorId(acts, estado.actividad) : null;
  const clave = act ? `act:${act.id}:${JSON.stringify([act.preguntas, act.opciones, act.items, act.columnas])}` : "espera";
  if (clave === vista) return;
  const anterior = vista;
  vista = clave;
  if (!act) return esperando(anterior && anterior.startsWith("act:"));
  mostrarActividad(act);
}

function esperando(recienCerrada) {
  if (versionNueva) return location.reload();
  pintar(`${recienCerrada ? `<div class="estado-ok">La actividad se cerró. ¡Gracias por participar!</div>` : ""}
    <h1 class="espera">Esperando la próxima actividad<span class="lima blink">_</span></h1>
    <p class="sec">Dejá esta página abierta. Cuando haya algo para responder o ver, aparece acá.</p>
    <div class="acciones" style="margin-top:24px">
      <a class="btn sec-btn" href="/material?s=${encodeURIComponent(sid)}" target="_blank" rel="noopener">ver el material ↗</a>
      <button class="btn sec-btn" id="cambiar">cambiar mi nombre</button>
    </div>
    ${franja}`);
  document.getElementById("cambiar").onclick = () => { ls.del(`et_unido_${sid}`); bienvenida(); };
}

const claveBorrador = (act) => `et_borrador_${sid}_${act.id}`;

async function mostrarActividad(act) {
  const clave = vista;
  pintar(`<p class="sec" style="margin-top:32px">cargando…</p>`);
  let previa = null;
  try {
    const snap = await getDoc(refRespuesta(sid, act.id, user.uid));
    if (snap.exists()) previa = snap.data();
  } catch (e) { console.warn(e); }
  if (vista !== clave) return; // cambió mientras cargaba
  if (act.tipo === "votacion") return votacion(act, previa);
  if (act.tipo === "clasificar") return clasificar(act, previa, false);
  return abiertas(act, previa, false);
}

async function guardar(act, valores, grupo = null) {
  // Sin señal, la respuesta queda en cola y se envía sola al volver: se avisa si tarda
  const aviso = setTimeout(() => {
    const d = document.getElementById("msg");
    if (d) d.innerHTML = `<div class="estado-err">Sin señal: tu respuesta se va a enviar sola cuando vuelva la conexión. No cierres esta página.</div>`;
  }, 3000);
  try { await guardarYa(act, valores, grupo); } finally { clearTimeout(aviso); }
}
async function guardarYa(act, valores, grupo) {
  await setDoc(refRespuesta(sid, act.id, user.uid), {
    uid: user.uid,
    actividad: act.id,
    nombre: act.anonimo ? null : nombre || null,
    grupo,
    valores,
    ts: serverTimestamp(),
  });
}

function errorGuardar(e) {
  console.error(e);
  const msg = String(e?.code || "").includes("permission") ? "La actividad ya está cerrada." : "No se pudo enviar. Revisá tu conexión y probá de nuevo.";
  const d = document.getElementById("msg");
  if (d) d.innerHTML = `<div class="estado-err">${msg}</div>`;
}

function cabecera(act) {
  return `<div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap">
      <span class="etq">● actividad</span>${act.anonimo ? `<span class="etq sec-etq">anónimo</span>` : ""}
    </div>
    <h1>${esc(act.pregunta || act.titulo)}</h1>`;
}

function votacion(act, previa) {
  let sel = Number.isInteger(previa?.valores?.opcion) ? previa.valores.opcion : null;
  const dibujar = () => {
    pintar(`${cabecera(act)}
      <p class="sec">Tocá una opción. Podés cambiarla mientras la votación siga abierta.</p>
      <div class="opciones" style="margin-top:16px">
        ${act.opciones.map((o, i) => `<button class="opcion${sel === i ? " sel" : ""}" data-i="${i}">${esc(o)}</button>`).join("")}
      </div>
      <div id="msg">${sel != null ? `<div class="estado-ok">Tu voto: <b>${esc(act.opciones[sel])}</b> ✓</div>` : ""}</div>
      ${franja}`);
    $app.querySelectorAll(".opcion").forEach((b) => (b.onclick = async () => {
      const i = +b.dataset.i;
      const antes = sel;
      sel = i;
      dibujar();
      try { await guardar(act, { opcion: i }); }
      catch (e) { sel = antes; dibujar(); errorGuardar(e); }
    }));
  };
  dibujar();
}

function abiertas(act, previa, editando) {
  const borrador = JSON.parse(ls.get(claveBorrador(act)) || "null");
  const valores = editando || !previa ? (borrador || previa?.valores || {}) : previa.valores;
  if (previa && !editando) {
    pintar(`${cabecera(act)}
      <div class="estado-ok">¡Respuesta enviada! ✓</div>
      ${act.preguntas.map((p, i) => `<div class="campo"><div class="lbl"><span class="n">${String(i + 1).padStart(2, "0")}</span>${esc(p)}</div><p class="sec" style="margin:0;white-space:pre-wrap">${esc(valores[i] || "—")}</p></div>`).join("")}
      <div class="acciones"><button class="btn sec-btn" id="editar">editar mi respuesta</button></div>
      ${franja}`);
    document.getElementById("editar").onclick = () => abiertas(act, previa, true);
    return;
  }
  pintar(`${cabecera(act)}
    <p class="sec">Respondé con tus palabras. No hay respuestas correctas.</p>
    <form id="f" style="margin-top:16px">
      ${act.preguntas.map((p, i) => `<div class="campo"><label for="q${i}"><span class="n">${String(i + 1).padStart(2, "0")}</span>${esc(p)}</label><textarea id="q${i}" maxlength="1000" enterkeyhint="next">${esc(valores[i] || "")}</textarea></div>`).join("")}
      <div id="msg"></div>
      <div class="acciones"><button class="btn" type="submit">enviar →</button></div>
    </form>${franja}`);
  const f = document.getElementById("f");
  const leer = () => Object.fromEntries(act.preguntas.map((_, i) => [i, document.getElementById(`q${i}`).value.trim().slice(0, 1000)]));
  f.oninput = () => ls.set(claveBorrador(act), JSON.stringify(leer()));
  f.onsubmit = async (e) => {
    e.preventDefault();
    const v = leer();
    if (!Object.values(v).some(Boolean)) {
      document.getElementById("msg").innerHTML = `<div class="estado-err">Escribí al menos una respuesta.</div>`;
      return;
    }
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await guardar(act, v);
      ls.del(claveBorrador(act));
      abiertas(act, { valores: v }, false);
    } catch (err) { btn.disabled = false; errorGuardar(err); }
  };
}

function clasificar(act, previa, editando) {
  let grupo = previa?.grupo || ls.get(`et_grupo_${sid}`) || null;
  const valores = { ...(previa?.valores || {}) };
  if (previa && !editando) {
    pintar(`${cabecera(act)}
      <div class="estado-ok">¡Enviado! ✓ ${grupo ? `Grupo <b>${esc(grupo)}</b>` : ""}</div>
      ${act.items.map((it, i) => `<div class="tarea"><div class="t"><span class="n">${String(i + 1).padStart(2, "0")}</span>${esc(it)}</div><div class="sec">→ ${valores[i] != null ? `${+valores[i] + 1} · ${esc(act.columnas[valores[i]])}` : "sin ubicar"}</div></div>`).join("")}
      <div class="acciones" style="margin-top:16px"><button class="btn sec-btn" id="editar">editar</button></div>
      ${franja}`);
    document.getElementById("editar").onclick = () => clasificar(act, previa, true);
    return;
  }
  const colorCol = (j) => `var(--${act.colores?.[j] || "lima"})`;
  pintar(`${cabecera(act)}
    ${act.por_grupo ? `<h2>¿De qué grupo son?</h2>
    <div class="grupos-sel">${GRUPOS.map((g) => `<button type="button" class="grupo-btn${grupo === g ? " sel" : ""}" data-g="${g}" style="--c:var(--${datos.plantilla.grupos[g].color})">grupo ${g}</button>`).join("")}</div>` : ""}
    <h2>¿En qué columna va cada tarea?</h2>
    <div class="leyenda">${act.columnas.map((c, j) => `<div><b style="color:${colorCol(j)}">${j + 1}</b>${esc(c)}</div>`).join("")}</div>
    ${act.items.map((it, i) => `<div class="tarea"><div class="t"><span class="n">${String(i + 1).padStart(2, "0")}</span>${esc(it)}</div>
      <div class="seg" data-i="${i}">${act.columnas.map((_, j) => `<button type="button" data-j="${j}" style="--c:${colorCol(j)}" class="${valores[i] === j ? "sel" : ""}">${j + 1}</button>`).join("")}</div></div>`).join("")}
    <div id="msg"></div>
    <div class="acciones" style="margin-top:12px"><button class="btn" id="enviar">enviar →</button></div>
    ${franja}`);
  $app.querySelectorAll(".grupo-btn").forEach((b) => (b.onclick = () => {
    grupo = b.dataset.g;
    ls.set(`et_grupo_${sid}`, grupo);
    $app.querySelectorAll(".grupo-btn").forEach((x) => x.classList.toggle("sel", x === b));
    $app.querySelector(".grupos-sel").classList.remove("falta");
  }));
  $app.querySelectorAll(".seg").forEach((s) => s.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    valores[s.dataset.i] = +b.dataset.j;
    s.querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b));
    s.closest(".tarea").classList.remove("falta");
  })));
  document.getElementById("enviar").onclick = async (e) => {
    const msg = document.getElementById("msg");
    // Lo que falta se marca en rojo (parpadea) y no se envía hasta completarlo
    const faltaGrupo = act.por_grupo && !grupo;
    const faltan = act.items.map((_, i) => i).filter((i) => valores[i] == null);
    $app.querySelector(".grupos-sel")?.classList.toggle("falta", faltaGrupo);
    $app.querySelectorAll(".tarea").forEach((t, i) => t.classList.toggle("falta", faltan.includes(i)));
    if (faltaGrupo || faltan.length) {
      const partes = [faltaGrupo && "elegir tu grupo", faltan.length && `ubicar ${faltan.length === 1 ? "la tarea" : "las tareas"} ${faltan.map((i) => String(i + 1).padStart(2, "0")).join(", ")}`].filter(Boolean);
      msg.innerHTML = `<div class="estado-err falta-msg">Te falta ${partes.join(" y ")}.</div>`;
      // reinicia el parpadeo y lleva a lo primero que falta
      $app.querySelectorAll(".falta").forEach((el) => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
      $app.querySelector(".falta")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    e.target.disabled = true;
    try {
      await guardar(act, valores, grupo);
      clasificar(act, { grupo, valores }, false);
    } catch (err) { e.target.disabled = false; errorGuardar(err); }
  };
}
