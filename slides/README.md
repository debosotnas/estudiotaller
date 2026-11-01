# Taller «IA, iglesia y legado»: diapositivas

## Archivos

- `taller_ia_iglesia_legado.pptx`: la presentación (46 diapositivas, 16:9, estilo «Señal»). Se sube a Google Drive y se abre con Google Slides.
- `taller_ia_slides.json`: la fuente de todo. Tiene dos partes:
  - `plantilla`: el sistema visual (colores, tipografías, escala, elementos comunes y las zonas de cada plantilla, con posiciones en pulgadas sobre un lienzo de 13.333 × 7.5).
  - `contenido`: los bloques del taller y las 46 diapositivas. Cada una indica su `plantilla`, sus campos y las `notas` del orador.
- `gen.js`: el generador de referencia (pptxgenjs) que convierte el JSON en el `.pptx`. Muestra cómo se interpreta cada plantilla.

## Marcado de texto en el JSON

- `**texto**`: resaltado. Según la plantilla es texto lima, marcador lima con texto negro o lima en negrita.
- `*texto*`: cursiva.
- `\n`: salto de línea.

## Para Claude Code

Para generar diapositivas propias (por ejemplo, en una app web), usá `plantilla` como sistema de diseño y `contenido.diapositivas` como datos. Respetá las reglas de `plantilla.reglas`. Para ver cómo se resuelve cada plantilla, `gen.js` es la referencia.

Regenerar el `.pptx`:

```bash
npm install pptxgenjs
node gen.js taller_ia_slides.json taller_ia_iglesia_legado.pptx
```

## Pendientes

- Diapositiva 7: reemplazar el recuadro «QR» por el código real (o completar `url` en el JSON).
- Diapositiva 46: completar el contacto o borrar el pie.
- Diapositivas 34 y 35: verificar el texto de Hebreos 10:24–25 (RV60 y NTV) con la Biblia.
- Fuentes: Space Grotesk y JetBrains Mono (Google Fonts). Si Google Slides no las muestra, agregarlas desde «Más fuentes».
