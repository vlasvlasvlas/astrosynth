# AstroSynth / Orrery Sequencer

AstroSynth es un prototipo de instrumento audiovisual en navegador: un secuenciador orbital inspirado en un orrery, donde el movimiento de los planetas, los gates colocados por el usuario, las sondas lanzadas desde la Tierra, los UFOs sueltos por Marte y los cometas que pasan generan eventos sonoros.

La idea central es que el sistema solar no sea una decoracion visual, sino el reloj musical del instrumento.

## Estado Actual

El proyecto es una app estatica autocontenida hecha con HTML, CSS y JavaScript vanilla.

No usa build step, dependencias externas ni framework. Se puede abrir con un servidor local simple.

Estructura del proyecto:

- `index.html`: estructura de la interfaz. Carga `js/app.js` como modulo ES.
- `styles.css`: estetica visual, layout y sidebar.
- `js/app.js`: punto de entrada, tick loop.
- `js/state.js`: estado global compartido.
- `js/bodies.js`: datos planetarios, presets por defecto, paleta de colores.
- `js/kepler.js`: matematica orbital (Kepler J2000).
- `js/presets.js`: paleta de voces sonoras en formato declarativo. **Editable.** Cada entrada describe oscilladores, filtros, envolvente, vibrato y eco. Tocá este archivo para tunear timbres o sumar voces nuevas.
- `js/audio.js`: motor de audio que interpreta `presets.js`.
- `js/sim.js`: integracion fisica de sondas, ufos, cometas, lector radial.
- `js/gates.js`: gates libres (puntos disparables sobre cualquier orbita).
- `js/render.js`: dibujo en canvas, escalado per-planeta para preservar la elipse real, snap a orbitas en pantalla.
- `js/ui.js`: bindings de DOM, acciones planetarias, tabs, sidebar toggle, fullscreen.
- `.gitignore`: reglas para archivos locales (`.env`, `start-claude.sh`, `.DS_Store`).

## Como Ejecutarlo

### Local

Desde la carpeta del proyecto:

```bash
python3 -m http.server 5180
```

Abrir:

```text
http://localhost:5180
```

Tambien puede funcionar abriendo `index.html` directamente, pero se recomienda servidor local porque Web Audio y futuras cargas de assets/worklets suelen comportarse mejor desde HTTP local.

### Online (GitHub Pages)

El repo incluye un workflow en `.github/workflows/deploy.yml` que publica el sitio estatico en GitHub Pages cuando se pushea a `main`.

Para activarlo en tu fork/repo:

1. Repo en GitHub > Settings > Pages.
2. **Build and deployment** > Source: **GitHub Actions**.
3. Hacer push a `main`. El workflow corre automaticamente.

URL prevista para este repo: <https://vlasvlasvlas.github.io/astrosynth/>.

Disparo manual: pestania **Actions** > seleccionar el workflow **Deploy to GitHub Pages** > **Run workflow**.

## Concepto de Producto

AstroSynth combina cuatro capas:

1. Sistema solar musical: los planetas se mueven alrededor del Sol y disparan sonidos.
2. Secuenciador radial y gates libres: un lector fijo y puntos colocables en cualquier orbita generan eventos cuando cualquier cuerpo cruza cerca.
3. Sondas, UFOs y cometas: cuerpos fisicos integrados con n-body simplificado. Las sondas se lanzan desde la Tierra; los UFOs son la accion de Marte; los cometas aparecen periodicamente con orbitas excentricas.
4. Acciones planetarias: cada cuerpo tiene un gesto performatico distinto disparado desde el panel.

El resultado buscado es un instrumento con estetica de aparato cientifico/musical antiguo: lineas finas, colores planos, tipografia mono, sin brillos modernos, sin sombras y sin lenguaje visual de landing page.

## Interfaz

La pantalla se divide en dos zonas:

- Canvas principal: muestra Sol, planetas, orbitas, gates, lector radial, sondas, UFOs, cometas y pulsos de eventos. El canvas siempre ocupa el viewport completo; el sidebar flota encima a la derecha.
- Sidebar (desktop) / drawer inferior (mobile): contiene todos los controles agrupados en cuatro paneles. En mobile aparece como cajon que sube desde abajo, con tabs para conmutar paneles.

