import { state } from "./state.js";
import { PLANETS, palette } from "./bodies.js";
import {
  MU_SUN,
  TWO_PI,
  daysSinceJ2000,
  stateVector,
  velocityVector,
  normRad,
  shortestDelta,
} from "./kepler.js";
import { playPlanet, stopProbeDrone, updateProbeDrone } from "./audio.js";

const lastAngles = new Map();

export function updatePlanetCache() {
  const days = daysSinceJ2000(state.simDate);
  state.positions.set("Sun", { x: 0, y: 0, z: 0 });
  state.velocities.set("Sun", { x: 0, y: 0, z: 0 });
  for (const planet of PLANETS) {
    state.positions.set(planet.name, stateVector(planet, days));
    state.velocities.set(planet.name, velocityVector(planet, days));
  }
}

function accelerationAt(x, y, days) {
  let ax = 0;
  let ay = 0;
  const r2 = x * x + y * y + 0.000025;
  const r = Math.sqrt(r2);
  ax += (-MU_SUN * x) / (r2 * r);
  ay += (-MU_SUN * y) / (r2 * r);

  for (const planet of PLANETS) {
    const pos = stateVector(planet, days);
    const dx = pos.x - x;
    const dy = pos.y - y;
    const d2 = dx * dx + dy * dy + 0.0001;
    const d = Math.sqrt(d2);
    const mu = MU_SUN * planet.mass;
    ax += (mu * dx) / (d2 * d);
    ay += (mu * dy) / (d2 * d);
  }
  return { ax, ay };
}

function integrateTracer(body, deltaDays) {
  const totalYears = deltaDays / 365.25;
  const direction = Math.sign(totalYears) || 1;
  const maxStep = 0.004;
  const steps = Math.max(1, Math.min(80, Math.ceil(Math.abs(totalYears) / maxStep)));
  const dt = totalYears / steps;
  const baseDays = daysSinceJ2000(state.simDate);

  for (let i = 0; i < steps; i += 1) {
    const acc = accelerationAt(body.x, body.y, baseDays + direction * i * Math.abs(dt) * 365.25);
    body.vx += acc.ax * dt;
    body.vy += acc.ay * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }
  body.trail.push({ x: body.x, y: body.y });
  const max = body.trailMax || state.trailLength;
  while (body.trail.length > max) body.trail.shift();
}

export function advanceProbes(deltaDays, dom, addPulse, logEvent) {
  for (const probe of state.probes) {
    if (probe.status === "lost" || probe.status === "interstellar") continue;
    integrateTracer(probe, deltaDays);
    updateProbeDrone(probe, dom.droneTone, dom.droneVolume);
    evaluateProbe(probe, addPulse, logEvent);
  }
}

export function advanceUfos(deltaDays, dom, addPulse, logEvent) {
  for (const ufo of state.ufos) {
    if (ufo.status === "lost" || ufo.status === "interstellar") continue;
    integrateTracer(ufo, deltaDays);
    updateProbeDrone(ufo, dom.droneTone, dom.droneVolume);
    evaluateUfo(ufo, addPulse, logEvent);
  }
}

export function advanceComets(deltaDays, addPulse, logEvent) {
  for (const comet of state.comets) {
    if (comet.status === "gone") continue;
    integrateTracer(comet, deltaDays);
    evaluateComet(comet, addPulse, logEvent);
  }
}

