/** Browser audio plumbing: capture, WAV encoding, PCM16 for Realtime, playback. */

export const RATE = 24000;

const WORKLET = `
class TapProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) this.port.postMessage(new Float32Array(ch));
    return true;
  }
}
registerProcessor('tap', TapProcessor);
`;

let workletUrl: string | null = null;
function workletModuleUrl() {
  if (!workletUrl) {
    workletUrl = URL.createObjectURL(
      new Blob([WORKLET], { type: "application/javascript" }),
    );
  }
  return workletUrl;
}

/* --------------------------------------------------------------- capture */

export type Tap = (chunk: Float32Array) => void;

export class Recorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];
  private taps = new Set<Tap>();
  /** Running peak, so the UI can draw a live level meter. */
  level = 0;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.ctx = new AudioContext({ sampleRate: RATE });
    await this.ctx.audioWorklet.addModule(workletModuleUrl());
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "tap");
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const chunk = e.data;
      this.chunks.push(chunk);
      let peak = 0;
      for (let i = 0; i < chunk.length; i++) {
        const v = Math.abs(chunk[i]);
        if (v > peak) peak = v;
      }
      this.level = peak;
      for (const tap of this.taps) tap(chunk);
    };
    src.connect(this.node);
    // Keep the graph pulling without making the mic audible.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.node.connect(sink).connect(this.ctx.destination);
  }

  /** Subscribe to live chunks — used to stream mic audio into Realtime. */
  onChunk(tap: Tap) {
    this.taps.add(tap);
    return () => this.taps.delete(tap);
  }

  get seconds() {
    return this.chunks.reduce((n, c) => n + c.length, 0) / RATE;
  }

  stop(): Float32Array {
    this.node?.port.close();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.node = null;
    this.stream = null;
    this.taps.clear();
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Float32Array(total);
    let at = 0;
    for (const c of this.chunks) {
      out.set(c, at);
      at += c.length;
    }
    this.chunks = [];
    return out;
  }
}

/* -------------------------------------------------------------- encoding */

export function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) {
    bin += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + STEP, bytes.length)),
    );
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function pcm16Base64(samples: Float32Array): string {
  const pcm = floatToPcm16(samples);
  return bytesToBase64(new Uint8Array(pcm.buffer));
}

export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

/** Boson accepts WAV for reference audio, so we encode it ourselves. */
export function encodeWav(samples: Float32Array, rate = RATE): Uint8Array {
  const pcm = floatToPcm16(samples);
  const buf = new ArrayBuffer(44 + pcm.byteLength);
  const v = new DataView(buf);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + pcm.byteLength, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, pcm.byteLength, true);
  new Uint8Array(buf, 44).set(new Uint8Array(pcm.buffer));
  return new Uint8Array(buf);
}

export async function decodeToMono(
  data: ArrayBuffer,
): Promise<{ samples: Float32Array; duration: number }> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(data.slice(0));
    const ch = buf.getChannelData(0);
    return { samples: new Float32Array(ch), duration: buf.duration };
  } finally {
    void ctx.close();
  }
}

/* ------------------------------------------------------------- loudness */

/**
 * Higgs TTS comes back quiet and inconsistent — measured peaks of 0.33 and 0.73
 * for two voices saying the same line, at an RMS around 0.06-0.10 where speech
 * normally sits at 0.15-0.25. On laptop speakers in a noisy room that is
 * inaudible, so every clip is normalised before it reaches the output.
 */
export function normalize(samples: Float32Array, targetPeak = 0.95): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  if (peak < 1e-4) return samples;
  const gain = Math.min(targetPeak / peak, 12); // cap so silence isn't amplified into hiss
  if (gain <= 1.02) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return out;
}

/* -------------------------------------------------------------- playback */

/** Gapless scheduler for the PCM chunks Higgs Realtime streams back. */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private at = 0;
  private live = new Set<AudioBufferSourceNode>();
  /** Live output level, for the mascot and the waveform. */
  level = 0;

  private out: AudioNode | null = null;

  private ensure() {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: RATE });
      this.at = this.ctx.currentTime;
      // Streaming audio can't be peak-normalised ahead of time, so lift it with
      // a fixed gain and let a compressor catch the transients.
      const gain = this.ctx.createGain();
      gain.gain.value = 3.2;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 8;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      gain.connect(comp).connect(this.ctx.destination);
      this.out = gain;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  push(samples: Float32Array) {
    if (!samples.length) return;
    const ctx = this.ensure();
    const buf = ctx.createBuffer(1, samples.length, RATE);
    buf.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out ?? ctx.destination);
    const now = ctx.currentTime;
    if (this.at < now + 0.04) this.at = now + 0.04;
    src.start(this.at);
    this.at += buf.duration;
    this.live.add(src);
    src.onended = () => this.live.delete(src);

    let peak = 0;
    for (let i = 0; i < samples.length; i += 16) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    this.level = peak;
  }

  /** Barge-in: drop everything still queued. */
  interrupt() {
    for (const src of this.live) {
      try {
        src.stop();
      } catch {
        /* already finished */
      }
    }
    this.live.clear();
    this.level = 0;
    if (this.ctx) this.at = this.ctx.currentTime;
  }

  get playing() {
    return this.live.size > 0;
  }

  close() {
    this.interrupt();
    void this.ctx?.close();
    this.ctx = null;
  }
}

export type Playback = { onended: (() => void) | null; stop(): void };

/**
 * Plays a base64 clip through Web Audio rather than an <audio> element, so the
 * buffer can be peak-normalised first. An <audio> tag would play Boson's output
 * at its own quiet level with no way to lift it.
 */
export async function playBase64(b64: string): Promise<Playback> {
  const bytes = base64ToBytes(b64);
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );

  const loud = normalize(new Float32Array(decoded.getChannelData(0)));
  const buf = ctx.createBuffer(1, loud.length, decoded.sampleRate);
  buf.getChannelData(0).set(loud);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);

  const handle: Playback = {
    onended: null,
    stop() {
      try {
        src.stop();
      } catch {
        /* already finished */
      }
    },
  };
  src.onended = () => {
    handle.onended?.();
    void ctx.close();
  };
  src.start();
  return handle;
}
