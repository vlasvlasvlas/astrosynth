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
    description: "Triangulos filtrados con armonicos seno. Caido y claro, como un Rhodes suave.",
    voices: [
      { type: "triangle", freqMul: 1.0, level: 1.0 },
      { type: "sine",     freqMul: 2.0, level: 0.35 },
      { type: "sine",     freqMul: 3.0, level: 0.12 },
    ],
    filter: { type: "lowpass", freqBase: 2400, freqByStrength: 900, q: 1.8 },
    env:    { attack: 0.010, release: 0.70, peak: 0.30 },
    duration: 1.1,
  },

  derbyshire: {
    label: "Derbyshire",
    author: "Delia Derbyshire",
    description: "Pluck de triangulos: ataque vivo, caida limpia. BBC Radiophonic.",
    voices: [
      { type: "triangle", freqMul: 1.0,  level: 1.0 },
      { type: "sine",     freqMul: 2.0,  level: 0.45 },
      { type: "sine",     freqMul: 3.01, level: 0.18 },
    ],
    filter: { type: "lowpass", freqBase: 3000, freqByStrength: 1200, q: 1.6 },
    env:    { attack: 0.004, release: 0.50, peak: 0.28 },
    duration: 0.85,
  },

  oram: {
    label: "Oram",
    author: "Daphne Oram",
    description: "Aditiva organica con 5 armonicos naturales. Como un organo suave.",
    additive: [
      { mul: 1, level: 1.00, decay: 0.80 },
      { mul: 2, level: 0.55, decay: 0.68 },
      { mul: 3, level: 0.28, decay: 0.55 },
      { mul: 4, level: 0.14, decay: 0.44 },
      { mul: 5, level: 0.07, decay: 0.33 },
    ],
    env: { attack: 0.015, release: 0.80, peak: 0.26 },
    duration: 1.5,
  },

  oliveros: {
    label: "Oliveros",
    author: "Pauline Oliveros",
    description: "Seno con sub-octava y swell lento. Meditativo. Deep Listening.",
    voices: [
      { type: "sine", freqMul: 1.0, level: 1.0 },
      { type: "sine", freqMul: 0.5, level: 0.45 },
    ],
    filter: { type: "lowpass", freqFixed: 1100, q: 1.5 },
    env: { attack: 0.25, release: 1.50, peak: 0.22 },
    duration: 2.2,
  },

  pade: {
    label: "Pade",
    author: "Else Marie Pade",
    description: "Ruido filtrado con barrido bandpass descendente. Ideal para el Sol.",
    noise: {
      duration: 0.8,
      qBase: 4, qByStrength: 4,
      freqStart: 2.0, freqEnd: 0.7,
    },
    env: { attack: 0.005, release: 0.7, peak: 0.24 },
    duration: 0.8,
  },

  radigue: {
    label: "Radigue",
    author: "Eliane Radigue",
    description: "Par de senos ligeramente desafinados: pulsacion hipnotica lenta.",
    voices: [
      { type: "sine", freqMul: 1.000,  level: 1.0 },
      { type: "sine", freqMul: 1.004,  level: 0.90 },
    ],
    filter: { type: "lowpass", freqFixed: 2200, q: 1.2 },
    env: { attack: 0.30, release: 1.80, peak: 0.24 },
    duration: 2.8,
  },

  spiegel: {
    label: "Spiegel",
    author: "Laurie Spiegel",
    description: "Campana aditiva inarmonica. Cristalina y brillante.",
    additive: [
      { mul: 1.00, level: 1.00, decay: 0.70 },
      { mul: 2.76, level: 0.42, decay: 0.55 },
      { mul: 5.40, level: 0.22, decay: 0.38 },
      { mul: 8.93, level: 0.10, decay: 0.25 },
    ],
    env: { attack: 0.003, release: 0.70, peak: 0.26 },
    duration: 1.2,
  },

  theremin: {
    label: "Theremin",
    author: "Clara Rockmore",
    description: "Sinusoidal con vibrato. Aire etereo, voz sin cuerpo.",
    voices: [
      { type: "sine", freqMul: 1.0, level: 1.0 },
    ],
    filter: { type: "lowpass", freqFixed: 3500, q: 1.5 },
    vibrato: { rate: 5.5, depthHz: 5 },
    env: { attack: 0.08, release: 0.90, peak: 0.24 },
    duration: 1.2,
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);
