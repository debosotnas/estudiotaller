// Panel de administración: ver respuestas, exportarlas y reiniciar la sesión.
import { cargarTaller, esc, qrSvg, sinMarcas } from "./slides.js";
import { codigoSesion, urlParticipante, resolverActividades, numeroDe } from "./actividades.js";
import { cargarPresentacion } from "./presentacion.js";
import * as fb from "./firebase.js";
import { avisoVersion } from "./version.js";

const $app = document.getElementById("app");
const datos = await cargarTaller();
const sid = codigoSesion(datos.actividades);
const pres = await cargarPresentacion(sid, datos);
const def = pres.def;
const joinUrl = urlParticipante(sid);
const diapos = pres.diapositivas;
const acts = resolverActividades(def, diapos);

let user = await fb.usuarioActual();
if (!fb.puedeEditar(user, pres.meta)) login();
else iniciar();

function login() {
  $app.innerHTML = `<div class="centro"><div class="caja">
    <div class="mono lima">// estudio taller · admin</div>
    <h1>Entrá con tu cuenta de Google</h1>
    ${user && !user.isAnonymous ? `<p class="sec">Entraste como <b>${esc(user.email)}</b>, que no puede editar esta presentación.</p>` : ""}
    <div class="acciones"><button class="btn" id="g">entrar con google</button></div><p id="err" class="sec"></p></div></div>`;
  document.getElementById("g").onclick = async () => {
    try { user = await fb.entrarGoogle(); if (fb.puedeEditar(user, pres.meta)) iniciar(); else document.getElementById("err").textContent = `${user.email} no puede ver esta presentación.`; }
    catch (e) { document.getElementById("err").textContent = e.message; }
  };
}

// Columnas de una actividad: [{titulo, valor(r)}]
function columnas(a) {
  if (a.tipo === "votacion") return [{ titulo: a.pregunta, valor: (r) => a.opciones[r.valores?.opcion] ?? "" }];
  if (a.tipo === "clasificar") return a.items.map((it, i) => ({ titulo: it, valor: (r) => (r.valores?.[i] != null ? `${+r.valores[i] + 1} · ${a.columnas[r.valores[i]]}` : "") }));
  return a.preguntas.map((p, i) => ({ titulo: sinMarcas(p), valor: (r) => r.valores?.[i] || "" }));
}
const fecha = (r) => (r.ts?.toDate ? r.ts.toDate().toLocaleString("es") : "");

