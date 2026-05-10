export const TWO_PI = Math.PI * 2;
export const J2000 = 2451545.0;
export const MS_PER_DAY = 86400000;
export const MU_SUN = 4 * Math.PI * Math.PI;
export const KM_S_TO_AU_YR = 0.210945021;

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return ((rad * 180) / Math.PI + 360) % 360;
}

export function normRad(rad) {
  return ((rad % TWO_PI) + TWO_PI) % TWO_PI;
}

export function shortestDelta(a, b) {
  let d = normRad(b) - normRad(a);
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

export function julianDay(date) {
  return date.getTime() / MS_PER_DAY + 2440587.5;
}

export function daysSinceJ2000(date) {
  return julianDay(date) - J2000;
}

export function solveKepler(M, e) {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let i = 0; i < 8; i += 1) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

export function elementsAt(planet, days) {
  const T = days / 36525;
  const el = planet.elements;
  return {
    a: el.a + el.adot * T,
    e: el.e + el.edot * T,
    I: degToRad(el.I + el.Idot * T),
    L: degToRad(el.L + el.Ldot * T),
    p: degToRad(el.p + el.pdot * T),
    O: degToRad(el.O + el.Odot * T),
  };
}

export function orbitalPlaneToEcliptic(p, E) {
  const xp = p.a * (Math.cos(E) - p.e);
  const yp = p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
  const omega = p.p - p.O;
  const cosO = Math.cos(p.O);
  const sinO = Math.sin(p.O);
  const cosI = Math.cos(p.I);
  const sinI = Math.sin(p.I);
  const cosW = Math.cos(omega);
  const sinW = Math.sin(omega);

  return {
    x: (cosO * cosW - sinO * sinW * cosI) * xp + (-cosO * sinW - sinO * cosW * cosI) * yp,
    y: (sinO * cosW + cosO * sinW * cosI) * xp + (-sinO * sinW + cosO * cosW * cosI) * yp,
    z: sinW * sinI * xp + cosW * sinI * yp,
  };
}

export function stateVector(planet, days) {
  const p = elementsAt(planet, days);
  const M = normRad(p.L - p.p);
  const E = solveKepler(M, p.e);
  return orbitalPlaneToEcliptic(p, E);
}

export function velocityVector(planet, days) {
  const step = 0.05;
  const a = stateVector(planet, days - step);
  const b = stateVector(planet, days + step);
  const dt = (step * 2) / 365.25;
  return {
    x: (b.x - a.x) / dt,
    y: (b.y - a.y) / dt,
    z: (b.z - a.z) / dt,
  };
}

export function orbitPointAtE(planet, E, days) {
  return orbitalPlaneToEcliptic(elementsAt(planet, days), E);
}

export function midiToHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function midiToName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}
