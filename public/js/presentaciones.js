// Mis presentaciones: crear, abrir, duplicar, renombrar, compartir con coeditores y borrar.
// El superadmin además ve todas y administra quién puede crear presentaciones.
import { cargarTaller, esc, qrSvg } from "./slides.js";
import { TALLER, codigoPara, contenidoInicial, cargarPresentacion } from "./presentacion.js";
import { avisoVersion } from "./version.js";
import * as fb from "./firebase.js";

const $app = document.getElementById("app");
const datos = await cargarTaller();
let user = await fb.usuarioActual();

if (!user || user.isAnonymous) login();
else iniciar();

function login(msg = "") {
  $app.innerHTML = `<div class="centro"><div class="caja">
    <div class="mono lima">// estudio taller</div>
    <h1>Mis presentaciones</h1>
    <p class="sec">Entrá con tu cuenta de Google para crear y presentar.</p>
    <div class="acciones"><button class="btn" id="g">entrar con google</button></div><p id="err" class="sec">${esc(msg)}</p></div></div>`;
  document.getElementById("g").onclick = async () => {
    try { user = await fb.entrarGoogle(); iniciar(); } catch (e) { document.getElementById("err").textContent = e.message; }
  };
}

async function iniciar() {
  avisoVersion();
  const admin = fb.esAdmin(user);
  const autorizado = admin || (await fb.getDoc(fb.refUsuario(user.email)).then((d) => d.exists()).catch(() => false));

  // El taller original no tenía ficha: la primera vez que entra el superadmin se crea a su nombre
  if (admin) {
    const m = await fb.getDoc(fb.refMeta(TALLER));
    if (!m.exists()) await fb.setDoc(fb.refMeta(TALLER), { titulo: datos.actividades.titulo, owner: user.uid, ownerEmail: user.email, editores: [], tema: "oscuro", creado: fb.serverTimestamp() });
  }

  $app.innerHTML = `<div class="admin">
    <header>
      <div class="titulo"><div class="mono lima">// estudio taller</div><h1>Mis presentaciones</h1></div>
      <span class="sec mono" style="font-size:13px">${esc(user.email)}${admin ? " · superadmin" : ""}</span>
      <button class="btn sec-btn chico" id="salir">salir</button>
    </header>
    ${autorizado ? `<form class="fila nueva-pres" id="fnueva">
      <input id="titulo-nueva" maxlength="80" placeholder="Título de la nueva presentación" required>
      <button class="btn" type="submit">+ crear presentación</button></form>` :
      `<p class="estado-err">Tu cuenta todavía no puede crear presentaciones. Pedíselo al administrador. Igual vas a ver acá las que compartan con vos.</p>`}
    <div class="pres-lista" id="lista"><p class="sec">cargando…</p></div>
    ${admin ? `<section class="usuarios"><h2>Personas que pueden crear presentaciones</h2>
      <form class="fila" id="fusuario"><input id="email-nuevo" type="email" placeholder="email de Google" required><button class="btn sec-btn" type="submit">autorizar</button></form>
      <div id="usuarios" class="sec">cargando…</div></section>` : ""}
  </div>`;
  document.getElementById("salir").onclick = async () => { await fb.salir(); location.reload(); };

  // ---- lista ----
  const porSid = new Map();
  const pintar = () => {
    const lista = [...porSid.values()].sort((a, b) => (b.creado?.toMillis?.() || 0) - (a.creado?.toMillis?.() || 0));
    document.getElementById("lista").innerHTML = lista.length ? lista.map(tarjeta).join("") : `<p class="sec">Todavía no tenés presentaciones.</p>`;
  };
  const escuchar = (q) => fb.onSnapshot(q, (qs) => {
    qs.docChanges().forEach((c) => (c.type === "removed" ? porSid.delete(c.doc.id) : porSid.set(c.doc.id, { sid: c.doc.id, ...c.doc.data() })));
    pintar();
  }, (e) => console.warn(e));
  if (admin) escuchar(fb.colPresentaciones());
  else {
    escuchar(fb.query(fb.colPresentaciones(), fb.where("owner", "==", user.uid)));
    escuchar(fb.query(fb.colPresentaciones(), fb.where("editores", "array-contains", user.email)));
  }

  function tarjeta(p) {
    const url = `${location.origin}/${p.sid}`;
    const mia = p.owner === user.uid || admin;
    const q = encodeURIComponent(p.sid);
    return `<article class="pres" data-sid="${esc(p.sid)}">
      <div class="pres-qr">${qrSvg(url)}</div>
      <div class="pres-info">
        <h3>${esc(p.titulo)}</h3>
        <div class="mono lima pres-url">${esc(url.replace(/^https?:\/\//, ""))}</div>
        <div class="sec pres-meta">${p.owner === user.uid ? "tuya" : `de ${esc(p.ownerEmail || "?")}`}${(p.editores || []).length ? ` · coeditores: ${esc(p.editores.join(", "))}` : ""} · tema ${esc(p.tema || "oscuro")}</div>
        <div class="acciones">
          <a class="btn chico" href="/presentar?s=${q}">presentar / editar</a>
          <a class="btn sec-btn chico" href="/admin?s=${q}" target="_blank">respuestas</a>
          <a class="btn sec-btn chico" href="/material?s=${q}" target="_blank">material</a>
          <a class="btn sec-btn chico" href="/pizarron?s=${q}" target="_blank">pizarrón</a>
        </div>
        <div class="acciones pres-mas">
          <button class="mini-txt" data-acc="renombrar">renombrar</button>
          ${autorizado ? `<button class="mini-txt" data-acc="duplicar">duplicar</button>` : ""}
          ${mia ? `<button class="mini-txt" data-acc="coeditores">coeditores</button>` : ""}
          <button class="mini-txt" data-acc="copiar">copiar enlace</button>
          ${mia && p.sid !== TALLER ? `<button class="mini-txt peligro" data-acc="borrar">borrar</button>` : ""}
        </div>
      </div></article>`;
  }

  document.getElementById("lista").onclick = async (ev) => {
    const b = ev.target.closest("[data-acc]");
    if (!b) return;
    const p = porSid.get(b.closest(".pres").dataset.sid);
    try {
      if (b.dataset.acc === "copiar") { await navigator.clipboard.writeText(`${location.origin}/${p.sid}`); return toast("Enlace copiado"); }
      if (b.dataset.acc === "renombrar") {
        const t = prompt("Nuevo título:", p.titulo);
        if (t?.trim()) await fb.updateDoc(fb.refMeta(p.sid), { titulo: t.trim() });
      }
      if (b.dataset.acc === "coeditores") {
        const t = prompt("Emails de Google que también pueden editar y presentar (separados por coma):", (p.editores || []).join(", "));
        if (t != null) await fb.updateDoc(fb.refMeta(p.sid), { editores: t.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean) });
      }
      if (b.dataset.acc === "duplicar") await duplicar(p);
      if (b.dataset.acc === "borrar") await borrar(p);
    } catch (e) { toast("No se pudo: " + e.message); }
  };

  // ---- crear / duplicar / borrar ----
  async function crear(titulo, contenido, tema = "oscuro") {
    const sid = codigoPara(titulo);
    await fb.setDoc(fb.refMeta(sid), { titulo, owner: user.uid, ownerEmail: user.email, editores: [], tema, creado: fb.serverTimestamp() });
    await fb.setDoc(fb.refContenido(sid), { json: JSON.stringify(contenido), actualizado: fb.serverTimestamp() });
    return sid;
  }
  const fnueva = document.getElementById("fnueva");
  if (fnueva) fnueva.onsubmit = async (ev) => {
    ev.preventDefault();
    const titulo = document.getElementById("titulo-nueva").value.trim();
    if (!titulo) return;
    try { location.href = `/presentar?s=${encodeURIComponent(await crear(titulo, contenidoInicial(titulo)))}`; }
    catch (e) { toast("No se pudo crear: " + e.message); }
  };
  async function duplicar(p) {
    const t = prompt("Título de la copia:", `${p.titulo} (copia)`);
    if (!t?.trim()) return;
    const pr = await cargarPresentacion(p.sid, datos);
    // Se copian diapositivas, notas y bloques; no las respuestas ni los pizarrones
    const sid = await crear(t.trim(), { diapositivas: pr.diapositivas, bloques: pr.bloquesLista }, p.tema || "oscuro");
    toast("Copia creada");
    return sid;
  }
  async function borrar(p) {
    if (prompt(`Esto borra «${p.titulo}» con sus respuestas y pizarrones, y no se puede deshacer.\nEscribí BORRAR para confirmar.`) !== "BORRAR") return;
    const borrarTodos = async (refs) => { for (let i = 0; i < refs.length; i += 400) { const b = fb.writeBatch(fb.db); refs.slice(i, i + 400).forEach((r) => b.delete(r)); await b.commit(); } };
    const docsDe = async (col) => (await fb.getDocs(col)).docs.map((d) => d.ref);
    const refs = [...(await docsDe(fb.refRespuestas(p.sid))), ...(await docsDe(fb.refPreguntasQA(p.sid))), ...(await docsDe(fb.refVotos(p.sid))), ...(await docsDe(fb.refVersiones(p.sid)))];
    for (const k of [1, 2, 3, 4]) refs.push(...(await docsDe(fb.refTrazos(p.sid, k))), fb.refPizarron(p.sid, k), fb.refVivo(p.sid, k));
    refs.push(fb.refContenido(p.sid), fb.refNav(p.sid), fb.refSesion(p.sid));
    await borrarTodos(refs);
    await fb.deleteDoc(fb.refMeta(p.sid));
    toast("Presentación borrada");
  }

  // ---- usuarios autorizados (solo superadmin) ----
  if (admin) {
    fb.onSnapshot(fb.colUsuarios(), (qs) => {
      const $u = document.getElementById("usuarios");
      $u.innerHTML = qs.empty ? "Nadie más todavía." : qs.docs.map((d) => `<div class="fila-usuario"><span>${esc(d.id)}</span><button class="mini-txt peligro" data-quitar="${esc(d.id)}">quitar</button></div>`).join("");
      $u.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = async () => { if (confirm(`¿Quitar a ${b.dataset.quitar}? Sus presentaciones siguen existiendo.`)) await fb.deleteDoc(fb.refUsuario(b.dataset.quitar)); }));
    });
    document.getElementById("fusuario").onsubmit = async (ev) => {
      ev.preventDefault();
      const email = document.getElementById("email-nuevo").value.trim().toLowerCase();
      try { await fb.setDoc(fb.refUsuario(email), { agregado: fb.serverTimestamp(), por: user.email }); document.getElementById("email-nuevo").value = ""; }
      catch (e) { toast(e.message); }
    };
  }
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
