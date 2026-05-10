export const palette = {
  Mercury: "#b7ad95",
  Venus: "#d6b56a",
  Earth: "#6f9fc3",
  Mars: "#c96a4a",
  Jupiter: "#d3a66b",
  Saturn: "#c9b77b",
  Uranus: "#7fb9ad",
  Neptune: "#6b82c8",
  Sun: "#d7b65f",
  Comet: "#dfe8ec",
  Ufo: "#c96a4a",
  Probe: "#7fa96b",
};

// Inner / outer split is musical, not just visual.
export const INNER = new Set(["Mercury", "Venus", "Earth", "Mars"]);

// JPL "Approximate Positions of the Planets" Keplerian elements around J2000.
export const PLANETS = [
  { name: "Mercury", radius: 2.2, mass: 1.660e-7, note: 64, color: palette.Mercury, action: "Perihelion ping", // E4 — D Dorian
    elements: { a: 0.38709927, adot: 0.00000037, e: 0.20563593, edot: 0.00001906, I: 7.00497902, Idot: -0.00594749, L: 252.25032350, Ldot: 149472.67411175, p: 77.45779628, pdot: 0.16047689, O: 48.33076593, Odot: -0.12534081 } },
  { name: "Venus", radius: 3.2, mass: 2.447e-6, note: 60, color: palette.Venus, action: "Cloud veil", // C4 — 7ma menor de D Dorian
    elements: { a: 0.72333566, adot: -0.00000390, e: 0.00677672, edot: -0.00004107, I: 3.39467605, Idot: -0.00078890, L: 181.97909950, Ldot: 58517.81538729, p: 131.60246718, pdot: 0.00268329, O: 76.67984255, Odot: -0.27769418 } },
  { name: "Earth", radius: 3.5, mass: 3.003e-6, note: 57, color: palette.Earth, action: "Launch probe", // A3 — 5ta de D Dorian
    elements: { a: 1.00000261, adot: 0.00000562, e: 0.01671123, edot: -0.00004392, I: -0.00001531, Idot: -0.01294668, L: 100.46457166, Ldot: 35999.37244981, p: 102.93768193, pdot: 0.32327364, O: 0, Odot: 0 } },
  { name: "Mars", radius: 2.8, mass: 3.227e-7, note: 53, color: palette.Mars, action: "UFO swarm", // F3 — 3ra menor, toque oscuro
    elements: { a: 1.52371034, adot: 0.00001847, e: 0.09339410, edot: 0.00007882, I: 1.84969142, Idot: -0.00813131, L: -4.55343205, Ldot: 19140.30268499, p: -23.94362959, pdot: 0.44441088, O: 49.55953891, Odot: -0.29257343 } },
  { name: "Jupiter", radius: 7.3, mass: 9.545e-4, note: 50, color: palette.Jupiter, action: "Gravity chorus", // D3 — octava de la raiz
    elements: { a: 5.20288700, adot: -0.00011607, e: 0.04838624, edot: -0.00013253, I: 1.30439695, Idot: -0.00183714, L: 34.39644051, Ldot: 3034.74612775, p: 14.72847983, pdot: 0.21252668, O: 100.47390909, Odot: 0.20469106 } },
  { name: "Saturn", radius: 6.6, mass: 2.857e-4, note: 45, color: palette.Saturn, action: "Ring gates", // A2 — 5ta grave
    elements: { a: 9.53667594, adot: -0.00125060, e: 0.05386179, edot: -0.00050991, I: 2.48599187, Idot: 0.00193609, L: 49.95424423, Ldot: 1222.49362201, p: 92.59887831, pdot: -0.41897216, O: 113.66242448, Odot: -0.28867794 } },
  { name: "Uranus", radius: 5.4, mass: 4.366e-5, note: 43, color: palette.Uranus, action: "Tilt drone", // G2 — 4ta grave
    elements: { a: 19.18916464, adot: -0.00196176, e: 0.04725744, edot: -0.00004397, I: 0.77263783, Idot: -0.00242939, L: 313.23810451, Ldot: 428.48202785, p: 170.95427630, pdot: 0.40805281, O: 74.01692503, Odot: 0.04240589 } },
  { name: "Neptune", radius: 5.2, mass: 5.151e-5, note: 38, color: palette.Neptune, action: "Deep sweep",
    elements: { a: 30.06992276, adot: 0.00026291, e: 0.00859048, edot: 0.00005105, I: 1.77004347, Idot: 0.00035372, L: -55.12002969, Ldot: 218.45945325, p: 44.96476227, pdot: -0.32241464, O: 131.78422574, Odot: -0.00508664 } },
];

export const SUN = {
  name: "Sun",
  note: 38, // D2 — raiz de D Dorian
  color: palette.Sun,
  radius: 12,
  action: "Solar flare",
};

// Default sonic preset per body — chosen to match each planet's character.
// Names reference women pioneers of electronic music.
export const DEFAULT_PRESETS = {
  Sun: "pade",
  Mercury: "spiegel",
  Venus: "radigue",
  Earth: "carlos",
  Mars: "derbyshire",
  Jupiter: "carlos",
  Saturn: "oram",
  Uranus: "oliveros",
  Neptune: "radigue",
};

export function planetByName(name) {
  if (name === "Sun") return SUN;
  return PLANETS.find((planet) => planet.name === name);
}
