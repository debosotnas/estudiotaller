// Material para los participantes (solo lectura): todas las diapositivas visibles, completas, sin notas ni resultados.
// Se pueden ver en grande (flechas o deslizar) y guardar como PDF con la impresión del navegador.
import { cargarTaller, renderSlide, montar, encajar, esc, usarTema } from "./slides.js";
import { aplicarRevisiones, codigoSesion, urlParticipante, visibles } from "./actividades.js";
import { cargarPresentacion, TALLER } from "./presentacion.js";

const $app = document.getElementById("app");
const datos = await cargarTaller();
const sid = codigoSesion(datos.actividades);
const pres = await cargarPresentacion(sid, datos);
if (!pres.meta && sid !== TALLER) { $app.innerHTML = `<h1>Este material no existe</h1>`; throw new Error("presentación inexistente"); }
if (pres.esTaller && pres.guardado) aplicarRevisiones(pres.diapositivas, datos.diapositivas); // lo nuevo del JSON publicado, aunque la consola no lo haya guardado aún
const lista = visibles(pres.diapositivas);
const base = { bloques: pres.bloques, joinUrl: urlParticipante(sid), total: lista.length, tema: pres.tema };
usarTema(pres.tema);
document.title = `Material · ${pres.titulo}`;
const slide = (i) => renderSlide(lista[i], { ...base, numero: i + 1 });

$app.innerHTML = `
  <header class="mat-cab">
    <div class="mono lima">// material del taller</div>
    <h1>${esc(pres.esTaller ? datos.taller.meta.titulo.split(":")[0] : pres.titulo)}<span class="lima blink">_</span></h1>
    <p class="sec">${pres.esTaller ? `${esc(datos.taller.meta.evento)} · ` : ""}${lista.length} diapositivas. Tocá una para verla en grande.</p>
    <div class="acciones"><button class="btn" id="pdf">guardar como pdf</button></div>
  </header>
  <div class="mat-lista">${lista.map((_, i) => `<figure class="mat-item" data-i="${i}"><div class="stage"></div><figcaption class="mono sec">${String(i + 1).padStart(2, "0")} / ${lista.length}</figcaption></figure>`).join("")}</div>
  <div class="mat-visor" id="visor" hidden>
    <div class="stage" id="vst"></div>
    <div class="mat-visor-barra">
      <button class="btn sec-btn chico" id="v-ant" aria-label="anterior">←</button>
      <span class="mono" id="v-pos"></span>
      <button class="btn sec-btn chico" id="v-sig" aria-label="siguiente">→</button>
      <button class="btn chico" id="v-cerrar">cerrar ✕</button>
    </div>
  </div>`;

const stages = [...document.querySelectorAll(".mat-item .stage")];
stages.forEach((st, i) => montar(st, slide(i)));
addEventListener("resize", () => { stages.forEach(encajar); if (actual != null) ajustarVisor(); });

// ---------- visor en grande ----------
const $visor = document.getElementById("visor"), $vst = document.getElementById("vst");
let actual = null;
function ver(i) {
  actual = Math.max(0, Math.min(lista.length - 1, i));
  $visor.hidden = false;
  document.body.style.overflow = "hidden";
  montar($vst, slide(actual));
  document.getElementById("v-pos").textContent = `${actual + 1} / ${lista.length}`;
  ajustarVisor();
}
function cerrar() { actual = null; $visor.hidden = true; document.body.style.overflow = ""; }
// Con el celular vertical, la diapositiva se gira para ocupar toda la pantalla
function ajustarVisor() {
  const girar = innerHeight > innerWidth;
  $visor.classList.toggle("girada", girar);
  if (girar) Object.assign($vst.style, { width: `${innerHeight - 70}px`, height: `${innerWidth}px` });
  else $vst.style.width = $vst.style.height = "";
  encajar($vst);
}
document.querySelector(".mat-lista").onclick = (ev) => { const f = ev.target.closest(".mat-item"); if (f) ver(+f.dataset.i); };
document.getElementById("v-ant").onclick = () => ver(actual - 1);
document.getElementById("v-sig").onclick = () => ver(actual + 1);
document.getElementById("v-cerrar").onclick = cerrar;
document.addEventListener("keydown", (ev) => {
  if (actual == null) return;
  if (ev.key === "ArrowRight" || ev.key === " ") ver(actual + 1);
  else if (ev.key === "ArrowLeft") ver(actual - 1);
  else if (ev.key === "Escape") cerrar();
});
// Deslizar para pasar (en la dirección en que se ve la diapositiva)
let x0 = null;
$vst.addEventListener("pointerdown", (ev) => (x0 = [ev.clientX, ev.clientY]));
$vst.addEventListener("pointerup", (ev) => {
  if (!x0) return;
  const girada = $visor.classList.contains("girada");
  const d = girada ? ev.clientY - x0[1] : ev.clientX - x0[0];
  if (Math.abs(d) > 40) ver(actual + (d < 0 ? 1 : -1));
  x0 = null;
});

// ---------- PDF: una diapositiva por página (13.333 × 7.5 in) ----------
document.getElementById("pdf").onclick = () => print();
addEventListener("beforeprint", () => stages.forEach((st) => { Object.assign(st.style, { width: "1280px", height: "720px" }); encajar(st); }));
addEventListener("afterprint", () => stages.forEach((st) => { st.style.width = st.style.height = ""; encajar(st); }));
