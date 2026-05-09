import { state } from "./state.js";
import { planetByName } from "./bodies.js";
import { midiToHz } from "./kepler.js";
import { PRESETS, PRESET_NAMES } from "./presets.js";

export { PRESETS, PRESET_NAMES };

const audio = {
  ctx: null,
  master: null,
  delay: null,
  delayGain: null,
  compressor: null,
};

export function audioContext() {
  return audio.ctx;
}

export function ensureAudio(onArmed) {
  if (audio.ctx) {
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    state.audioOn = true;
    return audio;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  audio.ctx = new AudioContext();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.7;

  audio.compressor = audio.ctx.createDynamicsCompressor();
  audio.compressor.threshold.value = -18;
  audio.compressor.knee.value = 20;
  audio.compressor.ratio.value = 8;
  audio.compressor.attack.value = 0.006;
  audio.compressor.release.value = 0.18;

  audio.delay = audio.ctx.createDelay(1.5);
  audio.delay.delayTime.value = 0.28;
  audio.delayGain = audio.ctx.createGain();
  audio.delayGain.gain.value = 0.21;
  audio.delay.connect(audio.delayGain);
  audio.delayGain.connect(audio.delay);

  audio.master.connect(audio.compressor);
  audio.master.connect(audio.delay);
  audio.delay.connect(audio.compressor);
  audio.compressor.connect(audio.ctx.destination);
  state.audioOn = true;
  onArmed?.();
  return audio;
}

function panFromX(x) {
  return Math.max(-0.95, Math.min(0.95, x / 12));
}

function resolveFilterFreq(filter, baseFreq, strength) {
  if (filter.freqFixed != null) return filter.freqFixed;
  if (filter.freqMulCarrier != null) return baseFreq * filter.freqMulCarrier;
  return (filter.freqBase || 0) + (filter.freqByStrength || 0) * strength;
}

// Data-driven preset player. Reads a preset record from presets.js.
function playWithPreset(preset, ctx, freq, peak, panNode, strength) {
  const now = ctx.currentTime;
  const dur = preset.duration || 1;
  const env = preset.env || { attack: 0.01, release: 0.4, peak: 0.25 };
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
      Math.max(0.0002, peak * (env.peak || 0.25)),
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
      const lvl = peak * (env.peak || 0.18) * (h.level || 1);
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
    masterGain.gain.value = peak * (env.peak || 0.22);
  }

  // Optional echo send.
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
    wet.connect(panNode);
  }

  masterGain.connect(panNode);
}

function panNode(panX) {
  const pan = audio.ctx.createStereoPanner();
  pan.pan.setValueAtTime(panFromX(panX), audio.ctx.currentTime);
  pan.connect(audio.master);
  return pan;
}

// User-configurable per-planet delay, layered on top of the preset's own echo.
// Returns the upstream entry node — the synth chain connects here.
function delayWrap(downstream, time, mix) {
  const ctx = audio.ctx;
  const split = ctx.createGain();
  const dry = ctx.createGain();
  const delay = ctx.createDelay(2);
  const fb = ctx.createGain();
  const wet = ctx.createGain();
  dry.gain.value = Math.max(0, 1 - mix);
  wet.gain.value = mix;
  delay.delayTime.value = Math.max(0.01, Math.min(2, time));
  // Feedback grows with mix so wet repeats are audible without runaway.
  fb.gain.value = Math.min(0.7, mix * 0.55);
  split.connect(dry);
  dry.connect(downstream);
  split.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(downstream);
  return split;
}

export function playPlanet(name, strength = 1, octave = 0) {
  if (!state.audioOn || !audio.ctx) return;
  const body = planetByName(name);
  if (!body) return;
  const settings = state.planetSettings.get(name);
  if (!settings.enabled) return;

  const note = body.note + settings.pitchOffset + octave * 12;
  const freq = midiToHz(note);
  const pos = state.positions.get(name) || { x: 0, y: 0 };
  const preset = PRESETS[settings.preset] || PRESETS.carlos;
  const peak = settings.volume * strength;

  let target = panNode(pos.x);
  if ((settings.delayMix ?? 0) > 0.001) {
    target = delayWrap(target, settings.delayTime ?? 0.25, settings.delayMix);
  }
  playWithPreset(preset, audio.ctx, freq, peak, target, strength);
}

export function playPreset(presetName, note, peak, panX = 0, strength = 1) {
  if (!state.audioOn || !audio.ctx) return;
  const preset = PRESETS[presetName] || PRESETS.carlos;
  const freq = midiToHz(note);
  playWithPreset(preset, audio.ctx, freq, peak, panNode(panX), strength);
}

export function playNoise(colorName, length = 0.25, amount = 0.18) {
  if (!state.audioOn || !audio.ctx) return;
  const ctx = audio.ctx;
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
  gain.gain.value = amount;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start();
}

export function createProbeDrone(probe, toneSlider, volumeSlider, voiceMix = "probe") {
  if (!state.audioOn || !audio.ctx) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const baseTone = Number(toneSlider.value);
  const isUfo = voiceMix === "ufo";
  const base = isUfo ? 90 + baseTone * 1.6 : 58 + baseTone * 1.2;

  oscA.type = isUfo ? "square" : "sawtooth";
  oscB.type = isUfo ? "sawtooth" : "triangle";
  lfo.type = "sine";
  lfo.frequency.value = isUfo ? 4 + Math.random() * 3 : 0.08 + Math.random() * 0.08;
  lfoGain.gain.value = isUfo ? 18 : 9;
  oscA.frequency.value = base;
  oscB.frequency.value = base * (isUfo ? 1.498 : 0.501);
  filter.type = isUfo ? "bandpass" : "lowpass";
  filter.frequency.value = isUfo ? 1400 : 420;
  filter.Q.value = isUfo ? 6 : 4.8;
  gain.gain.value = Number(volumeSlider.value) / 1000;
  lfo.connect(lfoGain);
  lfoGain.connect(oscA.frequency);
  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  pan.connect(audio.master);
  oscA.start(now);
  oscB.start(now);
  lfo.start(now);
  probe.audio = { oscA, oscB, lfo, filter, gain, pan, voiceMix };
}

export function updateProbeDrone(probe, toneSlider, volumeSlider) {
  if (!probe.audio || !audio.ctx) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const speed = Math.hypot(probe.vx, probe.vy);
  const r = Math.hypot(probe.x, probe.y);
  const tone = Number(toneSlider.value);
  const isUfo = probe.audio.voiceMix === "ufo";
  const base = isUfo ? 80 + tone * 1.6 : 46 + tone * 1.35;
  probe.audio.oscA.frequency.setTargetAtTime(base + speed * 8, now, 0.08);
  probe.audio.oscB.frequency.setTargetAtTime((base + r * 2.2) * (isUfo ? 1.498 : 0.5), now, 0.08);
  probe.audio.filter.frequency.setTargetAtTime((isUfo ? 800 : 240) + Math.min(2200, r * 32 + speed * 80), now, 0.18);
  probe.audio.gain.gain.setTargetAtTime(Number(volumeSlider.value) / 1000, now, 0.12);
  probe.audio.pan.pan.setTargetAtTime(panFromX(probe.x), now, 0.12);
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