Botones flotantes arriba a la derecha:

- Toggle del sidebar (chevron): muestra u oculta el panel sin mover el canvas.
- Fullscreen (esquinas): entra o sale de pantalla completa via Fullscreen API.
- About (`?`): abre un modal con la idea del proyecto y link al repo.

### Transport

Controles globales:

- Play / Pause (icono): detiene o reanuda la simulacion temporal.
- Audio (icono de bocina): activa el motor de audio. Los navegadores requieren una accion del usuario antes de reproducir sonido.
- Now (reloj): resetea la simulacion al instante real actual.
- `Speed`: rango logaritmico desde **real time** (1 segundo de simulacion por segundo de reloj) hasta **10 anios por segundo**. Por defecto arranca en real time.
- `View scale`: cambia el escalado visual del sistema solar (full system / inner planets / linear AU).
- `Trail length`: largo de la estela que dejan probes, ufos y cometas. De 40 hasta 2000 puntos.
- `Fixed radial reader`: activa o desactiva la linea ocre que dispara el sonido del planeta cada vez que cruza ese angulo.

### Body

Al tocar un planeta o el Sol, este panel pasa a configurar ese cuerpo. Cada cuerpo tiene su propia configuracion independiente.

Controles por cuerpo:

- Voice on / off, volumen, pitch offset.
- **Voice for [Planet]**: el preset sonoro que usa este cuerpo. Solo afecta al cuerpo seleccionado, no a todos. Los presets son `carlos`, `derbyshire`, `oram`, `oliveros`, `pade`, `radigue`, `spiegel`, `theremin`. Definidos en `js/presets.js` y editables (ver [`js/PRESETS.md`](js/PRESETS.md)).
- **Delay time / Delay mix**: delay con feedback aplicado al sonido del planeta seleccionado. Independiente del `echo` que pueda traer el preset. Subir mix > 0% para escuchar.
- Action: dispara la accion performatica del cuerpo (Earth lanza sonda, Mars suelta UFOs, Saturn deposita gates, etc).
- Auto-fire action + interval: dispara la accion automaticamente cada N segundos.

Datos mostrados:

- Distancia heliocentrica aproximada en AU.
- Velocidad aproximada en AU/year.

### Gates

Los gates son puntos libres en el plano heliocentrico. No dependen del planeta seleccionado: el click sobre el canvas en modo `Place gates` deja un punto, con snap automatico a la orbita mas cercana si esta dentro del rango.

Cualquier cuerpo (planeta, sonda, UFO, cometa) que pase cerca dispara el sonido del gate, no el del planeta. Cada gate tiene su propia nota MIDI y su propio preset.

Controles:

- `Place gates`: activa el modo de colocacion. Click sobre canvas coloca el gate.
- `Gate note` / `Gate preset`: nota y preset que usaran los proximos gates colocados.
- `Clear all gates`: borra todos los gates.
- Boton `remove` por gate en la lista.

### Probe Lab

Permite lanzar sondas desde la Tierra.

Controles:

- `Mission profile`: Voyager 1, Voyager 2, Voyager 3 o Free probe.
- `Target`: planeta objetivo.
- `Launch boost`: impulso inicial en km/s.
- `Drone volume`: volumen del drone de la sonda.
- `Drone tone`: color tonal del drone.
- `Launch Earth`: lanza la sonda desde la Tierra.

Cada sonda:

- Hereda la velocidad orbital de la Tierra.
- Recibe un impulso inicial hacia el objetivo.
- Es afectada por la gravedad del Sol y de los planetas.
- Deja una traza visual.
- Produce un drone sintetico suave estilo sintetizador analogico.

## Acciones Planetarias

Cada cuerpo tiene una accion especial pensada como gesto performatico:

