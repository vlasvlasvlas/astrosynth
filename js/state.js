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
};

for (const body of [SUN, ...PLANETS]) {
  state.planetSettings.set(body.name, {
    enabled: true,
    volume: body.name === "Sun" ? 0.58 : 0.72,
    pitchOffset: 0,
    preset: DEFAULT_PRESETS[body.name] || "carlos",
    autoLaunch: false,
    autoIntervalMs: 8000,
    lastAutoAt: 0,
    delayTime: 0.25,
    delayMix: 0,
  });
}
