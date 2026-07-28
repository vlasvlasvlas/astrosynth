import { PLANETS, SUN, DEFAULT_PRESETS } from "./bodies.js";

export const state = {
  running: true,
  audioOn: false,
  placeMode: false,
  selected: "Earth",
  viewScale: "log",
  readerEnabled: true,
  readerAngle: 0,
  simDate: new Date(),
  speedDaysPerSecond: 1 / 86400,
  lastFrame: performance.now(),
  positions: new Map(),
  velocities: new Map(),
  gates: [],
  probes: [],
  ufos: [],
  comets: [],
  pulses: [],
  log: [],
  planetSettings: new Map(),
  probeCounter: 1,
  ufoCounter: 1,
  cometCounter: 1,
  screenBodies: [],
  lastUiUpdate: 0,
  nextCometAt: 0,
  trailLength: 340,
  masterVolume: 0.7,
};

for (const body of [SUN, ...PLANETS]) {
  state.planetSettings.set(body.name, {
    enabled: true,
    pitchOffset: 0,
    preset: DEFAULT_PRESETS[body.name] || "carlos",
    autoLaunch: false,
    autoIntervalMs: 8000,
    lastAutoAt: 0,
  });
}
