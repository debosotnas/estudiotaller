// Arma un .pptx (PptxGenJS) a partir de las diapositivas. Lo usan la consola (descargar .pptx) y slides/gen.js.
// Mismas medidas que el lienzo web: 13.333 × 7.5 in.
//   PptxGen: la clase de pptxgenjs · opts: { plantilla, diapositivas, bloques, titulo, paleta?, joinUrl?,
//     qr?(url) → "image/png;base64,…" | null, imagen?(url) → "image/…;base64,…" | null (imágenes ya descargadas) }
export function construirPptx(PptxGen, { plantilla: T, diapositivas, bloques, titulo, paleta = null, joinUrl = null, qr = () => null, imagen = () => null }) {
  const SG = T.tipografias.principal.familia;
  const MONO = T.tipografias.mono.familia;
  const col = (k) => (paleta?.[k] ?? (T.colores[k] ? T.colores[k].hex : k)).replace("#", "");
  const DIAPOS = diapositivas.filter((s) => !s.oculta);
  const TOTAL = DIAPOS.length;
  const bl = Object.fromEntries(bloques.map((b) => [b.id, b]));
  const M = 0.7, W = 11.933;

  const pres = new PptxGen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = titulo || "";
  pres.theme = { headFontFace: SG, bodyFontFace: SG };
  pres.defineSlideMaster({ title: "SENAL", background: { color: col("fondo") } });

  // markup: **x** = resaltado, *x* = cursiva, \n = salto
  function runs(str, base, hl) {
    const out = [];
    const parts = String(str ?? "").split(/(\*\*[^*]+\*\*|\*[^*]+\*|\n)/).filter((p) => p !== "");
    for (const p of parts) {
      if (p === "\n") { if (out.length) out[out.length - 1].options.breakLine = true; continue; }
      let o = { ...base }, t = p;
      if (p.startsWith("**")) {
        t = p.slice(2, -2);
        if (hl === "marker") { o.highlight = col("lima"); o.color = col("texto_sobre_acento"); }
        else if (hl === "bold_lima") { o.color = col("lima"); o.bold = true; }
        else o.color = col("lima");
      } else if (p.startsWith("*")) { t = p.slice(1, -1); o.italic = true; }
      out.push({ text: t, options: o });
    }
    return out;
  }
  const plano = (str) => String(str ?? "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
  function txt(slide, content, o) {
    slide.addText(typeof content === "string" ? plano(content) : content ?? "", { isTextBox: true, margin: 0, valign: "top", fontFace: SG, color: col("texto"), ...o });
  }
  function chrome(slide, s) {
    const b = bl[s.bloque];
    if (b) txt(slide, `// ${b.id} · ${b.nombre}`, { x: M, y: 0.45, w: 9, h: 0.4, fontFace: MONO, fontSize: 16, color: col("lima") });
    txt(slide, `${DIAPOS.indexOf(s) + 1} / ${TOTAL}`, { x: 11.13, y: 6.85, w: 1.5, h: 0.35, fontFace: MONO, fontSize: 12, color: col("texto_secundario"), align: "right" });
  }
  function franja(slide) {
    const cs = ["lima", "fucsia", "celeste", "verde"], gap = 0.08, w = (W - gap * 3) / 4;
    cs.forEach((c, i) => slide.addShape(pres.shapes.RECTANGLE, { x: M + i * (w + gap), y: 6.55, w, h: 0.09, fill: { color: col(c) }, line: { type: "none" } }));
  }
  function rect(slide, x, y, w, h, fill, line) {
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: fill ? { color: fill } : { type: "none" }, line: line || { type: "none" } });
  }
  function apoyo(slide, a, box) {
    if (!a) return;
    if (Array.isArray(a)) {
      const arr = [];
      a.forEach((l, i) => {
        arr.push({ text: "→ ", options: { color: col("lima"), fontFace: MONO } });
        runs(l, { color: col("texto_secundario") }).forEach((r) => arr.push(r));
        if (i < a.length - 1) arr[arr.length - 1].options.breakLine = true;
      });
      txt(slide, arr, { fontSize: 24, ...box, paraSpaceAfter: 6 });
    } else txt(slide, runs(a, { color: col("texto_secundario") }), { fontSize: 24, ...box });
  }
  // Código QR: imagen si se puede generar (navegador), si no un recuadro con «QR»
  function codigoQr(slide, url, x, y, lado) {
    const img = url && qr(url);
    if (img) {
      rect(slide, x, y, lado, lado, "FFFFFF");
      slide.addImage({ data: img, x: x + 0.12, y: y + 0.12, w: lado - 0.24, h: lado - 0.24 });
    } else {
      slide.addShape(pres.shapes.RECTANGLE, { x, y, w: lado, h: lado, fill: { type: "none" }, line: { color: col("lima"), width: 2, dashType: "dash" } });
      txt(slide, "QR", { x, y, w: lado, h: lado, fontFace: MONO, fontSize: 40, color: col("lima"), align: "center", valign: "middle" });
    }
  }

  const R = {
    portada(sl, s) {
      txt(sl, s.etiqueta, { x: M, y: 0.7, w: W, h: 0.45, fontFace: MONO, fontSize: 18, color: col("lima") });
      const t = runs(s.titulo, { bold: true });
      t.push({ text: "_", options: { bold: true, color: col("lima") } });
      txt(sl, t, { x: M, y: 1.7, w: W, h: 2.7, fontSize: 72, valign: "bottom", lineSpacingMultiple: 0.95 });
      txt(sl, s.subtitulo, { x: M, y: 4.55, w: W, h: 0.6, fontSize: 26, color: col("texto_secundario") });
      txt(sl, s.pie, { x: M, y: 5.85, w: W, h: 0.45, fontFace: MONO, fontSize: 16, color: col("texto_secundario") });
      franja(sl);
    },
    frase(sl, s) {
      chrome(sl, s);
      const esc = s.ilustracion === "escalera", w = esc ? 7.0 : W;
      txt(sl, runs(s.frase, { bold: true }), { x: M, y: 1.4, w, h: 2.8, fontSize: 44, valign: "bottom", lineSpacingMultiple: 1.05 });
      apoyo(sl, s.apoyo, esc ? { x: M, y: 4.4, w: 7.0, h: 2.0, fontSize: 22, lineSpacingMultiple: 1.1 } : { x: M, y: 4.5, w, h: 1.9 });
      if (esc) {
        const n = 5, sw = 0.9, sh = 0.75, x0 = 8.2, yb = 6.3;
        for (let i = 0; i < n; i++) {
          const x = x0 + i * sw, h = sh * (i + 1), y = yb - h;
          if (i < 2) sl.addShape(pres.shapes.RECTANGLE, { x, y, w: sw - 0.08, h, fill: { type: "none" }, line: { color: col("naranja"), width: 2, dashType: "dash" } });
          else rect(sl, x, y, sw - 0.08, h, col("lima"));
        }
        const rot = s.rotulos_ilustracion || {};
        if (rot.escalones_ia) txt(sl, rot.escalones_ia, { x: x0 + sw - 1.1, y: 6.35, w: 2.2, h: 0.4, fontFace: MONO, fontSize: 14, color: col("naranja"), align: "center" });
        if (rot.escalones_altos) txt(sl, rot.escalones_altos, { x: x0, y: yb - sh * n - 0.45, w: n * sw - 0.08, h: 0.4, fontFace: MONO, fontSize: 14, color: col("lima"), align: "right" });
      }
    },
    pregunta(sl, s) {
      chrome(sl, s);
      const op = s.opciones?.length ? s.opciones : null;
      txt(sl, runs(s.pregunta, { bold: true }, "marker"), { x: M, y: op ? 1.3 : 1.4, w: W, h: op ? 2.3 : 3.6, fontSize: op ? 48 : 40, valign: op ? "bottom" : "middle", lineSpacingMultiple: 1.15 });
      if (op) {
        const gap = 0.3, w = (W - gap * (op.length - 1)) / op.length;
        op.forEach((o, i) => {
          sl.addShape(pres.shapes.RECTANGLE, { x: M + i * (w + gap), y: 3.95, w, h: 1.15, fill: { type: "none" }, line: { color: col("texto"), width: 2 } });
          txt(sl, o, { x: M + i * (w + gap), y: 3.95, w, h: 1.15, fontFace: MONO, fontSize: 30, align: "center", valign: "middle" });
        });
      }
      if (s.apoyo) txt(sl, runs(s.apoyo, { color: col("texto_secundario") }, "lima"), { x: M, y: op ? 5.45 : 5.3, w: W, h: 0.9, fontSize: 26 });
    },
    caso(sl, s) {
      chrome(sl, s);
      rect(sl, M, 1.25, 1.2, 0.42, col("lima"));
      txt(sl, "CASO", { x: M, y: 1.25, w: 1.2, h: 0.42, fontFace: MONO, fontSize: 16, color: col("texto_sobre_acento"), align: "center", valign: "middle" });
      txt(sl, s.nombre_caso, { x: M, y: 1.9, w: W, h: 1.0, fontSize: 40, bold: true, color: col("lima") });
      txt(sl, runs(s.texto, {}), { x: M, y: 3.05, w: 11.2, h: 2.4, fontSize: 26, lineSpacingMultiple: 1.2 });
      txt(sl, s.remate, { x: M, y: 5.55, w: W, h: 0.9, fontSize: 30, bold: true, color: col("lima") });
    },
    dato(sl, s) {
      chrome(sl, s);
      txt(sl, s.titulo, { x: M, y: 1.2, w: W, h: 0.8, fontSize: 30, bold: true });
      s.valores.forEach((v, i) => {
        const x = M + i * 6.2;
        txt(sl, v.valor, { x, y: 2.05, w: 5.6, h: 1.6, fontSize: 96, bold: true, color: col(v.color), valign: "bottom" });
        rect(sl, x, 3.8, 5.0, 0.16, col("linea"));
        if (+v.proporcion > 0) rect(sl, x, 3.8, 5.0 * Math.min(1, +v.proporcion), 0.16, col(v.color));
        txt(sl, v.etiqueta, { x, y: 4.1, w: 5.6, h: 0.5, fontFace: MONO, fontSize: 18, color: col("texto_secundario") });
      });
      txt(sl, runs(s.texto, {}), { x: M, y: 5.05, w: W, h: 0.9, fontSize: 26, bold: true });
      if (s.fuente) txt(sl, "fuente: " + s.fuente, { x: M, y: 6.3, w: 9.6, h: 0.4, fontFace: MONO, fontSize: 12, color: col("texto_secundario") });
    },
    dato_columnas(sl, s) {
      chrome(sl, s);
      txt(sl, s.titulo, { x: M, y: 1.2, w: W, h: 0.8, fontSize: 30, bold: true });
      s.columnas.forEach((c, i) => {
        const x = M + i * 6.1, y = 2.1, w = 5.8, h = 3.05;
        sl.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: col("superficie") }, line: { color: col(c.color), width: 2 } });
        txt(sl, c.titulo, { x: x + 0.35, y: y + 0.3, w: w - 0.7, h: 0.4, fontFace: MONO, fontSize: 18, color: col(c.color) });
        txt(sl, c.valor, { x: x + 0.35, y: y + 0.75, w: w - 0.7, h: 0.9, fontSize: 48, bold: true, color: col(c.color) });
        txt(sl, runs(c.texto, {}), { x: x + 0.35, y: y + 1.75, w: w - 0.7, h: 1.15, fontSize: 22 });
      });
      txt(sl, s.pregunta, { x: M, y: 5.45, w: W, h: 0.8, fontSize: 30, bold: true, color: col("lima") });
      if (s.fuente) txt(sl, "fuente: " + s.fuente, { x: M, y: 6.3, w: 9.6, h: 0.4, fontFace: MONO, fontSize: 12, color: col("texto_secundario") });
    },
    lista(sl, s) {
      chrome(sl, s);
      txt(sl, runs(s.titulo, { bold: true }), { x: M, y: 1.2, w: W, h: 0.9, fontSize: 36 });
      const n = s.items.length, top = 2.35, area = s.pie ? 3.7 : 3.95, rh = Math.min(1.25, area / Math.max(1, n));
      s.items.forEach((it, i) => {
        const y = top + i * rh;
        rect(sl, M, y, W, 0.012, col("linea"));
        txt(sl, String(i + 1).padStart(2, "0"), { x: M, y: y + 0.17, w: 0.9, h: 0.5, fontFace: MONO, fontSize: 22, color: col("lima") });
        if (it.detalle) {
          txt(sl, runs(it.texto, { bold: true }), { x: M + 0.9, y: y + 0.12, w: W - 0.9, h: 0.55, fontSize: 26 });
          txt(sl, runs(it.detalle, { color: col("texto_secundario") }), { x: M + 0.9, y: y + 0.62, w: W - 0.9, h: rh - 0.65, fontSize: 20 });
        } else {
          txt(sl, runs(it.texto, { bold: true }), { x: M + 0.9, y: y + 0.12, w: W - 0.9, h: rh - 0.2, fontSize: 26 });
        }
      });
      if (s.pie) txt(sl, s.pie, { x: M, y: 6.3, w: W, h: 0.4, fontFace: MONO, fontSize: 14, color: col("texto_secundario") });
    },
    lista_doble(sl, s) {
      chrome(sl, s);
      txt(sl, s.titulo, { x: M, y: 1.2, w: W, h: 0.9, fontSize: 36, bold: true });
      const filas = Math.max(4, Math.ceil(s.items.length / 2)), cw = (W - 0.3) / 2;
      const paso = 4.3 / filas, gap = Math.min(0.17, paso * 0.18), ch = paso - gap;
      s.items.forEach((t, i) => {
        const c = Math.floor(i / filas), r = i % filas, x = M + c * (cw + 0.3), y = 2.3 + r * (ch + gap);
        rect(sl, x, y, cw, ch, col("superficie"));
        txt(sl, String(i + 1).padStart(2, "0"), { x: x + 0.25, y, w: 0.8, h: ch, fontFace: MONO, fontSize: 24, color: col("lima"), valign: "middle" });
        txt(sl, t, { x: x + 1.05, y, w: cw - 1.25, h: ch, fontSize: filas > 4 ? 20 : 22, bold: true, valign: "middle", lineSpacingMultiple: filas > 4 ? 0.95 : undefined });
      });
    },
    grupos(sl, s) {
      chrome(sl, s);
      txt(sl, s.titulo, { x: M, y: 1.2, w: W, h: 0.9, fontSize: 34, bold: true });
      const cols = s.disposicion === "columnas";
      s.tarjetas.forEach((t, i) => {
        let x, y, w, h;
        if (cols) { w = (W - 0.9) / 4; h = 1.9; x = M + i * (w + 0.3); y = 2.3; }
        else { w = (W - 0.3) / 2; h = 1.75; x = M + (i % 2) * (w + 0.3); y = 2.25 + Math.floor(i / 2) * (h + 0.3); }
        rect(sl, x, y, w, h, col("superficie"));
        rect(sl, x, y, 0.12, h, col(t.color));
        txt(sl, t.rotulo, { x: x + 0.35, y: y + 0.2, w: w - 0.5, h: 0.4, fontFace: MONO, fontSize: 18, color: col(t.color) });
        txt(sl, t.texto, { x: x + 0.35, y: y + 0.62, w: w - 0.55, h: h - 0.75, fontSize: cols ? 22 : 20, bold: true });
      });
      if (Array.isArray(s.pie)) apoyo(sl, s.pie, { x: M, y: 4.5, w: W, h: 1.9 });
      else if (s.pie) txt(sl, s.pie, { x: M, y: 6.2, w: 10, h: 0.5, fontSize: 20, color: col("texto_secundario") });
    },
    grupo(sl, s) {
      const g = T.grupos[s.grupo] || { color: "lima" }, c = col(g.color);
      rect(sl, 0, 0, 13.333, 0.14, c);
      chrome(sl, s);
      txt(sl, `GRUPO ${s.grupo}`, { x: M, y: 1.2, w: W, h: 0.6, fontFace: MONO, fontSize: 22, color: c });
      txt(sl, s.pregunta_partida, { x: M, y: 1.85, w: W, h: 1.5, fontSize: 36, bold: true });
      s.y_si.forEach((t, i) => {
        const y = 3.6 + i * 0.95;
        rect(sl, M, y, W, 0.012, col("linea"));
        txt(sl, String(i + 1).padStart(2, "0"), { x: M, y: y + 0.18, w: 0.8, h: 0.5, fontFace: MONO, fontSize: 20, color: c });
        txt(sl, t, { x: M + 0.8, y: y + 0.12, w: W - 0.8, h: 0.8, fontSize: 22 });
      });
    },
    ia(sl, s) {
      chrome(sl, s);
      txt(sl, s.encabezado, { x: M, y: 1.2, w: W, h: 0.9, fontSize: 36, bold: true, color: col("lima") });
      const x = M, y = 2.4, w = W, h = 3.2;
      sl.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: col("superficie") }, line: { color: col("naranja"), width: 2.5 } });
      rect(sl, x, y + 0.45, w, 0.015, col("linea"));
      ["naranja", "linea", "linea"].forEach((c, i) => sl.addShape(pres.shapes.OVAL, { x: x + 0.25 + i * 0.25, y: y + 0.155, w: 0.14, h: 0.14, fill: { color: col(c) }, line: { type: "none" } }));
      txt(sl, "chat", { x: x + 1.1, y: y + 0.08, w: 2, h: 0.3, fontFace: MONO, fontSize: 14, color: col("texto_secundario") });
      txt(sl, [
        { text: "> ", options: { color: col("naranja") } },
        { text: plano(s.consigna), options: { color: col("texto") } },
        { text: " ▍", options: { color: col("naranja") } },
      ], { x: x + 0.45, y: y + 0.85, w: w - 0.9, h: 2.0, fontFace: MONO, fontSize: 30, valign: "middle" });
      txt(sl, s.pie, { x: M, y: 5.9, w: W, h: 0.6, fontSize: 20, color: col("texto_secundario") });
    },
    texto_biblico(sl, s) {
      chrome(sl, s);
      txt(sl, s.referencia, { x: M, y: 1.2, w: 8, h: 0.7, fontSize: 30, bold: true, color: col("lima") });
      txt(sl, s.version, { x: 9.63, y: 1.3, w: 3, h: 0.5, fontFace: MONO, fontSize: 16, color: col("texto_secundario"), align: "right" });
      txt(sl, runs(s.texto, {}, "bold_lima"), { x: M, y: 2.15, w: W, h: 4.3, fontSize: 32, lineSpacingMultiple: 1.25 });
    },
    en_vivo(sl, s) {
      chrome(sl, s);
      rect(sl, M, 1.2, 2.0, 0.42, col("lima"));
      txt(sl, "● EN VIVO", { x: M, y: 1.2, w: 2.0, h: 0.42, fontFace: MONO, fontSize: 16, color: col("texto_sobre_acento"), align: "center", valign: "middle" });
      txt(sl, s.titulo, { x: M, y: 1.85, w: W, h: 0.9, fontSize: 36, bold: true });
      const n = +s.renglones || 1, step = 3.3 / n;
      for (let i = 0; i < n; i++) {
        const y = 3.05 + (i + 1) * step - 0.05;
        rect(sl, M + 0.6, y, W - 0.6, 0.012, col("linea"));
        txt(sl, String(i + 1).padStart(2, "0"), { x: M, y: y - 0.38, w: 0.5, h: 0.35, fontFace: MONO, fontSize: 14, color: col("texto_secundario") });
      }
    },
    qr(sl, s) {
      chrome(sl, s);
      const solo = !(s.preguntas || []).length, lado = solo ? 5.4 : 4.6, qx = solo ? (13.333 - lado) / 2 : M, qy = solo ? 1.05 : 1.3;
      codigoQr(sl, joinUrl || s.url, qx, qy, lado);
      if (solo) return;
      txt(sl, s.titulo, { x: 5.8, y: 1.3, w: 6.83, h: 0.8, fontSize: 32, bold: true });
      s.preguntas.forEach((p, i) => {
        const y = 2.35 + i * 1.2;
        rect(sl, 5.8, y, 6.83, 0.012, col("linea"));
        txt(sl, String(i + 1).padStart(2, "0"), { x: 5.8, y: y + 0.18, w: 0.7, h: 0.4, fontFace: MONO, fontSize: 20, color: col("lima") });
        txt(sl, p, { x: 6.5, y: y + 0.12, w: 6.13, h: 1.0, fontSize: 22 });
      });
      if (s.pie) txt(sl, s.pie, { x: M, y: 6.25, w: 10, h: 0.45, fontFace: MONO, fontSize: 16, color: col("lima") });
    },
    recursos(sl, s) {
      chrome(sl, s);
      txt(sl, runs(s.titulo, { bold: true }), { x: M, y: 1.2, w: 8.2, h: 0.8, fontSize: 32 });
      const n = s.items.length, rh = Math.min(0.72, 4.3 / Math.max(1, n));
      s.items.forEach((it, i) => {
        const y = 2.1 + i * rh;
        rect(sl, M, y, 8.2, 0.012, col("linea"));
        txt(sl, runs(it.texto, { bold: true }), { x: M, y: y + 0.08, w: 8.2, h: 0.32, fontSize: 18 });
        if (it.detalle) txt(sl, runs(it.detalle, { color: col("texto_secundario") }), { x: M, y: y + 0.38, w: 8.2, h: rh - 0.4, fontSize: 15 });
      });
      if (s.url) {
        codigoQr(sl, s.url, 9.4, 1.3, 3.2);
        if (s.rotulo_qr) txt(sl, s.rotulo_qr, { x: 9.1, y: 4.7, w: 3.8, h: 0.4, fontFace: MONO, fontSize: 16, color: col("lima"), align: "center" });
        txt(sl, s.url.replace(/^https?:\/\//, ""), { x: 9.1, y: 5.1, w: 3.8, h: 0.7, fontFace: MONO, fontSize: 14, color: col("texto_secundario"), align: "center" });
      }
    },
    // Diapositiva libre: cada elemento en su lugar
    libre(sl, s) {
      for (const e of s.elementos || []) {
        const caja = { x: +e.x, y: +e.y, w: +e.w, h: +e.h };
        if (e.tipo === "texto") {
          let texto = e.texto;
          if (e.rol === "bloque") { const b = bl[s.bloque]; if (!b) continue; texto = `// ${b.id} · ${b.nombre}`; }
          if (e.rol === "numero") texto = `${DIAPOS.indexOf(s) + 1} / ${TOTAL}`;
          const r = runs(texto, { bold: !!e.bold, italic: !!e.italic }, { marker: "marker", bold: "bold_lima" }[e.resaltado]);
          if (e.cursor) r.push({ text: "_", options: { bold: !!e.bold, color: col("lima") } });
          txt(sl, r, { ...caja, fontSize: +e.size || 24, color: col(e.color || "texto"), fontFace: e.mono ? MONO : SG, align: e.align || "left", valign: e.valign || "top",
            ...(e.lh ? { lineSpacingMultiple: e.lh / 1.22 } : {}), ...(e.fondo ? { fill: { color: col(e.fondo) } } : {}) });
        } else if (e.tipo === "forma") {
          sl.addShape(e.redondo ? pres.shapes.OVAL : pres.shapes.RECTANGLE, { ...caja,
            fill: e.fondo ? { color: col(e.fondo) } : { type: "none" },
            line: e.borde ? { color: col(e.borde.color || "texto"), width: +e.borde.ancho || 2, ...(e.borde.estilo === "dashed" ? { dashType: "dash" } : {}) } : { type: "none" } });
        } else if (e.tipo === "imagen" && e.url) {
          const d = imagen(e.url);
          if (d) sl.addImage({ data: d, ...caja, sizing: { type: e.ajuste === "contener" ? "contain" : "cover", w: caja.w, h: caja.h } });
          else txt(sl, `imagen: ${e.url}`, { ...caja, fontFace: MONO, fontSize: 12, color: col("texto_secundario"), align: "center", valign: "middle" });
        } else if (e.tipo === "qr") codigoQr(sl, e.url || joinUrl, caja.x, caja.y, Math.min(caja.w, caja.h));
      }
    },
  };

  for (const s of DIAPOS) {
    const sl = pres.addSlide({ masterName: "SENAL" });
    if (!R[s.plantilla]) throw new Error("plantilla desconocida: " + s.plantilla);
    R[s.plantilla](sl, s);
    if (s.notas) sl.addNotes(s.notas);
  }
  return pres;
}
