# Estudio Taller

Web app para crear y presentar diapositivas con actividades en vivo desde el celular (votaciones, preguntas, clasificar), pizarrones compartidos desde una tablet y material para descargar. Hecha con HTML, CSS y JavaScript sin dependencias de compilación, sobre Firebase (Hosting, Firestore y Authentication).

Nació para el taller «IA, iglesia y legado» y creció hasta poder armar cualquier presentación.

- **Participantes:** https://estudiotaller.web.app/legado (es la URL del QR)
- **Presentador:** https://estudiotaller.web.app/presentar
- **Admin / respuestas:** https://estudiotaller.web.app/admin
- **Material (solo lectura, para compartir):** https://estudiotaller.web.app/material — todas las diapositivas visibles, completas, sin notas ni resultados; se ven en grande y se pueden guardar como PDF. Está en el QR de la última diapositiva («Recursos y fuentes») y en la pantalla de espera de los celulares.

Alojada en el proyecto de Firebase `coder-fire-sept2022` (sitio `estudiotaller`, Firestore en `southamerica-east1`).

## Mis presentaciones (etapa 1 del editor)

**https://estudiotaller.web.app/presentaciones** (con Google):

- **Crear** una presentación nueva (nace con una portada) y abrirla en la consola para armarla. Cada una tiene su enlace para los participantes (`estudiotaller.web.app/<código>`), su material (`/material?s=<código>`), sus respuestas, sus pizarrones y su tablet.
- **Duplicar** (copia diapositivas, notas y bloques; no respuestas ni pizarrones), **renombrar**, **coeditores** (emails de Google que también pueden editar y presentar) y **borrar** (con todo lo suyo; hay que escribir BORRAR).
- **Usuarios:** solo pueden crear presentaciones las personas que el superadmin autoriza en esa misma página (sección «Personas que pueden crear presentaciones»). Cada uno ve las suyas y las que le comparten; el superadmin ve todas. El taller «IA, iglesia y legado» queda a nombre del superadmin.
- **En la consola:** **+ diapositiva** abre la galería de plantillas (con vista previa), **⧉** duplica y **✕** borra la actual. En **índice**: arrastrar ⠿ o ↑ ↓ para ordenar, duplicar, borrar, mostrar/ocultar, editar los **bloques** (etiquetas «// 01 · nombre») y elegir el **tema** (Señal oscuro o claro). El editor de cada diapositiva tiene además el selector de bloque.

Datos: `estudiotaller_presentaciones/{código}` (ficha: título, dueño, coeditores, tema), `estudiotaller_usuarios/{email}` (autorizados) y, como antes, `estudiotaller/{código}/…` (contenido, navegación, respuestas, pizarrones). Las reglas de Firestore permiten editar solo a dueño, coeditores y superadmin.

## Editor (etapa 2)

- **Campos con nombre normal** (Pregunta, Texto de apoyo, Opciones…), con ayudas, selectores para color, grupo, disposición e ilustración, y **→ lista / → texto** para alternar el texto de apoyo entre párrafo y lista.
- **«No cabe»**: si un texto se sale de su recuadro, en la consola se marca con un borde rojo punteado y aparece «⚠ un texto no cabe en su recuadro». En el proyector nunca se ve.
- **Actividad en esta diapositiva** (al final del editor): ninguna, votación, preguntas abiertas, clasificar en columnas o (en diapositivas «en vivo») mostrar respuestas destacadas. Se abre sola al llegar a la diapositiva; con R se muestran los resultados (también en otra diapositiva, si se elige). Las actividades se guardan con el contenido de cada presentación; el taller parte de `actividades.json`, pero una vez editado en la consola manda lo guardado.
- **Descargar .pptx** (en índice): el mismo dibujo que `slides/gen.js` —los dos usan `public/js/pptx.js`—, con el tema elegido y los QR como imagen.

## Edición sobre la diapositiva (etapa 3)

Con **✎ editar contenido** activado:

- **Doble clic en un texto** de la diapositiva para escribir ahí mismo (Ctrl+B resalta, Ctrl+I cursiva; clic afuera o Ctrl+Enter guarda, Esc cancela). Funciona en todas las plantillas y en las libres.
- **⤧ liberar** convierte una diapositiva de plantilla en **libre**, con el mismo aspecto: cada texto, forma o QR pasa a ser un elemento que se **arrastra** para mover y se **redimensiona** desde las esquinas (imán de 0,05 in; Alt lo desactiva). Flechas mueven de a poco (Shift: más), Supr borra, Ctrl+D duplica.
- En una libre, el panel de la derecha permite **agregar** texto, forma, **imagen por enlace** (https://…) o código QR, ver la lista de elementos y cambiar posición, tamaño, color, negrita/cursiva/mono, alineación, fondo, borde, capa (al frente / al fondo) y en qué **paso** aparece.
- La galería tiene **En blanco (libre)** para empezar desde cero.
- **Temas:** Señal oscuro, Señal claro, Papel y Noche (en índice). Los colores se guardan por nombre (lima, fucsia…), así que al cambiar de tema todo se recolorea, también en las libres.
- **.pptx:** exporta también las libres; las imágenes se descargan e incluyen si el sitio lo permite (si no, queda el enlace).

## Deshacer y versiones

- **↶ / ↷** (o **Ctrl+Z / Ctrl+Shift+Z**) en la consola deshacen y rehacen cualquier cambio de contenido: textos, slides agregadas o borradas, movimientos, bloques, actividades. Cada ráfaga de cambios es un paso; hasta 100 pasos por sesión.
- **Versiones guardadas** (índice → «versiones guardadas…»): se guardan solas al empezar a editar, cada 10 minutos de edición y antes de borrar, liberar o restaurar; también se pueden guardar a mano con un nombre. Se conservan las últimas 40 por presentación. Restaurar guarda antes la versión actual, así que nunca se pierde nada.

## Presentar

1. Abrí `/presentar` en el portátil (Chrome o Edge) y entrá con Google.
2. Tocá **proyectar ⧉**. Con dos pantallas, Chrome pide permiso para «administrar ventanas» la primera vez; aceptalo y la ventana se abre sola en el proyector. Con una sola pantalla, arrastrala al proyector.
3. Hacé clic en la ventana del proyector (o tecla **F**) para pantalla completa.

Teclas (en la consola o en la pantalla): **← →** mover · **R** mostrar/ocultar resultados · **A** abrir/cerrar la actividad · **C** compartir en celulares · **Q** QR a pantalla completa · **B** negro.

La consola muestra la diapositiva actual, la siguiente, las notas y el panel de la actividad (respuestas en vivo; con ★ elegís cuáles salen en las diapositivas «en vivo»). Encima de la diapositiva:

- **por pasos**: el contenido aparece de a poco con la flecha (título, después cada ítem/tarjeta/fila). Activado en las diapositivas 4 y 22 («Entonces, la pregunta de verdad es…»).
- **ocultar diapositiva**: se saltea al presentar y no cuenta en la numeración. El botón **índice** lista todas para mostrarlas/ocultarlas y saltar a cualquiera.
- **✎ editar contenido**: cambia los textos de la diapositiva; se ve al instante en el proyector y queda guardado. Las **notas** también se editan ahí mismo.

Las ediciones se guardan en Firestore (`estudiotaller/legado/config/contenido`) y tienen prioridad sobre el JSON. En **índice** está **exportar json** (para regenerar el .pptx con `gen.js`) y **restablecer desde el json publicado**.

**Compartir en celulares (C):** manda la diapositiva que está en pantalla (con resultados, si están a la vista) a los celulares, arriba de la actividad. Mientras sigas en esa diapositiva, los celulares ven sus cambios; si avanzás, queda la última vista compartida hasta que compartas otra o la dejes de compartir. En el celular, «ver en grande» la pone a pantalla completa (girando el teléfono se ve mejor).

## Pizarrones

- **Tablet:** https://estudiotaller.web.app/pizarron (entrar con Google). Cuatro pizarrones que recuerdan lo dibujado. El 3 y el 4 traen Hebreos 10:24–25 (RV60 y NTV) en el medio, palabra por palabra.
- **✎ lápiz** dibuja en 5 colores y 3 grosores; con lápiz activo, el dedo no dibuja (rechazo de palma: mientras el lápiz está apoyado o flotando cerca, y 1,5 s después de levantarlo, cualquier toque se ignora; también los contactos grandes). **⬚ mover**: recuadro para seleccionar palabras y arrastrarlas (también se puede arrastrar una sola tocándola). **deshacer** (trazos, mover palabras, borrar dibujo y reordenar texto), **borrar dibujo** (el texto queda) y **reordenar texto**.
- **Zoom (solo en la tablet):** pellizco con dos dedos para acercar/alejar (hasta 4×); con zoom y lápiz, un dedo mueve la vista; el botón del porcentaje vuelve al 100 %. El proyector y los celulares siempre ven el pizarrón entero.
- Barra (una fila): **1–4** pizarrón · **pantalla** · **celulares** · ✎ lápiz · ⬚ mover · colores · grosores · ↶ deshacer · ✕ borrar dibujo · ↺ reordenar texto · zoom.
- **mostrar en pantalla** lo proyecta; desde la compu, los botones **pizarrón 1–4** o las teclas **1–4** hacen lo mismo, y la flecha vuelve a la diapositiva. La tablet sigue sola al pizarrón proyectado.
- **compartir con celulares** está apagado por defecto: cada trazo terminado lo lee cada celular conectado. Encenderlo solo cuando haga falta.

**Consumo de Firestore (plan gratuito: 50.000 lecturas por día; si se pasa, deja de responder hasta el día siguiente, nunca cobra):** los celulares solo escuchan la actividad abierta y lo compartido. La diapositiva, los pasos y el pizarrón proyectado van en otro documento (`config/presentador`) que solo leen la consola y la tablet. Lo que se mueve en vivo (trazo en curso, palabras mientras se arrastran) va solo al proyector.

## Actividades

Están en `public/data/actividades.json` y se refieren a las diapositivas por su `id` (no por número). Los textos (preguntas, opciones, tareas, columnas) salen de las propias diapositivas, así que al editarlas se actualizan también en los celulares:

| diapositiva | actividad | tipo |
|---|---|---|
| 7 (`d07`, solo QR) y 8 (`d07b`, preguntas) | Escaneá y respondé (anónimo) | abiertas |
| 9 (`d08`), 42 (`d41`) | muro con respuestas destacadas de la pregunta 1 | muro |
| 14 (`d13`) | ¿Sofía hizo algo mal? | votación |
| 30 (`d29`) → 31 (`d30`) | 9 tareas en 4 columnas, por grupo | clasificar |
| 46 (`d45`) | Para llevarte (con nombre) | abiertas |

Una actividad se abre sola al llegar a su diapositiva y queda abierta hasta que la cerrás (A) o llegás a otra actividad.

## Admin

Respuestas por actividad, **descargar csv**, **copiar tabla** (para pegar en una hoja de cálculo), **copiar texto agrupado** por pregunta, borrar respuestas y reiniciar la sesión. «Descargar todo» da una fila por respuesta, cómodo para filtrar y agrupar.

## Versiones

Cada publicación escribe `public/version.json`. Si la consola, la tablet o el admin estaban abiertos de antes, aparece abajo un aviso **«Hay una versión nueva… recargar»** (desde la consola, recargar también recarga la ventana del proyector). Los celulares se recargan solos cuando están en la pantalla de espera, nunca mientras responden. Igual conviene recargar todo justo antes del taller.

## Desarrollo

```bash
# emuladores locales (necesita JDK 21)
JAVA_HOME=/opt/homebrew/opt/openjdk@21 firebase emulators:start --project demo-estudiotaller
# http://127.0.0.1:5050/presentar · http://localhost:5050/legado

# publicar (copia slides/taller_ia_slides.json a public/data antes de subir)
firebase deploy --only hosting,firestore:rules
```

Estructura: `public/js/slides.js` dibuja las 12 plantillas (lienzo 1920×1080, 1 in = 144 px) siguiendo `slides/gen.js`; `presentar.js`, `participante.js` y `admin.js` son las tres vistas; `firestore.rules` limita la escritura (cada participante solo escribe su respuesta y solo con la actividad abierta; el admin es `obed.santos@gmail.com`).

## Licencia

- **Código:** [MIT](LICENSE). Podés usarlo, modificarlo, forkearlo y usarlo comercialmente sin pedir permiso, siempre que mantengas el aviso de copyright con el autor.
- **Contenido del taller** (`slides/` y su copia en `public/data/`): [CC BY 4.0](LICENSE-CONTENIDO.md), con atribución al autor.

Autor: **Obed Santos** ([@debosotnas](https://github.com/debosotnas)).

### Si lo forkeás

Cambiá el email del superadmin en `public/js/firebase.js` (`ADMINS`) y en `firestore.rules` (`esAdmin`), el proyecto en `.firebaserc` y el sitio en `firebase.json`.
