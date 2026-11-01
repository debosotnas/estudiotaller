// Una presentación = una sesión (estudiotaller/{sid}) + su ficha en estudiotaller_presentaciones/{sid}.
// El taller original ("legado") usa además el JSON publicado y actividades.json como punto de partida.
import * as fb from "./firebase.js";

export const TALLER = "legado";

export const mapaBloques = (lista) => Object.fromEntries(lista.map((b) => [b.id, b]));
export const nuevoId = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Código corto para el enlace de los participantes (estudiotaller.web.app/<código>)
export function codigoPara(titulo) {
  const base = String(titulo || "taller").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "") || "taller";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export function contenidoInicial(titulo) {
  return {
    bloques: [{ id: "01", nombre: "inicio" }],
    diapositivas: [{ id: nuevoId(), bloque: "01", plantilla: "portada", etiqueta: "> taller", titulo: titulo || "Título", subtitulo: "Subtítulo", pie: "" }],
  };
}

export async function cargarPresentacion(sid, datos) {
  const [sc, sm] = await Promise.all([
    fb.getDoc(fb.refContenido(sid)).catch(() => null),
    fb.getDoc(fb.refMeta(sid)).catch(() => null),
  ]);
  return armarPresentacion(sid, datos, sc ? fb.leerContenido(sc) : null, sm?.exists() ? sm.data() : null);
}

// guardado: { diapositivas, bloques?, actividades?, muros? } | null
export function armarPresentacion(sid, datos, guardado, meta) {
  const esTaller = sid === TALLER;
  const contenido = guardado || (esTaller ? { diapositivas: structuredClone(datos.diapositivas) } : contenidoInicial(meta?.titulo || sid));
  const bloquesLista = contenido.bloques || (esTaller ? structuredClone(datos.taller.contenido.bloques) : [{ id: "01", nombre: "inicio" }]);
  const titulo = meta?.titulo || (esTaller ? datos.actividades.titulo : sid);
  // Actividades: las guardadas con el contenido (editables desde la consola); el taller parte de actividades.json
  const def = {
    sesion: sid, titulo,
    actividades: contenido.actividades || (esTaller ? structuredClone(datos.actividades.actividades) : []),
    muros: contenido.muros || (esTaller ? structuredClone(datos.actividades.muros || []) : []),
  };
  return {
    sid, esTaller, meta, titulo, def,
    tema: meta?.tema || "oscuro",
    diapositivas: contenido.diapositivas,
    bloquesLista,
    bloques: mapaBloques(bloquesLista),
    guardado: !!guardado,
  };
}
