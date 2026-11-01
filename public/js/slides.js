// Dibuja las diapositivas del JSON (estilo «Señal») en HTML, sobre un lienzo de 1920×1080.
// Las posiciones salen de plantilla.plantillas y de gen.js: 1 in = 144 px, 1 pt = 2 px.
import qrcode from "../vendor/qrcode.mjs";
import { svgPizarron } from "./pizarron-comun.js";

const IN = 144, PT = 2, M = 0.7, W = 11.933;
const px = (inches) => `${(inches * IN).toFixed(1)}px`;

let T = null; // plantilla
// Temas: "oscuro" usa los colores de la plantilla; "claro" es su contraparte, con acentos oscurecidos para leerse sobre blanco
export const TEMAS = {
  oscuro: null,
  claro: {
    fondo: "#F5F5EF", superficie: "#E8EAE2", linea: "#C8CDC2", texto: "#0B0D0F", texto_secundario: "#4A545E",
    lima: "#4F7300", fucsia: "#C4006D", celeste: "#00799A", verde: "#00843D", naranja: "#C25200", texto_sobre_acento: "#FFFFFF",
  },
  papel: {
    fondo: "#F3EEE4", superficie: "#E7DFD1", linea: "#CFC4B2", texto: "#2A2520", texto_secundario: "#6B6157",
    lima: "#B4532A", fucsia: "#8E3B5E", celeste: "#2F6E8E", verde: "#4E7A38", naranja: "#C27A1A", texto_sobre_acento: "#FFFFFF",
  },
  noche: {
    fondo: "#0B1220", superficie: "#16213A", linea: "#2A3A5C", texto: "#F4F6FA", texto_secundario: "#A8B3C7",
    lima: "#7CE3FF", fucsia: "#FF7AB6", celeste: "#9D8CFF", verde: "#5EEA9A", naranja: "#FFB454", texto_sobre_acento: "#0B1220",
  },
};
export const TEMAS_NOMBRES = { oscuro: "Señal oscuro", claro: "Señal claro", papel: "Papel", noche: "Noche" };
let paleta = null;
export function usarTema(nombre) { paleta = TEMAS[nombre] || null; }
export const col = (k) => paleta?.[k] ?? (T && T.colores[k] ? T.colores[k].hex : k);
const VARS_CSS = { fondo: "--fondo", superficie: "--superficie", linea: "--linea", texto: "--texto", texto_secundario: "--texto-secundario", lima: "--lima", fucsia: "--fucsia", celeste: "--celeste", verde: "--verde", naranja: "--naranja", texto_sobre_acento: "--sobre-acento" };
export const colorGrupo = (g) => col(T.grupos[g].color);