function iniciar() {
  avisoVersion();
  let respuestas = [];
  let sesion = {};
  let sel = acts[0].id;

  $app.innerHTML = `<div class="admin">
    <header>
      <div class="titulo"><div class="mono lima">// estudio taller · admin · ${esc(sid)}</div><h1>${esc(pres.titulo)}</h1></div>
      <a class="btn sec-btn chico" href="/presentar?s=${encodeURIComponent(sid)}" target="_blank">presentar</a>
      <button class="btn sec-btn chico" id="salir">salir</button>
    </header>
    <div class="fila" style="margin-bottom:24px">
      <div class="qr-mini">${qrSvg(joinUrl)}</div>
      <div>
        <div class="rotulo">enlace para los participantes</div>
        <div class="mono lima" style="font-size:20px;margin:6px 0 10px">${esc(joinUrl)}</div>
        <div class="acciones">
          <button class="btn sec-btn chico" id="copiar-url">copiar enlace</button>
          <button class="btn sec-btn chico" id="bajar-qr">descargar qr (svg)</button>
        </div>
        <div class="sec" id="estado-sesion" style="margin-top:12px;font-size:14px"></div>
      </div>
    </div>
    <div class="tarjetas" id="tarjetas"></div>
    <div class="fila" style="margin-bottom:12px">
      <h2 id="titulo-act" style="margin:0;margin-right:auto;font-size:22px"></h2>
      <button class="btn chico" id="csv">descargar csv</button>
      <button class="btn sec-btn chico" id="tsv">copiar tabla</button>
      <button class="btn sec-btn chico" id="txt">copiar texto agrupado</button>
      <button class="btn peligro chico" id="borrar">borrar respuestas</button>
    </div>
    <div class="tabla-wrap" id="tabla"></div>
    <div class="fila" style="margin-top:32px">
      <button class="btn sec-btn chico" id="csv-todo">descargar todo (csv, una fila por respuesta)</button>
      <button class="btn peligro chico" id="reiniciar">reiniciar sesión (volver a la diapositiva 1)</button>
    </div>
  </div>`;

  document.getElementById("salir").onclick = async () => { await fb.salir(); location.reload(); };
  document.getElementById("copiar-url").onclick = () => copiar(joinUrl, "Enlace copiado");
  document.getElementById("bajar-qr").onclick = () => bajar(`qr-${sid}.svg`, qrSvg(joinUrl).replace("<svg ", '<svg style="background:#fff" '), "image/svg+xml");

  fb.onSnapshot(fb.refRespuestas(sid), (qs) => {
    respuestas = qs.docs.map((d) => ({ _id: d.id, ...d.data() })).sort((a, b) => (a.ts?.toMillis?.() || 0) - (b.ts?.toMillis?.() || 0));
    pintar();
  }, (e) => toast("Error: " + e.message));
  let nav = {};
  fb.onSnapshot(fb.refSesion(sid), (s) => { sesion = s.data() || {}; pintarSesion(); });
  fb.onSnapshot(fb.refNav(sid), (s) => { nav = s.data() || {}; pintarSesion(); });

  function pintarSesion() {
    const a = acts.find((x) => x.id === sesion.actividad);
    document.getElementById("estado-sesion").innerHTML = nav.actual
      ? `diapositiva <b>${numeroDe(diapos, nav.actual) ?? "oculta"}</b> · actividad: <b>${a ? esc(a.titulo) : "ninguna"}</b> ${a ? `(${sesion.abierta ? "abierta" : "cerrada"})` : ""}`
      : "La sesión todavía no empezó.";
  }

  function pintar() {
    const act = acts.find((a) => a.id === sel);
    document.getElementById("tarjetas").innerHTML = acts.map((a) => {
      const n = respuestas.filter((r) => r.actividad === a.id).length;
      return `<button class="tarjeta ${a.id === sel ? "sel" : ""}" data-id="${a.id}"><div class="rotulo">diap. ${numeroDe(diapos, a.diapositiva) ?? "oculta"} · ${esc(a.tipo)}${a.anonimo ? " · anónima" : ""}</div><div style="font-weight:700;margin-top:4px">${esc(a.titulo)}</div><div class="n">${n}</div></button>`;
    }).join("");
    document.querySelectorAll(".tarjeta").forEach((b) => (b.onclick = () => { sel = b.dataset.id; pintar(); }));

    const rs = respuestas.filter((r) => r.actividad === act.id);
    const cols = columnas(act);
    document.getElementById("titulo-act").textContent = `${act.titulo} · ${rs.length} respuesta${rs.length === 1 ? "" : "s"}`;
    document.getElementById("tabla").innerHTML = rs.length ? `<table>
      <thead><tr><th>#</th><th>hora</th>${act.anonimo ? "" : "<th>nombre</th>"}${act.tipo === "clasificar" ? "<th>grupo</th>" : ""}${cols.map((c) => `<th>${esc(c.titulo)}</th>`).join("")}</tr></thead>
      <tbody>${rs.map((r, i) => `<tr><td class="mono sec">${i + 1}</td><td class="sec" style="white-space:nowrap">${esc(fecha(r))}</td>${act.anonimo ? "" : `<td>${esc(r.nombre || "—")}</td>`}${act.tipo === "clasificar" ? `<td>${esc(r.grupo || "")}</td>` : ""}${cols.map((c) => { const v = c.valor(r); return `<td class="${v ? "" : "vacio"}" style="white-space:pre-wrap">${esc(v || "—")}</td>`; }).join("")}</tr>`).join("")}</tbody>
    </table>` : `<div class="sec" style="padding:16px">Todavía no hay respuestas.</div>`;

    const filas = () => [
      ["hora", ...(act.anonimo ? [] : ["nombre"]), ...(act.tipo === "clasificar" ? ["grupo"] : []), ...cols.map((c) => c.titulo)],
      ...rs.map((r) => [fecha(r), ...(act.anonimo ? [] : [r.nombre || ""]), ...(act.tipo === "clasificar" ? [r.grupo || ""] : []), ...cols.map((c) => c.valor(r))]),
    ];
    document.getElementById("csv").onclick = () => bajar(`${sid}-${act.id}.csv`, aCSV(filas()), "text/csv");
    document.getElementById("tsv").onclick = () => copiar(filas().map((f) => f.map((v) => String(v).replace(/[\t\n\r]+/g, " ")).join("\t")).join("\n"), "Tabla copiada: pegala en una hoja de cálculo");
    document.getElementById("txt").onclick = () => copiar(textoAgrupado(act, rs, cols), "Texto copiado");
    document.getElementById("borrar").onclick = async () => {
      if (!rs.length) return;
      if (!confirm(`¿Borrar las ${rs.length} respuestas de «${act.titulo}»? No se puede deshacer.`)) return;
      await borrar(rs);
      toast("Respuestas borradas");
    };
    document.getElementById("csv-todo").onclick = () => bajar(`${sid}-todas.csv`, aCSV(filasLargas()), "text/csv");
    document.getElementById("reiniciar").onclick = async () => {
      if (!confirm("¿Volver a la primera diapositiva, cerrar actividades y dejar de compartir? Las respuestas NO se borran.")) return;
      await Promise.all([
        fb.setDoc(fb.refSesion(sid), { actividad: null, abierta: false, compartida: null, actualizado: fb.serverTimestamp() }),
        fb.setDoc(fb.refNav(sid), { actual: null, paso: 0, revelar: false, destacadas: [], pizarron: null, actualizado: fb.serverTimestamp() }),
      ]);
      toast("Sesión reiniciada");
    };
  }

  // Formato largo: una fila por cada respuesta a cada pregunta (cómodo para filtrar y agrupar)
  function filasLargas() {
    const out = [["actividad", "pregunta", "respuesta", "nombre", "grupo", "hora", "participante"]];
    for (const a of acts) {
      const cols = columnas(a);
      respuestas.filter((r) => r.actividad === a.id).forEach((r) => {
        cols.forEach((c) => { const v = c.valor(r); if (v) out.push([a.titulo, c.titulo, v, a.anonimo ? "" : r.nombre || "", r.grupo || "", fecha(r), r.uid.slice(0, 6)]); });
      });
    }
    return out;
  }

  async function borrar(rs) {
    for (let i = 0; i < rs.length; i += 400) {
      const b = fb.writeBatch(fb.db);
      rs.slice(i, i + 400).forEach((r) => b.delete(fb.doc(fb.db, fb.RAIZ, sid, "respuestas", r._id)));
      await b.commit();
    }
  }
}

function textoAgrupado(act, rs, cols) {
  if (act.tipo === "votacion") {
    const t = act.opciones.map((o, i) => `- ${o}: ${rs.filter((r) => r.valores?.opcion === i).length}`);
    return `${act.pregunta}\n${t.join("\n")}\n`;
  }
  return cols.map((c) => {
    const vs = rs.map((r) => ({ v: c.valor(r), r })).filter((x) => x.v);
    return `## ${c.titulo}\n${vs.map(({ v, r }) => `- ${v.replace(/\n+/g, " ")}${!act.anonimo && r.nombre ? ` (${r.nombre})` : ""}${r.grupo ? ` [grupo ${r.grupo}]` : ""}`).join("\n")}\n`;
  }).join("\n");
}

const aCSV = (filas) => "﻿" + filas.map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");

function bajar(nombre, contenido, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function copiar(texto, msg) {
  try { await navigator.clipboard.writeText(texto); toast(msg); }
  catch { prompt("Copiá el texto:", texto); }
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
