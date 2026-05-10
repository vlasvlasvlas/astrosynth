import { state } from "./state.js";
import { PLANETS, palette, planetByName } from "./bodies.js";
import { KM_S_TO_AU_YR, TWO_PI, midiToName } from "./kepler.js";
import {
  ensureAudio,
  playPlanet,
  playPreset,
  playNoise,
  createProbeDrone,
  PRESET_NAMES,
  PRESETS,
} from "./audio.js";
import { resizeCanvas, screenToWorld, addPulse, findOrbitSnap, viewport } from "./render.js";
import { updatePlanetCache, resetReaderState } from "./sim.js";
import { addGate, removeGate, clearGates } from "./gates.js";

const dom = {};

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7V5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',
  audioOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8c1.5 1.2 2.5 2.5 2.5 4s-1 2.8-2.5 4M19 6c2 1.6 3.5 3.6 3.5 6s-1.5 4.4-3.5 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  audioOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
};

const ACTION_DESCRIPTIONS = {
  Sun: "Empuja sondas y UFOs activos hacia afuera + flash brillante.",
  Mercury: "Ping rapido en registro agudo.",
  Venus: "Velo de nube: drone + ruido oscuro.",
  Earth: "Lanza una sonda libre hacia el target del Probe Lab.",
  Mars: "Suelta un enjambre de UFOs en trayectorias divergentes.",
  Jupiter: "Coro de gravedad: cuatro disparos en armonia.",
  Saturn: "Deposita 6 gates equiespaciados sobre su orbita (preset Oram).",
  Uranus: "Drone inclinado en registro grave.",
  Neptune: "Barrido grave profundo + ruido lento.",
};

export function initUi(canvas) {
  cacheDom();
  populatePresetSelectors();
  bindEvents(canvas);
  setSpeedFromSlider();
  selectBody("Earth");
  refreshIcons();
  initLayoutForViewport();
  setActiveTab("body");
}

function initLayoutForViewport() {
  // Start with sidebar collapsed on every viewport; the canvas dominates by
  // default and the user reveals controls via the toggle when they need them.
  document.body.classList.add("sidebar-hidden");
}

function setActiveTab(name) {
  document.body.dataset.tab = name;
  for (const btn of document.querySelectorAll(".tab")) {
    const active = btn.dataset.tab === name;
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }
}

function cacheDom() {
  const ids = [
    "dateReadout", "modeReadout", "audioReadout", "probeReadout",
    "playToggle", "audioToggle", "nowButton",
    "speed", "speedLabel",
    "readerEnabled",
    "viewScale", "placeMode",
    "trailLength", "trailLengthLabel",
    "selectedName", "selectedDistance", "selectedVelocity",
    "planetEnabled", "planetVolume", "planetVolumeLabel",
    "pitchOffset", "pitchLabel",
    "planetPreset", "planetPresetLabel", "planetPresetHint",
    "planetAction", "planetActionHint",
    "autoLaunchEnabled", "autoInterval", "autoIntervalLabel",
    "delayTime", "delayTimeLabel", "delayMix", "delayMixLabel",
    "clearGates", "gateList",
    "gateNote", "gateNoteLabel", "gatePreset",
    "probeProfile", "probeTarget",
    "launchBoost", "boostLabel",
    "droneVolume", "droneVolumeLabel",
    "droneTone", "droneToneLabel",
    "launchProbe", "probeList",
    "aboutButton", "aboutModal", "aboutClose",
    "sidebarToggle", "fullscreenToggle",
  ];
  for (const id of ids) {
    dom[id] = document.getElementById(id);
  }
}

function populatePresetSelectors() {
  const optionsHtml = PRESET_NAMES.map((p) => {
    const label = PRESETS[p]?.label || p;
    return `<option value="${p}">${label}</option>`;
  }).join("");
  if (dom.planetPreset) dom.planetPreset.innerHTML = optionsHtml;
  if (dom.gatePreset) dom.gatePreset.innerHTML = optionsHtml;
}

function presetDescription(name) {
  const p = PRESETS[name];
  if (!p) return "";
  const author = p.author ? `${p.author}. ` : "";
  return `${author}${p.description || ""}`;
}

function refreshIcons() {
  dom.playToggle.innerHTML = state.running ? ICONS.pause : ICONS.play;
  dom.audioToggle.innerHTML = state.audioOn ? ICONS.audioOn : ICONS.audioOff;
  dom.audioToggle.classList.toggle("muted", !state.audioOn);
}

