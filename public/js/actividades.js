// Lógica compartida: diapositivas visibles, actividades (con sus textos tomados de las diapositivas) y resultados.
import { sinMarcas } from "./slides.js";

export function codigoSesion(def) {
  const q = new URLSearchParams(location.search).get("s");
  if (q) return q;
  const p = location.pathname.replace(/^\/+|\/+$/g, "");
  if (p && !p.includes("/") && !p.includes(".") && !["presentar", "admin", "index", "pizarron", "material", "presentaciones"].includes(p)) return p;
  return def.sesion;
}

export const urlParticipante = (sid) => `${location.origin}/${sid}`;

// ---------- diapositivas ----------
export const visibles = (diapos) => diapos.filter((s) => !s.oculta);
export function numeroDe(diapos, id) {
  const i = visibles(diapos).findIndex((s) => s.id === id);
  return i < 0 ? null : i + 1;
}

// Las diapositivas del JSON publicado con una revisión ('rev') más nueva que la editada reemplazan a la editada
// (conservando si estaba oculta o por pasos); las que no existían se insertan después de su anterior. Devuelve los ids.
export function aplicarRevisiones(diapos, publicadas) {
  const cambios = [];
  publicadas.forEach((p, i) => {
    const j = diapos.findIndex((s) => s.id === p.id);
    if (j < 0) {
      const ant = diapos.findIndex((s) => s.id === publicadas[i - 1]?.id);
      diapos.splice(ant + 1, 0, structuredClone(p));
      cambios.push(p.id);
    } else if ((p.rev || 0) > (diapos[j].rev || 0)) {
      const { oculta, pasos } = diapos[j];
      diapos[j] = { ...structuredClone(p), ...(oculta ? { oculta } : {}), ...(pasos ? { pasos } : {}) };
      cambios.push(p.id);
    }
  });
  return cambios;
}

// ---------- actividades ----------
const textos = (arr) => (arr || []).map((x) => sinMarcas(typeof x === "string" ? x : x.texto || ""));

// Completa cada actividad con los textos de sus diapositivas (preguntas, opciones, ítems, columnas)
export function resolverActividades(def, diapos) {
  const porId = Object.fromEntries(diapos.map((s) => [s.id, s]));
  return def.actividades.map((a0) => {
    const a = { ...a0 };
    const de = (k) => porId[a0[k]];
    if (de("preguntas_de")) {
      const s = de("preguntas_de");
      a.preguntas = textos(s.plantilla === "qr" ? s.preguntas : s.items);
    }
    if (de("desde")) {
      const s = de("desde");
      a.pregunta = sinMarcas(s.pregunta || s.titulo || a.titulo);
      if (a0.tipo === "votacion") a.opciones = textos(s.opciones);
    }
    if (a0.pregunta && !de("desde")) a.pregunta = sinMarcas(a0.pregunta);
    if (de("items_de")) a.items = textos(de("items_de").items);
    if (de("columnas_de")) {
      const t = de("columnas_de").tarjetas || [];
      a.columnas = textos(t);
      a.colores = t.map((x) => x.color);
    }
    a.preguntas ||= [];
    a.opciones ||= [];
    a.items ||= [];
    a.columnas ||= [];
    return a;
  });
}

export const actividadPorId = (acts, id) => acts.find((a) => a.id === id) || null;

// Actividad que se abre al llegar a la diapositiva (solo su diapositiva principal)
export const actividadQueAbre = (acts, id) => acts.find((a) => a.diapositiva === id) || null;

// Actividad cuyos resultados se pueden mostrar en la diapositiva
export const actividadDeDiapositiva = (acts, id) =>
  acts.find((a) => a.diapositiva === id || (a.resultados_en || []).includes(id)) || null;

export const muroDeDiapositiva = (def, id) => (def.muros || []).find((m) => m.diapositiva === id) || null;

// Palabra normalizada para agrupar (sin mayúsculas, tildes ni signos)
const claveDe = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

// qa (preguntas del público): { preguntas: [{_id, texto, nombre, oculta, respondida, ts}], votos: [{q}] }
export function calcular(act, respuestas, qa = null) {
  if (act.tipo === "qa") {
    const votos = {};
    (qa?.votos || []).forEach((v) => (votos[v.q] = (votos[v.q] || 0) + 1));
    const items = (qa?.preguntas || []).filter((p) => p.actividad === act.id)
      .map((p) => ({ id: p._id, texto: p.texto, nombre: p.nombre || "", votos: votos[p._id] || 0, oculta: !!p.oculta, respondida: !!p.respondida, ts: p.ts?.toMillis?.() || 0 }))
      .sort((a, b) => b.votos - a.votos || a.ts - b.ts);
    return { total: items.length, items };
  }
  const rs = respuestas.filter((r) => r.actividad === act.id);
  if (act.tipo === "nube") {
    const grupos = {};
    rs.forEach((r) => Object.values(r.valores || {}).forEach((t) => {
      const k = claveDe(String(t || ""));
      if (!k) return;
      const g = (grupos[k] ||= { n: 0, formas: {} });
      g.n++;
      const f = String(t).trim().toLowerCase();
      g.formas[f] = (g.formas[f] || 0) + 1;
    }));
    const palabras = Object.values(grupos).map((g) => ({ texto: Object.entries(g.formas).sort((a, b) => b[1] - a[1])[0][0], n: g.n }))
      .sort((a, b) => b.n - a.n).slice(0, 40);
    return { total: rs.length, palabras };
  }
  if (act.tipo === "votacion") {
    const conteos = act.opciones.map(() => 0);
    rs.forEach((r) => { if (Number.isInteger(r.valores?.opcion) && conteos[r.valores.opcion] != null) conteos[r.valores.opcion]++; });
    return { total: rs.length, conteos };
  }
  if (act.tipo === "clasificar") {
    // celdas[item][columna][grupo] = cantidad
    const celdas = act.items.map(() => act.columnas.map(() => ({})));
    rs.forEach((r) => {
      const g = r.grupo || "?";
      Object.entries(r.valores || {}).forEach(([i, j]) => {
        const c = celdas[+i]?.[+j];
        if (c) c[g] = (c[g] || 0) + 1;
      });
    });
    return { total: rs.length, celdas };
  }
  // abiertas
  const porPregunta = act.preguntas.map((_, q) =>
    rs.map((r) => ({ id: r._id, texto: (r.valores?.[q] || "").trim(), nombre: r.nombre || "" })).filter((x) => x.texto));
  return { total: rs.length, porPregunta };
}

// Resultados sin textos ni nombres (lo que se puede mandar a los celulares)
export const resultadosPublicos = (act, res) => (!res ? null : act.tipo === "abiertas" ? { total: res.total }
  : act.tipo === "qa" ? { ...res, items: res.items.filter((x) => !x.oculta).map(({ nombre, ...x }) => x) } : res);

export const claveDestacada = (respId, pregunta) => `${respId}#${pregunta}`;
