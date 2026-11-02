// Página de inicio: qué se puede hacer (carrusel dibujado con el propio motor de diapositivas) y «comenzar».
import { cargarTaller, renderSlide, montar, encajar, esc } from "./slides.js";
import { usuarioActual, entrarGoogle, onAuthStateChanged, auth } from "./firebase.js";

const datos = await cargarTaller();
const base = { bloques: { "01": { id: "01", nombre: "intro" }, "02": { id: "02", nombre: "en vivo" } }, joinUrl: `${location.origin}/demo`, numero: 3, total: 12 };
const frase = (texto) => ({ plantilla: "frase", bloque: "02", frase: texto });

// Cada lámina: qué es, una frase, y una diapositiva de ejemplo con sus resultados
const LAMINAS = [
  { rotulo: "diapositivas", titulo: "Diapositivas con estilo, sin pelearte con el diseño",
    texto: "19 plantillas, cuatro temas y edición directa sobre la diapositiva. Si querés libertad total, movés y redimensionás cada elemento. Exportás a PDF o PowerPoint.",
    s: { plantilla: "portada", etiqueta: "> estudio taller", titulo: "Tu taller,\ncon el público adentro", subtitulo: "Presentaciones con actividades en vivo", pie: "estudiotaller.web.app" } },
  { rotulo: "votación", titulo: "Votaciones con resultados en vivo",
    texto: "Cada uno vota desde su celular y, cuando querés, las opciones se llenan con los porcentajes.",
    s: { plantilla: "pregunta", bloque: "02", pregunta: "¿Usaste **una IA** esta semana?", opciones: ["SÍ", "NO", "NO SÉ"], apoyo: "Respondé desde tu celular" },
    ctx: { act: { tipo: "votacion", opciones: ["SÍ", "NO", "NO SÉ"] }, res: { total: 40, conteos: [27, 9, 4] }, revelar: true } },
  { rotulo: "nube de palabras", titulo: "Nube de palabras",
    texto: "Una consigna, unas palabras por persona, y la nube aparece en la pantalla: lo más repetido, más grande.",
    s: frase("Una palabra"),
    ctx: { act: { tipo: "nube", pregunta: "Una palabra que asocies con la IA" }, revelar: true,
      res: { total: 38, palabras: [["ayuda", 14], ["futuro", 9], ["miedo", 7], ["rapidez", 6], ["tarea", 5], ["curiosidad", 4], ["trabajo", 3], ["creatividad", 3], ["dudas", 2], ["herramienta", 2]].map(([texto, n]) => ({ texto, n })) } } },
  { rotulo: "quiz", titulo: "Quiz con tiempo y puntaje",
    texto: "Preguntas con cuenta regresiva, botones de colores en el celular, puntos por acertar rápido, ranking y podio.",
    s: frase(""),
    ctx: { quiz: { estado: "resultado", i: 1, n: 5, titulo: "Quiz", pregunta: "¿Quién tiene la primera palabra en lo formativo?", opciones: ["La IA", "Yo", "Depende", "Nadie"], correcta: 1, conteos: [6, 21, 8, 1], respondieron: 36, restante: 0, ranking: [] } } },
  { rotulo: "preguntas del público", titulo: "Preguntas del público, con votos",
    texto: "Mandan sus preguntas, votan las de los demás y respondés primero las que más interesan. Vos moderás.",
    s: frase(""),
    ctx: { act: { tipo: "qa", pregunta: "¿Qué te gustaría preguntar?" }, revelar: true,
      res: { total: 4, items: [
        { id: "a", texto: "¿Cómo sé si una respuesta de la IA es confiable?", votos: 12, respondida: true },
        { id: "b", texto: "¿Está mal usar IA para preparar un devocional?", votos: 9 },
        { id: "c", texto: "¿La IA puede reemplazar a un consejero?", votos: 6 },
        { id: "d", texto: "¿Qué herramienta recomiendan para estudiar?", votos: 2 }] } } },
  { rotulo: "pizarrón", titulo: "Un pizarrón desde la tablet",
    texto: "Dibujás con el lápiz y el proyector lo muestra en vivo. Podés mover palabras de un texto para armar un diagrama.",
    s: frase(""),
    ctx: { overlay: "pizarron", pizarron: {
      palabras: [{ id: "a", t: "considerémonos", x: 300, y: 330, w: 330, s: 46 }, { id: "b", t: "estimularnos", x: 1180, y: 330, w: 290, s: 46 }, { id: "c", t: "congregarnos", x: 300, y: 760, w: 300, s: 46 }, { id: "d", t: "exhortándonos", x: 1180, y: 760, w: 320, s: 46 },
        { id: "r", t: "Hebreos 10:24–25", x: 760, y: 140, w: 400, s: 26, ref: true }],
      trazos: [{ c: "lima", w: 8, p: [660, 315, 1150, 315] }, { c: "fucsia", w: 8, p: [470, 380, 470, 700] }, { c: "celeste", w: 8, p: [1320, 380, 1320, 700] },
        { c: "verde", w: 8, p: [640, 745, 1150, 745] }, { c: "blanco", w: 4, p: [880, 520, 960, 470, 1040, 520, 960, 570, 880, 520] }] } } },
  { rotulo: "consola", titulo: "Una consola para vos, la pantalla para todos",
    texto: "Notas, vista de la siguiente, contenido por pasos, cronómetro por bloque y la proyección en el segundo monitor.",
    s: { plantilla: "lista", bloque: "02", titulo: "Mientras presentás", items: [{ texto: "Notas y la diapositiva siguiente" }, { texto: "Contenido **por pasos**, con las flechas" }, { texto: "Cronómetro por bloque" }, { texto: "Segundo monitor y pantalla completa" }] } },
  { rotulo: "material", titulo: "Material para llevarse",
    texto: "Un enlace con todas las diapositivas para ver en el celular o guardar como PDF, y un QR para compartirlo.",
    s: { plantilla: "recursos", bloque: "02", titulo: "Recursos y fuentes", items: [{ texto: "Todas las diapositivas", detalle: "para ver en el celular" }, { texto: "Guardar como PDF", detalle: "una diapositiva por página" }, { texto: "Descargar .pptx", detalle: "para seguir editando" }], url: `${location.origin}/material`, rotulo_qr: "el material del taller" } },
];

