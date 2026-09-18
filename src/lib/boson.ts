import "server-only";
import type { SpeechResult, WordStamp } from "./types";

const BASE = process.env.BOSON_BASE_URL ?? "https://api.boson.ai";
const TTS_MODEL = "higgs-tts-3";

/** Higgs TTS gets unreliable past ~300 characters, so we split on sentence boundaries. */
const CHUNK_LIMIT = 280;

export const hasBosonKey = () => Boolean(process.env.BOSON_API_KEY);

function key(): string {
  const k = process.env.BOSON_API_KEY;
  if (!k) throw new Error("BOSON_API_KEY is not set");
  return k;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The account rate-limits well within a normal demo click-rate, and a 429 in
 * front of judges is indistinguishable from a broken app, so retry with backoff.
 */
async function send(
  path: string,
  init: RequestInit,
  tries = 4,
): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key()}`, ...(init.headers ?? {}) },
      cache: "no-store",
    });
    if (res.status !== 429) return res;
    last = res;
    if (attempt < tries - 1) await sleep(700 * 2 ** attempt);
  }
  return last as Response;
}

async function boson<T>(path: string, init: RequestInit): Promise<T> {
  const res = await send(path, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Boson ${path} -> ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/* ---------------------------------------------------------------- voices */

export async function createVoice(
  refAudioBase64: string,
  refText: string,
  description?: string,
): Promise<string> {
  // The live API returns `voice_id`; the docs samples show `voice` / `id`.
  const out = await boson<{ voice_id?: string; voice?: string; id?: string }>(
    "/v1/audio/voices",
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ref_audio: refAudioBase64,
        ref_text: refText,
        ...(description ? { description } : {}),
      }),
    },
  );
  const id = out.voice_id ?? out.voice ?? out.id;
  if (!id) throw new Error("Boson returned no voice id");
  return id;
}

/* ---------------------------------------------------------------- speech */

/** Split on CJK and Latin sentence enders, keeping every chunk under the limit. */
export function chunkForTts(input: string): string[] {
  if (input.length <= CHUNK_LIMIT) return [input];
  const parts = input.split(/(?<=[。！？!?.;；\n])/g);
  const out: string[] = [];
  let buf = "";
  for (const part of parts) {
    if ((buf + part).length > CHUNK_LIMIT && buf) {
      out.push(buf.trim());
      buf = part;
    } else {
      buf += part;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

type SpeechOpts = {
  input: string;
  voice?: string;
  timestamps?: boolean;
  format?: "mp3" | "wav" | "pcm" | "opus" | "aac" | "flac";
  tnLanguage?: string;
};

/**
 * One synthesis call. When `timestamps` is set the API returns a JSON envelope
 * with base64 audio instead of raw bytes.
 *
 * Note: `timestamps` is accepted but comes back `null` on the live API, for
 * every language including the documented English example. The client recovers
 * syllable windows from the audio instead — see `deriveStamps` in ./score.
 */
export async function speech(opts: SpeechOpts): Promise<SpeechResult> {
  const format = opts.format ?? "wav";
  const body: Record<string, unknown> = {
    model: TTS_MODEL,
    input: opts.input,
    voice: opts.voice ?? "default",
    response_format: format,
  };
  if (opts.timestamps) body.timestamps = true;
  if (opts.tnLanguage) body.tn_language = opts.tnLanguage;

  const res = await send("/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Boson speech -> ${res.status}: ${text.slice(0, 400)}`);
  }

  if (opts.timestamps) {
    const env = (await res.json()) as {
      audio: string;
      response_format?: string;
      timestamps: WordStamp[] | null;
    };
    return {
      audio: env.audio,
      format: env.response_format ?? format,
      timestamps: env.timestamps ?? null,
    };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { audio: buf.toString("base64"), format, timestamps: null };
}

/* -------------------------------------------------------------- realtime */

export type ClientSecret = {
  value: string;
  expires_at: number;
  session: { id: string };
};

export async function mintClientSecret(seconds = 600): Promise<ClientSecret> {
  return boson<ClientSecret>("/v1/realtime/client_secrets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expires_after: { seconds } }),
  });
}

/* ---------------------------------------------------------------- avatar */

export type VideoJob = {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  progress?: number;
  error?: unknown;
};

export async function createVideo(args: {
  refImage: string;
  ttsInput: string;
  voice: string;
  size?: "640x640" | "640x480" | "480x640";
}): Promise<VideoJob> {
  return boson<VideoJob>("/v1/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      model: "higgs-avatar",
      ref_image: args.refImage,
      input_tts: {
        model: TTS_MODEL,
        input: args.ttsInput,
        voice: args.voice,
      },
      size: args.size ?? "480x640",
    }),
  });
}

export async function getVideo(id: string): Promise<VideoJob> {
  return boson<VideoJob>(`/v1/videos/${id}`, { method: "GET" });
}

export async function videoContent(id: string): Promise<ArrayBuffer> {
  const res = await send(`/v1/videos/${id}/content`, { method: "GET" });
  if (!res.ok) throw new Error(`Boson video content -> ${res.status}`);
  return res.arrayBuffer();
}