function bindEvents(canvas) {
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("click", (e) => handleCanvasClick(e, canvas));

  dom.playToggle.addEventListener("click", () => {
    state.running = !state.running;
    refreshIcons();
    updateHud();
  });
  dom.audioToggle.addEventListener("click", () => {
    ensureAudio(() => logEvent("Audio engine armed"));
    refreshIcons();
    updateHud();
  });
  dom.nowButton.addEventListener("click", () => {
    state.simDate = new Date();
    resetReaderState();
    logEvent("Time reset to current date");
  });
  dom.speed.addEventListener("input", () => {
    setSpeedFromSlider();
    updateHud();
  });
  dom.readerEnabled.addEventListener("change", () => {
    state.readerEnabled = dom.readerEnabled.checked;
  });
  dom.viewScale.addEventListener("change", () => {
    state.viewScale = dom.viewScale.value;
  });
  dom.trailLength.addEventListener("input", () => {
    state.trailLength = Number(dom.trailLength.value);
    dom.trailLengthLabel.textContent = String(state.trailLength);
    truncateExistingTrails();
  });
  dom.placeMode.addEventListener("click", () => {
    state.placeMode = !state.placeMode;
    updateHud();
    if (state.placeMode && window.innerWidth <= 900) {
      document.body.classList.add("sidebar-hidden");
    }
  });
  dom.planetEnabled.addEventListener("change", () => {
    state.planetSettings.get(state.selected).enabled = dom.planetEnabled.checked;
    renderSelectedPanel();
  });
  dom.planetVolume.addEventListener("input", () => {
    state.planetSettings.get(state.selected).volume = Number(dom.planetVolume.value) / 100;
    renderSelectedPanel();
  });
  dom.pitchOffset.addEventListener("input", () => {
    state.planetSettings.get(state.selected).pitchOffset = Number(dom.pitchOffset.value);
    renderSelectedPanel();
  });
  dom.planetPreset.addEventListener("change", () => {
    state.planetSettings.get(state.selected).preset = dom.planetPreset.value;
    updatePresetHint();
    playPlanet(state.selected, 0.55, 0);
  });
  dom.planetAction.addEventListener("click", () => runActionFor(state.selected));
  dom.autoLaunchEnabled.addEventListener("change", () => {
    const settings = state.planetSettings.get(state.selected);
    settings.autoLaunch = dom.autoLaunchEnabled.checked;
    settings.lastAutoAt = performance.now();
  });
  dom.autoInterval.addEventListener("input", () => {
    const settings = state.planetSettings.get(state.selected);
    const seconds = Number(dom.autoInterval.value);
    settings.autoIntervalMs = seconds * 1000;
    dom.autoIntervalLabel.textContent = `${seconds} s`;
  });
  dom.delayTime.addEventListener("input", () => {
    const settings = state.planetSettings.get(state.selected);
    const ms = Number(dom.delayTime.value);
    settings.delayTime = ms / 1000;
    dom.delayTimeLabel.textContent = `${(settings.delayTime).toFixed(2)} s`;
  });
  dom.delayMix.addEventListener("input", () => {
    const settings = state.planetSettings.get(state.selected);
    const pct = Number(dom.delayMix.value);
    settings.delayMix = pct / 100;
    dom.delayMixLabel.textContent = `${pct}%`;
  });
  dom.clearGates.addEventListener("click", () => {
    clearGates();
    renderLists();
    logEvent("Gates cleared");
  });
  dom.gateList.addEventListener("click", (event) => {
    const id = event.target?.dataset?.removeGate;
    if (!id) return;
    removeGate(id);
    renderLists();
  });
  dom.gateNote.addEventListener("input", () => {
    dom.gateNoteLabel.textContent = midiToName(Number(dom.gateNote.value));
  });
  dom.launchProbe.addEventListener("click", () => launchProbe());
  dom.launchBoost.addEventListener("input", updateHud);
  dom.droneVolume.addEventListener("input", updateHud);
  dom.droneTone.addEventListener("input", updateHud);

  dom.aboutButton.addEventListener("click", () => {
    dom.aboutModal.hidden = false;
  });
  dom.sidebarToggle.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-hidden");
  });
  dom.fullscreenToggle.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (_) {
      // Browser denied or unsupported; nothing to do.
    }
  });
  for (const btn of document.querySelectorAll(".tab")) {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  }
  dom.aboutClose.addEventListener("click", () => {
    dom.aboutModal.hidden = true;
  });
  dom.aboutModal.addEventListener("click", (event) => {
    if (event.target === dom.aboutModal) dom.aboutModal.hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dom.aboutModal.hidden) {
      dom.aboutModal.hidden = true;
    }
  });
}

