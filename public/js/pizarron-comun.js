// Pizarrones: dibujo compartido entre la tablet (dibuja), el proyector y los celulares (miran).
// Todo en coordenadas del lienzo de 1920×1080. Trazos: { c: color, w: grosor, p: [x0, y0, x1, y1, …] }.
// Palabras (pizarrones con texto): { id, t, x, y (línea base), w (ancho), s (tamaño), ref? }.
import { esc, sinMarcas } from "./slides.js";

export const COLORES = { lima: "#D4FF00", fucsia: "#FF2EA6", celeste: "#2EE6FF", verde: "#3DFF8A", blanco: "#FFFFFF" };
export const GROSORES = [4, 8, 16];

// Texto inicial de cada pizarrón (3: RV60, 4: NTV), tomado de las diapositivas
export function textoDePizarron(n, diapos) {
  const id = { 3: "d34", 4: "d35" }[n];
  const s = id && diapos.find((d) => d.id === id);
  return s ? { texto: sinMarcas(s.texto), ref: `${s.referencia} · ${s.version}` } : null;
}

// Reparte el texto en palabras, en un párrafo centrado en el medio del pizarrón
export async function maquetarTexto({ texto, ref }) {
  const S = 46, LH = 74, ANCHO = 1500, SR = 26;
  await Promise.all([document.fonts.load(`500 ${S}px "Space Grotesk"`), document.fonts.load(`500 ${SR}px "JetBrains Mono"`)]);
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `500 ${S}px "Space Grotesk"`;
  const esp = ctx.measureText(" ").width;
  const palabras = texto.split(/\s+/).filter(Boolean).map((t) => ({ t, w: Math.round(ctx.measureText(t).width) }));
  const lineas = [[]];
  let ancho = 0;
  palabras.forEach((p) => {
    if (ancho && ancho + esp + p.w > ANCHO) { lineas.push([]); ancho = 0; }
    lineas.at(-1).push(p);
    ancho += (ancho ? esp : 0) + p.w;
  });
  const y0 = Math.round(540 - (lineas.length * LH) / 2 + S * 0.8);
  const out = [];
  lineas.forEach((l, i) => {
    const w = l.reduce((a, p) => a + p.w, 0) + esp * (l.length - 1);
    let x = 960 - w / 2;
    l.forEach((p) => { out.push({ id: `p${out.length}`, t: p.t, x: Math.round(x), y: y0 + i * LH, w: p.w, s: S }); x += p.w + esp; });
  });
  ctx.font = `500 ${SR}px "JetBrains Mono"`;
  const wr = Math.round(ctx.measureText(ref).width);
  out.unshift({ id: "ref", t: ref, x: Math.round(960 - wr / 2), y: y0 - S - 40, w: wr, s: SR, ref: true });
  return out;
}

// Caja de una palabra (para seleccionar)
export const cajaPalabra = (p) => ({ x: p.x - 6, y: p.y - p.s * 0.85, w: p.w + 12, h: p.s * 1.15 });

// Línea suavizada (curvas por los puntos medios)
export function pathDe(p) {
  if (p.length < 4) return `M${p[0]} ${p[1]}l0.01 0`;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) d += `Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
  return d + `L${p.at(-2)} ${p.at(-1)}`;
}

// Simplificación Ramer–Douglas–Peucker sobre [x, y, x, y, …], redondeando a enteros
export function simplificar(p, tol = 1.2) {
  const n = p.length / 2;
  if (n < 3) return p.map(Math.round);
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const pila = [[0, n - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    const ax = p[a * 2], ay = p[a * 2 + 1], bx = p[b * 2], by = p[b * 2 + 1];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * p[i * 2] - dx * p[i * 2 + 1] + bx * ay - by * ax) / L;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; pila.push([a, idx], [idx, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(Math.round(p[i * 2]), Math.round(p[i * 2 + 1]));
  return out;
}

const trazoSvg = (t) => `<path d="${pathDe(t.p)}" stroke="${COLORES[t.c] || "#fff"}" stroke-width="${t.w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * SVG de un pizarrón. pz: { trazos: [], palabras: [], vivo: trazo|null }
 * extra: { seleccion: Set de ids, marco: {x, y, w, h} } (solo en la tablet)
 */
export function svgPizarron(pz, extra = {}) {
  const sel = extra.seleccion || new Set();
  const palabras = (pz?.palabras || []).map((p) => {
    const caja = sel.has(p.id) ? (() => { const c = cajaPalabra(p); return `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="rgba(212,255,0,.12)" stroke="#D4FF00" stroke-width="2" stroke-dasharray="6 5"/>`; })() : "";
    const fuente = p.ref ? `font-family="JetBrains Mono, monospace" fill="#D4FF00"` : `font-family="Space Grotesk, sans-serif" fill="#FFFFFF"`;
    return `${caja}<text x="${p.x}" y="${p.y}" font-size="${p.s}" font-weight="500" ${fuente}>${esc(p.t)}</text>`;
  }).join("");
  const m = extra.marco;
  return `<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;display:block">
    <rect width="1920" height="1080" fill="#07090B"/>
    ${palabras}
    <g>${(pz?.trazos || []).map(trazoSvg).join("")}${pz?.vivo?.p?.length ? trazoSvg(pz.vivo) : ""}</g>
    ${m ? `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="rgba(212,255,0,.06)" stroke="#D4FF00" stroke-width="2" stroke-dasharray="8 6"/>` : ""}
  </svg>`;
}
