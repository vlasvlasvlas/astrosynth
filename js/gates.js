import { state } from "./state.js";
import { PLANETS, palette } from "./bodies.js";
import { TWO_PI, daysSinceJ2000, orbitPointAtE, normRad } from "./kepler.js";
import { playPreset } from "./audio.js";

const GATE_SNAP_AU = 0.6;
const GATE_TRIGGER_AU = 0.12;

let inside = new Map();

function gateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function snapToNearestOrbit(worldX, worldY) {
  const days = daysSinceJ2000(state.simDate);
  let best = { x: worldX, y: worldY, planet: null, dist: Infinity };
  for (const planet of PLANETS) {
    for (let i = 0; i < 240; i += 1) {
      const E = (i / 240) * TWO_PI;
      const point = orbitPointAtE(planet, E, days);
      const d = Math.hypot(point.x - worldX, point.y - worldY);
      if (d < best.dist) {
        best = { x: point.x, y: point.y, planet: planet.name, dist: d };
      }
    }
  }
  return best.dist < GATE_SNAP_AU
    ? { x: best.x, y: best.y, snappedTo: best.planet }
    : { x: worldX, y: worldY, snappedTo: null };
}

export function addGate(worldX, worldY, { preset, note, peak } = {}) {
  const snapped = snapToNearestOrbit(worldX, worldY);
  const gate = {
    id: gateId(),
    x: snapped.x,
    y: snapped.y,
    snappedTo: snapped.snappedTo,
    preset: preset || "spiegel",
    note: note ?? noteForRadius(Math.hypot(snapped.x, snapped.y)),
    peak: peak ?? 0.55,
  };
  state.gates.push(gate);
  inside.set(gate.id, new Map());
  return gate;
}

export function removeGate(id) {
  state.gates = state.gates.filter((g) => g.id !== id);
  inside.delete(id);
}

export function clearGates() {
  state.gates = [];
  inside.clear();
}

// Map heliocentric radius to a D Dorian scale note. Inner orbits = higher notes.
function noteForRadius(au) {
  if (au < 0.55) return 64; // E4 — Mercury range
  if (au < 0.9)  return 60; // C4 — Venus range
  if (au < 1.2)  return 57; // A3 — Earth range
  if (au < 1.8)  return 53; // F3 — Mars range
  if (au < 3)    return 50; // D3 — asteroid belt
  if (au < 7)    return 45; // A2 — Jupiter range
  if (au < 12)   return 43; // G2 — Saturn range
  if (au < 22)   return 41; // F2 — Uranus range
  return 38;                 // D2 — Neptune/outer
}

export function trackedBodies() {
  const out = [];
  for (const planet of PLANETS) {
    const pos = state.positions.get(planet.name);
    if (!pos) continue;
    out.push({ id: `planet:${planet.name}`, x: pos.x, y: pos.y, kind: "planet", color: planet.color, ref: planet });
  }
  for (const probe of state.probes) {
    if (probe.status === "lost" || probe.status === "interstellar") continue;
    out.push({ id: `probe:${probe.id}`, x: probe.x, y: probe.y, kind: "probe", color: palette.Probe, ref: probe });
  }
  for (const ufo of state.ufos) {
    if (ufo.status === "lost" || ufo.status === "interstellar") continue;
    out.push({ id: `ufo:${ufo.id}`, x: ufo.x, y: ufo.y, kind: "ufo", color: palette.Ufo, ref: ufo });
  }
  for (const comet of state.comets) {
    if (comet.status === "gone") continue;
    out.push({ id: `comet:${comet.id}`, x: comet.x, y: comet.y, kind: "comet", color: palette.Comet, ref: comet });
  }
  return out;
}

export function processGates(addPulse, logEvent) {
  if (!state.gates.length) return;
  const bodies = trackedBodies();
  for (const gate of state.gates) {
    const insideMap = inside.get(gate.id) || new Map();
    inside.set(gate.id, insideMap);
    for (const body of bodies) {
      const d = Math.hypot(body.x - gate.x, body.y - gate.y);
      const wasInside = insideMap.get(body.id) === true;
      const nowInside = d < GATE_TRIGGER_AU;
      if (nowInside && !wasInside) {
        triggerGate(gate, body, addPulse, logEvent);
      }
      insideMap.set(body.id, nowInside);
    }
  }
}

function triggerGate(gate, body, addPulse, logEvent) {
  const strength = body.kind === "comet" ? 1.2 : body.kind === "ufo" ? 0.85 : body.kind === "probe" ? 0.7 : 1;
  playPreset(gate.preset, gate.note, gate.peak * strength, gate.x, strength);
  addPulse({ x: gate.x, y: gate.y }, body.color, "gate");
  if (body.kind !== "planet") {
    logEvent(`${body.kind} crossed gate (${gate.preset})`);
  }
}
