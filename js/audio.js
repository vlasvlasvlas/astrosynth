import { state } from "./state.js";
import { planetByName } from "./bodies.js";
import { midiToHz } from "./kepler.js";
import { PRESETS, PRESET_NAMES } from "./presets.js";

export { PRESETS, PRESET_NAMES };

const audio = {
  ctx: null,
  master: null,
  monoOut: null,
  delay: null,
  delayGain: null,
  compressor: null,
};

const MASTER_RAMP = 0.08;
const PLANET_EVENT_PEAK = 0.58;
const MAX_EVENT_PEAK = 0.72;
const PROBE_DRONE_GAIN = 0.026;
const UFO_DRONE_GAIN = 0.018;

function smoothParam(param, value, now, ramp = MASTER_RAMP) {
  if (!param) return;
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
  } else {
    const held = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(held, now);
  }
  param.linearRampToValueAtTime(value, now + ramp);
}

function masterTargetGain() {
  return state.audioOn ? state.masterVolume : 0;
}

export function updateMasterVolume(value = state.masterVolume) {
  state.masterVolume = Math.max(0, Math.min(1, value));
  if (!audio.ctx || !audio.master) return;
  smoothParam(audio.master.gain, masterTargetGain(), audio.ctx.currentTime);
}

export function audioContext() {
  return audio.ctx;
}

export function ensureAudio(onArmed) {
  if (audio.ctx) {
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    state.audioOn = true;
    updateMasterVolume();
    onArmed?.();
    return audio;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  audio.ctx = new AudioContext();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0;

  audio.compressor = audio.ctx.createDynamicsCompressor();
  audio.compressor.threshold.value = -20;
  audio.compressor.knee.value = 18;
  audio.compressor.ratio.value = 10;
  audio.compressor.attack.value = 0.006;
  audio.compressor.release.value = 0.18;

  audio.monoOut = audio.ctx.createGain();
  audio.monoOut.channelCount = 1;
  audio.monoOut.channelCountMode = "explicit";
  audio.monoOut.channelInterpretation = "speakers";

  audio.delay = audio.ctx.createDelay(1.5);
  audio.delay.delayTime.value = 0.28;
  audio.delayGain = audio.ctx.createGain();
  audio.delayGain.gain.value = 0.21;
  audio.delay.connect(audio.delayGain);
  audio.delayGain.connect(audio.delay);

  audio.master.connect(audio.compressor);
  audio.master.connect(audio.delay);
  audio.delay.connect(audio.compressor);
  audio.compressor.connect(audio.monoOut);
  audio.monoOut.connect(audio.ctx.destination);
  state.audioOn = true;
  updateMasterVolume();
  onArmed?.();
  return audio;
}

export function stopAudio() {
  if (!audio.ctx || !audio.master) {
    state.audioOn = false;
    return;
  }
  state.audioOn = false;
  smoothParam(audio.master.gain, 0, audio.ctx.currentTime);
}

function resolveFilterFreq(filter, baseFreq, strength) {
  if (filter.freqFixed != null) return filter.freqFixed;
  if (filter.freqMulCarrier != null) return baseFreq * filter.freqMulCarrier;
  return (filter.freqBase || 0) + (filter.freqByStrength || 0) * strength;
}

// Data-driven preset player. Reads a preset record from presets.js.
function playWithPreset(preset, ctx, freq, peak, outputNode, strength) {
  const now = ctx.currentTime;
  const dur = preset.duration || 1;
  const env = preset.env || { attack: 0.01, release: 0.4, peak: 0.25 };
  const eventPeak = Math.max(0, Math.min(MAX_EVENT_PEAK, peak));
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;

  // Vibrato modulator (optional).
  let vibratoOut = null;
  if (preset.vibrato) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = preset.vibrato.rate;
    lfoGain.gain.value = preset.vibrato.depthHz;
    lfo.connect(lfoGain);
    lfo.start(now);
    lfo.stop(now + dur + 0.5);
    vibratoOut = lfoGain;
  }

  // Branch by source type. A preset uses one of: voices+filter, additive, noise.
  if (preset.voices) {
    const sum = ctx.createGain();
    sum.gain.value = 1;
    for (const v of preset.voices) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = v.type;
      osc.frequency.value = freq * v.freqMul;
      g.gain.value = v.level;
      if (vibratoOut) vibratoOut.connect(osc.frequency);
      osc.connect(g);
      g.connect(sum);
      osc.start(now);
      osc.stop(now + dur + 0.3);
    }

    let chainOut = sum;
    if (preset.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = preset.filter.type;
      filter.frequency.value = resolveFilterFreq(preset.filter, freq, strength);
      filter.Q.value = preset.filter.q || 1;
      sum.connect(filter);
      chainOut = filter;
    }

    // Master AR envelope on voices+filter chain.
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, eventPeak * (env.peak || 0.25)),
      now + env.attack
    );
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + env.attack + env.release);
    chainOut.connect(masterGain);
  } else if (preset.additive) {
    // Each partial has its own envelope.
    for (const h of preset.additive) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * h.mul;
      const lvl = eventPeak * (env.peak || 0.18) * (h.level || 1);
      const decay = h.decay || env.release || 0.5;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(lvl, now + (env.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + decay + 0.2);
    }
    masterGain.gain.value = 1;
  } else if (preset.noise) {
    const len = preset.noise.duration || 0.5;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    src.buffer = buf;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq * preset.noise.freqStart, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, freq * preset.noise.freqEnd),
      now + len
    );
    filter.Q.setValueAtTime(
      (preset.noise.qBase || 1) + (preset.noise.qByStrength || 0) * strength,
      now
    );
    src.connect(filter);
    filter.connect(masterGain);
    src.start();
    masterGain.gain.value = eventPeak * (env.peak || 0.22);
  }

  // Optional echo baked into the preset timbre.
  if (preset.echo) {
    const delay = ctx.createDelay(2);
    const fb = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = preset.echo.time;
    fb.gain.value = preset.echo.feedback;
    wet.gain.value = preset.echo.mix || 0.3;
    delay.connect(fb);
    fb.connect(delay);
    masterGain.connect(delay);
    delay.connect(wet);
    wet.connect(outputNode);
  }

  masterGain.connect(outputNode);
}

