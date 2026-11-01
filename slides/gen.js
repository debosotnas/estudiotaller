// Genera el .pptx desde el JSON. El dibujo de cada plantilla vive en public/js/pptx.js
// (el mismo módulo que usa la app web para «descargar .pptx»).
// Uso: node gen.js taller_ia_slides.json taller_ia_iglesia_legado.pptx
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const pptxgen = require("pptxgenjs");

const SRC = process.argv[2] || "taller_ia_slides.json";
const OUT = process.argv[3] || "taller_ia_iglesia_legado.pptx";
const D = JSON.parse(fs.readFileSync(SRC, "utf8"));

(async () => {
  const { construirPptx } = await import(pathToFileURL(path.join(__dirname, "../public/js/pptx.js")).href);
  const pres = construirPptx(pptxgen, {
    plantilla: D.plantilla,
    diapositivas: D.contenido.diapositivas,
    bloques: D.contenido.bloques,
    titulo: D.meta.titulo,
  });
  await pres.writeFile({ fileName: OUT });
  console.log("ok", OUT);
})();
