// Presentador. Dos modos en la misma página:
//  · consola  (/presentar)               : controla todo, edita contenido y notas, guarda el estado en Firestore.
//  · pantalla (/presentar?modo=pantalla) : solo dibuja lo que manda la consola (para el proyector).
// Consola y pantalla hablan por BroadcastChannel: cada cambio (diapositiva, paso, edición) llega al instante.
import { cargarTaller, renderSlide, contarPasos, montar, encajar, esc, tituloDe, usarTema, qrSvg, TEMAS, TEMAS_NOMBRES } from "./slides.js";
import { armarPresentacion, mapaBloques, nuevoId, TALLER } from "./presentacion.js";
import { GALERIA } from "./plantillas-base.js";
import { campo, valorDe, OCULTOS } from "./editor.js";
import { aLibre, htmlAMarcas, elementoNuevo, nuevoIdEl } from "./libre.js";
import { textoDePizarron, maquetarTexto } from "./pizarron-comun.js";
import { vigilarVersion, avisoVersion } from "./version.js";
import { aplicarRevisiones, codigoSesion, urlParticipante, visibles, numeroDe, resolverActividades, actividadPorId, actividadQueAbre, actividadDeDiapositiva, muroDeDiapositiva, calcular, resultadosPublicos, claveDestacada } from "./actividades.js";

const $app = document.getElementById("app");
const datos = await cargarTaller();
let def = datos.actividades;
const sid = codigoSesion(def);
const joinUrl = urlParticipante(sid);
const canal = new BroadcastChannel(`estudiotaller-${sid}`);
let base = { bloques: datos.bloques, joinUrl }; // la consola lo completa con los bloques y el tema de la presentación
const TECLAS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", " ", "PageDown", "PageUp", "Home", "End", "Enter", "Backspace"]);
const LETRAS = "rRqQbBaAcC.1234";

if (new URLSearchParams(location.search).get("modo") === "pantalla") pantalla();
else consola();

// =====================================================================
// PANTALLA (proyector)
// =====================================================================
function pantalla() {
  document.title = "Pantalla · Estudio Taller";
  $app.innerHTML = `<div class="pantalla"><div class="stage" id="st"></div></div><div class="aviso" id="aviso">clic o <b>F</b> para pantalla completa · las flechas también funcionan acá</div>`;
  const st = document.getElementById("st");
  const aviso = document.getElementById("aviso");
  let conectada = false;

  canal.onmessage = ({ data }) => {
    if (data.t === "recargar") return location.reload(); // la consola se actualizó a una versión nueva
    if (data.t !== "estado") return;
    conectada = true;
    montar(st, renderSlide(data.vista.s, { ...base, ...data.vista }));
  };
  canal.postMessage({ t: "hola" });
  setTimeout(() => {
    if (!conectada) montar(st, renderSlide(null, base)), (aviso.textContent = "Esperando la consola del presentador… (abrí /presentar en otra ventana)");
  }, 1500);

  const completa = async () => {
    if (document.fullscreenElement) return;
    try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch (e) { console.warn(e); }
  };
  document.addEventListener("fullscreenchange", () => (aviso.hidden = !!document.fullscreenElement));
  document.addEventListener("click", completa);
  document.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : completa(); return; }
    if (TECLAS.has(e.key) || LETRAS.includes(e.key)) { e.preventDefault(); canal.postMessage({ t: "tecla", key: e.key }); }
  });
  addEventListener("resize", () => encajar(st));
  // Versión nueva: si no está a pantalla completa se recarga sola; si lo está, espera a que se recargue la consola
  vigilarVersion(() => { if (!document.fullscreenElement) location.reload(); });
}