function outputNode() {
  const out = audio.ctx.createGain();
  out.gain.value = 1;
  out.connect(audio.master);
  return out;
}

export function playPlanet(name, strength = 1, octave = 0) {
  if (!state.audioOn || !audio.ctx) return;
  const body = planetByName(name);
  if (!body) return;
  const settings = state.planetSettings.get(name);
  if (!settings.enabled) return;

  const note = body.note + settings.pitchOffset + octave * 12;
  const freq = midiToHz(note);
  const preset = PRESETS[settings.preset] || PRESETS.carlos;
  const peak = PLANET_EVENT_PEAK * strength;

  const target = outputNode();
  playWithPreset(preset, audio.ctx, freq, peak, target, strength);
}

export function playPreset(presetName, note, peak, _positionX = 0, strength = 1) {
  if (!state.audioOn || !audio.ctx) return;
  const preset = PRESETS[presetName] || PRESETS.carlos;
  const freq = midiToHz(note);
  playWithPreset(preset, audio.ctx, freq, peak, outputNode(), strength);
}

export function playNoise(colorName, length = 0.25, amount = 0.18) {
  if (!state.audioOn || !audio.ctx) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buffer;
  filter.type = colorName === "dark" ? "lowpass" : "bandpass";
  filter.frequency.value = colorName === "dark" ? 700 : 2400;
  filter.Q.value = 1.5;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(Math.min(MAX_EVENT_PEAK, amount), now + 0.018);
  gain.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.04, length));
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start(now);
  src.stop(now + length + 0.05);
}

