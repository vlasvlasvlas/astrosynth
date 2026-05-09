# Presets — guia para crear voces sinteticas

> Documento hermano del [README principal](../README.md). Esta guia se concentra en como crear o tunear voces; el README general explica el proyecto entero.

Todos los timbres de AstroSynth viven en `js/presets.js`. El archivo exporta un objeto `PRESETS` que es la paleta entera. El motor de audio (`js/audio.js`) lee este objeto y construye los nodos de Web Audio para vos. Esto significa que **podes crear voces nuevas sin tocar el motor**, mientras respetes el formato.

---

## Como editar y probar

1. Abrir `js/presets.js`.
2. Copiar un preset existente como base, renombrar la clave (la usa `bodies.js` y la UI), o agregar una entrada nueva.
3. Guardar y recargar el navegador (no hace falta build).
4. Abrir el sidebar > Body > Voice for [planeta] > seleccionar tu preset nuevo.

Si tu preset rompe el motor, abrir la consola (DevTools): vas a ver el error y la linea.

---

## Anatomia de un preset

Cada entrada del objeto `PRESETS` es un descriptor de voz. Solo un campo de fuente es obligatorio: `voices`, `additive` o `noise`.

```js
miNuevoPreset: {
  label: "Mi voz",                 // nombre corto en la UI
  author: "Quien sea",             // texto explicativo
  description: "Lo que escuchas.", // se muestra debajo del selector
  // --- una de estas tres fuentes ---
  voices:   [...]   // osciladores tonales sumados
  additive: [...]   // armonicos individuales con su decay propio
  noise:    {...}   // ruido filtrado en barrido
  // --- opcionales que se aplican encima ---
  filter:   {...}
  env:      {...}
  vibrato:  {...}
  echo:     {...}
  duration: 1.0
}
```

---

## Tipos de fuente

### `voices` — osciladores tonales

Lista de osciladores que se suman antes del filtro/envolvente.

```js
voices: [
  { type: "sawtooth", freqMul: 1.0,    level: 1.0 },
  { type: "sine",     freqMul: 0.5,    level: 0.6 },
  { type: "triangle", freqMul: 1.0078, level: 1.0 }, // detune leve
]
```

Campos:

| campo     | tipo                                           | que hace                                       |
| --------- | ---------------------------------------------- | ---------------------------------------------- |
| `type`    | `"sine" \| "triangle" \| "sawtooth" \| "square"` | forma de onda del oscilador                    |
| `freqMul` | numero                                         | multiplica la frecuencia base de la nota       |
| `level`   | numero 0..1                                    | mezcla relativa antes de la suma               |

Ideas de receta:

- `freqMul: 2` = una octava arriba.
- `freqMul: 0.5` = una octava abajo (sub).
- `freqMul: 1.0078` = unos 13 cents arriba (detune sutil para coro).
- `freqMul: 1.5` = quinta justa.

### `additive` — armonicos con su propia envolvente

Cada parcial es una sinusoide con su nivel y decay independientes. Usalo para campanas o sonidos inarmonicos.

```js
additive: [
  { mul: 1.00, level: 1.00, decay: 0.40 },
  { mul: 2.76, level: 0.50, decay: 0.45 },  // inarmonico → bell-like
  { mul: 5.40, level: 0.33, decay: 0.50 },
  { mul: 8.93, level: 0.25, decay: 0.55 },
]
```

`mul` no necesita ser entero. Ratios inarmonicos (2.76, 5.4, etc) crean campanas, vibrafonos, glockenspiel.

### `noise` — ruido filtrado con barrido

Genera un buffer de ruido y lo pasa por un bandpass que barre de `freqStart` a `freqEnd` (multiplos de la frecuencia de la nota).

```js
noise: {
  duration: 0.8,             // segundos de ruido
  qBase: 4, qByStrength: 4,  // resonancia del filtro
  freqStart: 2.0,            // frecuencia inicial del barrido (× freq nota)
  freqEnd:   0.7,            // frecuencia final
}
```

Valores tipicos:

- `freqStart > freqEnd` → barrido descendente (suspiro).
- `freqStart < freqEnd` → barrido ascendente (laser).
- `qBase` mas alto → barrido mas resonante.

---

## Procesado opcional

### `filter` — biquad despues de `voices`

```js
filter: { type: "lowpass", freqBase: 520, freqByStrength: 1800, q: 4 }
```

Tipos: `"lowpass"`, `"highpass"`, `"bandpass"`.

Tres formas de definir la frecuencia de corte (elegi una):

- `freqFixed: 900` — frecuencia fija en Hz, independiente de la nota.
- `freqMulCarrier: 2.5` — multiplo de la frecuencia de la nota (sigue al pitch).
- `freqBase + freqByStrength` — base mas un componente proporcional a la fuerza del evento.