export async function cargarTaller() {
  const [taller, actividades] = await Promise.all([
    fetch("/data/taller_ia_slides.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch("/data/actividades.json", { cache: "no-cache" }).then((r) => r.json()),
  ]);
  T = taller.plantilla;
  const bloques = Object.fromEntries(taller.contenido.bloques.map((b) => [b.id, b]));
  return { taller, actividades, plantilla: T, bloques, diapositivas: taller.contenido.diapositivas };
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// **x** = resaltado, *x* = cursiva, \n = salto
export function md(str) {
  return esc(str)
    .replace(/\*\*([^*]+)\*\*/g, '<span class="hl">$1</span>')
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}
export const sinMarcas = (str) => String(str ?? "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");

// Título corto de una diapositiva (para índices y listas)
export function tituloDe(s) {
  if (s.plantilla === "libre") return sinMarcas((s.elementos || []).find((e) => e.tipo === "texto" && !e.rol)?.texto || "(libre)").replace(/\n/g, " ");
  const t = s.titulo || s.frase || s.pregunta || s.nombre_caso || s.encabezado || s.referencia || s.pregunta_partida || "";
  return sinMarcas(t).replace(/\n/g, " ");
}

export function qrSvg(text) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="#000"/></svg>`;
}

// ---------- primitivas ----------
// PASO: en qué paso aparece lo que se dibuja (0 = desde el principio). Ver conPaso().
let PASO = 0;
function conPaso(k, fn) {
  const antes = PASO;
  PASO = k;
  fn();
  PASO = antes;
}
function marcar(d) {
  if (PASO > 0) d.dataset.paso = PASO;
  return d;
}
function tb(sl, o, html) {
  const d = document.createElement("div");
  d.className = ["tb", o.cls, o.valign === "middle" && "mid", o.valign === "bottom" && "bot", o.align === "center" && "center", o.align === "right" && "right", o.mono && "mono", o.bold && "b"].filter(Boolean).join(" ");
  Object.assign(d.style, { left: px(o.x), top: px(o.y), width: px(o.w), height: px(o.h), fontSize: `${o.size * PT}px`, color: col(o.color || "texto") });
  if (o.lh) d.style.lineHeight = o.lh;
  if (o.campo) d.dataset.campo = o.campo; // a qué dato pertenece (para editar en el lugar)
  if (o.rol) d.dataset.rol = o.rol;       // etiqueta de bloque o número: automáticos
  if (o.el) d.dataset.el = o.el;          // elemento de una diapositiva libre
  const inner = document.createElement("div");
  inner.innerHTML = html;
  d.appendChild(inner);
  sl.appendChild(marcar(d));
  return d;
}
function rect(sl, x, y, w, h, fill, borde) {
  const d = document.createElement("div");
  d.className = "r";
  Object.assign(d.style, { left: px(x), top: px(y), width: px(w), height: px(h), boxSizing: "border-box" });
  if (fill) d.style.background = col(fill);
  if (borde) d.style.border = borde;
  sl.appendChild(marcar(d));
  return d;
}
const borde = (pt, c, estilo = "solid") => `${pt * PT}px ${estilo} ${col(c)}`;
const nn = (i) => String(i + 1).padStart(2, "0");

function chrome(sl, s, ctx) {
  const b = ctx.bloques[s.bloque];
  if (b) tb(sl, { rol: "bloque", x: M, y: 0.45, w: 9, h: 0.4, mono: true, size: 16, color: "lima" }, esc(`// ${b.id} · ${b.nombre}`));
  if (ctx.numero) tb(sl, { rol: "numero", x: 11.13, y: 6.85, w: 1.5, h: 0.35, mono: true, size: 12, color: "texto_secundario", align: "right" }, `${ctx.numero} / ${ctx.total}`);
}
function franja(sl) {
  const cs = ["lima", "fucsia", "celeste", "verde"], gap = 0.08, w = (W - gap * 3) / 4;
  cs.forEach((c, i) => rect(sl, M + i * (w + gap), 6.55, w, 0.09, c));
}
// Texto de apoyo; si es lista, cada línea con '→ '. desde: primer paso de las líneas (0 = sin pasos)
function apoyo(sl, a, box, desde = 0) {
  if (!a) return;
  if (Array.isArray(a)) {
    const html = a.map((l, i) => `<div style="margin-bottom:12px"${desde ? ` data-paso="${desde + i}"` : ""}><span class="flecha">→ </span>${md(l)}</div>`).join("");
    tb(sl, { size: 24, ...box, color: "texto_secundario" }, html);
  } else conPaso(desde, () => tb(sl, { campo: "apoyo", size: 24, ...box, color: "texto_secundario" }, md(a)));
}

// ---------- plantillas (mismo orden y medidas que gen.js) ----------
const R = {
  portada(sl, s) {
    tb(sl, { campo: "etiqueta", x: M, y: 0.7, w: W, h: 0.45, mono: true, size: 18, color: "lima" }, esc(s.etiqueta));
    tb(sl, { campo: "titulo", x: M, y: 1.7, w: W, h: 2.7, size: 72, bold: true, valign: "bottom", lh: 1.05 }, `${md(s.titulo)}<span class="cursor blink">_</span>`);
    conPaso(1, () => {
      tb(sl, { campo: "subtitulo", x: M, y: 4.55, w: W, h: 0.6, size: 26, color: "texto_secundario" }, esc(s.subtitulo));
      tb(sl, { campo: "pie", x: M, y: 5.85, w: W, h: 0.45, mono: true, size: 16, color: "texto_secundario" }, esc(s.pie));
    });
    franja(sl);
  },
  frase(sl, s, ctx) {
    chrome(sl, s, ctx);
    const esca = s.ilustracion === "escalera", w = esca ? 7.0 : W;
    tb(sl, { campo: "frase", x: M, y: 1.4, w, h: 2.8, size: 44, bold: true, valign: "bottom", lh: 1.15 }, md(s.frase));
    apoyo(sl, s.apoyo, esca ? { x: M, y: 4.4, w: 7.0, h: 2.0, size: 22, lh: 1.3 } : { x: M, y: 4.5, w, h: 1.9 }, 1);
    if (esca) {
      const sw = 0.9, sh = 0.75, x0 = 8.2, yb = 6.3;
      const pasoEsc = (Array.isArray(s.apoyo) ? s.apoyo.length : s.apoyo ? 1 : 0) + 1;
      conPaso(pasoEsc, () => {
        for (let i = 0; i < 5; i++) {
          const h = sh * (i + 1);
          if (i < 2) rect(sl, x0 + i * sw, yb - h, sw - 0.08, h, null, borde(2, "naranja", "dashed"));
          else rect(sl, x0 + i * sw, yb - h, sw - 0.08, h, "lima");
        }
        // Rótulos opcionales: debajo de los escalones de la IA y encima del más alto
        const rot = s.rotulos_ilustracion || {};
        if (rot.escalones_ia) tb(sl, { campo: "rotulos_ilustracion.escalones_ia", x: x0 + sw - 1.1, y: 6.35, w: 2.2, h: 0.4, mono: true, size: 14, color: "naranja", align: "center" }, esc(rot.escalones_ia));
        if (rot.escalones_altos) tb(sl, { campo: "rotulos_ilustracion.escalones_altos", x: x0, y: yb - sh * 5 - 0.45, w: 5 * sw - 0.08, h: 0.4, mono: true, size: 14, color: "lima", align: "right" }, esc(rot.escalones_altos));
      });
    }
  },
  pregunta(sl, s, ctx) {
    chrome(sl, s, ctx);
    const op = s.opciones && s.opciones.length ? s.opciones : null;
    tb(sl, { campo: "pregunta", x: M, y: op ? 1.3 : 1.4, w: W, h: op ? 2.3 : 3.6, size: op ? 48 : 40, bold: true, valign: op ? "bottom" : "middle", lh: 1.3, cls: "hl-marker" }, md(s.pregunta));
    if (op) conPaso(1, () => {
      const v = ctx.act && ctx.act.tipo === "votacion" && ctx.revelar ? ctx.res : null;
      const gap = 0.3, w = (W - gap * (op.length - 1)) / op.length;
      const max = v ? Math.max(...v.conteos) : 0;
      op.forEach((o, i) => {
        const x = M + i * (w + gap);
        const gana = v && max > 0 && v.conteos[i] === max;
        rect(sl, x, 3.95, w, 1.15, null, borde(2, gana ? "lima" : "texto"));
        if (!v) {
          tb(sl, { campo: `opciones.${i}`, x, y: 3.95, w, h: 1.15, mono: true, size: 30, align: "center", valign: "middle" }, esc(o));
          return;
        }
        const n = v.conteos[i] || 0, p = v.total ? n / v.total : 0;
        tb(sl, { x: x + 0.3, y: 3.95, w: w - 0.6, h: 0.8, mono: true, size: 30, valign: "middle", color: gana ? "lima" : "texto" }, esc(o));
        tb(sl, { x: x + 0.3, y: 3.95, w: w - 0.6, h: 0.8, size: 40, bold: true, valign: "middle", align: "right", color: gana ? "lima" : "texto" }, `${Math.round(p * 100)}%`);
        rect(sl, x + 0.3, 4.78, w - 0.6, 0.12, "linea");
        const bar = rect(sl, x + 0.3, 4.78, 0, 0.12, gana ? "lima" : "texto");
        bar.classList.add("anim-w");
        requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = px((w - 0.6) * p))));
      });
    });
    if (s.apoyo) conPaso(op ? 2 : 1, () => tb(sl, { campo: "apoyo", x: M, y: op ? 5.55 : 5.3, w: W, h: 0.9, size: 26, color: "texto_secundario" }, md(s.apoyo)));
  },
  caso(sl, s, ctx) {
    chrome(sl, s, ctx);
    rect(sl, M, 1.25, 1.2, 0.42, "lima");
    tb(sl, { x: M, y: 1.25, w: 1.2, h: 0.42, mono: true, size: 16, color: "texto_sobre_acento", align: "center", valign: "middle" }, "CASO");
    tb(sl, { campo: "nombre_caso", x: M, y: 1.9, w: W, h: 1.0, size: 40, bold: true, color: "lima" }, esc(s.nombre_caso));
    conPaso(1, () => tb(sl, { campo: "texto", x: M, y: 3.05, w: 11.2, h: 2.4, size: 26, lh: 1.4 }, md(s.texto)));
    conPaso(2, () => tb(sl, { campo: "remate", x: M, y: 5.55, w: W, h: 0.9, size: 30, bold: true, color: "lima" }, md(s.remate)));
  },
  dato(sl, s, ctx) {
    chrome(sl, s, ctx);
    tb(sl, { campo: "titulo", x: M, y: 1.2, w: W, h: 0.8, size: 30, bold: true }, md(s.titulo));
    s.valores.forEach((v, i) => conPaso(i + 1, () => {
      const x = M + i * 6.2;
      tb(sl, { campo: `valores.${i}.valor`, x, y: 2.05, w: 5.6, h: 1.6, size: 96, bold: true, color: v.color, valign: "bottom", lh: 1 }, esc(v.valor));
      rect(sl, x, 3.8, 5.0, 0.16, "linea");
      rect(sl, x, 3.8, 5.0 * (+v.proporcion || 0), 0.16, v.color);
      tb(sl, { campo: `valores.${i}.etiqueta`, x, y: 4.1, w: 5.6, h: 0.5, mono: true, size: 18, color: "texto_secundario" }, esc(v.etiqueta));
    }));
    conPaso(s.valores.length + 1, () => {
      tb(sl, { campo: "texto", x: M, y: 5.05, w: W, h: 0.9, size: 26, bold: true }, md(s.texto));
      tb(sl, { x: M, y: 6.3, w: 9.6, h: 0.4, mono: true, size: 12, color: "texto_secundario" }, esc("fuente: " + s.fuente));
    });
  },
  dato_columnas(sl, s, ctx) {
    chrome(sl, s, ctx);
    tb(sl, { campo: "titulo", x: M, y: 1.2, w: W, h: 0.8, size: 30, bold: true }, md(s.titulo));
    s.columnas.forEach((c, i) => conPaso(i + 1, () => {
      const x = M + i * 6.1, y = 2.1, w = 5.8, h = 3.05;
      rect(sl, x, y, w, h, "superficie", borde(2, c.color));
      tb(sl, { campo: `columnas.${i}.titulo`, x: x + 0.35, y: y + 0.3, w: w - 0.7, h: 0.4, mono: true, size: 18, color: c.color }, esc(c.titulo));
      tb(sl, { campo: `columnas.${i}.valor`, x: x + 0.35, y: y + 0.75, w: w - 0.7, h: 0.9, size: 48, bold: true, color: c.color }, esc(c.valor));
      tb(sl, { campo: `columnas.${i}.texto`, x: x + 0.35, y: y + 1.75, w: w - 0.7, h: 1.15, size: 22, lh: 1.3 }, md(c.texto));
    }));
    conPaso(s.columnas.length + 1, () => {
      tb(sl, { campo: "pregunta", x: M, y: 5.45, w: W, h: 0.8, size: 30, bold: true, color: "lima" }, md(s.pregunta));
      if (s.fuente) tb(sl, { x: M, y: 6.3, w: 9.6, h: 0.4, mono: true, size: 12, color: "texto_secundario" }, esc("fuente: " + s.fuente));
    });
  },
  lista(sl, s, ctx) {
    chrome(sl, s, ctx);
    tb(sl, { campo: "titulo", x: M, y: 1.2, w: W, h: 0.9, size: 36, bold: true }, md(s.titulo));
    const n = s.items.length, top = 2.35, area = s.pie ? 3.7 : 3.95, rh = Math.min(1.25, area / Math.max(1, n));
    s.items.forEach((it, i) => conPaso(i + 1, () => {
      const y = top + i * rh;
      rect(sl, M, y, W, 0.012, "linea");
      tb(sl, { x: M, y: y + 0.17, w: 0.9, h: 0.5, mono: true, size: 22, color: "lima" }, nn(i));
      if (it.detalle) {
        tb(sl, { campo: `items.${i}.texto`, x: M + 0.9, y: y + 0.12, w: W - 0.9, h: 0.55, size: 26, bold: true }, md(it.texto));
        tb(sl, { campo: `items.${i}.detalle`, x: M + 0.9, y: y + 0.62, w: W - 0.9, h: rh - 0.65, size: 20, color: "texto_secundario" }, md(it.detalle));
      } else {
        tb(sl, { campo: `items.${i}.texto`, x: M + 0.9, y: y + 0.12, w: W - 0.9, h: rh - 0.2, size: 26, bold: true }, md(it.texto));
      }
    }));
    if (s.pie) conPaso(n + 1, () => tb(sl, { campo: "pie", x: M, y: 6.3, w: W, h: 0.4, mono: true, size: 14, color: "texto_secundario" }, md(s.pie)));
  },
  lista_doble(sl, s, ctx) {
    chrome(sl, s, ctx);
    tb(sl, { campo: "titulo", x: M, y: 1.2, w: W, h: 0.9, size: 36, bold: true }, md(s.titulo));
    const filas = Math.max(4, Math.ceil(s.items.length / 2)), cw = (W - 0.3) / 2;
    const paso = 4.3 / filas, gap = Math.min(0.17, paso * 0.18), ch = paso - gap;
    s.items.forEach((t, i) => conPaso(i + 1, () => {
      const c = Math.floor(i / filas), r = i % filas, x = M + c * (cw + 0.3), y = 2.3 + r * (ch + gap);
      rect(sl, x, y, cw, ch, "superficie");
      tb(sl, { x: x + 0.25, y, w: 0.8, h: ch, mono: true, size: 24, color: "lima", valign: "middle" }, nn(i));
      tb(sl, { campo: `items.${i}`, x: x + 1.05, y, w: cw - 1.25, h: ch, size: filas > 4 ? 20 : 22, bold: true, valign: "middle", lh: filas > 4 ? 1.1 : undefined }, md(t));
    }));
  },
  grupos(sl, s, ctx) {
    chrome(sl, s, ctx);
    tb(sl, { campo: "titulo", x: M, y: 1.2, w: W, h: 0.9, size: 34, bold: true }, md(s.titulo));
    if (ctx.act && ctx.act.tipo === "clasificar" && ctx.revelar) return matrizClasificar(sl, ctx.act, ctx.res, 2.45);
    const cols = s.disposicion === "columnas";
    s.tarjetas.forEach((t, i) => conPaso(i + 1, () => {
      let x, y, w, h;
      if (cols) { w = (W - 0.9) / 4; h = 1.9; x = M + i * (w + 0.3); y = 2.3; }
      else { w = (W - 0.3) / 2; h = 1.75; x = M + (i % 2) * (w + 0.3); y = 2.25 + Math.floor(i / 2) * (h + 0.3); }
      rect(sl, x, y, w, h, "superficie");
      rect(sl, x, y, 0.12, h, t.color);
      tb(sl, { campo: `tarjetas.${i}.rotulo`, x: x + 0.35, y: y + 0.2, w: w - 0.5, h: 0.4, mono: true, size: 18, color: t.color }, esc(t.rotulo));
      tb(sl, { campo: `tarjetas.${i}.texto`, x: x + 0.35, y: y + 0.62, w: w - 0.55, h: h - 0.75, size: cols ? 22 : 20, bold: true, lh: 1.25 }, md(t.texto));
    }));
    const k = s.tarjetas.length + 1;
    if (Array.isArray(s.pie)) apoyo(sl, s.pie, { x: M, y: 4.5, w: W, h: 1.9 }, k);
    else if (s.pie) conPaso(k, () => tb(sl, { campo: "pie", x: M, y: 6.2, w: 10, h: 0.5, size: 20, color: "texto_secundario" }, md(s.pie)));
  },
  grupo(sl, s, ctx) {
    const g = T.grupos[s.grupo] || { color: "lima" };
    rect(sl, 0, 0, 13.333, 0.14, g.color);
    chrome(sl, s, ctx);
    tb(sl, { x: M, y: 1.2, w: W, h: 0.6, mono: true, size: 22, color: g.color }, esc(`GRUPO ${s.grupo}`));
    tb(sl, { campo: "pregunta_partida", x: M, y: 1.85, w: W, h: 1.5, size: 36, bold: true, lh: 1.15 }, md(s.pregunta_partida));
    s.y_si.forEach((t, i) => conPaso(i + 1, () => {
      const y = 3.6 + i * 0.95;
      rect(sl, M, y, W, 0.012, "linea");
      tb(sl, { x: M, y: y + 0.18, w: 0.8, h: 0.5, mono: true, size: 20, color: g.color }, nn(i));
      tb(sl, { campo: `y_si.${i}`, x: M + 0.8, y: y + 0.12, w: W - 0.8, h: 0.8, size: 22, lh: 1.3 }, md(t));
    }));
  },
  ia(sl, s, ctx) {
    chrome(sl, s, ctx);
    tb(sl, { campo: "encabezado", x: M, y: 1.2, w: W, h: 0.9, size: 36, bold: true, color: "lima" }, md(s.encabezado));
    const x = M, y = 2.4, w = W, h = 3.2;
    rect(sl, x, y, w, h, "superficie", borde(2.5, "naranja"));
    rect(sl, x, y + 0.45, w, 0.015, "linea");
    ["naranja", "linea", "linea"].forEach((c, i) => {
      const o = rect(sl, x + 0.25 + i * 0.25, y + 0.155, 0.14, 0.14, c);
      o.style.borderRadius = "50%";
    });
    tb(sl, { x: x + 1.1, y: y + 0.08, w: 2, h: 0.3, mono: true, size: 14, color: "texto_secundario" }, "chat");
    tb(sl, { x: x + 0.45, y: y + 0.85, w: w - 0.9, h: 2.0, mono: true, size: 30, valign: "middle" },
      `<span style="color:${col("naranja")}">&gt; </span>${esc(s.consigna)}<span class="blink" style="color:${col("naranja")}"> ▍</span>`);
    conPaso(1, () => tb(sl, { campo: "pie", x: M, y: 5.9, w: W, h: 0.6, size: 20, color: "texto_secundario" }, md(s.pie)));
  },
  texto_biblico(sl, s, ctx) {
    chrome(sl, s, ctx);
    tb(sl, { campo: "referencia", x: M, y: 1.2, w: 8, h: 0.7, size: 30, bold: true, color: "lima" }, esc(s.referencia));
    tb(sl, { campo: "version", x: 9.63, y: 1.3, w: 3, h: 0.5, mono: true, size: 16, color: "texto_secundario", align: "right" }, esc(s.version));
    conPaso(1, () => tb(sl, { campo: "texto", x: M, y: 2.15, w: W, h: 4.3, size: 32, lh: 1.5, cls: "hl-bold" }, md(s.texto)));
  },
  en_vivo(sl, s, ctx) {
    chrome(sl, s, ctx);
    rect(sl, M, 1.2, 2.0, 0.42, "lima");
    tb(sl, { x: M, y: 1.2, w: 2.0, h: 0.42, mono: true, size: 16, color: "texto_sobre_acento", align: "center", valign: "middle" }, "● EN VIVO");
    tb(sl, { campo: "titulo", x: M, y: 1.85, w: W, h: 0.9, size: 36, bold: true }, md(s.titulo));
    const muro = ctx.muro || [];
    const n = Math.min(8, Math.max(+s.renglones || 1, muro.length)), step = 3.3 / n;
    const size = n <= 5 ? 24 : n <= 6 ? 20 : 16;
    for (let i = 0; i < n; i++) {
      const y = 3.05 + (i + 1) * step - 0.05;
      rect(sl, M + 0.6, y, W - 0.6, 0.012, "linea");
      tb(sl, { x: M, y: y - 0.38, w: 0.5, h: 0.35, mono: true, size: 14, color: "texto_secundario" }, nn(i));
      if (muro[i]) {
        const t = tb(sl, { x: M + 0.6, y: y - step + 0.06, w: W - 0.6, h: step - 0.1, size, valign: "bottom", lh: 1.2 }, esc(muro[i]));
        t.firstChild.style.cssText = "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden";
      }
    }
  },
  qr(sl, s, ctx) {
    chrome(sl, s, ctx);
    const url = ctx.joinUrl || s.url;
    const preguntas = s.preguntas || [];
    const solo = !preguntas.length;
    // Solo QR: centrado y grande. Con preguntas: QR a la izquierda (como en gen.js).
    const lado = solo ? 5.4 : 4.6, qx = solo ? (13.333 - lado) / 2 : M, qy = solo ? 1.05 : 1.3;
    if (url) {
      const q = rect(sl, qx, qy, lado, lado, null);
      q.classList.add("qrbox");
      q.style.padding = px(0.15);
      q.innerHTML = qrSvg(url);
    } else {
      rect(sl, qx, qy, lado, lado, null, borde(2, "lima", "dashed"));
      tb(sl, { x: qx, y: qy, w: lado, h: lado, mono: true, size: 40, color: "lima", align: "center", valign: "middle" }, "QR");
    }
    if (solo) return;
    tb(sl, { campo: "titulo", x: 5.8, y: 1.3, w: 6.83, h: 0.8, size: 32, bold: true }, md(s.titulo));
    preguntas.forEach((p, i) => conPaso(i + 1, () => {
      const y = 2.35 + i * 1.2;
      rect(sl, 5.8, y, 6.83, 0.012, "linea");
      tb(sl, { x: 5.8, y: y + 0.18, w: 0.7, h: 0.4, mono: true, size: 20, color: "lima" }, nn(i));
      tb(sl, { campo: `preguntas.${i}`, x: 6.5, y: y + 0.12, w: 6.13, h: 1.0, size: 22, lh: 1.3 }, md(p));
    }));
    if (url) tb(sl, { x: 5.8, y: 6.0, w: 6.83, h: 0.4, mono: true, size: 16, color: "texto_secundario" }, esc(url.replace(/^https?:\/\//, "")));
    if (s.pie) tb(sl, { campo: "pie", x: M, y: 6.25, w: 4.6, h: 0.45, mono: true, size: 16, color: "lima" }, md(s.pie));
  },
  recursos(sl, s, ctx) {
    chrome(sl, s, ctx);
    tb(sl, { campo: "titulo", x: M, y: 1.2, w: 8.2, h: 0.8, size: 32, bold: true }, md(s.titulo));
    const n = s.items.length, rh = Math.min(0.72, 4.3 / Math.max(1, n));
    s.items.forEach((it, i) => conPaso(i + 1, () => {
      const y = 2.1 + i * rh;
      rect(sl, M, y, 8.2, 0.012, "linea");
      tb(sl, { campo: `items.${i}.texto`, x: M, y: y + 0.08, w: 8.2, h: 0.32, size: 18, bold: true, lh: 1.15 }, md(it.texto));
      if (it.detalle) tb(sl, { campo: `items.${i}.detalle`, x: M, y: y + 0.38, w: 8.2, h: rh - 0.4, size: 15, color: "texto_secundario", lh: 1.15 }, md(it.detalle));
    }));
    if (s.url) {
      const q = rect(sl, 9.4, 1.3, 3.2, 3.2, null);
      q.classList.add("qrbox");
      q.style.padding = px(0.12);
      q.innerHTML = qrSvg(s.url);
      if (s.rotulo_qr) tb(sl, { campo: "rotulo_qr", x: 9.1, y: 4.7, w: 3.8, h: 0.4, mono: true, size: 16, color: "lima", align: "center" }, esc(s.rotulo_qr));
      tb(sl, { x: 9.1, y: 5.1, w: 3.8, h: 0.7, mono: true, size: 14, color: "texto_secundario", align: "center", lh: 1.2 }, esc(s.url.replace(/^https?:\/\//, "")));
    }
  },
};

// ---------- diapositiva libre: elementos con posición propia (en pulgadas, como el lienzo) ----------
// { id, tipo: 'texto'|'forma'|'imagen'|'qr', x, y, w, h, paso?, rol?: 'bloque'|'numero',
//   texto, size, color, bold, italic, mono, align, valign, lh, resaltado: 'lima'|'marker'|'bold', cursor, fondo, borde: {color, ancho, estilo}, redondo, url, ajuste: 'cubrir'|'contener' }
R.libre = (sl, s, ctx) => (s.elementos || []).forEach((e) => conPaso(+e.paso || 0, () => elemento(sl, e, s, ctx)));
function elemento(sl, e, s, ctx) {
  const bordeDe = (b) => (b ? borde(+b.ancho || 2, b.color || "texto", b.estilo || "solid") : null);
  let d = null;
  if (e.tipo === "texto") {
    let html = md(e.texto);
    if (e.rol === "bloque") { const b = ctx.bloques?.[s.bloque]; if (!b) return; html = esc(`// ${b.id} · ${b.nombre}`); }
    if (e.rol === "numero") { if (!ctx.numero) return; html = `${ctx.numero} / ${ctx.total}`; }
    if (e.cursor) html += `<span class="cursor blink">_</span>`;
    d = tb(sl, { x: e.x, y: e.y, w: e.w, h: e.h, size: +e.size || 24, color: e.color || "texto", bold: e.bold, mono: e.mono, align: e.align, valign: e.valign, lh: e.lh || undefined, cls: { marker: "hl-marker", bold: "hl-bold" }[e.resaltado] }, html);
    if (e.italic) d.style.fontStyle = "italic";
    if (e.fondo) d.style.background = col(e.fondo);
    if (e.borde) { d.style.border = bordeDe(e.borde); d.style.boxSizing = "border-box"; }
  } else if (e.tipo === "forma") {
    d = rect(sl, e.x, e.y, e.w, e.h, e.fondo || null, bordeDe(e.borde));
    if (e.redondo) d.style.borderRadius = "50%";
  } else if (e.tipo === "imagen") {
    d = rect(sl, e.x, e.y, e.w, e.h, null, e.url ? null : borde(2, "linea", "dashed"));
    d.innerHTML = e.url
      ? `<img src="${esc(e.url)}" alt="" referrerpolicy="no-referrer" draggable="false" style="width:100%;height:100%;display:block;object-fit:${e.ajuste === "contener" ? "contain" : "cover"}">`
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:var(--mono);font-size:28px;color:${col("texto_secundario")}">imagen (pegá un enlace)</div>`;
  } else if (e.tipo === "qr") {
    const url = e.url || ctx.joinUrl;
    d = rect(sl, e.x, e.y, e.w, e.h, null, url ? null : borde(2, "lima", "dashed"));
    if (url) { d.classList.add("qrbox"); d.style.padding = px(Math.min(e.w, e.h) * 0.03); d.innerHTML = qrSvg(url); }
  }
  if (d) d.dataset.el = e.id;
}

// Tabla tareas × columnas con los grupos que ubicaron cada tarea en cada columna
function matrizClasificar(sl, act, res, top) {
  const nameW = 5.4, cw = (W - nameW) / act.columnas.length, rowH = Math.min(0.5, (6.6 - top - 0.5) / act.items.length);
  act.columnas.forEach((c, j) => {
    const color = act.colores?.[j] || (j >= 2 ? "lima" : "texto_secundario");
    tb(sl, { x: M + nameW + j * cw, y: top - 0.4, w: cw - 0.1, h: 0.85, mono: true, size: 14, color, valign: "bottom", lh: 1.05 }, `${j + 1} · ${esc(c)}`);
  });
  act.items.forEach((it, i) => {
    const y = top + 0.5 + i * rowH;
    rect(sl, M, y, W, 0.012, "linea");
    tb(sl, { x: M, y, w: 0.6, h: rowH, mono: true, size: rowH < 0.42 ? 14 : 16, color: "lima", valign: "middle" }, nn(i));
    tb(sl, { x: M + 0.6, y, w: nameW - 0.7, h: rowH, size: rowH < 0.42 ? 16 : 18, bold: true, valign: "middle", lh: 1.1 }, esc(it));
    act.columnas.forEach((_, j) => {
      const grupos = Object.keys(res?.celdas?.[i]?.[j] || {}).sort();
      const lado = rowH < 0.42 ? 32 : 40;
      const html = grupos.map((g) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:${lado}px;height:${lado}px;margin-right:8px;background:${T.grupos[g] ? colorGrupo(g) : col("texto")};color:${col("texto_sobre_acento")};font-family:var(--mono);font-size:${lado * 0.6}px;font-weight:700">${esc(g)}</span>`).join("");
      tb(sl, { x: M + nameW + j * cw, y, w: cw, h: rowH, size: 14, valign: "middle" }, html);
    });
  });
}

// Panel genérico de resultados, para actividades cuya diapositiva no tiene un lugar propio
function panelResultados(sl, act, res) {
  rect(sl, 0, 1.0, 13.333, 6.5, "fondo");
  tb(sl, { x: M, y: 1.2, w: W, h: 0.9, size: 34, bold: true }, md(act.pregunta || act.titulo));
  if (act.tipo === "votacion") {
    const max = Math.max(1, ...res.conteos), rh = Math.min(1.0, 4.0 / act.opciones.length);
    act.opciones.forEach((o, i) => {
      const y = 2.35 + i * rh, n = res.conteos[i] || 0, p = res.total ? n / res.total : 0;
      tb(sl, { x: M, y, w: 3.2, h: rh - 0.15, mono: true, size: 24, valign: "middle" }, esc(o));
      rect(sl, M + 3.3, y + (rh - 0.15) / 2 - 0.12, 7.0, 0.24, "linea");
      rect(sl, M + 3.3, y + (rh - 0.15) / 2 - 0.12, 7.0 * (n / max), 0.24, n === max ? "lima" : "texto");
      tb(sl, { x: M + 10.5, y, w: 1.43, h: rh - 0.15, size: 30, bold: true, valign: "middle", align: "right" }, `${Math.round(p * 100)}%`);
    });
  } else if (act.tipo === "clasificar") {
    matrizClasificar(sl, act, res, 2.45);
  } else {
    tb(sl, { x: M, y: 2.4, w: W, h: 2.4, size: 160, bold: true, color: "lima", valign: "bottom", lh: 1 }, String(res?.total ?? 0));
    tb(sl, { x: M, y: 4.9, w: W, h: 0.6, mono: true, size: 24, color: "texto_secundario" }, "respuestas recibidas");
  }
}

function pantallaQR(sl, ctx) {
  const q = rect(sl, M, 0.9, 5.7, 5.7, null);
  q.classList.add("qrbox");
  q.style.padding = px(0.2);
  q.innerHTML = qrSvg(ctx.joinUrl);
  tb(sl, { x: 7.0, y: 1.3, w: 5.6, h: 0.45, mono: true, size: 18, color: "lima" }, "// sumate desde tu celular");
  tb(sl, { x: 7.0, y: 1.9, w: 5.6, h: 2.2, size: 48, bold: true, valign: "bottom", lh: 1.1 }, `Escaneá el código<span class="cursor blink">_</span>`);
  tb(sl, { x: 7.0, y: 4.4, w: 5.6, h: 0.5, size: 22, color: "texto_secundario" }, "o entrá a");
  tb(sl, { x: 7.0, y: 4.9, w: 5.9, h: 1.2, mono: true, size: 28, color: "lima", lh: 1.2 }, esc(ctx.joinUrl.replace(/^https?:\/\//, "")));
  franja(sl);
}

/**
 * Crea el elemento de una diapositiva.
 * ctx: { total, numero, bloques, joinUrl, act, res, revelar, muro, contador, overlay: 'qr'|'negro'|'pizarron'|null, pizarron, paso, tema }
 * paso: si la diapositiva va por pasos (s.pasos), cuántos pasos mostrar (null = todos).
 * El elemento devuelto trae dataset.pasos con la cantidad de pasos que tiene la diapositiva.
 */
export function renderSlide(s, ctx) {
  if (ctx.tema !== undefined) usarTema(ctx.tema);
  const sl = document.createElement("div");
  sl.className = "slide";
  sl.dataset.pasos = 0;
  if (paleta) Object.entries(VARS_CSS).forEach(([k, v]) => sl.style.setProperty(v, paleta[k]));
  if (ctx.overlay === "pizarron") { sl.innerHTML = svgPizarron(ctx.pizarron); return sl; }
  if (ctx.overlay === "qr" && ctx.joinUrl) { pantallaQR(sl, ctx); return sl; }
  if (!s) return sl;
  const fn = R[s.plantilla];
  if (!fn) throw new Error("plantilla desconocida: " + s.plantilla);
  PASO = 0;
  fn(sl, s, ctx);
  const integrada = (s.plantilla === "pregunta" && s.opciones?.length && ctx.act?.tipo === "votacion") || (s.plantilla === "grupos" && ctx.act?.tipo === "clasificar");
  if (ctx.revelar && ctx.act && ctx.res && !integrada) panelResultados(sl, ctx.act, ctx.res);

  const conPasos = [...sl.querySelectorAll("[data-paso]")];
  const total = conPasos.reduce((m, el) => Math.max(m, +el.dataset.paso), 0);
  sl.dataset.pasos = total;
  if (s.pasos && ctx.paso != null && !ctx.revelar) conPasos.forEach((el) => el.classList.toggle("paso-oculto", +el.dataset.paso > ctx.paso));

  if (ctx.contador != null && s.plantilla !== "portada") {
    tb(sl, { x: M, y: 6.85, w: 6, h: 0.35, mono: true, size: 14, color: "lima" }, `<span class="blink">●</span> ${ctx.contador} respuesta${ctx.contador === 1 ? "" : "s"}`);
  }
  if (ctx.overlay === "negro") sl.classList.add("negro");
  return sl;
}

// Cantidad de pasos de una diapositiva (0 si no tiene elementos que se puedan mostrar de a uno)
export function contarPasos(s, ctx) {
  return s ? +renderSlide(s, { ...ctx, paso: null }).dataset.pasos : 0;
}

// Escala la diapositiva para que entre en el escenario, centrada
export function encajar(stage) {
  const sl = stage.querySelector(".slide");
  if (!sl) return;
  // clientWidth/Height (y no getBoundingClientRect) para que funcione aunque el escenario esté girado
  const w = stage.clientWidth, h = stage.clientHeight;
  const k = Math.min(w / 1920, h / 1080);
  sl.style.transform = `translate(${(w - 1920 * k) / 2}px, ${(h - 1080 * k) / 2}px) scale(${k})`;
}

export function montar(stage, slideEl) {
  stage.replaceChildren(slideEl);
  encajar(stage);
}