export function createProbeDrone(probe, toneSlider, _volumeSlider, voiceMix = "probe") {
  if (!state.audioOn || !audio.ctx) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const output = ctx.createGain();
  const baseTone = Number(toneSlider.value);
  const isUfo = voiceMix === "ufo";
  const base = midiToHz(baseTone);

  lfo.type = "sine";
  if (isUfo) {
    oscA.type = "square";    oscB.type = "sawtooth";
    lfo.frequency.value = 4 + Math.random() * 3;   lfoGain.gain.value = 18;
    filter.type = "bandpass"; filter.frequency.value = 1400; filter.Q.value = 6;
  } else if (voiceMix === "voyager1") {
    oscA.type = "square";    oscB.type = "sawtooth";
    lfo.frequency.value = 2 + Math.random() * 2;   lfoGain.gain.value = 14;
    filter.type = "bandpass"; filter.frequency.value = 900;  filter.Q.value = 4;
  } else if (voiceMix === "voyager2") {
    oscA.type = "sine";      oscB.type = "triangle";
    lfo.frequency.value = 0.04 + Math.random() * 0.04; lfoGain.gain.value = 5;
    filter.type = "lowpass";  filter.frequency.value = 600;  filter.Q.value = 2;
  } else if (voiceMix === "voyager3") {
    oscA.type = "triangle";  oscB.type = "sine";
    lfo.frequency.value = 0.5 + Math.random() * 0.5; lfoGain.gain.value = 9;
    filter.type = "lowpass";  filter.frequency.value = 500;  filter.Q.value = 3;
  } else {
    oscA.type = "sawtooth";  oscB.type = "triangle";
    lfo.frequency.value = 0.08 + Math.random() * 0.08; lfoGain.gain.value = 9;
    filter.type = "lowpass";  filter.frequency.value = 420;  filter.Q.value = 4.8;
  }
  oscA.frequency.value = base;
  oscB.frequency.value = base * (isUfo ? 1.498 : 0.501);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(isUfo ? UFO_DRONE_GAIN : PROBE_DRONE_GAIN, now + 0.18);
  lfo.connect(lfoGain);
  lfoGain.connect(oscA.frequency);
  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  output.connect(audio.master);
  oscA.start(now);
  oscB.start(now);
  lfo.start(now);
  probe.audio = { oscA, oscB, lfo, filter, gain, output, voiceMix };
}

export function updateProbeDrone(probe, toneSlider) {
  if (!probe.audio || !audio.ctx) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const speed = Math.hypot(probe.vx, probe.vy);
  const r = Math.hypot(probe.x, probe.y);
  const tone = Number(toneSlider.value);
  const vm = probe.audio.voiceMix;
  const isUfo = vm === "ufo";
  const base = midiToHz(tone);
  probe.audio.oscA.frequency.setTargetAtTime(base + speed * 8, now, 0.08);
  probe.audio.oscB.frequency.setTargetAtTime((base + r * 2.2) * (isUfo ? 1.498 : 0.5), now, 0.08);
  const filterBase = isUfo ? 800 : vm === "voyager1" ? 600 : vm === "voyager2" ? 400 : vm === "voyager3" ? 350 : 240;
  probe.audio.filter.frequency.setTargetAtTime(filterBase + Math.min(2200, r * 32 + speed * 80), now, 0.18);
  probe.audio.gain.gain.setTargetAtTime(isUfo ? UFO_DRONE_GAIN : PROBE_DRONE_GAIN, now, 0.12);
}

export function stopProbeDrone(probe) {
  if (!probe.audio || !audio.ctx) return;
  const now = audio.ctx.currentTime;
  probe.audio.gain.gain.setTargetAtTime(0.0001, now, 0.08);
  for (const node of [probe.audio.oscA, probe.audio.oscB, probe.audio.lfo]) {
    try {
      node.stop(now + 0.5);
    } catch (_) {
      // already stopped
    }
  }
  probe.audio = null;
}

export function masterNode() {
  return audio.master;
}
