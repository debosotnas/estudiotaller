// Diapositivas libres: convertir una diapositiva de plantilla en elementos sueltos, y utilidades del editor.
import { renderSlide, col, TEMAS } from "./slides.js";

const IN = 144, PT = 2;
const r2 = (n) => Math.round(n * 100) / 100;
export const nuevoIdEl = () => "e" + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);

// HTML de un texto editado (o dibujado) → marcas del JSON: **resaltado**, *cursiva*, \n
export function htmlAMarcas(html) {
  const raiz = document.createElement("div");
  raiz.innerHTML = html;
  raiz.querySelectorAll(".cursor, .blink").forEach((e) => e.remove());
  const recorrer = (n) => {
    if (n.nodeType === 3) return n.nodeValue.replace(/ /g, " ");
    if (n.nodeType !== 1) return "";
    const tag = n.tagName.toLowerCase(), dentro = [...n.childNodes].map(recorrer).join("");
    if (tag === "br") return "\n";
    if (tag === "div" || tag === "p") return (n.previousSibling ? "\n" : "") + dentro;
    if (!dentro.trim()) return dentro;
    if (n.classList.contains("hl") || tag === "b" || tag === "strong") return `**${dentro}**`;
    if (tag === "em" || tag === "i") return `*${dentro}*`;
    return dentro;
  };
  return [...raiz.childNodes].map(recorrer).join("").replace(/\n+$/, "");
}

// Color de la pantalla (rgb/hex) → nombre del color del tema si coincide (así un cambio de tema lo recolorea)
function claveDeColor(css, tema) {
  if (!css || css === "transparent" || /rgba\(.*,\s*0\)$/.test(css)) return null;
  const m = css.match(/\d+/g);
  const hex = m ? "#" + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, "0")).join("").toUpperCase() : css.toUpperCase();
  const paleta = TEMAS[tema] || {};
  for (const k of ["texto", "texto_secundario", "lima", "fucsia", "celeste", "verde", "naranja", "superficie", "linea", "fondo", "texto_sobre_acento"])
    if ((paleta[k] || col(k)).toUpperCase() === hex) return k;
  return hex;
}
function bordeDe(st, tema) {
  const w = parseFloat(st.borderTopWidth);
  if (!w || st.borderTopStyle === "none") return null;
  return { ancho: r2(w / PT), estilo: st.borderTopStyle === "dashed" ? "dashed" : "solid", color: claveDeColor(st.borderTopColor, tema) || "texto" };
}

// Convierte una diapositiva de plantilla en «libre», leyendo lo que el motor dibuja: mismo aspecto, todo movible.
export function aLibre(s, ctx) {
  const sl = renderSlide(s, { ...ctx, paso: null, revelar: false, contador: null, muro: null, overlay: null });
  const caja = document.createElement("div");
  Object.assign(caja.style, { position: "fixed", left: "-99999px", top: "0", width: "1920px", height: "1080px" });
  caja.appendChild(sl);
  document.body.appendChild(caja);
  const elementos = [];
  try {
    for (const n of sl.children) {
      const st = getComputedStyle(n);
      const pos = { x: r2(parseFloat(n.style.left) / IN), y: r2(parseFloat(n.style.top) / IN), w: r2(parseFloat(n.style.width) / IN), h: r2(parseFloat(n.style.height) / IN) };
      const base = { id: nuevoIdEl(), ...pos, ...(n.dataset.paso ? { paso: +n.dataset.paso } : {}) };
      if (n.classList.contains("tb")) {
        const inner = n.firstElementChild;
        const e = {
          ...base, tipo: "texto",
          texto: htmlAMarcas(inner.innerHTML),
          size: r2(parseFloat(n.style.fontSize) / PT),
          color: claveDeColor(n.style.color, ctx.tema) || "texto",
        };
        if (n.dataset.rol) e.rol = n.dataset.rol;
        if (n.classList.contains("b")) e.bold = true;
        if (n.classList.contains("mono")) e.mono = true;
        if (n.classList.contains("center")) e.align = "center";
        if (n.classList.contains("right")) e.align = "right";
        if (n.classList.contains("mid")) e.valign = "middle";
        if (n.classList.contains("bot")) e.valign = "bottom";
        if (n.style.lineHeight) e.lh = +n.style.lineHeight;
        if (n.classList.contains("hl-marker")) e.resaltado = "marker";
        if (n.classList.contains("hl-bold")) e.resaltado = "bold";
        if (inner.querySelector(".cursor")) e.cursor = true;
        // listas con flechas (→): cada línea queda como texto con su flecha
        if (inner.querySelector(".flecha")) e.texto = [...inner.children].map((l) => `→ ${htmlAMarcas(l.innerHTML.replace(/<span class="flecha">→ <\/span>/, ""))}`).join("\n");
        if (!e.texto && !e.rol) continue;
        elementos.push(e);
      } else if (n.classList.contains("qrbox")) {
        elementos.push({ ...base, tipo: "qr", url: s.plantilla === "recursos" ? s.url || "" : "" });
      } else if (n.classList.contains("r")) {
        const fondo = claveDeColor(n.style.background || st.backgroundColor, ctx.tema);
        const b = bordeDe(st, ctx.tema);
        if (!fondo && !b) continue;
        elementos.push({ ...base, tipo: "forma", ...(fondo ? { fondo } : {}), ...(b ? { borde: b } : {}), ...(n.style.borderRadius === "50%" ? { redondo: true } : {}) });
      }
    }
  } finally {
    caja.remove();
  }
  const { id, bloque, notas, pasos, oculta } = s;
  return { id, bloque, plantilla: "libre", elementos, ...(notas ? { notas } : {}), ...(pasos ? { pasos } : {}), ...(oculta ? { oculta } : {}) };
}

// Elementos nuevos (centrados en el lienzo de 13.333 × 7.5 in)
export function elementoNuevo(tipo) {
  const id = nuevoIdEl();
  if (tipo === "texto") return { id, tipo, x: 2.67, y: 3.1, w: 8, h: 1.2, texto: "Texto nuevo", size: 36, color: "texto", bold: true };
  if (tipo === "forma") return { id, tipo, x: 5.17, y: 2.75, w: 3, h: 2, fondo: "superficie", borde: { color: "lima", ancho: 2, estilo: "solid" } };
  if (tipo === "imagen") return { id, tipo, x: 3.67, y: 1.75, w: 6, h: 4, url: "", ajuste: "cubrir" };
  if (tipo === "qr") return { id, tipo, x: 4.67, y: 1.75, w: 4, h: 4, url: "" };
}
