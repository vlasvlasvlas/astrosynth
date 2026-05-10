import { state } from "./state.js";
import { PLANETS, SUN, INNER, palette } from "./bodies.js";
import { TWO_PI, daysSinceJ2000, orbitPointAtE, normRad } from "./kepler.js";

let canvas;
let ctx;

const TRAIL_ALPHA = 0.85;
const SIDEBAR_W = 380;
const SIDEBAR_BREAKPOINT = 900;

// On desktop the orrery permanently lives in the left portion of the canvas,
// reserving the rightmost SIDEBAR_W pixels so the sidebar (when open) never
// overlaps planets or orbits. The orrery never moves when the sidebar is
// toggled — the reserved area is always the same. On mobile the drawer is
// at the bottom so we use the full width.
export function tickLayout() {}

export function initRender(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
}


export function resizeCanvas() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function viewport() {
  const rect = canvas.getBoundingClientRect();
  const reserveSidebar = window.innerWidth > SIDEBAR_BREAKPOINT;
  const usableW = reserveSidebar ? Math.max(rect.width - SIDEBAR_W, 240) : rect.width;
  const cx = usableW * 0.5;
  const side = Math.min(usableW, rect.height);
  return {
    w: rect.width,
    h: rect.height,
    cx,
    cy: rect.height * 0.53,
    maxR: side * 0.455,
  };
}

export function mapRadius(au, vp = viewport()) {
  if (state.viewScale === "inner") return Math.min(vp.maxR, (au / 2.2) * vp.maxR);
  if (state.viewScale === "linear") return Math.min(vp.maxR, (au / 31) * vp.maxR);
  return (Math.log(1 + au) / Math.log(31)) * vp.maxR;
}

// Per-planet uniform scale: each orbit gets its own scale factor so the ellipse
// shape is preserved (Sun stays at the focus). The scale is set so the planet's
// semi-major axis maps to mapRadius(a) — keeping radial spacing close to the
// log/linear/inner mode while restoring true ellipse geometry.
export function planetScaleFactor(planet, vp = viewport()) {
  return mapRadius(planet.elements.a, vp) / planet.elements.a;
}

// Scaled projection: keeps direction, applies a uniform 2D scale.
export function projectScaled(point, scale, vp = viewport()) {
  return {
    x: vp.cx + point.x * scale,
    y: vp.cy + point.y * scale,
  };
}

export function project(pos, vp = viewport()) {
  const r = Math.hypot(pos.x, pos.y);
  const mapped = mapRadius(r, vp);
  const a = Math.atan2(pos.y, pos.x);
  return {
    x: vp.cx + Math.cos(a) * mapped,
    y: vp.cy + Math.sin(a) * mapped,
    r: mapped,
    angle: a,
  };
}

export function screenToWorld(sx, sy, vp = viewport()) {
  const dx = sx - vp.cx;
  const dy = sy - vp.cy;
  const mapped = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const au = inverseMapRadius(mapped, vp);
  return { x: Math.cos(angle) * au, y: Math.sin(angle) * au };
}

function inverseMapRadius(mapped, vp) {
  if (state.viewScale === "inner") return (mapped / vp.maxR) * 2.2;
  if (state.viewScale === "linear") return (mapped / vp.maxR) * 31;
  return Math.exp((mapped / vp.maxR) * Math.log(31)) - 1;
}

// Find the closest point on any planet's drawn orbit to a screen click.
// Returns world coordinates of that orbit point, the planet name, and the
// screen-space distance so the caller can decide whether to snap.
export function findOrbitSnap(sx, sy, vp = viewport()) {
  const days = daysSinceJ2000(state.simDate);
  let best = { x: 0, y: 0, planet: null, screenDist: Infinity };
  for (const planet of PLANETS) {
    const scale = planetScaleFactor(planet, vp);
    for (let i = 0; i < 240; i += 1) {
      const E = (i / 240) * TWO_PI;
      const wp = orbitPointAtE(planet, E, days);
      const screenX = vp.cx + wp.x * scale;
      const screenY = vp.cy + wp.y * scale;
      const d = Math.hypot(screenX - sx, screenY - sy);
      if (d < best.screenDist) {
        best = { x: wp.x, y: wp.y, planet: planet.name, screenDist: d };
      }
    }
  }
  return best;
}

export function screenToAngle(x, y) {
  const vp = viewport();
  return normRad(Math.atan2(y - vp.cy, x - vp.cx));
}

export function draw() {
  const vp = viewport();
  ctx.clearRect(0, 0, vp.w, vp.h);
  drawCenterCross(vp);
  drawReader(vp);
  drawOrbits(vp);
  drawGates(vp);

  ctx.save();
  ctx.globalAlpha = TRAIL_ALPHA;
  drawProbes(vp, state.probes, "probe");
  drawProbes(vp, state.ufos, "ufo");
  drawComets(vp);
  ctx.restore();

  drawBodies(vp);
  drawPulses(vp);
}

function drawCenterCross(vp) {
  ctx.save();
  ctx.strokeStyle = "rgba(236, 230, 210, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(vp.cx - 8, vp.cy);
  ctx.lineTo(vp.cx + 8, vp.cy);
  ctx.moveTo(vp.cx, vp.cy - 8);
  ctx.lineTo(vp.cx, vp.cy + 8);
  ctx.stroke();
  ctx.restore();
}

