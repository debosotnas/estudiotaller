// Campos del editor de diapositivas: etiquetas en lenguaje normal y el control adecuado para cada dato.
import { esc } from "./slides.js";

const ETIQUETAS = {
  etiqueta: "Etiqueta", titulo: "Título", subtitulo: "Subtítulo", pie: "Pie",
  frase: "Frase", apoyo: "Texto de apoyo", ilustracion: "Ilustración",
  rotulos_ilustracion: "Rótulos de la escalera", escalones_ia: "Escalones de abajo", escalones_altos: "Escalones de arriba",
  pregunta: "Pregunta", opciones: "Opciones", nombre_caso: "Nombre del caso", texto: "Texto", remate: "Remate",
  valores: "Cifras", valor: "Valor", proporcion: "Largo de la barra", color: "Color", fuente: "Fuente",
  columnas: "Columnas", items: "Ítems", detalle: "Detalle", tarjetas: "Tarjetas", rotulo: "Rótulo",
  disposicion: "Disposición", grupo: "Grupo", pregunta_partida: "Pregunta del grupo", y_si: "«¿Y si…?»",
  encabezado: "Encabezado", consigna: "Consigna para la IA", referencia: "Referencia", version: "Versión",
  renglones: "Renglones", preguntas: "Preguntas", url: "Enlace del QR", rotulo_qr: "Texto bajo el QR",
};
const AYUDAS = {
  opciones: "hasta 3; una por línea", proporcion: "de 0 a 1 (0.5 = media barra)", y_si: "uno por línea", preguntas: "una por línea · vacío = solo el QR",
  detalle: "opcional", renglones: "cuántas líneas para completar", url: "a dónde lleva el código", fuente: "se muestra como «fuente: …»",
};
const COLORES = [["lima", "lima"], ["fucsia", "fucsia"], ["celeste", "celeste"], ["verde", "verde"], ["naranja", "naranja (IA)"], ["texto", "blanco"], ["texto_secundario", "gris"]];
const SELECTS = {
  ilustracion: [["", "ninguna"], ["escalera", "escalera"]],
  disposicion: [["", "grilla de 2 × 2"], ["columnas", "4 columnas en fila"]],
  grupo: [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]],
  color: COLORES,
};
// Campos que pueden ser texto o lista (se alterna con un botón)
const TEXTO_O_LISTA = new Set(["apoyo", "pie"]);
// Campos que no se editan acá (o se editan con otros controles)
export const OCULTOS = new Set(["id", "n", "rev", "bloque", "plantilla", "notas", "pasos", "oculta"]);

const largo = (v) => String(v ?? "").length > 50 || String(v ?? "").includes("\n");
const etiqueta = (k, extra = "") => `<span class="rotulo">${esc(ETIQUETAS[k] || k.replace(/_/g, " "))}${AYUDAS[k] ? ` <span class="sec">· ${esc(AYUDAS[k])}</span>` : ""}${extra}</span>`;

export function campo(path, k, v) {
  const alternar = TEXTO_O_LISTA.has(k) && (typeof v === "string" || Array.isArray(v))
    ? ` <button class="mini-txt" data-alternar="${path}">${Array.isArray(v) ? "→ texto" : "→ lista"}</button>` : "";
  if (SELECTS[k]) {
    const ops = SELECTS[k].some(([val]) => val === (v ?? "")) ? SELECTS[k] : [...SELECTS[k], [v, v]];
    return `<label class="ed-campo">${etiqueta(k)}<select data-path="${path}" data-tipo="sel">${ops.map(([val, txt]) => `<option value="${esc(val)}" ${val === (v ?? "") ? "selected" : ""}>${esc(txt)}</option>`).join("")}</select></label>`;
  }
  if (typeof v === "number") return `<label class="ed-campo">${etiqueta(k)}<input type="number" step="any" data-path="${path}" data-tipo="num" value="${esc(v)}"></label>`;
  if (typeof v === "boolean") return `<label class="ed-campo">${etiqueta(k)}<input type="checkbox" data-path="${path}" data-tipo="bool" ${v ? "checked" : ""}></label>`;
  if (Array.isArray(v) && v.every((x) => typeof x === "string"))
    return `<label class="ed-campo">${etiqueta(k, alternar)}<textarea rows="${Math.max(2, v.length + 1)}" data-path="${path}" data-tipo="lineas">${esc(v.join("\n"))}</textarea></label>`;
  if (v && typeof v === "object" && !Array.isArray(v))
    return `<div class="ed-grupo">${etiqueta(k)}<div class="ed-item">${Object.entries(v).map(([k2, v2]) => campo(`${path}.${k2}`, k2, v2)).join("")}</div></div>`;
  if (Array.isArray(v)) {
    return `<div class="ed-grupo">${etiqueta(k)}${v.map((o, i) => `<div class="ed-item"><div class="ed-item-cab"><span class="mono lima">${String(i + 1).padStart(2, "0")}</span><button class="btn peligro chico" data-quitar="${path}" data-i="${i}">quitar</button></div>
      ${Object.entries(o).map(([k2, v2]) => campo(`${path}.${i}.${k2}`, k2, v2)).join("")}</div>`).join("")}
      <button class="btn sec-btn chico" data-agregar="${path}">+ agregar</button></div>`;
  }
  return `<label class="ed-campo">${etiqueta(k, alternar)}<textarea rows="${largo(v) ? 3 : 1}" data-path="${path}" data-tipo="${v === null ? "null" : "txt"}">${esc(v ?? "")}</textarea></label>`;
}

// Valor nuevo de un control del editor
export function valorDe(el) {
  const t = el.dataset.tipo;
  if (t === "num") return parseFloat(el.value) || 0;
  if (t === "bool") return el.checked;
  if (t === "lineas") return el.value.split("\n").filter((x) => x.trim());
  if (t === "null" && !el.value) return null;
  return el.value;
}
