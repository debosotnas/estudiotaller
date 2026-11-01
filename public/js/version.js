// Detecta que se publicó una versión nueva de la app (public/version.json lo escribe el predeploy: un número).
// Una pestaña abierta antes de publicar sigue con el código viejo, y puede no entenderse con las nuevas.

export function vigilarVersion(alCambiar, cadaMs = 60000) {
  let inicial = null, avisado = false;
  const revisar = async () => {
    try {
      const d = await fetch("/version.json", { cache: "no-store" }).then((r) => r.json());
      const v = d?.v ?? d; // el predeploy escribe solo un número (segundos)
      if (inicial === null) inicial = v;
      else if (v !== inicial && !avisado) { avisado = true; alCambiar(); }
    } catch {}
  };
  revisar();
  setInterval(revisar, cadaMs);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) revisar(); });
}

// Aviso fijo arriba con botón para recargar (consola, tablet, admin). antes: algo que hacer justo antes de recargar.
export function avisoVersion(antes = () => {}) {
  vigilarVersion(() => {
    const d = document.createElement("div");
    d.className = "aviso-version";
    d.innerHTML = `<span>Hay una versión nueva de la app. Recargá para usarla.</span><button class="btn chico">recargar</button>`;
    d.querySelector("button").onclick = () => { antes(); location.reload(); };
    document.body.appendChild(d);
  });
}