function truncateExistingTrails() {
  const max = state.trailLength;
  for (const list of [state.probes, state.ufos, state.comets]) {
    for (const body of list) {
      if (body.trail && body.trail.length > max) {
        body.trail = body.trail.slice(-max);
      }
    }
  }
}

export function setSpeedFromSlider() {
  const t = Number(dom.speed.value) / 100;
  // Slider 0 = real time (1 sec of sim per real sec). Slider 100 ≈ 10 years/sec.
  const realTimeDps = 1 / 86400;
  state.speedDaysPerSecond = realTimeDps * Math.pow(10, t * 8.5);
  dom.speedLabel.textContent = formatSpeed(state.speedDaysPerSecond);
}

function formatSpeed(dps) {
  const realTimeDps = 1 / 86400;
  if (dps <= realTimeDps * 1.1) return "real time";
  const secsPerSec = dps * 86400;
  if (secsPerSec < 90) return `${secsPerSec.toFixed(0)}s/s`;
  if (secsPerSec < 5400) return `${(secsPerSec / 60).toFixed(0)}min/s`;
  if (dps < 1) return `${(secsPerSec / 3600).toFixed(1)}h/s`;
  if (dps < 365) return `${dps.toFixed(1)}d/s`;
  return `${(dps / 365.25).toFixed(1)}y/s`;
}

function handleCanvasClick(event, canvas) {
  ensureAudio(() => logEvent("Audio engine armed"));
  refreshIcons();
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (state.placeMode) {
    const vp = viewport();
    const snap = findOrbitSnap(x, y, vp);
    const SNAP_PX = 28;
    const world = snap.screenDist < SNAP_PX
      ? { x: snap.x, y: snap.y }
      : screenToWorld(x, y, vp);
    const note = Number(dom.gateNote.value);
    const preset = dom.gatePreset.value;
    const gate = addGate(world.x, world.y, { note, preset });
    playPreset(gate.preset, gate.note, 0.5, gate.x, 0.6);
    logEvent(`Gate placed (${gate.preset} note ${gate.note})`);
    renderLists();
    return;
  }

  let best = null;
  let bestDistance = Infinity;
  for (const body of state.screenBodies) {
    const d = Math.hypot(body.x - x, body.y - y);
    if (d < body.radius && d < bestDistance) {
      best = body;
      bestDistance = d;
    }
  }
  if (best) {
    selectBody(best.name);
    playPlanet(best.name, 0.5, 0);
  }
}

export function selectBody(name) {
  state.selected = name;
  renderSelectedPanel();
  renderLists();
  updateHud();
  if (document.body.dataset.tab && document.body.dataset.tab !== "body") {
    setActiveTab("body");
  }
}

export function getDom() {
  return dom;
}

function selectedPlanet() {
  return planetByName(state.selected) || PLANETS[2];
}

export function renderSelectedPanel() {
  const body = selectedPlanet();
  const settings = state.planetSettings.get(body.name);
  dom.selectedName.textContent = body.name;
  const pos = state.positions.get(body.name) || { x: 0, y: 0 };
  const vel = state.velocities.get(body.name) || { x: 0, y: 0 };
  dom.selectedDistance.textContent = `${Math.hypot(pos.x, pos.y).toFixed(3)} AU`;
  dom.selectedVelocity.textContent = `${Math.hypot(vel.x, vel.y).toFixed(3)} AU/y`;
  dom.planetEnabled.checked = settings.enabled;
  dom.planetVolume.value = Math.round(settings.volume * 100);
  dom.planetVolumeLabel.textContent = `${Math.round(settings.volume * 100)}%`;
  dom.pitchOffset.value = settings.pitchOffset;
  const resultNote = body.note + settings.pitchOffset;
  const sign = settings.pitchOffset > 0 ? "+" : "";
  dom.pitchLabel.textContent = `${sign}${settings.pitchOffset} → ${midiToName(resultNote)}`;
  dom.planetPreset.value = settings.preset;
  dom.planetPresetLabel.textContent = `Voice for ${body.name}`;
  dom.planetAction.textContent = `${body.action}`;
  dom.planetActionHint.textContent = ACTION_DESCRIPTIONS[body.name] || "";
  dom.autoLaunchEnabled.checked = settings.autoLaunch;
  const seconds = Math.round(settings.autoIntervalMs / 1000);
  dom.autoInterval.value = seconds;
  dom.autoIntervalLabel.textContent = `${seconds} s`;
  const delayMs = Math.round((settings.delayTime ?? 0.25) * 1000);
  dom.delayTime.value = delayMs;
  dom.delayTimeLabel.textContent = `${(delayMs / 1000).toFixed(2)} s`;
  const mixPct = Math.round((settings.delayMix ?? 0) * 100);
  dom.delayMix.value = mixPct;
  dom.delayMixLabel.textContent = `${mixPct}%`;
  updatePresetHint();
}

