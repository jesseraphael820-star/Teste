// Áudio procedural com posicionamento 3D (HRTF). Sem arquivos de som.
import { settings } from './settings.js';

let ctx = null, master = null, sfx = null, amb = null, noiseBuf = null;
let listener = { x: 0, y: 0, z: 0 };
const cues = []; // para o visualizador de som: {x,z,kind,t,enemy}

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfx = ctx.createGain(); sfx.connect(master);
  amb = ctx.createGain(); amb.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
}

export function applyVolumes() {
  if (!ctx) return;
  master.gain.value = settings.masterVolume;
  sfx.gain.value = settings.sfxVolume;
  amb.gain.value = settings.ambientVolume * 0.35;
}

export function setListener(pos, yaw) {
  if (!ctx) return;
  listener = { x: pos.x, y: pos.y, z: pos.z };
  const l = ctx.listener;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  if (l.positionX) {
    l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
    l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz;
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else {
    l.setPosition(pos.x, pos.y, pos.z);
    l.setOrientation(fx, 0, fz, 0, 1, 0);
  }
}

function out(pos) {
  if (!pos) return sfx;
  const y = pos.y ?? 1.2;
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z) || !Number.isFinite(y)) return sfx;
  pos = { x: pos.x, y, z: pos.z };
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = 3; p.maxDistance = 120; p.rolloffFactor = 1.1;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
  else p.setPosition(pos.x, pos.y, pos.z);
  p.connect(sfx);
  return p;
}

function noise(t0, dur, dest, { type = 'bandpass', freq = 1000, q = 1, gain = 1, attack = 0.001, decay = dur, freqEnd = null }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  src.connect(f).connect(g).connect(dest);
  src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
}

function tone(t0, dur, dest, { type = 'sine', freq = 440, freqEnd = null, gain = 0.5, attack = 0.002 }) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function distLowpass(pos, dest) {
  if (!pos) return dest;
  const d = Math.hypot(pos.x - listener.x, pos.z - listener.z);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = Math.max(900, 16000 - d * 260);
  f.connect(dest);
  return f;
}

export function cue(kind, pos, enemy) {
  if (pos) cues.push({ kind, x: pos.x, z: pos.z, t: performance.now(), enemy });
  if (cues.length > 40) cues.shift();
}
export function recentCues() {
  const now = performance.now();
  while (cues.length && now - cues[0].t > 1400) cues.shift();
  return cues;
}

// sound: perfil da arma (config). pos = null => arma do próprio jogador
export function playShot(sound, pos, suppressedTail = false) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const dest = distLowpass(pos, out(pos));
  const p = sound.pitch;
  noise(t, 0.05, dest, { type: 'highpass', freq: 2500 * p, gain: 0.9 * sound.crack, decay: 0.05 });
  noise(t, 0.18 * sound.body, dest, { type: 'lowpass', freq: 1800 * p, freqEnd: 300, gain: 1.0 * sound.body, decay: 0.16 * sound.body + 0.04 });
  tone(t, 0.12 + 0.08 * sound.body, dest, { type: 'triangle', freq: 150 * p, freqEnd: 45, gain: 0.8 * sound.body });
  if (!suppressedTail) noise(t + 0.02, 0.6 * sound.tail + 0.2, dest, { type: 'bandpass', freq: 600 * p, q: 0.6, gain: 0.18 * sound.tail, attack: 0.03, decay: 0.6 * sound.tail + 0.2 });
  if (!pos) {
    // mecânica da arma
    tone(t + 0.03, 0.04, sfx, { type: 'square', freq: 2400 * p, gain: 0.04 });
  }
}

export function playDryFire() { if (!ctx) return; tone(ctx.currentTime, 0.03, sfx, { type: 'square', freq: 1800, gain: 0.08 }); }

export function playReload(stage, pos) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const dest = out(pos);
  if (stage === 'out') { noise(t, 0.08, dest, { type: 'bandpass', freq: 3200, q: 3, gain: 0.25 }); tone(t, 0.05, dest, { type: 'square', freq: 700, gain: 0.05 }); }
  if (stage === 'in') { noise(t, 0.06, dest, { type: 'bandpass', freq: 2200, q: 4, gain: 0.35 }); tone(t + 0.01, 0.04, dest, { type: 'square', freq: 520, gain: 0.08 }); }
  if (stage === 'rack') { noise(t, 0.05, dest, { type: 'highpass', freq: 3000, gain: 0.3 }); noise(t + 0.09, 0.05, dest, { type: 'highpass', freq: 2600, gain: 0.35 }); }
  if (stage === 'shell') { noise(t, 0.05, dest, { type: 'bandpass', freq: 1500, q: 2, gain: 0.3 }); }
}

export function playEquip() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.12, sfx, { type: 'bandpass', freq: 1400, q: 1.5, gain: 0.2 }); }

export function playFootstep(pos, surface, loud = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const dest = distLowpass(pos, out(pos));
  const metal = surface === 'metal';
  noise(t, 0.09, dest, { type: 'bandpass', freq: metal ? 2400 : 900, q: metal ? 4 : 1.2, gain: 0.35 * loud, decay: 0.08 });
  tone(t, 0.06, dest, { type: 'sine', freq: metal ? 300 : 90, freqEnd: 50, gain: 0.25 * loud });
}