function evaluateProbe(probe, addPulse, logEvent) {
  const r = Math.hypot(probe.x, probe.y);
  if (r < 0.08) {
    probe.status = "lost";
    stopProbeDrone(probe);
    addPulse({ x: probe.x, y: probe.y }, palette.Sun, "lost");
    playPlanet("Sun", 1.2, 0);
    logEvent(`${probe.name} was lost inside solar heat`);
    return;
  }
  if (r > 64) {
    probe.status = "interstellar";
    stopProbeDrone(probe);
    playPlanet("Neptune", 0.7, -1);
    logEvent(`${probe.name} reached interstellar drift`);
    return;
  }
  for (const planet of PLANETS) {
    const pos = state.positions.get(planet.name);
    if (!pos) continue;
    const d = Math.hypot(pos.x - probe.x, pos.y - probe.y);
    const threshold = planet.name === probe.target ? 0.13 : 0.075;
    if (d < threshold && !probe.visited.has(planet.name)) {
      probe.visited.add(planet.name);
      probe.status = planet.name === probe.target ? "success" : `flyby ${planet.name}`;
      const v = state.velocities.get(planet.name) || { x: 0, y: 0 };
      probe.vx += v.x * planet.mass * 42;
      probe.vy += v.y * planet.mass * 42;
      playPlanet(planet.name, planet.name === probe.target ? 1.35 : 0.8, planet.name === probe.target ? 1 : 0);
      addPulse(pos, planet.color, "assist");
      logEvent(`${probe.name} ${planet.name === probe.target ? "reached" : "used"} ${planet.name}`);
    }
  }
}

function evaluateUfo(ufo, addPulse, logEvent) {
  const r = Math.hypot(ufo.x, ufo.y);
  if (r < 0.08) {
    ufo.status = "lost";
    stopProbeDrone(ufo);
    addPulse({ x: ufo.x, y: ufo.y }, palette.Sun, "lost");
    return;
  }
  if (r > 50) {
    ufo.status = "interstellar";
    stopProbeDrone(ufo);
    return;
  }
}

function evaluateComet(comet, addPulse, logEvent) {
  const r = Math.hypot(comet.x, comet.y);
  if (r > 90) {
    comet.status = "gone";
    if (!comet.farewelled) {
      comet.farewelled = true;
      logEvent(`${comet.name} left the system`);
    }
  }
}

export function spawnComet(logEvent) {
  // Pick a wide eccentric orbit: perihelion 0.4-1.5 AU, aphelion 40-80 AU.
  const peri = 0.4 + Math.random() * 1.1;
  const apo = 40 + Math.random() * 40;
  const a = (peri + apo) / 2;
  const e = (apo - peri) / (apo + peri);
  // Spawn at aphelion at a random orientation.
  const omega = Math.random() * TWO_PI;
  const direction = Math.random() < 0.5 ? 1 : -1; // prograde or retrograde
  const x = Math.cos(omega) * apo;
  const y = Math.sin(omega) * apo;
  // Velocity tangent to radius at aphelion: v = sqrt(MU * (2/r - 1/a))
  const speed = Math.sqrt(MU_SUN * (2 / apo - 1 / a));
  const vx = -Math.sin(omega) * speed * direction;
  const vy = Math.cos(omega) * speed * direction;

  const id = state.cometCounter;
  state.cometCounter += 1;
  const comet = {
    id,
    name: `Comet ${id}`,
    x, y, vx, vy,
    status: "drift",
    trail: [],
    trailMax: 600,
    visited: new Set(),
    created: state.simDate.getTime(),
    audio: null,
  };
  state.comets.push(comet);
  logEvent(`${comet.name} appeared near ${apo.toFixed(0)} AU`);
  return comet;
}

export function processReader(addPulse) {
  if (!state.readerEnabled) return;
  for (const planet of PLANETS) {
    const pos = state.positions.get(planet.name);
    const current = normRad(Math.atan2(pos.y, pos.x));
    const previous = lastAngles.get(planet.name);
    if (previous == null) {
      lastAngles.set(planet.name, current);
      continue;
    }
    if (angleCrossed(previous, current, state.readerAngle)) {
      playPlanet(planet.name, 0.65, 0);
      addPulse(pos, planet.color, "reader");
    }
    lastAngles.set(planet.name, current);
  }
}

function angleCrossed(previous, current, target) {
  const delta = shortestDelta(previous, current);
  if (Math.abs(delta) < 0.00001) return false;
  let t = target;
  while (t - previous > Math.PI) t -= TWO_PI;
  while (t - previous < -Math.PI) t += TWO_PI;
  return delta > 0
    ? t > previous && t <= previous + delta
    : t < previous && t >= previous + delta;
}

export function resetReaderState() {
  lastAngles.clear();
}