- Sun: onda solar que empuja sondas y UFOs activos y dispara un pulso brillante.
- Mercury: ping rapido en registro alto.
- Venus: textura de nube/velo (drone + ruido oscuro).
- Earth: lanza una sonda libre.
- Mars: suelta un enjambre de UFOs (cuerpos fisicos con trayectoria propia y voz Derbyshire).
- Jupiter: coro de gravedad (cuatro disparos cortos en armonia).
- Saturn: deposita seis gates equiespaciados sobre su orbita usando preset Oram.
- Uranus: drone inclinado.
- Neptune: barrido grave/profundo.

Estas acciones no pretenden representar fisica estricta en todos los casos. Son eventos musicales inspirados por la personalidad astronomica de cada planeta.

## Modelo Astronomico

### Planetas

Las posiciones planetarias se calculan con elementos Keplerianos aproximados alrededor de J2000.

El modelo usa:

- Semieje mayor.
- Excentricidad.
- Inclinacion.
- Longitud media.
- Longitud de perihelio.
- Longitud del nodo ascendente.
- Tasas temporales por siglo juliano.

El calculo resuelve la anomalia excentrica con una iteracion de Kepler y proyecta la posicion al plano ecliptico.

Este enfoque es suficiente para:

- Visualizar relaciones orbitales plausibles.
- Mostrar el estado aproximado del sistema solar.
- Generar eventos musicales repetibles.

No es suficiente para:

- Navegacion espacial real.
- Efemerides de alta precision.
- Misiones con ventanas de lanzamiento reales.
- Predicciones cientificas exactas.

### Sondas

Las sondas usan una simulacion n-body simplificada:

- El Sol atrae a la sonda.
- Cada planeta atrae a la sonda.
- Los planetas no son perturbados por las sondas.
- Los planetas no son perturbados entre si dentro de la integracion de sondas; sus posiciones vienen del modelo Kepleriano.
- La integracion es numerica y ajustada para performance/interaccion musical.

Esto da trayectorias jugables con influencia gravitatoria realista a nivel conceptual, pero no es una simulacion de mision NASA.

## Motor de Audio

El prototipo usa Web Audio API directamente.

Capas actuales:

- Sintesis por preset declarativo definido en `js/presets.js`. Un solo player generico interpreta los datos.
- Delay corto y compresor global.
- Ruido filtrado para acciones solares/nubes/barridos.
- Drone continuo por sonda y por UFO (con voz distinta) con dos osciladores, LFO, filtro y paneo dinamico.

La activacion de audio requiere click del usuario por politicas del navegador.

### Presets sonoros

La paleta esta inspirada en pioneras de la musica electronica:

- `carlos` — Wendy Carlos. Saw filtrado tipo Moog con ADSR clasico.
- `derbyshire` — Delia Derbyshire. Triangulos detuneados con bandpass + eco.
- `oram` — Daphne Oram. Aditiva con armonicos 1-2-3-5.
- `oliveros` — Pauline Oliveros. Drone profundo con ataque lento.
- `pade` — Else Marie Pade. Ruido filtrado con barrido bandpass descendente.
- `radigue` — Eliane Radigue. Dos sinusoidales en pulsacion lenta (beating).
- `spiegel` — Laurie Spiegel. Bell partials inarmonicos.
- `theremin` — Sinusoidal con vibrato amplio.

Cada planeta arranca con un preset por defecto que combina con su personalidad, pero es independiente: cambiar el dropdown de un planeta no afecta a los demas.

### Editar o crear nuevas voces

Abrir `js/presets.js` y editar/agregar entradas. No hace falta tocar el motor de audio. Recargar el navegador alcanza.

Ver la guia detallada con ejemplos completos en [`js/PRESETS.md`](js/PRESETS.md): formato, fuentes (`voices` / `additive` / `noise`), filtros, envolventes, vibrato, eco, y recetas listas para copiar (bowed, bell, whoosh).

### Mapeos Sonoros

Mapeos actuales:

- Cada planeta tiene una nota base y un preset propio.
- El usuario puede modificar pitch offset por planeta.
- La posicion horizontal del planeta afecta paneo.
- La fuerza del evento modifica filtro/volumen.
- La velocidad y distancia de la sonda modifican el drone.
- Probes, UFOs y cometas se renderizan a opacidad 0.85 para que las orbitas se vean a traves.

## Render Visual

El render usa Canvas 2D.

Elementos dibujados:

- Orbitas elipticas reales (cada orbita usa su propia escala uniforme para preservar la forma de la elipse con el Sol en el foco).
- Sol y planetas.
- Anillos de Saturno.
- Lector radial fijo.
- Gates (puntos blancos sobre orbitas).
- Sondas, UFOs, cometas y sus trails (trails y cuerpos a opacidad 0.85).
- Pulsos de eventos (anillos animados).

El escalado puede ser:

- `Full system`: escala logaritmica para ver todos los planetas.
- `Inner planets`: prioriza Mercurio, Venus, Tierra y Marte.
- `Linear AU`: escala lineal en unidades astronomicas.

Nota sobre las elipses: planetas con baja excentricidad (Tierra 0.017, Venus 0.007) se ven casi circulares porque su orbita real es casi circular; Mercurio (0.21) y Marte (0.09) se ven visiblemente elipticos. No se exagera la excentricidad.

## Decisiones de Diseno

El prototipo evita:

- Gradientes decorativos.
- Sombras modernas.
- Brillos tipo sci-fi generico.
- Cards anidadas.
- Hero/landing page.
- Texto explicativo dentro del area principal de juego.

El sidebar concentra la configuracion para que el canvas pueda funcionar como instrumento.

## Limitaciones Conocidas

- La precision orbital es aproximada.
- Las sondas no usan integradores avanzados ni correcciones relativistas.
- El scheduler musical todavia se basa en eventos de simulacion, no en una cola sample-accurate completa.
- No hay persistencia de presets.
- No hay export de audio/MIDI.
- No hay AudioWorklet todavia.
- No hay mobile UX especifica mas alla del layout responsivo.
- Las acciones planetarias son conceptuales y musicales, no todas fisicas.

## Roadmap Recomendado

### Iteracion 1: Instrumento Base

- Guardar y cargar presets.
- Mejorar colocacion/edicion de beacons.
- Agregar mute/solo global por planeta.
- Mostrar tooltips tecnicos cortos en controles.
- Agregar snap musical para beacons.

### Iteracion 2: Audio Engine Fuerte

- Mover el scheduling a una cola basada en `AudioContext.currentTime`.
- Separar motor sonoro de UI.
- Migrar voces criticas a AudioWorklet.
- Agregar buses por orbita.
- Agregar reverb simple y saturacion suave.

### Iteracion 3: Ciencia y Datos

- Integrar JPL Horizons API como modo de alta precision.
- Cachear efemerides por rango temporal.
- Mostrar fuente/precision del modo activo.
- Agregar eventos astronomicos: conjuncion, oposicion, perihelio, aphelio.

### Iteracion 4: Sondas

- Mejorar integrador numerico.
- Agregar ventanas de lanzamiento.
- Agregar planeacion visual de trayectorias.
- Agregar asistencia gravitatoria mas explicita.
- Agregar estados de mision: launch, cruise, flyby, success, lost, interstellar.

### Iteracion 5: Performance y Publicacion

- Pasar render pesado a OffscreenCanvas si hace falta.
- Optimizar trails y calculo de orbitas.
- Agregar tests de funciones orbitales.
- Preparar empaquetado con Vite solo si el proyecto empieza a crecer.

## Fuentes Tecnicas y Cientificas

Referencias usadas para orientar el prototipo:

- JPL Approximate Positions of the Planets: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- JPL Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- NASA Planetary Fact Sheets: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- MDN OffscreenCanvas: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas

## Nota Sobre Precision

AstroSynth debe comunicar siempre la diferencia entre:

- Dato astronomico aproximado.
- Visualizacion musical.
- Simulacion jugable.
- Navegacion espacial real.

La version actual esta en la segunda y tercera categoria: toma datos reales simplificados para producir una experiencia musical interactiva.