// =====================================================================
// CONSOLA
// =====================================================================
async function consola() {
  const fb = await import("./firebase.js");
  let user = await fb.usuarioActual();
  const snapMeta = await fb.getDoc(fb.refMeta(sid)).catch(() => null);
  const meta = snapMeta?.exists() ? snapMeta.data() : null;
  if (!fb.puedeEditar(user, meta)) {
    $app.innerHTML = `<div class="centro"><div class="caja">
      <div class="mono lima">// estudio taller · presentador</div>
      <h1>Entrá con tu cuenta de Google</h1>
      <p class="sec">La consola solo la pueden usar quienes editan esta presentación.</p>
      ${user && !user.isAnonymous ? `<p class="sec">Entraste como <b>${esc(user.email)}</b>, que no puede editarla. <a href="/presentaciones">Ver mis presentaciones</a></p>` : ""}
      <div class="acciones"><button class="btn" id="g">entrar con google</button></div>
      <p id="err" class="sec"></p></div></div>`;
    document.getElementById("g").onclick = async () => {
      try { user = await fb.entrarGoogle(); if (fb.puedeEditar(user, meta)) location.reload(); else document.getElementById("err").textContent = `${user.email} no puede editar esta presentación.`; }
      catch (e) { document.getElementById("err").textContent = e.message; }
    };
    return;
  }

  // ---- contenido (editado en Firestore, o el JSON publicado) ----
  const guardado = fb.leerContenido(await fb.getDoc(fb.refContenido(sid)));
  const pres = armarPresentacion(sid, datos, guardado, meta);
  let diapos = pres.diapositivas;
  const bloquesLista = pres.bloquesLista;
  def = pres.def;
  let tema = pres.tema;
  const actualizadas = guardado && pres.esTaller ? aplicarRevisiones(diapos, datos.diapositivas) : [];
  base = { ...base, bloques: mapaBloques(bloquesLista), tema };
  usarTema(tema);
  document.title = `Presentar · ${pres.titulo}`;
  let acts = resolverActividades(def, diapos);
  const porId = (id) => diapos.find((s) => s.id === id);
  const vis = () => visibles(diapos);

  // ---- estado de la sesión ----
  const ref = fb.refSesion(sid), refNav = fb.refNav(sid);
  const [snap, snapNav] = await Promise.all([fb.getDoc(ref), fb.getDoc(refNav)]);
  const ses = snap.data() || {}, nav = snapNav.data() || {};
  let e = {
    actividad: ses.actividad ?? null, abierta: !!ses.abierta, compartida: ses.compartida ?? null,
    actual: nav.actual ?? null, paso: nav.paso ?? 0, revelar: !!nav.revelar, destacadas: nav.destacadas ?? [], pizarron: nav.pizarron ?? null,
  };
  if (!porId(e.actual)) e.actual = (vis()[0] || diapos[0]).id;
  const separar = (campos) => {
    const n = {}, s = {};
    Object.entries(campos).forEach(([k, v]) => ((fb.CAMPOS_NAV.includes(k) ? n : s)[k] = v));
    return [n, s];
  };
  {
    const [n, s] = separar(e);
    await Promise.all([fb.setDoc(refNav, { ...n, actualizado: fb.serverTimestamp() }), fb.setDoc(ref, { ...s, actualizado: fb.serverTimestamp() })]);
  }
  let overlay = null; // 'qr' | 'negro' | null (solo local)
  let respuestas = [];
  let tabPregunta = null;
  let pantallaWin = null;
  let editando = false;

  const guardar = (campos) => {
    Object.assign(e, campos);
    const [n, s] = separar(campos);
    const err = (x) => toast("No se pudo guardar el estado: " + x.message);
    if (Object.keys(n).length) fb.updateDoc(refNav, { ...n, actualizado: fb.serverTimestamp() }).catch(err);
    if (Object.keys(s).length) fb.updateDoc(ref, { ...s, actualizado: fb.serverTimestamp() }).catch(err);
  };
  let tGuardar = null;
  const guardarContenido = () => {
    clearTimeout(tGuardar);
    document.getElementById("guardado").textContent = "guardando…";
    tGuardar = setTimeout(async () => {
      try {
        await fb.setDoc(fb.refContenido(sid), { json: JSON.stringify({ diapositivas: diapos, bloques: bloquesLista, actividades: def.actividades, muros: def.muros }), actualizado: fb.serverTimestamp() });
        document.getElementById("guardado").textContent = "guardado ✓";
      } catch (err) { document.getElementById("guardado").textContent = "error al guardar"; toast(err.message); }
    }, 700);
  };

  // Pizarrones: la consola los escucha para mandarlos al proyector; la tablet puede mostrarlos u ocultarlos
  const pz = { 1: {}, 2: {}, 3: {}, 4: {} };
  [1, 2, 3, 4].forEach((k) => {
    const cambio = () => { if (e.pizarron === k) render(); };
    fb.onSnapshot(fb.consultaTrazos(sid, k), (qs) => { pz[k].trazos = qs.docs.map((d) => d.data()); cambio(); });
    fb.onSnapshot(fb.refVivo(sid, k), (snap) => {
      const d = snap.data() || null;
      pz[k].vivo = d;
      pz[k].palabrasVivo = d?.palabras ? JSON.parse(d.palabras) : null; // palabras mientras se arrastran
      cambio();
    });
    fb.onSnapshot(fb.refPizarron(sid, k), async (snap) => {
      const d = snap.data();
      if (d?.palabras) pz[k].palabras = JSON.parse(d.palabras);
      else if (!snap.metadata.hasPendingWrites && textoDePizarron(k, diapos)) {
        pz[k].palabras = await maquetarTexto(textoDePizarron(k, diapos));
        fb.setDoc(fb.refPizarron(sid, k), { palabras: JSON.stringify(pz[k].palabras), actualizado: fb.serverTimestamp() });
      }
      cambio();
    });
  });
  // La tablet puede mostrar/ocultar un pizarrón y compartirlo con los celulares
  fb.onSnapshot(refNav, (snap) => {
    const p = snap.data()?.pizarron ?? null;
    if (p !== e.pizarron) { e.pizarron = p; if (p) overlay = null; render(); }
  });
  fb.onSnapshot(ref, (snap) => {
    const c = snap.data()?.compartida ?? null;
    if (JSON.stringify(c) !== JSON.stringify(e.compartida)) { e.compartida = c; render(); }
  });

  fb.onSnapshot(fb.refRespuestas(sid), (qs) => {
    respuestas = qs.docs.map((d) => ({ _id: d.id, ...d.data() })).sort((a, b) => (a.ts?.toMillis?.() || 0) - (b.ts?.toMillis?.() || 0));
    render();
  }, (err) => toast("Error leyendo respuestas: " + err.message));

  // ---- UI ----
  $app.innerHTML = `<div class="consola">
    <div class="barra">
      <span class="titulo"><a href="/presentaciones" title="Mis presentaciones">// estudio taller</a> · ${esc(pres.titulo)}</span>
      <button class="btn sec-btn chico" id="ant">←</button><span class="pos" id="pos"></span><button class="btn sec-btn chico" id="sig">→</button>
      <button class="btn sec-btn chico" id="bidx">índice</button>
      <button class="btn sec-btn chico" id="bqr" title="Q">qr</button>
      <button class="btn sec-btn chico" id="bneg" title="B">negro</button>
      <span class="grupo-pz"><span class="rotulo">pizarrón</span>${[1, 2, 3, 4].map((k) => `<button class="btn sec-btn chico" data-pz="${k}" title="tecla ${k}">${k}</button>`).join("")}<a class="btn sec-btn chico" href="/pizarron?s=${encodeURIComponent(sid)}" target="_blank" title="Abrir en la tablet">✎</a></span>
      <button class="btn sec-btn chico" id="bcomp" title="C">compartir en celulares</button>
      <button class="btn chico" id="proy">proyectar ⧉</button>
      <a class="btn sec-btn chico" href="/admin?s=${encodeURIComponent(sid)}" target="_blank">admin</a>
    </div>
    <div class="cuerpo">
      <div class="col-izq">
        <div class="herramientas">
          <span class="rotulo" id="rot-actual">en pantalla</span>
          <label class="interruptor" title="Mostrar el contenido de a poco, con las flechas"><input type="checkbox" id="chk-pasos"> por pasos <span id="info-pasos" class="sec"></span></label>
          <label class="interruptor" title="Las ocultas se saltean al presentar"><input type="checkbox" id="chk-oculta"> ocultar diapositiva</label>
          <button class="btn sec-btn chico" id="beditar">✎ editar contenido</button>
          <button class="btn sec-btn chico" id="bliberar" title="Convertirla en diapositiva libre: mover y redimensionar cada elemento">⤧ liberar</button>
          <button class="btn sec-btn chico" id="bnueva" title="Agregar una diapositiva después de esta">+ diapositiva</button>
          <button class="btn sec-btn chico" id="bdup" title="Duplicar esta diapositiva">⧉</button>
          <button class="btn sec-btn chico peligro" id="bborrar" title="Borrar esta diapositiva">✕</button>
          <span class="rotulo" id="guardado"></span>
          <span class="aviso-cabe" id="aviso-cabe" hidden></span>
        </div>
        <div class="stage" id="st"></div>
      </div>
      <div class="col-der">
        <div class="rotulo" id="der-titulo">siguiente</div>
        <div id="der" class="der"></div>
        <div class="rotulo">notas <span class="sec">(se guardan solas)</span></div>
        <textarea class="notas" id="notas" spellcheck="true"></textarea>
        <div class="teclas"><kbd>←</kbd><kbd>→</kbd> mover · <kbd>R</kbd> resultados · <kbd>A</kbd> abrir/cerrar actividad · <kbd>C</kbd> compartir · <kbd>1</kbd>–<kbd>4</kbd> pizarrones · <kbd>Q</kbd> qr · <kbd>B</kbd> negro · en la pantalla: <kbd>F</kbd> completa</div>
      </div>
    </div>
    <div class="panel-act" id="panel"></div>
  </div>
  <div class="modal" id="modal" hidden></div>`;
  const st = document.getElementById("st");
  const $der = document.getElementById("der");
  document.getElementById("ant").onclick = anterior;
  document.getElementById("sig").onclick = siguiente;
  document.getElementById("bqr").onclick = () => tecla("q");
  document.getElementById("bneg").onclick = () => tecla("b");
  document.getElementById("bcomp").onclick = () => tecla("c");
  document.getElementById("bidx").onclick = indice;
  document.querySelectorAll("[data-pz]").forEach((b) => (b.onclick = () => tecla(b.dataset.pz)));
  document.getElementById("proy").onclick = proyectar;
  document.getElementById("beditar").onclick = () => { editando = !editando; render(); };
  document.getElementById("bnueva").onclick = () => galeria(e.actual);
  document.getElementById("bdup").onclick = () => duplicar(e.actual);
  document.getElementById("bborrar").onclick = () => borrar(e.actual);
  document.getElementById("bliberar").onclick = liberar;
  document.getElementById("chk-pasos").onchange = (ev) => {
    const s = porId(e.actual);
    if (ev.target.checked) s.pasos = true; else delete s.pasos;
    guardarContenido();
    guardar({ paso: 0 });
    render();
  };
  document.getElementById("chk-oculta").onchange = (ev) => {
    const s = porId(e.actual);
    if (ev.target.checked) s.oculta = true; else delete s.oculta;
    guardarContenido();
    render();
  };
  document.getElementById("notas").oninput = (ev) => {
    porId(e.actual).notas = ev.target.value;
    guardarContenido();
  };
  addEventListener("resize", () => { encajar(st); const n = $der.querySelector(".stage"); if (n) encajar(n); });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.closest?.("input, textarea, select") || ev.target.isContentEditable) return;
    if (atajoLibre(ev)) return;
    if (!document.getElementById("modal").hidden) { if (ev.key === "Escape") cerrarModal(); return; }
    if (TECLAS.has(ev.key) || LETRAS.includes(ev.key)) { ev.preventDefault(); tecla(ev.key); }
  });
  canal.onmessage = ({ data }) => {
    if (data.t === "hola") difundir();
    if (data.t === "tecla") tecla(data.key);
  };

  function tecla(k) {
    switch (k) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown": case "Enter": return siguiente();
      case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace": return anterior();
      case "Home": return irA(vis()[0]?.id, 0);
      case "End": return irA(vis().at(-1)?.id, 0);
      case "r": case "R": return actDeDiapositiva() && (guardar({ revelar: !e.revelar }), render());
      case "a": case "A": return alternarAbierta();
      case "c": case "C": return alternarCompartir();
      case "q": case "Q": overlay = overlay === "qr" ? null : "qr"; if (e.pizarron) guardar({ pizarron: null }); return render();
      case "b": case "B": case ".": overlay = overlay === "negro" ? null : "negro"; if (e.pizarron) guardar({ pizarron: null }); return render();
      case "1": case "2": case "3": case "4": overlay = null; guardar({ pizarron: e.pizarron === +k ? null : +k }); return render();
    }
  }

  // ---- navegación (con pasos y diapositivas ocultas) ----
  const pasosDe = (s) => (s?.pasos ? contarPasos(s, { ...base, numero: 1, total: 1 }) : 0);
  function vecino(d) {
    const i = diapos.findIndex((s) => s.id === e.actual);
    for (let j = i + d; j >= 0 && j < diapos.length; j += d) if (!diapos[j].oculta) return diapos[j].id;
    return null;
  }
  function siguiente() {
    if (e.pizarron) { guardar({ pizarron: null }); return render(); }
    if (overlay) { overlay = null; return render(); }
    const s = porId(e.actual);
    if (s.pasos && e.paso < pasosDe(s) && !e.revelar) return (guardar({ paso: e.paso + 1 }), render());
    irA(vecino(+1), 0);
  }
  function anterior() {
    if (e.pizarron) { guardar({ pizarron: null }); return render(); }
    if (overlay) { overlay = null; return render(); }
    const s = porId(e.actual);
    if (s.pasos && e.paso > 0 && !e.revelar) return (guardar({ paso: e.paso - 1 }), render());
    const id = vecino(-1);
    irA(id, pasosDe(porId(id)));
  }
  function irA(id, paso = 0) {
    if (!id) return;
    const campos = { actual: id, paso, revelar: false, pizarron: null };
    const abre = actividadQueAbre(acts, id);
    if (abre && abre.id !== e.actividad) Object.assign(campos, { actividad: abre.id, abierta: true });
    overlay = null;
    tabPregunta = null;
    guardar(campos);
    render();
  }

  const actDeDiapositiva = () => actividadDeDiapositiva(acts, e.actual);
  const actDelPanel = () => {
    const m = muroDeDiapositiva(def, e.actual);
    return m ? actividadPorId(acts, m.actividad) : actDeDiapositiva() || (e.actividad ? actividadPorId(acts, e.actividad) : null);
  };

  function alternarAbierta() {
    const a = actDelPanel();
    if (!a) return;
    if (e.actividad === a.id) guardar({ abierta: !e.abierta });
    else guardar({ actividad: a.id, abierta: true });
    render();
  }

  // ---- compartir la vista actual en los celulares ----
  const vistaPublica = (v) => {
    // El pizarrón no viaja en la vista: los celulares escuchan sus trazos directamente
    if (v.overlay === "pizarron") return { overlay: "pizarron", pizarron: { n: v.pizarron.n } };
    const { notas, ...s } = v.s;
    return { ...v, s, res: v.act ? resultadosPublicos(v.act, v.res) : null, contador: null, overlay: v.overlay === "qr" ? "qr" : null };
  };
  const claveVista = () => (e.pizarron ? `pizarron:${e.pizarron}` : e.actual);
  const compartiendoEsta = () => e.compartida && e.compartida.id === claveVista();
  let ultimaCompartida = null, tComp = null;
  function alternarCompartir() {
    clearTimeout(tComp);
    if (compartiendoEsta()) guardar({ compartida: null });
    else {
      ultimaCompartida = JSON.stringify(vistaPublica(vista()));
      guardar({ compartida: { id: claveVista(), json: ultimaCompartida } });
    }
    render();
  }
  // (se guarda como texto JSON: Firestore no admite listas dentro de listas, como las celdas de «clasificar»)
  // Mientras se comparte la diapositiva que está en pantalla, los celulares siguen sus cambios (resultados, pasos, ediciones)
  function actualizarCompartida(v) {
    if (!compartiendoEsta()) return;
    const pub = JSON.stringify(vistaPublica(v));
    if (pub === ultimaCompartida) return;
    clearTimeout(tComp);
    tComp = setTimeout(() => { ultimaCompartida = pub; guardar({ compartida: { id: claveVista(), json: pub } }); }, 800);
  }

  // ---- vista que se dibuja (consola, pantalla y celulares) ----
  function vista() {
    const s = porId(e.actual);
    const act = actDeDiapositiva();
    const activa = e.actividad ? actividadPorId(acts, e.actividad) : null;
    let muro = null;
    const m = muroDeDiapositiva(def, e.actual);
    if (m) {
      const rid = Object.fromEntries(respuestas.map((r) => [r._id, r]));
      muro = (e.destacadas || []).map((k) => {
        const [id, q] = k.split("#");
        const r = rid[id];
        return r && r.actividad === m.actividad && +q === m.pregunta ? (r.valores?.[q] || "").trim() : null;
      }).filter(Boolean);
    }
    return {
      s,
      numero: numeroDe(diapos, s.id),
      total: vis().length,
      act,
      res: act ? calcular(act, respuestas) : null,
      revelar: !!e.revelar && !!act,
      muro,
      contador: activa && e.abierta ? calcular(activa, respuestas).total : null,
      overlay: e.pizarron ? "pizarron" : overlay,
      pizarron: e.pizarron ? { n: e.pizarron, ...pz[e.pizarron], palabras: pz[e.pizarron].palabrasVivo || pz[e.pizarron].palabras } : null,
      paso: s.pasos ? e.paso : null,
      bloques: base.bloques,
      tema,
    };
  }

  function difundir(v = vista()) { canal.postMessage({ t: "estado", vista: v }); }

  function render() {
    const v = vista();
    const s = v.s;
    difundir(v);
    actualizarCompartida(v);
    if (!enLugar) escenario(v);
    const totalPasos = +st.querySelector(".slide").dataset.pasos;
    document.getElementById("pos").textContent = v.numero ? `${v.numero} / ${v.total}` : "oculta";
    document.getElementById("rot-actual").textContent = `en pantalla${e.pizarron ? ` · PIZARRÓN ${e.pizarron}` : overlay === "qr" ? " · QR" : overlay === "negro" ? " · NEGRO" : ""}${v.revelar ? " · resultados" : ""}`;
    document.querySelectorAll("[data-pz]").forEach((b) => b.classList.toggle("activo", +b.dataset.pz === e.pizarron));
    const chk = document.getElementById("chk-pasos");
    chk.checked = !!s.pasos;
    chk.disabled = !totalPasos && !s.pasos;
    document.getElementById("info-pasos").textContent = s.pasos ? `(${e.paso}/${totalPasos})` : totalPasos ? "" : "(no aplica)";
    document.getElementById("chk-oculta").checked = !!s.oculta;
    document.getElementById("bqr").classList.toggle("activo", overlay === "qr");
    document.getElementById("bneg").classList.toggle("activo", overlay === "negro");
    const bc = document.getElementById("bcomp");
    bc.classList.toggle("activo", !!e.compartida);
    const enCel = (id) => (id.startsWith("pizarron:") ? `pizarrón ${id.split(":")[1]}` : numeroDe(diapos, id) ?? "?");
    bc.textContent = compartiendoEsta() ? "● compartiendo · dejar" : e.compartida ? `compartir esta (en celulares: ${enCel(e.compartida.id)})` : "compartir en celulares";
    document.getElementById("beditar").classList.toggle("activo", editando);
    document.getElementById("bliberar").hidden = s.plantilla === "libre";
    st.classList.toggle("editable", editando);
    st.classList.toggle("libre", editando && s.plantilla === "libre");
    const notas = document.getElementById("notas");
    if (document.activeElement !== notas || notas.dataset.id !== s.id) { notas.value = s.notas || ""; notas.dataset.id = s.id; }

    if (editando) {
      document.getElementById("der-titulo").textContent = `editar · ${s.plantilla} · ${s.id}`;
      if ($der.dataset.id !== s.id + s.plantilla || !$der.querySelector(".editor")) pintarEditor(s);
    } else {
      document.getElementById("der-titulo").textContent = "siguiente";
      const sigId = vecino(+1), sig = sigId && porId(sigId);
      $der.dataset.id = "";
      $der.innerHTML = `<div class="stage" id="st2"></div>`;
      montar(document.getElementById("st2"), sig ? renderSlide(sig, { ...base, numero: numeroDe(diapos, sig.id), total: v.total }) : renderSlide(null, base));
    }
    panel();
  }

  // ---- editor de contenido ----
  function pintarEditor(s) {
    if (s.plantilla === "libre") return pintarEditorLibre(s);
    $der.dataset.id = s.id + s.plantilla;
    $der.innerHTML = `<div class="editor">
      <p class="ayuda"><b>${esc(GALERIA.find((g) => g.s.plantilla === s.plantilla)?.nombre || s.plantilla)}</b> <span class="sec">· ${esc(datos.plantilla.plantillas[s.plantilla]?.uso || "")}</span></p>
      <p class="sec ayuda">Los cambios se ven al instante y quedan guardados. <code>**así**</code> resalta, <code>*así*</code> va en cursiva, Enter = salto de línea.</p>
      <label class="ed-campo"><span class="rotulo">bloque</span><select data-bloque>${bloquesLista.map((b) => `<option value="${esc(b.id)}" ${b.id === s.bloque ? "selected" : ""}>${esc(`${b.id} · ${b.nombre}`)}</option>`).join("")}<option value="">— sin bloque —</option></select></label>
      ${Object.entries(s).filter(([k]) => !OCULTOS.has(k)).map(([k, v]) => campo(k, k, v)).join("")}
      <div class="ed-act" id="ed-act"></div>
    </div>`;
    pintarActividad(s);
    const $ed = $der.querySelector(".editor");
    $ed.oninput = $ed.onchange = (ev) => {
      if (ev.target.matches("[data-bloque]")) { s.bloque = ev.target.value; return despuesDeEditar(); }
      const el = ev.target.closest("[data-path]");
      if (!el) return;
      const ruta = el.dataset.path.split(".");
      let obj = s;
      ruta.slice(0, -1).forEach((p) => (obj = obj[p]));
      obj[ruta.at(-1)] = valorDe(el);
      despuesDeEditar();
    };
    $ed.onclick = (ev) => {
      const alt = ev.target.closest("[data-alternar]");
      if (alt) {
        // texto ⇄ lista (p. ej. el apoyo de una frase)
        const ruta = alt.dataset.alternar.split("."), k = ruta.pop();
        const obj = ruta.reduce((o, p) => o[p], s);
        obj[k] = Array.isArray(obj[k]) ? obj[k].join(" · ") : String(obj[k] || "").split(/\n| · /).filter(Boolean);
        pintarEditor(s);
        return despuesDeEditar();
      }
      const q = ev.target.closest("[data-quitar]"), a = ev.target.closest("[data-agregar]");
      if (!q && !a) return;
      const arr = (q || a).dataset[q ? "quitar" : "agregar"].split(".").reduce((o, p) => o[p], s);
      if (q) arr.splice(+q.dataset.i, 1);
      else {
        const molde = Object.fromEntries([...new Set(arr.flatMap((o) => Object.keys(o)))].map((k) => [k, typeof arr[0]?.[k] === "number" ? 0 : k === "color" ? arr.at(-1)?.color || "lima" : ""]));
        arr.push(molde);
      }
      pintarEditor(s);
      despuesDeEditar();
    };
  }
  // ---- actividad de la diapositiva: votación, preguntas abiertas, clasificar o muro de respuestas ----
  const TIPOS = [["", "ninguna"], ["votacion", "votación (elegir una opción)"], ["abiertas", "preguntas abiertas"], ["clasificar", "clasificar en columnas"]];
  const textosDe = (arr) => (arr || []).map((x) => (typeof x === "string" ? x : x.texto || "")).filter(Boolean);
  function nuevaActividad(tipo, s) {
    const a = { id: "a" + nuevoId().slice(1), tipo, titulo: tituloDe(s).slice(0, 60) || "Actividad", diapositiva: s.id };
    if (tipo === "votacion") {
      if (s.plantilla === "pregunta" && s.opciones?.length) a.desde = s.id;
      else Object.assign(a, { pregunta: tituloDe(s), opciones: ["Sí", "No"] });
    }
    if (tipo === "abiertas") {
      const propias = textosDe(s.plantilla === "qr" ? s.preguntas : s.items);
      Object.assign(a, propias.length ? { preguntas_de: s.id } : { preguntas: ["¿…?"] }, { anonimo: true });
    }
    if (tipo === "clasificar") {
      const items = textosDe(s.items);
      Object.assign(a, { items: items.length ? items : ["Ítem 1", "Ítem 2"], columnas: ["Columna 1", "Columna 2", "Columna 3", "Columna 4"], colores: ["lima", "fucsia", "celeste", "verde"], por_grupo: true });
    }
    return a;
  }
  function pintarActividad(s) {
    const $a = document.getElementById("ed-act");
    if (!$a) return;
    const a = def.actividades.find((x) => x.diapositiva === s.id);
    const m = def.muros.find((x) => x.diapositiva === s.id);
    const r = a && acts.find((x) => x.id === a.id);
    const n = a ? respuestas.filter((x) => x.actividad === a.id).length : 0;
    const tipos = s.plantilla === "en_vivo" ? [...TIPOS, ["muro", "mostrar respuestas destacadas"]] : TIPOS;
    const tipo = a?.tipo || (m ? "muro" : "");
    const origen = (k) => a?.[k] && a[k] !== s.id ? ` <span class="sec">· salen de la diapositiva ${numeroDe(diapos, a[k]) ?? "?"}; si las cambiás acá, quedan propias</span>` : "";
    const lineas = (k, etq, vals, extra = "") => `<label class="ed-campo"><span class="rotulo">${etq} <span class="sec">· una por línea</span>${extra}</span><textarea rows="${Math.max(2, vals.length + 1)}" data-act="${k}">${esc(vals.join("\n"))}</textarea></label>`;
    let cuerpo = "";
    if (a) {
      cuerpo += `<label class="ed-campo"><span class="rotulo">nombre <span class="sec">· se ve en el celular y en «respuestas»</span></span><input data-act="titulo" value="${esc(a.titulo || "")}"></label>`;
      if (a.tipo === "votacion") cuerpo += a.desde
        ? `<p class="sec ayuda">Usa la pregunta y las opciones ${a.desde === s.id ? "de esta diapositiva" : `de la diapositiva ${numeroDe(diapos, a.desde) ?? "?"}`}. Al mostrar resultados (R), las opciones se llenan con los porcentajes.</p>`
        : `<label class="ed-campo"><span class="rotulo">pregunta</span><input data-act="pregunta" value="${esc(r?.pregunta || "")}"></label>${lineas("opciones", "opciones", r?.opciones || [])}`;
      if (a.tipo === "abiertas") cuerpo += lineas("preguntas", "preguntas", r?.preguntas || [], origen("preguntas_de"))
        + `<label class="interruptor"><input type="checkbox" data-act-si="anonimo" ${a.anonimo ? "checked" : ""}> anónima (no guarda nombres)</label>`;
      if (a.tipo === "clasificar") cuerpo += lineas("items", "ítems para ubicar", r?.items || [], origen("items_de")) + lineas("columnas", "columnas", r?.columnas || [], origen("columnas_de"))
        + `<label class="interruptor"><input type="checkbox" data-act-si="por_grupo" ${a.por_grupo ? "checked" : ""}> responden por grupo (A–D)</label>`;
      cuerpo += `<label class="ed-campo"><span class="rotulo">mostrar resultados también en <span class="sec">· con R</span></span><select data-act="resultados"><option value="">— solo en esta —</option>${diapos.filter((x) => x.id !== s.id).map((x) => `<option value="${x.id}" ${(a.resultados_en || []).includes(x.id) ? "selected" : ""}>${numeroDe(diapos, x.id) ?? "oculta"} · ${esc(tituloDe(x).slice(0, 40))}</option>`).join("")}</select></label>`;
      cuerpo += `<p class="sec ayuda">Se abre sola al llegar a esta diapositiva. ${n} respuesta${n === 1 ? "" : "s"}.</p>`;
    } else if (m) {
      const abiertas = acts.filter((x) => x.tipo === "abiertas");
      const am = acts.find((x) => x.id === m.actividad);
      cuerpo += `<label class="ed-campo"><span class="rotulo">respuestas de</span><select data-muro="actividad">${abiertas.map((x) => `<option value="${x.id}" ${x.id === m.actividad ? "selected" : ""}>${esc(x.titulo)}</option>`).join("")}</select></label>
        <label class="ed-campo"><span class="rotulo">pregunta</span><select data-muro="pregunta">${(am?.preguntas || []).map((q, i) => `<option value="${i}" ${i === m.pregunta ? "selected" : ""}>${String(i + 1).padStart(2, "0")} · ${esc(q.slice(0, 50))}</option>`).join("")}</select></label>
        <p class="sec ayuda">En esta diapositiva, tocá ★ en el panel de abajo para mostrar respuestas en los renglones.</p>`;
    }
    $a.innerHTML = `<div class="rotulo lima">actividad en esta diapositiva</div>
      <label class="ed-campo"><select data-act-tipo>${tipos.map(([v, t]) => `<option value="${v}" ${v === tipo ? "selected" : ""}>${t}</option>`).join("")}</select></label>${cuerpo}`;

    $a.onchange = $a.oninput = (ev) => {
      const el = ev.target;
      if (el.matches("[data-act-tipo]")) {
        if (ev.type !== "change") return;
        if (a && n && !confirm(`Esta actividad tiene ${n} respuesta${n === 1 ? "" : "s"}. ¿Cambiarla igual? (las respuestas quedan en «respuestas», pero dejan de verse acá)`)) return pintarActividad(s);
        def.actividades = def.actividades.filter((x) => x.diapositiva !== s.id);
        def.muros = def.muros.filter((x) => x.diapositiva !== s.id);
        if (el.value === "muro") {
          const ab = acts.find((x) => x.tipo === "abiertas");
          if (!ab) { toast("Primero creá una actividad de preguntas abiertas en otra diapositiva."); return pintarActividad(s); }
          def.muros.push({ diapositiva: s.id, actividad: ab.id, pregunta: 0 });
        } else if (el.value) def.actividades.push(nuevaActividad(el.value, s));
        despuesDeEditar();
        return pintarActividad(s);
      }
      if (el.dataset.muro && m) { m[el.dataset.muro] = el.dataset.muro === "pregunta" ? +el.value : el.value; if (el.dataset.muro === "actividad") m.pregunta = 0; despuesDeEditar(); return pintarActividad(s); }
      if (!a) return;
      const k = el.dataset.act, si = el.dataset.actSi;
      if (si) a[si] = el.checked;
      else if (k === "titulo") a.titulo = el.value;
      else if (k === "pregunta") { a.pregunta = el.value; }
      else if (k === "resultados") a.resultados_en = el.value ? [el.value] : [];
      else if (["opciones", "preguntas", "items", "columnas"].includes(k)) {
        a[k] = el.value.split("\n").filter((x) => x.trim());
        delete a[{ preguntas: "preguntas_de", items: "items_de", columnas: "columnas_de" }[k]];
        if (k === "columnas") a.colores = a[k].map((_, i) => a.colores?.[i] || ["lima", "fucsia", "celeste", "verde"][i % 4]);
      }
      despuesDeEditar();
    };
  }

  // =================================================================
  // Edición sobre la diapositiva: texto en el lugar (doble clic) y diapositivas libres
  // =================================================================
  let enLugar = null; // hay un texto editándose en la diapositiva: función que lo termina (guardando o no)
  let selEl = null;   // elemento seleccionado (diapositivas libres)
  let arrastre = null;
  const actualS = () => porId(e.actual);
  const esLibre = () => editando && actualS()?.plantilla === "libre";
  const elSel = () => (actualS().elementos || []).find((x) => x.id === selEl) || null;
  const r2 = (n) => Math.round(n * 100) / 100;

  // Un clic fuera del texto que se está escribiendo lo termina y guarda (las actualizaciones automáticas no lo cortan)
  document.addEventListener("pointerdown", (ev) => { if (enLugar && !ev.target.closest(".editando-texto")) enLugar(true); }, true);
  function escenario(v = vista()) {
    if (enLugar) return enLugar(true); // termina (y guarda) la edición en curso; eso vuelve a dibujar
    montar(st, renderSlide(v.s, { ...base, ...v }));
    revisarQueQuepa();
    dibujarSeleccion();
  }
  // Caja de selección con cuatro asas (en coordenadas del lienzo, 1 in = 144 px)
  function dibujarSeleccion() {
    if (!esLibre()) return;
    const el = elSel(), sl = st.querySelector(".slide");
    if (!el || !sl) return;
    const c = document.createElement("div");
    c.className = "sel-caja";
    Object.assign(c.style, { left: `${el.x * 144}px`, top: `${el.y * 144}px`, width: `${el.w * 144}px`, height: `${el.h * 144}px` });
    c.innerHTML = ["nw", "ne", "sw", "se"].map((q) => `<i class="manija ${q}" data-esq="${q}"></i>`).join("");
    sl.appendChild(c);
  }
  const aPulgadas = (ev) => {
    const r = st.querySelector(".slide").getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * 13.333, ((ev.clientY - r.top) / r.height) * 7.5];
  };
  const iman = (v, ev) => (ev.altKey ? r2(v) : r2(Math.round(v / 0.05) * 0.05));

  st.addEventListener("pointerdown", (ev) => {
    if (!esLibre() || enLugar) return;
    const man = ev.target.closest(".manija"), nodo = ev.target.closest("[data-el]");
    const p = aPulgadas(ev);
    if (man && elSel()) arrastre = { modo: "redim", esq: man.dataset.esq, p0: p, o: { ...elSel() } };
    else if (nodo) {
      if (selEl !== nodo.dataset.el) { selEl = nodo.dataset.el; pintarEditorLibre(actualS()); }
      arrastre = { modo: "mover", p0: p, o: { ...elSel() } };
    } else { selEl = null; escenario(); pintarEditorLibre(actualS()); return; }
    escenario();
    try { st.setPointerCapture(ev.pointerId); } catch {}
    ev.preventDefault();
  });
  st.addEventListener("pointermove", (ev) => {
    if (!arrastre) return;
    const el = elSel();
    if (!el) return;
    const [x, y] = aPulgadas(ev), dx = x - arrastre.p0[0], dy = y - arrastre.p0[1], o = arrastre.o;
    if (Math.abs(dx) + Math.abs(dy) < 0.02 && !arrastre.movido) return;
    arrastre.movido = true;
    if (arrastre.modo === "mover") { el.x = iman(o.x + dx, ev); el.y = iman(o.y + dy, ev); }
    else {
      const q = arrastre.esq;
      if (q.includes("e")) el.w = Math.max(0.2, iman(o.w + dx, ev));
      if (q.includes("s")) el.h = Math.max(0.2, iman(o.h + dy, ev));
      if (q.includes("w")) { el.w = Math.max(0.2, iman(o.w - dx, ev)); el.x = r2(o.x + o.w - el.w); }
      if (q.includes("n")) { el.h = Math.max(0.2, iman(o.h - dy, ev)); el.y = r2(o.y + o.h - el.h); }
    }
    escenario();
    difundir();
    ["x", "y", "w", "h"].forEach((k) => { const i = $der.querySelector(`[data-ep="${k}"]`); if (i) i.value = el[k]; });
  });
  const soltar = () => { if (arrastre?.movido) { guardarContenido(); render(); } arrastre = null; };
  st.addEventListener("pointerup", soltar);
  st.addEventListener("pointercancel", soltar);

  // Doble clic: escribir sobre la diapositiva (plantillas: textos con campo; libres: textos)
  st.addEventListener("dblclick", (ev) => {
    if (!editando || enLugar) return;
    const t = ev.target.closest(".tb");
    if (!t) return;
    const s = actualS();
    let poner;
    if (s.plantilla === "libre") {
      const el = (s.elementos || []).find((x) => x.id === t.dataset.el);
      if (!el || el.tipo !== "texto" || el.rol) return;
      poner = (v) => (el.texto = v);
    } else if (t.dataset.campo) {
      const ruta = t.dataset.campo.split("."), k = ruta.pop();
      const obj = ruta.reduce((o, x) => o?.[x], s);
      if (!obj) return;
      poner = (v) => (obj[k] = v);
    } else return toast("Este texto se cambia desde los campos de la derecha.");
    editarEnLugar(t, poner);
  });
  function editarEnLugar(t, poner) {
    const inner = t.firstElementChild;
    inner.querySelectorAll(".cursor").forEach((x) => x.remove());
    t.classList.add("editando-texto");
    inner.contentEditable = "true";
    inner.focus();
    document.execCommand("selectAll", false, null);
    const fin = (guardar) => {
      if (enLugar !== fin) return;
      enLugar = null;
      inner.contentEditable = "false";
      if (guardar) { poner(htmlAMarcas(inner.innerHTML)); despuesDeEditar(); $der.dataset.id = ""; render(); }
      else render();
    };
    enLugar = fin;
    inner.addEventListener("blur", () => fin(true), { once: true });
    inner.addEventListener("paste", (ev) => { ev.preventDefault(); document.execCommand("insertText", false, ev.clipboardData.getData("text/plain")); });
    inner.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Escape") { ev.preventDefault(); fin(false); }
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); inner.blur(); }
    });
    toast("Escribí directo · Ctrl+B resalta, Ctrl+I cursiva · clic afuera o Ctrl+Enter para terminar, Esc cancela");
  }

  // Convertir la diapositiva de plantilla en libre
  function liberar() {
    const s = actualS();
    if (s.plantilla === "libre") return;
    if (!confirm("¿Convertir esta diapositiva en libre?\n\nVas a poder mover, redimensionar, agregar y borrar cada elemento. A cambio deja de acomodarse sola: si después cambiás textos largos, ajustá vos los tamaños. Si tiene una votación o clasificación, los resultados se muestran en el panel general.")) return;
    const libre = aLibre(s, { ...base, numero: numeroDe(diapos, s.id), total: vis().length });
    diapos[indicede(s.id)] = libre;
    selEl = null;
    editando = true;
    despuesDeEditar();
    toast("Listo: ahora podés mover y redimensionar cada elemento.");
  }

  // Atajos del editor libre (devuelve true si los usó)
  function atajoLibre(ev) {
    if (!esLibre() || !selEl) return false;
    const el = elSel(), s = actualS();
    if (!el) return false;
    const paso = ev.shiftKey ? 0.5 : 0.05;
    const mov = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[ev.key];
    if (mov) { el.x = r2(el.x + mov[0]); el.y = r2(el.y + mov[1]); }
    else if (ev.key === "Delete" || ev.key === "Backspace") { s.elementos = s.elementos.filter((x) => x.id !== selEl); selEl = null; }
    else if (ev.key === "Escape") { selEl = null; }
    else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "d") { const c = { ...structuredClone(el), id: nuevoIdEl(), x: r2(el.x + 0.2), y: r2(el.y + 0.2) }; s.elementos.push(c); selEl = c.id; }
    else return false;
    ev.preventDefault();
    despuesDeEditar();
    pintarEditorLibre(s);
    return true;
  }

  // Panel del editor libre: agregar, lista de elementos y propiedades del seleccionado
  const NOMBRE_TIPO = { texto: "texto", forma: "forma", imagen: "imagen", qr: "código QR" };
  const COLORES_EL = [["texto", "blanco / texto"], ["texto_secundario", "gris"], ["lima", "lima"], ["fucsia", "fucsia"], ["celeste", "celeste"], ["verde", "verde"], ["naranja", "naranja"], ["superficie", "superficie"], ["linea", "línea"], ["fondo", "fondo"], ["texto_sobre_acento", "sobre acento"]];
  const opciones = (lista, v, vacio) => `${vacio ? `<option value="">${vacio}</option>` : ""}${lista.map(([k, t]) => `<option value="${k}" ${k === v ? "selected" : ""}>${t}</option>`).join("")}${v && !lista.some(([k]) => k === v) ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : ""}`;
  function camposElemento(el) {
    const leer = (k) => k.split(".").reduce((o, x) => o?.[x], el);
    const num = (k, t, paso = 0.05) => `<label class="ed-campo mini-campo"><span class="rotulo">${t}</span><input type="number" step="${paso}" data-ep="${k}" value="${leer(k) ?? ""}"></label>`;
    const sel = (k, t, lista, vacio) => `<label class="ed-campo"><span class="rotulo">${t}</span><select data-ep="${k}">${opciones(lista, k.includes(".") ? el[k.split(".")[0]]?.[k.split(".")[1]] : el[k], vacio)}</select></label>`;
    const si = (k, t) => `<label class="interruptor"><input type="checkbox" data-ep="${k}" data-bool="1" ${el[k] ? "checked" : ""}> ${t}</label>`;
    let h = `<div class="ed-grupo"><div class="rotulo lima">${NOMBRE_TIPO[el.tipo]} seleccionado</div>
      <div class="fila-num">${num("x", "x")}${num("y", "y")}${num("w", "ancho")}${num("h", "alto")}</div>`;
    if (el.tipo === "texto") {
      h += el.rol ? `<p class="sec ayuda">Automático: ${el.rol === "bloque" ? "la etiqueta del bloque" : "el número de diapositiva"}.</p>`
        : `<label class="ed-campo"><span class="rotulo">texto <span class="sec">· **resaltado** · *cursiva*</span></span><textarea rows="3" data-ep="texto">${esc(el.texto || "")}</textarea></label>`;
      h += `<div class="fila-num">${num("size", "tamaño (pt)", 1)}${num("lh", "interlineado", 0.05)}</div>`
        + sel("color", "color", COLORES_EL)
        + `<div class="fila-chk">${si("bold", "negrita")}${si("italic", "cursiva")}${si("mono", "mono")}</div>`
        + sel("align", "alineación", [["left", "izquierda"], ["center", "centro"], ["right", "derecha"]])
        + sel("valign", "vertical", [["top", "arriba"], ["middle", "medio"], ["bottom", "abajo"]])
        + sel("resaltado", "estilo del **resaltado**", [["marker", "marcador"], ["bold", "negrita lima"]], "texto lima")
        + sel("fondo", "fondo", COLORES_EL, "sin fondo");
    }
    if (el.tipo === "forma") h += sel("fondo", "relleno", COLORES_EL, "sin relleno") + sel("borde.color", "borde", COLORES_EL, "sin borde")
      + `<div class="fila-num">${num("borde.ancho", "grosor (pt)", 0.5)}</div>` + sel("borde.estilo", "línea", [["solid", "continua"], ["dashed", "punteada"]]) + si("redondo", "círculo / óvalo");
    if (el.tipo === "imagen") h += `<label class="ed-campo"><span class="rotulo">enlace de la imagen <span class="sec">· https://…</span></span><input data-ep="url" value="${esc(el.url || "")}" placeholder="https://…"></label>`
      + sel("ajuste", "ajuste", [["cubrir", "cubrir el recuadro (recorta)"], ["contener", "entera (sin recortar)"]]);
    if (el.tipo === "qr") h += `<label class="ed-campo"><span class="rotulo">enlace <span class="sec">· vacío = el de los participantes</span></span><input data-ep="url" value="${esc(el.url || "")}" placeholder="https://…"></label>`;
    h += `<div class="fila-num">${num("paso", "aparece en el paso", 1)}</div>
      <div class="acciones"><button class="btn sec-btn chico" data-acc-el="dup">duplicar</button><button class="btn sec-btn chico" data-acc-el="frente">al frente</button><button class="btn sec-btn chico" data-acc-el="fondo">al fondo</button><button class="btn peligro chico" data-acc-el="borrar">borrar</button></div></div>`;
    return h;
  }
  function pintarEditorLibre(s) {
    $der.dataset.id = s.id + s.plantilla;
    s.elementos ||= [];
    const el = elSel();
    const icono = { texto: "T", forma: "■", imagen: "▣", qr: "▦" };
    const nombre = (x) => (x.tipo === "texto" ? (x.rol ? `(${x.rol === "bloque" ? "bloque" : "número"})` : (x.texto || "").replace(/\*/g, "").slice(0, 34) || "(vacío)") : x.tipo === "imagen" ? (x.url ? "imagen" : "imagen (sin enlace)") : NOMBRE_TIPO[x.tipo]);
    $der.innerHTML = `<div class="editor">
      <p class="ayuda"><b>Diapositiva libre</b> <span class="sec">· arrastrá para mover · esquinas: tamaño · doble clic: escribir · flechas: mover (Shift: más) · Supr: borrar · Ctrl+D: duplicar · Alt: sin imán</span></p>
      <label class="ed-campo"><span class="rotulo">bloque</span><select data-bloque>${bloquesLista.map((b) => `<option value="${esc(b.id)}" ${b.id === s.bloque ? "selected" : ""}>${esc(`${b.id} · ${b.nombre}`)}</option>`).join("")}<option value="">— sin bloque —</option></select></label>
      <div class="acciones agregar-el"><span class="rotulo">agregar</span>${["texto", "forma", "imagen", "qr"].map((t) => `<button class="btn sec-btn chico" data-nuevo="${t}">+ ${NOMBRE_TIPO[t]}</button>`).join("")}</div>
      <div class="lista-el">${s.elementos.map((x) => `<button class="el-fila ${x.id === selEl ? "sel" : ""}" data-sel="${x.id}"><span class="mono">${icono[x.tipo]}</span> ${esc(nombre(x))}${x.paso ? ` <span class="sec">· paso ${x.paso}</span>` : ""}</button>`).reverse().join("")}</div>
      ${el ? camposElemento(el) : `<p class="sec ayuda">Tocá un elemento en la diapositiva (o en la lista) para editarlo.</p>`}
      <div class="ed-act" id="ed-act"></div>
    </div>`;
    pintarActividad(s);
    const $ed = $der.querySelector(".editor");
    $ed.onclick = (ev) => {
      const b = ev.target.closest("[data-nuevo], [data-sel], [data-acc-el]");
      if (!b) return;
      if (b.dataset.nuevo) { const n = elementoNuevo(b.dataset.nuevo); s.elementos.push(n); selEl = n.id; }
      if (b.dataset.sel) selEl = b.dataset.sel;
      const acc = b.dataset.accEl, x = elSel();
      if (acc && x) {
        const i = s.elementos.indexOf(x);
        if (acc === "borrar") { s.elementos.splice(i, 1); selEl = null; }
        if (acc === "dup") { const c = { ...structuredClone(x), id: nuevoIdEl(), x: r2(x.x + 0.2), y: r2(x.y + 0.2) }; s.elementos.push(c); selEl = c.id; }
        if (acc === "frente") { s.elementos.splice(i, 1); s.elementos.push(x); }
        if (acc === "fondo") { s.elementos.splice(i, 1); s.elementos.unshift(x); }
      }
      despuesDeEditar();
      pintarEditorLibre(s);
    };
    $ed.oninput = $ed.onchange = (ev) => {
      const t = ev.target;
      if (t.matches("[data-bloque]")) { s.bloque = t.value; return despuesDeEditar(); }
      const k = t.dataset.ep, x = elSel();
      if (!k || !x) return;
      let v = t.dataset.bool ? t.checked : t.type === "number" ? (t.value === "" ? null : +t.value) : t.value;
      if (k.startsWith("borde.")) {
        const sub = k.split(".")[1];
        if (sub === "color" && !v) delete x.borde;
        else { x.borde ||= { color: "texto", ancho: 2, estilo: "solid" }; x.borde[sub] = v; }
      } else if (v === "" || v === null || v === false) delete x[k];
      else x[k] = v;
      escenario();
      difundir();
      guardarContenido();
      acts = resolverActividades(def, diapos);
    };
  }

  function despuesDeEditar() {
    acts = resolverActividades(def, diapos);
    guardarContenido();
    render();
  }

  // «No cabe»: textos que se salen de su recuadro (solo se marcan en la consola, nunca en el proyector)
  function revisarQueQuepa() {
    const malos = [...st.querySelectorAll(".slide .tb")].filter((t) => {
      const d = t.firstElementChild;
      return d && !t.classList.contains("paso-oculto") && (d.scrollHeight > t.clientHeight + 3 || d.scrollWidth > t.clientWidth + 3);
    });
    malos.forEach((t) => t.classList.add("no-cabe"));
    const $a = document.getElementById("aviso-cabe");
    $a.hidden = !malos.length;
    $a.textContent = malos.length ? `⚠ ${malos.length === 1 ? "un texto no cabe" : `${malos.length} textos no caben`} en su recuadro: acortalo` : "";
  }
  document.fonts?.ready.then(() => render()); // medir con las fuentes ya cargadas

  // ---- armar la presentación: agregar, duplicar, borrar y mover diapositivas ----
  const indicede = (id) => diapos.findIndex((x) => x.id === id);
  function cambioEstructura(irAId) {
    acts = resolverActividades(def, diapos);
    guardarContenido();
    if (irAId) irA(irAId, 0); else render();
    if (!document.getElementById("modal").hidden && document.getElementById("modal").dataset.vista === "indice") indice();
  }
  function insertarDespues(id, nueva) {
    diapos.splice(indicede(id) + 1, 0, nueva);
    cambioEstructura(nueva.id);
  }
  function duplicar(id) {
    const { id: _, rev, ...resto } = porId(id);
    insertarDespues(id, { ...structuredClone(resto), id: nuevoId() });
  }
  function borrar(id) {
    if (diapos.length <= 1) return toast("La presentación tiene que tener al menos una diapositiva.");
    const s = porId(id);
    if (!confirm(`¿Borrar la diapositiva ${numeroDe(diapos, id) ?? "(oculta)"} «${tituloDe(s).slice(0, 60)}»? No se puede deshacer.`)) return;
    const k = indicede(id);
    const destino = id === e.actual ? (diapos[k + 1] || diapos[k - 1]).id : null;
    diapos.splice(k, 1);
    cambioEstructura(destino);
  }
  function mover(id, aIndice) {
    const k = indicede(id);
    if (k < 0 || aIndice < 0 || aIndice >= diapos.length || aIndice === k) return;
    const [x] = diapos.splice(k, 1);
    diapos.splice(aIndice, 0, x);
    cambioEstructura();
  }

  // Galería de plantillas: cada una con su vista previa; se agrega después de la diapositiva indicada
  function galeria(despuesDe) {
    const $m = document.getElementById("modal");
    $m.hidden = false;
    $m.dataset.vista = "galeria";
    const bloque = porId(despuesDe)?.bloque || bloquesLista[0]?.id || "";
    $m.innerHTML = `<div class="modal-caja ancha">
      <div class="fila" style="margin-bottom:12px"><h2 style="margin:0;margin-right:auto">Agregar diapositiva</h2><button class="btn chico" id="cerrar">cerrar (esc)</button></div>
      <p class="sec" style="margin:0 0 14px">Elegí una plantilla. Se agrega después de la diapositiva actual, con un texto de ejemplo para reemplazar.</p>
      <div class="galeria">${GALERIA.map((g, i) => `<button class="gal-item" data-g="${i}"><div class="stage"></div><b>${esc(g.nombre)}</b><span class="sec">${esc(g.uso)}</span></button>`).join("")}</div></div>`;
    $m.querySelectorAll(".gal-item").forEach((b) => montar(b.querySelector(".stage"), renderSlide({ ...GALERIA[+b.dataset.g].s, bloque }, { ...base, numero: 1, total: 1 })));
    $m.querySelector("#cerrar").onclick = cerrarModal;
    $m.onclick = (ev) => {
      if (ev.target === $m) return cerrarModal();
      const b = ev.target.closest(".gal-item");
      if (!b) return;
      const nueva = { id: nuevoId(), bloque, ...structuredClone(GALERIA[+b.dataset.g].s) };
      if (nueva.plantilla === "recursos") nueva.url = `${location.origin}/material?s=${encodeURIComponent(sid)}`;
      cerrarModal();
      insertarDespues(despuesDe, nueva);
      editando = true;
      render();
    };
  }

  // ---- índice: todas las diapositivas, para saltar, ocultar/mostrar, ordenar, duplicar y borrar ----
  function indice() {
    const $m = document.getElementById("modal");
    $m.hidden = false;
    $m.dataset.vista = "indice";
    const scroll = $m.querySelector(".lista-idx")?.scrollTop || 0;
    $m.innerHTML = `<div class="modal-caja">
      <div class="fila" style="margin-bottom:12px"><h2 style="margin:0;margin-right:auto">Diapositivas</h2>
        <button class="btn chico" id="nueva">+ agregar diapositiva</button>
        <button class="btn sec-btn chico" id="cerrar">cerrar (esc)</button></div>
      <p class="sec" style="margin:0 0 12px">Tocá una fila para ir a esa diapositiva. Arrastrá ⠿ (o usá ↑ ↓) para ordenar. Las ocultas se saltean al presentar y no cuentan en la numeración.</p>
      <div class="lista-idx">${diapos.map((s, i) => {
        const n = numeroDe(diapos, s.id);
        return `<div class="idx ${s.oculta ? "oc" : ""} ${s.id === e.actual ? "act" : ""}" data-id="${s.id}" draggable="true">
          <span class="asa" title="arrastrar">⠿</span><span class="mono n">${n ?? "—"}</span><span class="mono sec pl">${esc(s.plantilla)}${s.pasos ? " · pasos" : ""}</span><span class="t">${esc(tituloDe(s))}</span>
          <span class="idx-acc">
            <button class="mini" data-subir="${i}" title="subir" ${i === 0 ? "disabled" : ""}>↑</button><button class="mini" data-bajar="${i}" title="bajar" ${i === diapos.length - 1 ? "disabled" : ""}>↓</button>
            <button class="mini" data-dup="${s.id}" title="duplicar">⧉</button><button class="mini peligro" data-borrar="${s.id}" title="borrar">✕</button>
            <label class="interruptor"><input type="checkbox" data-ojo="${s.id}" ${s.oculta ? "" : "checked"}> visible</label>
          </span></div>`;
      }).join("")}</div>
      <div class="idx-pie">
        <div class="idx-bloques"><div class="rotulo">bloques (las etiquetas «// 01 · nombre» de arriba a la izquierda)</div>
          ${bloquesLista.map((b, i) => `<div class="fila-bloque"><input class="mono" data-bid="${i}" value="${esc(b.id)}" size="4"><input data-bnom="${i}" value="${esc(b.nombre)}"></div>`).join("")}
          <button class="btn sec-btn chico" id="nbloque">+ bloque</button></div>
        <div class="idx-opciones">
          <label class="ed-campo"><span class="rotulo">tema</span><select id="tema">${Object.entries(TEMAS_NOMBRES).map(([k, t]) => `<option value="${k}" ${tema === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <button class="btn chico" id="pptx">descargar .pptx</button>
          <button class="btn sec-btn chico" id="exp">exportar json</button>
          ${pres.esTaller ? `<button class="btn peligro chico" id="rest">restablecer desde el json publicado</button>` : ""}
        </div>
      </div></div>`;
    $m.querySelector(".lista-idx").scrollTop = scroll;
    $m.querySelector("#cerrar").onclick = cerrarModal;
    $m.querySelector("#nueva").onclick = () => galeria(e.actual);
    $m.onclick = (ev) => {
      if (ev.target === $m) return cerrarModal();
      const t = ev.target.closest("[data-ojo], [data-subir], [data-bajar], [data-dup], [data-borrar]");
      if (t?.dataset.ojo) {
        const s = porId(t.dataset.ojo);
        if (t.checked) delete s.oculta; else s.oculta = true;
        return cambioEstructura();
      }
      if (t?.dataset.subir) return mover(diapos[+t.dataset.subir].id, +t.dataset.subir - 1);
      if (t?.dataset.bajar) return mover(diapos[+t.dataset.bajar].id, +t.dataset.bajar + 1);
      if (t?.dataset.dup) return duplicar(t.dataset.dup);
      if (t?.dataset.borrar) return borrar(t.dataset.borrar);
      if (ev.target.closest("label, button, input, select, .idx-pie")) return;
      const fila = ev.target.closest(".idx");
      if (fila) { irA(fila.dataset.id, 0); cerrarModal(); }
    };
    // arrastrar para ordenar
    let arrastrada = null;
    $m.querySelectorAll(".idx").forEach((f) => {
      f.ondragstart = (ev) => { arrastrada = f.dataset.id; ev.dataTransfer.effectAllowed = "move"; f.classList.add("arrastrando"); };
      f.ondragend = () => f.classList.remove("arrastrando");
      f.ondragover = (ev) => { ev.preventDefault(); f.classList.add("sobre"); };
      f.ondragleave = () => f.classList.remove("sobre");
      f.ondrop = (ev) => { ev.preventDefault(); f.classList.remove("sobre"); if (arrastrada && arrastrada !== f.dataset.id) mover(arrastrada, indicede(f.dataset.id)); };
    });
    // bloques
    $m.querySelectorAll("[data-bnom], [data-bid]").forEach((inp) => (inp.onchange = () => {
      const i = +(inp.dataset.bnom ?? inp.dataset.bid);
      if (inp.dataset.bid != null) {
        const viejo = bloquesLista[i].id, nuevo = inp.value.trim() || viejo;
        diapos.forEach((x) => { if (x.bloque === viejo) x.bloque = nuevo; });
        bloquesLista[i].id = nuevo;
      } else bloquesLista[i].nombre = inp.value.trim();
      base = { ...base, bloques: mapaBloques(bloquesLista) };
      cambioEstructura();
    }));
    $m.querySelector("#nbloque").onclick = () => {
      const n = String(bloquesLista.length + 1).padStart(2, "0");
      bloquesLista.push({ id: n, nombre: "nuevo bloque" });
      base = { ...base, bloques: mapaBloques(bloquesLista) };
      cambioEstructura();
    };
    $m.querySelector("#tema").onchange = async (ev) => {
      tema = ev.target.value;
      base = { ...base, tema };
      usarTema(tema);
      try { await fb.updateDoc(fb.refMeta(sid), { tema }); } catch { if (pres.esTaller) await fb.setDoc(fb.refMeta(sid), { tema }, { merge: true }).catch((x) => toast(x.message)); }
      cambioEstructura();
    };
    $m.querySelector("#pptx").onclick = exportarPptx;
    $m.querySelector("#exp").onclick = () => {
      const json = structuredClone(datos.taller);
      json.meta = { ...json.meta, titulo: pres.titulo };
      json.contenido.bloques = bloquesLista;
      json.contenido.diapositivas = diapos.map((s, i) => ({ ...s, n: i + 1 }));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
      a.download = `${sid}.json`;
      a.click();
    };
    const rest = $m.querySelector("#rest");
    if (rest) rest.onclick = async () => {
      if (!confirm("¿Descartar todas las ediciones hechas acá (contenido, notas, pasos, ocultas) y volver al JSON publicado?")) return;
      await fb.deleteDoc(fb.refContenido(sid));
      location.reload();
    };
  }
  // .pptx con el mismo dibujo que gen.js (public/js/pptx.js); los QR van como imagen
  async function exportarPptx() {
    toast("Generando el .pptx…");
    try {
      if (!window.PptxGenJS) await new Promise((ok, mal) => {
        const sc = document.createElement("script");
        sc.src = "/vendor/pptxgen.bundle.js";
        sc.onload = ok;
        sc.onerror = () => mal(new Error("no se pudo cargar pptxgenjs"));
        document.head.appendChild(sc);
      });
      const { construirPptx } = await import("./pptx.js");
      const urls = new Set([joinUrl, ...diapos.filter((x) => x.plantilla === "recursos" && x.url).map((x) => x.url)]);
      const pngs = {};
      for (const u of urls) pngs[u] = await pngDeQr(u);
      // QR de las diapositivas libres e imágenes (se descargan antes; si un sitio no lo permite, queda el enlace)
      diapos.forEach((x) => (x.elementos || []).forEach((el) => { if (el.tipo === "qr" && el.url) urls.add(el.url); }));
      for (const u of urls) pngs[u] ||= await pngDeQr(u);
      const imgs = {};
      for (const u of new Set(diapos.flatMap((x) => (x.elementos || []).filter((el) => el.tipo === "imagen" && el.url).map((el) => el.url)))) imgs[u] = await imagenBase64(u);
      const doc = construirPptx(window.PptxGenJS, { plantilla: datos.plantilla, diapositivas: diapos, bloques: bloquesLista, titulo: pres.titulo, paleta: TEMAS[tema], joinUrl, qr: (u) => pngs[u], imagen: (u) => imgs[u] });
      await doc.writeFile({ fileName: `${sid}.pptx` });
    } catch (err) { toast("No se pudo generar el .pptx: " + err.message); }
  }
  async function imagenBase64(url) {
    try {
      const b = await fetch(url, { mode: "cors" }).then((r) => (r.ok ? r.blob() : null));
      if (!b) return null;
      return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).replace(/^data:/, "")); fr.readAsDataURL(b); });
    } catch { return null; }
  }
  async function pngDeQr(url, lado = 600) {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrSvg(url));
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = lado;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, lado, lado);
    x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, 0, lado, lado);
    return c.toDataURL("image/png").replace(/^data:/, "");
  }

  function cerrarModal() { const m = document.getElementById("modal"); m.hidden = true; m.dataset.vista = ""; }

  // ---- panel de la actividad ----
  function panel() {
    const $p = document.getElementById("panel");
    const a = actDelPanel();
    if (!a) {
      const activa = e.actividad && actividadPorId(acts, e.actividad);
      $p.innerHTML = `<div class="info"><div class="rotulo">actividad</div><div class="sec">Esta diapositiva no tiene actividad.</div>
        ${activa ? `<div class="sec"><span class="punto ${e.abierta ? "on" : ""}"></span>${esc(activa.titulo)} · ${e.abierta ? "abierta" : "cerrada"}${e.abierta ? ` <button class="btn sec-btn chico" id="cerrar-act">cerrar</button>` : ""}</div>` : ""}</div>`;
      const c = document.getElementById("cerrar-act");
      if (c) c.onclick = () => { guardar({ abierta: false }); render(); };
      return;
    }
    const res = calcular(a, respuestas);
    const abierta = e.actividad === a.id && e.abierta;
    const muro = muroDeDiapositiva(def, e.actual);
    const esDeEsta = actDeDiapositiva()?.id === a.id;
    let resumen = "";
    if (a.tipo === "votacion") resumen = a.opciones.map((o, i) => `${esc(o)}: <b>${res.conteos[i]}</b>`).join(" · ");
    if (a.tipo === "clasificar") {
      const g = {};
      respuestas.filter((r) => r.actividad === a.id).forEach((r) => (g[r.grupo || "?"] = (g[r.grupo || "?"] || 0) + 1));
      resumen = Object.keys(g).sort().map((k) => `grupo ${esc(k)}: <b>${g[k]}</b>`).join(" · ") || "sin respuestas";
    }
    $p.innerHTML = `<div class="info">
        <div class="rotulo">actividad · ${esc(a.tipo)}${a.anonimo ? " · anónima" : ""}</div>
        <div class="nombre">${esc(a.titulo)}</div>
        <div><span class="punto ${abierta ? "on" : ""}"></span>${abierta ? "abierta" : "cerrada"} · <b class="lima">${res.total}</b> respuesta${res.total === 1 ? "" : "s"}</div>
        ${resumen ? `<div class="sec" style="font-size:14px">${resumen}</div>` : ""}
        <div class="botones">
          <button class="btn chico ${abierta ? "sec-btn" : ""}" id="abr">${abierta ? "cerrar (A)" : "abrir (A)"}</button>
          ${esDeEsta ? `<button class="btn chico ${e.revelar ? "" : "sec-btn"}" id="rev">${e.revelar ? "ocultar resultados (R)" : "mostrar resultados (R)"}</button>` : ""}
        </div>
        ${muro ? `<div class="sec" style="font-size:13px">Tocá ★ para mostrar una respuesta en pantalla.</div>` : ""}
      </div>
      <div class="lista" id="lista"></div>`;
    document.getElementById("abr").onclick = alternarAbierta;
    const rv = document.getElementById("rev");
    if (rv) rv.onclick = () => tecla("r");
    if (a.tipo !== "abiertas") return;

    const $l = document.getElementById("lista");
    if (tabPregunta == null || tabPregunta >= a.preguntas.length) tabPregunta = muro ? muro.pregunta : 0;
    const items = res.porPregunta[tabPregunta] || [];
    const dest = new Set(e.destacadas || []);
    $l.innerHTML = `<div class="tabs">${a.preguntas.map((p, i) => `<button data-q="${i}" class="${i === tabPregunta ? "sel" : ""}">${String(i + 1).padStart(2, "0")} · ${res.porPregunta[i].length}</button>`).join("")}</div>
      <div class="sec" style="font-size:14px">${esc(a.preguntas[tabPregunta] || "")}</div>
      ${items.length ? items.map((it) => {
        const k = claveDestacada(it.id, tabPregunta);
        return `<button class="resp ${dest.has(k) ? "dest" : ""}" data-k="${esc(k)}"><span class="estrella">${dest.has(k) ? "★" : "☆"}</span><span>${esc(it.texto)}${it.nombre ? ` <span class="sec">— ${esc(it.nombre)}</span>` : ""}</span></button>`;
      }).join("") : `<div class="sec">Todavía no hay respuestas.</div>`}`;
    $l.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { tabPregunta = +b.dataset.q; panel(); }));
    $l.querySelectorAll(".resp").forEach((b) => (b.onclick = () => {
      const k = b.dataset.k;
      const d = (e.destacadas || []).includes(k) ? e.destacadas.filter((x) => x !== k) : [...(e.destacadas || []), k];
      guardar({ destacadas: d });
      render();
    }));
  }

  // Abre la pantalla del proyector; con la API de ventanas de Chrome/Edge la ubica en el otro monitor
  async function proyectar() {
    const url = `/presentar?modo=pantalla&s=${encodeURIComponent(sid)}`;
    let feats = "popup,width=1280,height=720";
    let otra = null;
    if ("getScreenDetails" in window) {
      try {
        const sd = await window.getScreenDetails();
        otra = sd.screens.find((x) => x !== sd.currentScreen) || null;
        if (otra) feats = `popup,left=${otra.availLeft},top=${otra.availTop},width=${otra.availWidth},height=${otra.availHeight}`;
      } catch (err) { console.warn(err); }
    }
    if (pantallaWin && !pantallaWin.closed) pantallaWin.close();
    pantallaWin = window.open(url, "estudiotaller-pantalla", feats);
    toast(otra ? `Pantalla abierta en «${otra.label || "monitor 2"}». Hacé clic en ella para pantalla completa.` : "Pantalla abierta. Arrastrala al proyector y hacé clic en ella (o tecla F) para pantalla completa.");
  }

  render();
  avisoVersion(() => canal.postMessage({ t: "recargar" })); // recarga también la ventana del proyector
  if (actualizadas.length) {
    guardarContenido();
    toast(`Se actualizaron desde el JSON publicado: ${actualizadas.map((id) => `diap. ${numeroDe(diapos, id) ?? id}`).join(", ")}`);
  }
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}
