// Synthesizes the film's sound design into public/sfx/*.wav (44.1 kHz, 16-bit stereo).
// Deterministic: a seeded PRNG drives all noise, so every run writes identical files.
// Run: npm run sfx
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sfx");
mkdirSync(OUT, { recursive: true });

let seed = 0x2f6e2b1;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};
const noise = () => rand() * 2 - 1;
const TAU = Math.PI * 2;

function writeWav(name, left, right = left) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  writeFileSync(join(OUT, name), buf);
}

const buffer = (seconds) => new Float32Array(Math.round(seconds * SR));

/** Normalises to a peak and applies 5 ms fades so nothing clicks at the edges. */
function finish(x, peak = 0.9) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? peak / m : 1;
  const edge = Math.round(0.005 * SR);
  for (let i = 0; i < x.length; i++) {
    const fade = Math.min(1, i / edge, (x.length - 1 - i) / edge);
    x[i] *= g * fade;
  }
  return x;
}

/** State-variable filter; mode "lp" | "bp". cutoff(i) may vary per sample. */
function svf(x, cutoff, q, mode) {
  const y = new Float32Array(x.length);
  let low = 0;
  let band = 0;
  for (let i = 0; i < x.length; i++) {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff(i), SR / 6)) / SR);
    low += f * band;
    const high = x[i] - low - band / q;
    band += f * high;
    y[i] = mode === "lp" ? low : band;
  }
  return y;
}

// 1. Dark drone for the opening (0 → 7.53 s): detuned saws on A1/E2 + a sub, filter slowly opening.
{
  const d = 7.6;
  const saw = (t, f) => 2 * ((t * f) % 1) - 1;
  const raw = buffer(d);
  for (let i = 0; i < raw.length; i++) {
    const t = i / SR;
    raw[i] = saw(t, 55) + saw(t, 55.35) * 0.8 + saw(t, 82.41) * 0.5 + saw(t, 82.9) * 0.4 + Math.sin(TAU * 27.5 * t) * 1.2;
  }
  const lp = svf(raw, (i) => 180 + 900 * Math.pow(i / raw.length, 2), 1.2, "lp");
  const L = buffer(d);
  const R = buffer(d);
  for (let i = 0; i < lp.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 1.8) * (0.55 + 0.45 * (t / d));
    const wob = 0.12 * Math.sin(TAU * 0.23 * t);
    L[i] = lp[i] * env * (1 + wob);
    R[i] = lp[i] * env * (1 - wob);
  }
  writeWav("drone.wav", finish(L, 0.7), finish(R, 0.7));
}

// 2. Sub-bass impacts: pitch-dropping sine, saturated, plus a short filtered transient.
function impact(name, d, f0, f1, decay, punch) {
  const x = buffer(d);
  const hit = svf(Float32Array.from({ length: x.length }, noise), () => 2400, 0.8, "lp");
  let phase = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    phase += (TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.06))) / SR;
    x[i] = Math.tanh(Math.sin(phase) * 2.2) * Math.exp(-t / decay) + hit[i] * Math.exp(-t / 0.012) * punch;
  }
  writeWav(name, finish(x, 0.95));
}
impact("impact.wav", 2.6, 160, 36, 0.7, 1.4);
impact("impact-soft.wav", 1.2, 120, 48, 0.28, 0.7);

// 3. Riser (2.55 s): resonant band-passed noise sweeping up + a rising tone, cut dead at the end.
{
  const d = 2.55;
  const n = Math.round(d * SR);
  const bp = svf(Float32Array.from({ length: n }, noise), (i) => 250 * Math.pow(24, i / n), 6, "bp");
  const L = buffer(d);
  const R = buffer(d);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    phase += (TAU * (180 * Math.pow(4, p))) / SR;
    const env = Math.pow(p, 2.2);
    const tone = Math.sin(phase) * 0.35 * env;
    L[i] = bp[i] * env + tone;
    R[i] = bp[i] * env * 0.9 + tone;
  }
  writeWav("riser.wav", finish(L, 0.85), finish(R, 0.85));
}

// 4. Whoosh (0.7 s): band-passed noise with a bell envelope, panned left → right.
{
  const d = 0.7;
  const n = Math.round(d * SR);
  const bp = svf(Float32Array.from({ length: n }, noise), (i) => 500 + 3500 * Math.sin((Math.PI * i) / n), 1.6, "bp");
  const L = buffer(d);
  const R = buffer(d);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const env = Math.pow(Math.sin(Math.PI * p), 2);
    L[i] = bp[i] * env * (1 - p * 0.8);
    R[i] = bp[i] * env * (0.2 + p * 0.8);
  }
  writeWav("whoosh.wav", finish(L, 0.8), finish(R, 0.8));
}

// 5. UI click (60 ms): bright blip + tiny noise tick.
{
  const x = buffer(0.06);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = Math.sin(TAU * 2900 * t) * Math.exp(-t / 0.006) + noise() * Math.exp(-t / 0.002) * 0.4;
  }
  writeWav("click.wav", finish(x, 0.7));
}

// 6. Shimmer pad for the final logo (4.5 s): soft high partials with slow tremolo.
{
  const d = 4.5;
  const L = buffer(d);
  const R = buffer(d);
  const partials = [440, 659.25, 880, 1318.5, 1760];
  for (let i = 0; i < L.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 1.4) * Math.min(1, (d - t) / 1.6);
    let l = 0;
    let r = 0;
    partials.forEach((f, k) => {
      const trem = 0.6 + 0.4 * Math.sin(TAU * (0.3 + k * 0.11) * t + k);
      l += (Math.sin(TAU * f * t) * trem) / (k + 1);
      r += (Math.sin(TAU * f * 1.003 * t + k) * trem) / (k + 1);
    });
    L[i] = l * env;
    R[i] = r * env;
  }
  writeWav("shimmer.wav", finish(L, 0.5), finish(R, 0.5));
}

console.log("sfx written to", OUT);