`q` es la resonancia (1 = suave, 8+ = muy resonante).

### `env` — envolvente AR sobre la chain de voices+filter

```js
env: { attack: 0.012, release: 0.5, peak: 0.28 }
```

| campo     | unidad   | que hace                                |
| --------- | -------- | --------------------------------------- |
| `attack`  | segundos | tiempo de subida hasta `peak`           |
| `release` | segundos | tiempo de caida hasta silencio          |
| `peak`    | 0..1     | escala el volumen final del preset      |

Para `additive`, `attack` y `release` son los defaults por parcial si no especificaste `decay`.

### `vibrato` — LFO sobre la frecuencia de cada `voice`

```js
vibrato: { rate: 5.5, depthHz: 5 }
```

`rate` en Hz (5–7 = vibrato natural, 0.1 = drift lentisimo). `depthHz` es la amplitud absoluta en Hz que el LFO suma/resta a la frecuencia.

Solo aplica a `voices` (no a `additive` ni `noise`).

### `echo` — delay con feedback

```js
echo: { time: 0.18, feedback: 0.35, mix: 0.32 }
```

Crea un eco "horneado" en la voz. Distinto del **delay per-planeta de la UI** (sliders Delay time / Delay mix en el panel Body), que se aplica encima de cualquier preset y es el que controla el usuario en vivo.

| campo      | unidad         | que hace                            |
| ---------- | -------------- | ----------------------------------- |
| `time`     | segundos       | tiempo de delay                     |
| `feedback` | 0..1           | cantidad reinyectada al delay       |
| `mix`      | 0..1           | nivel de la senal con eco vs. dry   |

### `duration` — vida total del nodo

```js
duration: 1.0
```

Cuanto tiempo viven los osciladores antes de detenerse. Si ponés un `release` largo, asegurate que `duration` sea por lo menos `attack + release + 0.3`.

---

## Asignar un preset por defecto a un planeta

`js/bodies.js` tiene un mapa `DEFAULT_PRESETS` que dice que voz arranca en cada cuerpo:

```js
export const DEFAULT_PRESETS = {
  Sun:     "pade",
  Mercury: "spiegel",
  Venus:   "radigue",
  Earth:   "carlos",
  Mars:    "derbyshire",
  Jupiter: "carlos",
  Saturn:  "oram",
  Uranus:  "oliveros",
  Neptune: "radigue",
};
```

Para asignar tu preset nuevo a un planeta por defecto, agregalo aca con la clave que pusiste en `PRESETS`. El usuario igual puede cambiarlo en vivo.

---

## Ejemplos completos

### Pad denso tipo bowed string

```js
bowed: {
  label: "Bowed",
  author: "—",
  description: "Saw apilado con detune ancho y filtro abriendo.",
  voices: [
    { type: "sawtooth", freqMul: 1.000, level: 1.0 },
    { type: "sawtooth", freqMul: 1.005, level: 1.0 },
    { type: "sawtooth", freqMul: 0.995, level: 1.0 },
  ],
  filter: { type: "lowpass", freqBase: 200, freqByStrength: 2400, q: 5 },
  env: { attack: 0.18, release: 1.4, peak: 0.22 },
  duration: 2.0,
}
```

### Hi-bell breve

```js
bell: {
  label: "Bell",
  author: "—",
  description: "Campana clara con armonicos inarmonicos.",
  additive: [
    { mul: 1.0, level: 1.0, decay: 0.35 },
    { mul: 2.4, level: 0.4, decay: 0.4 },
    { mul: 4.5, level: 0.2, decay: 0.5 },
  ],
  env: { attack: 0.002, release: 0.5, peak: 0.20 },
  duration: 0.6,
}
```

### Whoosh percusivo

```js
whoosh: {
  label: "Whoosh",
  author: "—",
  description: "Ruido con barrido descendente fuerte.",
  noise: {
    duration: 0.6,
    qBase: 6, qByStrength: 6,
    freqStart: 4.0, freqEnd: 0.4,
  },
  env: { attack: 0.005, release: 0.6, peak: 0.25 },
  duration: 0.6,
}
```

---

## Tips practicos

- Si suena muy fuerte, bajá `peak` o `level`.
- Si clickea al disparar, subí `attack` (5–15 ms suele alcanzar).
- Para drones largos, subí `attack` y `release` (0.3–2 s) y `duration` acorde.
- Para percusivo, `attack` corto (1–5 ms) y `release` corto (0.1–0.3 s).
- El **delay per-planeta** de la UI (Body > Delay time / Delay mix) es independiente del `echo` del preset. Podes combinarlos.
- Los osciladores de Web Audio no soportan automation curves complejas: si necesitas algo muy especifico, considera dos `voices` con `freqMul` distintos en lugar de inventar nuevos campos.