// ---------- carrusel ----------
const $pista = document.getElementById("pista"), $puntos = document.getElementById("puntos");
$pista.innerHTML = LAMINAS.map((l, i) => `<article class="car-lamina" aria-label="${i + 1} de ${LAMINAS.length}">
    <div class="stage"></div>
    <div class="car-texto"><span class="etq">${esc(l.rotulo)}</span><h2>${esc(l.titulo)}</h2><p class="sec">${esc(l.texto)}</p></div>
  </article>`).join("");
$puntos.innerHTML = LAMINAS.map((_, i) => `<button aria-label="lámina ${i + 1}" data-i="${i}"></button>`).join("");
const stages = [...$pista.querySelectorAll(".stage")];
stages.forEach((st, i) => montar(st, renderSlide({ bloque: "01", ...LAMINAS[i].s }, { ...base, ...(LAMINAS[i].ctx || {}) })));
addEventListener("resize", () => stages.forEach(encajar));

let actual = 0, auto = null;
function ir(i) {
  actual = (i + LAMINAS.length) % LAMINAS.length;
  $pista.style.transform = `translateX(${-actual * 100}%)`;
  $puntos.querySelectorAll("button").forEach((b, k) => b.classList.toggle("sel", k === actual));
}
const reanudar = () => { clearInterval(auto); auto = setInterval(() => ir(actual + 1), 6500); };
document.getElementById("car-ant").onclick = () => { ir(actual - 1); reanudar(); };
document.getElementById("car-sig").onclick = () => { ir(actual + 1); reanudar(); };
$puntos.onclick = (ev) => { const b = ev.target.closest("[data-i]"); if (b) { ir(+b.dataset.i); reanudar(); } };
// deslizar con el dedo
let x0 = null;
$pista.addEventListener("pointerdown", (ev) => (x0 = ev.clientX));
$pista.addEventListener("pointerup", (ev) => { if (x0 == null) return; const d = ev.clientX - x0; if (Math.abs(d) > 40) { ir(actual + (d < 0 ? 1 : -1)); reanudar(); } x0 = null; });
document.addEventListener("keydown", (ev) => { if (ev.target.closest?.("input")) return; if (ev.key === "ArrowRight") { ir(actual + 1); reanudar(); } if (ev.key === "ArrowLeft") { ir(actual - 1); reanudar(); } });
document.addEventListener("visibilitychange", () => (document.hidden ? clearInterval(auto) : reanudar()));
ir(0);
reanudar();

// ---------- comenzar: con Google, a «Mis presentaciones» ----------
let usuario = await usuarioActual();
const conGoogle = (u) => !!u && !u.isAnonymous;
const $btn = document.getElementById("comenzar"), $nota = document.getElementById("nota-login");
const pintarBoton = () => {
  $btn.textContent = conGoogle(usuario) ? "ir a mis presentaciones →" : "comenzar →";
  $nota.textContent = conGoogle(usuario) ? `Entraste como ${usuario.email}.` : "Entrás con tu cuenta de Google.";
};
onAuthStateChanged(auth, (u) => { usuario = u; pintarBoton(); });
pintarBoton();
$btn.onclick = async () => {
  if (!conGoogle(usuario)) {
    try { usuario = await entrarGoogle(); }
    catch (e) { if (e?.code !== "auth/popup-closed-by-user") $nota.textContent = "No se pudo entrar: " + (e?.message || e); return; }
  }
  location.href = "/presentaciones";
};

// ---------- participantes: entrar con un código ----------
document.getElementById("fcodigo").onsubmit = (ev) => {
  ev.preventDefault();
  const c = document.getElementById("codigo").value.trim().replace(/^https?:\/\/[^/]+\//, "").replace(/[^\w-]/g, "");
  if (c) location.href = `/${encodeURIComponent(c)}`;
};