function updatePresetHint() {
  const settings = state.planetSettings.get(state.selected);
  const preset = settings?.preset || "carlos";
  dom.planetPresetHint.textContent = presetDescription(preset);
}

export function renderLists() {
  dom.gateList.innerHTML = state.gates.length
    ? state.gates.map((gate) => `
      <div class="item">
        <strong>${gate.preset}</strong> &nbsp;<span class="note-name">${midiToName(gate.note)}</span>
        ${gate.snappedTo ? `<br><span class="muted">on ${gate.snappedTo} orbit</span>` : ""}
        <button type="button" data-remove-gate="${gate.id}">remove</button>
      </div>
    `).join("")
    : `<div class="item">No gates placed</div>`;

  const allCraft = [...state.probes, ...state.ufos, ...state.comets];
  dom.probeList.innerHTML = allCraft.length
    ? allCraft.slice(-8).reverse().map((craft) => `
      <div class="item">
        <strong>${craft.name}</strong><br>
        target ${craft.target || "—"} / ${craft.status}<br>
        r ${Math.hypot(craft.x, craft.y).toFixed(2)} AU
      </div>
    `).join("")
    : `<div class="item">No active craft</div>`;
}

export function updateHud() {
  dom.dateReadout.textContent = formatDate(state.simDate);
  dom.modeReadout.textContent = state.placeMode ? "place gates" : `selected ${state.selected}`;
  dom.audioReadout.textContent = state.audioOn ? "audio on" : "audio off";
  dom.probeReadout.textContent = `${state.probes.length} probes / ${state.ufos.length} ufos`;
  dom.placeMode.textContent = `Place gates: ${state.placeMode ? "on" : "off"}`;
  dom.boostLabel.textContent = `${Number(dom.launchBoost.value).toFixed(1)} km/s`;
  dom.droneVolumeLabel.textContent = `${dom.droneVolume.value}%`;
  dom.droneToneLabel.textContent = midiToName(Number(dom.droneTone.value));
  dom.gateNoteLabel.textContent = midiToName(Number(dom.gateNote.value));
  dom.trailLengthLabel.textContent = String(state.trailLength);
  refreshIcons();
}

