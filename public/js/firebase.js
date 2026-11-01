// Conexión a Firebase. En localhost usa los emuladores; en producción toma la configuración
// que Firebase Hosting publica en /__/firebase/init.json.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, connectFirestoreEmulator, doc, collection, setDoc, updateDoc, getDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

export const ADMINS = ["obed.santos@gmail.com"];
export const RAIZ = "estudiotaller"; // colección raíz: estudiotaller/{sesion}/respuestas/{actividad__uid}
export const RAIZ_PRESENTACIONES = "estudiotaller_presentaciones"; // índice: título, dueño, coeditores, tema
export const RAIZ_USUARIOS = "estudiotaller_usuarios";             // emails autorizados a crear presentaciones

const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const config = local
  ? { apiKey: "demo-key", projectId: "demo-estudiotaller", authDomain: "localhost" }
  : await fetch("/__/firebase/init.json").then((r) => r.json());

const app = initializeApp(config);
export const auth = getAuth(app);
// Caché local en el dispositivo: si se corta la señal, se sigue leyendo lo último conocido y lo que se escribe
// queda en cola y se envía solo al volver la conexión. (Si el navegador no lo permite, caché en memoria.)
function iniciarFirestore() {
  try { return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { console.warn("sin caché persistente", e); return initializeFirestore(app, { localCache: memoryLocalCache() }); }
}
export const db = iniciarFirestore();
if (local) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export const esAdmin = (u) => !!u && !u.isAnonymous && ADMINS.includes(u.email);
// Puede editar una presentación: superadmin, dueño o coeditor (meta = estudiotaller_presentaciones/{sid})
export const puedeEditar = (u, meta) => esAdmin(u) || (!!u && !u.isAnonymous && !!meta && (meta.owner === u.uid || (meta.editores || []).includes(u.email)));

export function usuarioActual() {
  return new Promise((ok) => {
    const stop = onAuthStateChanged(auth, (u) => { stop(); ok(u); });
  });
}
export async function entrarAnonimo() {
  const u = await usuarioActual();
  if (u) return u;
  return (await signInAnonymously(auth)).user;
}
export async function entrarGoogle() {
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
}
export const salir = () => signOut(auth);

// Sesión: lo que miran los celulares (actividad abierta y vista compartida). Cambia poco, para no gastar lecturas.
export const refSesion = (sid) => doc(db, RAIZ, sid);
export const refMeta = (sid) => doc(db, RAIZ_PRESENTACIONES, sid);
export const colPresentaciones = () => collection(db, RAIZ_PRESENTACIONES);
export const refUsuario = (email) => doc(db, RAIZ_USUARIOS, email);
export const colUsuarios = () => collection(db, RAIZ_USUARIOS);
// Navegación del presentador (diapositiva, paso, resultados, destacadas, pizarrón): solo la leen la consola y la tablet.
export const refNav = (sid) => doc(db, RAIZ, sid, "config", "presentador");
export const CAMPOS_NAV = ["actual", "paso", "revelar", "destacadas", "pizarron"];
export const refRespuestas = (sid) => collection(db, RAIZ, sid, "respuestas");
export const refRespuesta = (sid, actividad, uid) => doc(db, RAIZ, sid, "respuestas", `${actividad}__${uid}`);
// Contenido editado desde la consola (si no existe, se usa el JSON publicado)
export const refContenido = (sid) => doc(db, RAIZ, sid, "config", "contenido");
// Contenido guardado: { diapositivas, bloques? } (versiones viejas guardaban solo la lista de diapositivas)
export function leerContenido(snap) {
  if (!snap.exists()) return null;
  const d = JSON.parse(snap.data().json);
  return Array.isArray(d) ? { diapositivas: d } : d;
}
// Pizarrones: pizarrones/{n} (palabras), pizarrones/{n}/trazos/{id} (trazos terminados), pizarron_vivo/{n} (trazo en curso)
export const refPizarron = (sid, n) => doc(db, RAIZ, sid, "pizarrones", String(n));
export const refTrazos = (sid, n) => collection(db, RAIZ, sid, "pizarrones", String(n), "trazos");
export const refVivo = (sid, n) => doc(db, RAIZ, sid, "pizarron_vivo", String(n));
export const consultaTrazos = (sid, n) => query(refTrazos(sid, n), orderBy("o"));
// Versiones guardadas del contenido (para volver atrás)
export const refVersiones = (sid) => collection(db, RAIZ, sid, "versiones");

export { onAuthStateChanged, doc, collection, setDoc, updateDoc, getDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch, getDocs };