export function playHit(head) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (head) { tone(t, 0.18, sfx, { type: 'sine', freq: 1900, gain: 0.22 }); tone(t, 0.12, sfx, { type: 'sine', freq: 2850, gain: 0.08 }); }
  else tone(t, 0.06, sfx, { type: 'triangle', freq: 1100, gain: 0.14 });
}

export function playKill() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, 0.12, sfx, { type: 'triangle', freq: 660, gain: 0.18 });
  tone(t + 0.07, 0.2, sfx, { type: 'triangle', freq: 990, gain: 0.16 });
}

export function playHurt() {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(t, 0.12, sfx, { type: 'lowpass', freq: 500, gain: 0.5 });
  tone(t, 0.15, sfx, { type: 'sine', freq: 120, freqEnd: 60, gain: 0.3 });
}

export function playImpact(pos, surface) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const dest = distLowpass(pos, out(pos));
  if (surface === 'metal') tone(t, 0.12, dest, { type: 'square', freq: 1600 + Math.random() * 800, freqEnd: 900, gain: 0.05 });
  noise(t, 0.05, dest, { type: 'bandpass', freq: surface === 'metal' ? 4000 : 1800, q: 2, gain: 0.18 });
}

export function playWhiz(pos) {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(t, 0.12, out(pos), { type: 'bandpass', freq: 3500, freqEnd: 1200, q: 6, gain: 0.25, attack: 0.03 });
}

export function playBeep(pitch = 1, pos = null) {
  if (!ctx) return;
  tone(ctx.currentTime, 0.08, out(pos), { type: 'square', freq: 1500 * pitch, gain: 0.12 });
}

export function playAbility(kind, pos) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const dest = out(pos);
  switch (kind) {
    case 'flash': noise(t, 0.4, dest, { type: 'highpass', freq: 800, gain: 0.8, decay: 0.4 }); tone(t, 0.6, dest, { type: 'sine', freq: 3200, freqEnd: 2000, gain: 0.08 }); break;
    case 'smoke': noise(t, 1.2, dest, { type: 'lowpass', freq: 1800, freqEnd: 400, gain: 0.4, attack: 0.05, decay: 1.2 }); break;
    case 'wall': tone(t, 0.3, dest, { type: 'sawtooth', freq: 90, freqEnd: 140, gain: 0.15 }); noise(t, 0.2, dest, { type: 'bandpass', freq: 600, gain: 0.3 }); break;
    case 'pulse': tone(t, 0.8, dest, { type: 'sine', freq: 440, freqEnd: 1760, gain: 0.18 }); break;
    case 'sensor': tone(t, 0.12, dest, { type: 'sine', freq: 1200, gain: 0.1 }); tone(t + 0.15, 0.12, dest, { type: 'sine', freq: 1600, gain: 0.1 }); break;
    case 'heal': tone(t, 0.5, dest, { type: 'sine', freq: 520, freqEnd: 780, gain: 0.12 }); break;
    case 'shield': tone(t, 0.35, dest, { type: 'triangle', freq: 300, freqEnd: 600, gain: 0.15 }); break;
    case 'dash': noise(t, 0.25, dest, { type: 'bandpass', freq: 700, freqEnd: 2500, gain: 0.35 }); break;
    case 'throw': noise(t, 0.12, dest, { type: 'bandpass', freq: 900, freqEnd: 300, gain: 0.2 }); break;
    case 'bounce': tone(t, 0.04, dest, { type: 'square', freq: 900, gain: 0.05 }); break;
    case 'reveal': tone(t, 0.25, sfx, { type: 'sine', freq: 880, gain: 0.08 }); break;
  }
}

export function playAnnounce(kind) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const seq = {
    win: [523, 659, 784, 1047], lose: [392, 330, 262], round: [440, 660], plant: [880, 660, 880], defuse: [660, 880, 1100],
    capture: [587, 784], lost: [494, 370], unlock: [784, 988, 1175, 1568], challenge: [659, 880, 1319],
  }[kind] || [600];
  seq.forEach((f, i) => tone(t + i * 0.11, 0.22, sfx, { type: 'triangle', freq: f, gain: 0.14 }));
}

let ambNodes = null;
export function startAmbience(theme) {
  if (!ctx) return;
  stopAmbience();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = theme === 'instalacao' ? 260 : 420;
  const g = ctx.createGain(); g.gain.value = 0.5;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ctx.createGain(); lg.gain.value = 0.25;
  lfo.connect(lg).connect(g.gain);
  src.connect(f).connect(g).connect(amb);
  src.start(); lfo.start();
  const nodes = [src, lfo];
  if (theme === 'instalacao' || theme === 'industrial') {
    const hum = ctx.createOscillator(); hum.frequency.value = theme === 'instalacao' ? 60 : 48;
    const hg = ctx.createGain(); hg.gain.value = 0.05;
    hum.connect(hg).connect(amb); hum.start(); nodes.push(hum);
  }
  ambNodes = nodes;
}
export function stopAmbience() {
  if (ambNodes) for (const n of ambNodes) { try { n.stop(); } catch { /* */ } }
  ambNodes = null;
}