export function formatDate(date) {
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function logEvent(text) {
  state.log.unshift({ text, at: formatDate(state.simDate).slice(0, 16) });
  state.log = state.log.slice(0, 12);
  if (typeof console !== "undefined") console.debug(`[astrosynth] ${text}`);
}

export function launchProbe(profileName = dom.probeProfile.value) {
  ensureAudio(() => logEvent("Audio engine armed"));
  updatePlanetCache();
  const earth = state.positions.get("Earth");
  const earthV = state.velocities.get("Earth");
  const targetName = dom.probeTarget.value;
  const target = state.positions.get(targetName) || state.positions.get("Jupiter");
  let boost = Number(dom.launchBoost.value);
  let lateral = 0.22;
  let name = `Probe ${state.probeCounter}`;

  if (profileName === "voyager1") { boost ||= 17; lateral = 0.34; name = `Voyager 1.${state.probeCounter}`; }
  else if (profileName === "voyager2") { boost ||= 15; lateral = -0.18; name = `Voyager 2.${state.probeCounter}`; }
  else if (profileName === "voyager3") { boost ||= 16; lateral = 0.08; name = `Voyager 3.${state.probeCounter}`; }

  const dx = target.x - earth.x;
  const dy = target.y - earth.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tx = -uy;
  const ty = ux;
  const boostAUyr = boost * KM_S_TO_AU_YR;
  const earthR = Math.hypot(earth.x, earth.y);
  const offset = 0.018;
  const probe = {
    id: state.probeCounter,
    name,
    target: targetName,
    x: earth.x + (earth.x / earthR) * offset,
    y: earth.y + (earth.y / earthR) * offset,
    vx: earthV.x + ux * boostAUyr + tx * boostAUyr * lateral,
    vy: earthV.y + uy * boostAUyr + ty * boostAUyr * lateral,
    status: "cruise",
    trail: [],
    visited: new Set(["Earth"]),
    created: state.simDate.getTime(),
    audio: null,
  };
  state.probes.push(probe);
  state.probeCounter += 1;
  createProbeDrone(probe, dom.droneTone, dom.droneVolume, "probe");
  playPlanet("Earth", 0.95, 1);
  addPulse(earth, palette.Earth, "launch");
  logEvent(`${probe.name} launched from Earth toward ${targetName}`);
  renderLists();
}

function spawnUfoSwarm() {
  ensureAudio(() => logEvent("Audio engine armed"));
  updatePlanetCache();
  const mars = state.positions.get("Mars");
  const marsV = state.velocities.get("Mars");
  if (!mars) return;
  const count = 3;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TWO_PI + Math.random() * 0.6;
    const speed = 8 * KM_S_TO_AU_YR + Math.random() * 4 * KM_S_TO_AU_YR;
    const ufo = {
      id: state.ufoCounter,
      name: `UFO ${state.ufoCounter}.${i + 1}`,
      target: null,
      x: mars.x + Math.cos(angle) * 0.04,
      y: mars.y + Math.sin(angle) * 0.04,
      vx: marsV.x * 0.6 + Math.cos(angle) * speed,
      vy: marsV.y * 0.6 + Math.sin(angle) * speed,
      status: "cruise",
      trail: [],
      visited: new Set(),
      created: state.simDate.getTime(),
      audio: null,
    };
    state.ufos.push(ufo);
    state.ufoCounter += 1;
    createProbeDrone(ufo, dom.droneTone, dom.droneVolume, "ufo");
  }
  addPulse(mars, palette.Mars, "ufo");
  playPreset("derbyshire", 70, 0.8, mars.x, 1.2);
  logEvent(`Mars released ${count} UFOs`);
  renderLists();
}

export function runActionFor(name) {
  ensureAudio(() => logEvent("Audio engine armed"));
  const pos = state.positions.get(name) || { x: 0, y: 0 };
  if (name === "Earth") { launchProbe("free"); return; }
  if (name === "Mars") { spawnUfoSwarm(); return; }
  if (name === "Sun") {
    playPlanet("Sun", 1.4, -1);
    playNoise("bright", 0.55, 0.22);
    state.pulses.push({ x: 0, y: 0, color: palette.Sun, type: "flare", age: 0, life: 2.8 });
    for (const probe of [...state.probes, ...state.ufos]) {
      const dx = probe.x;
      const dy = probe.y;
      const r = Math.hypot(dx, dy) || 1;
      probe.vx += (dx / r) * 0.08;
      probe.vy += (dy / r) * 0.08;
    }
    logEvent("Solar flare pushed active craft");
    return;
  }

  const actionMap = {
    Mercury: () => {
      playPlanet("Mercury", 1.1, 2);
      addPulse(pos, palette.Mercury, "ping");
    },
    Venus: () => {
      playPlanet("Venus", 0.9, -1);
      playNoise("dark", 0.6, 0.12);
      addPulse(pos, palette.Venus, "veil");
    },
    Jupiter: () => {
      for (let i = 0; i < 4; i += 1) setTimeout(() => playPlanet("Jupiter", 0.8, i % 2), i * 90);
      addPulse(pos, palette.Jupiter, "assist");
    },
    Saturn: () => {
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * TWO_PI;
        const r = Math.hypot(pos.x, pos.y);
        addGate(Math.cos(angle) * r, Math.sin(angle) * r, { preset: "oram", note: 50 + i });
      }
      renderLists();
      addPulse(pos, palette.Saturn, "ring");
    },
    Uranus: () => {
      playPlanet("Uranus", 1, -1);
      addPulse(pos, palette.Uranus, "tilt");
    },
    Neptune: () => {
      playPlanet("Neptune", 1.15, -2);
      playNoise("dark", 0.85, 0.09);
      addPulse(pos, palette.Neptune, "deep");
    },
  };

  actionMap[name]?.();
  logEvent(`${name}: ${planetByName(name).action}`);
}

export function processAutoLaunches(now) {
  for (const [name, settings] of state.planetSettings.entries()) {
    if (!settings.autoLaunch) continue;
    if (now - settings.lastAutoAt >= settings.autoIntervalMs) {
      settings.lastAutoAt = now;
      runActionFor(name);
    }
  }
}
