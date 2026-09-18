import type { PracticeScore, ScoreBand, WordScore, WordStamp } from "./types";

export const ENVELOPE_BINS = 96;

/**
 * Normalized RMS energy envelope. This is what we compare instead of phonemes:
 * Boson has no pronunciation-scoring endpoint, but rhythm and stress are what
 * actually make a heritage speaker sound foreign, and they live in the envelope.
 */
export function envelope(samples: Float32Array, bins = ENVELOPE_BINS): number[] {
  if (samples.length === 0) return new Array<number>(bins).fill(0);
  const per = samples.length / bins;
  const out = new Array<number>(bins).fill(0);
  for (let b = 0; b < bins; b++) {
    const start = Math.floor(b * per);
    const end = Math.max(start + 1, Math.floor((b + 1) * per));
    let sum = 0;
    for (let i = start; i < end && i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    out[b] = Math.sqrt(sum / Math.max(1, end - start));
  }
  const peak = Math.max(...out);
  if (peak <= 1e-6) return out;
  return out.map((v) => v / peak);
}

/** Trim leading/trailing near-silence so pauses before speaking don't skew rhythm. */
export function trimSilence(env: number[], floor = 0.08): number[] {
  let a = 0;
  let b = env.length - 1;
  while (a < b && env[a] < floor) a++;
  while (b > a && env[b] < floor) b--;
  const cut = env.slice(a, b + 1);
  return cut.length >= 8 ? cut : env;
}

function resample(env: number[], bins = ENVELOPE_BINS): number[] {
  if (env.length === bins) return env;
  const out = new Array<number>(bins).fill(0);
  for (let i = 0; i < bins; i++) {
    const pos = (i / (bins - 1)) * (env.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(env.length - 1, lo + 1);
    out[i] = env[lo] + (env[hi] - env[lo]) * (pos - lo);
  }
  return out;
}

/** Classic DTW with a warping path, used to align the learner to their target. */
export function dtw(a: number[], b: number[]) {
  const n = a.length;
  const m = b.length;
  const INF = Number.POSITIVE_INFINITY;
  const cost: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(INF),
  );
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const d = Math.abs(a[i - 1] - b[j - 1]);
      cost[i][j] =
        d + Math.min(cost[i - 1][j], cost[i][j - 1], cost[i - 1][j - 1]);
    }
  }
  // Walk the path back so each target bin knows where it landed for the learner.
  const map = new Array<number>(n).fill(0);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    map[i - 1] = j - 1;
    const best = Math.min(cost[i - 1][j], cost[i][j - 1], cost[i - 1][j - 1]);
    if (best === cost[i - 1][j - 1]) {
      i--;
      j--;
    } else if (best === cost[i - 1][j]) {
      i--;
    } else {
      j--;
    }
  }
  const distance = cost[n][m] / (n + m);
  return { distance, map };
}

const PUNCT = /[\s，。！？、；：,.!?;:"'“”‘’()（）]/g;
const strip = (s: string) => s.replace(PUNCT, "");

/** Character-level similarity — the right granularity for Chinese. */
export function similarity(a: string, b: string): number {
  const x = strip(a);
  const y = strip(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
  }
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function band(overall: number): ScoreBand {
  if (overall >= 82) return "nailed";
  if (overall >= 60) return "close";
  return "keep-going";
}

function tipFor(
  accuracy: number,
  rhythm: number,
  pace: number,
  paceRatio: number,
  worst: WordScore | undefined,
): string {
  if (accuracy < 0.55) {
    return "The words didn't quite land. Play it once more and shadow it — speak along at the same time.";
  }
  if (pace < 0.6) {
    return paceRatio > 1.25
      ? "You're slower than your target. Chinese rides on a steadier beat — try to keep moving."
      : "You're racing ahead. Give the tones room to actually land.";
  }
  if (rhythm < 0.6 && worst) {
    return `Your stress drifts around 「${worst.word}」. Listen for where your own voice leans on it.`;
  }
  if (rhythm < 0.75) {
    return "Close. Match where your voice rises and falls, not just the syllables.";
  }
  return "That's you, speaking Mandarin. Do it again before your brain argues.";
}

export function scorePractice(args: {
  target: string;
  heard: string;
  targetEnvelope: number[];
  userEnvelope: number[];
  targetDuration: number;
  userDuration: number;
  stamps: WordStamp[] | null;
}): PracticeScore {
  const targetEnv = resample(trimSilence(args.targetEnvelope));
  const userEnv = resample(trimSilence(args.userEnvelope));

  const accuracy = clamp01(similarity(args.target, args.heard));

  const { distance, map } = dtw(targetEnv, userEnv);
  const rhythm = clamp01(1 - distance * 3.2);

  const paceRatio =
    args.targetDuration > 0.15 && args.userDuration > 0.15
      ? args.userDuration / args.targetDuration
      : 1;
  const pace = clamp01(1 - Math.abs(Math.log2(paceRatio)) * 0.72);

  // Map each target word through the warping path to see where it drifted.
  const words: WordScore[] = [];
  const stamps = args.stamps ?? [];
  const span = stamps.length
    ? Math.max(...stamps.map((s) => s.end)) || args.targetDuration
    : args.targetDuration;
  for (const s of stamps) {
    const centerNorm = span > 0 ? (s.start + s.end) / 2 / span : 0;
    const bin = Math.min(
      targetEnv.length - 1,
      Math.max(0, Math.round(centerNorm * (targetEnv.length - 1))),
    );
    const landedNorm = map[bin] / (userEnv.length - 1);
    const drift = Math.abs(centerNorm - landedNorm);
    words.push({ word: s.word, drift, ok: drift < 0.09 });
  }

  const overall = Math.round(
    (accuracy * 0.45 + rhythm * 0.35 + pace * 0.2) * 100,
  );
  const worst = [...words].sort((a, b) => b.drift - a.drift)[0];

  return {
    overall,
    accuracy: Math.round(accuracy * 100),
    rhythm: Math.round(rhythm * 100),
    pace: Math.round(pace * 100),
    band: band(overall),
    words,
    heard: args.heard,
    target: args.target,
    tip: tipFor(accuracy, rhythm, pace, paceRatio, worst),
    targetEnvelope: targetEnv,
    userEnvelope: userEnv,
  };
}
