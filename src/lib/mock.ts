import "server-only";
import type { WordStamp } from "./types";

/**
 * Demo mode. With no BOSON_API_KEY the whole flow still runs end to end on
 * synthesised tones, so the UI can be built and shown before keys land.
 */
const RATE = 24000;

export function mockWav(seconds: number, seed = 1): string {
  const n = Math.floor(RATE * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, n * 2, true);

  // Syllable-ish bursts so the rhythm bars have something real to align.
  const syllables = Math.max(2, Math.round(seconds * 3.4));
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const pos = (t / seconds) * syllables;
    const within = pos - Math.floor(pos);
    const gate = Math.sin(Math.PI * Math.min(1, within / 0.72)) ** 2;
    const f = 150 + 40 * Math.sin(seed + Math.floor(pos));
    const s = Math.sin(2 * Math.PI * f * t) * 0.45 * gate;
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true);
  }
  return Buffer.from(buf).toString("base64");
}

export function mockStamps(text: string, seconds: number): WordStamp[] {
  const chars = [...text.replace(/[\s，。！？、；：,.!?;:]/g, "")];
  const per = seconds / Math.max(1, chars.length);
  return chars.map((word, i) => ({
    word,
    start: +(i * per).toFixed(2),
    end: +((i + 1) * per).toFixed(2),
  }));
}