function drawReader(vp) {
  if (!state.readerEnabled) return;
  ctx.save();
  ctx.strokeStyle = "rgba(213, 179, 94, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(vp.cx, vp.cy);
  ctx.lineTo(
    vp.cx + Math.cos(state.readerAngle) * vp.maxR,
    vp.cy + Math.sin(state.readerAngle) * vp.maxR,
  );
  ctx.stroke();
  ctx.restore();
}

function drawOrbits(vp) {
  const days = daysSinceJ2000(state.simDate);
  for (const planet of PLANETS) {
    const settings = state.planetSettings.get(planet.name);
    const isInner = INNER.has(planet.name);
    const scale = planetScaleFactor(planet, vp);
    ctx.save();
    ctx.strokeStyle = settings.enabled
      ? isInner ? "rgba(236, 230, 210, 0.32)" : "rgba(236, 230, 210, 0.18)"
      : "rgba(236, 230, 210, 0.07)";
    ctx.lineWidth = planet.name === state.selected ? 1.6 : 1;
    if (!isInner) ctx.setLineDash([2, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 240; i += 1) {
      const point = orbitPointAtE(planet, (i / 240) * TWO_PI, days);
      const s = projectScaled(point, scale, vp);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function planetScreenPos(planet, vp) {
  const pos = state.positions.get(planet.name);
  const scale = planetScaleFactor(planet, vp);
  return projectScaled(pos, scale, vp);
}

function drawGates(vp) {
  for (const gate of state.gates) {
    const owner = gate.snappedTo ? PLANETS.find((p) => p.name === gate.snappedTo) : null;
    const s = owner
      ? projectScaled(gate, planetScaleFactor(owner, vp), vp)
      : project(gate, vp);
    ctx.save();
    ctx.strokeStyle = "#ece6d2";
    ctx.fillStyle = "#0c0d0b";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBodies(vp) {
  state.screenBodies = [];
  const sun = { x: vp.cx, y: vp.cy };
  drawBody(SUN, sun.x, sun.y, SUN.radius, true);
  state.screenBodies.push({ name: "Sun", x: sun.x, y: sun.y, radius: SUN.radius + 6 });

  for (const planet of PLANETS) {
    const s = planetScreenPos(planet, vp);
    const selected = planet.name === state.selected;
    const settings = state.planetSettings.get(planet.name);
    drawBody(planet, s.x, s.y, planet.radius + (selected ? 2.2 : 0), settings.enabled);
    state.screenBodies.push({ name: planet.name, x: s.x, y: s.y, radius: planet.radius + 8 });
  }
}

function drawBody(body, x, y, radius, enabled) {
  ctx.save();
  ctx.fillStyle = enabled ? body.color : "#545348";
  ctx.strokeStyle = body.name === state.selected ? "#ece6d2" : "#050604";
  ctx.lineWidth = body.name === state.selected ? 2 : 1;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TWO_PI);
  ctx.fill();
  ctx.stroke();
  if (body.name === "Saturn") {
    ctx.strokeStyle = enabled ? "rgba(201,183,123,0.75)" : "rgba(100,100,88,0.6)";
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.8, radius * 0.55, -0.2, 0, TWO_PI);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProbes(vp, list, kind) {
  for (const probe of list) {
    ctx.save();
    const probeColor = probe.color || (kind === "ufo" ? "#c96a4a" : "#7fa96b");
    ctx.strokeStyle = probe.status === "lost" ? "#ce4f43" : probeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < probe.trail.length; i += 1) {
      const s = project(probe.trail[i], vp);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    const s = project(probe, vp);
    if (kind === "ufo") {
      ctx.fillStyle = palette.Ufo;
      ctx.strokeStyle = "#050604";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 4);
      ctx.lineTo(s.x + 4, s.y);
      ctx.lineTo(s.x, s.y + 4);
      ctx.lineTo(s.x - 4, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = probe.status === "success" ? "#d5b35e" : (probe.color || "#7fa96b");
      ctx.strokeStyle = "#050604";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x + 6, s.y);
      ctx.lineTo(s.x - 4, s.y - 4);
      ctx.lineTo(s.x - 2, s.y);
      ctx.lineTo(s.x - 4, s.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawComets(vp) {
  for (const comet of state.comets) {
    if (comet.status === "gone") continue;
    ctx.save();
    ctx.strokeStyle = palette.Comet;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < comet.trail.length; i += 1) {
      const s = project(comet.trail[i], vp);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    const s = project(comet, vp);
    ctx.fillStyle = palette.Comet;
    ctx.strokeStyle = "#050604";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawPulses(vp) {
  for (const pulse of state.pulses) {
    const s = project(pulse, vp);
    const t = pulse.age / pulse.life;
    ctx.save();
    ctx.strokeStyle = pulse.color;
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8 + t * 90, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
  }
}

export function updatePulses(dt) {
  for (const pulse of state.pulses) pulse.age += dt;
  state.pulses = state.pulses.filter((pulse) => pulse.age < pulse.life);
}

export function addPulse(pos, color, type) {
  state.pulses.push({
    x: pos.x,
    y: pos.y,
    color,
    type,
    age: 0,
    life: type === "flare" ? 2.4 : 1.4,
  });
}
