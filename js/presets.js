// presets.js
//
// Paleta de voces de AstroSynth. Cada entrada describe en datos cómo se
// sintetiza la voz. El motor de audio (audio.js) lee este archivo y construye
// los nodos de Web Audio. Editá este archivo para tunear timbres o sumar
// voces nuevas — no hace falta tocar audio.js mientras respetes el formato.
//
// Formato de un preset:
//
// {
//   label:       string       — nombre corto para la UI
//   author:      string       — pionera/inspiración
//   description: string       — qué se escucha
//   voices:      Array        — osciladores tonales, todos sumados
//     [{ type: "sine"|"triangle"|"sawtooth"|"square",
//        freqMul: number,    // multiplica la frecuencia base
//        level:   number }]  // ganancia 0..1
//   additive:    Array        — alternativa: armónicos individuales con su decay
//     [{ mul: number, level: number, decay: number }]
//   noise:       Object       — alternativa: ruido filtrado en barrido
//     { duration: seconds, qBase, qByStrength, freqStart, freqEnd } // freq* multiplican freq base
//   filter:      Object       — biquad después de voices
//     { type: "lowpass"|"highpass"|"bandpass",
//       freqFixed?: Hz |
//       freqMulCarrier?: number |
//       (freqBase, freqByStrength): number+number*strength,
//       q: number }
//   env:         Object       — envolvente global
//     { attack: s, release: s, peak: 0..1 }   // peak escala el volumen final
//   vibrato:     Object       — opcional, LFO sobre frecuencia de cada voice
//     { rate: Hz, depthHz: number }
//   echo:        Object       — opcional, delay con feedback
//     { time: s, feedback: 0..1, mix: 0..1 }
//   duration:    seconds      — vida total del nodo (para detener osc)
// }

export const PRESETS = {
  carlos: {
    label: "Carlos",
    author: "Wendy Carlos",
    description: "Saw + sub filtrados tipo Moog con ADSR clasico.",
    voices: [
      { type: "sawtooth", freqMul: 1.0, level: 1.0 },
      { type: "sine",     freqMul: 0.5, level: 0.6 },
    ],
    filter: { type: "lowpass", freqBase: 520, freqByStrength: 1800, q: 4 },
    env:    { attack: 0.012, release: 0.5, peak: 0.28 },
    duration: 1.0,
  },

  derbyshire: {
    label: "Derbyshire",
    author: "Delia Derbyshire",
    description: "Triangulos detuneados con bandpass. Sabor BBC Radiophonic 1963.",
    voices: [
      { type: "triangle", freqMul: 1.0,    level: 1.0 },
      { type: "triangle", freqMul: 1.0078, level: 1.0 },
    ],
    filter: { type: "bandpass", freqMulCarrier: 2.5, q: 8 },
    env:    { attack: 0.004, release: 0.6, peak: 0.30 },
    echo:   { time: 0.18, feedback: 0.35, mix: 0.32 },
    duration: 1.1,
  },

  oram: {
    label: "Oram",
    author: "Daphne Oram",
    description: "Aditiva con armonicos 1-2-3-5. Oramics / drawn sound.",
    additive: [
      { mul: 1, level: 1.00, decay: 0.55 },
      { mul: 2, level: 0.50, decay: 0.50 },
      { mul: 3, level: 0.28, decay: 0.45 },
      { mul: 5, level: 0.16, decay: 0.40 },
    ],
    env: { attack: 0.018, release: 0.7, peak: 0.25 },
    duration: 1.2,
  },

  oliveros: {
    label: "Oliveros",
    author: "Pauline Oliveros",
    description: "Drone profundo con ataque lento. Deep Listening.",
    voices: [
      { type: "sine", freqMul: 0.5, level: 1.0 },
    ],
    filter: { type: "lowpass", freqFixed: 900, q: 2 },
    env: { attack: 0.4, release: 1.8, peak: 0.18 },
    duration: 2.4,
  },

  pade: {
    label: "Pade",
    author: "Else Marie Pade",
    description: "Ruido filtrado con barrido bandpass descendente.",
    noise: {
      duration: 0.8,
      qBase: 4, qByStrength: 4,
      freqStart: 2.0, freqEnd: 0.7,
    },
    env: { attack: 0.005, release: 0.7, peak: 0.22 },
    duration: 0.8,
  },

  radigue: {
    label: "Radigue",
    author: "Eliane Radigue",
    description: "Dos sinusoidales muy proximas: pulsacion lenta (beating).",
    voices: [
      { type: "sine", freqMul: 0.5,         level: 1.0 },
      { type: "sine", freqMul: 0.5 * 1.0035, level: 1.0 },
    ],
    env: { attack: 0.6, release: 2.0, peak: 0.20 },
    duration: 2.8,
  },

  spiegel: {
    label: "Spiegel",
    author: "Laurie Spiegel",
    description: "Bell partials inarmonicos. Algoritmico / glockenspiel.",
    additive: [
      { mul: 1.00, level: 1.00, decay: 0.40 },
      { mul: 2.76, level: 0.50, decay: 0.45 },
      { mul: 5.40, level: 0.33, decay: 0.50 },
      { mul: 8.93, level: 0.25, decay: 0.55 },
    ],
    env: { attack: 0.005, release: 0.5, peak: 0.18 },
    duration: 0.8,
  },

  theremin: {
    label: "Theremin",
    author: "Lev Termen",
    description: "Sinusoidal con vibrato amplio. Aire / cuerda etereal.",
    voices: [
      { type: "sine", freqMul: 1.0, level: 1.0 },
    ],
    filter: { type: "lowpass", freqFixed: 3500, q: 1.5 },
    vibrato: { rate: 5.5, depthHz: 5 },
    env: { attack: 0.08, release: 0.9, peak: 0.22 },
    duration: 1.2,
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);
